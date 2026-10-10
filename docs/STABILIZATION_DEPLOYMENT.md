# Stabilization rollout

The web source remains in root `src/`. Firebase authenticates users; Supabase
stores business data. No business tables have been moved to Firestore.

## Required order before merging to Vercel's production branch

1. Back up the production database and record its currently applied migrations.
   Test this rollout in a staging Supabase/Firebase project first.
2. In Supabase **Authentication → Third-Party Auth**, add Firebase with the
   project ID used by the web app. This repository's Android Firebase project
   is `kdu-feedback-app`; confirm the Vercel web configuration uses the same ID.
   Firebase is supported through the Supabase client's `accessToken` callback,
   not `signInWithIdToken({ provider: 'firebase' })`.
3. Run `npm ci --prefix functions` and deploy only the auth bridge initially:
   `firebase deploy --only functions:ensureSupabaseRole --project kdu-feedback-app`.
   It preserves existing claims and grants only PostgreSQL's `authenticated`
   role. It cannot grant application administrator access. Existing accounts
   receive the claim at their next login; the client force-refreshes the token.
4. Verify the existing schema includes the previous phase migrations, especially
   the supplier ledger, stock items/movements, loans, fields and registrations.
   Run `docs/migration_security_helpers.sql` first. Apply any missing historical
   schema migrations, then run `docs/migration_stabilization.sql` LAST.
   Historical migrations elsewhere in `docs/` and `download/` can reintroduce
   open policies; do not rerun them afterward without reviewing their policies.
5. Ensure a trusted, active super-admin row exists in `public.users`, with `id`
   exactly equal to that account's Firebase UID. For a new deployment only, run
   `npm run bootstrap:admin --prefix functions` with Application Default
   Credentials and server-only `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (optionally `SUPER_ADMIN_NAME`).
   The script preserves an existing Firebase account's password. Use Firebase's
   password-reset workflow to rotate previously exposed credentials.
6. Build and smoke-test this branch against staging. Check an admin, a supplier,
   another supplier, an extension officer, and a suspended account. Verify
   login/logout, Field Tools, My Profile save/reload on a second device, supplier
   isolation, inventory issuance and fertilizer history, plot coordinates,
   activity reminders, and service-worker registration/update after closing tabs.
7. Only after these checks merge to the GitHub branch Vercel watches. Database
   migrations and Firebase Functions are NOT applied by a Vercel Git deployment.

## Configuration and scope

- All `VITE_*` values are public browser configuration. The old seed password and
  client-side privileged auto-provisioning have been removed. The requested
  `VITE_SUPER_ADMIN_PASSWORD` is intentionally unused; it would expose the
  administrator password again. `.env.example` contains only empty placeholders.
- `.env` was not edited. It must remain untracked. Existing Git history may still
  contain credentials; removing it from the branch does not erase that history.
- Firebase UIDs are not UUIDs. Policies use `app_uid()` → `auth.jwt()->>'sub'`.
  `auth.role()` is a PostgreSQL role; it is not the application's admin role.
  `app_role()` reads the protected users table, requires active status and prevents
  recursive policy evaluation. Ordinary admins cannot promote accounts to admins.
- The final migration replaces existing policies on users, farm activities,
  alerts, registrations, profiles, supplier fertilizer ledger/loans, harvest,
  fields, estates, divisions, stock items and stock movements. It is not an audit
  of every other historical table, Storage policy or Firestore rule.
- Other historical SQL still contains permissive policies (notably the generic
  `migration_full_crud.sql`, announcements, branding and workers migrations).
  Audit and replace those policies, including grants to `anon`/`public`, before
  treating the entire database as secure. This branch only closes the tables
  named above; a successful web build is not evidence of full RLS coverage.
- Runtime is Node.js 22. Node.js 18 is no longer suitable for new deployments.
  The existing notification/scheduled functions are packaged but require their
  own server environment, device-token wiring and production verification; the
  bridge deployment command above deliberately selects only the bridge.
- New supplier fertilizer issues use one database transaction for stock,
  movement and ledger, with a unique active supplier-name lookup yielding a UID.
  Ambiguous supplier names fail before any stock is changed.
- Existing ledger rows with missing or wrong supplier IDs need an admin-reviewed
  backfill. Records are never reassigned by display-name matching in a supplier
  read. Missing historical prices remain NULL and are flagged in the estimate.
- Supplier profiles/preferences now persist in `supplier_profiles`, and alerts
  come from `alerts`. Historical profiles and ledgers stored only on old devices
  remain on those devices. Back up and review them before any one-time import;
  this pass does not guess ownership or silently upload those local records.
- Tips, weather and home use supplier-owned fields and farm activities. Existing
  registrations serve as a database fallback when old fields lack supplier IDs.
  New Estate Master approvals write field ownership and coordinates.
- The generated service worker caches the application shell only. It does not
  cache private API responses. Updates activate after old tabs close, preserving
  unsaved forms. The Android wrapper's native offline screen is unchanged.
- Removed legacy folders were preserved locally in `.stabilization-backup/`
  (ignored by Git); Git also retains their previous committed revisions.

## Verification

- `npm ci` then `npm test`: auth, RBAC, data mapping and PostgreSQL RLS tests.
- `npm run build`: Vite and generated PWA service worker.
- `npm run check --prefix functions`: function syntax validation.
- `npm run typecheck`: full repository check; the original repository contains
  unresolved UI-scaffold dependencies and existing type/unused-symbol errors.
  See the handoff for whether this pass introduced any new diagnostics.

These local checks do not verify production integrations, existing database
policies, real-device push delivery, or all ERP workflows. Keep production on
the current branch until the rollout above is completed.

References:
- https://supabase.com/docs/guides/auth/third-party/firebase-auth
- https://firebase.google.com/docs/functions/manage-functions
