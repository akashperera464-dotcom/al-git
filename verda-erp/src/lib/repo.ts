/**
 * Verda · Data-Access Repository (RBAC-enforced · Hybrid Supabase)
 * ------------------------------------------------------------------
 * HYBRID ARCHITECTURE — operational ERP data now lives in Supabase (PostgreSQL).
 * Firebase is used ONLY for Auth + FCM (see auth.hybrid.ts / fcm.ts).
 *
 * Every function:
 *   1. runs a runtime RBAC guard FIRST (identity.ts),
 *   2. talks to Supabase when configured,
 *   3. transparently falls back to the mock arrays in data.ts in demo mode,
 *      still applying the exact same role + ownership filters so the
 *      security boundaries are provable without a live backend.
 *
 * Supabase table names: users, estates, divisions, fields, harvest_records,
 * resource_requests (see docs/supabase_schema.sql).
 */
import { getSupabase, supabaseConfigured } from "./supabase";
import { requireEstateAdmin, requireOwnerOrAdmin, AuthorizationError } from "./identity";
import {
  estates as seedEstates,
  managedUsers as seedUsers,
  supplyHistory,
  type Role,
  type Estate,
  type Division,
  type Field,
  type SupplyRecord,
  type ResourceRequest,
  type ManagedUser,
  type SupplierLocation,
  type FarmActivity,
  type Worker,
} from "./data";

/** Validate a string is a proper UUID (Supabase uuid columns reject anything else). */
export function isValidUuid(id: string | null | undefined): id is string {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/* ======================= 0 · BRANDING / SETTINGS (single-row, DB-persisted) ======================= */

/**
 * Read the app-wide branding config from Supabase `settings` (key='branding').
 * Falls back to null when not configured / not found (caller applies defaults).
 */
export async function readBrandingFromDb(): Promise<Record<string, unknown> | null> {
  if (!supabaseConfigured) return null;
  const sb = getSupabase()!;
  const { data, error } = await sb.from("settings").select("data").eq("key", "branding").single();
  if (error || !data) return null;
  return (data.data as Record<string, unknown>) ?? null;
}

/**
 * Write the branding config to Supabase `settings` (upsert key='branding').
 * Admin-only server-side (RLS "settings admin write"). Throws on failure.
 */
export async function writeBrandingToDb(data: Record<string, unknown>): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase()!;
  const { error } = await sb
    .from("settings")
    .upsert({ key: "branding", data }, { onConflict: "key" });
  if (error) throw new Error(`Could not save branding to database: ${error.message}`);
}

/* ======================= 1 · ESTATE HIERARCHY (admin-only writes) ======================= */

