import type { OfficeBalanceResponse, OfficeLeafResponse } from "../src/lib/officeApiContracts.js";
import { getFactoryDataForUser, verifyFirebaseUser } from "./factoryProxy.js";

export type ServiceRequestType = "cash_advance" | "tea_packet" | "fertilizer";
export type ServiceRequestStatus = "pending" | "approved" | "rejected" | "fulfilled";

export interface RequestCatalogItem {
  code: string;
  label: string;
  unit: string;
  maxQuantity: number;
}

export interface ServiceRequestPolicy {
  enabled: boolean;
  baseRatePerKg: number;
  advancePercentage: number;
  maxAdvanceAmount: number;
  teaPackets: RequestCatalogItem[];
  fertilizers: RequestCatalogItem[];
}

export interface EligibilitySnapshot {
  monthlyKg: number;
  officeDeductions: number;
  committedAdvances: number;
  grossLeafValue: number;
  policyLimit: number;
  eligibleAmount: number;
  baseRatePerKg: number;
  advancePercentage: number;
  officeFetchedAt: string;
  policy: ServiceRequestPolicy;
}

export const DEFAULT_SERVICE_REQUEST_POLICY: ServiceRequestPolicy = {
  enabled: true,
  baseRatePerKg: 150,
  advancePercentage: 0.5,
  maxAdvanceAmount: 50_000,
  teaPackets: [
    { code: "TEA-500G", label: "Tea packet · 500g", unit: "packets", maxQuantity: 10 },
    { code: "TEA-1KG", label: "Tea packet · 1kg", unit: "packets", maxQuantity: 5 },
  ],
  fertilizers: [
    { code: "U709", label: "U709", unit: "bags", maxQuantity: 5 },
    { code: "T65", label: "T65", unit: "bags", maxQuantity: 5 },
  ],
};

interface AppUser {
  id: string;
  name: string;
  role: "super_admin" | "admin" | "extension_officer" | "supplier";
  status: string;
  supplier_no: string | null;
  associated_entity_id: string | null;
}

interface ServiceRequestRow {
  id: string;
  supplier_id: string;
  supplier_name: string;
  supplier_no: string | null;
  estate_id: string | null;
  request_type: ServiceRequestType;
  item_code: string | null;
  item_label: string | null;
  quantity: number | null;
  unit: string | null;
  requested_amount: number;
  payment_method: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  account_name: string | null;
  account_number: string | null;
  note: string | null;
  status: ServiceRequestStatus;
  admin_note: string | null;
  monthly_kg_snapshot: number;
  office_deduction_snapshot: number;
  committed_advance_snapshot: number;
  base_rate_snapshot: number;
  advance_percentage_snapshot: number;
  eligible_limit_snapshot: number;
  office_fetched_at: string;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  fulfilled_at: string | null;
}

interface CreateRequestBody {
  action: "create";
  requestType: ServiceRequestType;
  amount?: number;
  paymentMethod?: "bank_transfer" | "cash" | "lorry";
  bankDetails?: { bankName?: string; branch?: string; accountName?: string; accountNumber?: string };
  itemCode?: string;
  quantity?: number;
  note?: string;
}

interface DecisionBody {
  action: "decide";
  requestId: string;
  status: "approved" | "rejected" | "fulfilled";
  adminNote?: string;
}

