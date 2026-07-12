-- ============================================================================
-- KDU ERP · Planted Date (Smart Agronomic Advisory & Pruning Schedule)
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → NEW query → Run. (Safe to re-run.)
-- ============================================================================

-- Add planted_date to estates so the pruning-cycle engine can compute plant age.
alter table estates add column if not exists planted_date date;

-- Verify:
-- select id, name, planted_date from estates;