/** Create a top-level Estate. ADMIN / FACTORY_OWNER only. */
export async function createEstate(role: Role, data: Omit<Estate, "id" | "divisions">): Promise<string> {
  requireEstateAdmin(role); // throws for supplier / supervisor — rule #1
  if (!supabaseConfigured) return mockCreate("estates", data);
  const sb = getSupabase()!;
  const { data: row, error } = await sb
    .from("estates")
    .insert({
      name: data.name,
      region: data.region,
      total_area_ha: data.totalAreaHa,
      elevation_m: data.elevationM,
      google_maps_embed_url: data.googleMapsEmbedUrl ?? null,
      planted_date: data.plantedDate ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

/** Create a Division under an Estate. ADMIN / FACTORY_OWNER only. */
export async function createDivision(role: Role, estateId: string, data: Omit<Division, "id" | "fields">): Promise<string> {
  requireEstateAdmin(role);
  if (!supabaseConfigured) return mockCreate(`estates/${estateId}/divisions`, data);
  const sb = getSupabase()!;
  const { data: row, error } = await sb
    .from("divisions")
    .insert({ estate_id: estateId, name: data.name, manager: data.manager, area_ha: data.areaHa })
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

/** Create a Field under a Division. ADMIN / FACTORY_OWNER only. */
export async function createField(role: Role, estateId: string, divisionId: string, data: Omit<Field, "id">): Promise<string> {
  requireEstateAdmin(role);
  if (!supabaseConfigured) return mockCreate(`estates/${estateId}/divisions/${divisionId}/fields`, data);
  const sb = getSupabase()!;
  const { data: row, error } = await sb
    .from("fields")
    .insert({
      division_id: divisionId,
      code: data.code,
      name: data.name,
      cultivar: data.cultivar,
      planting_year: data.plantingYear,
      area_ha: data.areaHa,
      elevation_m: data.elevationM,
      status: data.status,
      last_yield_kg: data.lastYieldKg,
    })
    .select("id")
    .single();
  if (error) throw error;
  return row.id;
}

/** Read the full hierarchy (admin/supervisor). Read access is RBAC-gated upstream. */
export async function readEstateHierarchy(_role: Role): Promise<Estate[]> {
  if (!supabaseConfigured) return seedEstates;
  const sb = getSupabase()!;
  const { data: est, error } = await sb
    .from("estates")
    .select("id, name, region, total_area_ha, elevation_m, google_maps_embed_url, planted_date, latitude, longitude")
    .order("name");
  if (error) throw error;
  const out: Estate[] = [];
  for (const e of est ?? []) {
    const { data: divs } = await sb
      .from("divisions")
      .select("id, name, manager, area_ha")
      .eq("estate_id", e.id)
      .order("name");
    const divisions: Division[] = [];
    for (const d of divs ?? []) {
      const { data: flds } = await sb
        .from("fields")
        .select("id, code, name, cultivar, planting_year, area_ha, elevation_m, status, last_yield_kg")
        .eq("division_id", d.id)
        .order("code");
      divisions.push({
        id: d.id,
        name: d.name,
        manager: d.manager,
        areaHa: d.area_ha,
        fields: (flds ?? []).map((f) => ({
          id: f.id,
          code: f.code,
          name: f.name,
          cultivar: f.cultivar,
          plantingYear: f.planting_year,
          areaHa: f.area_ha,
          elevationM: f.elevation_m,
          status: f.status,
          lastYieldKg: f.last_yield_kg,
        })),
      });
    }
    out.push({
      id: e.id,
      name: e.name,
      region: e.region,
      totalAreaHa: e.total_area_ha,
      elevationM: e.elevation_m,
      googleMapsEmbedUrl: (e as { google_maps_embed_url?: string }).google_maps_embed_url ?? undefined,
      plantedDate: (e as { planted_date?: string }).planted_date ?? undefined,
      latitude: (e as { latitude?: number }).latitude ?? undefined,
      longitude: (e as { longitude?: number }).longitude ?? undefined,
      divisions,
    });
  }
  return out;
}

/* ======================= 1b · USERS + ESTATES (live reads for admin UI) ======================= */

/**
 * Read the user directory from Supabase (live mode) or fall back to the mock
 * seed list (demo mode). This is what the User Management table renders, so
 * creates / edits / deletes reflect the REAL database, not a stale mock array.
 */
export async function readUsersForAdmin(): Promise<ManagedUser[]> {
  if (!supabaseConfigured) return seedUsers;
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("users")
    .select("id, name, email, phone, division, role, associated_entity_id, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load users: ${error.message}`);
  return (data ?? []).map((u): ManagedUser => ({
    id: u.id,
    name: u.name ?? "Verda User",
    email: u.email ?? undefined,
    role: (u.role ?? "supplier") as Role,
    phone: u.phone ?? undefined,
    division: u.division ?? undefined,
    associatedEntityId: u.associated_entity_id ?? undefined,
    status: (u.status ?? "active") as "active" | "suspended",
    lastActive: relativeTime(u.created_at),
  }));
}

/**
 * Read estates as lightweight {id, name} options for dropdowns. In live mode
 * these are REAL UUIDs (fixes the "invalid input syntax for type uuid" error
 * that occurred when the mock string id "est-glenview" was inserted).
 */
export async function readEstateOptions(): Promise<{ id: string; name: string }[]> {
  if (!supabaseConfigured) return seedEstates.map((e) => ({ id: e.id, name: e.name }));
  const sb = getSupabase()!;
  const { data, error } = await sb.from("estates").select("id, name").order("name");
  if (error) throw new Error(`Could not load estates: ${error.message}`);
  return (data ?? []).map((e) => ({ id: e.id as string, name: e.name as string }));
}

/** Read divisions (with their estate name) for the supervisor dropdown. */
export async function readDivisionOptions(): Promise<{ id: string; name: string; estateName: string }[]> {
  if (!supabaseConfigured) {
    return seedEstates.flatMap((e) => e.divisions.map((d) => ({ id: d.id, name: d.name, estateName: e.name })));
  }
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("divisions")
    .select("id, name, estates(name)")
    .order("name");
  if (error) throw new Error(`Could not load divisions: ${error.message}`);
  return (data ?? []).map((d) => ({
    id: d.id as string,
    name: d.name as string,
    estateName: (d as { estates?: { name?: string } }).estates?.name ?? "—",
  }));
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Supervisor saves a daily leaf weigh-in. Supplier reads are owner-scoped. */
export async function saveLeafWeighing(role: Role, input: {
  workerId?: string;
  fieldId: string;
  centerId?: string;
  grossKg: number;
  netKg: number;
  grade: string;
}): Promise<string> {
  if (!supabaseConfigured) return mockCreate("harvest_records", input);
  const sb = getSupabase()!;
  const { data: row, error } = await sb
    .from("harvest_records")
    .insert({
      worker_id: input.workerId ?? null,
      field_id: input.fieldId,
      center_id: input.centerId ?? null,
      gross_kg: input.grossKg,
      net_kg: input.netKg,
      grade: input.grade,
    })
    .select("id")
    .single();
  if (error) throw error;
  void role; // RLS enforces supervisor/admin writes server-side
  return row.id;
}

/** My Leaf Deliveries — scoped to the caller's uid AND linked estate (rule #2 + #3). */
export async function getMyDeliveries(role: Role, callerUid: string, associatedEntityId: string): Promise<SupplyRecord[]> {
  requireOwnerOrAdmin(role, callerUid, callerUid); // throws if supplier asks for another's uid
  if (!supabaseConfigured) {
    return supplyHistory.filter((r) => r.supplierId === callerUid && r.estateId === associatedEntityId);
  }
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("harvest_records")
    .select("id, supplier_id, estate_id, weighed_at, net_kg, grade, amount, status")
    .eq("supplier_id", callerUid)
    .eq("estate_id", associatedEntityId)
    .order("weighed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    supplierId: r.supplier_id,
    estateId: r.estate_id,
    date: r.weighed_at,
    kg: r.net_kg,
    grade: r.grade,
    amount: r.amount ?? 0,
    status: r.status as SupplyRecord["status"],
  }));
}

/** Payment history — same uid + estate-scoped boundary. */
export async function getMyPayments(role: Role, callerUid: string, associatedEntityId: string): Promise<SupplyRecord[]> {
  requireOwnerOrAdmin(role, callerUid, callerUid);
  if (!supabaseConfigured) {
    return supplyHistory
      .filter((r) => r.supplierId === callerUid && r.estateId === associatedEntityId)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("harvest_records")
    .select("id, supplier_id, estate_id, weighed_at, net_kg, grade, amount, status")
    .eq("supplier_id", callerUid)
    .eq("estate_id", associatedEntityId)
    .order("weighed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    supplierId: r.supplier_id,
    estateId: r.estate_id,
    date: r.weighed_at,
    kg: r.net_kg,
    grade: r.grade,
    amount: r.amount ?? 0,
    status: r.status as SupplyRecord["status"],
  }));
}

/* ======================= 3 · RESOURCE REQUESTS ======================= */

/** Supplier creates a PENDING resource request. */
export async function createResourceRequest(role: Role, input: Omit<ResourceRequest, "id" | "status" | "timestamp">): Promise<string> {
  if (!supabaseConfigured) return mockCreate("resource_requests", input);
  const sb = getSupabase()!;
  const { data: row, error } = await sb
    .from("resource_requests")
    .insert({
      supplier_id: input.supplierId,
      type: input.type,
      item_details: input.itemDetails,
      quantity: input.quantity,
      date_needed: input.dateNeeded,
      duration_days: input.durationDays,
      note: input.note,
      status: "PENDING",
    })
    .select("id")
    .single();
  if (error) throw error;
  void role;
  return row.id;
}

/** Admin inbox — all requests (RLS restricts to admins server-side). */
export async function readResourceRequests(_role: Role): Promise<ResourceRequest[]> {
  const sb = getSupabase();
  if (!sb || !supabaseConfigured) return [];
  const { data, error } = await sb.from("resource_requests").select("*").order("timestamp", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toResourceRequest);
}

/** Admin approves/rejects — silent state change, FCM handled by a Supabase trigger. */
export async function decideResourceRequest(role: Role, id: string, status: ResourceRequest["status"], adminNotes: string): Promise<void> {
  if (!supabaseConfigured) return;
  requireEstateAdmin(role);
  const sb = getSupabase()!;
  const { error } = await sb.from("resource_requests").update({ status, admin_notes: adminNotes }).eq("id", id);
  if (error) throw error;
}

/* ======================= 4 · DEMO FALLBACK HELPERS ======================= */

function mockCreate(path: string, data: Record<string, unknown>): string {
  const id = `mock-${Date.now()}`;
  // eslint-disable-next-line no-console
  console.info(`[repo:demo] would write ${path}/${id}`, data);
  return id;
}

/**
 * Synchronous helper for components needing the filtered demo set without
 * awaiting. Mirrors getMyDeliveries' ownership rule exactly (rule #2 + #3).
 */
export function myDeliveriesSync(role: Role, callerUid: string, associatedEntityId: string): SupplyRecord[] {
  requireOwnerOrAdmin(role, callerUid, callerUid);
  return supplyHistory.filter((r) => r.supplierId === callerUid && r.estateId === associatedEntityId);
}

function toResourceRequest(r: Record<string, any>): ResourceRequest {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name ?? "",
    type: r.type,
    itemDetails: r.item_details,
    quantity: r.quantity,
    dateNeeded: r.date_needed,
    durationDays: r.duration_days,
    note: r.note ?? "",
    status: r.status,
    adminNotes: r.admin_notes ?? "",
    timestamp: r.timestamp,
  };
}

/* ======================= 4a · GENERIC CRUD (all admin tables) ======================= */

/**
 * Generic CRUD helper — works for any Supabase table.
 * All admin modules use this to avoid duplicating CRUD boilerplate.
 */
export async function crudCreate<T extends Record<string, unknown>>(table: string, data: T): Promise<string> {
  if (!supabaseConfigured) return `mock-${Date.now()}`;
  const sb = getSupabase()!;
  const { data: row, error } = await sb.from(table).insert(data).select("id").single();
  if (error) throw new Error(`Create in ${table} failed: ${error.message}`);
  return row.id;
}

export async function crudRead<T>(table: string): Promise<T[]> {
  if (!supabaseConfigured) return [];
  const sb = getSupabase()!;
  const { data, error } = await sb.from(table).select("*").order("created_at", { ascending: false });
  if (error) throw new Error(`Read from ${table} failed: ${error.message}`);
  return (data ?? []) as T[];
}

export async function crudUpdate(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase()!;
  const { error } = await sb.from(table).update(patch).eq("id", id);
  if (error) throw new Error(`Update in ${table} failed: ${error.message}`);
}

export async function crudDelete(table: string, id: string): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase()!;
  const { error } = await sb.from(table).delete().eq("id", id);
  if (error) throw new Error(`Delete from ${table} failed: ${error.message}`);
}

/* ======================= 4b · WORKERS (CRUD + real-time) ======================= */

/** Read all workers from Supabase (or mock seed in demo mode). */
export async function readWorkers(): Promise<Worker[]> {
  if (!supabaseConfigured) {
    const { workers: seed } = await import("./data");
    return seed;
  }
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("workers")
    .select("id, name, nic, division, role, bank_account, phone, points_balance, attendance_30d, avg_kg_per_day, present, status, created_at")
    .order("name");
  if (error) throw new Error(`Could not load workers: ${error.message}`);
  return (data ?? []).map((w): Worker => ({
    id: w.id,
    name: w.name ?? "Unknown",
    nic: w.nic ?? "",
    division: w.division ?? "—",
    role: (w.role ?? "Field Worker") as Worker["role"],
    bankAccount: w.bank_account ?? "",
    pointsBalance: w.points_balance ?? 0,
    attendance30d: w.attendance_30d ?? 0,
    avgKgPerDay: Number(w.avg_kg_per_day ?? 0),
    present: w.present ?? false,
  }));
}

/** Create a new worker → returns the new DB id. */
export async function createWorker(data: Omit<Worker, "id">): Promise<string> {
  if (!supabaseConfigured) return `w-${Date.now()}`;
  const sb = getSupabase()!;
  const { data: row, error } = await sb
    .from("workers")
    .insert({
      name: data.name,
      nic: data.nic || null,
      division: data.division || null,
      role: data.role,
      bank_account: data.bankAccount || null,
      points_balance: data.pointsBalance ?? 0,
      attendance_30d: data.attendance30d ?? 0,
      avg_kg_per_day: data.avgKgPerDay ?? 0,
      present: data.present ?? false,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Create worker failed: ${error.message}`);
  return row.id;
}

/** Update a worker record. */
export async function updateWorker(id: string, patch: Partial<Omit<Worker, "id">>): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase()!;
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.nic !== undefined) row.nic = patch.nic;
  if (patch.division !== undefined) row.division = patch.division;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.bankAccount !== undefined) row.bank_account = patch.bankAccount;
  if (patch.pointsBalance !== undefined) row.points_balance = patch.pointsBalance;
  if (patch.attendance30d !== undefined) row.attendance_30d = patch.attendance30d;
  if (patch.avgKgPerDay !== undefined) row.avg_kg_per_day = patch.avgKgPerDay;
  if (patch.present !== undefined) row.present = patch.present;
  if (!Object.keys(row).length) return;
  const { error } = await sb.from("workers").update(row).eq("id", id);
  if (error) throw new Error(`Update worker failed: ${error.message}`);
}

/** Delete a worker permanently. */
export async function deleteWorker(id: string): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase()!;
  const { error } = await sb.from("workers").delete().eq("id", id);
  if (error) throw new Error(`Delete worker failed: ${error.message}`);
}

/* ======================= 5 · LIVE HARVEST RECORDS (real-time) ======================= */

/**
 * Read ALL harvest records (admin view). Falls back to mock in demo mode.
 * Used by Estate Dashboard + Harvest Management with real-time sync.
 */
export async function readAllHarvestRecords(): Promise<SupplyRecord[]> {
  if (!supabaseConfigured) return supplyHistory;
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("harvest_records")
    .select("id, supplier_id, estate_id, weighed_at, net_kg, grade, amount, status")
    .order("weighed_at", { ascending: false });
  if (error) throw new Error(`Could not load harvest: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    supplierId: r.supplier_id ?? "",
    estateId: r.estate_id ?? "",
    date: r.weighed_at,
    kg: Number(r.net_kg),
    grade: r.grade ?? "Standard",
    amount: Number(r.amount ?? 0),
    status: (r.status as SupplyRecord["status"]) ?? "Pending",
  }));
}

