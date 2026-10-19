import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectorWeatherAdvisory, fetchForecast, totalRainfallMm, weatherStatusText } from "../weather";
import { chooseSupplierWeatherEstate, chooseWeatherEstate, mergeSupplierWeatherEstates } from "../useEstateWeather";
import type { Estate } from "../estateRepo";
import type { WeatherDay } from "../data";

const estate = (id: string, status: Estate["status"], latitude?: number): Estate => ({
  id, ownerSupplierId: "supplier-1", name: id, sizeCategory: "small", acreage: 1, bushCount: 100,
  latitude, longitude: latitude === undefined ? undefined : 80.5, status, submittedAt: "2026-10-19",
  editCount: 0, createdByAdmin: false, blocks: [],
});

describe("estate weather integration", () => {
  it("totals observed rain without adding a phantom millimetre", () => {
    expect(totalRainfallMm([{ rain: { "3h": 1.4 } }, {}, { rain: { "3h": 2.4 } }])).toBe(4);
    expect(totalRainfallMm([{}, {}])).toBe(0);
  });

  it("does not silently use another location when estate GPS is missing", async () => {
    const result = await fetchForecast(undefined, undefined);
    expect(result.status).toBe("missing-coordinates");
    expect(weatherStatusText(result.status, result.days.length)).toContain("GPS missing");
  });

  it("prefers the saved multi-estate selection, then a GPS-ready approved estate", () => {
    const rows = [estate("pending", "pending", 6.1), estate("approved-no-gps", "approved"), estate("approved-gps", "approved", 6.9)];
    expect(chooseWeatherEstate(rows.filter((row) => row.status === "approved"), "pending")?.id).toBe("approved-gps");
    expect(chooseWeatherEstate(rows)?.id).toBe("approved-gps");
  });

  it("uses a newly admin-linked estate instead of a stale device selection", () => {
    const rows = [estate("old-selection", "approved", 6.1), estate("new-admin-link", "approved", 6.9)];
    expect(chooseSupplierWeatherEstate(rows, "old-selection", "previous-link", "new-admin-link")?.id).toBe("new-admin-link");
    expect(chooseSupplierWeatherEstate(rows, "old-selection", "new-admin-link", "new-admin-link")?.id).toBe("old-selection");
  });

  it("includes the explicit profile-linked estate when the ownership query omits it", () => {
    const owned = [estate("owned", "approved", 6.1)];
    const linked = estate("profile-link", "approved", 6.9);
    expect(mergeSupplierWeatherEstates(owned, linked).map((row) => row.id)).toEqual(["profile-link", "owned"]);
    expect(mergeSupplierWeatherEstates(owned, owned[0])).toHaveLength(1);
  });

  it("turns risky route weather into a collector warning", () => {
    const day: WeatherDay = { date: "2026-10-19", dayName: "Mon", tempMax: 22, tempMin: 16, rainMm: 24, rainProb: 80, windKph: 38, condition: "Heavy Rain", icon: "CloudRain" };
    expect(collectorWeatherAdvisory(day).tone).toBe("rose");
  });

  it("connects live weather instead of hardcoded header/default-location decisions", () => {
    const shell = readFileSync(resolve(process.cwd(), "src/components/Shell.tsx"), "utf8");
    const farm = readFileSync(resolve(process.cwd(), "src/modules/FarmActivities.tsx"), "utf8");
    const dashboard = readFileSync(resolve(process.cwd(), "src/modules/Dashboard.tsx"), "utf8");

    expect(shell).not.toContain(">21°C<");
    expect(shell).toContain("SupplierWeatherMonitor");
    expect(farm).not.toContain("fetchForecast(undefined, undefined)");
    expect(dashboard).not.toContain("currentWeather.temp");
  });
});
