-- Verda ERP · Phase 3 Round 12 · Production Hardening
-- Run once in Supabase SQL Editor. Safe to re-run.
-- Firebase Third-Party Auth keeps Firebase UID in JWT `sub`. Firebase UIDs are
-- strings (not PostgreSQL UUIDs), therefore policies use app_uid() rather than
-- auth.uid()::text, which would cast a Firebase UID to uuid and fail.
create extension if not exists pgcrypto;

-- 0. Schema versioning is installed first.
create table if not exists public.schema_migrations (
  version text primary key,
  filename text not null,
  applied_at timestamptz not null default now(),
  applied_by text
);

create or replace function public.app_uid() returns text language sql stable as $$
  select nullif(auth.jwt()->>'sub', '')
$$;
create or replace function public.app_role() returns text language sql stable security definer set search_path=public as $$
  select coalesce((select role::text from public.users where id=public.app_uid() and deactivated_at is null limit 1), '')
$$;
revoke all on function public.app_role() from public;
grant execute on function public.app_role() to anon, authenticated;
create or replace function public.has_recent_registration_permit(p_email text) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.admin_audit_log a
    where a.action='registration_attempt'
      and a.created_at >= now()-interval '10 minutes'
      and a.details->>'email_hash'=encode(
        extensions.digest(convert_to(lower(trim(p_email)), 'UTF8'), 'sha256'::text),
        'hex'
      )
  )
$$;
revoke all on function public.has_recent_registration_permit(text) from public;
grant execute on function public.has_recent_registration_permit(text) to anon,authenticated;

-- 1. Human-readable route codes, unique even when two names share a prefix.
alter table public.routes add column if not exists route_code text;
with base as (
  select r.id,
    (case when f.name ~* 'peak[ ]*view' then 'PKV' else upper(left(regexp_replace(f.name, '[^A-Za-z0-9]', '', 'g'), 3)) end)
      || '-' || case when upper(regexp_replace(r.route_name,'[^A-Za-z0-9]','','g'))='BAMBARALAKANDA' then 'BAN' else upper(left(regexp_replace(regexp_replace(r.route_name, '^SL[_ -]*', '', 'i'), '[^A-Za-z0-9]', '', 'g'), 3)) end as base_code
  from public.routes r join public.factories f on f.id=r.factory_id
), ranked as (
  select id, base_code, row_number() over(partition by base_code order by id) as n from base
)
update public.routes r set route_code = ranked.base_code || case when ranked.n=1 then '' else '-'||ranked.n::text end
from ranked where ranked.id=r.id and (r.route_code is null or r.route_code='');
alter table public.routes alter column route_code set not null;
create unique index if not exists routes_route_code_unique on public.routes(route_code);
create or replace function public.assign_route_code() returns trigger language plpgsql set search_path=public as $$
declare factory_prefix text; route_prefix text; base_code text; candidate text; suffix integer:=1;
begin
  if tg_op='UPDATE' and (new.factory_id is distinct from old.factory_id or new.route_name is distinct from old.route_name) and new.route_code is not distinct from old.route_code then
    new.route_code:=null;
  end if;
  if nullif(trim(new.route_code),'') is not null then new.route_code=upper(trim(new.route_code)); return new; end if;
  select case when name ~* 'peak[ ]*view' then 'PKV' else upper(left(regexp_replace(name,'[^A-Za-z0-9]','','g'),3)) end
    into factory_prefix from public.factories where id=new.factory_id;
  route_prefix:=case when upper(regexp_replace(new.route_name,'[^A-Za-z0-9]','','g'))='BAMBARALAKANDA' then 'BAN'
    else upper(left(regexp_replace(regexp_replace(new.route_name,'^SL[_ -]*','','i'),'[^A-Za-z0-9]','','g'),3)) end;
  base_code:=factory_prefix||'-'||route_prefix; candidate:=base_code;
  while exists(select 1 from public.routes r where r.route_code=candidate and r.id is distinct from new.id) loop
    suffix:=suffix+1; candidate:=base_code||'-'||suffix::text;
  end loop;
  new.route_code:=candidate; return new;
