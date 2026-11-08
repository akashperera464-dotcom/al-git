-- Phase 3 / Round 18: GPS estate-block maps
-- Free-plan compatible: two columns only, no new tables, no paid extension,
-- no Firebase/Supabase JWT bridge and no RLS changes.

begin;

alter table public.estate_blocks
  add column if not exists land_type text not null default 'tea',
  add column if not exists boundary_geojson jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'estate_blocks_land_type_check'
  ) then
    alter table public.estate_blocks
      add constraint estate_blocks_land_type_check
      check (land_type in ('tea', 'nursery', 'forest', 'water', 'road', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'estate_blocks_boundary_geojson_check'
  ) then
    alter table public.estate_blocks
      add constraint estate_blocks_boundary_geojson_check
      check (
        boundary_geojson is null
        or (
          jsonb_typeof(boundary_geojson) = 'object'
          and boundary_geojson ->> 'type' = 'Polygon'
          and jsonb_typeof(boundary_geojson -> 'coordinates') = 'array'
        )
      );
  end if;
end $$;

comment on column public.estate_blocks.land_type is
  'Operational land classification used by the estate block map.';
comment on column public.estate_blocks.boundary_geojson is
  'Optional GeoJSON Polygon boundary. Coordinates use [longitude, latitude].';

commit;

-- Verification
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'estate_blocks'
  and column_name in ('land_type', 'boundary_geojson')
order by column_name;
