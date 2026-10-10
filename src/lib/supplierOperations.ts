import { createUserWithEmailAndPassword, deleteUser, signOut } from "firebase/auth";
import { firebaseConfigured, initFirebase } from "./firebase";
import { getSupabase, supabaseConfigured } from "./supabase";

export interface FactoryOption {
  id: string;
  name: string;
}

export interface RouteOption {
  id: string;
  factoryId: string;
  name: string;
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
  updatedAt: string;
}

export interface DailyTeaPrice {
  grade: string;
  pricePerKg: number;
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
    .select("id,factory_id,route_name").eq("factory_id", factoryId).order("route_name");
  if (error) throw new Error(`Could not load routes: ${error.message}`);
  return (data ?? []).map(row => ({ id: row.id, factoryId: row.factory_id, name: row.route_name }));
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
  patch: { supplierNo?: string | null; factoryId?: string | null; routeId?: string | null; status?: "active" | "suspended" | "pending_approval" }
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
  status: string;
} | null> {
  if (!supabaseConfigured) return { status: "active" };
  const { data, error } = await getSupabase()!.from("users")
    .select("supplier_no,factory_id,route_id,status,factories(name),routes(route_name)")
    .eq("id", userId).maybeSingle();
  if (error) throw new Error(`Could not load supplier assignment: ${error.message}`);
  if (!data) return null;
  return {
    supplierNo: data.supplier_no ?? undefined,
    factoryId: data.factory_id ?? undefined,
    routeId: data.route_id ?? undefined,
    factoryName: (data.factories as unknown as { name?: string } | null)?.name,
    routeName: (data.routes as unknown as { route_name?: string } | null)?.route_name,
    status: data.status ?? "active",
  };
}

export async function canActivateUser(userId: string): Promise<boolean> {
  const profile = await readUserOperationalProfile(userId);
  return profile?.status === "active";
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

export async function readDailyTeaPrices(date = sriLankaDateISO()): Promise<DailyTeaPrice[]> {
  const referencePrices: DailyTeaPrice[] = [
    { grade: "Super", pricePerKg: 186 },
    { grade: "Standard", pricePerKg: 176 },
    { grade: "PV Super", pricePerKg: 204 },
  ];
  if (!supabaseConfigured) {
    return referencePrices;
  }
  const { data, error } = await getSupabase()!.from("daily_tea_prices")
    .select("grade,price_per_kg,price_date")
    .is("factory_id", null)
    .lte("price_date", date)
    .order("price_date", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not load daily tea prices: ${error.message}`);
  const latestByGrade = new Map<string, DailyTeaPrice>();
  for (const row of data ?? []) {
    if (!latestByGrade.has(row.grade)) {
      latestByGrade.set(row.grade, { grade: row.grade, pricePerKg: Number(row.price_per_kg ?? 0) });
    }
  }
  return referencePrices.map((reference) => latestByGrade.get(reference.grade) ?? reference);
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
  latitude: number;
  longitude: number;
  accuracyM?: number;
}): Promise<void> {
  if (!supabaseConfigured) return;
  const { error } = await getSupabase()!.from("lorry_locations").upsert({
    route_id: input.routeId,
    driver_id: input.driverId,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy_m: input.accuracyM ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "route_id" });
  if (error) throw new Error(`Could not publish lorry location: ${error.message}`);
}

function mapLorryLocation(row: Record<string, unknown>): LorryLocation {
  return {
    id: String(row.id ?? ""),
    routeId: String(row.route_id ?? ""),
    driverId: String(row.driver_id ?? ""),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    accuracyM: row.accuracy_m == null ? undefined : Number(row.accuracy_m),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function readLatestLorryLocation(routeId: string): Promise<LorryLocation | null> {
  if (!supabaseConfigured || !routeId) return null;
  const { data, error } = await getSupabase()!.from("lorry_locations").select("*")
    .eq("route_id", routeId).maybeSingle();
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
