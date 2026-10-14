-- ============================================================================
-- KDU EMS · Phase 3 Round 14 · Multi-route suppliers and collectors
-- Run after migration_phase3_round13_realtime_lorry_broadcast.sql.
-- Keeps users.route_id as the backwards-compatible primary route.
-- ============================================================================

create table if not exists public.user_route_assignments (
  user_id text not null references public.users(id) on delete cascade,
  factory_id uuid not null references public.factories(id),
  route_id uuid not null references public.routes(id),
  is_primary boolean not null default false,
  assigned_by text,
  created_at timestamptz not null default now(),
  primary key(user_id,route_id)
);
create unique index if not exists user_route_one_primary
  on public.user_route_assignments(user_id) where is_primary;
create index if not exists user_route_route_lookup
  on public.user_route_assignments(route_id,user_id);

create or replace function public.validate_user_route_assignment() returns trigger
language plpgsql security definer set search_path=public as $$
declare route_factory uuid; target_role text;
begin
  select factory_id into route_factory from public.routes where id=new.route_id;
  if route_factory is null or route_factory<>new.factory_id then raise exception 'Route does not belong to the selected factory'; end if;
  select role::text into target_role from public.users where id=new.user_id;
  if target_role not in ('supplier','extension_officer') then raise exception 'Only suppliers and collectors can have route assignments'; end if;
  return new;
end $$;
drop trigger if exists validate_user_route_assignment_trigger on public.user_route_assignments;
create trigger validate_user_route_assignment_trigger before insert or update on public.user_route_assignments
for each row execute function public.validate_user_route_assignment();

-- Existing single-route users automatically retain that route as primary.
insert into public.user_route_assignments(user_id,factory_id,route_id,is_primary,assigned_by)
select u.id,u.factory_id,u.route_id,true,'round_14_backfill'
from public.users u
join public.routes r on r.id=u.route_id and r.factory_id=u.factory_id
where u.role::text in ('supplier','extension_officer') and u.factory_id is not null and u.route_id is not null
on conflict(user_id,route_id) do update set factory_id=excluded.factory_id,is_primary=true;

-- Preserve routes already used by a supplier's estates. This prevents a
-- historical secondary estate route from disappearing during the upgrade.
insert into public.user_route_assignments(user_id,factory_id,route_id,is_primary,assigned_by)
select distinct e.owner_supplier_id,e.factory_id,e.route_id,(u.route_id=e.route_id),'round_14_estate_backfill'
from public.estates e
join public.users u on u.id=e.owner_supplier_id and u.role::text='supplier'
join public.routes r on r.id=e.route_id and r.factory_id=e.factory_id
where e.owner_supplier_id is not null and e.factory_id is not null and e.route_id is not null
on conflict(user_id,route_id) do update
set factory_id=excluded.factory_id,
    is_primary=public.user_route_assignments.is_primary or excluded.is_primary;

create or replace function public.sync_primary_user_route() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.role::text in ('supplier','extension_officer') and new.factory_id is not null and new.route_id is not null then
    update public.user_route_assignments set is_primary=false where user_id=new.id and route_id<>new.route_id;
    insert into public.user_route_assignments(user_id,factory_id,route_id,is_primary,assigned_by)
    values(new.id,new.factory_id,new.route_id,true,coalesce(public.app_uid(),'profile_sync'))
    on conflict(user_id,route_id) do update set factory_id=excluded.factory_id,is_primary=true;
  elsif new.role::text not in ('supplier','extension_officer') then
    delete from public.user_route_assignments where user_id=new.id;
  end if;
  return new;
end $$;
drop trigger if exists sync_primary_user_route_trigger on public.users;
create trigger sync_primary_user_route_trigger after insert or update of factory_id,route_id,role on public.users
for each row execute function public.sync_primary_user_route();

create or replace function public.multi_route_schema_ready() returns boolean
language sql stable security definer set search_path=public as $$ select true $$;
revoke all on function public.multi_route_schema_ready() from public;
grant execute on function public.multi_route_schema_ready() to anon,authenticated;

create or replace function public.set_user_routes(
  p_user_id text,
  p_factory_id uuid,
  p_route_ids uuid[],
  p_primary_route_id uuid,
  p_registration_email text
) returns void language plpgsql security definer set search_path=public as $$
declare
  caller_role text:=public.app_role();
  target_role text;
  target_email text;
  target_status text;
  requested_count integer;
  valid_count integer;
