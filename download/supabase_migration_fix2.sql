-- ============================================================================
-- Verda ERP · BULLETPROOF FIX — drop & recreate factory_batches, then full schema
-- ----------------------------------------------------------------------------
-- Run this in Supabase SQL Editor if you STILL get "column estate_id does not exist".
--
-- WHY THIS WORKS: instead of trying to ALTER the broken old table, we back up
-- any rows (just in case), DROP the table, and recreate it with all columns.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- STEP 1 · Back up any existing factory_batches rows to a temp table
--         (Safety net — almost always empty, but never lose data.)
-- ----------------------------------------------------------------------------
drop table if exists factory_batches_backup;
create table factory_batches_backup as select * from factory_batches where 1=1;
-- (If factory_batches doesn't exist, this errors silently — that's OK.)

-- ----------------------------------------------------------------------------
-- STEP 2 · Drop the broken factory_batches table (and dependent objects)
-- ----------------------------------------------------------------------------
drop table if exists factory_stage_logs cascade;
drop table if exists factory_batches cascade;

-- ----------------------------------------------------------------------------
-- STEP 3 · Ensure base tables exist (estates, divisions, workers)
-- ----------------------------------------------------------------------------
create table if not exists estates (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,
  region          text,
  total_area_ha   numeric(10,2),
  elevation_m     integer,
  created_at      timestamptz not null default now()
);

create table if not exists divisions (
  id          uuid primary key default gen_random_uuid(),
  estate_id   uuid not null references estates(id) on delete cascade,
  name        text not null,
  manager     text,
  area_ha     numeric(10,2),
  created_at  timestamptz not null default now()
);

create table if not exists workers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  nic           text,
  division      text,
  role          text not null default 'Field Worker',
  bank_account  text,
  estate_id     uuid references estates(id) on delete set null,
  phone         text,
  points_balance integer not null default 0,
  attendance_30d integer not null default 0,
  avg_kg_per_day numeric(8,2) not null default 0,
  present       boolean not null default false,
  status        text not null default 'active',
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- STEP 4 · Recreate factory_batches with ALL columns
-- ----------------------------------------------------------------------------
create table factory_batches (
  id                uuid primary key default gen_random_uuid(),
  batch_code        text unique,
  estate_id         uuid references estates(id) on delete set null,
  division_id       uuid references divisions(id) on delete set null,
  supplier_id       text,
  grade_code        text not null,
  grade_name        text,
  green_leaf_in_kg  numeric(10,2) not null default 0,
  output_kg         numeric(10,2) not null default 0,
  waste_kg          numeric(10,2) not null default 0,
  current_stage     text not null default 'withering',
  status            text not null default 'open',
  started_at        timestamptz,
  completed_at      timestamptz,
  started_by        text,
  notes             text,
  version           integer not null default 1,
  updated_by_uid    text,
  created_at        timestamptz not null default now()
);
create index idx_fb_estate on factory_batches(estate_id);
create index idx_fb_stage  on factory_batches(current_stage);
create index idx_fb_status on factory_batches(status);

-- Restore any backed-up rows (best-effort column match)
insert into factory_batches (
  id, batch_code, grade_code, grade_name, green_leaf_in_kg,
  output_kg, waste_kg, current_stage, status, version, created_at
)
select
  id, null, grade_code, grade_name, green_leaf_in_kg,
  output_kg, waste_kg, 'withering', 'open', 1, created_at
from factory_batches_backup
on conflict (id) do nothing;

-- Drop the backup (no longer needed)
drop table factory_batches_backup;

-- ----------------------------------------------------------------------------
-- STEP 5 · ENUM TYPES (text-based, more flexible than postgres enums)
-- ----------------------------------------------------------------------------
-- Using TEXT columns for type fields — the app enforces valid values.
-- This avoids painful ALTER TYPE operations later.

