-- ============================================================================
-- Verda ERP · Resource Request Fulfillment Migration
-- ----------------------------------------------------------------------------
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================================

-- 1 · Extend resource_requests with fulfillment tracking
alter table resource_requests add column if not exists fulfillment_status text not null default 'pending';
-- pending | approved | fulfilled | completed | rejected
alter table resource_requests add column if not exists stock_item_id uuid;
alter table resource_requests add column if not exists fulfilled_at timestamptz;
alter table resource_requests add column if not exists fulfilled_by text;
alter table resource_requests add column if not exists completed_at timestamptz;
alter table resource_requests add column if not exists on_credit boolean not null default false;
alter table resource_requests add column if not exists loan_id uuid;

-- 2 · Worker assignments table (tracks which workers were assigned to which request)
create table if not exists worker_assignments (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid references resource_requests(id) on delete cascade,
  worker_id       uuid not null references workers(id) on delete cascade,
  worker_name     text,
  supplier_id     text,
  supplier_name   text,
  assigned_date   date not null default current_date,
  expected_return date,
  actual_return   date,
  status          text not null default 'assigned', -- assigned | returned
  assigned_by     text,
  returned_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_wa_request on worker_assignments(request_id);
create index if not exists idx_wa_worker on worker_assignments(worker_id);
create index if not exists idx_wa_status on worker_assignments(status);

-- 3 · RLS + triggers
do $$
declare t text;
begin
  for t in select unnest(array['worker_assignments']) loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "open_write" on %I;', t);
    execute format('create policy "open_write" on %I for all using (true) with check (true);', t);
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- DONE
