import { initFirebase } from "./firebase";
import { getSupabase } from "./supabase";

export type ServiceRequestType = "cash_advance" | "tea_packet" | "fertilizer";
export type ServiceRequestStatus = "pending" | "approved" | "rejected" | "fulfilled";
export type PaymentMethod = "bank_transfer" | "cash" | "lorry";

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

interface ServiceRequestApiRow {
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
  payment_method: PaymentMethod | null;
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

export interface SupplierServiceRequest {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierNo: string | null;
  estateId: string | null;
  requestType: ServiceRequestType;
  itemCode: string | null;
  itemLabel: string | null;
  quantity: number | null;
  unit: string | null;
  requestedAmount: number;
  paymentMethod: PaymentMethod | null;
  bankName: string | null;
  bankBranch: string | null;
  accountName: string | null;
  accountNumber: string | null;
  note: string;
  status: ServiceRequestStatus;
  adminNote: string;
  monthlyKgSnapshot: number;
  officeDeductionSnapshot: number;
  committedAdvanceSnapshot: number;
  baseRateSnapshot: number;
  advancePercentageSnapshot: number;
  eligibleLimitSnapshot: number;
  officeFetchedAt: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  fulfilledAt: string | null;
}

export type CreateServiceRequestInput =
  | { requestType: "cash_advance"; amount: number; paymentMethod: PaymentMethod; bankDetails?: { bankName: string; branch?: string; accountName: string; accountNumber: string }; note?: string }
  | { requestType: "tea_packet" | "fertilizer"; itemCode: string; quantity: number; note?: string };

export class ServiceRequestApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
    this.name = "ServiceRequestApiError";
  }
}

function normalize(row: ServiceRequestApiRow): SupplierServiceRequest {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    supplierNo: row.supplier_no,
    estateId: row.estate_id,
    requestType: row.request_type,
    itemCode: row.item_code,
    itemLabel: row.item_label,
    quantity: row.quantity == null ? null : Number(row.quantity),
    unit: row.unit,
    requestedAmount: Number(row.requested_amount || 0),
    paymentMethod: row.payment_method,
    bankName: row.bank_name,
    bankBranch: row.bank_branch,
    accountName: row.account_name,
    accountNumber: row.account_number,
    note: row.note ?? "",
    status: row.status,
    adminNote: row.admin_note ?? "",
    monthlyKgSnapshot: Number(row.monthly_kg_snapshot || 0),
    officeDeductionSnapshot: Number(row.office_deduction_snapshot || 0),
    committedAdvanceSnapshot: Number(row.committed_advance_snapshot || 0),
    baseRateSnapshot: Number(row.base_rate_snapshot || 0),
    advancePercentageSnapshot: Number(row.advance_percentage_snapshot || 0),
    eligibleLimitSnapshot: Number(row.eligible_limit_snapshot || 0),
    officeFetchedAt: row.office_fetched_at,
    requestedAt: row.requested_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    fulfilledAt: row.fulfilled_at,
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const currentUser = initFirebase().auth?.currentUser;
  if (!currentUser) throw new ServiceRequestApiError("AUTH_REQUIRED", "Please sign in again.", 401);
  const token = await currentUser.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null) as T | { error?: { code?: string; message?: string } } | null;
  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ServiceRequestApiError(
      error?.code ?? "REQUEST_API_ERROR",
      error?.message ?? "The request could not be completed.",
      response.status,
    );
  }
  return body as T;
}

export function fetchServiceRequestEligibility(forceRefresh = false): Promise<EligibilitySnapshot> {
  return request(`/api/supplier-requests?mode=eligibility${forceRefresh ? "&refresh=1" : ""}`);
}

export async function listSupplierServiceRequests(): Promise<SupplierServiceRequest[]> {
  const rows = await request<ServiceRequestApiRow[]>("/api/supplier-requests?mode=requests");
  return rows.map(normalize);
}

export async function createSupplierServiceRequest(input: CreateServiceRequestInput): Promise<SupplierServiceRequest> {
  const row = await request<ServiceRequestApiRow>("/api/supplier-requests", {
    method: "POST",
    body: JSON.stringify({ action: "create", ...input }),
  });
  return normalize(row);
}

export function fetchServiceRequestPolicy(): Promise<ServiceRequestPolicy> {
  return request("/api/supplier-requests?mode=policy");
}

export function updateServiceRequestPolicy(policy: ServiceRequestPolicy): Promise<ServiceRequestPolicy> {
  return request("/api/supplier-requests", {
    method: "PATCH",
    body: JSON.stringify({ action: "update_policy", policy }),
  });
}

export async function decideSupplierServiceRequest(
  requestId: string,
  status: "approved" | "rejected" | "fulfilled",
  adminNote = "",
): Promise<SupplierServiceRequest> {
  const row = await request<ServiceRequestApiRow>("/api/supplier-requests", {
    method: "PATCH",
    body: JSON.stringify({ action: "decide", requestId, status, adminNote }),
  });
  return normalize(row);
}

/**
 * Supabase Realtime is a status-only wake-up signal. The event table contains
 * no amount, deduction or Office snapshot; the UI then reloads authorized data
 * through the Firebase-protected Vercel endpoint.
 */
export function subscribeToServiceRequestStatus(
  supplierId: string | null,
  onChange: () => void,
): () => void {
  const sb = getSupabase();
  if (!sb) return () => undefined;
  const channelName = supplierId ? `service-request-status:${supplierId}` : "service-request-status:admin";
  const filter = supplierId ? { filter: `supplier_id=eq.${supplierId}` } : {};
  const channel = sb
    .channel(channelName)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "supplier_service_request_events",
      ...filter,
    }, () => onChange())
    .subscribe();
  return () => { void sb.removeChannel(channel); };
}
