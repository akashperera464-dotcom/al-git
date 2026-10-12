# Database Migration Checklist

The production database remains Supabase PostgreSQL. Apply migrations in order and take a backup before every production change.

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
10. `migration_phase3_round12_production_hardening.sql`

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

## Firebase Third-Party Auth dashboard setup

In Supabase Dashboard open **Authentication → Third-Party Auth → Add integration → Firebase**, enter the Firebase project ID, and save. The current official integration uses Firebase's public JWKS; a Firebase service-account private key is not pasted into Supabase. Firebase ID tokens must include `role: authenticated` for the normal Postgres `authenticated` role. Backfill that custom claim with a trusted Firebase Admin process and force-refresh user tokens after adding it.

## Edge Functions

```bash
supabase functions deploy verify-recaptcha
supabase functions deploy rate-limit
supabase secrets set RECAPTCHA_SECRET_KEY=replace_with_real_secret
firebase functions:secrets:set SUPABASE_URL
firebase functions:secrets:set SUPABASE_SERVICE_ROLE_KEY
firebase deploy --only functions
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically inside Supabase Edge Functions. Do not put the reCAPTCHA secret or service-role key in `.env`.
Firebase stores its copies through Secret Manager using the commands above; `dispatchLorryNearbyAlerts` runs once per minute and uses `admin_audit_log` to prevent duplicate FCM delivery.
Run Firebase deployment with the correct project selected through `firebase use <project-id>` or `firebase deploy --project <project-id>`; no placeholder project ID is committed.

Add `VITE_RECAPTCHA_SITE_KEY` to the Vercel project's Environment Variables (not the repository `.env`) and redeploy. Its matching secret is the `RECAPTCHA_SECRET_KEY` Supabase secret above. Register both the production Vercel domain and any custom production domain in the reCAPTCHA console.

## RLS validation

Use separate Firebase users for supplier A, supplier B, a collector assigned today, an unassigned collector, admin and a request with no Firebase token. Confirm:

- Supplier A can read their estates and receives zero rows for Supplier B.
- A collector can read suppliers/harvests on today's assignment and receives zero rows for other routes.
- Admin reads all operational rows.
- A request without a Firebase subject cannot read operational tables. Factories/routes are deliberate read-only exceptions required by pre-login supplier registration.

## Rollback

Restore the pre-deployment dump for a full rollback. For an application-only rollback, deploy the previous Git commit while leaving additive columns/tables in place. Do not drop `client_record_id`, route codes, assignment history or audit rows after production writes begin. Price rollback must use the UI/RPC so the audit trail remains intact.