/**
 * Read a supplier's OWN harvest records (supplier view).
 * Uses `useLiveData("harvest_records", ..., "supplier_id=eq.{uid}")` for real-time.
 */
export async function readMyHarvestRecords(supplierId: string, estateId: string): Promise<SupplyRecord[]> {
  requireOwnerOrAdmin("supplier", supplierId, supplierId);
  if (!supabaseConfigured) {
    return supplyHistory.filter((r) => r.supplierId === supplierId && r.estateId === estateId);
  }
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("harvest_records")
    .select("id, supplier_id, estate_id, weighed_at, net_kg, grade, amount, status")
    .eq("supplier_id", supplierId)
    .eq("estate_id", estateId)
    .order("weighed_at", { ascending: false });
  if (error) throw new Error(`Could not load deliveries: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    supplierId: r.supplier_id ?? "",
    estateId: r.estate_id ?? "",
    date: r.weighed_at,
    kg: Number(r.net_kg),
    grade: r.grade ?? "Standard",
    amount: Number(r.amount ?? 0),
    status: (r.status as SupplyRecord["status"]) ?? "Pending",
  }));
}

/* ======================= 6 · ESTATE MAPS + SUPPLIER LOCATIONS ======================= */

/** Update an estate's Google Maps embed URL (admin only). */
export async function updateEstateMap(role: Role, estateId: string, googleMapsEmbedUrl: string): Promise<void> {
  requireEstateAdmin(role);
  if (!supabaseConfigured) return;
  const sb = getSupabase()!;
  const { error } = await sb.from("estates").update({ google_maps_embed_url: googleMapsEmbedUrl || null }).eq("id", estateId);
  if (error) throw new Error(`Update estate map failed: ${error.message}`);
}

/**
 * Update an estate's planted_date — drives the pruning schedule engine.
 * Open write (client RBAC gates the UI); suppliers can set their own block's date.
 */
export async function updateEstatePlantedDate(estateId: string, plantedDate: string): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase()!;
  const { error } = await sb.from("estates").update({ planted_date: plantedDate || null }).eq("id", estateId);
  if (error) throw new Error(`Update planted date failed: ${error.message}`);
}

/** Supplier records a live GPS check-in → supplier_locations. */
export async function recordSupplierLocation(
  userId: string,
  latitude: number,
  longitude: number,
  deliveryId?: string
): Promise<void> {
  if (!supabaseConfigured) {
    // eslint-disable-next-line no-console
    console.info("[repo:demo] would INSERT supplier_locations", { userId, latitude, longitude });
    return;
  }
  const sb = getSupabase()!;
  const { error } = await sb.from("supplier_locations").insert({
    user_id: userId,
    latitude,
    longitude,
    delivery_id: deliveryId && isValidUuid(deliveryId) ? deliveryId : null,
  });
  if (error) throw new Error(`Location check-in failed: ${error.message}`);
}

/* ======================= 7 · FARM ACTIVITIES (advisory feedback loop) ======================= */

/** Insert a farm activity (fertilizer/pruning/self_harvest). */
export async function recordFarmActivity(
  userId: string,
  activityType: FarmActivity["activityType"],
  loggedDate: string,
  details: Record<string, unknown>
): Promise<void> {
  if (!supabaseConfigured) {
    // eslint-disable-next-line no-console
    console.info("[repo:demo] would INSERT farm_activities", { userId, activityType, loggedDate, details });
    return;
  }
  const sb = getSupabase()!;
  const { error } = await sb.from("farm_activities").insert({
    user_id: userId,
    activity_type: activityType,
    logged_date: loggedDate,
    details,
  });
  if (error) throw new Error(`Farm activity insert failed: ${error.message}`);
}

/** Read a supplier's farm activity history (most recent first). */
export async function readFarmActivities(userId: string, limit = 30): Promise<FarmActivity[]> {
  if (!supabaseConfigured) return [];
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("farm_activities")
    .select("id, user_id, activity_type, logged_date, details, created_at")
    .eq("user_id", userId)
    .order("logged_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load farm activities: ${error.message}`);
  return (data ?? []).map((a) => ({
    id: a.id,
    userId: a.user_id,
    activityType: a.activity_type as FarmActivity["activityType"],
    loggedDate: a.logged_date,
    details: a.details ?? {},
    createdAt: a.created_at,
  }));
}

