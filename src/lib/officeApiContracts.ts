export interface OfficeMonthBalance {
  monthName: string;
  superLeafQty: number;
  superLeafRate: number;
  superLeafGross: number;
  normalLeafQty: number;
  normalLeafRate: number;
  normalLeafGross: number;
  totalGrossPay: number;
  totalDeduction: number;
  balance: number;
  deductions: Record<string, number>;
}

export interface OfficeBalanceResponse {
  source: "office-api";
  fetchedAt: string;
  factoryCode: string;
  factoryName: string;
  routeCode: string;
  routeName: string;
  supplierId: string;
  previousMonth: OfficeMonthBalance;
  currentMonth: OfficeMonthBalance;
}

export interface OfficeLeafDelivery {
  date: string;
  superLeafQty: number;
  normalLeafQty: number;
  totalQty: number;
}

export interface OfficeLeafResponse {
  source: "office-api";
  fetchedAt: string;
  factoryCode: string;
  routeCode: string;
  supplierId: string;
  monthName: string;
  deliveries: OfficeLeafDelivery[];
  totals: { superLeafQty: number; normalLeafQty: number; totalQty: number; deliveryCount: number };
}

export interface OfficeLorryResponse {
  source: "office-api";
  fetchedAt: string;
  latitude: number;
  longitude: number;
  axisMapping: "y-latitude/x-longitude";
  correctedLongitudeSign: boolean;
}

const numberValue = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const textValue = (value: unknown): string => String(value ?? "").trim();

export function parseOfficeDate(value: unknown): string {
  const raw = textValue(value);
  const match = /^(\d{1,2})[-/]([0-1]?\d)[-/](\d{4})$/.exec(raw);
  if (!match) return raw;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

export function normalizeOfficeLeaf(raw: unknown, fetchedAt = new Date().toISOString()): OfficeLeafResponse {
  if (!raw || typeof raw !== "object") throw new Error("Factory leaf API returned an invalid response.");
  const source = raw as Record<string, unknown>;
  const rows = Array.isArray(source.leafData) ? source.leafData : [];
  const deliveries = rows.map((item): OfficeLeafDelivery => {
    const row = (item ?? {}) as Record<string, unknown>;
    const superLeafQty = numberValue(row.superLeafQty);
    const normalLeafQty = numberValue(row.normalLeafQty);
    return { date: parseOfficeDate(row.date), superLeafQty, normalLeafQty, totalQty: superLeafQty + normalLeafQty };
  });
  const totals = deliveries.reduce((sum, row) => ({
    superLeafQty: sum.superLeafQty + row.superLeafQty,
    normalLeafQty: sum.normalLeafQty + row.normalLeafQty,
    totalQty: sum.totalQty + row.totalQty,
    deliveryCount: sum.deliveryCount + 1,
  }), { superLeafQty: 0, normalLeafQty: 0, totalQty: 0, deliveryCount: 0 });
  return {
    source: "office-api", fetchedAt,
    factoryCode: textValue(source.factoryCode), routeCode: textValue(source.routeCode),
    supplierId: textValue(source.regNo), monthName: textValue(source.monthName), deliveries, totals,
  };
}

const DEDUCTION_FIELDS = [
  "fertilizerLMB", "fertilizerThisMonthInstalment", "advanceATM", "advancePOS", "advanceRoute",
  "advanceOffice", "loanInterest", "tea", "loanInstallment", "bankLoan", "transport", "otherDeduction", "lmDebt",
] as const;

function normalizeMonth(raw: unknown): OfficeMonthBalance {
  const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    monthName: textValue(row.monthName),
    superLeafQty: numberValue(row.slQty), superLeafRate: numberValue(row.slRate), superLeafGross: numberValue(row.slGrossPay),
    normalLeafQty: numberValue(row.nlQty), normalLeafRate: numberValue(row.nlRate), normalLeafGross: numberValue(row.nlGrossPay),
    totalGrossPay: numberValue(row.totalGrossPay), totalDeduction: numberValue(row.totalDeduction), balance: numberValue(row.balance),
    deductions: Object.fromEntries(DEDUCTION_FIELDS.map((field) => [field, numberValue(row[field])])),
  };
}

export function normalizeOfficeBalance(raw: unknown, fetchedAt = new Date().toISOString()): OfficeBalanceResponse {
  if (!raw || typeof raw !== "object") throw new Error("Factory balance API returned an invalid response.");
  const source = raw as Record<string, unknown>;
  return {
    source: "office-api", fetchedAt,
    factoryCode: textValue(source.factoryCode), factoryName: textValue(source.factoryName),
    routeCode: textValue(source.routeCode), routeName: textValue(source.routeName), supplierId: textValue(source.regNo),
    previousMonth: normalizeMonth(source.lm), currentMonth: normalizeMonth(source.cm),
  };
}

/** Parse the factory's non-JSON `{y: 6.66<br>x: - 80.46}` response safely. */
export function parseOfficeLorry(raw: string, fetchedAt = new Date().toISOString()): OfficeLorryResponse {
  const cleaned = raw.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, " ");
  const yMatch = /(?:^|[,{\s])y\s*:\s*([+-]?\s*\d+(?:\.\d+)?)/i.exec(cleaned);
  const xMatch = /(?:^|[,{\s])x\s*:\s*([+-]?\s*\d+(?:\.\d+)?)/i.exec(cleaned);
  if (!yMatch || !xMatch) throw new Error("Factory lorry API returned an unrecognized coordinate format.");
  const latitude = Number(yMatch[1].replace(/\s+/g, ""));
  const rawLongitude = Number(xMatch[1].replace(/\s+/g, ""));
  const correctedLongitudeSign = rawLongitude < 0;
  const longitude = Math.abs(rawLongitude);
  // Sri Lanka bounds with a small operational margin. This also prevents an
  // accidental axis swap from placing the marker in an unrelated country.
  if (latitude < 5.5 || latitude > 10.2 || longitude < 79 || longitude > 82.5) {
    throw new Error("Factory lorry coordinates are outside Sri Lanka bounds.");
  }
  return { source: "office-api", fetchedAt, latitude, longitude, axisMapping: "y-latitude/x-longitude", correctedLongitudeSign };
}
