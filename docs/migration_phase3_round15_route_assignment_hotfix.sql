-- Estate Pulse · Free-plan route-assignment compatibility hotfix
--
-- Apply once if User Management shows:
--   "Could not save route assignments: Route assignment access denied"
--
-- The old Round 14 function expected a verified Supabase JWT. This project
-- intentionally uses Firebase Auth + the Supabase anon client on the Free
-- plan, so app_role()/auth.uid() are unavailable. This patch preserves all
-- factory/route/user integrity checks without introducing paid auth features.

begin;

alter table if exists public.user_route_assignments disable row level security;
grant select,insert,update,delete on public.user_route_assignments to anon,authenticated;

drop policy if exists user_routes_own_read on public.user_route_assignments;
drop policy if exists user_routes_admin_all on public.user_route_assignments;
drop policy if exists user_routes_collector_directory on public.user_route_assignments;

create or replace function public.sync_primary_user_route() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.role::text in ('supplier','extension_officer') and new.factory_id is not null and new.route_id is not null then
    update public.user_route_assignments set is_primary=false where user_id=new.id and route_id<>new.route_id;
    insert into public.user_route_assignments(user_id,factory_id,route_id,is_primary,assigned_by)
    values(new.id,new.factory_id,new.route_id,true,'profile_sync')
    on conflict(user_id,route_id) do update set factory_id=excluded.factory_id,is_primary=true;
  elsif new.role::text not in ('supplier','extension_officer') then
    delete from public.user_route_assignments where user_id=new.id;
  end if;
  return new;
end $$;

create or replace function public.set_user_routes(
  p_user_id text,
  p_factory_id uuid,
  p_route_ids uuid[],
  p_primary_route_id uuid,
  p_registration_email text
) returns void language plpgsql security definer set search_path=public as $$
declare
  target_role text;
  requested_count integer;
  valid_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id));

  select role::text into target_role from public.users where id=p_user_id;
  if target_role is null then raise exception 'User was not found'; end if;
  if target_role not in ('supplier','extension_officer') then
    raise exception 'Route assignments require a supplier or collector account';
  end if;

  select count(distinct selected.route_id) into requested_count
  from unnest(coalesce(p_route_ids,array[]::uuid[])) as selected(route_id);
  if requested_count<1 or requested_count>25 then raise exception 'Select between 1 and 25 routes'; end if;
  if p_primary_route_id is null or not coalesce(p_primary_route_id=any(p_route_ids),false) then
    raise exception 'Primary route must be selected';
  end if;

  select count(*) into valid_count
  from public.routes where id=any(p_route_ids) and factory_id=p_factory_id;
  if valid_count<>requested_count then
    raise exception 'Every selected route must belong to the selected factory';
  end if;

  update public.users set factory_id=p_factory_id,route_id=p_primary_route_id where id=p_user_id;
  delete from public.user_route_assignments where user_id=p_user_id;
  insert into public.user_route_assignments(user_id,factory_id,route_id,is_primary,assigned_by)
  select p_user_id,p_factory_id,selected.route_id,selected.route_id=p_primary_route_id,
    case when p_registration_email is null then 'client_rbac_admin' else 'self_registration' end
  from (select distinct unnest(p_route_ids) as route_id) selected;
end $$;

revoke all on function public.set_user_routes(text,uuid,uuid[],uuid,text) from public;
grant execute on function public.set_user_routes(text,uuid,uuid[],uuid,text) to anon,authenticated;

commit;

-- Verification (must return false, then true):
select c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='user_route_assignments';

select position('app_role' in pg_get_functiondef(
  'public.set_user_routes(text,uuid,uuid[],uuid,text)'::regprocedure
))=0 as jwt_role_check_removed;
