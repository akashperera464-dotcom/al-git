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
  axisMapping: "y-latitude/x-longitude" | "x-latitude/y-longitude" | "named-latitude/longitude";
  correctedLongitudeSign: boolean;
}

const numberValue = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

const textValue = (value: unknown): string => String(value ?? "").trim();

/**
 * The office master list uses full codes such as 0101..0105, while the legacy
 * leaf API accepts their two-digit factory segment (01..05).
 */
export function normalizeOfficeFactoryApiCode(value: unknown): string {
  const code = textValue(value).replace(/\s+/g, "");
  return /^01\d{2}$/.test(code) ? code.slice(-2) : code;
}

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

const SRI_LANKA_LATITUDE = { min: 5.5, max: 10.2 } as const;
const SRI_LANKA_LONGITUDE = { min: 79, max: 82.5 } as const;

function coordinateNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const match = /[+-]?\s*\d+(?:\.\d+)?/.exec(value.replace(/,/g, ""));
  if (!match) return null;
  const parsed = Number(match[0].replace(/\s+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function inLatitudeBounds(value: number): boolean {
  return value >= SRI_LANKA_LATITUDE.min && value <= SRI_LANKA_LATITUDE.max;
}

function inLongitudeBounds(value: number): boolean {
  const absolute = Math.abs(value);
  return absolute >= SRI_LANKA_LONGITUDE.min && absolute <= SRI_LANKA_LONGITUDE.max;
}

function lorryResponse(
  latitude: number,
  rawLongitude: number,
  fetchedAt: string,
  axisMapping: OfficeLorryResponse["axisMapping"],
): OfficeLorryResponse {
  if (!inLatitudeBounds(latitude) || !inLongitudeBounds(rawLongitude)) {
    throw new Error("Factory lorry coordinates are outside Sri Lanka bounds.");
  }
  return {
    source: "office-api", fetchedAt, latitude, longitude: Math.abs(rawLongitude),
    axisMapping, correctedLongitudeSign: rawLongitude < 0,
  };
}

function objectCoordinatePair(value: unknown): { latitude: number; longitude: number; axisMapping: OfficeLorryResponse["axisMapping"] } | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = objectCoordinatePair(item);
      if (result) return result;
    }
    return null;
  }
  const source = value as Record<string, unknown>;
  const normalized = new Map(Object.entries(source).map(([key, item]) => [key.toLowerCase().replace(/[^a-z]/g, ""), item]));
  const first = (...keys: string[]) => keys.map((key) => normalized.get(key)).find((item) => item != null);
  const namedLatitude = coordinateNumber(first("latitude", "lat"));
  const namedLongitude = coordinateNumber(first("longitude", "lng", "lon", "long"));
  if (namedLatitude != null && namedLongitude != null) return { latitude: namedLatitude, longitude: namedLongitude, axisMapping: "named-latitude/longitude" };

  const x = coordinateNumber(first("x"));
  const y = coordinateNumber(first("y"));
  if (x != null && y != null) {
    if (inLatitudeBounds(y) && inLongitudeBounds(x)) return { latitude: y, longitude: x, axisMapping: "y-latitude/x-longitude" };
    if (inLatitudeBounds(x) && inLongitudeBounds(y)) return { latitude: x, longitude: y, axisMapping: "x-latitude/y-longitude" };
  }

  for (const item of Object.values(source)) {
    const result = objectCoordinatePair(item);
    if (result) return result;
  }
  return null;
}

function textCoordinate(cleaned: string, labels: string[]): number | null {
  const label = labels.join("|");
  const match = new RegExp(`(?:^|[,;{\\s\"'])(${label})\\s*[=:]\\s*[\"']?([+-]?\\s*\\d+(?:\\.\\d+)?)`, "i").exec(cleaned);
  return coordinateNumber(match?.[2]);
}

/**
 * Parse both the legacy `{y: 6.66<br>x: -80.46}` payload and newer JSON/text
 * coordinate variants. The factory has used inconsistent X/Y signs and axis
 * order, so Sri Lankan geographic bounds are the final safety check.
 */
export function parseOfficeLorry(raw: string, fetchedAt = new Date().toISOString()): OfficeLorryResponse {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed || /^(?:null|false|\[\s*\]|\{\s*\})$/i.test(trimmed)
    || /\b(?:no\s*(?:data|record|location)|not\s*found|location\s*unavailable)\b/i.test(trimmed)) {
    throw new Error("FACTORY_LOCATION_UNAVAILABLE");
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const pair = objectCoordinatePair(parsed);
    if (pair) return lorryResponse(pair.latitude, pair.longitude, fetchedAt, pair.axisMapping);
  } catch (error) {
    if (error instanceof Error && error.message.includes("outside Sri Lanka")) throw error;
    // The historical office response is deliberately non-JSON; continue with
    // the tolerant text parser when JSON decoding fails.
  }

  const cleaned = trimmed
    .replace(/&minus;|&#8722;/gi, "-")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ");
  const namedLatitude = textCoordinate(cleaned, ["latitude", "lat"]);
  const namedLongitude = textCoordinate(cleaned, ["longitude", "lng", "lon", "long"]);
  if (namedLatitude != null && namedLongitude != null) return lorryResponse(namedLatitude, namedLongitude, fetchedAt, "named-latitude/longitude");

  const x = textCoordinate(cleaned, ["x"]);
  const y = textCoordinate(cleaned, ["y"]);
  if (x != null && y != null) {
    if (inLatitudeBounds(y) && inLongitudeBounds(x)) return lorryResponse(y, x, fetchedAt, "y-latitude/x-longitude");
    if (inLatitudeBounds(x) && inLongitudeBounds(y)) return lorryResponse(x, y, fetchedAt, "x-latitude/y-longitude");
    throw new Error("Factory lorry coordinates are outside Sri Lanka bounds.");
  }
  throw new Error("Factory lorry API returned an unrecognized coordinate format.");
}
