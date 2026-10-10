-- Phase 3 / Round 10: factories, routes, supplier registration, grade intake and lorry GPS
-- Run this entire file once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.factories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references public.factories(id) on delete cascade,
  route_name text not null,
  created_at timestamptz not null default now(),
  unique(factory_id, route_name)
);
alter table public.factories enable row level security;
alter table public.routes enable row level security;
drop policy if exists "factories_read" on public.factories;
drop policy if exists "routes_read" on public.routes;
create policy "factories_read" on public.factories for select using (true);
create policy "routes_read" on public.routes for select using (true);

alter table public.users add column if not exists supplier_no text;
alter table public.users add column if not exists factory_id uuid references public.factories(id);
alter table public.users add column if not exists route_id uuid references public.routes(id);
alter table public.users add column if not exists land_acreage numeric(12,3);
alter table public.users add column if not exists bush_count integer;
create unique index if not exists users_supplier_no_unique on public.users(supplier_no) where supplier_no is not null;
create index if not exists users_factory_route_idx on public.users(factory_id, route_id);
alter table public.users enable row level security;
drop policy if exists "users_supplier_self_registration" on public.users;
create policy "users_supplier_self_registration" on public.users for insert
with check (role::text = 'supplier' and status::text = 'pending_approval');

alter table public.harvest_records add column if not exists leaf_type text;
alter table public.harvest_records add column if not exists deduction_percentage numeric(5,2) not null default 0;
alter table public.harvest_records add column if not exists factory_id uuid references public.factories(id);
alter table public.harvest_records add column if not exists route_id uuid references public.routes(id);
create index if not exists harvest_records_factory_route_idx on public.harvest_records(factory_id, route_id, weighed_at desc);

create table if not exists public.lorry_locations (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null unique references public.routes(id) on delete cascade,
  driver_id text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision,
  updated_at timestamptz not null default now()
);
alter table public.lorry_locations enable row level security;
drop policy if exists "lorry_locations_read" on public.lorry_locations;
drop policy if exists "lorry_locations_write" on public.lorry_locations;
create policy "lorry_locations_read" on public.lorry_locations for select using (true);
create policy "lorry_locations_write" on public.lorry_locations for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table public.lorry_locations;
exception when duplicate_object then null;
end $$;

insert into public.factories(name) values
  ('Galpadihenna Tea Factory'),
  ('Kalawana Leaf Center'),
  ('Kuttapitiya Tea Factory'),
  ('Madampe Tea Factory'),
  ('Matuwagala Tea Factory'),
  ('Peak view Tea Factory')
on conflict (name) do nothing;

