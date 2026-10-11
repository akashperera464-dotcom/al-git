-- Verda ERP · Phase 3 / Round 11
-- Unified estates, multi-estate ownership, atomic approval and audit history.
-- Run once in Supabase Dashboard -> SQL Editor. Safe to re-run.
--
-- IMPORTANT HYBRID-AUTH NOTE
-- Firebase remains the identity provider and the browser does not establish a
-- Supabase Auth session.  Therefore auth.uid() is intentionally NOT used in
-- these transitional RLS policies.  The UI continues to enforce RouteGuard /
-- identity.ts permissions, while the SECURITY DEFINER RPCs verify the supplied
-- admin id against public.users.  Do not replace these policies with auth.uid()
-- checks unless a separately approved Firebase-to-Supabase JWT bridge exists.

create extension if not exists pgcrypto;

-- 1) One canonical estate record for company estates and supplier estates.
alter table public.estates add column if not exists owner_supplier_id text;
alter table public.estates add column if not exists supplier_id text;
alter table public.estates add column if not exists size_category text default 'small';
alter table public.estates add column if not exists factory_id uuid;
alter table public.estates add column if not exists route_id uuid;
alter table public.estates add column if not exists contact_phone text;
alter table public.estates add column if not exists address text;
alter table public.estates add column if not exists photo_urls text[];
alter table public.estates add column if not exists soil_type text;
alter table public.estates add column if not exists cultivar text;
alter table public.estates add column if not exists status text default 'approved';
alter table public.estates add column if not exists submitted_at timestamptz default now();
alter table public.estates add column if not exists approved_at timestamptz;
alter table public.estates add column if not exists approved_by text;
alter table public.estates add column if not exists rejection_reason text;
alter table public.estates add column if not exists edit_count integer default 0;
alter table public.estates add column if not exists last_edited_at timestamptz;
alter table public.estates add column if not exists created_by_admin boolean default false;
alter table public.estates add column if not exists notes text;

-- Preserve the older Round-8 supplier_id relationship as a compatibility alias.
update public.estates
set owner_supplier_id = supplier_id
where owner_supplier_id is null and supplier_id is not null;

update public.estates
set status = 'approved'
where status is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'estates_owner_supplier_fk') then
    alter table public.estates
      add constraint estates_owner_supplier_fk
      foreign key (owner_supplier_id) references public.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'estates_factory_fk') then
    alter table public.estates
      add constraint estates_factory_fk
      foreign key (factory_id) references public.factories(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'estates_route_fk') then
    alter table public.estates
      add constraint estates_route_fk
      foreign key (route_id) references public.routes(id) on delete set null;
  end if;
end $$;

create index if not exists estates_owner_idx on public.estates(owner_supplier_id);
create index if not exists estates_factory_route_idx on public.estates(factory_id, route_id);
create index if not exists estates_status_idx on public.estates(status);
create unique index if not exists estates_owner_name_unique
  on public.estates(owner_supplier_id, lower(name))
  where owner_supplier_id is not null;

-- 2) Blocks belong to the same canonical estate record.
create table if not exists public.estate_blocks (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  name text not null,
  area_ha numeric(12,3) not null default 0,
  bush_count integer not null default 0,
  cultivar text,
  soil_type text,
  status text not null default 'plucking',
  planting_year integer,
  created_at timestamptz not null default now()
);
create index if not exists estate_blocks_estate_idx on public.estate_blocks(estate_id);

-- 3) Immutable administrative audit trail.
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_admin_idx on public.admin_audit_log(admin_id, created_at desc);
create index if not exists audit_log_entity_idx on public.admin_audit_log(entity_type, entity_id, created_at desc);

-- 4) Recoverable user deactivation (never hard-delete a user profile).
alter table public.users add column if not exists deactivated_at timestamptz;

-- 5) Transitional RLS for the established Firebase + Supabase hybrid model.
alter table public.estates enable row level security;
alter table public.estate_blocks enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists "round11 estates hybrid access" on public.estates;
create policy "round11 estates hybrid access" on public.estates
  for all using (true) with check (true);

drop policy if exists "round11 estate blocks hybrid access" on public.estate_blocks;
create policy "round11 estate blocks hybrid access" on public.estate_blocks
  for all using (true) with check (true);

