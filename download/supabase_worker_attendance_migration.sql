-- ============================================================================
-- Verda ERP · Worker Master + Attendance Migration
-- ----------------------------------------------------------------------------
-- Run in Supabase SQL Editor → New query → Run.
-- Safe to re-run (idempotent).
--
-- What this adds:
--   1. daily_attendance table — per-day present/absent/half-day/half-day + check-in/out times
--   2. worker_transfers table — track transfer history (hire → transfer → retire)
--   3. Extends workers table with lifecycle fields (already has status, hire_date, termination_date)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1 · DAILY ATTENDANCE — one row per worker per day
-- ----------------------------------------------------------------------------
create table if not exists daily_attendance (
  id              uuid primary key default gen_random_uuid(),
  worker_id       uuid not null references workers(id) on delete cascade,
  worker_name     text,
  estate_id       uuid references estates(id) on delete set null,
  division        text,
  attendance_date date not null default current_date,
  status          text not null default 'absent',  -- present | absent | half_day | leave | holiday
  check_in_time   timestamptz,
  check_out_time  timestamptz,
  kg_plucked      numeric(8,2) not null default 0,  -- for pluckers
  overtime_hours  numeric(4,1) not null default 0,
  notes           text,
  marked_by       text,
  version         integer not null default 1,
  created_at      timestamptz not null default now(),
  unique(worker_id, attendance_date)
);
create index if not exists idx_att_worker on daily_attendance(worker_id);
create index if not exists idx_att_date   on daily_attendance(attendance_date desc);
create index if not exists idx_att_status on daily_attendance(status);
create index if not exists idx_att_division on daily_attendance(division);

-- ----------------------------------------------------------------------------
-- 2 · WORKER TRANSFERS — lifecycle history
-- ----------------------------------------------------------------------------
create table if not exists worker_transfers (
  id              uuid primary key default gen_random_uuid(),
  worker_id       uuid not null references workers(id) on delete cascade,
  worker_name     text,
  transfer_type   text not null,              -- hire | transfer | promote | suspend | reinstate | retire | terminate
  from_division   text,
  to_division     text,
  from_role       text,
  to_role         text,
  effective_date  date not null default current_date,
  reason          text,
  authorized_by   text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_wt_worker on worker_transfers(worker_id);
create index if not exists idx_wt_date   on worker_transfers(effective_date desc);

-- ----------------------------------------------------------------------------
-- 3 · Ensure workers table has lifecycle columns (idempotent)
-- ----------------------------------------------------------------------------
alter table workers add column if not exists hire_date        date;
alter table workers add column if not exists termination_date date;
alter table workers add column if not exists status           text not null default 'active';
-- status values: active | suspended | terminated | retired
alter table workers add column if not exists version          integer not null default 1;
alter table workers add column if not exists updated_by_uid   text;
-- (epf_number, etf_number, bank_name, bank_branch, basic_salary, skill_matrix,
--  leave_balance, full_name, date_of_birth, gender, address, emergency_contact
--  already added by the earlier migration_fix3.sql — re-added here for safety)
alter table workers add column if not exists full_name        text;
alter table workers add column if not exists date_of_birth    date;
alter table workers add column if not exists gender           text;
alter table workers add column if not exists address          text;
alter table workers add column if not exists emergency_contact text;
alter table workers add column if not exists epf_number       text;
alter table workers add column if not exists etf_number       text;
alter table workers add column if not exists bank_name        text;
alter table workers add column if not exists bank_branch      text;
alter table workers add column if not exists basic_salary     numeric(12,2) not null default 0;
alter table workers add column if not exists skill_matrix     jsonb not null default '{}';
alter table workers add column if not exists leave_balance    jsonb not null default '{"annual":14,"sick":7,"casual":3}';

-- ----------------------------------------------------------------------------
-- 4 · VERSION-BUMP TRIGGERS
-- ----------------------------------------------------------------------------
drop trigger if exists trg_daily_attendance_version on daily_attendance;
create trigger trg_daily_attendance_version before update on daily_attendance
  for each row execute function bump_version();

drop trigger if exists trg_worker_transfers_version on worker_transfers;
create trigger trg_worker_transfers_version before update on worker_transfers
  for each row execute function bump_version();

-- ----------------------------------------------------------------------------
-- 5 · RLS + REAL-TIME
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array['daily_attendance','worker_transfers']) loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "open_write" on %I;', t);
    execute format('create policy "open_write" on %I for all using (true) with check (true);', t);
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- DONE — verify with:
--   select count(*) from daily_attendance;     → 0
--   select count(*) from worker_transfers;     → 0
--   select column_name from information_schema.columns
--     where table_name = 'workers' and column_name in ('hire_date','termination_date','status','basic_salary','epf_number')
--     order by column_name;  → should return 5 rows
-- ----------------------------------------------------------------------------
