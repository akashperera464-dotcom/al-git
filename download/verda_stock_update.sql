-- ============================================================================
-- Verda ERP — Stock Management Schema Update (idempotent)
-- ============================================================================
-- Run this in Supabase Dashboard → SQL Editor → New query → Run
--
-- Purpose:
--   Ensures the stock_items + stock_movements tables have all columns
--   needed by the new stock management features:
--     1. Opening Qty / Unit Cost / Reorder Level on Add Stock Item form
--     2. Equipment + Agrochemical overview modules
--     3. "Link to Request" dropdown in Issue Stock form
--
-- Safety: This script is IDEMPOTENT — safe to run multiple times.
--   - Uses ADD COLUMN IF NOT EXISTS (no error if column already exists)
--   - Uses CREATE INDEX IF NOT EXISTS
--   - Does NOT drop or modify any existing data
-- ============================================================================

-- ============================================================================
-- 1. Ensure stock_items has all required columns
-- ============================================================================
-- These columns already exist per supabase_migration_fix3.sql, but
-- this script guarantees they exist even if you started with an older schema.

alter table stock_items
  add column if not exists qty_on_hand    numeric(12,2) not null default 0,
  add column if not exists reorder_level  numeric(12,2) not null default 0,
  add column if not exists unit_cost      numeric(12,2) not null default 0,
  add column if not exists estate_id      uuid references estates(id) on delete set null,
  add column if not exists version        integer not null default 1,
  add column if not exists updated_by_uid text,
  add column if not exists created_at     timestamptz not null default now();

-- ============================================================================
-- 2. Indexes for fast filtering by category (used by Equipment, Fertilizer,
--    and Agrochemical overview modules)
-- ============================================================================
create index if not exists idx_si_category on stock_items(category);
create index if not exists idx_si_estate   on stock_items(estate_id);
create index if not exists idx_si_code      on stock_items(code);

-- ============================================================================
-- 3. Ensure stock_movements has columns needed for the audit trail
--    (the "Link to Request" feature writes the request ref into `notes`)
-- ============================================================================
alter table stock_movements
  add column if not exists reference_type  text,
  add column if not exists reference_id    uuid,
  add column if not exists from_estate_id  uuid references estates(id),
  add column if not exists to_estate_id    uuid references estates(id),
  add column if not exists performed_by    text,
  add column if not exists performed_at    timestamptz not null default now(),
  add column if not exists notes           text;

create index if not exists idx_sm_item on stock_movements(stock_item_id);
create index if not exists idx_sm_type on stock_movements(move_type);

-- ============================================================================
-- 4. (Optional) Add a linked_request_id column to stock_movements
--    This lets you query "which supplier request was this issue for?"
--    directly via SQL instead of parsing the notes text.
-- ============================================================================
-- This is OPTIONAL — the webapp works without it (request ref goes in notes).
-- Enable only if you want structured reporting on request fulfilment.

alter table stock_movements
  add column if not exists linked_request_id text;

create index if not exists idx_sm_linked_req on stock_movements(linked_request_id) where linked_request_id is not null;

-- ============================================================================
-- 5. (Optional) Seed some sample equipment + agrochemical stock items
--    so the new Equipment + Agrochemical overview modules show data on first load.
--    Skip this if you already have stock items.
-- ============================================================================
-- Uncomment the block below to seed sample data:

/*
insert into stock_items (code, name, category, unit, qty_on_hand, reorder_level, unit_cost) values
  -- Fertilizer (sample — adjust to your actual stock)
  ('FERT-UREA', 'Urea (46% N)', 'fertilizer', 'kg', 1250, 200, 95),
  ('FERT-MOP',  'MOP (Potash)', 'fertilizer', 'kg', 680,  150, 180),
  ('FERT-TSP',  'TSP (Phosphate)', 'fertilizer', 'kg', 420, 100, 175),
  ('FERT-DOL',  'Dolomite', 'fertilizer', 'kg', 80, 80, 60),
  -- Equipment
  ('EQP-SPRAYER', 'Knapsack Sprayer', 'equipment', 'pcs', 24, 5, 4500),
  ('EQP-SHEARS',  'Pruning Shears', 'equipment', 'pcs', 60, 10, 850),
  ('EQP-BASKET',  'Plucking Basket', 'equipment', 'pcs', 8, 15, 1200),
  ('EQP-MACHETE', 'Tea Plucking Machete', 'equipment', 'pcs', 32, 8, 650),
  -- Agrochemical
  ('AGRO-GLY',      'Glyphosate 360 SL', 'agrochemical', 'L', 45, 10, 1850),
  ('AGRO-MAN',      'Mancozeb 80 WP', 'agrochemical', 'kg', 18, 8, 2200),
  ('AGRO-CHL',      'Chlorpyrifos 40 EC', 'agrochemical', 'L', 6, 12, 1450),
  ('AGRO-UREA-SPRAY','Foliar Urea Spray', 'agrochemical', 'L', 30, 5, 320)
on conflict (code) do nothing;
*/

-- ============================================================================
-- 6. Verify the schema
-- ============================================================================
-- Run these queries to confirm everything is in place:

-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_name = 'stock_items'
-- order by ordinal_position;

-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_name = 'stock_movements'
-- order by ordinal_position;

-- select category, count(*) as item_count, sum(qty_on_hand * unit_cost) as total_value
-- from stock_items
-- group by category
-- order by category;

-- ============================================================================
-- Done. The webapp at https://al-git.vercel.app will start using these
-- columns automatically once the new code is deployed (no app rebuild needed).
-- ============================================================================
