import { describe, expect, it } from "vitest";
import type { OfficeBalanceResponse, OfficeLeafResponse } from "../officeApiContracts";
import { findOfficeDeliveryForDate, getOfficeCropComparison, getOfficeDeductionLines, sumOfficeDeductionsByGroup, yesterdaySriLankaIso } from "../officeSupplierSummary";

const crop = { totals: { totalQty: 202, normalLeafQty: 202, superLeafQty: 0, deliveryCount: 8 }, deliveries: [{ date: "2026-10-29", normalLeafQty: 36, superLeafQty: 0, totalQty: 36 }] } as unknown as OfficeLeafResponse;
const balance = { currentMonth: { normalLeafQty: 180, superLeafQty: 0, deductions: { advanceOffice: 3000, fertilizerThisMonthInstalment: 5800, transport: 720 }, totalDeduction: 9520 } } as unknown as OfficeBalanceResponse;

describe("supplier office summary helpers", () => {
  it("keeps current crop and account statement quantities separate", () => {
    expect(getOfficeCropComparison(crop, balance)).toEqual({ currentCropKg: 202, statementKg: 180, differenceKg: 22 });
  });

  it("builds itemized non-zero deductions and group totals", () => {
    expect(getOfficeDeductionLines(balance.currentMonth)).toHaveLength(3);
    expect(sumOfficeDeductionsByGroup(balance.currentMonth, "advance")).toBe(3000);
    expect(sumOfficeDeductionsByGroup(balance.currentMonth, "fertilizer")).toBe(5800);
  });

  it("uses the Colombo calendar day for yesterday and daily lookup", () => {
    expect(yesterdaySriLankaIso(new Date("2026-10-29T20:00:00.000Z"))).toBe("2026-10-29");
    expect(findOfficeDeliveryForDate(crop, "2026-10-29")?.totalQty).toBe(36);
  });
});
