import { initFirebase } from "./firebase";
import type { OfficeBalanceResponse, OfficeLeafResponse, OfficeLorryResponse } from "./officeApiContracts";

export class OfficeApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); this.name = "OfficeApiError"; }
  get mappingMissing() { return this.code === "OFFICE_MAPPING_MISSING" || this.code === "SUPPLIER_NUMBER_MISSING"; }
}

export type OfficeDataFreshness = "live" | "recent-cache" | "stale-cache";
export interface OfficeDataResult<T> {
  data: T;
  freshness: OfficeDataFreshness;
  fetchedAt: string;
  error?: string;
}

export interface OfficeFetchOptions {
  signal?: AbortSignal;
  forceRefresh?: boolean;
}

interface ClientCacheEntry<T> { expiresAt: number; value: T; fetchedAt: string }
interface PersistentCacheEntry<T> { savedAt: number; value: T; fetchedAt: string }

const clientCache = new Map<string, ClientCacheEntry<unknown>>();
const PERSISTENT_CACHE_PREFIX = "kdu.office-api.v2";
const MAX_STALE_AGE_MS = 24 * 60 * 60 * 1000;
export const OFFICE_CLIENT_CACHE_MS = {
  crop: 5 * 60_000,
  balance: 10 * 60_000,
  monthly: 15 * 60_000,
  lorry: 60_000,
} as const;
export const OFFICE_DATA_REFRESH_COOLDOWN_SECONDS = 5 * 60;
export const LORRY_REFRESH_COOLDOWN_SECONDS = 60;

function dataFetchedAt(value: unknown): string {
  if (value && typeof value === "object" && typeof (value as { fetchedAt?: unknown }).fetchedAt === "string") {
    return (value as { fetchedAt: string }).fetchedAt;
  }
  return new Date().toISOString();
}

function scopedKey(uid: string, path: string): string {
  return `${uid}:${path}`;
}

function persistentKey(uid: string, path: string): string {
  return `${PERSISTENT_CACHE_PREFIX}:${uid}:${encodeURIComponent(path)}`;
}

function readPersistent<T>(uid: string, path: string): PersistentCacheEntry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(persistentKey(uid, path));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistentCacheEntry<T>;
    if (!parsed || typeof parsed.savedAt !== "number" || Date.now() - parsed.savedAt > MAX_STALE_AGE_MS) {
      window.localStorage.removeItem(persistentKey(uid, path));
      return null;
    }
    return parsed;
  } catch { return null; }
}

function writePersistent<T>(uid: string, path: string, value: T, fetchedAt: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(persistentKey(uid, path), JSON.stringify({ savedAt: Date.now(), value, fetchedAt }));
  } catch { /* Storage can be unavailable in private/restricted browser modes. */ }
}

function refreshPath(path: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}refresh=1`;
}

async function requestWithMeta<T>(path: string, ttlMs: number, options: OfficeFetchOptions = {}): Promise<OfficeDataResult<T>> {
  const currentUser = initFirebase().auth?.currentUser;
  if (!currentUser) throw new OfficeApiError("AUTH_REQUIRED", "Please sign in again.", 401);
  const uid = currentUser.uid;
  const key = scopedKey(uid, path);
  const cached = clientCache.get(key) as ClientCacheEntry<T> | undefined;
  if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) {
    return { data: cached.value, freshness: "recent-cache", fetchedAt: cached.fetchedAt };
  }

  try {
    const token = await currentUser.getIdToken();
    const response = await fetch(options.forceRefresh ? refreshPath(path) : path, {
      headers: { authorization: `Bearer ${token}` }, signal: options.signal,
    });
    const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | T | null;
    if (!response.ok) {
      const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
      throw new OfficeApiError(error?.code ?? "OFFICE_API_ERROR", error?.message ?? "Office API request failed.", response.status);
    }
    if (body == null) throw new OfficeApiError("OFFICE_API_EMPTY", "Office API returned no data.", 502);
    const value = body as T;
    const fetchedAt = dataFetchedAt(value);
    clientCache.set(key, { value, fetchedAt, expiresAt: Date.now() + ttlMs });
    writePersistent(uid, path, value, fetchedAt);
    return { data: value, freshness: "live", fetchedAt };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    const status = error instanceof OfficeApiError ? error.status : 0;
    // Never reveal cached financial data after an auth, access or mapping
    // failure. Stale fallback is only for temporary server/network faults.
    const code = error instanceof OfficeApiError ? error.code : "";
    const lorrySnapshotUnavailable = path.startsWith("/api/lorry") && code === "FACTORY_LOCATION_UNAVAILABLE";
    if (status === 0 || status >= 500 || lorrySnapshotUnavailable) {
      const persisted = readPersistent<T>(uid, path);
      if (persisted) {
        const message = error instanceof Error ? error.message : "Office API temporarily unavailable.";
        return { data: persisted.value, freshness: "stale-cache", fetchedAt: persisted.fetchedAt, error: message };
      }
    }
    throw error;
  }
}

export const fetchOfficeBalanceWithMeta = (options?: OfficeFetchOptions) => requestWithMeta<OfficeBalanceResponse>("/api/balance", OFFICE_CLIENT_CACHE_MS.balance, options);
export const fetchOfficeCropWithMeta = (options?: OfficeFetchOptions) => requestWithMeta<OfficeLeafResponse>("/api/crop", OFFICE_CLIENT_CACHE_MS.crop, options);
export const fetchOfficeMonthlyWithMeta = (options?: OfficeFetchOptions) => requestWithMeta<OfficeLeafResponse>("/api/monthly", OFFICE_CLIENT_CACHE_MS.monthly, options);
export const fetchOfficeLorryWithMeta = (routeId: string, options?: OfficeFetchOptions) => requestWithMeta<OfficeLorryResponse>(`/api/lorry?routeId=${encodeURIComponent(routeId)}`, OFFICE_CLIENT_CACHE_MS.lorry, options);

// Backwards-compatible data-only helpers used by existing modules.
export const fetchOfficeBalance = (signal?: AbortSignal) => fetchOfficeBalanceWithMeta({ signal }).then((result) => result.data);
export const fetchOfficeCrop = (signal?: AbortSignal) => fetchOfficeCropWithMeta({ signal }).then((result) => result.data);
export const fetchOfficeMonthly = (signal?: AbortSignal) => fetchOfficeMonthlyWithMeta({ signal }).then((result) => result.data);
export const fetchOfficeLorry = (routeId: string, signal?: AbortSignal) => fetchOfficeLorryWithMeta(routeId, { signal }).then((result) => result.data);

export function isOfficeMappingMissing(error: unknown): boolean {
  return error instanceof OfficeApiError && error.mappingMissing;
}

export function canUseLorryBroadcastFallback(error: unknown): boolean {
  return error instanceof OfficeApiError && (
    error.mappingMissing
    || error.code === "FACTORY_LOCATION_UNAVAILABLE"
    || error.code === "FACTORY_RESPONSE_INVALID"
    || error.code === "FACTORY_TIMEOUT"
    || error.code === "FACTORY_NETWORK_FAILED"
  );
}

export function isOfficeLorryDisabled(error: unknown): boolean {
  return error instanceof OfficeApiError && error.code === "OFFICE_LORRY_DISABLED";
}
