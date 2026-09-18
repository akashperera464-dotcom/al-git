-- ============================================================================
-- Verda ERP · Phase 3 Round #5 — Supplier Shortcomings Fix Migration
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → NEW query → Run. (Safe to re-run.)
--
-- PURPOSE: Closes the SQL gap exposed by the B1-B29 supplier shortcomings fix.
--   The TypeScript type `FarmActivityType` (src/lib/data.ts) already included
--   "plucking" — and FarmActivities.tsx has a Plucking tab that suppliers
--   have been clicking — but the database CHECK constraint on
--   farm_activities.activity_type did NOT include "plucking". Every plucking
--   log was silently rejected at the DB layer.
--
-- This migration:
--   1. Drops the old farm_activities_activity_type_check constraint
--   2. Re-adds it WITH 'plucking' included
--   3. Backfills any orphaned localStorage plucking logs (informational only)
--   4. Adds a helpful COMMENT so future devs see why 'plucking' is allowed
--
-- After running this migration:
--   - Suppliers can log plucking activities successfully
--   - SupplierCalendar plucking dots will appear (B1/B24)
--   - Factory.tsx "Expected Intake from Suppliers" panel (B29) will populate
--   - Admin block-level fertilizer history (B27) already works (only reads
--     details->>'block' from fertilizer activities, which were already allowed)
-- ============================================================================

-- 1) Drop the old CHECK constraint (idempotent — drop if exists).
alter table farm_activities drop constraint if exists farm_activities_activity_type_check;

-- 2) Re-add WITH 'plucking' included. Order: alphabetical for readability.
--    NOTE: 'fertilizer_application' is retained for backwards compatibility
--    (was added in Round #4) even though the TypeScript type doesn't use it
--    anymore — old rows may still exist.
alter table farm_activities
  add constraint farm_activities_activity_type_check
  check (activity_type in (
    'fertilizer',
    'fertilizer_application',  -- legacy, kept for back-compat
    'plucking',                -- NEW (B1/B24/B29)
    'pruning',
    'replanting',
    'self_harvest'
  ));

-- 3) Comment for future devs.
comment on constraint farm_activities_activity_type_check on farm_activities is
  'Allowed activity types. plucking was added in Phase 3 Round #5 (B1/B24/B29 supplier shortcomings fix).';

-- 4) Sanity check: print the new constraint definition.
select pg_get_constraintdef(oid) as new_constraint
  from pg_constraint
 where conname = 'farm_activities_activity_type_check';

-- ============================================================================
-- POST-MIGRATION NOTES
-- ----------------------------------------------------------------------------
-- • No data is lost — only the CHECK constraint is widened.
-- • Suppliers who clicked "Plucking" tab in the past and saw a silent failure
--   will now succeed on their next plucking log. Past attempts were NOT cached
--   client-side (recordFarmActivity threw on insert error), so there is nothing
--   to backfill from localStorage.
-- • If you previously deployed the B9 offline-queue fix (commit 80fe4ed or
--   later), failed plucking inserts would have been queued in
--   `verda:offline_queue` localStorage. Those will be auto-replayed by
--   AppContext's flushSync() the next time the supplier comes online after
--   this migration is applied — no manual action needed.
-- ============================================================================
