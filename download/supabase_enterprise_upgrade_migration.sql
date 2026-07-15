-- ============================================================================
-- Verda ERP · Enterprise Upgrade Migration — All audit gaps
-- ----------------------------------------------------------------------------
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================================

-- 1 · DAILY TEA PRICES (admin sets, supplier reads)
create table if not exists daily_tea_prices (
  id              uuid primary key default gen_random_uuid(),
  price_date      date not null default current_date,
  estate_id       uuid references estates(id) on delete set null,
  grade           text not null, -- Super | Standard | Coarse
  price_per_kg    numeric(10,2) not null default 0,
  set_by          text,
  created_at      timestamptz not null default now(),
  unique(price_date, estate_id, grade)
);
create index if not exists idx_dtp_date on daily_tea_prices(price_date desc);

-- 2 · SUPPLIER SETTLEMENTS (monthly payout = earnings − all deductions)
create table if not exists supplier_settlements (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     text not null,
  supplier_name   text,
  estate_id       uuid references estates(id) on delete set null,
  period_month    integer not null,
  period_year     integer not null,
  gross_earnings  numeric(14,2) not null default 0,
  water_deduction numeric(14,2) not null default 0,
  coarse_deduction numeric(14,2) not null default 0,
  loan_deduction  numeric(14,2) not null default 0,
  tea_packet_deduction numeric(14,2) not null default 0,
  other_deductions numeric(14,2) not null default 0,
  net_payable     numeric(14,2) not null default 0,
  status          text not null default 'draft', -- draft | finalized | paid
  paid_at         timestamptz,
  bank_reference  text,
  version         integer not null default 1,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ss_supplier on supplier_settlements(supplier_id);
create unique index if not exists idx_ss_period on supplier_settlements(supplier_id, period_year, period_month);

-- 3 · SOIL TESTS (field-level pH/NPK tracking)
create table if not exists soil_tests (
  id              uuid primary key default gen_random_uuid(),
  field_id        uuid references fields(id) on delete set null,
  estate_id       uuid references estates(id) on delete set null,
  test_date       date not null default current_date,
  ph              numeric(4,2),
  nitrogen_ppm    numeric(8,2),
  phosphorus_ppm  numeric(8,2),
  potassium_ppm   numeric(8,2),
  organic_matter_pct numeric(5,2),
  tested_by       text,
  photo_url       text,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_st_field on soil_tests(field_id);
create index if not exists idx_st_date on soil_tests(test_date desc);

-- 4 · DISEASE REPORTS (leaf disease with photo)
create table if not exists disease_reports (
  id              uuid primary key default gen_random_uuid(),
  field_id        uuid references fields(id) on delete set null,
  estate_id       uuid references estates(id) on delete set null,
  disease_type    text not null, -- blister_blight | red_rust | helopeltis | shot_hole | others
  severity        text not null default 'low', -- low | medium | high | critical
  photo_url       text,
  reported_by     text,
  reported_at     timestamptz not null default now(),
  status          text not null default 'open', -- open | treating | resolved
  treatment_notes text,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_dr_field on disease_reports(field_id);
create index if not exists idx_dr_status on disease_reports(status);

-- 5 · SITE VISITS (GPS-tagged officer farm visits)
create table if not exists site_visits (
  id              uuid primary key default gen_random_uuid(),
  officer_uid     text not null,
  supplier_id     text,
  estate_id       uuid references estates(id) on delete set null,
  visit_date      date not null default current_date,
  latitude        numeric(10,7),
  longitude       numeric(10,7),
  notes           text,
  photo_url       text,
  follow_up_date  date,
  created_at      timestamptz not null default now()
);
create index if not exists idx_sv_officer on site_visits(officer_uid);
create index if not exists idx_sv_date on site_visits(visit_date desc);

-- 6 · BUDGETS (monthly budget per GL account)
create table if not exists budgets (
  id              uuid primary key default gen_random_uuid(),
  gl_account_id   uuid references gl_accounts(id) on delete cascade,
  estate_id       uuid references estates(id) on delete set null,
  period_month    integer not null,
  period_year     integer not null,
  budgeted_amount numeric(14,2) not null default 0,
  created_at      timestamptz not null default now(),
  unique(gl_account_id, period_year, period_month)
);
create index if not exists idx_budget_period on budgets(period_year, period_month);

-- 7 · SHIFTS + WORKER SHIFTS (factory shift planning)
create table if not exists shifts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null, -- Morning | Evening | Night
  start_time      time not null,
  end_time        time not null,
  factory_stage   text, -- withering | rolling | etc
  created_at      timestamptz not null default now()
);
create table if not exists worker_shifts (
  id              uuid primary key default gen_random_uuid(),
  worker_id       uuid not null references workers(id) on delete cascade,
  shift_id        uuid not null references shifts(id) on delete cascade,
  shift_date      date not null default current_date,
  actual_check_in timestamptz,
  actual_check_out timestamptz,
  status          text not null default 'scheduled', -- scheduled | present | absent | late
  notes           text,
  created_at      timestamptz not null default now(),
  unique(worker_id, shift_id, shift_date)
);
create index if not exists idx_ws_date on worker_shifts(shift_date);

-- 8 · MACHINE DOWNTIME (factory equipment breakdowns)
create table if not exists machine_downtime (
  id              uuid primary key default gen_random_uuid(),
  machine_name    text not null,
  batch_id        uuid references factory_batches(id) on delete set null,
  stage           text, -- withering | rolling | etc
  start_time      timestamptz not null default now(),
  end_time        timestamptz,
  duration_min    integer,
  reason          text, -- mechanical | electrical | cleaning | maintenance | other
  impact_notes    text,
  reported_by     text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_md_machine on machine_downtime(machine_name);
create index if not exists idx_md_start on machine_downtime(start_time desc);

-- 9 · TAX CALCULATIONS (VAT 15% + NBT 2% for Sri Lanka)
create table if not exists tax_calculations (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      text not null, -- sales_invoices.id or auction_batches.id
  invoice_type    text not null, -- sales | auction
  tax_type        text not null, -- vat | nbt
  taxable_amount  numeric(14,2) not null default 0,
  rate_pct        numeric(5,2) not null default 0,
  tax_amount      numeric(14,2) not null default 0,
  period_month    integer,
  period_year     integer,
  created_at      timestamptz not null default now()
);
create index if not exists idx_tax_period on tax_calculations(period_year, period_month);

-- 10 · TEA BOARD RETURNS (annual compliance export)
create table if not exists tea_board_returns (
  id              uuid primary key default gen_random_uuid(),
  return_year     integer not null,
  estate_id       uuid references estates(id) on delete set null,
  green_leaf_kg   numeric(14,2) not null default 0,
  made_tea_kg     numeric(14,2) not null default 0,
  sales_by_grade  jsonb not null default '{}',
  worker_count    integer not null default 0,
  epf_remitted    numeric(14,2) not null default 0,
  etf_remitted    numeric(14,2) not null default 0,
  status          text not null default 'draft', -- draft | submitted
  created_at      timestamptz not null default now(),
  unique(return_year, estate_id)
);

-- 11 · MULTI-TRIP COUNTER on harvest_records
alter table harvest_records add column if not exists trip_number integer not null default 1;
alter table harvest_records add column if not exists leaf_photo_url text;

-- 12 · DATA VALIDATION — CHECK constraints (use DO block — PG doesn't support IF NOT EXISTS on constraints)
do $$
begin
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'chk_gross_positive' and table_name = 'harvest_records') then
    alter table harvest_records add constraint chk_gross_positive check (gross_kg >= 0);
  end if;
  if not exists (select 1 from information_schema.table_constraints where constraint_name = 'chk_net_le_gross' and table_name = 'harvest_records') then
    alter table harvest_records add constraint chk_net_le_gross check (net_kg <= gross_kg);
  end if;
end $$;

-- 13 · RLS for all new tables
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "open_write" on %I;', t);
    execute format('create policy "open_write" on %I for all using (true) with check (true);', t);
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- 14 · SEED: daily tea prices for today
insert into daily_tea_prices (price_date, grade, price_per_kg) values
  (current_date, 'Super', 1100),
  (current_date, 'Standard', 950),
  (current_date, 'Coarse', 750)
on conflict do nothing;

-- 15 · SEED: shifts
insert into shifts (name, start_time, end_time, factory_stage) values
  ('Morning', '06:00', '14:00', null),
  ('Evening', '14:00', '22:00', null),
  ('Night', '22:00', '06:00', null)
on conflict do nothing;

-- DONE