begin
  select role::text,email,status::text into target_role,target_email,target_status from public.users where id=p_user_id;
  if target_role is null then raise exception 'User was not found'; end if;
  if target_role not in ('supplier','extension_officer') then raise exception 'Route assignments require a supplier or collector account'; end if;
  if caller_role not in ('admin','super_admin') and not (
    target_role='supplier' and target_status='pending_approval'
    and p_registration_email is not null and lower(trim(target_email))=lower(trim(p_registration_email))
    and public.has_recent_registration_permit(p_registration_email)
  ) then raise exception 'Route assignment access denied'; end if;
  select count(distinct selected.route_id) into requested_count
  from unnest(coalesce(p_route_ids,array[]::uuid[])) as selected(route_id);
  if requested_count<1 or requested_count>25 then raise exception 'Select between 1 and 25 routes'; end if;
  if p_primary_route_id is null or not coalesce(p_primary_route_id=any(p_route_ids),false) then raise exception 'Primary route must be selected'; end if;
  select count(*) into valid_count from public.routes where id=any(p_route_ids) and factory_id=p_factory_id;
  if valid_count<>requested_count then raise exception 'Every selected route must belong to the selected factory'; end if;

  update public.users set factory_id=p_factory_id,route_id=p_primary_route_id where id=p_user_id;
  delete from public.user_route_assignments where user_id=p_user_id;
  insert into public.user_route_assignments(user_id,factory_id,route_id,is_primary,assigned_by)
  select p_user_id,p_factory_id,selected.route_id,selected.route_id=p_primary_route_id,coalesce(public.app_uid(),'self_registration')
  from (select distinct unnest(p_route_ids) as route_id) selected;
  if caller_role in ('admin','super_admin') then
    insert into public.admin_audit_log(admin_id,action,entity_type,entity_id,details)
    values(public.app_uid(),'set_routes','user',p_user_id,jsonb_build_object('factory_id',p_factory_id,'route_ids',p_route_ids,'primary_route_id',p_primary_route_id));
  end if;
end $$;
revoke all on function public.set_user_routes(text,uuid,uuid[],uuid,text) from public;
grant execute on function public.set_user_routes(text,uuid,uuid[],uuid,text) to anon,authenticated;

alter table public.user_route_assignments enable row level security;
grant select on public.user_route_assignments to authenticated;
drop policy if exists user_routes_own_read on public.user_route_assignments;
drop policy if exists user_routes_admin_all on public.user_route_assignments;
drop policy if exists user_routes_collector_directory on public.user_route_assignments;
create policy user_routes_own_read on public.user_route_assignments for select
using(user_id=public.app_uid());
create policy user_routes_admin_all on public.user_route_assignments for all
using(public.app_role() in ('admin','super_admin')) with check(public.app_role() in ('admin','super_admin'));
create policy user_routes_collector_directory on public.user_route_assignments for select using(
  exists(select 1 from public.collector_route_assignments a where a.collector_id=public.app_uid()
    and a.route_id=user_route_assignments.route_id and a.assignment_date=current_date and a.status in ('assigned','started','completed'))
);

-- Collector directory reads now include suppliers whose selected route is not
-- their legacy primary users.route_id.
drop policy if exists users_select on public.users;
create policy users_select on public.users for select using(
  id=public.app_uid() or public.app_role() in ('admin','super_admin')
  or (public.app_role()='extension_officer' and exists(
    select 1 from public.collector_route_assignments a
    join public.user_route_assignments ura on ura.route_id=a.route_id and ura.user_id=users.id
    where a.collector_id=public.app_uid() and a.assignment_date=current_date and a.status in ('assigned','started','completed')
  ))
);

create or replace function public.validate_collector_authorized_route() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.user_route_assignments where user_id=new.collector_id and factory_id=new.factory_id and route_id=new.route_id) then
    raise exception 'Collector is not authorized for this route';
  end if;
  return new;
end $$;
drop trigger if exists validate_collector_authorized_route_trigger on public.collector_route_assignments;
create trigger validate_collector_authorized_route_trigger before insert or update of collector_id,factory_id,route_id
on public.collector_route_assignments for each row execute function public.validate_collector_authorized_route();

create or replace function public.validate_supplier_estate_route() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.owner_supplier_id is not null and new.route_id is not null and not exists(
    select 1 from public.user_route_assignments where user_id=new.owner_supplier_id and factory_id=new.factory_id and route_id=new.route_id
  ) then raise exception 'Supplier is not assigned to the estate route'; end if;
  return new;
end $$;
drop trigger if exists validate_supplier_estate_route_trigger on public.estates;
create trigger validate_supplier_estate_route_trigger before insert or update of owner_supplier_id,factory_id,route_id
on public.estates for each row execute function public.validate_supplier_estate_route();

-- Private Broadcast subscribers may receive every route explicitly assigned to them.
drop policy if exists "route tracking receive" on realtime.messages;
create policy "route tracking receive" on realtime.messages for select to authenticated using(
  realtime.messages.extension='broadcast'
  and realtime.topic() ~ '^route-tracking:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  and (
    public.app_role() in ('admin','super_admin')
    or exists(select 1 from public.user_route_assignments ura join public.users u on u.id=ura.user_id
      where ura.user_id=public.app_uid() and u.role::text='supplier' and u.deactivated_at is null and u.status::text='active'
        and ura.route_id::text=split_part(realtime.topic(),':',2))
    or exists(select 1 from public.collector_route_assignments a where a.collector_id=public.app_uid()
      and a.assignment_date=current_date and a.status in ('assigned','started') and a.route_id::text=split_part(realtime.topic(),':',2))
  )
);

insert into public.schema_migrations(version,filename,applied_by)
values('round_14','migration_phase3_round14_multi_route_users.sql',public.app_uid())
on conflict(version) do update set filename=excluded.filename,applied_at=now(),applied_by=excluded.applied_by;

-- Verification:
-- select u.name,u.role,ura.is_primary,r.route_code,r.route_name
-- from public.user_route_assignments ura join public.users u on u.id=ura.user_id join public.routes r on r.id=ura.route_id
-- order by u.name,ura.is_primary desc,r.route_name;