end $$;
drop trigger if exists assign_route_code_trigger on public.routes;
create trigger assign_route_code_trigger before insert or update of factory_id,route_name,route_code on public.routes for each row execute function public.assign_route_code();

-- Supplier numbers are unique inside a factory, not globally.
drop index if exists public.users_supplier_no_unique;
create unique index if not exists users_factory_supplier_no_unique
  on public.users(factory_id, supplier_no) where supplier_no is not null;
create unique index if not exists users_email_unique on public.users(lower(email)) where email is not null;
drop index if exists public.users_phone_unique;
create unique index users_phone_unique on public.users(regexp_replace(phone,'[[:space:]]','','g')) where phone is not null and trim(phone) <> '';
do $$ begin
  if exists(select 1 from pg_type where typname='user_status') then alter type public.user_status add value if not exists 'rejected'; end if;
end $$;
do $$ declare c text; begin
  for c in select conname from pg_constraint where conrelid='public.users'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%status%' loop execute format('alter table public.users drop constraint %I',c); end loop;
  if not exists(select 1 from pg_attribute a join pg_type t on t.oid=a.atttypid where a.attrelid='public.users'::regclass and a.attname='status' and t.typname='user_status') then
    alter table public.users add constraint users_status_check check(status in ('active','suspended','pending_approval','rejected'));
  end if;
end $$;

-- Offline replay idempotency.
alter table public.harvest_records add column if not exists client_record_id uuid;
alter table public.harvest_records add column if not exists device_id text;
alter table public.harvest_records add column if not exists synced_at timestamptz;
create unique index if not exists harvest_records_client_device_unique
  on public.harvest_records(client_record_id, device_id) where client_record_id is not null and device_id is not null;