drop policy if exists "round11 audit hybrid access" on public.admin_audit_log;
create policy "round11 audit hybrid access" on public.admin_audit_log
  for all using (true) with check (true);

-- 6) Atomic admin approval. Verifies that the caller id is an active admin.
create or replace function public.approve_estate_transaction(
  p_estate_id uuid,
  p_admin_id text,
  p_admin_notes text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id text;
begin
  if not exists (
    select 1 from public.users
    where id = p_admin_id
      and role in ('admin', 'super_admin')
      and status = 'active'
      and deactivated_at is null
  ) then
    raise exception 'Only an active administrator can approve an estate';
  end if;

  update public.estates
  set status = 'approved',
      approved_at = now(),
      approved_by = p_admin_id,
      rejection_reason = null
  where id = p_estate_id and status = 'pending'
  returning owner_supplier_id into v_supplier_id;

  if not found then
    raise exception 'Estate not found or is no longer pending';
  end if;

  insert into public.admin_audit_log (admin_id, action, entity_type, entity_id, details)
  values (
    p_admin_id, 'approve', 'estate', p_estate_id::text,
    jsonb_build_object('supplier_id', v_supplier_id, 'notes', p_admin_notes)
  );

  if v_supplier_id is not null then
    update public.users
    set associated_entity_id = coalesce(associated_entity_id, p_estate_id)
    where id = v_supplier_id;
  end if;
end;
$$;

-- 7) Atomic rejection + audit.
create or replace function public.reject_estate_transaction(
  p_estate_id uuid,
  p_admin_id text,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id text;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A rejection reason is required';
  end if;
  if not exists (
    select 1 from public.users
    where id = p_admin_id
      and role in ('admin', 'super_admin')
      and status = 'active'
      and deactivated_at is null
  ) then
    raise exception 'Only an active administrator can reject an estate';
  end if;

  update public.estates
  set status = 'rejected',
      rejection_reason = trim(p_reason),
      approved_at = null,
      approved_by = p_admin_id
  where id = p_estate_id and status = 'pending'
  returning owner_supplier_id into v_supplier_id;

  if not found then
    raise exception 'Estate not found or is no longer pending';
  end if;

  insert into public.admin_audit_log (admin_id, action, entity_type, entity_id, details)
  values (
    p_admin_id, 'reject', 'estate', p_estate_id::text,
    jsonb_build_object('supplier_id', v_supplier_id, 'reason', trim(p_reason))
  );
end;
$$;

-- 8) Migrate old supplier registration requests without creating duplicates.
insert into public.estates (
  owner_supplier_id, supplier_id, name, region, total_area_ha,
  total_area_acres, total_bush_count, latitude, longitude, contact_phone,
  address, photo_urls, soil_type, cultivar, status, submitted_at,
  approved_at, approved_by, rejection_reason, created_by_admin, notes
)
select
  r.supplier_id,
  r.supplier_id,
  r.plot_name,
  coalesce(r.region, '—'),
  round((coalesce(r.acreage, 0) / 2.471)::numeric, 4),
  coalesce(r.acreage, 0),
  coalesce(r.bush_count, 0),
  r.latitude,
  r.longitude,
  r.contact_phone,
  r.address,
  -- Existing installations differ here: Round 8 originally documented jsonb,
  -- while some live databases use text[]. to_jsonb() normalizes either shape
  -- before expanding it into the canonical estates.photo_urls text[].
  case when r.photo_urls is null then null
       else array(select jsonb_array_elements_text(to_jsonb(r.photo_urls))) end,
  r.soil_type,
  r.cultivar,
  case when upper(r.status) = 'APPROVED' then 'approved'
       when upper(r.status) = 'REJECTED' then 'rejected'
       else 'pending' end,
  r.submitted_at,
  r.reviewed_at,
  r.reviewed_by,
  case when upper(r.status) = 'REJECTED' then r.admin_notes else null end,
  false,
  r.notes
from public.estate_registration_requests r
where not exists (
  select 1 from public.estates e
  where e.owner_supplier_id = r.supplier_id
    and lower(e.name) = lower(r.plot_name)
)
on conflict do nothing;

-- 9) Sanity checks.
select 'Round 11 unified estates migration ready' as status;
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'estates'
  and column_name in ('owner_supplier_id', 'size_category', 'status', 'created_by_admin')
order by column_name;
