import { createUserWithEmailAndPassword, deleteUser, signOut } from "firebase/auth";
import { firebaseConfigured, initFirebase } from "./firebase";
import { getSupabase, supabaseConfigured } from "./supabase";
export { searchSupplierByNo } from "./estateRepo";
export { publishLorryLocation, stopLorryLocation, subscribeToLorryLocation } from "./lorryBroadcast";
export type { LorryChannelStatus, LorryLocation } from "./lorryBroadcast";

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
  const sb = getSupabase()!;
  let routeUserIds: string[] | null = null;
  if (routeId) {
    const assignmentResult = await sb.from("user_route_assignments").select("user_id").eq("route_id", routeId);
    if (!assignmentResult.error) routeUserIds = (assignmentResult.data ?? []).map((row) => row.user_id);
    else if (!/user_route_assignments|relation .* does not exist|schema cache/i.test(assignmentResult.error.message)) {
      throw new Error(`Could not load route suppliers: ${assignmentResult.error.message}`);
    }
    if (routeUserIds && !routeUserIds.length) return [];
  }
  let query = sb.from("users")
    .select("id,name,phone,supplier_no,factory_id,route_id,factories(name),routes(route_name)")
    .eq("role", "supplier").eq("status", "active").order("name");
  if (factoryId) query = query.eq("factory_id", factoryId);
  if (routeUserIds) query = query.in("id", routeUserIds);
  else if (routeId) query = query.eq("route_id", routeId);
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
