-- ============================================================================
-- KDU ERP · Branding/Settings table — DATABASE persistence
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → New query → Run. (Safe to re-run.)
--
-- Stores app-wide branding (logo, login texts, background, accent) in ONE row
-- so it is shared across ALL devices/browsers/users and survives cache clears.
-- ============================================================================

create table if not exists settings (
  key        text primary key default 'branding',   -- always 'branding' for the white-label config
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- seed the single branding row with defaults (no-op if it exists)
insert into settings (key, data)
values ('branding', '{}'::jsonb)
on conflict (key) do nothing;

-- updated_at trigger
create or replace function set_settings_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists trg_settings_updated on settings;
create trigger trg_settings_updated before update on settings
  for each row execute function set_settings_updated_at();

-- ============================================================================
-- RLS: branding is PUBLIC-readable (so the Login screen can load it before
-- auth). Writes are also open because the app's RBAC (capability "settings.manage"
-- + RouteGuard) already restricts the Settings UI to Super Admin only.
--
-- NOTE: the hybrid auth model authenticates via Firebase, NOT Supabase Auth,
-- so auth.uid() is NULL for logged-in users. A write policy based on
-- is_admin()/caller_uid() would therefore always fail. The client RBAC is the
-- real gate; the RLS write policy is permissive to match.
-- ============================================================================
alter table settings enable row level security;

drop policy if exists "settings public read" on settings;
create policy "settings public read" on settings
  for select using (true);

drop policy if exists "settings admin write" on settings;
drop policy if exists "settings open write" on settings;
create policy "settings open write" on settings
  for all using (true) with check (true);

-- ============================================================================
-- VERIFY after running:
--   select key, data, updated_at from settings;
-- ============================================================================