with route_seed(factory_name, route_name) as (values
  ('Galpadihenna Tea Factory','DEALERS'),('Galpadihenna Tea Factory','RANWALA'),('Galpadihenna Tea Factory','ANGAMMANA'),('Galpadihenna Tea Factory','GILMALE'),('Galpadihenna Tea Factory','EMBULDENIYA'),('Galpadihenna Tea Factory','MALWALA'),('Galpadihenna Tea Factory','OLUGALA'),('Galpadihenna Tea Factory','SODIYAMWATTA'),('Galpadihenna Tea Factory','GONAKUMBURA'),('Galpadihenna Tea Factory','BOPETTA'),('Galpadihenna Tea Factory','GALABODA'),('Galpadihenna Tea Factory','HIRILIYEDDA'),('Galpadihenna Tea Factory','HANDURUKANDA'),('Galpadihenna Tea Factory','SIRIPAGAMA'),('Galpadihenna Tea Factory','WEWELWATTA'),('Galpadihenna Tea Factory','LELLOPITYA'),('Galpadihenna Tea Factory','KALAWANA'),('Galpadihenna Tea Factory','DALUGGALA'),('Galpadihenna Tea Factory','DEIYANNEGAMA'),('Galpadihenna Tea Factory','KARAWITA'),('Galpadihenna Tea Factory','MIDELLANA'),('Galpadihenna Tea Factory','BALAWANA'),('Galpadihenna Tea Factory','DHAMBULUKANDA'),('Galpadihenna Tea Factory','GURUBEVILLAGAMA'),('Galpadihenna Tea Factory','MARSWATTA'),('Galpadihenna Tea Factory','OPATHA'),('Galpadihenna Tea Factory','OVALA'),('Galpadihenna Tea Factory','PANAGAMA'),('Galpadihenna Tea Factory','RATHGAMA'),('Galpadihenna Tea Factory','SL_NORAGALLA'),('Galpadihenna Tea Factory','FACTORY'),('Galpadihenna Tea Factory','MARAPANA'),('Galpadihenna Tea Factory','PANAWALA'),('Galpadihenna Tea Factory','SEETHAGALA'),('Galpadihenna Tea Factory','DOTHALUJOYA'),('Galpadihenna Tea Factory','JANAPADAYA'),('Galpadihenna Tea Factory','MANANAKANDA'),('Galpadihenna Tea Factory','SL_KURUNDUKOLANIYA'),('Galpadihenna Tea Factory','NILWALA'),('Galpadihenna Tea Factory','MADALAGAMA'),('Galpadihenna Tea Factory','BANDULAMALAYA'),('Galpadihenna Tea Factory','GTF_SUPER'),('Galpadihenna Tea Factory','KARAPINCHA'),('Galpadihenna Tea Factory','WEWELKOTHA'),('Galpadihenna Tea Factory','SUDAGALA'),
  ('Kalawana Leaf Center','BALAWATHUKANDA'),('Kalawana Leaf Center','KUDUMEERIYA'),('Kalawana Leaf Center','SL_KUKULEGAMA'),('Kalawana Leaf Center','SUDUWELIPOTHAHENA'),('Kalawana Leaf Center','DELGODA'),('Kalawana Leaf Center','WEDDAGALA'),('Kalawana Leaf Center','ILUMBAKANDA'),('Kalawana Leaf Center','KALAWANA LCC'),('Kalawana Leaf Center','WEWELKANDURA'),
  ('Kuttapitiya Tea Factory','DEALERS'),('Kuttapitiya Tea Factory','BAMBARALAKANDA'),('Kuttapitiya Tea Factory','BANAGODA'),('Kuttapitiya Tea Factory','BATEWELA'),('Kuttapitiya Tea Factory','HANDURUKANDA'),('Kuttapitiya Tea Factory','KARAWITA'),('Kuttapitiya Tea Factory','KIRIWANDALA'),('Kuttapitiya Tea Factory','KIRIWELDENIYA'),('Kuttapitiya Tea Factory','KT_ESTATE'),('Kuttapitiya Tea Factory','KUTTAPITIYA'),('Kuttapitiya Tea Factory','MADOLA'),('Kuttapitiya Tea Factory','MALMEEKANDA'),('Kuttapitiya Tea Factory','POLGASWATTA'),('Kuttapitiya Tea Factory','THORAKANDA'),('Kuttapitiya Tea Factory','THOTILAGAMA'),('Kuttapitiya Tea Factory','WARIGAMA'),('Kuttapitiya Tea Factory','WATHTHEPANGUWA'),
  ('Madampe Tea Factory','HORAMULA'),('Madampe Tea Factory','PANAPITIYA'),('Madampe Tea Factory','RAKWANA'),('Madampe Tea Factory','GALA HITIYA'),('Madampe Tea Factory','HALPAWALA'),('Madampe Tea Factory','OBADAKANDA'),('Madampe Tea Factory','MADAMPE'),('Madampe Tea Factory','DEALERS'),('Madampe Tea Factory','WELIGEPOLA'),('Madampe Tea Factory','GANGODA'),('Madampe Tea Factory','PILANA'),('Madampe Tea Factory','SAMARAKANDA'),('Madampe Tea Factory','POTHUPITIYA'),
  ('Matuwagala Tea Factory','BADUWATTA'),('Matuwagala Tea Factory','BOPETTA'),('Matuwagala Tea Factory','DEHIOWITA'),('Matuwagala Tea Factory','EPITAWALA'),('Matuwagala Tea Factory','FACTORY'),('Matuwagala Tea Factory','HINDURANGALA'),('Matuwagala Tea Factory','IDDAMALGODA'),('Matuwagala Tea Factory','KAVICHCHIKANDA'),('Matuwagala Tea Factory','MATUWAGALA'),('Matuwagala Tea Factory','MUDUNKOTUWA'),('Matuwagala Tea Factory','PANAWALA'),('Matuwagala Tea Factory','PIMBURA'),('Matuwagala Tea Factory','SL_AYAGAMA'),('Matuwagala Tea Factory','SL_GALATHURA'),('Matuwagala Tea Factory','THALAPITIYA'),
  ('Peak view Tea Factory','RAKWANA'),('Peak view Tea Factory','BATEWELA'),('Peak view Tea Factory','DIGANDALA'),('Peak view Tea Factory','BAMBARAKANDA'),('Peak view Tea Factory','MAPALANA'),('Peak view Tea Factory','WEWELWATTA SUPER'),('Peak view Tea Factory','PANNILA'),('Peak view Tea Factory','KURUWITA'),('Peak view Tea Factory','PALUGAMPOLA'),('Peak view Tea Factory','SANNASGAMA'),('Peak view Tea Factory','SL_MAKANDURA'),('Peak view Tea Factory','RIDEEWIWA'),('Peak view Tea Factory','BANAGODA'),('Peak view Tea Factory','PEAKVIEW'),('Peak view Tea Factory','PORONUWA'),('Peak view Tea Factory','WATHTHAHENA'),('Peak view Tea Factory','MIYANAWIWA'),('Peak view Tea Factory','PV_SUPER')
)
insert into public.routes(factory_id, route_name)
select f.id, s.route_name from route_seed s join public.factories f on f.name = s.factory_name
on conflict (factory_id, route_name) do nothing;

