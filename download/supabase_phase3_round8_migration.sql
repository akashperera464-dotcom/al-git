-- ============================================================================
-- Verda ERP · Phase 3 Round #8 — Unified Estate Registration Migration
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → NEW query → Run. (Safe to re-run.)
--
-- PURPOSE: Unifies estate creation so both suppliers AND admin write to the
--   same Supabase tables. Supplier registrations are no longer localStorage-only.
--
-- Changes:
--   1. NEW TABLE: estate_registration_requests (Supabase version of localStorage)
--   2. Add columns to fields: created_by, supplier_id, latitude, longitude,
--      address, contact_phone, photo_urls, land_document_url, supplier_notes
--   3. Add columns to estates: created_by, supplier_id
--
-- After this migration:
--   - Supplier registrations write to Supabase (real-time sync)
--   - Admin sees pending registrations in Estate Master (unified view)
--   - On approval, real estate/division/field records are created
--   - Both sides see the same data
-- ============================================================================

-- 1) NEW TABLE: estate_registration_requests
create table if not exists estate_registration_requests (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     text not null,
  supplier_name   text not null,
  plot_name       text not null,
  acreage         numeric(12,2) not null default 0,
  bush_count      integer not null default 0,
  cultivar        text,
  region          text,
  soil_type       text,
  latitude        numeric(10,6),
  longitude       numeric(10,6),
  address         text,
  contact_phone   text,
  blocks          jsonb,
  photo_urls      jsonb,
  land_document_url text,
  notes           text,
  status          text not null default 'PENDING',
  admin_notes     text,
  submitted_at    timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     text,
  edit_count      integer not null default 0,
  last_edited_at  timestamptz
);

create index if not exists idx_err_supplier on estate_registration_requests(supplier_id, submitted_at desc);
create index if not exists idx_err_status on estate_registration_requests(status);

alter table estate_registration_requests enable row level security;
drop policy if exists "err open write" on estate_registration_requests;
create policy "err open write" on estate_registration_requests for all using (true) with check (true);

-- 2) Add columns to fields table
alter table fields
  add column if not exists created_by text default 'admin',
  add column if not exists supplier_id text,
  add column if not exists latitude numeric(10,6),
  add column if not exists longitude numeric(10,6),
  add column if not exists address text,
  add column if not exists contact_phone text,
  add column if not exists photo_urls jsonb,
  add column if not exists land_document_url text,
  add column if not exists supplier_notes text;

create index if not exists idx_fields_supplier on fields(supplier_id) where supplier_id is not null;
create index if not exists idx_fields_created_by on fields(created_by);

-- 3) Add columns to estates table
alter table estates
  add column if not exists created_by text default 'admin',
  add column if not exists supplier_id text;

-- 4) Comments
comment on table estate_registration_requests is
  'Supplier estate registration requests. When admin approves, records are created in estates/divisions/fields tables. Replaces the localStorage-based system.';
comment on column fields.created_by is
  '''admin'' = created by admin in Estate Master. ''supplier'' = created from an approved supplier registration.';
comment on column fields.supplier_id is
  'Firebase UID of the supplier who owns this field. NULL for admin-created fields.';

-- 5) Sanity check
select 'estate_registration_requests table ready' as status;
select column_name from information_schema.columns where table_name = 'fields' and column_name in ('created_by', 'supplier_id', 'latitude', 'longitude') order by column_name;
