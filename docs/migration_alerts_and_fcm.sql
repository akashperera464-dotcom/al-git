-- ============================================================================
-- KDU ERP · Alerts Table + FCM Push Token Storage
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → NEW query → Run. (Safe to re-run.)
-- ============================================================================

-- 1) ALERTS TABLE (real-time notification feed)
create table if not exists alerts (
  id             uuid primary key default gen_random_uuid(),
  target_user_id text not null references users(id) on delete cascade,
  title          text not null,
  body           text not null,
  alert_type     text not null default 'general',
  read           boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists idx_alerts_user on alerts(target_user_id, created_at desc);

-- RLS + Real-time
alter table alerts enable row level security;
drop policy if exists "alerts open write" on alerts;
-- Prerequisite: migration_security_helpers.sql.
drop policy if exists alerts_scoped on alerts;
create policy alerts_scoped on alerts for all to authenticated
  using (public.app_is_admin() or (public.app_role() is not null and target_user_id = public.app_uid()))
  with check (public.app_is_admin() or (public.app_role() is not null and target_user_id = public.app_uid()));

do $$ begin
  alter publication supabase_realtime add table alerts;
exception when duplicate_object then null;
end $$;

-- 2) PUSH TOKEN COLUMN on users (stores the FCM device token)
alter table users add column if not exists push_token text;

-- Verify
select 'alerts table ready' as status;
