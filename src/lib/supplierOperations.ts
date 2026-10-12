import { createUserWithEmailAndPassword, deleteUser, signOut } from "firebase/auth";
import { firebaseConfigured, initFirebase } from "./firebase";
import { getSupabase, supabaseConfigured } from "./supabase";
export { searchSupplierByNo } from "./estateRepo";

export interface FactoryOption {
  id: string;
  name: string;
}

export interface RouteOption {
  id: string;
  factoryId: string;
  name: string;
  code?: string;
  label: string;
}

export interface SupplierDirectoryEntry {
  id: string;
  name: string;
  supplierNo: string;
  phone?: string;
  factoryId?: string;
  routeId?: string;
  factoryName?: string;
  routeName?: string;
}

export interface LorryLocation {
  id: string;
  routeId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  accuracyM?: number;
  active: boolean;
  stoppedAt?: string;
  updatedAt: string;
  assignmentId?: string;
  lastNotificationAt?: string;
}

export interface DailyTeaPrice {
  grade: string;
  pricePerKg: number;
  factoryId?: string;
  priceDate?: string;
}

export function formatRouteLabel(routeName: string, routeCode?: string | null): string {
  return routeCode ? `${routeCode} — ${routeName}` : routeName;
}

export async function readFactories(): Promise<FactoryOption[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await getSupabase()!.from("factories").select("id,name").order("name");
  if (error) throw new Error(`Could not load factories: ${error.message}`);
  return (data ?? []).map(row => ({ id: row.id, name: row.name }));
}

export async function readRoutes(factoryId?: string): Promise<RouteOption[]> {
  if (!supabaseConfigured || !factoryId) return [];
  const { data, error } = await getSupabase()!.from("routes")
    .select("id,factory_id,route_name,route_code").eq("factory_id", factoryId).order("route_name");
  if (error) throw new Error(`Could not load routes: ${error.message}`);
  return (data ?? []).map(row => {
    const label = formatRouteLabel(row.route_name, row.route_code);
    return { id: row.id, factoryId: row.factory_id, name: label, code: row.route_code ?? undefined, label };
  });
}

