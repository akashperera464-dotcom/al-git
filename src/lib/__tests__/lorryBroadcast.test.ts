import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLorryBroadcast, routeTrackingTopic } from "../lorryBroadcast";
import { AI_ADVISORY_DISTANCE_KM, fallbackProximityAdvisory, shouldRequestProximityAdvisory } from "../openRouterAdvisory";

const routeId = "6d947f96-6ec5-4c55-9a46-cb9bc56ce8d7";

describe("private lorry Broadcast", () => {
  it("creates one unique topic per UUID route", () => {
    expect(routeTrackingTopic(routeId)).toBe(`route-tracking:${routeId}`);
    expect(() => routeTrackingTopic("route-name")).toThrow(/valid assigned route/i);
  });

  it("accepts only coordinates carrying the subscribed route id", () => {
    const payload = { routeId, driverId: "collector-1", latitude: 6.7056, longitude: 80.3847, timestamp: "2026-10-13T10:00:00.000Z", active: true };
    expect(parseLorryBroadcast(payload, routeId)).toMatchObject({ routeId, latitude: 6.7056, longitude: 80.3847, active: true });
    expect(parseLorryBroadcast(payload, "c5199245-a723-4bd0-b246-3f85b595bbdf")).toBeNull();
    expect(parseLorryBroadcast({ ...payload, latitude: 120 }, routeId)).toBeNull();
  });

  it("contains no lorry_locations database access in the active tracking path", () => {
    const broadcast = readFileSync(resolve(process.cwd(), "src/lib/lorryBroadcast.ts"), "utf8");
    const operations = readFileSync(resolve(process.cwd(), "src/lib/supplierOperations.ts"), "utf8");
    expect(broadcast).not.toContain("lorry_locations");
    expect(operations).not.toContain("lorry_locations");
  });

  it("ships private route-scoped publish and receive policies", () => {
    const sql = readFileSync(resolve(process.cwd(), "docs/migration_phase3_round13_realtime_lorry_broadcast.sql"), "utf8");
    expect(sql).toContain("on realtime.messages");
    expect(sql).toContain("for select");
    expect(sql).toContain("for insert");
    expect(sql).toContain("^route-tracking:");
    expect(sql).toContain("collector_route_assignments");
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });
});

describe("proximity advisory", () => {
  it("triggers only inside the 1.5 km boundary", () => {
    expect(AI_ADVISORY_DISTANCE_KM).toBe(1.5);
    expect(shouldRequestProximityAdvisory(1.49)).toBe(true);
    expect(shouldRequestProximityAdvisory(1.5)).toBe(false);
  });

  it("always has safe localized advice when the AI provider is unavailable", () => {
    expect(fallbackProximityAdvisory("si", 4)).toContain("විනාඩි 4");
    expect(fallbackProximityAdvisory("en", 4)).toContain("4 minutes");
    expect(fallbackProximityAdvisory("ta", 4)).toContain("4 நிமிடங்களில்");
  });
});
