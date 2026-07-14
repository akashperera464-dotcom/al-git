-- ============================================================================
-- Verda ERP · Vehicle/Fuel + Welfare + Audit/Compliance Migration
-- ----------------------------------------------------------------------------
-- Run in Supabase SQL Editor → New query → Run. Safe to re-run.
-- ============================================================================

-- 1 · FUEL LOGS (extends existing vehicles table)
create table if not exists fuel_logs (
  id              uuid primary key default gen_random_uuid(),
  vehicle_id      uuid references vehicles(id) on delete set null,
  vehicle_reg     text,
  log_date        date not null default current_date,
  litres          numeric(8,2) not null default 0,
  cost_per_litre  numeric(8,2) not null default 0,
  total_cost      numeric(12,2) not null default 0,
  odometer_km     integer,
  fuel_station    text,
  slip_ref        text,
  logged_by       text,
  version         integer not null default 1,
  created_at      timestamptz not null default now()
);
create index if not exists idx_fl_vehicle on fuel_logs(vehicle_id);
create index if not exists idx_fl_date on fuel_logs(log_date desc);

-- Extend vehicles table
alter table vehicles add column if not exists estate_id uuid;
alter table vehicles add column if not exists version integer not null default 1;
alter table vehicles add column if not exists updated_by_uid text;

-- 2 · WELFARE UNITS (housing blocks) — extends existing welfare_cases
create table if not exists welfare_units (
  id              uuid primary key default gen_random_uuid(),
  block_name      text not null,
  unit_type       text not null default 'line_room', -- line_room | family_quarter | dormitory
  families        integer not null default 0,
  occupants       integer not null default 0,
  condition       text not null default 'Good', -- Good | Needs Repair | Priority
  estate_id       uuid,
  last_inspected  date,
  notes           text,
  version         integer not null default 1,
  created_at      timestamptz not null default now()
);
create index if not exists idx_wu_condition on welfare_units(condition);

-- Extend welfare_cases
alter table welfare_cases add column if not exists worker_id     uuid;
alter table welfare_cases add column if not exists estate_id     uuid;
alter table welfare_cases add column if not exists priority      text not null default 'normal'; -- low | normal | high | urgent
alter table welfare_cases add column if not exists assigned_to   text;
alter table welfare_cases add column if not exists resolved_at    timestamptz;
alter table welfare_cases add column if not exists cost          numeric(12,2) not null default 0;
alter table welfare_cases add column if not exists version       integer not null default 1;
alter table welfare_cases add column if not exists updated_by_uid text;
-- Fix: add column without typo
do $$ begin
  alter table welfare_cases add column if not exists resolved_at timestamptz;
exception when duplicate_column then null; end $$;

-- 3 · AUDIT & COMPLIANCE ITEMS
create table if not exists compliance_items (
  id              uuid primary key default gen_random_uuid(),
  standard        text not null,
  status          text not null default 'In Audit', -- Certified | In Audit | Action Needed | Expired
  score           integer not null default 0,
  expiry_date     date,
  cert_body       text,
  last_audited    date,
  next_audit_due  date,
  notes           text,
  version         integer not null default 1,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ci_status on compliance_items(status);

-- Audit log entries (track every compliance event)
create table if not exists audit_log_entries (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null,       -- compliance_item | vehicle | welfare_case | payroll | journal | etc.
  entity_id       text,
  action          text not null,       -- created | updated | deleted | approved | rejected | synced
  performed_by    text,
  performed_at    timestamptz not null default now(),
  details         jsonb,
  ip_address      text
);
create index if not exists idx_ale_entity on audit_log_entries(entity_type, entity_id);
create index if not exists idx_ale_date on audit_log_entries(performed_at desc);

-- 4 · TRIGGERS + RLS
create or replace function bump_version_v3()
returns trigger as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_fuel_logs_version on fuel_logs;
create trigger trg_fuel_logs_version before update on fuel_logs
  for each row execute function bump_version_v3();

drop trigger if exists trg_welfare_units_version on welfare_units;
create trigger trg_welfare_units_version before update on welfare_units
  for each row execute function bump_version_v3();

drop trigger if exists trg_welfare_cases_version on welfare_cases;
create trigger trg_welfare_cases_version before update on welfare_cases
  for each row execute function bump_version_v3();

drop trigger if exists trg_vehicles_version on vehicles;
create trigger trg_vehicles_version before update on vehicles
  for each row execute function bump_version_v3();

drop trigger if exists trg_compliance_items_version on compliance_items;
create trigger trg_compliance_items_version before update on compliance_items
  for each row execute function bump_version_v3();

do $$
declare t text;
begin
  for t in select unnest(array['fuel_logs','welfare_units','compliance_items','audit_log_entries']) loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "open_write" on %I;', t);
    execute format('create policy "open_write" on %I for all using (true) with check (true);', t);
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- 5 · SEED compliance items
insert into compliance_items (standard, status, score, expiry_date, cert_body, last_audited, next_audit_due) values
  ('Rainforest Alliance', 'Certified', 94, current_date + 220, 'Rainforest Alliance', current_date - 145, current_date + 220),
  ('Fairtrade International', 'Certified', 91, current_date + 168, 'FLOCERT', current_date - 197, current_date + 168),
  ('ISO 22000 (Food Safety)', 'In Audit', 86, current_date + 45, 'SGS', current_date - 320, current_date + 45),
  ('Ethical Tea Partnership', 'Action Needed', 72, current_date + 18, 'ETP', current_date - 347, current_date + 18)
on conflict do nothing;

-- DONE