export async function readSupplierDirectory(factoryId?: string, routeId?: string): Promise<SupplierDirectoryEntry[]> {
  if (!supabaseConfigured) return [];
  let query = getSupabase()!.from("users")
    .select("id,name,phone,supplier_no,factory_id,route_id,factories(name),routes(route_name)")
    .eq("role", "supplier").eq("status", "active").order("name");
  if (factoryId) query = query.eq("factory_id", factoryId);
  if (routeId) query = query.eq("route_id", routeId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load suppliers: ${error.message}`);
  return (data ?? []).map(row => ({
    id: row.id,
    name: row.name ?? "Supplier",
    phone: row.phone ?? undefined,
    supplierNo: row.supplier_no ?? "",
    factoryId: row.factory_id ?? undefined,
    routeId: row.route_id ?? undefined,
    factoryName: (row.factories as unknown as { name?: string } | null)?.name,
    routeName: (row.routes as unknown as { route_name?: string } | null)?.route_name,
  }));
}

export async function updateSupplierOperationalFields(
  userId: string,
  patch: { supplierNo?: string | null; factoryId?: string | null; routeId?: string | null; status?: "active" | "suspended" | "pending_approval" | "rejected" }
): Promise<void> {
  if (!supabaseConfigured) return;
  const row: Record<string, unknown> = {};
  if (patch.supplierNo !== undefined) row.supplier_no = patch.supplierNo || null;
  if (patch.factoryId !== undefined) row.factory_id = patch.factoryId || null;
  if (patch.routeId !== undefined) row.route_id = patch.routeId || null;
  if (patch.status !== undefined) row.status = patch.status;
  if (!Object.keys(row).length) return;
  const { error } = await getSupabase()!.from("users").update(row).eq("id", userId);
  if (error) throw new Error(`Could not update supplier assignment: ${error.message}`);
}

export async function readUserOperationalProfile(userId: string): Promise<{
  supplierNo?: string;
  factoryId?: string;
  routeId?: string;
  factoryName?: string;
  routeName?: string;
  routeCode?: string;
  status: string;
  deactivatedAt?: string;
} | null> {
  if (!supabaseConfigured) return { status: "active" };
  let { data, error } = await getSupabase()!.from("users")
    .select("supplier_no,factory_id,route_id,status,deactivated_at,factories(name),routes(route_name,route_code)")
    .eq("id", userId).maybeSingle();
  // Deployment-safe fallback while Round 11 SQL is waiting to be pasted.
  if (error?.message?.includes("deactivated_at")) {
    const fallback = await getSupabase()!.from("users")
      .select("supplier_no,factory_id,route_id,status,factories(name),routes(route_name,route_code)")
      .eq("id", userId).maybeSingle();
    data = fallback.data as typeof data;
    error = fallback.error;
  }
  if (error) throw new Error(`Could not load supplier assignment: ${error.message}`);
  if (!data) return null;
  return {
    supplierNo: data.supplier_no ?? undefined,
    factoryId: data.factory_id ?? undefined,
    routeId: data.route_id ?? undefined,
    factoryName: (data.factories as unknown as { name?: string } | null)?.name,
    routeName: (data.routes as unknown as { route_name?: string } | null)?.route_name,
    routeCode: (data.routes as unknown as { route_code?: string } | null)?.route_code,
    status: data.status ?? "active",
    deactivatedAt: data.deactivated_at ?? undefined,
  };
}

export async function canActivateUser(userId: string): Promise<boolean> {
  const profile = await readUserOperationalProfile(userId);
  return profile?.status === "active" && !profile.deactivatedAt;
}

export async function registerPendingSupplier(input: {
  supplierNo: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  factoryId: string;
  routeId: string;
}): Promise<void> {
  if (!firebaseConfigured || !supabaseConfigured) throw new Error("Registration services are not configured.");
  const sb = getSupabase()!;
  const supplierNo = input.supplierNo.trim();
  const { data: existing, error: lookupError } = await sb.from("users")
    .select("id").eq("supplier_no", supplierNo).maybeSingle();
  if (lookupError) throw new Error(`Could not validate supplier number: ${lookupError.message}`);
  if (existing) throw new Error("That supplier number is already registered.");

  const { auth } = initFirebase();
  if (!auth) throw new Error("Firebase is not configured.");
  const credential = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
  try {
    const { error } = await sb.from("users").insert({
      id: credential.user.uid,
      supplier_no: supplierNo,
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim() || null,
      role: "supplier",
      status: "pending_approval",
      factory_id: input.factoryId,
      route_id: input.routeId,
      associated_entity_id: null,
    });
    if (error) throw new Error(`Registration profile could not be saved: ${error.message}`);
  } catch (error) {
    await deleteUser(credential.user).catch(() => {});
    throw error;
  } finally {
    await signOut(auth).catch(() => {});
  }
}

export async function readDailyTeaPrices(date = sriLankaDateISO(), factoryId?: string): Promise<DailyTeaPrice[]> {
  const referencePrices: DailyTeaPrice[] = [
    { grade: "Super", pricePerKg: 186 },
    { grade: "Standard", pricePerKg: 176 },
    { grade: "PV Super", pricePerKg: 204 },
    { grade: "Coarse", pricePerKg: 150 },
  ];
  if (!supabaseConfigured) {
    return referencePrices;
  }
  let query = getSupabase()!.from("daily_tea_prices")
    .select("grade,price_per_kg,price_date,factory_id")
    .lte("price_date", date)
    .order("price_date", { ascending: false })
    .limit(250);
  query = factoryId
    ? query.or(`factory_id.is.null,factory_id.eq.${factoryId}`)
    : query.is("factory_id", null);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load daily tea prices: ${error.message}`);
  const globalByGrade = new Map<string, DailyTeaPrice>();
  const factoryByGrade = new Map<string, DailyTeaPrice>();
  for (const row of data ?? []) {
    const price: DailyTeaPrice = {
      grade: row.grade,
      pricePerKg: Number(row.price_per_kg ?? 0),
      factoryId: row.factory_id ?? undefined,
      priceDate: row.price_date,
    };
    if (row.factory_id && !factoryByGrade.has(row.grade)) {
      factoryByGrade.set(row.grade, price);
    } else if (!row.factory_id && !globalByGrade.has(row.grade)) {
      globalByGrade.set(row.grade, price);
    }
  }
  return referencePrices.map((reference) => factoryByGrade.get(reference.grade) ?? globalByGrade.get(reference.grade) ?? reference);
}

export async function saveDailyTeaPrices(input: {
  factoryId: string;
  priceDate: string;
  prices: Array<{ grade: string; pricePerKg: number }>;
}): Promise<void> {
  if (!supabaseConfigured) throw new Error("Supabase is not configured.");
  if (!input.factoryId || !input.priceDate) throw new Error("Factory and price date are required.");
  if (input.prices.some((price) => !price.grade || !Number.isFinite(price.pricePerKg) || price.pricePerKg < 0)) {
    throw new Error("Every grade must have a valid non-negative price.");
  }

  const sb = getSupabase()!;
  for (const price of input.prices) {
    const { data: existing, error: lookupError } = await sb.from("daily_tea_prices")
      .select("id")
      .eq("factory_id", input.factoryId)
      .eq("price_date", input.priceDate)
      .eq("grade", price.grade)
      .maybeSingle();
    if (lookupError) throw new Error(`Could not check ${price.grade} price: ${lookupError.message}`);

    const mutation = existing
      ? sb.from("daily_tea_prices").update({ price_per_kg: price.pricePerKg }).eq("id", existing.id)
      : sb.from("daily_tea_prices").insert({
          factory_id: input.factoryId,
          price_date: input.priceDate,
          grade: price.grade,
          price_per_kg: price.pricePerKg,
        });
    const { error } = await mutation;
    if (error) throw new Error(`Could not save ${price.grade} price: ${error.message}`);
  }
}

