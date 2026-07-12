-- ============================================================================
-- KDU ERP · Map Strategy & Location Verification — Schema migration
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → New query → Run. (Safe to re-run.)
--
-- 1. estates.google_maps_embed_url  — interactive Google Maps iFrame link.
-- 2. supplier_locations             — live GPS check-ins by suppliers.
-- ============================================================================

-- 1) Add the Google Maps embed URL column to estates.
alter table estates add column if not exists google_maps_embed_url text;

-- 2) supplier_locations table.
create table if not exists supplier_locations (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references users(id) on delete cascade,   -- == Firebase uid (text PK)
  latitude    numeric(9,6) not null,
  longitude   numeric(9,6) not null,
  delivery_id uuid references harvest_records(id) on delete set null, -- optional link to a delivery
  created_at  timestamptz not null default now()
);
create index if not exists idx_supplier_locations_user on supplier_locations(user_id, created_at desc);

-- 3) Row-Level Security for supplier_locations.
alter table supplier_locations enable row level security;

create or replace function is_admin() returns boolean as $$
  select exists(select 1 from users where id = caller_uid() and role in ('admin','super_admin'));
$$ language sql stable;

-- A supplier inserts/reads ONLY their own check-ins; admins read all.
drop policy if exists "supplier_loc read own or admin" on supplier_locations;
create policy "supplier_loc read own or admin" on supplier_locations
  for select using (user_id = caller_uid() or is_admin());

drop policy if exists "supplier_loc insert own" on supplier_locations;
create policy "supplier_loc insert own" on supplier_locations
  for insert with check (user_id = caller_uid());

-- 4) Helper: latest check-in per user (for the admin directory view).
create or replace view supplier_latest_locations as
  select distinct on (user_id)
         user_id, latitude, longitude, created_at
  from supplier_locations
  order by user_id, created_at desc;

-- ============================================================================
-- HOW TO GET A GOOGLE MAPS EMBED URL
-- ----------------------------------------------------------------------------
-- 1. Open https://www.google.com/maps and search the estate location.
-- 2. Click "Share" → "Embed a map".
-- 3. Copy the full src="..." URL from the iFrame (it looks like):
--      https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d...
-- 4. Paste that URL into the Estate's "Google Maps Embed URL" field.
-- The web app renders it in an <iframe>; the Expo app renders it in a WebView.
-- ============================================================================