interface PolicyBody {
  action: "update_policy";
  policy: ServiceRequestPolicy;
}

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Server configuration is missing ${name}.`);
  return value;
}

function json(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function bearerToken(request: Request): string {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) throw new Error("AUTH_REQUIRED");
  return match[1];
}

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumber(value: unknown, fallback: number, maximum: number): number {
  const parsed = finiteNumber(value, fallback);
  return parsed > 0 && parsed <= maximum ? parsed : fallback;
}

function normalizeCatalog(value: unknown, fallback: RequestCatalogItem[]): RequestCatalogItem[] {
  if (!Array.isArray(value)) return fallback;
  const rows = value.slice(0, 20).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const code = String(row.code ?? "").trim().slice(0, 40);
    const label = String(row.label ?? "").trim().slice(0, 80);
    const unit = String(row.unit ?? "").trim().slice(0, 20);
    const maxQuantity = Math.floor(positiveNumber(row.maxQuantity, 1, 1_000));
    return code && label && unit ? [{ code, label, unit, maxQuantity }] : [];
  });
  return rows.length ? rows : fallback;
}

export function normalizeServiceRequestPolicy(value: unknown): ServiceRequestPolicy {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    enabled: source.enabled !== false,
    baseRatePerKg: positiveNumber(source.baseRatePerKg, DEFAULT_SERVICE_REQUEST_POLICY.baseRatePerKg, 10_000),
    advancePercentage: positiveNumber(source.advancePercentage, DEFAULT_SERVICE_REQUEST_POLICY.advancePercentage, 1),
    maxAdvanceAmount: positiveNumber(source.maxAdvanceAmount, DEFAULT_SERVICE_REQUEST_POLICY.maxAdvanceAmount, 10_000_000),
    teaPackets: normalizeCatalog(source.teaPackets, DEFAULT_SERVICE_REQUEST_POLICY.teaPackets),
    fertilizers: normalizeCatalog(source.fertilizers, DEFAULT_SERVICE_REQUEST_POLICY.fertilizers),
  };
}

export function calculateEligibility(input: {
  monthlyKg: number;
  officeDeductions: number;
  committedAdvances: number;
  policy: ServiceRequestPolicy;
  officeFetchedAt: string;
}): EligibilitySnapshot {
  const monthlyKg = Math.max(0, finiteNumber(input.monthlyKg));
  const officeDeductions = Math.max(0, finiteNumber(input.officeDeductions));
  const committedAdvances = Math.max(0, finiteNumber(input.committedAdvances));
  const grossLeafValue = monthlyKg * input.policy.baseRatePerKg;
  const policyLimit = Math.min(grossLeafValue * input.policy.advancePercentage, input.policy.maxAdvanceAmount);
  const eligibleAmount = Math.max(0, policyLimit - officeDeductions - committedAdvances);
  return {
    monthlyKg,
    officeDeductions,
    committedAdvances,
    grossLeafValue,
    policyLimit,
    eligibleAmount,
    baseRatePerKg: input.policy.baseRatePerKg,
    advancePercentage: input.policy.advancePercentage,
    officeFetchedAt: input.officeFetchedAt,
    policy: input.policy,
  };
}

function supabaseBase(): string {
  return env("VITE_SUPABASE_URL").replace(/\/+$/, "");
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  let response: Response;
  try {
    response = await fetch(`${supabaseBase()}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        accept: "application/json",
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new Error("REQUEST_DATABASE_UNAVAILABLE");
  }
  const text = await response.text();
  const payload = text ? JSON.parse(text) as unknown : null;
  if (!response.ok) {
    const error = payload && typeof payload === "object" ? payload as { code?: string; message?: string; details?: string } : {};
    if (response.status === 404 || error.code === "PGRST205" || error.code === "42883") throw new Error("REQUEST_SCHEMA_MISSING");
    if (`${error.message ?? ""} ${error.details ?? ""}`.includes("ELIGIBLE_LIMIT_EXCEEDED")) throw new Error("ELIGIBLE_LIMIT_EXCEEDED");
    throw new Error(`REQUEST_DATABASE_FAILED:${response.status}`);
  }
  return payload as T;
}

function queryString(values: Record<string, string>): string {
  return new URLSearchParams(values).toString();
}

async function appUser(uid: string): Promise<AppUser> {
  const rows = await supabaseRequest<AppUser[]>(`users?${queryString({
    id: `eq.${uid}`,
    select: "id,name,role,status,supplier_no,associated_entity_id",
    limit: "1",
  })}`);
  const user = rows[0];
  if (!user || user.status !== "active") throw new Error("APP_ACCESS_DENIED");
  return user;
}

