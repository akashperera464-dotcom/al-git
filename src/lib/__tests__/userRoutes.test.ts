import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("../supabase", () => ({
  supabaseConfigured: true,
  getSupabase: () => ({ rpc: mocks.rpc }),
}));

import { normalizeRouteSelection, replaceUserRoutesBestEffort } from "../userRoutes";

beforeEach(() => {
  mocks.rpc.mockReset();
});

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

  it("ships the junction table, safe backfills and integrity triggers for the Free-plan architecture", () => {
    const sql = readFileSync(resolve(process.cwd(), "docs/migration_phase3_round14_multi_route_users.sql"), "utf8").toLowerCase();
    expect(sql).toContain("create table if not exists public.user_route_assignments");
    expect(sql).toContain("round_14_estate_backfill");
    expect(sql).toContain("create or replace function public.set_user_routes");
    expect(sql).toContain("validate_collector_authorized_route");
    expect(sql).toContain("validate_supplier_estate_route");
    expect(sql).toContain("disable row level security");
    expect(sql).toContain("u.role::text='supplier'");
    expect(sql).not.toContain("caller_role text:=public.app_role()");
    expect(sql).not.toContain("values(public.app_uid()");
  });

  it("includes an idempotent production hotfix for the obsolete JWT route guard", () => {
    const sql = readFileSync(resolve(process.cwd(), "docs/migration_phase3_round15_route_assignment_hotfix.sql"), "utf8").toLowerCase();
    expect(sql).toContain("create or replace function public.set_user_routes");
    expect(sql).toContain("alter table if exists public.user_route_assignments disable row level security");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).not.toContain("public.app_role()");
    expect(sql).not.toContain("public.app_uid()");
  });
});

describe("replaceUserRoutesBestEffort (supplier self-registration)", () => {
  const input = {
    userId: "uid-1",
    factoryId: "factory-1",
    routeIds: ["route-a", "route-b"],
    primaryRouteId: "route-a",
    registrationEmail: "New@KDU.com",
  };

  it("succeeds on the first RPC call", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(replaceUserRoutesBestEffort(input)).resolves.toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("set_user_routes", expect.objectContaining({
      p_user_id: "uid-1",
      p_route_ids: ["route-a", "route-b"],
      p_primary_route_id: "route-a",
      p_registration_email: "new@kdu.com",
    }));
  });

  it("recovers when the first RPC call hits a transient fault", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: { message: "network hiccup" } })
      .mockResolvedValueOnce({ data: null, error: null });
    await expect(replaceUserRoutesBestEffort(input)).resolves.toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("degrades to an admin follow-up outcome instead of orphaning the account", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "function set_user_routes does not exist" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const outcome = await replaceUserRoutesBestEffort(input);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain("Could not save route assignments");
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
