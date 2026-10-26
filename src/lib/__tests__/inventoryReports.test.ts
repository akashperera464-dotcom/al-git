import { describe, expect, it } from "vitest";
import type { StockItem, StockMovement } from "../data";
import { calculateStockBalanceReport } from "../inventoryReportUtils";

const item: StockItem = {
  id: "fert-1", code: "FERT-001", name: "Tea fertilizer", category: "fertilizer",
  unit: "kg", qtyOnHand: 115, reorderLevel: 10, unitCost: 9.48, version: 1,
};

const movement = (overrides: Partial<StockMovement>): StockMovement => ({
  id: "movement", stockItemId: item.id, moveType: "in", qty: 1, unitCost: 1,
  performedAt: "2026-10-01T08:00:00.000Z", ...overrides,
});

describe("inventory stock balance reports", () => {
  it("counts free-issued GRN quantity at zero purchase value", () => {
    const movements: StockMovement[] = [
      movement({ id: "opening", referenceType: "opening_balance", qty: 100, unitCost: 10 }),
      movement({ id: "paid", referenceType: "grn", performedAt: "2026-10-05T08:00:00.000Z", qty: 20, unitCost: 12 }),
      movement({ id: "free", referenceType: "grn", performedAt: "2026-10-06T08:00:00.000Z", qty: 10, unitCost: 99, isFreeIssue: true }),
      movement({ id: "issue", moveType: "out", referenceType: "issue", performedAt: "2026-10-07T08:00:00.000Z", qty: 15, unitCost: 10 }),
    ];

    const [row] = calculateStockBalanceReport([item], movements, "2026-10-01", "2026-10-31");
    expect(row.openingQty).toBe(100);
    expect(row.receivedQty).toBe(30);
    expect(row.receivedValue).toBe(240);
    expect(row.issuedQty).toBe(15);
    expect(row.closingQty).toBe(115);
    expect(row.closingValue).toBe(1090);
  });

  it("posts voids against their original report column", () => {
    const movements: StockMovement[] = [
      movement({ id: "opening", referenceType: "opening_balance", qty: 100, unitCost: 10 }),
      movement({ id: "paid", referenceType: "grn", performedAt: "2026-10-05T08:00:00.000Z", qty: 20, unitCost: 12 }),
      movement({ id: "issue", moveType: "out", referenceType: "issue", performedAt: "2026-10-07T08:00:00.000Z", qty: 5, unitCost: 10 }),
      movement({ id: "void-issue", moveType: "in", referenceType: "void", referenceId: "issue", performedAt: "2026-10-08T08:00:00.000Z", qty: 5, unitCost: 10 }),
    ];
    const adjustedItem = { ...item, qtyOnHand: 120 };
    const [row] = calculateStockBalanceReport([adjustedItem], movements, "2026-10-01", "2026-10-31");
    expect(row.receivedQty).toBe(20);
    expect(row.issuedQty).toBe(0);
    expect(row.closingQty).toBe(120);
    expect(row.closingValue).toBe(1240);
  });

  it("uses current stock to recover legacy opening quantities missing a movement", () => {
    const legacyItem = { ...item, qtyOnHand: 55, unitCost: 8 };
    const movements = [movement({ id: "legacy-issue", moveType: "out", referenceType: "issue", qty: 5, unitCost: 8 })];
    const [row] = calculateStockBalanceReport([legacyItem], movements, "2026-10-01", "2026-10-31");
    expect(row.openingQty).toBe(60);
    expect(row.issuedQty).toBe(5);
    expect(row.closingQty).toBe(55);
  });
});
