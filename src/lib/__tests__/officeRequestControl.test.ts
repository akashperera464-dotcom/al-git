import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Office API request control", () => {
  it("defaults the server-enforced lorry control to OFF", () => {
    const branding = read("src/lib/branding.tsx");
    const proxy = read("server/factoryProxy.ts");
    expect(branding).toContain("officeLorryTrackingEnabled: false");
    expect(proxy).toContain('throw new Error("OFFICE_LORRY_DISABLED")');
    expect(proxy).toContain("officeLorryTrackingEnabled === true");
  });

  it("uses an explicit user action instead of 25-second Office GPS polling", () => {
    const tracking = read("src/modules/LorryTracking.tsx");
    expect(tracking).toContain("setMapOpen(true)");
    expect(tracking).toContain("requestLocation(false)");
    expect(tracking).not.toContain("25_000");
    expect(tracking).not.toMatch(/setInterval\(\(\) => void (poll|requestLocation)/);
  });

  it("protects Office data with longer client and server cache windows", () => {
    const client = read("src/lib/officeApi.ts");
    const proxy = read("server/factoryProxy.ts");
    expect(client).toContain("crop: 5 * 60_000");
    expect(client).toContain("balance: 10 * 60_000");
    expect(client).toContain("monthly: 15 * 60_000");
    expect(proxy).toContain("FACTORY_LOCATION_UNAVAILABLE: 300_000");
    expect(proxy).toContain("inFlightRequests");
  });

  it("does not background-sync Office API GET requests", () => {
    const worker = read("public/sw.ts");
    expect(worker).not.toContain("/api/lorry");
    expect(worker).not.toContain("/api/crop");
    expect(worker).not.toContain("/api/balance");
    expect(worker).not.toContain("/api/monthly");
  });
});
