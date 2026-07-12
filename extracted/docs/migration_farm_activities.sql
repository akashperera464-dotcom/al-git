-- ============================================================================
-- KDU ERP · Farm Activities + Extension Officer — Schema migration
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → NEW query → Run. (Safe to re-run.)
-- ============================================================================

-- 1) Add the extension_officer role value (run ALONE first if enum doesn't have it).
alter type user_role add value if not exists 'extension_officer';

-- 2) Migrate any existing 'supervisor' rows to 'extension_officer'.
update users set role = 'extension_officer' where role = 'supervisor';

-- 3) farm_activities table — closes the advisory loop.
create table if not exists farm_activities (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null references users(id) on delete cascade,  -- == Firebase uid
  activity_type text not null check (activity_type in ('fertilizer','pruning','self_harvest')),
  logged_date   date not null default current_date,
  details       jsonb not null default '{}'::jsonb,                    -- dynamic payload
  created_at    timestamptz not null default now()
);
create index if not exists idx_farm_activities_user on farm_activities(user_id, activity_type, logged_date desc);

-- RLS: open write (client RBAC gates access); suppliers read their own.
alter table farm_activities enable row level security;
drop policy if exists "farm_activities open write" on farm_activities;
create policy "farm_activities open write" on farm_activities for all using (true) with check (true);

-- ============================================================================
-- HOW details (JSONB) is shaped per activity_type
-- ----------------------------------------------------------------------------
--   fertilizer:   { "type": "Urea (46% N)", "quantityKg": 50 }
--   pruning:      { "type": "deep", "areaHa": 2.5 }
--   self_harvest: { "field": "S-01", "estimatedKg": 120, "grade": "Super" }
-- ============================================================================
