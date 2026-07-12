-- ============================================================================
-- KDU ERP · Migration — Email/Password Auth + Super Admin role
-- ----------------------------------------------------------------------------
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run.
-- Adds the `super_admin` role value, the `email` & `division` columns, and the
-- Super Admin seed row. Safe to re-run (idempotent).
-- ============================================================================

-- 1) Add the new role enum value.
--    NOTE: `alter type ... add value` CANNOT run inside a transaction block,
--    so Supabase SQL Editor may complain if "Run" wraps it. Run this single
--    statement on its own first, then run the rest.
alter type user_role add value if not exists 'super_admin';

-- 2) Add the email + division columns (auth switched from Phone OTP → Email).
alter table users add column if not exists email   text;
alter table users add column if not exists division text;

-- 3) Make sure admins (super_admin + admin) can be returned by the
--    managed_users view. Recreate it to include email + division.
create or replace view managed_users as
  select
    u.id, u.name, u.email, u.role, u.phone, u.division,
    u.associated_entity_id, u.status,
    e.name as associated_entity_name
  from users u
  left join estates e on e.id = u.associated_entity_id;

-- 4) Super Admin seed row (id will be reconciled to the real Firebase uid on
--    first login — the app bootstraps `akashperera@kdu.com` automatically).
--    Inserting here just guarantees the row exists; if a Firebase uid is known,
--    replace the id below with it.
insert into users (id, email, name, role, status)
values ('uid-superadmin-seed', 'akashperera@kdu.com', 'Akash Perera', 'super_admin', 'active')
on conflict (id) do nothing;

-- 5) Allow the is_admin() helper to recognize super_admin too.
create or replace function is_admin() returns boolean as $$
  select exists(select 1 from users
                where id = caller_uid()
                  and role in ('admin','super_admin'));
$$ language sql stable;

-- ============================================================================
-- HOW THE SUPER ADMIN SEED WORKS (no manual Firebase setup needed)
-- ----------------------------------------------------------------------------
-- On the FIRST login attempt with:
--    email:    akashperera@kdu.com
--    password: akashperera123*#
-- the app (src/lib/auth.hybrid.ts → SUPER_ADMIN_SEED) detects the email, sees
-- Firebase has no such user yet, and:
--   1. createUserWithEmailAndPassword(email, password) → Firebase creates it.
--   2. provisionSupabaseUser(uid, { role: 'super_admin', ... }) → inserts the
--      Supabase row with the real uid.
-- So the very first sign-in "just works", after which it is a normal login.
-- ============================================================================
