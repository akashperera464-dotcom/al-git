-- ============================================================================
-- Verda ERP · Phase 3 Round #6 — Inventory Schema Hardening
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → NEW query → Run. (Safe to re-run.)
--
-- PURPOSE: Adds the missing columns revealed by the 3 factory Excel files
--   (Issue Note Report, GRN Report, Fertilizer Stock Balance) so the EMS
--   can fully replace the factory's Excel-based inventory tracking.
--
-- New columns on `stock_movements`:
--   1. route                 — delivery route for issue notes (e.g., "Kiriwallapatana")
--   2. is_free_issue         — boolean flag for GRN free-issue (promotional) stock
--   3. unit_price_at_txn     — preserves the unit price at time of transaction
--                              (separate from stock_items.unit_cost which is the
--                              current moving-average cost; this is the actual
--                              price paid/received per transaction)
--   4. vendor_invoice_no     — vendor's invoice number for GRN traceability
--
-- All columns are nullable (existing rows get NULL) — no data migration needed.
-- Existing UI code continues to work; new UI forms will populate these fields.
-- ============================================================================

-- 1) Add the 4 new columns. `add column if not exists` makes it re-runnable.
alter table stock_movements
  add column if not exists route text,
  add column if not exists is_free_issue boolean not null default false,
  add column if not exists unit_price_at_txn numeric(12,2),
  add column if not exists vendor_invoice_no text;

-- 2) Add an index on route for the "Fertilizer Issued by Route" report panel.
create index if not exists idx_stock_movements_route
  on stock_movements(route)
  where route is not null;

-- 3) Add an index on is_free_issue so the GRN report can filter free-issue rows.
create index if not exists idx_stock_movements_free_issue
  on stock_movements(is_free_issue)
  where is_free_issue = true;

-- 4) Add a composite index on (move_type, performed_at) for the
--    Stock Movement Report (opening/closing balance over date range).
create index if not exists idx_stock_movements_type_date
  on stock_movements(move_type, performed_at desc);

-- 5) Comments for future devs.
comment on column stock_movements.route is
  'Delivery route for issue notes (e.g., Kiriwallapatana, Sutton). NULL for GRN/adjust.';
comment on column stock_movements.is_free_issue is
  'True when this GRN line was a free promotional issue from the vendor (no charge).';
comment on column stock_movements.unit_price_at_txn is
  'Unit price at the time of this transaction. Preserves historical pricing even when stock_items.unit_cost (moving average) changes.';
comment on column stock_movements.vendor_invoice_no is
  'Vendor invoice number for GRN traceability. Different from goods_receipts.supplier_invoice_no (which is the supplier-facing invoice).';

-- 6) Sanity check: print the new column list.
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_name = 'stock_movements'
   and column_name in ('route', 'is_free_issue', 'unit_price_at_txn', 'vendor_invoice_no')
 order by column_name;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ----------------------------------------------------------------------------
-- • No data migration needed — all 4 new columns are nullable.
-- • Existing UI forms continue to work (they just don't populate the new
--   fields yet). The Inventory module UI will be updated to include:
--     - "Route" dropdown in Issue Stock form
--     - "Free Issue" checkbox in GRN form
--     - "Vendor Invoice #" field in GRN form (separate from supplier invoice)
--   The new fields will appear in:
--     - Movement History table (Route + Free Issue badge)
--     - New "Stock Movement Report" admin panel (date-range opening/closing)
-- • After applying this migration, deploy the new frontend code (commit X)
--   so the new UI forms start populating these fields.
-- ============================================================================
