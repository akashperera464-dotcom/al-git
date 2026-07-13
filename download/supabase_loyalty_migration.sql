-- ============================================================================
-- Verda ERP · Loyalty Program Migration — members + points ledger + rewards + redemptions
-- ----------------------------------------------------------------------------
-- Run in Supabase SQL Editor → New query → Run.
-- Safe to re-run (idempotent — uses if not exists).
--
-- What this adds:
--   1. Extends existing `loyalty_members` table with worker link + auto-tier
--   2. `loyalty_points_ledger` — every earn/burn transaction logged
--   3. `loyalty_rewards` — redeemable catalog (t-shirts, cash bonuses, etc.)
--   4. `loyalty_redemptions` — when a member redeems a reward
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1 · EXTEND loyalty_members with worker link + last_awarded date
-- ----------------------------------------------------------------------------
alter table loyalty_members add column if not exists worker_id    uuid;
alter table loyalty_members add column if not exists estate_id    uuid;
alter table loyalty_members add column if not exists total_earned integer not null default 0;
alter table loyalty_members add column if not exists total_burned integer not null default 0;
alter table loyalty_members add column if not exists last_awarded_at timestamptz;
alter table loyalty_members add column if not exists last_awarded_reason text;
alter table loyalty_members add column if not exists status       text not null default 'active';
alter table loyalty_members add column if not exists version      integer not null default 1;
alter table loyalty_members add column if not exists updated_by_uid text;
alter table loyalty_members add column if not exists created_at   timestamptz not null default now();
create index if not exists idx_lm_worker on loyalty_members(worker_id);
create index if not exists idx_lm_tier   on loyalty_members(tier);
create index if not exists idx_lm_points on loyalty_members(points desc);

