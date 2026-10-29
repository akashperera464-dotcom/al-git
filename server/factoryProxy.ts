import { normalizeOfficeBalance, normalizeOfficeLeaf, parseOfficeLorry } from "../src/lib/officeApiContracts";

type EndpointKind = "balance" | "crop" | "monthly" | "lorry";
interface UserMapping { uid: string; factoryCode: string; routeCode: string; supplierId?: string }
interface CacheEntry { expiresAt: number; value: unknown }

const responseCache = new Map<string, CacheEntry>();
const TTL: Record<EndpointKind, number> = { lorry: 25_000, crop: 120_000, balance: 120_000, monthly: 180_000 };
const FACTORY_PATH: Record<EndpointKind, string> = {
  balance: "get_current_balance.php", crop: "get_current_crop_balance.php",
  monthly: "get_monthly_details.php", lorry: "get_lorry_deatails.php",
};

function env(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Server configuration is missing ${name}.`);
  return value;
}

function json(status: number, body: unknown, maxAge = 0): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": maxAge ? `private, max-age=${maxAge}, stale-if-error=60` : "private, no-store",
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

async function verifyFirebaseUser(idToken: string): Promise<string> {
  const apiKey = process.env.FIREBASE_API_KEY?.trim() || env("VITE_FIREBASE_API_KEY");
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idToken }),
  });
  if (!response.ok) throw new Error("AUTH_INVALID");
  const payload = await response.json() as { users?: Array<{ localId?: string; disabled?: boolean }> };
  const account = payload.users?.[0];
  if (!account?.localId || account.disabled) throw new Error("AUTH_INVALID");
  return account.localId;
}

async function supabaseRows<T>(path: string): Promise<T[]> {
  const base = env("VITE_SUPABASE_URL").replace(/\/+$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${base}/rest/v1/${path}`, {
    headers: { apikey: key, authorization: `Bearer ${key}`, accept: "application/json" },
  });
  if (!response.ok) throw new Error(`MAPPING_READ_FAILED:${response.status}`);
  return response.json() as Promise<T[]>;
}

async function resolveMapping(uid: string, requestedRouteId?: string): Promise<UserMapping> {
  type UserRow = { id: string; role: string; status: string; factory_id: string | null; route_id: string | null; supplier_no: string | null };
  const users = await supabaseRows<UserRow>(`users?id=eq.${encodeURIComponent(uid)}&select=id,role,status,factory_id,route_id,supplier_no&limit=1`);
  const user = users[0];
  if (!user || user.role !== "supplier" || user.status !== "active") throw new Error("SUPPLIER_ACCESS_DENIED");

  let routeId = requestedRouteId || user.route_id || "";
  if (!routeId) throw new Error("OFFICE_MAPPING_MISSING");
  if (requestedRouteId && requestedRouteId !== user.route_id) {
    const assignments = await supabaseRows<{ route_id: string }>(`user_route_assignments?user_id=eq.${encodeURIComponent(uid)}&route_id=eq.${encodeURIComponent(requestedRouteId)}&select=route_id&limit=1`);
    if (!assignments.length) throw new Error("ROUTE_ACCESS_DENIED");
  }

  const routes = await supabaseRows<{ id: string; factory_id: string; office_route_code: string | null }>(`routes?id=eq.${encodeURIComponent(routeId)}&select=id,factory_id,office_route_code&limit=1`);
  const route = routes[0];
  if (!route) throw new Error("OFFICE_MAPPING_MISSING");
  const factoryId = route.factory_id || user.factory_id;
  if (!factoryId) throw new Error("OFFICE_MAPPING_MISSING");
  const factories = await supabaseRows<{ office_factory_code: string | null }>(`factories?id=eq.${encodeURIComponent(factoryId)}&select=office_factory_code&limit=1`);
  const factoryCode = factories[0]?.office_factory_code?.trim();
  const routeCode = route.office_route_code?.trim();
  if (!factoryCode || !routeCode) throw new Error("OFFICE_MAPPING_MISSING");
  return { uid, factoryCode, routeCode, supplierId: user.supplier_no?.trim() || undefined };
}

async function fetchFactory(kind: EndpointKind, mapping: UserMapping): Promise<unknown> {
  if (kind !== "lorry" && !mapping.supplierId) throw new Error("SUPPLIER_NUMBER_MISSING");
  const base = env("FACTORY_API_BASE_URL").replace(/\/+$/, "");
  const query = new URLSearchParams({ secret: env("FACTORY_API_SECRET"), factoryCode: mapping.factoryCode, routeCode: mapping.routeCode });
  if (kind !== "lorry") query.set("id", mapping.supplierId!);
  const cacheKey = `${kind}:${mapping.factoryCode}:${mapping.routeCode}:${mapping.supplierId ?? "route"}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${base}/${FACTORY_PATH[kind]}?${query}`, { signal: controller.signal, headers: { accept: "application/json,text/plain,*/*" } });
    if (!response.ok) throw new Error(`FACTORY_UPSTREAM_${response.status}`);
    const rawText = await response.text();
    const fetchedAt = new Date().toISOString();
    let normalized: unknown;
    if (kind === "lorry") normalized = parseOfficeLorry(rawText, fetchedAt);
    else {
      let parsed: unknown;
      try { parsed = JSON.parse(rawText); } catch { throw new Error("FACTORY_INVALID_JSON"); }
      normalized = kind === "balance" ? normalizeOfficeBalance(parsed, fetchedAt) : normalizeOfficeLeaf(parsed, fetchedAt);
    }
    responseCache.set(cacheKey, { value: normalized, expiresAt: Date.now() + TTL[kind] });
    return normalized;
  } finally { clearTimeout(timeout); }
}

function publicError(error: unknown): { status: number; code: string; message: string } {
  const raw = error instanceof Error ? error.message : "UNKNOWN";
  if (raw === "AUTH_REQUIRED" || raw === "AUTH_INVALID") return { status: 401, code: raw, message: "Please sign in again." };
  if (raw === "SUPPLIER_ACCESS_DENIED" || raw === "ROUTE_ACCESS_DENIED") return { status: 403, code: raw, message: "This office API route is not assigned to your account." };
  if (raw === "OFFICE_MAPPING_MISSING" || raw === "SUPPLIER_NUMBER_MISSING") return { status: 409, code: raw, message: "Factory/route codes or the supplier number have not been configured." };
  if (raw.startsWith("Server configuration")) return { status: 503, code: "SERVER_NOT_CONFIGURED", message: raw };
  if (raw.startsWith("FACTORY_") || raw === "AbortError") return { status: 502, code: "FACTORY_API_UNAVAILABLE", message: "The factory system is temporarily unavailable." };
  return { status: 500, code: "OFFICE_API_ERROR", message: "The office API request could not be completed." };
}

export async function handleFactoryRequest(kind: EndpointKind, request: Request): Promise<Response> {
  if (request.method !== "GET") return json(405, { error: { code: "METHOD_NOT_ALLOWED", message: "GET required." } });
  try {
    const uid = await verifyFirebaseUser(bearerToken(request));
    const routeId = new URL(request.url).searchParams.get("routeId")?.trim() || undefined;
    const mapping = await resolveMapping(uid, kind === "lorry" ? routeId : undefined);
    const data = await fetchFactory(kind, mapping);
    return json(200, data, Math.floor(TTL[kind] / 1000));
  } catch (error) {
    const result = publicError(error);
    return json(result.status, { error: { code: result.code, message: result.message } });
  }
}
