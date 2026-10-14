import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "docs/migration_phase3_round15_connected_operations.sql"), "utf8");
const client = readFileSync(resolve(process.cwd(), "src/lib/supabase.ts"), "utf8");
const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

describe("Free-plan production architecture contract", () => {
  it("never injects a Firebase JWT into the Supabase client", () => {
    expect(client).not.toMatch(/accessToken\s*:/);
  });
  it("keeps Round 15 independent from JWT identity helpers", () => {
    const executableSql = sql.replace(/^\s*--.*$/gm, "");
    expect(executableSql).not.toMatch(/auth\.uid\(|app_uid\(|app_role\(/);
  });
  it("uses anon-compatible access for every new operational table", () => {
    for (const table of ["operational_requests", "collection_route_stops", "month_end_closures", "supplier_profiles", "user_device_sessions", "system_health_events"]) {
      expect(sql).toContain(`alter table public.${table} disable row level security`);
      expect(sql).toMatch(new RegExp(`grant select,insert,update,delete on public\\.${table} to anon,authenticated`));
    }
  });
  it("adds supplier fertilizer and agrochemical request values", () => {
    expect(sql).toContain("add value if not exists 'Fertilizer'");
    expect(sql).toContain("add value if not exists 'Agrochemical'");
  });
  it("preserves audit history for delivery corrections", () => {
    expect(sql).toContain("record_status text not null default 'valid'");
    expect(sql).toContain("void_reason text");
  });
  it("does not drop and recreate audit triggers on live production tables", () => {
    expect(sql).not.toContain("drop trigger if exists trg_audit_difference");
    expect(sql).toContain("array['operational_requests','collection_route_stops','month_end_closures','supplier_profiles','user_device_sessions']");
  });
  it("prevents automatic iPhone focus zoom without disabling pinch zoom", () => {
    expect(css).toMatch(/font-size:\s*16px/);
    expect(css).not.toMatch(/user-scalable=no/);
  });
});