-- 2. One collector route per day.
create table if not exists public.collector_route_assignments (
  id uuid primary key default gen_random_uuid(),
  collector_id text not null references public.users(id),
  factory_id uuid not null references public.factories(id),
  route_id uuid not null references public.routes(id),
  assignment_date date not null,
  lorry_plate text,
  status text not null default 'assigned' check(status in ('assigned','started','completed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  assigned_by text not null,
  created_at timestamptz not null default now(),
  unique(collector_id, assignment_date)
);
create index if not exists collector_assignment_route_date_idx on public.collector_route_assignments(route_id, assignment_date);

alter table public.lorry_locations add column if not exists assignment_id uuid references public.collector_route_assignments(id);
alter table public.lorry_locations add column if not exists last_notification_at timestamptz;
-- These two compatibility columns already exist when the earlier Round 12 GPS
-- patch was applied; keeping them here makes this migration self-contained.
alter table public.lorry_locations add column if not exists active boolean not null default true;
alter table public.lorry_locations add column if not exists stopped_at timestamptz;
alter table public.lorry_locations drop constraint if exists lorry_locations_route_id_key;
create unique index if not exists lorry_locations_assignment_unique on public.lorry_locations(assignment_id) where assignment_id is not null;
create index if not exists lorry_locations_route_updated_idx on public.lorry_locations(route_id, updated_at desc);

-- Factory/route integrity for all operational writes.
create or replace function public.validate_factory_route() returns trigger language plpgsql as $$
begin
  if new.route_id is not null and new.factory_id is not null and not exists(
    select 1 from public.routes r where r.id=new.route_id and r.factory_id=new.factory_id
  ) then raise exception 'Route does not belong to selected factory'; end if;
  return new;
end $$;
drop trigger if exists validate_harvest_factory_route on public.harvest_records;
create trigger validate_harvest_factory_route before insert or update of factory_id,route_id on public.harvest_records for each row execute function public.validate_factory_route();
drop trigger if exists validate_estate_factory_route on public.estates;
create trigger validate_estate_factory_route before insert or update of factory_id,route_id on public.estates for each row execute function public.validate_factory_route();
drop trigger if exists validate_user_factory_route on public.users;
create trigger validate_user_factory_route before insert or update of factory_id,route_id on public.users for each row when (new.role::text='supplier') execute function public.validate_factory_route();
drop trigger if exists validate_assignment_factory_route on public.collector_route_assignments;
create trigger validate_assignment_factory_route before insert or update of factory_id,route_id on public.collector_route_assignments for each row execute function public.validate_factory_route();

-- A collector may only advance their own assignment from assigned → started →
-- completed. Route/date/lorry edits remain administrator-only.
create or replace function public.guard_collector_assignment_update() returns trigger language plpgsql as $$
begin
  if public.app_role() in ('admin','super_admin') then return new; end if;
  if public.app_role()<>'extension_officer' or old.collector_id<>public.app_uid() then raise exception 'Collector assignment access denied'; end if;
  if new.collector_id is distinct from old.collector_id or new.factory_id is distinct from old.factory_id
    or new.route_id is distinct from old.route_id or new.assignment_date is distinct from old.assignment_date
    or new.lorry_plate is distinct from old.lorry_plate or new.assigned_by is distinct from old.assigned_by
    or new.created_at is distinct from old.created_at then raise exception 'Collectors cannot edit assignment details'; end if;
  if not ((old.status='assigned' and new.status='started') or (old.status='started' and new.status='completed')) then
    raise exception 'Invalid collector assignment status transition';
  end if;
  return new;
end $$;
drop trigger if exists guard_collector_assignment_update_trigger on public.collector_route_assignments;
create trigger guard_collector_assignment_update_trigger before update on public.collector_route_assignments for each row execute function public.guard_collector_assignment_update();

create or replace function public.guard_collector_supplier_update() returns trigger language plpgsql as $$
begin
  if public.app_role() in ('admin','super_admin') then return new; end if;
  if public.app_role()<>'extension_officer' or old.role::text<>'supplier' then raise exception 'Supplier profile access denied'; end if;
  if (to_jsonb(new)-'supplier_no'-'factory_id'-'route_id'-'updated_at') is distinct from (to_jsonb(old)-'supplier_no'-'factory_id'-'route_id'-'updated_at') then
    raise exception 'Collectors may only set supplier number, factory and route';
  end if;
  if not exists(select 1 from public.collector_route_assignments a where a.collector_id=public.app_uid() and a.factory_id=new.factory_id and a.route_id=new.route_id and a.assignment_date=current_date and a.status in ('assigned','started')) then
    raise exception 'Supplier must use the collector assigned route';
  end if;
  return new;
end $$;
drop trigger if exists guard_collector_supplier_update_trigger on public.users;
create trigger guard_collector_supplier_update_trigger before update on public.users for each row execute function public.guard_collector_supplier_update();

-- Audit every route assignment action.
create or replace function public.audit_collector_assignment() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.admin_audit_log(admin_id,action,entity_type,entity_id,details)
  values(coalesce(public.app_uid(),new.assigned_by,'system'),lower(tg_op),'collector_route_assignment',new.id::text,to_jsonb(new));
  return new;
end $$;
drop trigger if exists audit_collector_assignment_trigger on public.collector_route_assignments;
create trigger audit_collector_assignment_trigger after insert or update on public.collector_route_assignments for each row execute function public.audit_collector_assignment();

-- 3. Financial helpers tolerate optional operational tables.
create or replace function public.round12_fertilizer_deduction(p_supplier text,p_month date) returns numeric language plpgsql stable security definer set search_path=public as $$
declare v numeric:=0; begin
  if p_supplier<>public.app_uid() and public.app_role() not in ('admin','super_admin') then raise exception 'Financial access denied'; end if;
  if to_regclass('public.supplier_fertilizer_ledger') is not null then
    execute 'select coalesce(sum(coalesce(settled_amount,qty_issued*95)),0) from public.supplier_fertilizer_ledger where supplier_id=$1 and date_trunc(''month'',issue_date)::date=$2 and payment_mode=''credit''' into v using p_supplier,p_month;
  end if; return coalesce(v,0); end $$;
create or replace function public.round12_cash_advance(p_supplier text,p_month date) returns numeric language plpgsql stable security definer set search_path=public as $$
declare v numeric:=0; begin
  if p_supplier<>public.app_uid() and public.app_role() not in ('admin','super_admin') then raise exception 'Financial access denied'; end if;
  if to_regclass('public.supplier_fertilizer_loans') is not null then
    execute 'select coalesce(sum(monthly_installment),0) from public.supplier_fertilizer_loans where supplier_id=$1 and status=''active'' and issued_date < ($2 + interval ''1 month'')' into v using p_supplier,p_month;
  end if; return coalesce(v,0); end $$;
create or replace function public.round12_other_deductions(p_supplier text,p_month date) returns numeric language plpgsql stable security definer set search_path=public as $$
declare v numeric:=0; begin
  if p_supplier<>public.app_uid() and public.app_role() not in ('admin','super_admin') then raise exception 'Financial access denied'; end if;
  if to_regclass('public.supplier_labor_logs') is not null then
    execute 'select coalesce(sum(total_cost),0) from public.supplier_labor_logs where supplier_id=$1 and date_trunc(''month'',log_date)::date=$2' into v using p_supplier,p_month;
  end if; return coalesce(v,0); end $$;
create or replace function public.round12_confirmed_net(p_supplier text,p_month date) returns numeric language sql stable security definer set search_path=public as $$
  select (details->>'confirmed_net_payable')::numeric from public.admin_audit_log
  where action='confirm_month_end' and entity_type='supplier_finance' and entity_id=p_supplier
    and (p_supplier=public.app_uid() or public.app_role() in ('admin','super_admin'))
    and details->>'period_month'=p_month::text order by created_at desc limit 1
$$;

create or replace view public.supplier_financial_summary with (security_invoker=true) as
with gross as (
  select supplier_id,date_trunc('month',weighed_at)::date period_month,
    coalesce(sum(amount),0)::numeric gross_earnings,
    coalesce(sum(amount) filter(where lower(status::text)='paid'),0)::numeric paid_amount
  from public.harvest_records where supplier_id is not null group by supplier_id,date_trunc('month',weighed_at)::date
), totals as (
  select *,public.round12_fertilizer_deduction(supplier_id,period_month) fertilizer_deduction,
    public.round12_cash_advance(supplier_id,period_month) cash_advance_installment,
    public.round12_other_deductions(supplier_id,period_month) other_deductions from gross
)
select supplier_id,period_month,gross_earnings,fertilizer_deduction,cash_advance_installment,other_deductions,
  (fertilizer_deduction+cash_advance_installment+other_deductions)::numeric total_deductions,paid_amount,
  (gross_earnings-fertilizer_deduction-cash_advance_installment-other_deductions-paid_amount)::numeric estimated_net_payable,
  public.round12_confirmed_net(supplier_id,period_month) confirmed_net_payable from totals;
grant select on public.supplier_financial_summary to anon,authenticated;

create or replace function public.confirm_supplier_month_end(p_supplier_id text,p_period_month date) returns void language plpgsql security definer set search_path=public as $$
declare v_net numeric; begin
  if public.app_role() not in ('admin','super_admin') then raise exception 'Administrator access required'; end if;
  select estimated_net_payable into v_net from public.supplier_financial_summary where supplier_id=p_supplier_id and period_month=date_trunc('month',p_period_month)::date;
  insert into public.admin_audit_log(admin_id,action,entity_type,entity_id,details) values(public.app_uid(),'confirm_month_end','supplier_finance',p_supplier_id,jsonb_build_object('period_month',date_trunc('month',p_period_month)::date,'confirmed_net_payable',coalesce(v_net,0)));
end $$;

-- 4. Price approval workflow (proposed value is kept in the audit log until approved).
alter table public.daily_tea_prices add column if not exists previous_price numeric;
alter table public.daily_tea_prices add column if not exists changed_by text;
alter table public.daily_tea_prices add column if not exists changed_at timestamptz;
alter table public.daily_tea_prices add column if not exists approval_status text not null default 'approved';
alter table public.daily_tea_prices add column if not exists approved_by text;
alter table public.daily_tea_prices add column if not exists approved_at timestamptz;
alter table public.daily_tea_prices add column if not exists change_reason text;
alter table public.daily_tea_prices drop constraint if exists daily_tea_prices_approval_status_check;
alter table public.daily_tea_prices add constraint daily_tea_prices_approval_status_check check(approval_status in ('pending','approved','rejected'));

create or replace function public.request_tea_price_change(p_price_id uuid,p_new_price numeric,p_reason text,p_actor_id text) returns void language plpgsql security definer set search_path=public as $$
begin
  if public.app_role() not in ('admin','super_admin') then raise exception 'Administrator access required'; end if;
  if p_new_price<=0 then raise exception 'Price must be greater than zero'; end if;
  update public.daily_tea_prices set approval_status='pending',changed_by=p_actor_id,changed_at=now(),change_reason=p_reason where id=p_price_id;
  insert into public.admin_audit_log(admin_id,action,entity_type,entity_id,details) values(public.app_uid(),'price_change_requested','daily_tea_price',p_price_id::text,jsonb_build_object('proposed_price',p_new_price,'reason',p_reason));
end $$;
create or replace function public.decide_tea_price_change(p_price_id uuid,p_approve boolean,p_actor_id text) returns void language plpgsql security definer set search_path=public as $$
declare v_new numeric; begin
  if public.app_role()<>'super_admin' then raise exception 'Super administrator access required'; end if;
  select (details->>'proposed_price')::numeric into v_new from public.admin_audit_log where entity_id=p_price_id::text and action='price_change_requested' order by created_at desc limit 1;
  if p_approve then update public.daily_tea_prices set previous_price=price_per_kg,price_per_kg=v_new,approval_status='approved',approved_by=public.app_uid(),approved_at=now() where id=p_price_id;
  else update public.daily_tea_prices set approval_status='rejected',approved_by=public.app_uid(),approved_at=now() where id=p_price_id; end if;
  insert into public.admin_audit_log(admin_id,action,entity_type,entity_id,details) values(public.app_uid(),case when p_approve then 'price_change_approved' else 'price_change_rejected' end,'daily_tea_price',p_price_id::text,jsonb_build_object('proposed_price',v_new));
end $$;
create or replace function public.rollback_tea_price(p_price_id uuid,p_actor_id text) returns void language plpgsql security definer set search_path=public as $$
declare v_current numeric; begin
  if public.app_role()<>'super_admin' then raise exception 'Super administrator access required'; end if;
  select price_per_kg into v_current from public.daily_tea_prices where id=p_price_id;
  update public.daily_tea_prices set price_per_kg=previous_price,previous_price=v_current,changed_by=public.app_uid(),changed_at=now(),approval_status='approved',approved_by=public.app_uid(),approved_at=now(),change_reason='Rollback' where id=p_price_id and previous_price is not null;
  insert into public.admin_audit_log(admin_id,action,entity_type,entity_id,details) values(public.app_uid(),'price_rollback','daily_tea_price',p_price_id::text,jsonb_build_object('rolled_back_from',v_current));
end $$;

-- 5. Geofence alert insertion; the existing alerts webhook/FCM dispatcher sends push notifications.
create or replace function public.notify_nearby_suppliers() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.active then
    insert into public.alerts(target_user_id,title,body,alert_type)
    select e.owner_supplier_id,'Collection lorry nearby','ලොරිය ඔබගේ වත්තට ආසන්නයි — දලු සූදානම් කරන්න','lorry_nearby'
    from public.estates e where e.route_id=new.route_id and e.owner_supplier_id is not null and e.latitude is not null and e.longitude is not null
      and 6371*2*asin(sqrt(power(sin(radians((e.latitude-new.latitude)/2)),2)+cos(radians(new.latitude))*cos(radians(e.latitude))*power(sin(radians((e.longitude-new.longitude)/2)),2))) < 1
      and not exists(select 1 from public.alerts a where a.target_user_id=e.owner_supplier_id and a.alert_type='lorry_nearby' and a.created_at>=date_trunc('day',now()));
    if found then new.last_notification_at=now(); end if;
  end if; return new;
end $$;
drop trigger if exists lorry_geofence_notification on public.lorry_locations;
create trigger lorry_geofence_notification before insert or update of latitude,longitude on public.lorry_locations for each row execute function public.notify_nearby_suppliers();

-- 6. Replace permissive policies. service_role bypasses RLS for Edge Functions.
do $$ declare r record; begin
  -- Remove every legacy literal-TRUE policy, including the global open_write
  -- policy created by migration_full_crud.sql. Round 12 then grants explicit
  -- owner access below and administrator access through app_role().
  for r in select schemaname,tablename,policyname from pg_policies
    where schemaname='public' and (
      lower(regexp_replace(coalesce(qual,''),'[()[:space:]]','','g'))='true'
      or lower(regexp_replace(coalesce(with_check,''),'[()[:space:]]','','g'))='true'
      or tablename in ('estates','estate_blocks','harvest_records','users','lorry_locations','daily_tea_prices','admin_audit_log','factories','routes','collector_route_assignments','schema_migrations','alerts','farm_activities','estate_registration_requests','supplier_labor_logs','supplier_fertilizer_ledger','supplier_plots','resource_requests','settings','announcements')
    ) loop
    execute format('drop policy if exists %I on %I.%I',r.policyname,r.schemaname,r.tablename);
  end loop;
end $$;
alter table public.estates enable row level security; alter table public.estate_blocks enable row level security;
alter table public.harvest_records enable row level security; alter table public.users enable row level security;
alter table public.lorry_locations enable row level security; alter table public.daily_tea_prices enable row level security;
alter table public.admin_audit_log enable row level security; alter table public.factories enable row level security;
alter table public.routes enable row level security; alter table public.collector_route_assignments enable row level security;
alter table public.schema_migrations enable row level security;

-- Any table that was previously exposed through migration_full_crud retains
-- full application access for active administrators only. Supplier/collector
-- exceptions are added explicitly below.
do $$ declare t record; begin
  for t in select n.nspname schema_name,c.relname table_name
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity
  loop
    if not exists(select 1 from pg_policies p where p.schemaname=t.schema_name and p.tablename=t.table_name and p.policyname='round12 admin full access') then
      execute format('create policy %I on %I.%I for all using (public.app_role() in (''admin'',''super_admin'')) with check (public.app_role() in (''admin'',''super_admin''))','round12 admin full access',t.schema_name,t.table_name);
    end if;
  end loop;
end $$;

create policy estates_select on public.estates for select using(owner_supplier_id=public.app_uid() or public.app_role() in ('admin','super_admin'));
create policy estates_write on public.estates for all using(owner_supplier_id=public.app_uid() or public.app_role() in ('admin','super_admin')) with check(owner_supplier_id=public.app_uid() or public.app_role() in ('admin','super_admin'));
create policy blocks_access on public.estate_blocks for all using(exists(select 1 from public.estates e where e.id=estate_id and (e.owner_supplier_id=public.app_uid() or public.app_role() in ('admin','super_admin')))) with check(exists(select 1 from public.estates e where e.id=estate_id and (e.owner_supplier_id=public.app_uid() or public.app_role() in ('admin','super_admin'))));
create policy harvest_select on public.harvest_records for select using(supplier_id=public.app_uid() or public.app_role() in ('admin','super_admin') or exists(select 1 from public.collector_route_assignments a where a.collector_id=public.app_uid() and a.route_id=harvest_records.route_id and a.assignment_date=current_date and a.status in ('assigned','started','completed')));
create policy harvest_collector_insert on public.harvest_records for insert with check(exists(select 1 from public.collector_route_assignments a where a.collector_id=public.app_uid() and a.route_id=harvest_records.route_id and a.assignment_date=coalesce(harvest_records.weighed_at::date,current_date) and a.status in ('assigned','started','completed')));
create policy users_select on public.users for select using(id=public.app_uid() or public.app_role() in ('admin','super_admin') or (public.app_role()='extension_officer' and exists(select 1 from public.collector_route_assignments a where a.collector_id=public.app_uid() and a.route_id=users.route_id and a.assignment_date=current_date)));
create policy users_admin_write on public.users for all using(public.app_role() in ('admin','super_admin')) with check(public.app_role() in ('admin','super_admin'));
create policy users_pending_registration on public.users for insert with check(
  role::text='supplier' and status::text='pending_approval'
  and public.has_recent_registration_permit(users.email)
);
create policy users_collector_supplier_insert on public.users for insert with check(
  public.app_role()='extension_officer' and role::text='supplier' and status::text='active'
  and exists(select 1 from public.collector_route_assignments a where a.collector_id=public.app_uid() and a.assignment_date=current_date and a.status in ('assigned','started'))
);
create policy users_collector_supplier_update on public.users for update using(
  public.app_role()='extension_officer' and role::text='supplier'
  and (created_at>=now()-interval '10 minutes' or exists(select 1 from public.collector_route_assignments a where a.collector_id=public.app_uid() and a.route_id=users.route_id and a.assignment_date=current_date and a.status in ('assigned','started')))
) with check(public.app_role()='extension_officer' and role::text='supplier');
create policy lorry_select on public.lorry_locations for select using(public.app_role() in ('admin','super_admin') or driver_id=public.app_uid() or exists(select 1 from public.users u where u.id=public.app_uid() and u.role::text='supplier' and u.route_id=lorry_locations.route_id));
create policy lorry_collector_insert on public.lorry_locations for insert with check(exists(select 1 from public.collector_route_assignments a where a.id=lorry_locations.assignment_id and a.collector_id=public.app_uid() and a.assignment_date=current_date and a.status='started'));
create policy lorry_collector_update on public.lorry_locations for update using(exists(select 1 from public.collector_route_assignments a where a.id=lorry_locations.assignment_id and a.collector_id=public.app_uid() and a.assignment_date=current_date and a.status in ('started','completed'))) with check(exists(select 1 from public.collector_route_assignments a where a.id=lorry_locations.assignment_id and a.collector_id=public.app_uid() and a.assignment_date=current_date and (a.status='started' or (a.status='completed' and lorry_locations.active=false))));
create policy prices_read on public.daily_tea_prices for select using(public.app_uid() is not null);
create policy prices_write on public.daily_tea_prices for all using(public.app_role() in ('admin','super_admin')) with check(public.app_role() in ('admin','super_admin'));
create policy audit_read on public.admin_audit_log for select using(public.app_role() in ('admin','super_admin'));
create policy audit_insert on public.admin_audit_log for insert with check(admin_id=public.app_uid());
create policy factories_registration_read on public.factories for select using(coalesce(current_setting('request.jwt.claim.role',true),'anon') in ('anon','authenticated'));
create policy routes_registration_read on public.routes for select using(coalesce(current_setting('request.jwt.claim.role',true),'anon') in ('anon','authenticated'));
create policy assignments_select on public.collector_route_assignments for select using(collector_id=public.app_uid() or public.app_role() in ('admin','super_admin'));
create policy assignments_admin_write on public.collector_route_assignments for all using(public.app_role() in ('admin','super_admin')) with check(public.app_role() in ('admin','super_admin'));
create policy assignments_collector_status on public.collector_route_assignments for update using(collector_id=public.app_uid() and public.app_role()='extension_officer') with check(collector_id=public.app_uid() and public.app_role()='extension_officer');
create policy schema_version_read on public.schema_migrations for select using(public.app_uid() is not null);

-- Supplier-owned compatibility tables from earlier rounds. The dynamic form
-- keeps this migration installable when an optional legacy table was skipped.
do $$ begin
  if to_regclass('public.alerts') is not null then
    execute 'alter table public.alerts enable row level security';
    execute 'create policy alerts_own_read on public.alerts for select using (target_user_id=public.app_uid())';
    execute 'create policy alerts_own_update on public.alerts for update using (target_user_id=public.app_uid()) with check (target_user_id=public.app_uid())';
  end if;
  if to_regclass('public.farm_activities') is not null then
    execute 'alter table public.farm_activities enable row level security';
    execute 'create policy farm_activities_own on public.farm_activities for all using (user_id=public.app_uid()) with check (user_id=public.app_uid())';
  end if;
  if to_regclass('public.estate_registration_requests') is not null then
    execute 'alter table public.estate_registration_requests enable row level security';
    execute 'create policy estate_requests_own on public.estate_registration_requests for all using (supplier_id=public.app_uid()) with check (supplier_id=public.app_uid())';
  end if;
  if to_regclass('public.supplier_labor_logs') is not null then
    execute 'alter table public.supplier_labor_logs enable row level security';
    execute 'create policy supplier_labor_own on public.supplier_labor_logs for all using (supplier_id=public.app_uid()) with check (supplier_id=public.app_uid())';
  end if;
  if to_regclass('public.supplier_fertilizer_ledger') is not null then
    execute 'alter table public.supplier_fertilizer_ledger enable row level security';
    execute 'create policy supplier_fertilizer_own_read on public.supplier_fertilizer_ledger for select using (supplier_id=public.app_uid())';
  end if;
  if to_regclass('public.supplier_plots') is not null then
    execute 'alter table public.supplier_plots enable row level security';
    -- Phase 1 created supplier_plots ownership as user_id (Firebase UID).
    execute 'create policy supplier_plots_own on public.supplier_plots for all using (user_id=public.app_uid()) with check (user_id=public.app_uid())';
  end if;
  if to_regclass('public.resource_requests') is not null then
    execute 'alter table public.resource_requests enable row level security';
    execute 'create policy resource_requests_own on public.resource_requests for all using (supplier_id=public.app_uid()) with check (supplier_id=public.app_uid())';
  end if;
  if to_regclass('public.settings') is not null then
    execute 'alter table public.settings enable row level security';
    execute 'create policy settings_public_read on public.settings for select using (coalesce(current_setting(''request.jwt.claim.role'',true),''anon'') in (''anon'',''authenticated''))';
  end if;
  if to_regclass('public.announcements') is not null then
    execute 'alter table public.announcements enable row level security';
    execute 'create policy announcements_public_read on public.announcements for select using (published=true or public.app_role() in (''admin'',''super_admin''))';
  end if;
end $$;

insert into public.schema_migrations(version,filename,applied_by)
values('round_12','migration_phase3_round12_production_hardening.sql',public.app_uid())
on conflict(version) do update set filename=excluded.filename,applied_at=now(),applied_by=excluded.applied_by;
-- Verification (run after the script completes):
-- select version,filename,applied_at from public.schema_migrations where version='round_12';
-- select route_code,count(*) from public.routes group by route_code having count(*)>1;
-- select tablename,policyname,qual from pg_policies where schemaname='public' order by tablename,policyname;
