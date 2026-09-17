-- ============================================================================
-- KDU TEA FACTORY · Phase 2 Schema Migration (Round #4 — Sep 2026)
-- ----------------------------------------------------------------------------
-- This migration adds tables required by the Phase 2 features:
--   • Estate registration requests (supplier → admin approval workflow)
--   • Estate blocks (supplier's plot divisions)
--   • Farm activity cache sync (localStorage → Supabase)
--
-- Companion to: supabase_phase1_round3_migration.sql (Round #3)
-- SELF-CONTAINED: includes prerequisite table creations.
-- All statements IDEMPOTENT — safe to re-run.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run.
-- ============================================================================

-- ============================================================================
-- 0. PREREQUISITES — ensure base tables exist
-- ============================================================================

create table if not exists users (
  id          text primary key,
  email       text unique,
  name        text,
  role        text not null default 'supplier',
  associated_entity_id text,
  created_at  timestamptz not null default now()
);

create table if not exists estates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  region          text,
  total_area_ha   numeric(10,2),
  elevation_m     integer,
  google_maps_embed_url text,
  planted_date    date,
  latitude        numeric(10,7),
  longitude       numeric(10,7),
  total_bush_count integer,
  total_area_acres numeric(12,2),
  contact_phone   text,
  created_at      timestamptz not null default now()
);

create table if not exists farm_activities (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  activity_type text not null check (activity_type in ('fertilizer','pruning','self_harvest','replanting','fertilizer_application')),
  logged_date   date not null default current_date,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- 1. NEW TABLE: estate_registration_requests
-- ----------------------------------------------------------------------------
-- When a supplier registers their estate, the request is stored here.
-- Admin reviews and approves/rejects. On approval, data is promoted to
-- the supplier_plots table (or estates table for admin-created estates).
-- ============================================================================
create table if not exists estate_registration_requests (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         text not null,
  supplier_name       text not null,
  plot_name           text not null,
  acreage             numeric(10,2) not null default 0,
  bush_count          integer not null default 0,
  cultivar            text,
  region              text,
  soil_type           text default 'unknown',
  latitude            numeric(10,7),
  longitude           numeric(10,7),
  address             text,
  contact_phone       text,
  photo_urls          text[] default '{}',
  land_document_url   text,
  notes               text,
  status              text not null default 'PENDING',
  admin_notes         text,
  submitted_at        timestamptz not null default now(),
  reviewed_at         timestamptz,
  reviewed_by         text,
  edit_count          integer not null default 0,
  last_edited_at      timestamptz
);

create index if not exists idx_err_status     on estate_registration_requests(status, submitted_at desc);
create index if not exists idx_err_supplier   on estate_registration_requests(supplier_id, submitted_at desc);

alter table estate_registration_requests enable row level security;

-- Suppliers can see their own requests
create policy "suppliers_own_requests"
  on estate_registration_requests for select
  using (supplier_id = auth.uid()::text);

create policy "suppliers_insert_own_requests"
  on estate_registration_requests for insert
  with check (supplier_id = auth.uid()::text);

create policy "suppliers_update_own_requests"
  on estate_registration_requests for update
  using (supplier_id = auth.uid()::text);

-- Admins can see all + update status
create policy "admins_all_requests"
  on estate_registration_requests for all
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()::text
        and u.role in ('admin', 'super_admin', 'extension_officer')
    )
  );

-- ============================================================================
-- 2. NEW TABLE: estate_blocks
-- ----------------------------------------------------------------------------
-- Divisions/blocks within a supplier's estate or admin's estate.
-- Same structure whether created by supplier or admin.
-- ============================================================================
create table if not exists estate_blocks (
  id              uuid primary key default gen_random_uuid(),
  estate_id       uuid references estates(id) on delete cascade,
  -- For admin-created estates: links to estates table
  registration_id uuid references estate_registration_requests(id) on delete cascade,
  -- For supplier-registered estates: links to registration request
  name            text not null,
  -- e.g., 'උඩ කොටස' (Upper Block), 'පහළ කොටස' (Lower Block)
  area_ha         numeric(10,2),
  area_acres      numeric(10,2),
  bush_count      integer default 0,
  cultivar        text,
  soil_type       text default 'unknown',
  created_at      timestamptz not null default now()
);

create index if not exists idx_eb_estate       on estate_blocks(estate_id);
create index if not exists idx_eb_registration on estate_blocks(registration_id);

alter table estate_blocks enable row level security;

create policy "users_read_blocks"
  on estate_blocks for select using (true);

create policy "admins_all_blocks"
  on estate_blocks for all
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()::text
        and u.role in ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 3. Extend farm_activities.details to include 'block' field
-- ----------------------------------------------------------------------------
-- The Phase 2 code writes { block: 'Upper Block' } into the details JSONB.
-- No schema change needed — details is already jsonb. But add an index
-- for querying by block.
-- ============================================================================
create index if not exists idx_fa_block
  on farm_activities ((details->>'block'))
  where details ? 'block';

-- ============================================================================
-- 4. NEW TABLE: smart_alert_log
-- ----------------------------------------------------------------------------
-- When the SmartAutomatedAlerts component computes an alert, it writes here.
-- Admin can see which suppliers are getting which alerts — useful for
-- understanding which suppliers need follow-up.
-- ============================================================================
create table if not exists smart_alert_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  alert_type      text not null,
  -- 'fert_cycle' | 'fert_soon' | 'prune_mixture' | 'prune_overdue' | 'replant_care' | 'weather_guard'
  title           text not null,
  body            text not null,
  tone            text default 'amber',
  -- 'amber' | 'sky' | 'emerald' | 'rose'
  computed_at     timestamptz not null default now()
);

create index if not exists idx_sal_user   on smart_alert_log(user_id, computed_at desc);
create index if not exists idx_sal_type   on smart_alert_log(alert_type, computed_at desc);

alter table smart_alert_log enable row level security;

create policy "users_own_alerts"
  on smart_alert_log for select
  using (user_id = auth.uid()::text);

create policy "admins_all_alerts"
  on smart_alert_log for select
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()::text
        and u.role in ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- select table_name from information_schema.tables
-- where table_name in (
--   'estate_registration_requests',
--   'estate_blocks',
--   'smart_alert_log'
-- ) order by table_name;
--
-- ============================================================================
-- Done. Phase 2 schema is ready.
-- ============================================================================
