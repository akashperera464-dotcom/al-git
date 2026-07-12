-- ============================================================================
-- Verda ERP · Phase-2 Migration — Finance / Payroll / Factory / HR / Procurement
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- SAFE TO RE-RUN (idempotent — uses `if not exists` / `on conflict do nothing`).
--
-- What this adds on top of the existing schema:
--   1. FACTORY FLOOR — batch tracking with stages (withering → packing) + recovery %
--   2. FINANCE — chart of accounts + double-entry journal + supplier invoices + payments
--   3. PAYROLL — payroll runs with EPF/ETF (Sri Lankan statutory) + payslips
--   4. HR — worker master enhancement (EPF no, bank, skill, leave) + leave requests
--   5. PROCUREMENT — purchase orders + goods-receipt notes + stock movements (FIFO)
--   6. OFFLINE CONFLICT RESOLUTION — version column + updated_by_uid on transactional tables
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUM TYPES (new)
-- ----------------------------------------------------------------------------
do $$ begin
  create type factory_stage as enum ('withering', 'rolling', 'fermentation', 'drying', 'sorting', 'packing', 'dispatched');
exception when duplicate_object then null; end $$;

do $$ begin
  create type batch_status as enum ('open', 'in_progress', 'completed', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gl_account_type as enum ('asset', 'liability', 'equity', 'revenue', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type journal_status as enum ('draft', 'posted', 'reversed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payroll_status as enum ('draft', 'approved', 'paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_type as enum ('annual', 'sick', 'casual', 'maternity', 'nopay');
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_status as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type po_status as enum ('draft', 'sent', 'partially_received', 'received', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stock_move_type as enum ('in', 'out', 'adjust', 'transfer');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- 1 · FACTORY FLOOR — batch tracking through every manufacturing stage
-- ============================================================================
-- Replaces the existing minimal `factory_batches` table with a richer model.
-- We add columns to the existing table (idempotent) rather than recreate it.

-- Add manufacturing-stage columns to factory_batches if missing
alter table factory_batches add column if not exists batch_code     text unique;
alter table factory_batches add column if not exists estate_id      uuid references estates(id) on delete set null;
alter table factory_batches add column if not exists division_id    uuid references divisions(id) on delete set null;
alter table factory_batches add column if not exists supplier_id    text; -- Firebase uid
alter table factory_batches add column if not exists source_records uuid[] default '{}'; -- harvest_record ids
alter table factory_batches add column if not exists current_stage  factory_stage not null default 'withering';
alter table factory_batches add column if not exists status         batch_status not null default 'open';
alter table factory_batches add column if not exists started_at     timestamptz;
alter table factory_batches add column if not exists completed_at   timestamptz;
alter table factory_batches add column if not exists started_by     text;
alter table factory_batches add column if not exists notes          text;
alter table factory_batches add column if not exists version        integer not null default 1;
alter table factory_batches add column if not exists updated_by_uid text;
create index if not exists idx_fb_estate on factory_batches(estate_id);
create index if not exists idx_fb_stage  on factory_batches(current_stage);
create index if not exists idx_fb_status on factory_batches(status);

-- Per-stage log — every transition records operator + duration + measurements
create table if not exists factory_stage_logs (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references factory_batches(id) on delete cascade,
  stage           factory_stage not null,
  operator_uid    text,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  duration_min    integer,
  input_kg        numeric(10,2),
  output_kg       numeric(10,2),
  moisture_pct    numeric(5,2),
  temperature_c   numeric(5,2),
  humidity_pct    numeric(5,2),
  grade_code      text,
  grade_name      text,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_fsl_batch on factory_stage_logs(batch_id);
create index if not exists idx_fsl_stage on factory_stage_logs(stage);

-- ============================================================================
-- 2 · FINANCE — chart of accounts + double-entry journal + supplier invoices
-- ============================================================================
create table if not exists gl_accounts (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  type        gl_account_type not null,
  is_active   boolean not null default true,
  parent_id   uuid references gl_accounts(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_gl_type   on gl_accounts(type);
create index if not exists idx_gl_parent  on gl_accounts(parent_id);

create table if not exists journal_entries (
  id            uuid primary key default gen_random_uuid(),
  entry_no      text unique not null,
  entry_date    date not null default current_date,
  description   text not null,
  reference     text,
  estate_id     uuid references estates(id) on delete set null,
  status        journal_status not null default 'draft',
  posted_by     text,
  posted_at     timestamptz,
  version       integer not null default 1,
  updated_by_uid text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_je_date   on journal_entries(entry_date);
create index if not exists idx_je_status on journal_entries(status);
create index if not exists idx_je_estate on journal_entries(estate_id);

create table if not exists journal_lines (
  id            uuid primary key default gen_random_uuid(),
  journal_id    uuid not null references journal_entries(id) on delete cascade,
  account_id    uuid not null references gl_accounts(id),
  debit         numeric(14,2) not null default 0,
  credit        numeric(14,2) not null default 0,
  description   text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_jl_journal on journal_lines(journal_id);
create index if not exists idx_jl_account on journal_lines(account_id);

-- Supplier invoices (green-leaf supply + other purchases)
create table if not exists supplier_invoices (
  id            uuid primary key default gen_random_uuid(),
  invoice_no    text unique not null,
  supplier_id   text not null, -- Firebase uid
  estate_id     uuid references estates(id) on delete set null,
  invoice_date  date not null default current_date,
  due_date      date,
  gross_amount  numeric(14,2) not null default 0,
  deduction     numeric(14,2) not null default 0,
  net_amount    numeric(14,2) not null default 0,
  status        text not null default 'unpaid', -- unpaid | partial | paid
  paid_amount   numeric(14,2) not null default 0,
  journal_id    uuid references journal_entries(id) on delete set null,
  version       integer not null default 1,
  updated_by_uid text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_si_supplier on supplier_invoices(supplier_id);
create index if not exists idx_si_status   on supplier_invoices(status);

-- ============================================================================
-- 3 · PAYROLL — runs with EPF/ETF + payslips (Sri Lankan statutory)
-- ============================================================================
create table if not exists payroll_runs (
  id            uuid primary key default gen_random_uuid(),
  run_code      text unique not null,
  estate_id     uuid references estates(id) on delete set null,
  period_month  integer not null,  -- 1..12
  period_year   integer not null,
  status        payroll_status not null default 'draft',
  total_gross   numeric(14,2) not null default 0,
  total_epf     numeric(14,2) not null default 0,  -- employee EPF deduction (8%)
  total_etf     numeric(14,2) not null default 0,  -- employer ETF contribution (3%)
  total_employer_epf numeric(14,2) not null default 0, -- employer EPF (12%)
  total_net     numeric(14,2) not null default 0,
  approved_by   text,
  approved_at   timestamptz,
  paid_at       timestamptz,
  version       integer not null default 1,
  updated_by_uid text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_pr_estate on payroll_runs(estate_id);
create index if not exists idx_pr_period on payroll_runs(period_year, period_month);

create table if not exists payslips (
  id              uuid primary key default gen_random_uuid(),
  payroll_run_id  uuid not null references payroll_runs(id) on delete cascade,
  worker_id       uuid not null references workers(id) on delete cascade,
  basic_salary    numeric(12,2) not null default 0,
  overtime_pay    numeric(12,2) not null default 0,
  allowances      numeric(12,2) not null default 0,
  gross_pay       numeric(12,2) not null default 0,
  epf_employee    numeric(12,2) not null default 0,  -- 8%
  epf_employer    numeric(12,2) not null default 0,  -- 12%
  etf_employer    numeric(12,2) not null default 0,  -- 3%
  deductions      numeric(12,2) not null default 0,
  net_pay         numeric(12,2) not null default 0,
  days_worked     integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ps_run    on payslips(payroll_run_id);
create index if not exists idx_ps_worker on payslips(worker_id);

-- ============================================================================
-- 4 · HR — enhance `workers` table with HR fields + leave requests
-- ============================================================================
alter table workers add column if not exists full_name        text;
alter table workers add column if not exists date_of_birth    date;
alter table workers add column if not exists gender           text;  -- male | female | other
alter table workers add column if not exists address          text;
alter table workers add column if not exists emergency_contact text;
alter table workers add column if not exists hire_date        date;
alter table workers add column if not exists termination_date date;
alter table workers add column if not exists epf_number       text;
alter table workers add column if not exists etf_number       text;
alter table workers add column if not exists bank_name        text;
alter table workers add column if not exists bank_branch      text;
alter table workers add column if not exists basic_salary     numeric(12,2) not null default 0;
alter table workers add column if not exists skill_matrix     jsonb not null default '{}';
alter table workers add column if not exists leave_balance    jsonb not null default '{"annual":14,"sick":7,"casual":3}';
alter table workers add column if not exists version          integer not null default 1;
alter table workers add column if not exists updated_by_uid   text;
create index if not exists idx_workers_epf    on workers(epf_number);
create index if not exists idx_workers_status on workers(status);

create table if not exists leave_requests (
  id            uuid primary key default gen_random_uuid(),
  worker_id     uuid not null references workers(id) on delete cascade,
  leave_type    leave_type not null,
  start_date    date not null,
  end_date      date not null,
  days          integer not null,
  reason        text,
  status        leave_status not null default 'PENDING',
  approved_by   text,
  approved_at   timestamptz,
  version       integer not null default 1,
  updated_by_uid text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_lr_worker on leave_requests(worker_id);
create index if not exists idx_lr_status on leave_requests(status);

-- ============================================================================
-- 5 · PROCUREMENT — purchase orders + GRNs + stock movements (FIFO valuation)
-- ============================================================================
create table if not exists stock_items (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,
  name            text not null,
  category        text not null,  -- fertilizer | agrochemical | fuel | equipment | other
  unit            text not null default 'kg',
  qty_on_hand     numeric(12,2) not null default 0,
  reorder_level   numeric(12,2) not null default 0,
  unit_cost       numeric(12,2) not null default 0,  -- moving average
  estate_id       uuid references estates(id) on delete set null,
  version         integer not null default 1,
  updated_by_uid  text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_si_category on stock_items(category);
create index if not exists idx_si_estate   on stock_items(estate_id);

create table if not exists purchase_orders (
  id              uuid primary key default gen_random_uuid(),
  po_code         text unique not null,
  supplier_name   text not null,
  estate_id       uuid references estates(id) on delete set null,
  order_date      date not null default current_date,
  expected_date   date,
  status          po_status not null default 'draft',
  total_amount    numeric(14,2) not null default 0,
  notes           text,
  version         integer not null default 1,
  updated_by_uid  text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_po_estate on purchase_orders(estate_id);
create index if not exists idx_po_status on purchase_orders(status);

create table if not exists purchase_order_lines (
  id              uuid primary key default gen_random_uuid(),
  po_id           uuid not null references purchase_orders(id) on delete cascade,
  stock_item_id   uuid not null references stock_items(id),
  qty_ordered     numeric(12,2) not null,
  qty_received    numeric(12,2) not null default 0,
  unit_cost       numeric(12,2) not null,
  line_total      numeric(14,2) not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_pol_po on purchase_order_lines(po_id);

create table if not exists goods_receipts (
  id              uuid primary key default gen_random_uuid(),
  grn_code        text unique not null,
  po_id           uuid references purchase_orders(id) on delete set null,
  received_date   date not null default current_date,
  received_by     text,
  supplier_invoice_no text,
  notes           text,
  version         integer not null default 1,
  updated_by_uid  text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_grn_po on goods_receipts(po_id);

create table if not exists goods_receipt_lines (
  id              uuid primary key default gen_random_uuid(),
  grn_id          uuid not null references goods_receipts(id) on delete cascade,
  stock_item_id   uuid not null references stock_items(id),
  po_line_id      uuid references purchase_order_lines(id) on delete set null,
  qty_received    numeric(12,2) not null,
  unit_cost       numeric(12,2) not null,
  line_total      numeric(14,2) not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_grl_grn on goods_receipt_lines(grn_id);

-- Stock movements — every in/out/adjust/transfer logged for audit + FIFO valuation
create table if not exists stock_movements (
  id              uuid primary key default gen_random_uuid(),
  stock_item_id   uuid not null references stock_items(id) on delete cascade,
  move_type       stock_move_type not null,
  qty             numeric(12,2) not null,
  unit_cost       numeric(12,2) not null,
  reference_type  text,  -- grn | po | issue | adjustment | transfer
  reference_id    uuid,
  from_estate_id  uuid references estates(id),
  to_estate_id    uuid references estates(id),
  performed_by    text,
  performed_at    timestamptz not null default now(),
  notes           text
);
create index if not exists idx_sm_item on stock_movements(stock_item_id);
create index if not exists idx_sm_type on stock_movements(move_type);
create index if not exists idx_sm_date on stock_movements(performed_at);

-- ============================================================================
-- 6 · OFFLINE CONFLICT RESOLUTION — version columns added above to all
--       transactional tables. The pattern is:
--       1. Client reads row → captures `version`.
--       2. Client writes → includes `version` in WHERE clause.
--       3. If 0 rows updated → conflict detected → client refetches + retries.
--       4. Trigger bumps `version` on every successful UPDATE.
-- ============================================================================

-- Generic version-bump trigger function
create or replace function bump_version()
returns trigger as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

-- Attach the trigger to every versioned table
do $$
declare t text;
begin
  for t in select unnest(array[
    'factory_batches','journal_entries','supplier_invoices',
    'payroll_runs','workers','leave_requests',
    'stock_items','purchase_orders','goods_receipts'
  ]) loop
    execute format('drop trigger if exists trg_%s_version on %I;', t, t);
    execute format('create trigger trg_%s_version before update on %I for each row execute function bump_version();', t, t);
  end loop;
end $$;

-- ============================================================================
-- 7 · ROW-LEVEL SECURITY — open policies (client RBAC enforces boundaries)
-- ============================================================================
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "open_write" on %I;', t);
    execute format('create policy "open_write" on %I for all using (true) with check (true);', t);
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- ============================================================================
-- 8 · SEED DATA — minimal chart of accounts + a few stock items
-- ============================================================================
insert into gl_accounts (code, name, type) values
  ('1000', 'Cash on Hand',         'asset'),
  ('1010', 'Bank - Current',       'asset'),
  ('1100', 'Accounts Receivable',  'asset'),
  ('1200', 'Inventory - Raw',      'asset'),
  ('1210', 'Inventory - Finished', 'asset'),
  ('1500', 'Plant & Equipment',    'asset'),
  ('2000', 'Accounts Payable',     'liability'),
  ('2100', 'EPF Payable',          'liability'),
  ('2110', 'ETF Payable',          'liability'),
  ('2200', 'Supplier Advances',    'liability'),
  ('3000', 'Owner Equity',         'equity'),
  ('3100', 'Retained Earnings',    'equity'),
  ('4000', 'Tea Sales Revenue',    'revenue'),
  ('4010', 'By-product Revenue',   'revenue'),
  ('5000', 'Green Leaf Cost',      'expense'),
  ('5010', 'Wages & Salaries',     'expense'),
  ('5020', 'EPF Expense (Employer)','expense'),
  ('5030', 'ETF Expense (Employer)','expense'),
  ('5040', 'Factory Fuel & Power', 'expense'),
  ('5050', 'Fertilizer & Chemicals','expense'),
  ('5060', 'Repairs & Maintenance','expense'),
  ('5070', 'Transport Cost',       'expense')
on conflict (code) do nothing;

insert into stock_items (code, name, category, unit, qty_on_hand, reorder_level, unit_cost) values
  ('FERT-UREA',  'Urea (46% N)',         'fertilizer',   'kg', 1250, 200, 95),
  ('FERT-MOP',   'MOP (Potash)',         'fertilizer',   'kg',  680, 150, 180),
  ('FERT-TSP',   'TSP (Phosphate)',      'fertilizer',   'kg',  420, 100, 175),
  ('FERT-DOL',   'Dolomite',             'fertilizer',   'kg',  300,  80,  60),
  ('AGRO-SUL',   'Sulphur WDG',          'agrochemical', 'kg',   80,  20, 420),
  ('AGRO-COP',   'Copper Oxychloride',   'agrochemical', 'kg',   45,  15, 850),
  ('FUEL-DIE',   'Diesel',               'fuel',         'L',   850, 200, 320),
  ('EQP-SHEARS', 'Plucking Shears',      'equipment',    'pc',   35,  10,1250)
on conflict (code) do nothing;

-- ============================================================================
-- DONE — verify with:  select count(*) from gl_accounts;  → should return 22.
-- ============================================================================
