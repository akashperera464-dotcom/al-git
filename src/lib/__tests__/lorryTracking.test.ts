import { describe, expect, it } from "vitest";
import { calculateEta, shouldSendGeofenceNotification } from "../etaCalculation";
describe("lorry ETA and geofence", () => { it("marks a point under 500m as arrived", () => { expect(calculateEta({ latitude: 6.7, longitude: 80.4 }, { latitude: 6.702, longitude: 80.4 }).arrived).toBe(true); }); it("limits a supplier alert to once per Colombo day", () => { expect(shouldSendGeofenceNotification(0.7, "2026-10-12T04:00:00Z", new Date("2026-10-12T08:00:00Z"))).toBe(false); }); });
