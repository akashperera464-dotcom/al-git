-- Run FIRST, as the database owner, before the secured migrations.
-- Firebase UIDs are text, not UUIDs. auth.uid() can fail when casting them.
begin;
create or replace function public.app_uid() returns text
language sql stable set search_path = ''
as $$ select nullif(auth.jwt()->>'sub', '') $$;

-- SECURITY DEFINER avoids recursive users-table RLS. Only this function's
-- owner can read arbitrary roles; the caller cannot supply another UID.
create or replace function public.app_role() returns text
language sql stable security definer set search_path = ''
as $$
  select case lower(u.role::text)
    when 'factory_owner' then 'admin'
    when 'supervisor' then 'extension_officer'
    when 'field_supervisor' then 'extension_officer'
    else lower(u.role::text) end
  from public.users u
  where u.id = public.app_uid() and u.status::text = 'active'
$$;
create or replace function public.app_is_admin() returns boolean
language sql stable set search_path = ''
as $$ select coalesce(public.app_role() in ('admin', 'super_admin'), false) $$;

revoke all on function public.app_uid(), public.app_role(), public.app_is_admin() from public;
grant execute on function public.app_uid(), public.app_role(), public.app_is_admin() to authenticated, service_role;
commit;
