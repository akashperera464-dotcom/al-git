import { describe, expect, it } from "vitest";
import { calculateDistance, calculateEta, DEFAULT_RURAL_SPEED_KMH, shouldSendGeofenceNotification } from "../etaCalculation";

describe("lorry ETA and geofence", () => {
  it("calculates precise Haversine distance", () => {
    expect(calculateDistance(0, 0, 0, 1)).toBeCloseTo(111.195, 3);
    expect(calculateDistance(6.7056, 80.3847, 6.7056, 80.3847)).toBe(0);
  });

  it("rejects invalid GPS coordinates", () => {
    expect(() => calculateDistance(91, 80.4, 6.7, 80.4)).toThrow(RangeError);
    expect(() => calculateDistance(6.7, 181, 6.7, 80.4)).toThrow(RangeError);
  });

  it("uses the rural-road average and marks a point under 500m as arrived", () => {
    const result = calculateEta({ latitude: 6.7, longitude: 80.4 }, { latitude: 6.702, longitude: 80.4 });
    expect(result.averageSpeedKmh).toBe(DEFAULT_RURAL_SPEED_KMH);
    expect(result.arrived).toBe(true);
  });

  it("calculates ETA in minutes from distance and speed", () => {
    const result = calculateEta({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.02473 }, 30);
    expect(result.distanceKm).toBeCloseTo(2.75, 1);
    expect(result.etaMinutes).toBe(6);
  });

  it("limits a supplier alert to once per Colombo day", () => {
    expect(shouldSendGeofenceNotification(0.7, "2026-10-12T04:00:00Z", new Date("2026-10-12T08:00:00Z"))).toBe(false);
  });
});
