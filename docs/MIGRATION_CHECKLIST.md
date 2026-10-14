# Database Migration Checklist

The production database remains Supabase PostgreSQL. Apply migrations in order and take a backup before every production change.

> **Current production architecture (Supabase Free plan):** Firebase Email/Password is authentication-only. The Supabase browser client uses the anon key and does not forward Firebase JWTs. Firebase Third-Party Auth must remain disabled. The production database currently uses disabled/permissive RLS with client-side `RouteGuard`/RBAC. The older Round 12/13 JWT/RLS instructions below are historical and are explicitly superseded; do not re-enable them on this project.

## Ordered baseline

1. `supabase_schema.sql`
2. `migration_email_auth.sql`, `migration_branding.sql`, `migration_announcements.sql`, `migration_alerts_and_fcm.sql`
3. `migration_farm_activities.sql`, `migration_maps_and_locations.sql`, `migration_workers.sql`, `migration_full_crud.sql`
4. `migration_phase1_sir_spec.sql`, `migration_phase1_round3.sql`
5. `migration_phase2_round4.sql`
6. `migration_phase3_round5.sql` through `migration_phase3_round9.sql`
7. `migration_phase3_round10.sql`
8. `migration_phase3_round11_unified_estates.sql`
9. `migration_phase3_round12_lorry_tracking_hardening.sql` (safe prerequisite/compatibility patch)
10. `migration_phase3_round12_production_hardening.sql` — historical only; do **not** rerun its JWT-dependent RLS section on the Free-plan project
11. `migration_phase3_round13_realtime_lorry_broadcast.sql` — historical policy file; current lorry Broadcast uses public anon channels and zero GPS database writes
12. `migration_phase3_round14_multi_route_users.sql`
13. `migration_phase3_round15_connected_operations.sql`

## Before deployment

```sql
select count(*) as factories from public.factories;
select count(*) as routes from public.routes;
select count(*) as routes_without_code from public.routes where route_code is null;
select factory_id,supplier_no,count(*) from public.users where supplier_no is not null group by 1,2 having count(*)>1;
select client_record_id,device_id,count(*) from public.harvest_records where client_record_id is not null group by 1,2 having count(*)>1;
```

Backup from a trusted administrator machine (replace the connection string; never commit it):

```bash
pg_dump --format=custom --no-owner "$SUPABASE_DB_URL" --file verda-before-round12.dump
```

## Apply and verify Round 12

Paste `docs/migration_phase3_round12_production_hardening.sql` into Supabase SQL Editor, run it, then run:

```sql
select * from public.schema_migrations where version='round_12';
select route_code,count(*) from public.routes group by route_code having count(*)>1;
select tablename,policyname,roles,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname;
```

## Authentication / access warning

Do not enable Supabase Firebase Third-Party Auth and do not add an `accessToken` callback to `src/lib/supabase.ts`. Those steps produced HTTP 401 for every REST request on this Free-plan deployment. Client-side RBAC is an application safety boundary, not database-grade tenant isolation; stronger isolation in future requires a separately approved server gateway that verifies Firebase tokens and holds the service-role key outside the browser.

## Apply and verify Round 13 — private lorry Broadcast

1. Paste `docs/migration_phase3_round13_realtime_lorry_broadcast.sql` into Supabase SQL Editor and run it after Round 12.
2. Keep the current Free-plan Realtime configuration used by commit `1396546`: public Broadcast channel, no Firebase token, and no `private:true`. Route UUID topic separation is functional isolation, not a cryptographic authorization boundary.
4. Deploy the AI advisory Edge Function and store a newly rotated OpenRouter key as a Supabase secret. Never add this secret to `.env`, Vercel variables, or source control:

```bash
supabase functions deploy openrouter-advisory
supabase secrets set OPENROUTER_API_KEY=replace_with_a_new_rotated_key
```

The key shown in a chat or issue must be treated as compromised and revoked in OpenRouter before creating the replacement. The browser receives only the advisory response; it never receives the OpenRouter key. The Edge Function sends only distance, ETA and generic tea-collection context to OpenRouter—no coordinates, names, Firebase UID or other personal data.

Verify the migration:

```sql
select * from public.schema_migrations where version='round_13';
select policyname,cmd,roles,qual,with_check
from pg_policies
where schemaname='realtime' and tablename='messages'
order by policyname;
```

Then run the live isolation test with two different routes:

