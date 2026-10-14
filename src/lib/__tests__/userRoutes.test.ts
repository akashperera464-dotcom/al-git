import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeRouteSelection } from "../userRoutes";

describe("multi-route user assignments", () => {
  it("deduplicates routes while retaining the first selected route as primary", () => {
    expect(normalizeRouteSelection(["route-a", "route-b", "route-a"])).toEqual({
      routeIds: ["route-a", "route-b"],
      primaryRouteId: "route-a",
    });
  });

  it("honours an explicitly selected primary route", () => {
    expect(normalizeRouteSelection(["route-a", "route-b"], "route-b").primaryRouteId).toBe("route-b");
  });

  it("rejects an empty route selection", () => {
    expect(() => normalizeRouteSelection(["", "  "])).toThrow("Select at least one route");
  });

  it("ships the junction table, safe backfills, route-scoped RLS and integrity triggers", () => {
    const sql = readFileSync(resolve(process.cwd(), "docs/migration_phase3_round14_multi_route_users.sql"), "utf8").toLowerCase();
    expect(sql).toContain("create table if not exists public.user_route_assignments");
    expect(sql).toContain("round_14_estate_backfill");
    expect(sql).toContain("create or replace function public.set_user_routes");
    expect(sql).toContain("validate_collector_authorized_route");
    expect(sql).toContain("validate_supplier_estate_route");
    expect(sql).toContain("user_routes_own_read");
    expect(sql).toContain("u.role::text='supplier'");
    expect(sql).not.toMatch(/user_route_assignments[^;]*using\s*\(\s*true\s*\)/s);
  });
});
