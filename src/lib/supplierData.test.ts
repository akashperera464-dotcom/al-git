import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ calls: [] as Array<[string, ...unknown[]]>, responses: [] as unknown[] }));
vi.mock("./supabase", () => ({ getSupabase: () => ({ from: (table: string) => {
  m.calls.push(["from", table]);
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "range", "maybeSingle", "upsert"]) {
    chain[method] = (...args: unknown[]) => { m.calls.push([method, ...args]); return chain; };
  }
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(m.responses.shift()).then(resolve);
  return chain;
} }) }));
import { readSupplierLedger, readSupplierActivities, readSupplierPlot, saveSupplierProfile } from "./supplierData";
beforeEach(() => { m.calls.length = 0; m.responses.length = 0; });
it("filters fertilizer by UID and maps issue_date", async () => {
  m.responses.push({ data: [{ id: "1", supplier_name: "Same Name", qty_issued: "12", issue_date: "2026-10-10", unit: "kg" }], error: null });
  expect((await readSupplierLedger("supplier-B"))[0]).toMatchObject({ qtyIssued: 12, date: "2026-10-10" });
  expect(m.calls).toContainEqual(["eq", "supplier_id", "supplier-B"]);
  expect(m.calls).toContainEqual(["order", "issue_date", { ascending: false }]);
});
it("reports database failures instead of showing stale local data", async () => {
  m.responses.push({ data: null, error: { message: "permission denied" } });
  await expect(readSupplierLedger("supplier-A")).rejects.toThrow("permission denied");
});
it("returns an authoritative zero when farm activities are empty", async () => {
  m.responses.push({ data: [], error: null });
  expect(await readSupplierActivities("supplier-A")).toEqual([]);
  expect(m.calls).toContainEqual(["eq", "user_id", "supplier-A"]);
});
it("aggregates approved field acreage and preserves zero-valued GPS", async () => {
  m.responses.push({ data: [
    { id: "a", name: "Plot", area_ha: "2", latitude: "0", longitude: "0", divisions: { estates: { region: "low-country" } } },
    { id: "b", area_ha: "1", latitude: null, longitude: null },
  ], error: null });
  expect((await readSupplierPlot("supplier-A"))[0]).toMatchObject({ acreage: 3 * 2.471, latitude: 0, longitude: 0 });
});
it("surfaces profile save failures", async () => {
  m.responses.push({ error: { message: "offline" } });
  await expect(saveSupplierProfile("supplier-A", {
    name: "A", phone: "", nic: "", address: "", emergencyContact: "", photoUrl: "",
    notificationPrefs: { paymentAlerts: true, requestAlerts: true, announcementAlerts: true, weatherAlerts: true, advisoryAlerts: true },
  })).rejects.toThrow("offline");
});