function requireSupplier(user: AppUser): void {
  if (user.role !== "supplier") throw new Error("SUPPLIER_ACCESS_DENIED");
  if (!user.supplier_no) throw new Error("SUPPLIER_NUMBER_MISSING");
}

function requireAdmin(user: AppUser): void {
  if (user.role !== "admin" && user.role !== "super_admin") throw new Error("ADMIN_ACCESS_DENIED");
}

async function requestPolicy(): Promise<ServiceRequestPolicy> {
  const rows = await supabaseRequest<Array<{ data?: unknown }>>(`settings?${queryString({
    key: "eq.supplier_request_policy",
    select: "data",
    limit: "1",
  })}`);
  return normalizeServiceRequestPolicy(rows[0]?.data);
}

async function updateRequestPolicy(policy: ServiceRequestPolicy): Promise<ServiceRequestPolicy> {
  const normalized = normalizeServiceRequestPolicy(policy);
  await supabaseRequest("settings?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: "supplier_request_policy", data: normalized }),
  });
  return normalized;
}

async function committedCashAdvances(supplierId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const rows = await supabaseRequest<Array<{ requested_amount?: number }>>(`supplier_service_requests?${queryString({
    supplier_id: `eq.${supplierId}`,
    request_type: "eq.cash_advance",
    status: "in.(pending,approved)",
    requested_at: `gte.${monthStart.toISOString()}`,
    select: "requested_amount",
  })}`);
  return rows.reduce((sum, row) => sum + Math.max(0, finiteNumber(row.requested_amount)), 0);
}

async function eligibilityFor(uid: string, forceRefresh: boolean): Promise<EligibilitySnapshot> {
  const policy = await requestPolicy();
  const [balanceRaw, committedAdvances] = await Promise.all([
    getFactoryDataForUser("balance", uid, forceRefresh),
    committedCashAdvances(uid),
  ]);
  const balance = balanceRaw as OfficeBalanceResponse;
  let monthlyKg = Math.max(0, finiteNumber(balance.currentMonth?.normalLeafQty) + finiteNumber(balance.currentMonth?.superLeafQty));
  let officeFetchedAt = balance.fetchedAt;
  // The balance response normally contains both kg and deductions, so one
  // Office request is enough. Use crop only as a fallback for older factory
  // payloads that omit the current-month quantity.
  if (monthlyKg <= 0) {
    const crop = await getFactoryDataForUser("crop", uid, forceRefresh) as OfficeLeafResponse;
    monthlyKg = Math.max(0, finiteNumber(crop.totals?.totalQty));
    officeFetchedAt = crop.fetchedAt || officeFetchedAt;
  }
  return calculateEligibility({
    monthlyKg,
    officeDeductions: Math.max(0, finiteNumber(balance.currentMonth?.totalDeduction)),
    committedAdvances,
    policy,
    officeFetchedAt: officeFetchedAt || new Date().toISOString(),
  });
}

async function listRequests(user: AppUser): Promise<ServiceRequestRow[]> {
  const params: Record<string, string> = {
    select: "*",
    order: "requested_at.desc",
    limit: "500",
  };
  if (user.role === "supplier") params.supplier_id = `eq.${user.id}`;
  else requireAdmin(user);
  return supabaseRequest<ServiceRequestRow[]>(`supplier_service_requests?${queryString(params)}`);
}

function cleanText(value: unknown, maximum: number): string {
  return String(value ?? "").trim().slice(0, maximum);
}

function findCatalogItem(policy: ServiceRequestPolicy, type: ServiceRequestType, code: string): RequestCatalogItem {
  const catalog = type === "tea_packet" ? policy.teaPackets : policy.fertilizers;
  const item = catalog.find((entry) => entry.code === code);
  if (!item) throw new Error("INVALID_REQUEST_ITEM");
  return item;
}

