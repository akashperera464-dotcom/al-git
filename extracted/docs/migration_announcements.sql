-- ============================================================================
-- KDU ERP · Announcements / Articles Table
-- ----------------------------------------------------------------------------
-- Run in: Supabase Dashboard → SQL Editor → NEW query → Run. (Safe to re-run.)
-- ============================================================================

create table if not exists announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  image_url   text,
  category    text not null default 'News',
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- RLS + Real-time
alter table announcements enable row level security;
drop policy if exists "announcements open write" on announcements;
create policy "announcements open write" on announcements for all using (true) with check (true);

begin
  alter publication supabase_realtime add table announcements;
exception when duplicate_object then null;
end;

-- Verify
select 'announcements table ready' as status;
