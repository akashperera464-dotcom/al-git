import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const sql = (name: string) => readFileSync(new URL(`../../docs/${name}`, import.meta.url), "utf8");
// Tests execute real PostgreSQL RLS using non-UUID Firebase-style subjects.
let db: PGlite;
const uid = "firebase-supplier-A";
async function asUser(subject: string, query: string) {
  await db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify({ sub: subject, role: "authenticated" })}', false); set role authenticated;`);
  return db.query(query);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.jwt() to authenticated,anon;
    create table users(id text primary key,name text,role text,status text);
    create table farm_activities(id uuid primary key default gen_random_uuid(),user_id text,details jsonb);
    create table alerts(id uuid primary key default gen_random_uuid(),target_user_id text,title text,read boolean default false);
    create table estate_registration_requests(id uuid primary key default gen_random_uuid(),supplier_id text,status text,
      admin_notes text,reviewed_at timestamptz,reviewed_by text);
    create table fields(id uuid primary key default gen_random_uuid(),supplier_id text);
    create table estates(id uuid primary key default gen_random_uuid());
    create table divisions(id uuid primary key default gen_random_uuid());
    create table stock_items(id uuid primary key,code text,name text,category text,unit text,qty_on_hand numeric,unit_cost numeric);
    create table stock_movements(id uuid primary key default gen_random_uuid(),stock_item_id uuid,move_type text,qty numeric,
      unit_cost numeric,performed_by text,notes text);
    create table supplier_fertilizer_ledger(id uuid primary key default gen_random_uuid(),supplier_id text,supplier_name text,
      stock_item_id uuid,stock_item_code text,stock_item_name text,qty_issued numeric,unit text,payment_mode text,division text,
      issue_date timestamptz,notes text);
    create table supplier_fertilizer_loans(id uuid primary key default gen_random_uuid(),supplier_id text);
    create table harvest_records(id uuid primary key default gen_random_uuid(),supplier_id text);
    insert into users values ('${uid}','Supplier A','supplier','active'),('firebase-supplier-B','Supplier B','supplier','active'),
      ('firebase-admin','Admin','admin','active'),('firebase-super','Super','super_admin','active'),
      ('firebase-suspended','Suspended','supplier','suspended');
    insert into farm_activities(user_id) values ('${uid}'),('firebase-supplier-B'),('firebase-suspended');
    insert into alerts(target_user_id,title) values ('${uid}','A'),('firebase-supplier-B','B');
    insert into stock_items values ('11111111-1111-4111-8111-111111111111','UREA','Urea','fertilizer','kg',100,95);
    alter table farm_activities enable row level security;
    create policy old_open_policy on farm_activities for all using(true) with check(true);
    grant all on farm_activities to anon,authenticated;
  `);
  await db.exec(sql("migration_security_helpers.sql"));
  await db.exec(sql("migration_stabilization.sql"));
  // Re-running must not fail or reopen access.
  await db.exec(sql("migration_security_helpers.sql"));
  await db.exec(sql("migration_stabilization.sql"));
});
afterAll(async () => { await db?.close(); });

describe("Firebase-backed database authorization", () => {
  it("uses text Firebase UIDs and replaces legacy open policies", async () => {
    const result = await asUser(uid, "select user_id from farm_activities");
    expect(result.rows).toEqual([{ user_id: uid }]);
  });
  it("rejects anonymous queries", async () => {
    await db.exec("reset role; set role anon;");
    await expect(db.query("select * from farm_activities")).rejects.toThrow();
  });
  it("blocks cross-supplier inserts and role escalation", async () => {
    await asUser(uid, "select 1");
    await expect(db.query("insert into farm_activities(user_id) values ('firebase-supplier-B')")).rejects.toThrow();
    expect((await db.query("update users set role='super_admin' where id='firebase-supplier-A' returning id")).rows).toEqual([]);
    await expect(db.query("insert into users values ('attacker','Attacker','super_admin','active')")).rejects.toThrow();
  });
  it("denies suspended and unprovisioned accounts", async () => {
    expect((await asUser("firebase-suspended", "select * from farm_activities")).rows).toEqual([]);
    expect((await db.query("select * from users")).rows).toEqual([]);
    expect((await asUser("unknown-firebase-user", "select * from farm_activities")).rows).toEqual([]);
    expect((await db.query("select * from users")).rows).toEqual([]);
  });
  it("allows own profile updates but protects other suppliers", async () => {
    await asUser(uid, `insert into supplier_profiles(user_id,name) values ('${uid}','Updated A')`);
    expect((await asUser("firebase-supplier-B", "select * from supplier_profiles")).rows).toEqual([]);
    await expect(db.query(`insert into supplier_profiles(user_id) values ('${uid}') on conflict(user_id) do update set name='Hacked'`)).rejects.toThrow();
  });
  it("allows own pending registration but prevents self-approval", async () => {
    await asUser(uid, `insert into estate_registration_requests(supplier_id,status) values ('${uid}','PENDING')`);
    await expect(db.query("update estate_registration_requests set status='APPROVED'")).rejects.toThrow();
    const result = await asUser("firebase-admin", "update estate_registration_requests set status='APPROVED' returning status");
    expect(result.rows).toEqual([{ status: "APPROVED" }]);
  });
  it("lets admins provision suppliers but not super admins", async () => {
    await asUser("firebase-admin", "insert into users values ('new-supplier','New','supplier','active')");
    await expect(db.query("insert into users values ('new-super','New','super_admin','active')")).rejects.toThrow();
  });
  it("isolates alerts", async () => {
    expect((await asUser(uid, "select title from alerts")).rows).toEqual([{ title: "A" }]);
    await expect(db.query("insert into alerts(target_user_id,title) values ('firebase-supplier-B','forged')")).rejects.toThrow();
  });
  it("issues fertilizer atomically with a UID-scoped ledger", async () => {
    await asUser("firebase-admin", "select issue_supplier_fertilizer('11111111-1111-4111-8111-111111111111','Supplier A',10,'credit')");
    expect((await db.query("select qty_on_hand from stock_items")).rows).toEqual([{ qty_on_hand: "90" }]);
    await expect(db.query("select issue_supplier_fertilizer('11111111-1111-4111-8111-111111111111','Supplier A',1000,'credit')")).rejects.toThrow("Insufficient stock");
    expect((await db.query("select count(*)::int as n from stock_movements")).rows).toEqual([{ n: 1 }]);
    expect((await asUser(uid, "select supplier_id,qty_issued from supplier_fertilizer_ledger")).rows).toEqual([{ supplier_id: uid, qty_issued: "10" }]);
    await expect(db.query("select issue_supplier_fertilizer('11111111-1111-4111-8111-111111111111','Supplier A',1,'cash')")).rejects.toThrow();
    expect((await asUser("firebase-supplier-B", "select * from supplier_fertilizer_ledger")).rows).toEqual([]);
  });
});
