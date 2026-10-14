-- Estate Pulse · Phase 3 Round 15 · Connected Operations
-- Supabase FREE plan compatible.
--
-- IMPORTANT ARCHITECTURE NOTE
-- Firebase remains the only authentication provider and this project uses the
-- Supabase anon client.  This migration deliberately does NOT enable RLS, does
-- NOT call auth.uid()/app_uid(), and does NOT require Third-Party Auth.
-- Apply in Supabase SQL Editor after taking a backup.

create extension if not exists pgcrypto;

do $$ begin
  if exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='request_type') then
    alter type public.request_type add value if not exists 'Fertilizer';
    alter type public.request_type add value if not exists 'Agrochemical';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Persistent supplier resource requests
-- ---------------------------------------------------------------------------
alter table if exists public.resource_requests
  add column if not exists supplier_name text,
  add column if not exists fulfillment_status text not null default 'pending',
  add column if not exists stock_item_id uuid,
  add column if not exists on_credit boolean not null default false,
  add column if not exists fulfilled_by text,
  add column if not exists fulfilled_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.resource_requests r set supplier_name=u.name
from public.users u where r.supplier_id=u.id and coalesce(r.supplier_name,'')='';

do $$ begin
  if not exists(select 1 from pg_constraint where conname='resource_requests_stock_item_id_fkey') then
    alter table public.resource_requests add constraint resource_requests_stock_item_id_fkey foreign key(stock_item_id) references public.stock_items(id) on delete set null;
  end if;
exception when undefined_table then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Delivery traceability, evidence and non-destructive corrections
-- ---------------------------------------------------------------------------
alter table if exists public.harvest_records
  add column if not exists collector_id text,
  add column if not exists lorry_plate text,
  add column if not exists delivery_receipt_no text,
  add column if not exists evidence_url text,
  add column if not exists signature_data text,
  add column if not exists record_status text not null default 'valid',
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by text,
  add column if not exists void_reason text,
  add column if not exists replacement_record_id uuid;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='harvest_records_collector_id_fkey') then
    alter table public.harvest_records add constraint harvest_records_collector_id_fkey foreign key(collector_id) references public.users(id) on delete set null;
  end if;
exception when others then null; end $$;

create unique index if not exists harvest_delivery_receipt_unique
  on public.harvest_records(delivery_receipt_no)
  where delivery_receipt_no is not null;
create index if not exists harvest_collector_day_idx
  on public.harvest_records(collector_id, weighed_at);

create sequence if not exists public.delivery_receipt_seq;
create or replace function public.assign_delivery_receipt_no()
returns trigger language plpgsql as $$
begin
  if new.delivery_receipt_no is null then
    new.delivery_receipt_no := 'EP-' || to_char(coalesce(new.weighed_at::date,current_date),'YYYYMMDD')
      || '-' || lpad(nextval('public.delivery_receipt_seq')::text,6,'0');
  end if;
  return new;
end $$;
drop trigger if exists trg_delivery_receipt_no on public.harvest_records;
create trigger trg_delivery_receipt_no before insert on public.harvest_records
for each row execute function public.assign_delivery_receipt_no();

-- ---------------------------------------------------------------------------
-- 3. One workflow table for disputes, help, profile and emergency route change
-- ---------------------------------------------------------------------------
create table if not exists public.operational_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('weight_dispute','support','profile_change','route_change')),
  requested_by text not null,
  related_entity_type text,
  related_entity_id text,
  subject text not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected','resolved','cancelled')),
  resolution text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists operational_requests_owner_idx on public.operational_requests(requested_by,created_at desc);
create index if not exists operational_requests_pending_idx on public.operational_requests(status,request_type,created_at);

-- ---------------------------------------------------------------------------
-- 4. Daily ordered route stops
-- ---------------------------------------------------------------------------
create table if not exists public.collection_route_stops (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.collector_route_assignments(id) on delete cascade,
  stop_order integer not null,
  supplier_id text not null references public.users(id) on delete cascade,
  estate_id uuid references public.estates(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','arrived','completed','missed')),
  arrived_at timestamptz,
  completed_at timestamptz,
  missed_reason text,
  created_at timestamptz not null default now(),
  unique(assignment_id,supplier_id,estate_id)
);
create index if not exists collection_stops_assignment_idx on public.collection_route_stops(assignment_id,stop_order);
create unique index if not exists collection_stops_exact_unique
  on public.collection_route_stops(assignment_id,supplier_id,coalesce(estate_id,'00000000-0000-0000-0000-000000000000'::uuid));

-- ---------------------------------------------------------------------------
-- 5. Month-end lock/reopen workflow
-- ---------------------------------------------------------------------------
create table if not exists public.month_end_closures (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid references public.factories(id) on delete cascade,
  period_month date not null,
  status text not null default 'open' check (status in ('open','locked','reopened')),
  locked_by text,
  locked_at timestamptz,
  reopened_by text,
  reopened_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  unique(factory_id,period_month)
);
create unique index if not exists month_end_global_unique on public.month_end_closures(period_month) where factory_id is null;

create or replace function public.guard_locked_harvest_month()
returns trigger language plpgsql as $$
declare
  v_row public.harvest_records%rowtype;
  v_month date;
begin
  if tg_op='DELETE' then v_row:=old; else v_row:=new; end if;
  v_month:=date_trunc('month',coalesce(v_row.weighed_at::date,current_date))::date;
  if exists(select 1 from public.month_end_closures c where c.period_month=v_month and c.status='locked' and (c.factory_id is null or c.factory_id=v_row.factory_id)) then
    raise exception 'Month % is locked. Super Admin must reopen it before delivery changes.',to_char(v_month,'YYYY-MM');
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists trg_guard_locked_harvest_month on public.harvest_records;
create trigger trg_guard_locked_harvest_month before insert or update or delete on public.harvest_records
for each row execute function public.guard_locked_harvest_month();

-- ---------------------------------------------------------------------------
-- 6. Cross-device profile/preferences and device-session visibility
-- ---------------------------------------------------------------------------
create table if not exists public.supplier_profiles (
  supplier_id text primary key,
  name text,
  phone text,
  nic text,
  address text,
  emergency_contact text,
  photo_url text,
  notification_preferences jsonb not null default '{"paymentAlerts":true,"requestAlerts":true,"announcementAlerts":true,"weatherAlerts":true,"advisoryAlerts":true}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  device_id text not null,
  device_name text,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by text,
  created_at timestamptz not null default now(),
  unique(user_id,device_id)
);
create index if not exists user_sessions_active_idx on public.user_device_sessions(user_id,last_seen_at desc);

-- ---------------------------------------------------------------------------
-- 7. Free-plan operational health ledger: errors, sync, notification, backup
-- ---------------------------------------------------------------------------
create table if not exists public.system_health_events (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('client_error','sync_failure','notification_failure','backup','restore','deployment')),
  severity text not null default 'info' check (severity in ('info','warning','error','critical')),
  user_id text,
  module text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now()
);
create index if not exists health_events_open_idx on public.system_health_events(category,resolved_at,created_at desc);

