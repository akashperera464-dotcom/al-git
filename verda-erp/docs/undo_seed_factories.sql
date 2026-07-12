-- ============================================================================
-- KDU ERP · Remove Seeded Factory & Route Data (Undo)
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → NEW query → Run.
-- This safely removes the 6 seeded factories + their 116 supply routes.
-- Any suppliers linked to these factories will have their association cleared.
-- ============================================================================

-- 1) Unlink any suppliers associated with these factories (set to NULL so
--    they don't break — they can be re-linked later).
update users
set associated_entity_id = null
where associated_entity_id in (
  select id from estates
  where name in (
    'Galpadihenna Tea Factory',
    'Kalawana Leaf Center',
    'Kuttapitiya Tea Factory',
    'Madampe Tea Factory',
    'Matuwagala Tea Factory',
    'Peak View Tea Factory'
  )
);

-- 2) Delete all divisions (routes) belonging to these factories.
delete from divisions
where estate_id in (
  select id from estates
  where name in (
    'Galpadihenna Tea Factory',
    'Kalawana Leaf Center',
    'Kuttapitiya Tea Factory',
    'Madampe Tea Factory',
    'Matuwagala Tea Factory',
    'Peak View Tea Factory'
  )
);

-- 3) Delete the factories themselves.
delete from estates
where name in (
  'Galpadihenna Tea Factory',
  'Kalawana Leaf Center',
  'Kuttapitiya Tea Factory',
  'Madampe Tea Factory',
  'Matuwagala Tea Factory',
  'Peak View Tea Factory'
);

-- Verify: should show only your original estates (e.g. Glenview)
select name from estates order by name;
