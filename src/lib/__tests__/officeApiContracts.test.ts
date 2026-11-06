import { describe, expect, it } from "vitest";
import { normalizeOfficeBalance, normalizeOfficeFactoryApiCode, normalizeOfficeLeaf, parseOfficeLorry } from "../officeApiContracts";

describe("factory office API contracts", () => {
  it("converts full office factory codes to the legacy leaf API segment", () => {
    expect(normalizeOfficeFactoryApiCode("0101")).toBe("01");
    expect(normalizeOfficeFactoryApiCode("0105")).toBe("05");
    expect(normalizeOfficeFactoryApiCode("01")).toBe("01");
  });

  it("sanitizes the dirty lorry payload and corrects the longitude sign", () => {
    expect(parseOfficeLorry("{y: 6.663675<br>x: - 80.4657916}", "2026-10-28T00:00:00.000Z")).toEqual({
      source: "office-api", fetchedAt: "2026-10-28T00:00:00.000Z",
      latitude: 6.663675, longitude: 80.4657916,
      axisMapping: "y-latitude/x-longitude", correctedLongitudeSign: true,
    });
  });

  it("accepts JSON, nested payloads and either X/Y axis order", () => {
    expect(parseOfficeLorry('{"data":{"latitude":"6.7123","longitude":"80.4456"}}').latitude).toBe(6.7123);
    expect(parseOfficeLorry('[{"X":"6.701","Y":"80.401"}]')).toMatchObject({ latitude: 6.701, longitude: 80.401 });
    expect(parseOfficeLorry('{"X":"-80.401","Y":"6.701"}')).toMatchObject({ latitude: 6.701, longitude: 80.401, correctedLongitudeSign: true });
    expect(parseOfficeLorry('lat=6.7001; lng=80.4002')).toMatchObject({ latitude: 6.7001, longitude: 80.4002 });
  });

  it("recognizes an empty/no-location response separately from malformed coordinates", () => {
    expect(() => parseOfficeLorry("No location found")).toThrow("FACTORY_LOCATION_UNAVAILABLE");
    expect(() => parseOfficeLorry("[]")).toThrow("FACTORY_LOCATION_UNAVAILABLE");
  });

  it("rejects coordinates outside Sri Lanka instead of plotting bad data", () => {
    expect(() => parseOfficeLorry("{y: 50<br>x: 10}")).toThrow(/outside Sri Lanka/);
  });

  it("normalizes daily leaf quantities and totals", () => {
    const result = normalizeOfficeLeaf({ factoryCode: "01", routeCode: "01", regNo: 1, monthName: "October 2026", leafData: [
      { date: "14-10-2026", superLeafQty: 0, normalLeafQty: 25 },
      { date: "16-10-2026", superLeafQty: 0, normalLeafQty: 50 },
    ] }, "now");
    expect(result.deliveries[0].date).toBe("2026-10-14");
    expect(result.totals).toEqual({ superLeafQty: 0, normalLeafQty: 75, totalQty: 75, deliveryCount: 2 });
  });

  it("normalizes the current balance response", () => {
    const result = normalizeOfficeBalance({ factoryCode: "01", factoryName: "Factory", routeCode: "01", routeName: "Route", regNo: 1,
      lm: {}, cm: { monthName: "October 2026", slQty: 0, slRate: 170, nlQty: 75, nlRate: 155, totalGrossPay: 11625, totalDeduction: 0, balance: 11625 },
    }, "now");
    expect(result.currentMonth.normalLeafQty).toBe(75);
    expect(result.currentMonth.balance).toBe(11625);
  });
});