-- ----------------------------------------------------------------------------
-- 2 · POINTS LEDGER — every earn (+) and burn (-) transaction
-- ----------------------------------------------------------------------------
create table if not exists loyalty_points_ledger (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references loyalty_members(id) on delete cascade,
  worker_id       uuid,
  worker_name     text,
  points          integer not null,           -- positive = earned, negative = burned
  transaction_type text not null,             -- earn | burn | adjust | bonus
  reason          text not null,
  reference_type  text,                       -- harvest | attendance | payroll | redemption | manual
  reference_id    text,
  awarded_by      text,                       -- uid of admin/officer
  awarded_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists idx_lpl_member on loyalty_points_ledger(member_id);
create index if not exists idx_lpl_type   on loyalty_points_ledger(transaction_type);
create index if not exists idx_lpl_date   on loyalty_points_ledger(awarded_at desc);

-- ----------------------------------------------------------------------------
-- 3 · REWARDS CATALOG — redeemable items
-- ----------------------------------------------------------------------------
create table if not exists loyalty_rewards (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,
  name            text not null,
  description     text,
  category        text not null default 'merchandise',  -- merchandise | cash | voucher | experience
  points_cost     integer not null,
  cash_value      numeric(12,2) not null default 0,
  stock_qty       integer not null default -1,  -- -1 = unlimited
  image_url       text,
  is_active       boolean not null default true,
  estate_id       uuid,
  version         integer not null default 1,
  created_at      timestamptz not null default now()
);
create index if not exists idx_lr_active   on loyalty_rewards(is_active);
create index if not exists idx_lr_category on loyalty_rewards(category);

-- ----------------------------------------------------------------------------
-- 4 · REDEMPTIONS — when a member redeems a reward
-- ----------------------------------------------------------------------------
create table if not exists loyalty_redemptions (
  id              uuid primary key default gen_random_uuid(),
  redemption_code text unique not null,
  member_id       uuid not null references loyalty_members(id) on delete cascade,
  worker_name     text,
  reward_id       uuid not null references loyalty_rewards(id) on delete restrict,
  reward_name     text,
  points_cost     integer not null,
  cash_value      numeric(12,2) not null default 0,
  status          text not null default 'pending',  -- pending | approved | rejected | fulfilled | cancelled
  redeemed_at     timestamptz not null default now(),
  approved_by     text,
  approved_at     timestamptz,
  fulfilled_at    timestamptz,
  notes           text,
  version         integer not null default 1,
  created_at      timestamptz not null default now()
);
create index if not exists idx_red_member on loyalty_redemptions(member_id);
create index if not exists idx_red_status on loyalty_redemptions(status);
create index if not exists idx_red_date   on loyalty_redemptions(redeemed_at desc);

-- ----------------------------------------------------------------------------
-- 5 · VERSION-BUMP TRIGGERS
-- ----------------------------------------------------------------------------
create or replace function bump_version_loyalty()
returns trigger as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_loyalty_members_version on loyalty_members;
create trigger trg_loyalty_members_version before update on loyalty_members
  for each row execute function bump_version_loyalty();

drop trigger if exists trg_loyalty_rewards_version on loyalty_rewards;
create trigger trg_loyalty_rewards_version before update on loyalty_rewards
  for each row execute function bump_version_loyalty();

drop trigger if exists trg_loyalty_redemptions_version on loyalty_redemptions;
create trigger trg_loyalty_redemptions_version before update on loyalty_redemptions
  for each row execute function bump_version_loyalty();

-- ----------------------------------------------------------------------------
-- 6 · RLS + REAL-TIME
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array['loyalty_members','loyalty_points_ledger','loyalty_rewards','loyalty_redemptions']) loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "open_write" on %I;', t);
    execute format('create policy "open_write" on %I for all using (true) with check (true);', t);
    begin
      execute format('alter publication supabase_realtime add table %I;', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 7 · SEED REWARDS CATALOG
-- ----------------------------------------------------------------------------
insert into loyalty_rewards (code, name, description, category, points_cost, cash_value, stock_qty) values
  ('RWD-TSHIRT',   'Branded T-Shirt',         'Verda-branded cotton t-shirt',          'merchandise', 500,  0,      50),
  ('RWD-CAP',      'Cap',                     'Verda-branded cap',                     'merchandise', 300,  0,      50),
  ('RWD-FLASK',    'Steel Flask',             '500ml insulated steel flask',           'merchandise', 800,  0,      30),
  ('RWD-CASH-500', 'Rs 500 Cash Bonus',       'Cash bonus added to next payroll',      'cash',        1000, 500.00, -1),
  ('RWD-CASH-1K',  'Rs 1,000 Cash Bonus',     'Cash bonus added to next payroll',      'cash',        2000, 1000.00, -1),
  ('RWD-Voucher',  'Co-op Voucher Rs 750',    'Redeemable at estate cooperative shop', 'voucher',     1500, 750.00, -1),
  ('RWD-DAYOFF',   'Paid Day Off',            'One paid day off — redeem with manager','experience',  1800, 0,       -1),
  ('RWD-LUNCH',    'Family Lunch at Factory', 'Lunch for 4 at factory canteen',        'experience',  1200, 0,       20)
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- 8 · SEED MEMBERS (link to mock workers from data.ts)
-- ----------------------------------------------------------------------------
insert into loyalty_members (worker_name, points, tier, streak_days, badge, total_earned, status)
select name, points_balance,
  case
    when points_balance >= 2000 then 'Platinum'
    when points_balance >= 1500 then 'Gold'
    when points_balance >= 800 then 'Silver'
    else 'Bronze'
  end,
  attendance_30d,
  case
    when points_balance >= 2000 then 'Iron Plucker'
    when points_balance >= 1500 then 'Top Flush'
    when points_balance >= 1000 then 'Steady Hand'
    when points_balance >= 500 then 'Early Bird'
    else 'Rookie'
  end,
  points_balance,
  'active'
from workers
where not exists (select 1 from loyalty_members lm where lm.worker_name = workers.name);

-- ----------------------------------------------------------------------------
-- DONE — verify with:
--   select count(*) from loyalty_rewards;     → should return 8
--   select count(*) from loyalty_members;     → matches workers count
-- ----------------------------------------------------------------------------
