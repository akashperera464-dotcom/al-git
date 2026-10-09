-- ============================================================================
-- Verda ERP · Phase 3 Round #9 — Supplier Labor Logs Table
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → NEW query → Run. (Safe to re-run.)
--
-- PURPOSE: Persist supplier labor cost data to Supabase so it survives
--   localStorage clearing, phone resets, or app reinstalls.
--
-- Table: supplier_labor_logs
--   Each row = one day's labor cost snapshot for a supplier.
--   Supplier enters: date, lines (category/headcount/wage as JSONB), total.
-- ============================================================================

create table if not exists supplier_labor_logs (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   text not null,
  log_date      date not null,
  lines         jsonb not null default '[]'::jsonb,
  total_cost    numeric(12,2) not null default 0,
  total_headcount integer not null default 0,
  created_at    timestamptz not null default now()
);

-- Index: one snapshot per supplier per date
create unique index if not exists idx_supplier_labor_logs_unique
  on supplier_labor_logs(supplier_id, log_date);

-- Index: monthly aggregation queries
create index if not exists idx_supplier_labor_logs_month
  on supplier_labor_logs(supplier_id, log_date desc);

-- RLS: open write (client RBAC gates access). Phase 2 will lock down.
alter table supplier_labor_logs enable row level security;
drop policy if exists "supplier_labor_logs open write" on supplier_labor_logs;
create policy "supplier_labor_logs open write" on supplier_labor_logs
  for all using (true) with check (true);

-- Enable real-time
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'supplier_labor_logs'
  ) then
    alter publication supabase_realtime add table supplier_labor_logs;
  end if;
exception when others then null;
end $$;

comment on table supplier_labor_logs is
  'Daily labor cost snapshots for suppliers. Each row = one day (headcount × wage per category).';

-- Sanity check
select 'supplier_labor_logs table ready' as status;
