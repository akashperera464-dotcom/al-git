import { initFirebase } from "./firebase";
import type { OfficeBalanceResponse, OfficeLeafResponse, OfficeLorryResponse } from "./officeApiContracts";

export class OfficeApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); this.name = "OfficeApiError"; }
  get mappingMissing() { return this.code === "OFFICE_MAPPING_MISSING" || this.code === "OFFICE_SUPPLIER_ID_MISSING"; }
}

interface ClientCacheEntry<T> { expiresAt: number; value: T }
const clientCache = new Map<string, ClientCacheEntry<unknown>>();

async function request<T>(path: string, ttlMs: number, signal?: AbortSignal): Promise<T> {
  const cached = clientCache.get(path) as ClientCacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const currentUser = initFirebase().auth?.currentUser;
  if (!currentUser) throw new OfficeApiError("AUTH_REQUIRED", "Please sign in again.", 401);
  const token = await currentUser.getIdToken();
  const response = await fetch(path, { headers: { authorization: `Bearer ${token}` }, signal });
  const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | T | null;
  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new OfficeApiError(error?.code ?? "OFFICE_API_ERROR", error?.message ?? "Office API request failed.", response.status);
  }
  const value = body as T;
  clientCache.set(path, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export const fetchOfficeBalance = (signal?: AbortSignal) => request<OfficeBalanceResponse>("/api/balance", 120_000, signal);
export const fetchOfficeCrop = (signal?: AbortSignal) => request<OfficeLeafResponse>("/api/crop", 120_000, signal);
export const fetchOfficeMonthly = (signal?: AbortSignal) => request<OfficeLeafResponse>("/api/monthly", 180_000, signal);
export const fetchOfficeLorry = (routeId: string, signal?: AbortSignal) => request<OfficeLorryResponse>(`/api/lorry?routeId=${encodeURIComponent(routeId)}`, 20_000, signal);

export function isOfficeMappingMissing(error: unknown): boolean {
  return error instanceof OfficeApiError && error.mappingMissing;
}
