-- ============================================================================
-- KDU ERP · Workers table — Full CRUD for labor management
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → NEW query → Run. (Safe to re-run.)
-- ============================================================================

create table if not exists workers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  nic           text,
  division      text,
  role          text not null default 'Field Worker',
  bank_account  text,
  estate_id     uuid references estates(id) on delete set null,
  phone         text,
  points_balance integer not null default 0,
  attendance_30d integer not null default 0,
  avg_kg_per_day numeric(8,2) not null default 0,
  present       boolean not null default false,
  status        text not null default 'active',
  created_at    timestamptz not null default now()
);
create index if not exists idx_workers_estate on workers(estate_id);

-- RLS: open (client RBAC gates the admin UI)
alter table workers enable row level security;
drop policy if exists "workers open write" on workers;
create policy "workers open write" on workers for all using (true) with check (true);

-- Enable real-time
alter publication supabase_realtime add table workers;

-- Seed data (optional — matches the mock workers in the app)
insert into workers (name, nic, division, role, bank_account, points_balance, attendance_30d, avg_kg_per_day, present)
values
  ('K. Maheshwaran', '199032501234', 'Sutton', 'Plucker', 'BOA-8842110', 1240, 27, 22.4, true),
  ('P. Saraswathi', '198854103287', 'Craighead', 'Plucker', 'BOA-1190233', 2110, 29, 24.8, true),
  ('T. Ramesh', '199512098871', 'Tennant', 'Field Worker', 'COM-5520194', 640, 24, 0, true),
  ('L. Priya', '199722057712', 'Sutton', 'Plucker', 'BOA-3390120', 980, 26, 19.6, false),
  ('D. Anand', '198971145096', 'Craighead', 'Sprayer', 'HNB-7782001', 420, 22, 0, true),
  ('S. Kamala', '199339871002', 'Tennant', 'Plucker', 'BOA-9912847', 1750, 28, 23.1, true),
  ('V. Suresh', '200011849503', 'Craighead', 'Factory Hand', 'COM-1102938', 530, 25, 0, true),
  ('M. Lakshmi', '198619003425', 'Sutton', 'Kangany', 'BOA-6620194', 2380, 30, 0, true)
on conflict do nothing;
