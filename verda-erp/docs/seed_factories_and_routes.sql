-- ============================================================================
-- KDU ERP · Seed Real Factory Data (6 Factories + Supply Routes as Divisions)
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → NEW query → Run. (Safe to re-run.)
--
-- Factories → estates table
-- Supply Routes → divisions table (with estate_id FK)
-- ============================================================================

-- Clean slate (optional — uncomment to remove old seed data first)
-- delete from divisions where estate_id in (select id from estates where name like '%Factory%' or name like '%Tea%');
-- delete from estates where name like '%Factory%' or name like '%Tea%';

DO $$
DECLARE
  -- Factory (estate) IDs
  v_galpadihenna uuid;
  v_kalawana uuid;
  v_kuttapitiya uuid;
  v_madampe uuid;
  v_matuwagala uuid;
  v_peakview uuid;
BEGIN
  -- ============================================================
  -- 1. CREATE FACTORIES (as Estates)
  -- ============================================================

  -- Galpadihenna Tea Factory
  INSERT INTO estates (id, name, region, total_area_ha, elevation_m, latitude, longitude)
  VALUES (
    gen_random_uuid(),
    'Galpadihenna Tea Factory',
    'Ratnapura', 0, 0,
    6.6828, 80.4036
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_galpadihenna;

  -- If already exists, fetch it
  IF v_galpadihenna IS NULL THEN
    SELECT id INTO v_galpadihenna FROM estates WHERE name = 'Galpadihenna Tea Factory' LIMIT 1;
  END IF;

  -- Kalawana Leaf Center
  INSERT INTO estates (id, name, region, total_area_ha, elevation_m, latitude, longitude)
  VALUES (gen_random_uuid(), 'Kalawana Leaf Center', 'Ratnapura', 0, 0, 6.5847, 80.4342)
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_kalawana;
  IF v_kalawana IS NULL THEN
    SELECT id INTO v_kalawana FROM estates WHERE name = 'Kalawana Leaf Center' LIMIT 1;
  END IF;

  -- Kuttapitiya Tea Factory
  INSERT INTO estates (id, name, region, total_area_ha, elevation_m, latitude, longitude)
  VALUES (gen_random_uuid(), 'Kuttapitiya Tea Factory', 'Ratnapura', 0, 0, 6.6250, 80.3850)
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_kuttapitiya;
  IF v_kuttapitiya IS NULL THEN
    SELECT id INTO v_kuttapitiya FROM estates WHERE name = 'Kuttapitiya Tea Factory' LIMIT 1;
  END IF;

  -- Madampe Tea Factory
  INSERT INTO estates (id, name, region, total_area_ha, elevation_m, latitude, longitude)
  VALUES (gen_random_uuid(), 'Madampe Tea Factory', 'Ratnapura', 0, 0, 6.4650, 80.5250)
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_madampe;
  IF v_madampe IS NULL THEN
    SELECT id INTO v_madampe FROM estates WHERE name = 'Madampe Tea Factory' LIMIT 1;
  END IF;

  -- Matuwagala Tea Factory
  INSERT INTO estates (id, name, region, total_area_ha, elevation_m, latitude, longitude)
  VALUES (gen_random_uuid(), 'Matuwagala Tea Factory', 'Kegalle', 0, 0, 7.0500, 80.3500)
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_matuwagala;
  IF v_matuwagala IS NULL THEN
    SELECT id INTO v_matuwagala FROM estates WHERE name = 'Matuwagala Tea Factory' LIMIT 1;
  END IF;

  -- Peak View Tea Factory
  INSERT INTO estates (id, name, region, total_area_ha, elevation_m, latitude, longitude)
  VALUES (gen_random_uuid(), 'Peak View Tea Factory', 'Ratnapura', 0, 0, 6.7800, 80.6200)
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_peakview;
  IF v_peakview IS NULL THEN
    SELECT id INTO v_peakview FROM estates WHERE name = 'Peak View Tea Factory' LIMIT 1;
  END IF;

  -- ============================================================
  -- 2. CREATE SUPPLY ROUTES (as Divisions)
  -- ============================================================

  -- Helper: insert a division if it doesn't already exist for this estate
  -- Galpadihenna routes (45 routes)
  INSERT INTO divisions (estate_id, name, manager, area_ha)
  SELECT v_galpadihenna, route, 'Unassigned', 0
  FROM (VALUES
    ('DEALERS'), ('RANWALA'), ('ANGAMMANA'), ('GILMALE'), ('EMBULDENIYA'),
    ('MALWALA'), ('OLUGALA'), ('SODIYAMWATTA'), ('GONAKUMBURA'), ('BOPETTA'),
    ('GALABODA'), ('HIRILIYEDDA'), ('HANDURUKANDA'), ('SIRIPAGAMA'), ('WEWELWATTA'),
    ('LELLOPITYA'), ('KALAWANA'), ('DALUGGALA'), ('DEIYANNEGAMA'), ('KARAWITA'),
    ('MIDELLANA'), ('BALAWANA'), ('DHAMBULUKANDA'), ('GURUBEVILLAGAMA'), ('MARSWATTA'),
    ('OPATHA'), ('OVALA'), ('PANAGAMA'), ('RATHGAMA'), ('SL_NORAGALLA'),
    ('FACTORY'), ('MARAPANA'), ('PANAWALA'), ('SEETHAGALA'), ('DOTHALUJOYA'),
    ('JANAPADAYA'), ('MANANAKANDA'), ('SL_KURUNDUKOLANIYA'), ('NILWALA'), ('MADALAGAMA'),
    ('BANDULAMALAYA'), ('GTF_SUPER'), ('KARAPINCHA'), ('WEWELKOTHA'), ('SUDAGALA')
  ) AS t(route)
  WHERE NOT EXISTS (
    SELECT 1 FROM divisions WHERE estate_id = v_galpadihenna AND name = t.route
  );

  -- Kalawana routes (9 routes)
  INSERT INTO divisions (estate_id, name, manager, area_ha)
  SELECT v_kalawana, route, 'Unassigned', 0
  FROM (VALUES
    ('BALAWATHUKANDA'), ('KUDUMEERIYA'), ('SL_KUKULEGAMA'), ('SUDUWELIPOTHAHENA'),
    ('DELGODA'), ('WEDDAGALA'), ('ILUMBAKANDA'), ('KALAWANA LCC'), ('WEWELKANDURA')
  ) AS t(route)
  WHERE NOT EXISTS (
    SELECT 1 FROM divisions WHERE estate_id = v_kalawana AND name = t.route
  );

  -- Kuttapitiya routes (17 routes)
  INSERT INTO divisions (estate_id, name, manager, area_ha)
  SELECT v_kuttapitiya, route, 'Unassigned', 0
  FROM (VALUES
    ('DEALERS'), ('BAMBARALAKANDA'), ('BANAGODA'), ('BATEWELA'), ('HANDURUKANDA'),
    ('KARAWITA'), ('KIRIWANDALA'), ('KIRIWELDENIYA'), ('KT_ESTATE'), ('KUTTAPITIYA'),
    ('MADOLA'), ('MALMEEKANDA'), ('POLGASWATTA'), ('THORAKANDA'), ('THOTILAGAMA'),
    ('WARIGAMA'), ('WATHTHEPANGUWA')
  ) AS t(route)
  WHERE NOT EXISTS (
    SELECT 1 FROM divisions WHERE estate_id = v_kuttapitiya AND name = t.route
  );

  -- Madampe routes (13 routes)
  INSERT INTO divisions (estate_id, name, manager, area_ha)
  SELECT v_madampe, route, 'Unassigned', 0
  FROM (VALUES
    ('HORAMULA'), ('PANAPITIYA'), ('RAKWANA'), ('GALA HITIYA'), ('HALPAWALA'),
    ('OBADAKANDA'), ('MADAMPE'), ('DEALERS'), ('WELIGEPOLA'), ('GANGODA'),
    ('PILANA'), ('SAMARAKANDA'), ('POTHUPITIYA')
  ) AS t(route)
  WHERE NOT EXISTS (
    SELECT 1 FROM divisions WHERE estate_id = v_madampe AND name = t.route
  );

  -- Matuwagala routes (14 routes)
  INSERT INTO divisions (estate_id, name, manager, area_ha)
  SELECT v_matuwagala, route, 'Unassigned', 0
  FROM (VALUES
    ('BADUWATTA'), ('BOPETTA'), ('DEHIOWITA'), ('EPITAWALA'), ('FACTORY'),
    ('HINDURANGALA'), ('IDDAMALGODA'), ('KAVICHCHIKANDA'), ('MATUWAGALA'), ('MUDUNKOTUWA'),
    ('PANAWALA'), ('PIMBURA'), ('SL_AYAGAMA'), ('SL_GALATHURA'), ('THALAPITIYA')
  ) AS t(route)
  WHERE NOT EXISTS (
    SELECT 1 FROM divisions WHERE estate_id = v_matuwagala AND name = t.route
  );

  -- Peak View routes (18 routes)
  INSERT INTO divisions (estate_id, name, manager, area_ha)
  SELECT v_peakview, route, 'Unassigned', 0
  FROM (VALUES
    ('RAKWANA'), ('BATEWELA'), ('DIGANDALA'), ('BAMBARAKANDA'), ('MAPALANA'),
    ('WEWELWATTA SUPER'), ('PANNILA'), ('KURUWITA'), ('PALUGAMPOLA'), ('SANNASGAMA'),
    ('SL_MAKANDURA'), ('RIDEEWIWA'), ('BANAGODA'), ('PEAKVIEW'), ('PORONUWA'),
    ('WATHTHAHENA'), ('MIYANAWIWA'), ('PV_SUPER')
  ) AS t(route)
  WHERE NOT EXISTS (
    SELECT 1 FROM divisions WHERE estate_id = v_peakview AND name = t.route
  );

  RAISE NOTICE 'Seeding complete: 6 factories + % total routes',
    (SELECT count(*) FROM divisions WHERE estate_id IN (v_galpadihenna, v_kalawana, v_kuttapitiya, v_madampe, v_matuwagala, v_peakview));
END $$;

-- Verify
SELECT e.name AS factory, count(d.id) AS route_count
FROM estates e
LEFT JOIN divisions d ON d.estate_id = e.id
WHERE e.name LIKE '%Factory%' OR e.name LIKE '%Center%'
GROUP BY e.name
ORDER BY e.name;