- Start today's collector assignment, open its collector screen and press **Start Live GPS**.
- A supplier assigned to that exact route receives moving coordinates.
- A supplier assigned to another route receives no coordinates.
- Stop tracking and confirm the supplier receives the stop signal.
- Query `lorry_locations` before and after several minutes. Its row count and timestamps must remain unchanged; Round 13 never writes coordinates to PostgreSQL.

Because Broadcast payloads are ephemeral, reloading the supplier page intentionally shows “waiting” until the collector's next GPS broadcast. Historical trip playback is not part of this zero-write mode.

## Apply and verify Round 14 — multi-route users

Paste `docs/migration_phase3_round14_multi_route_users.sql` into Supabase SQL Editor after Round 13. It creates one normalized junction table and keeps `users.route_id` as the backwards-compatible primary route. Existing primary routes and existing supplier-estate routes are backfilled automatically.

```sql
select * from public.schema_migrations where version='round_14';
select u.name,u.role,ura.is_primary,r.route_code,r.route_name
from public.user_route_assignments ura
join public.users u on u.id=ura.user_id
join public.routes r on r.id=ura.route_id
order by u.name,ura.is_primary desc,r.route_name;

select user_id,count(*) filter(where is_primary) as primary_count,count(*) as route_count
from public.user_route_assignments
group by user_id
having count(*) filter(where is_primary)<>1;
```

Post-deployment live checks:

- Register a supplier with two routes and approve the account; both routes must appear in User Management, My Estates and My Lorry Map.
- Create one estate on each authorized route; attempting an unauthorized route must be rejected by PostgreSQL.
- Give a collector two authorized routes. Admin may assign either route on different days, but only one daily assignment remains possible.
- Start today's collector route and confirm suppliers on that route receive Broadcast GPS while suppliers on the collector's other authorized route do not.
- Confirm that the first selected route remains in `users.route_id` as the primary compatibility value.

## Apply and verify Round 15 — connected operations

> **Live database safety:** use the current version of the Round 15 file. The
> October 14 initial revision recreated audit triggers across several live
> tables and could deadlock with an in-flight collector/harvest request. The
> corrected migration never drops production audit triggers and only installs
> missing old/new snapshot triggers on the new Round 15 workflow tables. If
> PostgreSQL reports `40P01`, wait for the failed transaction to roll back,
> refresh this file from `main`, and rerun the complete corrected migration.

1. Take a Supabase Dashboard backup/export first.
2. Paste `docs/migration_phase3_round15_connected_operations.sql` into the SQL Editor and run it once.
3. This migration uses only features available on Supabase Free: ordinary PostgreSQL tables/columns/triggers, Storage, and the existing anon client. It does not use Third-Party Auth, JWT claims, Edge Functions, or Pro-only features.
4. Refresh the installed PWA after the SQL succeeds.

```sql
select * from public.schema_migrations where version='round_15';
select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='request_type' order by enumsortorder;
select delivery_receipt_no,collector_id,lorry_plate,record_status from public.harvest_records order by created_at desc limit 5;
select request_type,status,count(*) from public.operational_requests group by 1,2 order by 1,2;
select assignment_id,stop_order,supplier_id,estate_id,status from public.collection_route_stops order by assignment_id,stop_order limit 20;
select period_month,factory_id,status from public.month_end_closures order by period_month desc;
```

Live checks:

- Supplier Resource Requests always shows Equipment, Fertilizer, and Agrochemical, even when stock is zero.
- Collector opens today's assignment, sees ordered stops, selects the exact supplier estate, records GPS verification/photo/signature, then receives a digital receipt number.
- Supplier sees that receipt and may download the monthly PDF or submit a weight dispute.
- Admin Operations Center sees disputes/support/profile/route requests, duplicates, reconciliation, health events, device sessions, and CSV/PDF reports.
- On an iPhone installed PWA, focus a login input, sign in, and confirm the authenticated shell remains at normal scale.

## Rollback

Restore the pre-deployment dump for a full rollback. For an application-only rollback, deploy the previous Git commit while leaving additive columns/tables in place. To roll back only Round 13, remove the two named policies on `realtime.messages`, restore the previous frontend commit and re-enable public access only if an older public-channel feature explicitly requires it. Round 14 is additive; an application rollback may retain `user_route_assignments`, while `users.route_id` continues to identify the primary route. Do not drop the junction table after secondary routes are in production use. Do not drop `client_record_id`, route codes, assignment history or audit rows after production writes begin. Price rollback must use the UI/RPC so the audit trail remains intact.