async function createRequest(user: AppUser, body: CreateRequestBody): Promise<ServiceRequestRow> {
  requireSupplier(user);
  if (!(["cash_advance", "tea_packet", "fertilizer"] as string[]).includes(body.requestType)) throw new Error("INVALID_REQUEST_TYPE");
  const snapshot = await eligibilityFor(user.id, true);
  if (!snapshot.policy.enabled) throw new Error("REQUESTS_DISABLED");
  if (snapshot.monthlyKg <= 0) throw new Error("NO_MONTHLY_LEAF");

  let amount = 0;
  let item: RequestCatalogItem | null = null;
  let quantity: number | null = null;
  let paymentMethod: string | null = null;
  let bankName: string | null = null;
  let bankBranch: string | null = null;
  let accountName: string | null = null;
  let accountNumber: string | null = null;
  if (body.requestType === "cash_advance") {
    amount = Math.round(finiteNumber(body.amount) * 100) / 100;
    paymentMethod = cleanText(body.paymentMethod, 30);
    if (amount <= 0 || amount > snapshot.eligibleAmount) throw new Error("ELIGIBLE_LIMIT_EXCEEDED");
    if (!(["bank_transfer", "cash", "lorry"] as string[]).includes(paymentMethod)) throw new Error("INVALID_PAYMENT_METHOD");
    if (paymentMethod === "bank_transfer") {
      bankName = cleanText(body.bankDetails?.bankName, 80);
      bankBranch = cleanText(body.bankDetails?.branch, 80) || null;
      accountName = cleanText(body.bankDetails?.accountName, 120);
      accountNumber = cleanText(body.bankDetails?.accountNumber, 40);
      if (!bankName || !accountName || !accountNumber) throw new Error("INVALID_BANK_DETAILS");
    }
  } else {
    item = findCatalogItem(snapshot.policy, body.requestType, cleanText(body.itemCode, 40));
    quantity = Math.floor(finiteNumber(body.quantity));
    if (quantity <= 0 || quantity > item.maxQuantity) throw new Error("INVALID_REQUEST_QUANTITY");
  }

  const totalCashCeiling = Math.max(0, snapshot.policyLimit - snapshot.officeDeductions);
  const rows = await supabaseRequest<ServiceRequestRow[]>("rpc/create_supplier_service_request", {
    method: "POST",
    body: JSON.stringify({
      p_supplier_id: user.id,
      p_supplier_name: user.name,
      p_supplier_no: user.supplier_no,
      p_estate_id: user.associated_entity_id,
      p_request_type: body.requestType,
      p_item_code: item?.code ?? null,
      p_item_label: item?.label ?? null,
      p_quantity: quantity,
      p_unit: item?.unit ?? null,
      p_requested_amount: amount,
      p_payment_method: paymentMethod,
      p_bank_name: bankName,
      p_bank_branch: bankBranch,
      p_account_name: accountName,
      p_account_number: accountNumber,
      p_note: cleanText(body.note, 500),
      p_monthly_kg: snapshot.monthlyKg,
      p_office_deductions: snapshot.officeDeductions,
      p_total_cash_ceiling: totalCashCeiling,
      p_base_rate: snapshot.baseRatePerKg,
      p_advance_percentage: snapshot.advancePercentage,
      p_office_fetched_at: snapshot.officeFetchedAt,
    }),
  });
  if (!rows[0]) throw new Error("REQUEST_DATABASE_FAILED:EMPTY");
  return rows[0];
}

