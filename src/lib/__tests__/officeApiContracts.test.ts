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
