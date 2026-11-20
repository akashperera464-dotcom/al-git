-- KDU EMS · Smart supplier advances / tea packets / fertilizer requests
-- Supabase Free-plan compatible. Safe to re-run.
-- Run once in Supabase Dashboard → SQL Editor after taking a backup.

create extension if not exists pgcrypto;

create table if not exists public.settings (
  key text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.settings(key,data)
values (
  'supplier_request_policy',
  '{
    "enabled": true,
    "baseRatePerKg": 150,
    "advancePercentage": 0.5,
    "maxAdvanceAmount": 50000,
    "teaPackets": [
      {"code":"TEA-500G","label":"Tea packet · 500g","unit":"packets","maxQuantity":10},
      {"code":"TEA-1KG","label":"Tea packet · 1kg","unit":"packets","maxQuantity":5}
    ],
    "fertilizers": [
      {"code":"U709","label":"U709","unit":"bags","maxQuantity":5},
      {"code":"T65","label":"T65","unit":"bags","maxQuantity":5}
    ]
  }'::jsonb
)
on conflict(key) do nothing;

-- Keep the pre-login branding row compatible with the current app, but do not
-- let the anon browser alter the financial eligibility policy. Policy changes
-- go through the Firebase-authenticated Vercel admin endpoint (service role).
alter table public.settings enable row level security;
drop policy if exists "settings public read" on public.settings;
drop policy if exists "settings admin write" on public.settings;
drop policy if exists "settings open write" on public.settings;
drop policy if exists "settings branding insert" on public.settings;
drop policy if exists "settings branding update" on public.settings;
create policy "settings public read" on public.settings
  for select to anon,authenticated using(true);
create policy "settings branding insert" on public.settings
  for insert to anon,authenticated with check(key='branding');
create policy "settings branding update" on public.settings
  for update to anon,authenticated using(key='branding') with check(key='branding');
grant select,insert,update on public.settings to anon,authenticated;

create table if not exists public.supplier_service_requests (
  id uuid primary key default gen_random_uuid(),
  supplier_id text not null references public.users(id) on delete cascade,
  supplier_name text not null,
  supplier_no text,
  estate_id uuid references public.estates(id) on delete set null,
  request_type text not null check(request_type in ('cash_advance','tea_packet','fertilizer')),
  item_code text,
  item_label text,
  quantity numeric(12,2),
  unit text,
  requested_amount numeric(14,2) not null default 0,
  payment_method text check(payment_method is null or payment_method in ('bank_transfer','cash','lorry')),
  bank_name text,
  bank_branch text,
  account_name text,
  account_number text,
  note text,
  status text not null default 'pending' check(status in ('pending','approved','rejected','fulfilled')),
  admin_note text,
  monthly_kg_snapshot numeric(14,2) not null default 0,
  office_deduction_snapshot numeric(14,2) not null default 0,
  committed_advance_snapshot numeric(14,2) not null default 0,
  base_rate_snapshot numeric(14,2) not null default 0,
  advance_percentage_snapshot numeric(8,6) not null default 0,
  eligible_limit_snapshot numeric(14,2) not null default 0,
  office_fetched_at timestamptz not null,
  requested_at timestamptz not null default now(),
  reviewed_by text references public.users(id) on delete set null,
  reviewed_at timestamptz,
  fulfilled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint service_request_shape check (
    (request_type='cash_advance' and requested_amount > 0 and quantity is null and payment_method is not null)
    or
    (request_type in ('tea_packet','fertilizer') and requested_amount = 0 and quantity > 0 and item_code is not null)
  )
);

alter table public.supplier_service_requests
  add column if not exists bank_name text,
  add column if not exists bank_branch text,
  add column if not exists account_name text,
  add column if not exists account_number text;

create index if not exists supplier_service_requests_owner_idx
  on public.supplier_service_requests(supplier_id,requested_at desc);
create index if not exists supplier_service_requests_admin_idx
  on public.supplier_service_requests(status,request_type,requested_at desc);

-- Realtime carries only a safe status signal. Financial snapshots and amounts
-- stay server-only in supplier_service_requests.
create table if not exists public.supplier_service_request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  supplier_id text not null,
  status text not null,
  changed_at timestamptz not null default now()
);
create index if not exists supplier_service_request_events_owner_idx
  on public.supplier_service_request_events(supplier_id,changed_at desc);

create or replace function public.touch_supplier_service_request()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_touch_supplier_service_request on public.supplier_service_requests;
create trigger trg_touch_supplier_service_request
before update on public.supplier_service_requests
for each row execute function public.touch_supplier_service_request();