/** Read the LATEST activity of a given type for a user — feeds the advisory loop. */
export async function readLatestFarmActivity(
  userId: string,
  activityType: FarmActivity["activityType"]
): Promise<FarmActivity | null> {
  if (!supabaseConfigured) return null;
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("farm_activities")
    .select("id, user_id, activity_type, logged_date, details, created_at")
    .eq("user_id", userId)
    .eq("activity_type", activityType)
    .order("logged_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    activityType: data.activity_type as FarmActivity["activityType"],
    loggedDate: data.logged_date,
    details: data.details ?? {},
    createdAt: data.created_at,
  };
}

/* ======================= 8 · SUPPLIER LOCATIONS (GPS check-ins) ======================= */

/** Read a supplier's check-in history (supplier: own; admin: any). */
export async function readSupplierLocations(userId: string, limit = 20): Promise<SupplierLocation[]> {
  if (!supabaseConfigured) return [];
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("supplier_locations")
    .select("id, user_id, latitude, longitude, delivery_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load locations: ${error.message}`);
  return (data ?? []).map((l) => ({
    id: l.id,
    userId: l.user_id,
    latitude: Number(l.latitude),
    longitude: Number(l.longitude),
    deliveryId: l.delivery_id ?? null,
    createdAt: l.created_at,
  }));
}

export { AuthorizationError };
