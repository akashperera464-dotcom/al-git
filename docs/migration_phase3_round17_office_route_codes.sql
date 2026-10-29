-- Phase 3 Round 17 · Official factory and route codes
-- Source: Office Route Codes workbook received 29 October 2026.
-- Supabase Free compatible. No RLS/auth changes and no permanent new tables.

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='factories' and column_name='office_factory_code')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='routes' and column_name='office_route_code') then
    raise exception 'Run migration_phase3_round16_factory_api_mapping.sql first';
  end if;
end $$;

-- Factory codes supplied by the office.
with factory_map(factory_name, office_code) as (values
  ('Galpadihenna Tea Factory','0101'),
  ('Peak view Tea Factory','0102'),
  ('Matuwagala Tea Factory','0103'),
  ('Kuttapitiya Tea Factory','0104'),
  ('Madampe Tea Factory','0105')
)
update public.factories f
set office_factory_code=m.office_code
from factory_map m
where lower(trim(f.name))=lower(trim(m.factory_name));

-- Temporary import map. Canonical route names preserve existing EMS links;
-- spelling differences in the workbook are mapped explicitly below.
create temporary table if not exists round17_route_map(
  factory_name text not null,
  route_name text not null,
  office_route_code text not null,
  primary key(factory_name,office_route_code)
);
truncate round17_route_map;

