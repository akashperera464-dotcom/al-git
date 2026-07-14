-- ============================================================================
-- Verda ERP · Tea Industry Features Migration
-- 1. Out-Turn Ratio daily tracking + alert
-- 2. Supplier Fertilizer/Chemical Loans + auto-deduct
-- 3. Factory Floor Wastage Logging (per-stage)
-- 4. Made Tea Auction Sales Tracking (broker, lot, 1% commission)
-- ----------------------------------------------------------------------------
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================================

-- ============================================================================
-- 1 · OUT-TURN RATIO (daily green-leaf vs made-tea comparison)
-- ============================================================================
create table if not exists out_turn_daily (
  id              uuid primary key default gen_random_uuid(),
  record_date     date not null unique,
  estate_id       uuid references estates(id) on delete set null,
  green_leaf_kg   numeric(12,2) not null default 0,
  made_tea_kg     numeric(12,2) not null default 0,
  out_turn_pct    numeric(5,2) not null default 0,
  is_alert        boolean not null default false,
  alert_reason    text,
  computed_at     timestamptz not null default now()
);
create index if not exists idx_otd_date on out_turn_daily(record_date desc);
create index if not exists idx_otd_alert on out_turn_daily(is_alert) where is_alert = true;

-- ============================================================================
-- 2 · SUPPLIER FERTILIZER / CHEMICAL LOANS
-- ============================================================================
create table if not exists supplier_fertilizer_loans (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         text not null,
  supplier_name       text,
  estate_id           uuid references estates(id) on delete set null,
  loan_type           text not null default 'fertilizer', -- fertilizer | agrochemical | tea_packet | cash_advance
  description         text,
  item_name           text,
  quantity            numeric(10,2) not null default 0,
  unit                text not null default 'kg',
  unit_cost           numeric(12,2) not null default 0,
  principal_amount    numeric(14,2) not null default 0,
  monthly_installment numeric(14,2) not null default 0,
  balance             numeric(14,2) not null default 0,
  installments_paid   integer not null default 0,
  total_installments  integer not null default 1,
  issued_date         date not null default current_date,
  status              text not null default 'active', -- active | cleared | defaulted
  version             integer not null default 1,
  created_at          timestamptz not null default now()
);
create index if not exists idx_sfl_supplier on supplier_fertilizer_loans(supplier_id);
create index if not exists idx_sfl_status on supplier_fertilizer_loans(status);

-- Deduction log (tracks each monthly deduction applied to a supplier invoice)
create table if not exists supplier_loan_deductions (
  id              uuid primary key default gen_random_uuid(),
  loan_id         uuid not null references supplier_fertilizer_loans(id) on delete cascade,
  supplier_id     text not null,
  invoice_id      uuid references supplier_invoices(id) on delete set null,
  deduction_date  date not null default current_date,
  amount          numeric(14,2) not null default 0,
  balance_after   numeric(14,2) not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_sld_loan on supplier_loan_deductions(loan_id);
create index if not exists idx_sld_supplier on supplier_loan_deductions(supplier_id);

-- ============================================================================
-- 3 · FACTORY FLOOR WASTAGE LOGGING (per-stage)
-- ============================================================================
-- Extend factory_stage_logs with waste columns
alter table factory_stage_logs add column if not exists waste_kg        numeric(10,2) not null default 0;
alter table factory_stage_logs add column if not exists waste_reason     text;
-- waste_reason values: 'over_withering' | 'spillage' | 'fermentation_failure' | 'drying_burn' | 'sorting_reject' | 'moisture_loss' | 'other'

-- Also add process_waste_total to factory_batches (sum of all stage wastes)
alter table factory_batches add column if not exists process_waste_kg   numeric(10,2) not null default 0;

-- ============================================================================
-- 4 · MADE TEA AUCTION SALES TRACKING
-- ============================================================================
create table if not exists auction_batches (
  id                  uuid primary key default gen_random_uuid(),
  auction_date        date not null default current_date,
  lot_number          text not null,
  batch_id            uuid references factory_batches(id) on delete set null,
  broker_name         text not null,
  grade_code          text,
  grade_name          text,
  qty_kg              numeric(12,2) not null default 0,
  catalog_price_kg    numeric(12,2) not null default 0,  -- reserve price in catalog
  sold_price_kg       numeric(12,2) not null default 0,  -- actual sold price
  gross_sales         numeric(14,2) not null default 0,  -- qty × sold_price
  brokerage_pct       numeric(5,2) not null default 1.0, -- strict 1% Colombo Tea Auction
  brokerage_amount    numeric(14,2) not null default 0,
  net_amount          numeric(14,2) not null default 0,  -- gross - brokerage
  status              text not null default 'cataloged', -- cataloged | sold | unsold | paid
  sale_date           date,
  paid_amount         numeric(14,2) not null default 0,
  journal_id          uuid references journal_entries(id) on delete set null,
  version             integer not null default 1,
  created_at          timestamptz not null default now()
);
create unique index if not exists idx_ab_lot on auction_batches(lot_number, auction_date);
create index if not exists idx_ab_broker on auction_batches(broker_name);
create index if not exists idx_ab_date on auction_batches(auction_date desc);
create index if not exists idx_ab_status on auction_batches(status);

-- ============================================================================
-- TRIGGERS + RLS
-- ============================================================================
drop trigger if exists trg_sfl_version on supplier_fertilizer_loans;
create trigger trg_sfl_version before update on supplier_fertilizer_loans
  for each row execute function bump_version();

drop trigger if exists trg_ab_version on auction_batches;
create trigger trg_ab_version before update on auction_batches
  for each row execute function bump_version();

drop trigger if exists trg_otd_version on out_turn_daily;
create trigger trg_otd_version before update on out_turn_daily
  for each row execute function bump_version();

do $$
declare t text;
begin
  for t in select unnest(array['out_turn_daily','supplier_fertilizer_loans','supplier_loan_deductions','auction_batches']) loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "open_write" on %I;', t);
    execute format('create policy "open_write" on %I for all using (true) with check (true);', t);
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- DONE
