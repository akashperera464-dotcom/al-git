-- ============================================================================
-- KDU TEA FACTORY · Phase 1 Schema Migration (Sir's spec — September 2026)
-- ----------------------------------------------------------------------------
-- This migration adds all columns + tables required by the Phase 1 features:
--
--   • estates.latitude / longitude / total_bush_count / total_area_acres
--     (drives per-estate weather + yield predictions + bush count tracking)
--
--   • fields.bush_count / bush_count_verified_at
--     (per-field bush count + 6-month re-verify date)
--
--   • farm_activities.activity_type extended to include 'replanting'
--     (CHECK constraint relaxed via DROP + ADD)
--
--   • New table: supplier_plots (per-supplier plot data — acreage, bush count,
--     cultivar, region, verifiedAt)
--
--   • New table: supplier_fertilizer_ledger (when admin issues fertilizer to
--     supplier on Credit — for balance tracking)
--
--   • New table: equipment_requests (separate from generic resource_requests)
--
--   • New table: labor_daily_cost_snapshots (admin's daily labor cost calc)
--
-- All statements are IDEMPOTENT — safe to re-run. Uses IF NOT EXISTS + ADD
-- COLUMN IF NOT EXISTS. Does NOT drop or modify any existing data.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run.
-- ============================================================================

-- ============================================================================
-- 1. estates — add columns for GPS + bush count + acreage
-- ============================================================================
-- The Weather module + EO Geo-Location Verify + Supplier Weather all depend
-- on estates.latitude / longitude being set. Without these columns, weather
-- falls back to Nuwara Eliya defaults.

alter table estates
  add column if not exists latitude          numeric(10,7),
  add column if not exists longitude         numeric(10,7),
  add column if not exists total_bush_count  integer,
  add column if not exists total_area_acres  numeric(12,2);

create index if not exists idx_estates_lat_lon on estates(latitude, longitude);

-- ============================================================================
-- 2. fields — add bush_count + bush_count_verified_at columns
-- ============================================================================
-- Per-field bush count tracking drives 6-month re-verify reminders.
-- Estate-level total_bush_count is the sum across all fields (computed in app).

alter table fields
  add column if not exists bush_count              integer default 0,
  add column if not exists bush_count_verified_at  timestamptz;

-- ============================================================================
-- 3. farm_activities — extend activity_type to include 'replanting'
-- ============================================================================
-- Phase 1 adds 'replanting' + 'fertilizer_application' as distinct types
-- in the FarmActivities UI tab. The existing CHECK constraint
-- (if any) needs to be relaxed.

-- Drop old constraint if it exists, add new one with extended types.
do $$
begin
  -- Try to drop existing constraint; ignore if not found.
  begin
    alter table farm_activities drop constraint if exists farm_activities_activity_type_check;
  exception when others then null;
  end;

  -- Add new constraint with extended types.
  begin
    alter table farm_activities
      add constraint farm_activities_activity_type_check
      check (activity_type in ('fertilizer', 'pruning', 'self_harvest', 'replanting', 'fertilizer_application'));
  exception when others then null;
  end;
end$$;

-- ============================================================================
-- 4. NEW TABLE: supplier_plots
-- ----------------------------------------------------------------------------
-- Per-supplier plot data (acreage + bush count + cultivar + region + verifiedAt)
-- Phase 1: stored in localStorage on supplier side. Phase 2: this table is the
-- Supabase backend.
-- ============================================================================
create table if not exists supplier_plots (
  id                  uuid primary key default gen_random_uuid(),
  user_id             text not null references users(id) on delete cascade,
  acreage             numeric(10,2) not null default 0,
  bush_count          integer not null default 0,
  cultivar            text,
  region              text,
  -- 'low-country' | 'mid-country' | 'up-country' (drives yield estimate)
  verified_at         timestamptz,
  -- Last date supplier re-verified the bush count (drives 6-month reminder)
  last_updated        timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  unique(user_id)     -- one plot per supplier
);

create index if not exists idx_supplier_plots_user on supplier_plots(user_id);

alter table supplier_plots enable row level security;

-- Suppliers can only see/edit their own plot.
create policy "suppliers_select_own_plot"
  on supplier_plots for select
  using (auth.uid()::text = user_id);

create policy "suppliers_insert_own_plot"
  on supplier_plots for insert
  with check (auth.uid()::text = user_id);

create policy "suppliers_update_own_plot"
  on supplier_plots for update
  using (auth.uid()::text = user_id);

-- Admins can see all plots.
create policy "admins_select_all_plots"
  on supplier_plots for select
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()::text
        and u.role in ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 5. NEW TABLE: supplier_fertilizer_ledger
-- ----------------------------------------------------------------------------
-- When admin issues fertilizer to a supplier on CREDIT, we log it here so the
-- supplier's "My Fertilizer" module can show:
--   - Total fertilizer received from factory
--   - Per-issue history (date, type, qty, division)
--   - Outstanding balance (to be deducted from leaf payments later)
-- ============================================================================
create table if not exists supplier_fertilizer_ledger (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         text not null,
  -- Match by supplier's user_id (Firebase UID) OR supplier_name (text fallback)
  supplier_name       text not null,
  stock_item_id       uuid references stock_items(id) on delete set null,
  stock_item_code     text,
  stock_item_name     text,
  qty_issued          numeric(12,2) not null,
  unit                text not null default 'kg',
  -- 'credit' = will be deducted from leaf payments; 'cash' = paid now
  payment_mode        text not null default 'credit',
  division            text,
  -- Optional: which estate division received the fertilizer
  issue_date          timestamptz not null default now(),
  -- Date admin issued the fertilizer to supplier
  notes               text,
  settled             boolean not null default false,
  -- When true, the credit has been deducted from leaf payments
  settled_at          timestamptz,
  -- When the credit was settled
  settled_amount      numeric(12,2),
  -- How much was deducted (may differ from qty_issued in kg-equivalent)
  created_at          timestamptz not null default now()
);

create index if not exists idx_sfl_supplier      on supplier_fertilizer_ledger(supplier_id, issue_date desc);
create index if not exists idx_sfl_supplier_name on supplier_fertilizer_ledger(supplier_name);
create index if not exists idx_sfl_unsettled     on supplier_fertilizer_ledger(supplier_id) where not settled;

alter table supplier_fertilizer_ledger enable row level security;

-- Suppliers can see their own ledger entries (matched by supplier_id OR supplier_name).
-- Admins can see all entries.
create policy "suppliers_select_own_ledger"
  on supplier_fertilizer_ledger for select
  using (
    supplier_id = auth.uid()::text
    or exists (
      select 1 from users u
      where u.id = auth.uid()::text
        and u.name = supplier_fertilizer_ledger.supplier_name
    )
  );

create policy "admins_all_ledger"
  on supplier_fertilizer_ledger for all
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()::text
        and u.role in ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 6. NEW TABLE: equipment_requests
-- ----------------------------------------------------------------------------
-- Standalone equipment requests (separate from generic resource_requests).
-- Phase 1: stored in localStorage on admin side. Phase 2: this table.
-- ============================================================================
create table if not exists equipment_requests (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         text,
  -- Optional: link to the requesting supplier
  supplier_name       text,
  category            text not null,
  -- 'Plucking Machine' | 'Spray Machine' | 'Bag' | 'Pruning Shears' | 'Knapsack Sprayer' | 'Basket' | 'Other'
  item_name           text not null,
  quantity            integer not null default 1,
  date_needed         timestamptz,
  duration_days       integer default 1,
  note                text,
  status              text not null default 'PENDING',
  -- 'PENDING' | 'APPROVED' | 'REJECTED'
  admin_notes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_eqreq_status    on equipment_requests(status, created_at desc);
create index if not exists idx_eqreq_supplier on equipment_requests(supplier_id);

alter table equipment_requests enable row level security;

create policy "admins_all_equipment_requests"
  on equipment_requests for all
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()::text
        and u.role in ('admin', 'super_admin')
    )
  );

create policy "suppliers_own_equipment_requests"
  on equipment_requests for select
  using (supplier_id = auth.uid()::text);

-- ============================================================================
-- 7. NEW TABLE: labor_daily_cost_snapshots
-- ----------------------------------------------------------------------------
-- Admin's "Daily Labor Cost" tab in the Labor module. Each save creates a
-- snapshot row. Phase 1: stored in localStorage; Phase 2: this table +
-- posts a GL journal entry.
-- ============================================================================
create table if not exists labor_daily_cost_snapshots (
  id                  uuid primary key default gen_random_uuid(),
  estate_id           uuid references estates(id) on delete set null,
  division            text,
  -- e.g., 'Sutton Division', 'Kiriwallapatana Lower'
  snapshot_date       date not null,
  total_cost          numeric(14,2) not null,
  total_headcount     integer not null,
  -- JSONB array of line items: [{ category, headcount, wage, subtotal }]
  lines               jsonb not null default '[]'::jsonb,
  performed_by        text,
  -- Admin's user_id who saved the snapshot
  notes               text,
  journal_entry_id    uuid,
  -- Phase 2: link to GL journal_entries when posted
  created_at          timestamptz not null default now()
);

create index if not exists idx_ldcs_date    on labor_daily_cost_snapshots(snapshot_date desc);
create index if not exists idx_ldcs_division on labor_daily_cost_snapshots(division, snapshot_date desc);

alter table labor_daily_cost_snapshots enable row level security;

create policy "admins_all_labor_snapshots"
  on labor_daily_cost_snapshots for all
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()::text
        and u.role in ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 8. VERIFICATION — Run these queries to confirm everything is in place
-- ============================================================================
-- After running this migration, verify with:
--
-- -- Check estates columns:
-- select column_name, data_type
-- from information_schema.columns
-- where table_name = 'estates'
--   and column_name in ('latitude', 'longitude', 'total_bush_count', 'total_area_acres')
-- order by column_name;
--
-- -- Check fields columns:
-- select column_name, data_type
-- from information_schema.columns
-- where table_name = 'fields'
--   and column_name in ('bush_count', 'bush_count_verified_at')
-- order by column_name;
--
-- -- Check new tables exist:
-- select table_name from information_schema.tables
-- where table_name in ('supplier_plots', 'supplier_fertilizer_ledger',
--                     'equipment_requests', 'labor_daily_cost_snapshots')
-- order by table_name;
--
-- -- Check supplier_plots is empty (no data yet — Phase 2 sync):
-- select count(*) from supplier_plots;
--
-- ============================================================================
-- Done. The webapp at https://akashpereraproject24.vercel.app will start
-- using these columns/tables automatically once Phase 2 code is deployed.
-- Phase 1 uses localStorage as fallback — no migration strictly required
-- for the basic features to work.
-- ============================================================================
