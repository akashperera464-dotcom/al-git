-- ============================================================================
-- KDU TEA FACTORY · Phase 1 Round #3 Schema Migration (Sir's spec — Sep 2026)
-- ----------------------------------------------------------------------------
-- This migration adds columns + tables required by the latest round of Phase 1
-- improvements (interconnections + data filling gaps + notification prefs).
--
-- Companion to: supabase_phase1_sir_spec_migration.sql (Round #2)
-- All statements IDEMPOTENT — safe to re-run.
-- SELF-CONTAINED: includes prerequisite table creations so it can run standalone.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Run.
-- ============================================================================

-- ============================================================================
-- 0. PREREQUISITES — ensure base tables exist (in case earlier migrations
--    like migration_farm_activities.sql and migration_announcements.sql
--    were skipped). All use CREATE TABLE IF NOT EXISTS — no-op if exists.
-- ============================================================================

-- 0a. announcements table (referenced by announcement_reads below)
create table if not exists announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  image_url   text,
  category    text not null default 'News',
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table announcements enable row level security;
drop policy if exists "announcements open write" on announcements;
create policy "announcements open write" on announcements for all using (true) with check (true);

-- 0b. farm_activities table (referenced by farm_activity_photos below)
create table if not exists farm_activities (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  activity_type text not null check (activity_type in ('fertilizer','pruning','self_harvest','replanting','fertilizer_application')),
  logged_date   date not null default current_date,
  details       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_farm_activities_user on farm_activities(user_id, activity_type, logged_date desc);
alter table farm_activities enable row level security;
drop policy if exists "farm_activities open write" on farm_activities;
create policy "farm_activities open write" on farm_activities for all using (true) with check (true);

-- 0c. users table — make sure it exists with a basic shape (referenced by most new tables)
-- (users table is created by an earlier migration; this is a safety net for clean installs.)
create table if not exists users (
  id          text primary key,
  email       text unique,
  name        text,
  role        text not null default 'supplier',
  associated_entity_id text,
  created_at  timestamptz not null default now()
);
alter table users enable row level security;
drop policy if exists "users open read" on users;
create policy "users open read" on users for select using (true);

-- 0d. estates table — safety net
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
  created_at      timestamptz not null default now()
);

-- 0e. divisions — safety net
create table if not exists divisions (
  id          uuid primary key default gen_random_uuid(),
  estate_id   uuid not null references estates(id) on delete cascade,
  name        text not null,
  manager     text,
  area_ha     numeric(10,2),
  created_at  timestamptz not null default now()
);

-- 0f. fields — safety net
create table if not exists fields (
  id            uuid primary key default gen_random_uuid(),
  division_id   uuid not null references divisions(id) on delete cascade,
  code          text not null,
  name          text not null,
  cultivar      text,
  planting_year integer,
  area_ha       numeric(10,2),
  elevation_m   integer,
  status        text not null default 'plucking',
  last_yield_kg numeric(12,2) not null default 0,
  bush_count    integer default 0,
  bush_count_verified_at timestamptz,
  created_at    timestamptz not null default now()
);

-- 0g. workers — safety net
create table if not exists workers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  full_name   text,
  nic         text,
  division    text,
  role        text,
  estate_id   uuid references estates(id) on delete set null,
  phone       text,
  basic_salary numeric(12,2) default 0,
  status      text not null default 'active',
  created_at  timestamptz not null default now()
);

-- 0h. stock_items — safety net (Phase 1 supplier_fertilizer_ledger references this)
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
  created_at      timestamptz not null default now()
);

-- 0i. harvest_records — safety net
create table if not exists harvest_records (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     text,
  estate_id       uuid references estates(id) on delete set null,
  gross_kg        numeric(12,2) not null default 0,
  deduction_kg    numeric(12,2) not null default 0,
  net_kg          numeric(12,2) not null default 0,
  grade           text,
  performed_at    timestamptz not null default now(),
  recorded_by     text
);

-- 0j. sales_invoices — safety net
create table if not exists sales_invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_code    text unique,
  supplier_id     text,
  estate_id       uuid references estates(id) on delete set null,
  invoice_date    date not null default current_date,
  total_amount    numeric(14,2) not null default 0,
  status          text not null default 'unpaid',
  created_at      timestamptz not null default now()
);

