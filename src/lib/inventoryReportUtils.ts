import type { StockItem, StockMovement } from "./data";

export interface StockBalanceReportRow {
  stockItemId: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  openingQty: number;
  openingValue: number;
  receivedQty: number;
  receivedValue: number;
  issuedQty: number;
  issuedValue: number;
  closingQty: number;
  closingValue: number;
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function movementValue(movement: StockMovement): number {
  if (movement.isFreeIssue && movement.moveType === "in") return 0;
  return movement.qty * (movement.unitPriceAtTxn ?? movement.unitCost);
}

function inventorySign(movement: StockMovement): number {
  if (movement.moveType === "in") return 1;
  if (movement.moveType === "out") return -1;
  return 0;
}

/**
 * Builds the official stock roll-forward without another database table.
 *
 * Free-issue receipts increase physical quantity but contribute Rs 0. A void
 * movement is posted against the same report column as its original movement
 * (as a negative amount), so corrections do not masquerade as new GRNs/issues.
 * `qtyOnHand - ledger net` supplies a safe legacy opening quantity for stock
 * items that were created before opening-balance movements were introduced.
 */
export function calculateStockBalanceReport(
  items: StockItem[],
  movements: StockMovement[],
  startDate: string,
  endDate: string,
): StockBalanceReportRow[] {
  const start = `${startDate}T00:00:00.000Z`;
  const end = `${endDate}T23:59:59.999Z`;
  const movementById = new Map(movements.map((movement) => [movement.id, movement]));

  return items.map((item) => {
    const itemMovements = movements.filter((movement) => movement.stockItemId === item.id);
    const totalLedgerQty = itemMovements.reduce(
      (sum, movement) => sum + inventorySign(movement) * movement.qty,
      0,
    );
    const legacyOpeningQty = item.qtyOnHand - totalLedgerQty;
    let openingQty = legacyOpeningQty;
    let openingValue = legacyOpeningQty * item.unitCost;
    let receivedQty = 0;
    let receivedValue = 0;
    let issuedQty = 0;
    let issuedValue = 0;

    for (const movement of itemMovements) {
      const signedQty = inventorySign(movement) * movement.qty;
      const signedValue = inventorySign(movement) * movementValue(movement);
      if (movement.referenceType === "opening_balance" && movement.performedAt <= end) {
        openingQty += signedQty;
        openingValue += signedValue;
        continue;
      }
      if (movement.performedAt < start) {
        openingQty += signedQty;
        openingValue += signedValue;
        continue;
      }
      if (movement.performedAt > end) continue;

      if (movement.referenceType === "void" && movement.referenceId) {
        const original = movementById.get(movement.referenceId);
        if (original?.moveType === "in") {
          receivedQty -= movement.qty;
          receivedValue -= movementValue(original);
          continue;
        }
        if (original?.moveType === "out") {
          issuedQty -= movement.qty;
          issuedValue -= movementValue(original);
          continue;
        }
      }

      if (movement.moveType === "in") {
        receivedQty += movement.qty;
        receivedValue += movementValue(movement);
      } else if (movement.moveType === "out") {
        issuedQty += movement.qty;
        issuedValue += movementValue(movement);
      }
    }

    const closingQty = openingQty + receivedQty - issuedQty;
    const closingValue = openingValue + receivedValue - issuedValue;
    return {
      stockItemId: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      unit: item.unit,
      openingQty: money(openingQty),
      openingValue: money(openingValue),
      receivedQty: money(receivedQty),
      receivedValue: money(receivedValue),
      issuedQty: money(issuedQty),
      issuedValue: money(issuedValue),
      closingQty: money(closingQty),
      closingValue: money(closingValue),
    };
  });
}

export function createInventoryReference(prefix: "GRN" | "IN", date = new Date()): string {
  const day = date.toISOString().slice(0, 10).replace(/-/g, "");
  const time = date.toISOString().slice(11, 19).replace(/:/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${day}-${time}-${suffix}`;
}

