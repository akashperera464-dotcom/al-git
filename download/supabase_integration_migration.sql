-- ============================================================================
-- Verda ERP · Integration Migration — auto-posting wires + sales invoices
-- ----------------------------------------------------------------------------
-- Run in Supabase SQL Editor → New query → Run.
-- Safe to re-run (idempotent — uses if not exists).
--
-- What this adds:
--   1. sales_invoices table — for made-tea sales (from Factory dispatch)
--   2. payroll_allowances table — captures loyalty cash bonus redemptions
--      that auto-flow into the next payroll run for that worker
--   3. Adds `journal_id` link column to factory_batches (so a batch knows
--      which journal entry was auto-created when it was sold)
--   4. Adds `journal_id` link column to stock_movements (links GRN/issue
--      to its auto-created journal entry)
--   5. Adds `journal_id` link column to payroll_runs (links approved payroll
--      to its auto-created wages journal entry)
--   6. Adds `journal_id` link column to loyalty_redemptions (links fulfilled
--      cash-bonus redemptions to payroll_allowances row)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1 · SALES INVOICES — for made-tea sales (Factory → Buyer)
-- ----------------------------------------------------------------------------
create table if not exists sales_invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_no      text unique not null,
  batch_id        uuid references factory_batches(id) on delete set null,
  buyer_name      text not null,
  invoice_date    date not null default current_date,
  due_date        date,
  grade_code      text,
  grade_name      text,
  qty_kg          numeric(12,2) not null default 0,
  price_per_kg    numeric(12,2) not null default 0,
  gross_amount    numeric(14,2) not null default 0,
  commission_pct  numeric(5,2) not null default 0,    -- broker commission %
  commission_amt  numeric(14,2) not null default 0,
  net_amount      numeric(14,2) not null default 0,
  status          text not null default 'unpaid',     -- unpaid | partial | paid
  paid_amount     numeric(14,2) not null default 0,
  journal_id      uuid references journal_entries(id) on delete set null,
  version         integer not null default 1,
  updated_by_uid  text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_sinv_batch   on sales_invoices(batch_id);
create index if not exists idx_sinv_buyer   on sales_invoices(buyer_name);
create index if not exists idx_sinv_status  on sales_invoices(status);

-- ----------------------------------------------------------------------------
-- 2 · PAYROLL ALLOWANCES — captures loyalty cash bonuses + other ad-hoc
--     allowances that should auto-flow into the next payroll run
-- ----------------------------------------------------------------------------
create table if not exists payroll_allowances (
  id              uuid primary key default gen_random_uuid(),
  worker_id       uuid not null references workers(id) on delete cascade,
  worker_name     text,
  source_type     text not null,             -- loyalty_redemption | manual | bonus
  source_id       text,                       -- e.g. loyalty_redemptions.id
  description     text not null,
  amount          numeric(12,2) not null,
  period_month    integer,                    -- target payroll month (null = next run)
  period_year     integer,
  consumed_by_run uuid references payroll_runs(id) on delete set null,  -- null until consumed
  consumed_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_pa_worker   on payroll_allowances(worker_id);
create index if not exists idx_pa_consumed on payroll_allowances(consumed_by_run);
create index if not exists idx_pa_period   on payroll_allowances(period_year, period_month);

-- ----------------------------------------------------------------------------
-- 3 · LINK COLUMNS — so each transactional row knows its auto-posted journal
-- ----------------------------------------------------------------------------
alter table factory_batches      add column if not exists sales_invoice_id uuid references sales_invoices(id) on delete set null;
alter table stock_movements      add column if not exists journal_id uuid references journal_entries(id) on delete set null;
alter table payroll_runs         add column if not exists journal_id uuid references journal_entries(id) on delete set null;
alter table supplier_invoices    add column if not exists journal_id uuid references journal_entries(id) on delete set null;
alter table loyalty_redemptions  add column if not exists payroll_allowance_id uuid references payroll_allowances(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 4 · VERSION-BUMP TRIGGERS for new tables
-- ----------------------------------------------------------------------------
drop trigger if exists trg_sales_invoices_version on sales_invoices;
create trigger trg_sales_invoices_version before update on sales_invoices
  for each row execute function bump_version();

drop trigger if exists trg_payroll_allowances_version on payroll_allowances;
create trigger trg_payroll_allowances_version before update on payroll_allowances
  for each row execute function bump_version();

-- ----------------------------------------------------------------------------
-- 5 · RLS + REAL-TIME for new tables
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array['sales_invoices','payroll_allowances']) loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "open_write" on %I;', t);
    execute format('create policy "open_write" on %I for all using (true) with check (true);', t);
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- DONE — verify with:
--   select count(*) from sales_invoices;        → 0 (empty, ready for use)
--   select count(*) from payroll_allowances;    → 0 (empty, ready for use)
--   select column_name from information_schema.columns
--     where table_name = 'factory_batches' and column_name = 'sales_invoice_id';
-- ----------------------------------------------------------------------------
