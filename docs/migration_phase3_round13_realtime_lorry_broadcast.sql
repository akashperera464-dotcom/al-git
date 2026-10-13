-- ============================================================================
-- KDU EMS · Phase 3 Round 13 · Private zero-write lorry Broadcast authorization
-- Run after migration_phase3_round12_production_hardening.sql.
-- GPS messages are ephemeral WebSocket Broadcasts; this migration creates no
-- location table, column, trigger or per-location database write.
-- ============================================================================

drop policy if exists "route tracking receive" on realtime.messages;
drop policy if exists "route tracking broadcast" on realtime.messages;

-- Supplier: assigned route only. Collector: today's assigned route only.
-- Administrators may observe a route for operational support.
create policy "route tracking receive"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() ~ '^route-tracking:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  and (
    public.app_role() in ('admin','super_admin')
    or exists (
      select 1 from public.users u
      where u.id = public.app_uid()
        and u.deactivated_at is null
        and u.status::text = 'active'
        and u.role::text = 'supplier'
        and u.route_id::text = split_part(realtime.topic(), ':', 2)
    )
    or exists (
      select 1 from public.collector_route_assignments a
      where a.collector_id = public.app_uid()
        and a.assignment_date = current_date
        and a.status in ('assigned','started')
        and a.route_id::text = split_part(realtime.topic(), ':', 2)
    )
  )
);

-- Only the collector whose route is actively started may publish GPS data.
create policy "route tracking broadcast"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and realtime.topic() ~ '^route-tracking:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  and public.app_role() = 'extension_officer'
  and exists (
    select 1 from public.collector_route_assignments a
    where a.collector_id = public.app_uid()
      and a.assignment_date = current_date
      and a.status = 'started'
      and a.route_id::text = split_part(realtime.topic(), ':', 2)
  )
);

insert into public.schema_migrations(version,filename,applied_by)
values('round_13','migration_phase3_round13_realtime_lorry_broadcast.sql',public.app_uid())
on conflict(version) do update
set filename=excluded.filename,applied_at=now(),applied_by=excluded.applied_by;

-- Verification:
-- select policyname,cmd,roles,qual,with_check from pg_policies
-- where schemaname='realtime' and tablename='messages'
-- order by policyname;
-- select * from public.schema_migrations where version='round_13';
