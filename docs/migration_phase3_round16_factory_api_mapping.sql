-- Phase 3 Round 16 · Office leaf/lorry API code mapping
-- Safe for Supabase Free. No RLS/JWT bridge changes and no new tables.

alter table public.factories add column if not exists office_factory_code text;
alter table public.routes add column if not exists office_route_code text;
alter table public.users add column if not exists office_supplier_id text;

create unique index if not exists factories_office_factory_code_unique
  on public.factories (office_factory_code) where office_factory_code is not null;
create unique index if not exists routes_office_route_code_per_factory_unique
  on public.routes (factory_id, office_route_code) where office_route_code is not null;
create unique index if not exists users_office_supplier_per_route_unique
  on public.users (factory_id, route_id, office_supplier_id) where office_supplier_id is not null;

comment on column public.factories.office_factory_code is 'Factory code used by the office leaf API (for example 01).';
comment on column public.routes.office_route_code is 'Route code used by the office leaf API (for example 10).';
comment on column public.users.office_supplier_id is 'Supplier/card ID used by the office leaf API.';
