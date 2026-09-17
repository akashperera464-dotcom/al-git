-- ============================================================================
-- KDU ERP · Full CRUD Tables — 11 entities
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → NEW query → Run. (Safe to re-run.)
-- ============================================================================

-- PAYROLL RUNS
create table if not exists payroll_runs (
  id uuid primary key default gen_random_uuid(),
  worker_name text not null,
  days integer not null default 0,
  daily_wage numeric(10,2) not null default 1700,
  ot_hours numeric(5,1) not null default 0,
  ot_pay numeric(10,2) not null default 0,
  incentive numeric(10,2) not null default 0,
  deductions numeric(10,2) not null default 0,
  net_pay numeric(10,2) not null default 0,
  period text default 'Current Month',
  created_at timestamptz not null default now()
);

-- LOANS
create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  worker_name text not null,
  loan_type text not null default 'Personal',
  principal numeric(12,2) not null default 0,
  balance numeric(12,2) not null default 0,
  monthly_deduction numeric(10,2) not null default 0,
  due_date date,
  status text not null default 'on-track',
  created_at timestamptz not null default now()
);

-- LOYALTY POINTS
create table if not exists loyalty_members (
  id uuid primary key default gen_random_uuid(),
  worker_name text not null,
  points integer not null default 0,
  tier text not null default 'Bronze',
  streak_days integer not null default 0,
  badge text default '',
  created_at timestamptz not null default now()
);

-- WELFARE
create table if not exists welfare_cases (
  id uuid primary key default gen_random_uuid(),
  case_type text not null default 'Clinic Visit',
  person_name text not null,
  detail text,
  status text not null default 'open',
  date date default current_date,
  created_at timestamptz not null default now()
);

-- FINANCE / LEDGER
create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  account text not null,
  entry_type text not null default 'Expense',
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

-- FERTILIZER STOCK
create table if not exists fertilizer_stock (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fert_type text,
  on_hand_kg numeric(10,2) not null default 0,
  reorder_kg numeric(10,2) not null default 0,
  cost_per_kg numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- AGROCHEMICAL STOCK
create table if not exists agrochemical_stock (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Herbicide',
  on_hand text,
  next_spray date,
  certified boolean not null default true,
  created_at timestamptz not null default now()
);

-- INVENTORY
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  qty text,
  location text,
  qr_tag text,
  created_at timestamptz not null default now()
);

-- VEHICLES
create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  reg text not null,
  vehicle_type text,
  driver text,
  km integer not null default 0,
  fuel_l numeric(8,1) not null default 0,
  last_service date,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

-- FACTORY BATCHES
create table if not exists factory_batches (
  id uuid primary key default gen_random_uuid(),
  grade_code text not null,
  grade_name text,
  output_kg numeric(10,2) not null default 0,
  price_per_kg numeric(10,2) not null default 0,
  green_leaf_in_kg numeric(10,2) not null default 0,
  waste_kg numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- CROP TASKS
create table if not exists crop_tasks (
  id uuid primary key default gen_random_uuid(),
  activity text not null,
  field text,
  due_date date,
  status text not null default 'scheduled',
  cycle text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ENABLE RLS + OPEN POLICIES FOR ALL + REAL-TIME
-- ============================================================================

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "open_write" on %I;', t);
    execute format('create policy "open_write" on %I for all using (true) with check (true);', t);
    -- Add to real-time publication (ignore if already a member)
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then
      null; -- already added, skip
    end;
  end loop;
end $$;
