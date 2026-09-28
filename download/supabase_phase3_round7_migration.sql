-- ============================================================================
-- Verda ERP · Phase 3 Round #7 — Inventory Excel-Alignment Migration
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → NEW query → Run. (Safe to re-run.)
--
-- PURPOSE: Closes the 3 remaining gaps between the factory's Excel files and
--   the EMS schema, so every column in the Excel reports has a home in the DB:
--
--   File 1 (Issue Note Total Summary) gaps:
--     1. "Issue Note Ref."  → stock_movements.issue_note_code (text)
--     2. "Supplier No"      → stock_movements.supplier_no (text)
--
--   File 2 (GRN Report) gap:
--     3. "Supplier Name"    → goods_receipts.supplier_name (text)
--        (the vendor who delivered the fertilizer — NOT a tea supplier)
--
--   File 3 (Fertilizer Stock Balance) — NO GAPS. The Stock Movement Report
--   panel (added in Round #8) already matches this Excel exactly.
--
-- All columns are nullable (existing rows get NULL) — no data migration needed.
-- ============================================================================

-- 1) stock_movements: Issue Note Ref. (serial number from the physical issue note book)
alter table stock_movements
  add column if not exists issue_note_code text;

-- 2) stock_movements: Supplier No (the factory's supplier number — not the Firebase UID)
alter table stock_movements
  add column if not exists supplier_no text;

-- 3) goods_receipts: Supplier Name (the vendor who delivered the fertilizer to the factory)
--    Separate from supplier_invoice_no (which is the vendor's invoice number).
alter table goods_receipts
  add column if not exists supplier_name text;

-- 4) Indexes for fast lookup
create index if not exists idx_stock_movements_issue_note_code
  on stock_movements(issue_note_code)
  where issue_note_code is not null;

create index if not exists idx_stock_movements_supplier_no
  on stock_movements(supplier_no)
  where supplier_no is not null;

-- 5) Comments
comment on column stock_movements.issue_note_code is
  'Human-readable issue note reference (e.g., IN-2024-0123). Serial number from the physical issue note book. Matches the factory''s "Issue Note Ref." Excel column.';
comment on column stock_movements.supplier_no is
  'Factory''s supplier number (e.g., SUP-001). Different from user_id (Firebase UID). Matches the factory''s "Supplier No" Excel column.';
comment on column goods_receipts.supplier_name is
  'Vendor who delivered the fertilizer to the factory (e.g., CIC Fertilizer Ltd). NOT a tea supplier. Matches the factory''s "Supplier Name" Excel column on the GRN Report.';

-- 6) Sanity check
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_name = 'stock_movements'
   and column_name in ('issue_note_code', 'supplier_no')
 union all
 select column_name, data_type, is_nullable
  from information_schema.columns
 where table_name = 'goods_receipts'
   and column_name = 'supplier_name'
 order by column_name;