create or replace function public.emit_supplier_service_request_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' or new.status is distinct from old.status then
    insert into public.supplier_service_request_events(request_id,supplier_id,status)
    values(new.id,new.supplier_id,new.status);
  end if;
  delete from public.supplier_service_request_events
  where changed_at < now() - interval '30 days';
  return new;
end $$;

drop trigger if exists trg_emit_supplier_service_request_event on public.supplier_service_requests;
create trigger trg_emit_supplier_service_request_event
after insert or update of status on public.supplier_service_requests
for each row execute function public.emit_supplier_service_request_event();

-- Atomic final eligibility check + insert. The Vercel server computes the
-- Office snapshot, while this transaction prevents two concurrent cash
-- requests from both spending the same remaining limit.
create or replace function public.create_supplier_service_request(
  p_supplier_id text,
  p_supplier_name text,
  p_supplier_no text,
  p_estate_id uuid,
  p_request_type text,
  p_item_code text,
  p_item_label text,
  p_quantity numeric,
  p_unit text,
  p_requested_amount numeric,
  p_payment_method text,
  p_bank_name text,
  p_bank_branch text,
  p_account_name text,
  p_account_number text,
  p_note text,
  p_monthly_kg numeric,
  p_office_deductions numeric,
  p_total_cash_ceiling numeric,
  p_base_rate numeric,
  p_advance_percentage numeric,
  p_office_fetched_at timestamptz
)
returns setof public.supplier_service_requests
language plpgsql
security definer
set search_path=public
as $$
declare
  v_committed numeric(14,2) := 0;
  v_remaining numeric(14,2) := 0;
  v_row public.supplier_service_requests%rowtype;
begin
  if p_request_type not in ('cash_advance','tea_packet','fertilizer') then
    raise exception 'INVALID_REQUEST_TYPE';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_supplier_id || ':' || to_char(current_date,'YYYY-MM')));
  select coalesce(sum(requested_amount),0) into v_committed
  from public.supplier_service_requests
  where supplier_id=p_supplier_id
    and request_type='cash_advance'
    and status in ('pending','approved')
    and requested_at >= date_trunc('month',now());

  v_remaining := greatest(0,coalesce(p_total_cash_ceiling,0)-v_committed);
  if p_request_type='cash_advance' and (coalesce(p_requested_amount,0)<=0 or p_requested_amount>v_remaining) then
    raise exception 'ELIGIBLE_LIMIT_EXCEEDED';
  end if;

  insert into public.supplier_service_requests(
    supplier_id,supplier_name,supplier_no,estate_id,request_type,item_code,item_label,
    quantity,unit,requested_amount,payment_method,bank_name,bank_branch,account_name,account_number,note,status,monthly_kg_snapshot,
    office_deduction_snapshot,committed_advance_snapshot,base_rate_snapshot,
    advance_percentage_snapshot,eligible_limit_snapshot,office_fetched_at
  ) values (
    p_supplier_id,p_supplier_name,p_supplier_no,p_estate_id,p_request_type,p_item_code,p_item_label,
    p_quantity,p_unit,coalesce(p_requested_amount,0),p_payment_method,p_bank_name,p_bank_branch,p_account_name,p_account_number,nullif(p_note,''),'pending',p_monthly_kg,
    p_office_deductions,v_committed,p_base_rate,p_advance_percentage,v_remaining,p_office_fetched_at
  ) returning * into v_row;
  return next v_row;
end $$;

-- The financial ledger is available only through the authenticated Vercel
-- gateway. The anon client receives a status-only Realtime signal.
alter table public.supplier_service_requests disable row level security;
revoke all on public.supplier_service_requests from anon,authenticated;
alter table public.supplier_service_request_events disable row level security;
revoke all on public.supplier_service_request_events from anon,authenticated;
grant select on public.supplier_service_request_events to anon,authenticated;
revoke all on function public.create_supplier_service_request(
  text,text,text,uuid,text,text,text,numeric,text,numeric,text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,timestamptz
) from public,anon,authenticated;
grant execute on function public.create_supplier_service_request(
  text,text,text,uuid,text,text,text,numeric,text,numeric,text,text,text,text,text,text,numeric,numeric,numeric,numeric,numeric,timestamptz
) to service_role;

do $$
begin
  alter publication supabase_realtime add table public.supplier_service_request_events;
exception when duplicate_object then null;
end $$;

-- Verification
select key,data from public.settings where key='supplier_request_policy';
select to_regclass('public.supplier_service_requests') as request_ledger,
       to_regclass('public.supplier_service_request_events') as realtime_events;
