-- Run AFTER migration_security_helpers.sql and the existing application schema.
-- Transactional, repeatable; does not delete application records.
begin;
create table if not exists public.supplier_profiles (
  user_id text primary key references public.users(id) on delete cascade,
  name text not null default '', phone text not null default '',
  nic text not null default '', address text not null default '',
  emergency_contact text not null default '', photo_url text not null default '',
  notification_prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Old permissive policies OR together: adding a new one cannot close them.
-- Replace ALL policies on these tables, including policies from older rounds.
do $$
declare p record; t text;
begin
  foreach t in array array['users','farm_activities','alerts','estate_registration_requests',
    'supplier_profiles','supplier_fertilizer_ledger','fields','estates','divisions',
    'stock_items','stock_movements','supplier_fertilizer_loans','harvest_records'] loop
    if to_regclass('public.' || t) is null then
      raise exception 'Required table % is missing; apply the existing schema first', t;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

create policy users_read on public.users for select to authenticated
  using (public.app_role() is not null and
    (id = public.app_uid() or public.app_is_admin()
      or (public.app_role() = 'extension_officer' and lower(role::text) = 'supplier')));
create policy users_create on public.users for insert to authenticated
  with check (public.app_role() = 'super_admin'
    or (public.app_role() = 'admin' and lower(role::text) in ('supplier','extension_officer'))
    or (public.app_role() = 'extension_officer' and lower(role::text) = 'supplier'));
create policy users_update on public.users for update to authenticated
  using (public.app_role() = 'super_admin'
    or (public.app_role() = 'admin' and lower(role::text) in ('supplier','extension_officer')))
  with check (public.app_role() = 'super_admin'
    or (public.app_role() = 'admin' and lower(role::text) in ('supplier','extension_officer')));
create policy users_delete on public.users for delete to authenticated
  using (id <> public.app_uid() and (public.app_role() = 'super_admin'
    or (public.app_role() = 'admin' and lower(role::text) in ('supplier','extension_officer'))));

create policy farm_scoped on public.farm_activities for all to authenticated
  using (public.app_is_admin() or (public.app_role() = 'supplier' and user_id = public.app_uid()))
  with check (public.app_is_admin() or (public.app_role() = 'supplier' and user_id = public.app_uid()));
create policy alerts_scoped on public.alerts for all to authenticated
  using (public.app_is_admin() or (public.app_role() is not null and target_user_id = public.app_uid()))
  with check (public.app_is_admin() or (public.app_role() is not null and target_user_id = public.app_uid()));

create policy registration_read on public.estate_registration_requests for select to authenticated
  using (public.app_is_admin() or (public.app_role() = 'supplier' and supplier_id = public.app_uid()));
create policy registration_admin on public.estate_registration_requests for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy registration_insert on public.estate_registration_requests for insert to authenticated
  with check (public.app_role() = 'supplier' and supplier_id = public.app_uid()
    and status = 'PENDING' and reviewed_at is null and reviewed_by is null and coalesce(admin_notes, '') = '');
create policy registration_update on public.estate_registration_requests for update to authenticated
  using (public.app_role() = 'supplier' and supplier_id = public.app_uid() and status = 'PENDING')
  with check (public.app_role() = 'supplier' and supplier_id = public.app_uid()
    and status = 'PENDING' and reviewed_at is null and reviewed_by is null and coalesce(admin_notes, '') = '');

create policy profile_scoped on public.supplier_profiles for all to authenticated
  using (public.app_is_admin() or (public.app_role() = 'supplier' and user_id = public.app_uid()))
  with check (public.app_is_admin() or (public.app_role() = 'supplier' and user_id = public.app_uid()));
create policy ledger_read on public.supplier_fertilizer_ledger for select to authenticated
  using (public.app_is_admin() or (public.app_role() = 'supplier' and supplier_id = public.app_uid()));
create policy ledger_admin on public.supplier_fertilizer_ledger for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy loans_read on public.supplier_fertilizer_loans for select to authenticated
  using (public.app_is_admin() or (public.app_role() = 'supplier' and supplier_id = public.app_uid()));
create policy loans_admin on public.supplier_fertilizer_loans for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy harvest_read on public.harvest_records for select to authenticated
  using (public.app_is_admin() or public.app_role() = 'extension_officer'
    or (public.app_role() = 'supplier' and supplier_id = public.app_uid()));
create policy harvest_admin on public.harvest_records for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy harvest_capture on public.harvest_records for insert to authenticated
  with check (public.app_role() = 'extension_officer');
create policy stock_admin on public.stock_items for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy movements_admin on public.stock_movements for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

-- Field ownership is assigned during approval; suppliers cannot grant it to themselves.
create policy fields_read on public.fields for select to authenticated
  using (public.app_is_admin() or public.app_role() = 'extension_officer'
    or (public.app_role() = 'supplier' and supplier_id = public.app_uid()));
create policy fields_admin on public.fields for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy estates_read on public.estates for select to authenticated
  using (public.app_role() is not null);
create policy estates_admin on public.estates for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy divisions_read on public.divisions for select to authenticated
  using (public.app_role() is not null);
create policy divisions_admin on public.divisions for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['supplier_profiles','supplier_fertilizer_ledger','farm_activities','fields','alerts'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                     and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
-- One transaction for stock deduction, movement history and supplier ledger.
-- Historical entries retain NULL prices rather than inventing an amount.
alter table public.supplier_fertilizer_ledger add column if not exists unit_price numeric(12,2);
alter table public.stock_movements
  add column if not exists route text,
  add column if not exists unit_price_at_txn numeric(12,2),
  add column if not exists issue_note_code text,
  add column if not exists supplier_no text;
create or replace function public.issue_supplier_fertilizer(
  p_item_id uuid, p_supplier_name text, p_quantity numeric, p_payment_mode text,
  p_details jsonb default '{}'::jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare item public.stock_items%rowtype; supplier_uid text; supplier_count integer;
begin
  if not public.app_is_admin() then raise exception 'Administrator access required'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Quantity must be a positive finite number';
  end if;
  if p_payment_mode is null or p_payment_mode not in ('cash','credit') then raise exception 'Invalid payment mode'; end if;
  select count(*), min(u.id) into supplier_count, supplier_uid from public.users u
    where lower(u.name) = lower(trim(p_supplier_name)) and lower(u.role::text) = 'supplier' and u.status::text = 'active';
  if supplier_count <> 1 then raise exception 'Supplier name must match exactly one active supplier'; end if;
  select * into item from public.stock_items where id = p_item_id for update;
  if not found or item.category::text <> 'fertilizer' then raise exception 'Fertilizer item not found'; end if;
  if item.qty_on_hand < p_quantity then raise exception 'Insufficient stock'; end if;
  update public.stock_items set qty_on_hand = qty_on_hand - p_quantity where id = p_item_id;
  insert into public.stock_movements(stock_item_id,move_type,qty,unit_cost,performed_by,notes,
    route,unit_price_at_txn,issue_note_code,supplier_no)
  values(p_item_id,'out',p_quantity,item.unit_cost,public.app_uid(),p_details->>'notes',
    p_details->>'route',item.unit_cost,p_details->>'issue_note_code',p_details->>'supplier_no');
  insert into public.supplier_fertilizer_ledger(supplier_id,supplier_name,stock_item_id,
    stock_item_code,stock_item_name,qty_issued,unit,payment_mode,division,issue_date,notes,unit_price)
  values(supplier_uid,p_supplier_name,p_item_id,item.code,item.name,p_quantity,item.unit,
    p_payment_mode,p_details->>'division',now(),p_details->>'notes',item.unit_cost);
end $$;
revoke all on function public.issue_supplier_fertilizer(uuid,text,numeric,text,jsonb) from public;
grant execute on function public.issue_supplier_fertilizer(uuid,text,numeric,text,jsonb) to authenticated;
commit;