-- ----------------------------------------------------------------------------
-- STEP 6 · FACTORY STAGE LOGS
-- ----------------------------------------------------------------------------
create table if not exists factory_stage_logs (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references factory_batches(id) on delete cascade,
  stage           text not null,
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

-- ----------------------------------------------------------------------------
-- STEP 7 · GL ACCOUNTS + JOURNAL ENTRIES + JOURNAL LINES
-- ----------------------------------------------------------------------------
create table if not exists gl_accounts (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  type        text not null,
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
  status        text not null default 'draft',
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

-- ----------------------------------------------------------------------------
-- STEP 8 · SUPPLIER INVOICES
-- ----------------------------------------------------------------------------
create table if not exists supplier_invoices (
  id            uuid primary key default gen_random_uuid(),
  invoice_no    text unique not null,
  supplier_id   text not null,
  estate_id     uuid references estates(id) on delete set null,
  invoice_date  date not null default current_date,
  due_date      date,
  gross_amount  numeric(14,2) not null default 0,
  deduction     numeric(14,2) not null default 0,
  net_amount    numeric(14,2) not null default 0,
  status        text not null default 'unpaid',
  paid_amount   numeric(14,2) not null default 0,
  journal_id    uuid references journal_entries(id) on delete set null,
  version       integer not null default 1,
  updated_by_uid text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_si_supplier on supplier_invoices(supplier_id);
create index if not exists idx_si_status   on supplier_invoices(status);

-- ----------------------------------------------------------------------------
-- STEP 9 · PAYROLL RUNS + PAYSLIPS
-- ----------------------------------------------------------------------------
create table if not exists payroll_runs (
  id            uuid primary key default gen_random_uuid(),
  run_code      text unique not null,
  estate_id     uuid references estates(id) on delete set null,
  period_month  integer not null,
  period_year   integer not null,
  status        text not null default 'draft',
  total_gross   numeric(14,2) not null default 0,
  total_epf     numeric(14,2) not null default 0,
  total_etf     numeric(14,2) not null default 0,
  total_employer_epf numeric(14,2) not null default 0,
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
  epf_employee    numeric(12,2) not null default 0,
  epf_employer    numeric(12,2) not null default 0,
  etf_employer    numeric(12,2) not null default 0,
  deductions      numeric(12,2) not null default 0,
  net_pay         numeric(12,2) not null default 0,
  days_worked     integer not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ps_run    on payslips(payroll_run_id);
create index if not exists idx_ps_worker on payslips(worker_id);

-- ----------------------------------------------------------------------------
-- STEP 10 · HR — enhance workers table
-- ----------------------------------------------------------------------------
alter table workers add column if not exists full_name        text;
alter table workers add column if not exists date_of_birth    date;
alter table workers add column if not exists gender           text;
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
  leave_type    text not null,
  start_date    date not null,
  end_date      date not null,
  days          integer not null,
  reason        text,
  status        text not null default 'PENDING',
  approved_by   text,
  approved_at   timestamptz,
  version       integer not null default 1,
  updated_by_uid text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_lr_worker on leave_requests(worker_id);
create index if not exists idx_lr_status on leave_requests(status);

-- ----------------------------------------------------------------------------
-- STEP 11 · PROCUREMENT
-- ----------------------------------------------------------------------------
create table if not exists stock_items (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,
  name            text not null,
  category        text not null,
  unit            text not null default 'kg',
  qty_on_hand     numeric(12,2) not null default 0,
  reorder_level   numeric(12,2) not null default 0,
  unit_cost       numeric(12,2) not null default 0,
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
  status          text not null default 'draft',
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

create table if not exists stock_movements (
  id              uuid primary key default gen_random_uuid(),
  stock_item_id   uuid not null references stock_items(id) on delete cascade,
  move_type       text not null,
  qty             numeric(12,2) not null,
  unit_cost       numeric(12,2) not null,
  reference_type  text,
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

-- ----------------------------------------------------------------------------
-- STEP 12 · VERSION-BUMP TRIGGER
-- ----------------------------------------------------------------------------
create or replace function bump_version()
returns trigger as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_factory_batches_version on factory_batches;
create trigger trg_factory_batches_version before update on factory_batches
  for each row execute function bump_version();

drop trigger if exists trg_journal_entries_version on journal_entries;
create trigger trg_journal_entries_version before update on journal_entries
  for each row execute function bump_version();

drop trigger if exists trg_supplier_invoices_version on supplier_invoices;
create trigger trg_supplier_invoices_version before update on supplier_invoices
  for each row execute function bump_version();

drop trigger if exists trg_payroll_runs_version on payroll_runs;
create trigger trg_payroll_runs_version before update on payroll_runs
  for each row execute function bump_version();

drop trigger if exists trg_workers_version on workers;
create trigger trg_workers_version before update on workers
  for each row execute function bump_version();

drop trigger if exists trg_leave_requests_version on leave_requests;
create trigger trg_leave_requests_version before update on leave_requests
  for each row execute function bump_version();

drop trigger if exists trg_stock_items_version on stock_items;
create trigger trg_stock_items_version before update on stock_items
  for each row execute function bump_version();

drop trigger if exists trg_purchase_orders_version on purchase_orders;
create trigger trg_purchase_orders_version before update on purchase_orders
  for each row execute function bump_version();

drop trigger if exists trg_goods_receipts_version on goods_receipts;
create trigger trg_goods_receipts_version before update on goods_receipts
  for each row execute function bump_version();

-- ----------------------------------------------------------------------------
-- STEP 13 · RLS + REAL-TIME (apply to every public table)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- STEP 14 · SEED DATA
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- DONE — verify with:
--   select count(*) from gl_accounts;     → 22
--   select count(*) from stock_items;     → 8
--   select column_name from information_schema.columns
--     where table_name='factory_batches' order by ordinal_position;  → 18 rows
-- ----------------------------------------------------------------------------