-- ---------------------------------------------------------------------------
-- 8. Exact database audit differences for the Round 15 workflow tables.
--
-- IMPORTANT: do not DROP/recreate triggers on the older, high-traffic tables
-- here. Doing that while the live app is reading collector assignments and
-- harvest records can create a cross-table AccessExclusiveLock deadlock. The
-- older modules retain their existing application audit writes; these new
-- workflow tables receive old/new row snapshots below.
-- ---------------------------------------------------------------------------
create or replace function public.audit_row_difference()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_id text;
  v_actor text;
begin
  v_id := coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id','unknown');
  v_actor := coalesce(to_jsonb(new)->>'changed_by',to_jsonb(new)->>'updated_by',to_jsonb(new)->>'reviewed_by','database');
  insert into public.admin_audit_log(admin_id,action,entity_type,entity_id,details)
  values(v_actor,lower(tg_op),tg_table_name,v_id,jsonb_build_object('old',case when tg_op='INSERT' then null else to_jsonb(old) end,'new',case when tg_op='DELETE' then null else to_jsonb(new) end));
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['operational_requests','collection_route_stops','month_end_closures','supplier_profiles','user_device_sessions'] loop
    if to_regclass('public.'||t) is not null
       and not exists (
         select 1 from pg_trigger g
         where g.tgrelid=to_regclass('public.'||t)
           and g.tgname='trg_audit_difference'
           and not g.tgisinternal
       ) then
      execute format('create trigger trg_audit_difference after insert or update or delete on public.%I for each row execute function public.audit_row_difference()',t);
    end if;
  end loop;
end $$;

-- Current approved Free-plan architecture: anon REST + client-side RBAC.
-- Keep the new tables consistent with it. A future server gateway can revoke
-- these grants without changing the data model.
alter table public.operational_requests disable row level security;
alter table public.collection_route_stops disable row level security;
alter table public.month_end_closures disable row level security;
alter table public.supplier_profiles disable row level security;
alter table public.user_device_sessions disable row level security;
alter table public.system_health_events disable row level security;
alter table public.resource_requests disable row level security;
alter table public.harvest_records disable row level security;
alter table if exists public.supplier_fertilizer_ledger disable row level security;
alter table public.schema_migrations disable row level security;
grant select,insert,update,delete on public.operational_requests to anon,authenticated;
grant select,insert,update,delete on public.collection_route_stops to anon,authenticated;
grant select,insert,update,delete on public.month_end_closures to anon,authenticated;
grant select,insert,update,delete on public.supplier_profiles to anon,authenticated;
grant select,insert,update,delete on public.user_device_sessions to anon,authenticated;
grant select,insert,update,delete on public.system_health_events to anon,authenticated;
grant select,insert,update on public.resource_requests to anon,authenticated;
grant select,insert,update on public.harvest_records to anon,authenticated;
grant select,insert,update on public.supplier_fertilizer_ledger to anon,authenticated;
grant select on public.schema_migrations to anon,authenticated;
grant usage,select on sequence public.delivery_receipt_seq to anon,authenticated;

-- Optional camera evidence bucket (available on the Free plan). Files are
-- referenced by URL; image bytes are never stored in PostgreSQL rows.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('delivery-evidence','delivery-evidence',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists delivery_evidence_read on storage.objects;
drop policy if exists delivery_evidence_insert on storage.objects;
create policy delivery_evidence_read on storage.objects for select to anon,authenticated using(bucket_id='delivery-evidence');
create policy delivery_evidence_insert on storage.objects for insert to anon,authenticated with check(bucket_id='delivery-evidence');

insert into public.schema_migrations(version,filename,applied_at,applied_by)
values('round_15','migration_phase3_round15_connected_operations.sql',now(),'manual-free-plan')
on conflict(version) do update set filename=excluded.filename;

-- Verification
select to_regclass('public.operational_requests') as workflows,
       to_regclass('public.collection_route_stops') as route_stops,
       to_regclass('public.supplier_profiles') as supplier_profiles,
       to_regclass('public.system_health_events') as health_events;