insert into round17_route_map(factory_name,route_name,office_route_code) values
  ('Galpadihenna Tea Factory','FACTORY','01'),
  ('Galpadihenna Tea Factory','ANGAMMANA','02'),
  ('Galpadihenna Tea Factory','BALAWANA','03'),
  ('Galpadihenna Tea Factory','BALAWATHUKANDA','04'),
  ('Galpadihenna Tea Factory','DALUGGALA','05'),
  ('Galpadihenna Tea Factory','DANDENIYA','06'),
  ('Galpadihenna Tea Factory','DEIYANNEGAMA','07'),
  ('Galpadihenna Tea Factory','DELGODA','08'),
  ('Galpadihenna Tea Factory','DHAMBULUKANDA','09'),
  ('Galpadihenna Tea Factory','BOPETTA','10'),
  ('Galpadihenna Tea Factory','GALABODA','11'),
  ('Galpadihenna Tea Factory','SIRIPAGAMA','12'),
  ('Galpadihenna Tea Factory','GALKETIYA','13'),
  ('Galpadihenna Tea Factory','GILMALE','14'),
  ('Galpadihenna Tea Factory','GONAKUMBURA','15'),
  ('Galpadihenna Tea Factory','GTF_SUPER','16'),
  ('Galpadihenna Tea Factory','HANDURUKANDA','17'),
  ('Galpadihenna Tea Factory','HEDIGALLA','18'),
  ('Galpadihenna Tea Factory','HIRILIYEDDA','19'),
  ('Galpadihenna Tea Factory','ILUBAKANDA','20'),
  ('Galpadihenna Tea Factory','KALAWANA','21'),
  ('Galpadihenna Tea Factory','KALAWANA LCC','22'),
  ('Galpadihenna Tea Factory','KARAPINCHA','23'),
  ('Galpadihenna Tea Factory','KARAWITA','24'),
  ('Galpadihenna Tea Factory','KUDUMEERIYA','25'),
  ('Galpadihenna Tea Factory','LELLOPITYA','26'),
  ('Galpadihenna Tea Factory','MADALAGAMA','27'),
  ('Galpadihenna Tea Factory','MALWALA','28'),
  ('Galpadihenna Tea Factory','MANANA 02','29'),
  ('Galpadihenna Tea Factory','MANANAKANDA','30'),
  ('Galpadihenna Tea Factory','MARAPANA','31'),
  ('Galpadihenna Tea Factory','MARSWATTA','32'),
  ('Galpadihenna Tea Factory','MIDELLANA','33'),
  ('Galpadihenna Tea Factory','OLUGALA','34'),
  ('Galpadihenna Tea Factory','OPATHA','35'),
  ('Galpadihenna Tea Factory','OVALA','36'),
  ('Galpadihenna Tea Factory','PANAGAMA','37'),
  ('Galpadihenna Tea Factory','PANAWALA','38'),
  ('Galpadihenna Tea Factory','RAJJURUWATTA','39'),
  ('Galpadihenna Tea Factory','RATHGAMA','40'),
  ('Galpadihenna Tea Factory','SL_DOLOSWALA','41'),
  ('Galpadihenna Tea Factory','SL_KODIPPILIKANDA','42'),
  ('Galpadihenna Tea Factory','SL_KUKULEGAMA','43'),
  ('Galpadihenna Tea Factory','SL_KURUNDUKOLANIYA','44'),
  ('Galpadihenna Tea Factory','SL_MADABADDARA','45'),
  ('Galpadihenna Tea Factory','SL_NORAGALLA','46'),
  ('Galpadihenna Tea Factory','SUDUWELIPOTHAHENA','47'),
  ('Galpadihenna Tea Factory','WATAPOTHA','48'),
  ('Galpadihenna Tea Factory','WEDDAGALA','49'),
  ('Galpadihenna Tea Factory','WEWELKANDURA','50'),
  ('Galpadihenna Tea Factory','WEWELKOTHA','51'),
  ('Galpadihenna Tea Factory','WEWELWATTA','52'),
  ('Galpadihenna Tea Factory','SODIYAMWATTA','53'),
  ('Galpadihenna Tea Factory','DEALERS','54'),
  ('Galpadihenna Tea Factory','KELINKANDA','55'),
  ('Galpadihenna Tea Factory','GURUBEVILLAGAMA','56'),
  ('Galpadihenna Tea Factory','SEETHAGALA','57'),
  ('Galpadihenna Tea Factory','DOTHALUJOYA','58'),
  ('Galpadihenna Tea Factory','RANWALA','59'),
  ('Galpadihenna Tea Factory','BANDULAMALAYA','60'),
  ('Galpadihenna Tea Factory','EMBULDENIYA','61'),
  ('Galpadihenna Tea Factory','JANAPADAYA','62'),
  ('Galpadihenna Tea Factory','NILWALA','63'),
  ('Galpadihenna Tea Factory','SUDAGALA','74'),
  ('Galpadihenna Tea Factory','RASSAGALA','75'),
  ('Galpadihenna Tea Factory','GAMAGEDARA','76'),

  ('Matuwagala Tea Factory','FACTORY','01'),
  ('Matuwagala Tea Factory','SL_AYAGAMA','02'),
  ('Matuwagala Tea Factory','EPITAWALA','03'),
  ('Matuwagala Tea Factory','MUDUNKOTUWA','04'),
  ('Matuwagala Tea Factory','HINDURANGALA','05'),
  ('Matuwagala Tea Factory','PANAWALA','06'),
  ('Matuwagala Tea Factory','BOPETTA','07'),
  ('Matuwagala Tea Factory','BADUWATTA','08'),
  ('Matuwagala Tea Factory','PIMBURA','09'),
  ('Matuwagala Tea Factory','SL_GALATHURA','10'),
  ('Matuwagala Tea Factory','THALAPITIYA','11'),
  ('Matuwagala Tea Factory','IDDAMALGODA','12'),
  ('Matuwagala Tea Factory','KAVICHCHIKANDA','13'),
  ('Matuwagala Tea Factory','MATUWAGALA','14'),
  ('Matuwagala Tea Factory','DEHIOWITA','15'),
  ('Matuwagala Tea Factory','DEALER','16'),
  ('Matuwagala Tea Factory','POHORABAWA','17'),

  ('Madampe Tea Factory','FACTORY','01'),
  ('Madampe Tea Factory','DEALERS','02'),
  ('Madampe Tea Factory','OBADAKANDA','03'),
  ('Madampe Tea Factory','RAKWANA','04'),
  ('Madampe Tea Factory','GALA HITIYA','05'),
  ('Madampe Tea Factory','MADAMPE','06'),
  ('Madampe Tea Factory','HORAMULA','07'),
  ('Madampe Tea Factory','HALPAWALA','08'),
  ('Madampe Tea Factory','WELIGEPOLA','09'),
  ('Madampe Tea Factory','GANGODA','10'),
  ('Madampe Tea Factory','PANAPITIYA','11'),
  ('Madampe Tea Factory','PILANA','12'),
  ('Madampe Tea Factory','KARADIYAMULLA','13'),
  ('Madampe Tea Factory','SAMARAKANDA','14'),
  ('Madampe Tea Factory','POTHUPITIYA','15'),

  ('Kuttapitiya Tea Factory','BAMBARALAKANDA','01'),
  ('Kuttapitiya Tea Factory','BANAGODA','02'),
  ('Kuttapitiya Tea Factory','BATEWELA','03'),
  ('Kuttapitiya Tea Factory','HANDURUKANDA','04'),
  ('Kuttapitiya Tea Factory','KARAWITA','05'),
  ('Kuttapitiya Tea Factory','KIRIWANDALA','06'),
  ('Kuttapitiya Tea Factory','KIRIWELDENIYA','07'),
  ('Kuttapitiya Tea Factory','MALMEEKANDA','08'),
  ('Kuttapitiya Tea Factory','POLGASWATTA','09'),
  ('Kuttapitiya Tea Factory','THORAKANDA','10'),
  ('Kuttapitiya Tea Factory','THOTILAGAMA','11'),
  ('Kuttapitiya Tea Factory','WARIGAMA','12'),
  ('Kuttapitiya Tea Factory','WATHTHEPANGUWA','13'),
  ('Kuttapitiya Tea Factory','KUTTAPITIYA','14'),
  ('Kuttapitiya Tea Factory','KT_ESTATE','16'),
  ('Kuttapitiya Tea Factory','MADOLA','17'),
  ('Kuttapitiya Tea Factory','DEALERS','18'),

  ('Peak view Tea Factory','BAMBARAKANDA','01'),
  ('Peak view Tea Factory','BANAGODA','02'),
  ('Peak view Tea Factory','BATEWELA','03'),
  ('Peak view Tea Factory','KURUWITA','04'),
  ('Peak view Tea Factory','MAPALANA','05'),
  ('Peak view Tea Factory','MIYANAWIWA','06'),
  ('Peak view Tea Factory','PALUGAMPOLA','07'),
  ('Peak view Tea Factory','PANNILA','08'),
  ('Peak view Tea Factory','PORONUWA','09'),
  ('Peak view Tea Factory','RAKWANA','10'),
  ('Peak view Tea Factory','RIDEEWIWA','11'),
  ('Peak view Tea Factory','SL_KAVICHCHIKANDA','12'),
  ('Peak view Tea Factory','SL_MAKANDURA','13'),
  ('Peak view Tea Factory','SL_WEWELKANDURA','14'),
  ('Peak view Tea Factory','SL_WILEHENA','15'),
  ('Peak view Tea Factory','WATHTHAHENA','16'),
  ('Peak view Tea Factory','PV_SUPER','17'),
  ('Peak view Tea Factory','PEAKVIEW','18'),
  ('Peak view Tea Factory','SANNASGAMA','19'),
  ('Peak view Tea Factory','DIGANDALA','20'),
  ('Peak view Tea Factory','PV_DEALER','21'),
  ('Peak view Tea Factory','RANWALA','22'),
  ('Peak view Tea Factory','PITAKELE SUPER','23'),
  ('Peak view Tea Factory','WEWELWATTA SUPER','24');