function sriLankaDateISO(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Colombo",
  }).formatToParts(date);
  const value = (type: "day" | "month" | "year") => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function publishLorryLocation(input: {
  routeId: string;
  driverId: string;
  assignmentId?: string;
  latitude: number;
  longitude: number;
  accuracyM?: number;
}): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase()!;
  const currentRow = {
    route_id: input.routeId,
    assignment_id: input.assignmentId ?? null,
    driver_id: input.driverId,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy_m: input.accuracyM ?? null,
    active: true,
    stopped_at: null,
    updated_at: new Date().toISOString(),
  };
  let lookup = sb.from("lorry_locations").select("id").eq("route_id", input.routeId).eq("active", true).order("updated_at", { ascending: false }).limit(1);
  if (input.assignmentId) lookup = lookup.eq("assignment_id", input.assignmentId);
  const lookupResult = await lookup.maybeSingle();
  // Keep the deployed Round 10 schema operational while the administrator is
  // applying Round 12. The legacy table has one location per route and does
  // not yet contain active/assignment trip columns.
  if (lookupResult.error && /active|assignment_id/i.test(lookupResult.error.message)) {
    const legacyRow = {
      route_id: input.routeId,
      driver_id: input.driverId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy_m: input.accuracyM ?? null,
      updated_at: new Date().toISOString(),
    };
    const retry = await sb.from("lorry_locations").upsert(legacyRow, { onConflict: "route_id" });
    if (retry.error) throw new Error(`Could not publish lorry location: ${retry.error.message}`);
    return;
  }
  if (lookupResult.error) throw new Error(`Could not find active lorry location: ${lookupResult.error.message}`);
  const existing = lookupResult.data;
  let { error } = existing
    ? await sb.from("lorry_locations").update(currentRow).eq("id", existing.id)
    : await sb.from("lorry_locations").insert(currentRow);
  // Deployment-safe fallback until the Round 12 SQL is pasted.
  if (error && /active|stopped_at|assignment_id/i.test(error.message)) {
    const { active: _active, stopped_at: _stoppedAt, assignment_id: _assignmentId, ...legacyRow } = currentRow;
    void _active;
    void _stoppedAt;
    void _assignmentId;
    const retry = existing
      ? await sb.from("lorry_locations").update(legacyRow).eq("id", existing.id)
      : await sb.from("lorry_locations").insert(legacyRow);
    error = retry.error;
  }
  if (error) throw new Error(`Could not publish lorry location: ${error.message}`);
}

export async function stopLorryLocation(routeId: string, driverId: string): Promise<void> {
  if (!supabaseConfigured || !routeId) return;
  const stoppedAt = new Date().toISOString();
  const { error } = await getSupabase()!.from("lorry_locations")
    .update({ active: false, stopped_at: stoppedAt, updated_at: stoppedAt })
    .eq("route_id", routeId)
    .eq("driver_id", driverId);
  // Before Round 12 is installed, freshness timeout still safely marks the
  // last location as stale; the missing optional columns must not break stop.
  if (error && !/active|stopped_at/i.test(error.message)) {
    throw new Error(`Could not stop lorry tracking: ${error.message}`);
  }
}

function mapLorryLocation(row: Record<string, unknown>): LorryLocation {
  return {
    id: String(row.id ?? ""),
    routeId: String(row.route_id ?? ""),
    driverId: String(row.driver_id ?? ""),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyM: row.accuracy_m == null ? undefined : Number(row.accuracy_m),
    active: row.active !== false,
    stoppedAt: row.stopped_at == null ? undefined : String(row.stopped_at),
    updatedAt: String(row.updated_at ?? ""),
    assignmentId: row.assignment_id == null ? undefined : String(row.assignment_id),
    lastNotificationAt: row.last_notification_at == null ? undefined : String(row.last_notification_at),
  };
}

export async function readLatestLorryLocation(routeId: string): Promise<LorryLocation | null> {
  if (!supabaseConfigured || !routeId) return null;
  const { data, error } = await getSupabase()!.from("lorry_locations").select("*")
    .eq("route_id", routeId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Could not load lorry location: ${error.message}`);
  return data ? mapLorryLocation(data) : null;
}

export function subscribeToLorryLocation(routeId: string, onLocation: (location: LorryLocation) => void): () => void {
  if (!supabaseConfigured || !routeId) return () => {};
  const sb = getSupabase()!;
  const channel = sb.channel(`lorry-route-${routeId}`)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "lorry_locations", filter: `route_id=eq.${routeId}`,
    }, payload => {
      if (payload.new && Object.keys(payload.new).length) onLocation(mapLorryLocation(payload.new));
    })
    .subscribe();
  return () => { void sb.removeChannel(channel); };
}
