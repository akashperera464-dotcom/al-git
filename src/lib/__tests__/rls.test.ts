import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "docs/migration_phase3_round12_production_hardening.sql"), "utf8");
describe("Round 12 RLS contract", () => {
  it("allows a supplier to read only owned estates", () => expect(sql).toMatch(/owner_supplier_id=public\.app_uid\(\)/));
  it("scopes collectors to today's assigned route", () => expect(sql).toMatch(/a\.collector_id=public\.app_uid\(\).*a\.route_id=harvest_records\.route_id.*a\.assignment_date=current_date/s));
  it("allows administrators through database role lookup", () => expect(sql).toMatch(/public\.app_role\(\) in \('admin','super_admin'\)/));
  it("does not expose operational data to an anonymous subject", () => expect(sql).toContain("public.app_uid() is not null"));
  it("uses the actual supplier_plots owner column", () => {
    expect(sql).toMatch(/supplier_plots_own[^;]+user_id=public\.app_uid\(\)/);
    expect(sql).not.toMatch(/supplier_plots_own[^;]+supplier_id=public\.app_uid\(\)/);
  });
  it("contains no permissive operational using(true) policy", () => {
    const operational = sql.match(/create policy (?!factories_registration_read|routes_registration_read)[^;]+;/gi) ?? [];
    expect(operational.join("\n")).not.toMatch(/using\s*\(true\)/i);
  });
});
