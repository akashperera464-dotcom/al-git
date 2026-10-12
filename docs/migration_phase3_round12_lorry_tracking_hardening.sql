-- Phase 3 / Round 12: production hardening for live lorry tracking
-- Run this entire file in Supabase SQL Editor. Safe to re-run.

alter table if exists public.lorry_locations
  add column if not exists active boolean not null default true;

alter table if exists public.lorry_locations
  add column if not exists stopped_at timestamptz;

create index if not exists lorry_locations_updated_at_idx
  on public.lorry_locations(updated_at desc);

create unique index if not exists daily_tea_prices_factory_unique
  on public.daily_tea_prices(factory_id, price_date, grade)
  where factory_id is not null;

comment on column public.lorry_locations.active is
  'True while a collector is actively sharing GPS for the route; false after an explicit stop or route change.';

comment on column public.lorry_locations.stopped_at is
  'Time the collector explicitly stopped sharing this route location.';

select 'Round 12 lorry tracking hardening applied' as status;