-- Allow the new registration state without changing the existing auth architecture.
do $$ begin
  if exists (select 1 from pg_type where typname = 'user_status') then
    alter type public.user_status add value if not exists 'pending_approval';
  end if;
end $$;
do $$ declare constraint_name text;
begin
  for constraint_name in select conname from pg_constraint where conrelid = 'public.users'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%' loop
    execute format('alter table public.users drop constraint %I', constraint_name);
  end loop;
end $$;
do $$ begin
  if not exists (
    select 1 from pg_attribute a join pg_type t on t.oid = a.atttypid
    where a.attrelid = 'public.users'::regclass and a.attname = 'status' and t.typname = 'user_status'
  ) then
    execute 'alter table public.users add constraint users_status_check check (status in (''active'',''suspended'',''pending_approval''))';
  end if;
end $$;

create table if not exists public.daily_tea_prices (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid references public.factories(id),
  price_date date not null,
  grade text not null,
  price_per_kg numeric(12,2) not null check (price_per_kg >= 0),
  created_at timestamptz not null default now()
);
alter table public.daily_tea_prices add column if not exists factory_id uuid references public.factories(id);
create unique index if not exists daily_tea_prices_global_unique on public.daily_tea_prices(price_date, grade) where factory_id is null;
alter table public.daily_tea_prices enable row level security;
drop policy if exists "daily_tea_prices_read" on public.daily_tea_prices;
drop policy if exists "daily_tea_prices_write" on public.daily_tea_prices;
create policy "daily_tea_prices_read" on public.daily_tea_prices for select using (true);
create policy "daily_tea_prices_write" on public.daily_tea_prices for all using (true) with check (true);

-- Add today's grade rates as immediately usable defaults. Admins can change them in the daily price screen.
insert into public.daily_tea_prices(price_date, grade, price_per_kg)
values
  (current_date, 'Standard', 1450),
  (current_date, 'Super', 1750),
  (current_date, 'PV Super', 1750),
  (current_date, 'Coarse', 1200)
on conflict do nothing;