-- ============================================================================
-- 1. estates — add contact_phone (Sir's spec B.7)
-- ============================================================================
alter table estates add column if not exists contact_phone text;

-- ============================================================================
-- 2. divisions — add area_acres (Sir's spec B.7 — Sri Lankan farmers think in acres)
-- ============================================================================
alter table divisions add column if not exists area_acres numeric(10,2);

-- ============================================================================
-- 3. fields — add soil_type (Sir's spec B.7)
-- ============================================================================
alter table fields add column if not exists soil_type text;
-- Values: 'sandy' | 'loam' | 'clay' | 'sandy-loam' | 'clay-loam' | 'unknown'

-- ============================================================================
-- 4. workers — add daily_wage, photo_url, qr_code (Sir's spec B.8)
-- ============================================================================
alter table workers
  add column if not exists daily_wage numeric(10,2),
  add column if not exists photo_url   text,
  add column if not exists qr_code     text;

-- ============================================================================
-- 5. stock_items — add batch_number, expiry_date, supplier_source (Sir's spec B.9)
-- ============================================================================
alter table stock_items
  add column if not exists batch_number    text,
  add column if not exists expiry_date      date,
  add column if not exists supplier_source  text;

create index if not exists idx_si_batch   on stock_items(batch_number) where batch_number is not null;
create index if not exists idx_si_expiry  on stock_items(expiry_date) where expiry_date is not null;
create index if not exists idx_si_vendor  on stock_items(supplier_source) where supplier_source is not null;

-- ============================================================================
-- 6. harvest_records — add weather_condition, leaf_moisture_pct, photo_url (Sir's spec B.10)
-- ============================================================================
alter table harvest_records
  add column if not exists weather_condition  text,
  -- Values: 'sunny' | 'cloudy' | 'rainy' | 'foggy' | 'unknown'
  add column if not exists leaf_moisture_pct  numeric(5,2),
  add column if not exists photo_url           text;

-- ============================================================================
-- 7. supplier_payments (or sales_invoices) — add payment_method (Sir's spec B.11)
-- ============================================================================
-- If using sales_invoices table for supplier payments, add payment_method column.
-- Values: 'cash' | 'bank_transfer' | 'cheque' | 'deduction' (when deducted from leaf)
alter table sales_invoices
  add column if not exists payment_method  text default 'cash',
  add column if not exists receipt_pdf_url  text;

-- ============================================================================
-- 8. users — add supplier-specific profile fields (Sir's spec B.6)
--    The users table holds both admin + supplier + EO accounts. The new
--    columns below apply to supplier accounts only.
-- ============================================================================
alter table users
  add column if not exists nic               text,    -- National ID (Sri Lankan)
  add column if not exists address           text,
  add column if not exists emergency_contact text,
  add column if not exists photo_url         text,
  -- Notification preferences (JSONB) — Sir's spec C.13
  -- Default: all alerts enabled
  add column if not exists notification_prefs jsonb default '{
    "paymentAlerts": true,
    "requestAlerts": true,
    "announcementAlerts": true,
    "weatherAlerts": true,
    "advisoryAlerts": true
  }'::jsonb;

-- ============================================================================
-- 9. NEW TABLE: announcement_reads (Sir's spec A.3 — mark as read tracking)
-- ----------------------------------------------------------------------------
-- Tracks which suppliers have read which announcements, so they don't see
-- the same announcement again as "NEW".
-- ============================================================================
create table if not exists announcement_reads (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null references users(id) on delete cascade,
  announcement_id uuid not null references announcements(id) on delete cascade,
  read_at         timestamptz not null default now(),
  unique(user_id, announcement_id)
);

create index if not exists idx_ann_reads_user      on announcement_reads(user_id, read_at desc);
create index if not exists idx_ann_reads_announcement on announcement_reads(announcement_id);

alter table announcement_reads enable row level security;

create policy "users_own_reads"
  on announcement_reads for all
  using (auth.uid()::text = user_id);

create policy "admins_all_reads"
  on announcement_reads for select
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()::text
        and u.role in ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- 10. NEW TABLE: notification_queue (Sir's spec — for in-app notification view)
-- ----------------------------------------------------------------------------
-- When admin acts on a supplier (approve request, mark payment, publish
-- announcement), we write a row here. Supplier's "Notifications" tab reads
-- from this table. FCM pushes fire from the announcements / notifications
-- tables (existing). This is for IN-APP visibility of "X kg deducted from
-- inventory when your request was approved".
-- ============================================================================
create table if not exists notification_queue (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references users(id) on delete cascade,
  -- Target user (supplier)
  title         text not null,
  body          text not null,
  -- The notification message
  type          text not null,
  -- 'payment' | 'request_approved' | 'request_rejected' | 'announcement' | 'weather' | 'advisory' | 'system'
  reference_type text,
  -- 'resource_request' | 'announcement' | 'harvest_record' | 'equipment_request'
  reference_id  uuid,
  -- The ID of the related entity
  read_at       timestamptz,
  -- When the user marked as read (null = unread)
  created_at    timestamptz not null default now()
);

create index if not exists idx_nq_user_unread on notification_queue(user_id, created_at desc) where read_at is null;
create index if not exists idx_nq_user_all    on notification_queue(user_id, created_at desc);

alter table notification_queue enable row level security;

create policy "users_own_notifications"
  on notification_queue for select
  using (auth.uid()::text = user_id);

create policy "users_update_own_notifications"
  on notification_queue for update
  using (auth.uid()::text = user_id);

create policy "admins_insert_notifications"
  on notification_queue for insert
  with check (
    exists (
      select 1 from users u
      where u.id = auth.uid()::text
        and u.role in ('admin', 'super_admin', 'extension_officer')
    )
  );

-- ============================================================================
-- 11. NEW TABLE: farm_activity_photos (Sir's spec B.22 — photo upload)
-- ----------------------------------------------------------------------------
-- When suppliers log a farm activity (fertilizer/pruning/replanting), they can
-- attach photos for audit + EO verification.
-- ============================================================================
create table if not exists farm_activity_photos (
  id            uuid primary key default gen_random_uuid(),
  activity_id   uuid not null references farm_activities(id) on delete cascade,
  photo_url     text not null,
  caption       text,
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_fap_activity on farm_activity_photos(activity_id, uploaded_at desc);

alter table farm_activity_photos enable row level security;

-- Suppliers can manage photos for their own activities
create policy "users_own_activity_photos"
  on farm_activity_photos for all
  using (
    exists (
      select 1 from farm_activities fa
      where fa.id = activity_id
        and fa.user_id = auth.uid()::text
    )
  );

create policy "admins_all_activity_photos"
  on farm_activity_photos for select
  using (
    exists (
      select 1 from users u
      where u.id = auth.uid()::text
        and u.role in ('admin', 'super_admin', 'extension_officer')
    )
  );

-- ============================================================================
-- VERIFICATION — Run these queries to confirm
-- ============================================================================
-- After running this migration, verify:
--
-- -- Check new columns on estates/divisions/fields/workers/stock_items/harvest_records/sales_invoices/users:
-- select table_name, column_name from information_schema.columns
-- where (table_name, column_name) in (
--   ('estates', 'contact_phone'),
--   ('divisions', 'area_acres'),
--   ('fields', 'soil_type'),
--   ('workers', 'daily_wage'),
--   ('workers', 'photo_url'),
--   ('workers', 'qr_code'),
--   ('stock_items', 'batch_number'),
--   ('stock_items', 'expiry_date'),
--   ('stock_items', 'supplier_source'),
--   ('harvest_records', 'weather_condition'),
--   ('harvest_records', 'leaf_moisture_pct'),
--   ('harvest_records', 'photo_url'),
--   ('sales_invoices', 'payment_method'),
--   ('users', 'nic'),
--   ('users', 'address'),
--   ('users', 'emergency_contact'),
--   ('users', 'photo_url'),
--   ('users', 'notification_prefs')
-- ) order by table_name, column_name;
--
-- -- Check new tables:
-- select table_name from information_schema.tables
-- where table_name in ('announcement_reads', 'notification_queue', 'farm_activity_photos')
-- order by table_name;
--
-- ============================================================================
-- Done. Phase 1 Round #3 schema is now ready for Phase 2 code.
-- Phase 1 uses localStorage fallback — no migration strictly required.
-- ============================================================================