async function decideRequest(user: AppUser, body: DecisionBody): Promise<ServiceRequestRow> {
  requireAdmin(user);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.requestId)) throw new Error("INVALID_REQUEST_ID");
  if (!(["approved", "rejected", "fulfilled"] as string[]).includes(body.status)) throw new Error("INVALID_REQUEST_STATUS");
  const expectedCurrentStatus = body.status === "fulfilled" ? "approved" : "pending";
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: body.status,
    admin_note: cleanText(body.adminNote, 500),
    reviewed_by: user.id,
    reviewed_at: now,
  };
  if (body.status === "fulfilled") patch.fulfilled_at = now;
  const rows = await supabaseRequest<ServiceRequestRow[]>(`supplier_service_requests?${queryString({
    id: `eq.${body.requestId}`,
    status: `eq.${expectedCurrentStatus}`,
    select: "*",
  })}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!rows[0]) throw new Error("INVALID_REQUEST_TRANSITION");
  return rows[0];
}

function publicError(error: unknown): { status: number; code: string; message: string } {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  if (code === "AUTH_REQUIRED" || code === "AUTH_INVALID") return { status: 401, code, message: "Please sign in again." };
  if (code.endsWith("ACCESS_DENIED")) return { status: 403, code, message: "You are not allowed to perform this action." };
  if (code === "SUPPLIER_NUMBER_MISSING" || code === "OFFICE_MAPPING_MISSING") return { status: 409, code, message: "Supplier number, factory or route mapping is incomplete." };
  if (code === "ELIGIBLE_LIMIT_EXCEEDED") return { status: 409, code, message: "This request exceeds the currently eligible limit." };
  if (code === "NO_MONTHLY_LEAF") return { status: 409, code, message: "No leaf deliveries are recorded for this month yet." };
  if (code === "REQUESTS_DISABLED") return { status: 423, code, message: "Supplier requests are temporarily disabled by the office." };
  if (code === "INVALID_REQUEST_TRANSITION") return { status: 409, code, message: "This request has already been reviewed or cannot move to that status." };
  if (code.startsWith("INVALID_")) return { status: 400, code, message: "Please check the request details and try again." };
  if (code === "REQUEST_NOT_FOUND") return { status: 404, code, message: "Request was not found." };
  if (code === "REQUEST_SCHEMA_MISSING") return { status: 503, code, message: "Database migration for smart supplier requests has not been applied." };
  if (code.startsWith("FACTORY_") || code.startsWith("MAPPING_")) return { status: 502, code, message: "Office data is temporarily unavailable. Please try again later." };
  if (code.startsWith("Server configuration") || code.startsWith("REQUEST_DATABASE")) return { status: 503, code: "REQUEST_SERVICE_UNAVAILABLE", message: "Request service is temporarily unavailable." };
  return { status: 500, code: "REQUEST_SERVICE_ERROR", message: "The request could not be completed." };
}

export async function handleServiceRequest(request: Request): Promise<Response> {
  try {
    const uid = await verifyFirebaseUser(bearerToken(request));
    const user = await appUser(uid);
    const url = new URL(request.url);

    if (request.method === "GET") {
      const mode = url.searchParams.get("mode") ?? "requests";
      if (mode === "eligibility") {
        requireSupplier(user);
        return json(200, await eligibilityFor(uid, url.searchParams.get("refresh") === "1"));
      }
      if (mode === "policy") {
        requireAdmin(user);
        return json(200, await requestPolicy());
      }
      return json(200, await listRequests(user));
    }

    if (request.method === "POST" || request.method === "PATCH") {
      const body = await request.json() as CreateRequestBody | DecisionBody | PolicyBody;
      if (body.action === "create") return json(201, await createRequest(user, body));
      if (body.action === "decide") return json(200, await decideRequest(user, body));
      if (body.action === "update_policy") {
        requireAdmin(user);
        return json(200, await updateRequestPolicy(body.policy));
      }
      throw new Error("INVALID_ACTION");
    }
    return json(405, { error: { code: "METHOD_NOT_ALLOWED", message: "GET, POST or PATCH required." } });
  } catch (error) {
    const result = publicError(error);
    console.error("[supplier-requests] request failed", {
      code: result.code,
      name: error instanceof Error ? error.name : typeof error,
    });
    return json(result.status, { error: { code: result.code, message: result.message } });
  }
}
