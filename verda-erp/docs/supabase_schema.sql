-- ============================================================================
-- Verda ERP · Supabase (PostgreSQL) Schema + Row-Level Security
-- ----------------------------------------------------------------------------
-- HYBRID ARCHITECTURE:
--   Firebase  → Authentication (Phone OTP) + Cloud Messaging (FCM) only.
--   Supabase  → ALL business logic, master data & transactional tables.
--
-- The Firebase `uid` is the PRIMARY KEY (`id`) of `users`. Supabase RLS
-- authorizes queries using `auth.uid()` (mapped to the Firebase uid via the
-- supabase custom access-token hook that exposes request.jwt.claims.firebase).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('super_admin', 'admin', 'supervisor', 'supplier');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('active', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type field_status as enum ('plucking', 'pruned', 'young', 'nursery');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('PENDING', 'APPROVED', 'REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_type as enum ('Workers', 'Equipment');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- USERS  (id == Firebase uid, PRIMARY KEY)
-- ----------------------------------------------------------------------------
create table if not exists users (
  id                    text primary key,                 -- Firebase uid
  name                  text        not null default 'Verda User',
  email                 text,                             -- login email (Email/Password auth)
  phone                 text,
  division              text,                             -- supervisor's assigned division
  role                  user_role   not null default 'supplier',  -- fail-closed default
  associated_entity_id  uuid,                              -- estate link (suppliers)
  status                user_status not null default 'active',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists uniq_users_email on users(email) where email is not null;

-- ----------------------------------------------------------------------------
-- ESTATES → DIVISIONS → FIELDS  (master hierarchy)
-- ----------------------------------------------------------------------------
create table if not exists estates (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,
  region          text,
  total_area_ha   numeric(10,2),
  elevation_m     integer,
  created_at      timestamptz not null default now()
);

create table if not exists divisions (
  id          uuid primary key default gen_random_uuid(),
  estate_id   uuid not null references estates(id) on delete cascade,
  name        text not null,
  manager     text,
  area_ha     numeric(10,2),
  created_at  timestamptz not null default now()
);
create index if not exists idx_divisions_estate on divisions(estate_id);

create table if not exists fields (
  id            uuid primary key default gen_random_uuid(),
  division_id   uuid not null references divisions(id) on delete cascade,
  code          text not null,
  name          text not null,
  cultivar      text,
  planting_year integer,
  area_ha       numeric(10,2),
  elevation_m   integer,
  status        field_status not null default 'plucking',
  last_yield_kg numeric(12,2) not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_fields_division on fields(division_id);

-- ----------------------------------------------------------------------------
-- MANAGED USERS (admin directory view — joins to users)
-- ----------------------------------------------------------------------------
-- A view presenting the user directory for the admin "User Management" screen.
create or replace view managed_users as
  select
    u.id,
    u.name,
    u.role,
    u.phone,
    u.associated_entity_id,
    u.status,
    e.name as associated_entity_name
  from users u
  left join estates e on e.id = u.associated_entity_id;

-- ----------------------------------------------------------------------------
-- HARVEST RECORDS  (daily leaf weights / supplier deliveries)
-- ----------------------------------------------------------------------------
create table if not exists harvest_records (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   text references users(id),               -- who supplied (== Firebase uid)
  estate_id     uuid references estates(id),
  worker_id     text,
  field_id      uuid references fields(id),
  center_id     uuid,
  gross_kg      numeric(10,2) not null default 0,
  net_kg        numeric(10,2) not null default 0,
  grade         text,
  amount        numeric(12,2) not null default 0,        -- payment value (LKR)
  status        text not null default 'Pending',         -- 'Paid' | 'Pending'
  weighed_at    date not null default current_date,
  created_at    timestamptz not null default now()
);
create index if not exists idx_harvest_supplier on harvest_records(supplier_id, estate_id);

-- ----------------------------------------------------------------------------
-- RESOURCE REQUESTS  (supplier → admin ticket flow)
-- ----------------------------------------------------------------------------
create table if not exists resource_requests (
  id            uuid primary key default gen_random_uuid(),
  supplier_id   text not null references users(id),      -- == Firebase uid
  type          request_type not null,
  item_details  text not null,
  quantity      integer not null default 1,
  date_needed   timestamptz,
  duration_days integer not null default 1,
  note          text,
  status        request_status not null default 'PENDING',
  admin_notes   text,
  timestamp     timestamptz not null default now()
);
create index if not exists idx_requests_status on resource_requests(status, timestamp);

-- ----------------------------------------------------------------------------
-- updated_at trigger for users
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists trg_users_updated on users;
create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
-- auth.uid() returns the Firebase uid (via the custom access-token hook).
-- Rules mirror src/lib/rbac.ts EXACTLY (defense in depth: client + server).
-- ============================================================================

alter table users              enable row level security;
alter table estates            enable row level security;
alter table divisions          enable row level security;
alter table fields             enable row level security;
alter table harvest_records    enable row level security;
alter table resource_requests  enable row level security;

-- helper: the caller's uid as TEXT (auth.uid() returns uuid; users.id is text)
create or replace function caller_uid() returns text as $$
  select auth.uid()::text;
$$ language sql stable;

-- helper: is the caller an admin (super_admin OR admin)?
create or replace function is_admin() returns boolean as $$
  select exists(select 1 from users where id = caller_uid() and role in ('admin','super_admin'));
$$ language sql stable;

-- USERS ---------------------------------------------------------------------
-- A user may read their own row; admins read all. Self-signup may INSERT their
-- own row (id == their uid). Role/associated_entity_id are admin-only to update.
create policy "users read own or admin"  on users for select using (id = caller_uid() or is_admin());
create policy "users self insert"        on users for insert with check (id = caller_uid());
create policy "users update own profile" on users for update using (id = caller_uid())
  with check (id = caller_uid());
-- NOTE: preventing self-edit of role/associated_entity_id is enforced by a
-- BEFORE UPDATE trigger (below) so non-admins cannot escalate.

create or replace function guard_user_role() returns trigger as $$
begin
  if new.role is distinct from old.role then
    if not is_admin() then raise exception 'Only admins can change role'; end if;
  end if;
  if new.associated_entity_id is distinct from old.associated_entity_id then
    if not is_admin() then raise exception 'Only admins can change associated_entity_id'; end if;
  end if;
  return new;
end; $$ language plpgsql security definer;

drop trigger if exists trg_guard_user_role on users;
create trigger trg_guard_user_role before update on users
  for each row execute function guard_user_role();

-- ESTATES / DIVISIONS / FIELDS ---------------------------------------------
create policy "hierarchy admin write"  on estates   for all using (is_admin()) with check (is_admin());
create policy "hierarchy admin write"  on divisions for all using (is_admin() or exists(select 1 from estates e where e.id = division_id)) with check (is_admin());
create policy "hierarchy admin write"  on fields    for all using (is_admin()) with check (is_admin());

-- HARVEST RECORDS -----------------------------------------------------------
-- Suppliers read only their own rows for their linked estate; supervisors/admins
-- read/write; anyone signed-in may insert a weigh-in (supervisor capture).
create policy "harvest read own or staff" on harvest_records for select
  using (supplier_id = caller_uid() or is_admin());

create policy "harvest insert" on harvest_records for insert
  with check (caller_uid() is not null);

-- RESOURCE REQUESTS ---------------------------------------------------------
-- Suppliers create + read their own tickets; admins manage all (approve/reject).
create policy "requests read own or admin" on resource_requests for select
  using (supplier_id = caller_uid() or is_admin());

create policy "requests insert own" on resource_requests for insert
  with check (supplier_id = caller_uid());

create policy "requests admin update" on resource_requests for update
  using (is_admin()) with check (is_admin());