-- Add routes newly present in the official workbook. Existing linked routes
-- remain untouched; the Round 12 trigger generates a unique human route_code.
insert into public.routes(factory_id,route_name)
select f.id,m.route_name
from round17_route_map m
join public.factories f on lower(trim(f.name))=lower(trim(m.factory_name))
on conflict (factory_id,route_name) do nothing;

update public.routes r
set office_route_code=m.office_route_code
from round17_route_map m
join public.factories f on lower(trim(f.name))=lower(trim(m.factory_name))
where r.factory_id=f.id and r.route_name=m.route_name;

-- The EMS supplier number is the office card/supplier ID. The older optional
-- office_supplier_id column is retained only for backwards compatibility.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='office_supplier_id') then
    comment on column public.users.office_supplier_id is 'Deprecated: the factory API now uses users.supplier_no directly.';
  end if;
end $$;

-- Fail visibly if any supplied mapping was not applied.
do $$
declare
  factory_count integer;
  route_count integer;
begin
  select count(*) into factory_count from public.factories
  where office_factory_code in ('0101','0102','0103','0104','0105');
  select count(*) into route_count
  from public.routes r join public.factories f on f.id=r.factory_id
  join round17_route_map m on lower(trim(f.name))=lower(trim(m.factory_name))
    and r.route_name=m.route_name and r.office_route_code=m.office_route_code;
  if factory_count<>5 then raise exception 'Expected 5 official factory codes, found %',factory_count; end if;
  if route_count<>139 then raise exception 'Expected 139 official route mappings, found %',route_count; end if;
end $$;

select f.name factory,f.office_factory_code,count(r.id) filter(where r.office_route_code is not null) mapped_routes
from public.factories f left join public.routes r on r.factory_id=f.id
where f.office_factory_code in ('0101','0102','0103','0104','0105')
group by f.id,f.name,f.office_factory_code order by f.office_factory_code;
