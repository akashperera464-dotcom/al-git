import { getSupabase, supabaseConfigured } from "./supabase";

const schemaError = (feature: string, error: { message?: string; code?: string }) => {
  const missing = error.code === "42P01" || error.code === "42703" || /does not exist|schema cache/i.test(error.message ?? "");
  return new Error(missing ? `${feature} requires the Round 15 database migration.` : (error.message || `${feature} failed.`));
};

export type WorkflowType = "weight_dispute" | "support" | "profile_change" | "route_change";
export type WorkflowStatus = "pending" | "approved" | "rejected" | "resolved" | "cancelled";
export interface WorkflowRequest {
  id: string; requestType: WorkflowType; requestedBy: string; relatedEntityType?: string;
  relatedEntityId?: string; subject: string; details: Record<string, unknown>;
  status: WorkflowStatus; resolution?: string; reviewedBy?: string; reviewedAt?: string; createdAt: string;
}

const mapWorkflow = (row: Record<string, any>): WorkflowRequest => ({
  id: row.id, requestType: row.request_type, requestedBy: row.requested_by,
  relatedEntityType: row.related_entity_type ?? undefined, relatedEntityId: row.related_entity_id ?? undefined,
  subject: row.subject, details: row.details ?? {}, status: row.status,
  resolution: row.resolution ?? undefined, reviewedBy: row.reviewed_by ?? undefined,
  reviewedAt: row.reviewed_at ?? undefined, createdAt: row.created_at,
});

export async function createWorkflowRequest(input: Omit<WorkflowRequest, "id" | "status" | "createdAt" | "resolution" | "reviewedBy" | "reviewedAt">): Promise<string> {
  if (!supabaseConfigured) throw new Error("Database connection is required.");
  const { data, error } = await getSupabase()!.from("operational_requests").insert({
    request_type: input.requestType, requested_by: input.requestedBy,
    related_entity_type: input.relatedEntityType ?? null, related_entity_id: input.relatedEntityId ?? null,
    subject: input.subject, details: input.details,
  }).select("id").single();
  if (error) throw schemaError("Requests", error);
  return data.id;
}

export async function readWorkflowRequests(filters: { requestedBy?: string; status?: WorkflowStatus; type?: WorkflowType } = {}): Promise<WorkflowRequest[]> {
  if (!supabaseConfigured) return [];
  let query = getSupabase()!.from("operational_requests").select("*").order("created_at", { ascending: false });
  if (filters.requestedBy) query = query.eq("requested_by", filters.requestedBy);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.type) query = query.eq("request_type", filters.type);
  const { data, error } = await query;
  if (error) throw schemaError("Requests", error);
  return (data ?? []).map((row) => mapWorkflow(row));
}

export async function decideWorkflowRequest(id: string, status: Exclude<WorkflowStatus, "pending">, resolution: string, reviewerId: string): Promise<void> {
  const sb = getSupabase()!;
  const { data: request, error: readError } = await sb.from("operational_requests").select("request_type,requested_by,details").eq("id", id).single();
  if (readError) throw schemaError("Request decision", readError);
  if (status === "approved" && request.request_type === "profile_change") {
    const profile = request.details?.profile ?? request.details;
    await sb.from("supplier_profiles").upsert({
      supplier_id: request.requested_by, name: profile.name ?? null, phone: profile.phone ?? null,
      nic: profile.nic ?? null, address: profile.address ?? null, emergency_contact: profile.emergencyContact ?? null,
      photo_url: profile.photoUrl ?? null, notification_preferences: profile.notificationPrefs ?? {}, updated_at: new Date().toISOString(),
    }, { onConflict: "supplier_id" });
    await sb.from("users").update({ name: profile.name ?? undefined, phone: profile.phone ?? undefined }).eq("id", request.requested_by);
  }
  const { error } = await sb.from("operational_requests").update({
    status, resolution, reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw schemaError("Request decision", error);
}

export interface SupplierProfileRecord {
  name: string; phone: string; nic: string; address: string; emergencyContact: string; photoUrl: string;
  notificationPrefs: Record<string, boolean>;
}

export async function readSupplierProfile(userId: string): Promise<SupplierProfileRecord | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await getSupabase()!.from("supplier_profiles").select("*").eq("supplier_id", userId).maybeSingle();
  if (error) throw schemaError("Supplier profile", error);
  return data ? {
    name: data.name ?? "", phone: data.phone ?? "", nic: data.nic ?? "", address: data.address ?? "",
    emergencyContact: data.emergency_contact ?? "", photoUrl: data.photo_url ?? "",
    notificationPrefs: data.notification_preferences ?? {},
  } : null;
}

export async function saveSupplierProfile(userId: string, profile: SupplierProfileRecord): Promise<void> {
  const { error } = await getSupabase()!.from("supplier_profiles").upsert({
    supplier_id: userId, name: profile.name, phone: profile.phone, nic: profile.nic,
    address: profile.address, emergency_contact: profile.emergencyContact, photo_url: profile.photoUrl,
    notification_preferences: profile.notificationPrefs, updated_at: new Date().toISOString(),
  }, { onConflict: "supplier_id" });
  if (error) throw schemaError("Supplier profile", error);
}

export interface HealthEvent {
  id: string; category: string; severity: string; userId?: string; module?: string;
  message: string; details: Record<string, unknown>; resolvedAt?: string; createdAt: string;
}

export async function recordHealthEvent(input: { category: string; severity?: string; userId?: string; module?: string; message: string; details?: Record<string, unknown> }): Promise<void> {
  if (!supabaseConfigured) return;
  await getSupabase()!.from("system_health_events").insert({
    category: input.category, severity: input.severity ?? "error", user_id: input.userId ?? null,
    module: input.module ?? null, message: input.message, details: input.details ?? {},
  });
}

export async function readHealthEvents(limit = 100): Promise<HealthEvent[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await getSupabase()!.from("system_health_events").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw schemaError("System health", error);
  return (data ?? []).map((row) => ({ id: row.id, category: row.category, severity: row.severity,
    userId: row.user_id ?? undefined, module: row.module ?? undefined, message: row.message,
    details: row.details ?? {}, resolvedAt: row.resolved_at ?? undefined, createdAt: row.created_at }));
}

export async function resolveHealthEvent(id: string, userId: string): Promise<void> {
  const { error } = await getSupabase()!.from("system_health_events").update({ resolved_at: new Date().toISOString(), resolved_by: userId }).eq("id", id);
  if (error) throw schemaError("System health", error);
}

function deviceId(): string {
  const key = "verda.device_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID(); localStorage.setItem(key, created); return created;
}

export async function registerDeviceSession(userId: string): Promise<void> {
  if (!supabaseConfigured || !userId) return;
  const ua = navigator.userAgent;
  const name = /iPhone/i.test(ua) ? "iPhone" : /iPad/i.test(ua) ? "iPad" : /Android/i.test(ua) ? "Android" : /Windows/i.test(ua) ? "Windows" : "Web device";
  await getSupabase()!.from("user_device_sessions").upsert({ user_id: userId, device_id: deviceId(), device_name: name, user_agent: ua, last_seen_at: new Date().toISOString() }, { onConflict: "user_id,device_id" });
}

export async function isCurrentDeviceSessionRevoked(userId: string): Promise<boolean> {
  if (!supabaseConfigured || !userId) return false;
  const { data } = await getSupabase()!.from("user_device_sessions").select("revoked_at").eq("user_id", userId).eq("device_id", deviceId()).maybeSingle();
  return Boolean(data?.revoked_at);
}

export interface DeviceSession { id: string; userId: string; deviceName: string; lastSeenAt: string; revokedAt?: string }
export async function readDeviceSessions(): Promise<DeviceSession[]> {
  const { data, error } = await getSupabase()!.from("user_device_sessions").select("id,user_id,device_name,last_seen_at,revoked_at").order("last_seen_at", { ascending: false });
  if (error) throw schemaError("Device sessions", error);
  return (data ?? []).map((row) => ({ id: row.id, userId: row.user_id, deviceName: row.device_name ?? "Device", lastSeenAt: row.last_seen_at, revokedAt: row.revoked_at ?? undefined }));
}
export async function revokeDeviceSession(id: string, adminId: string): Promise<void> {
  const { error } = await getSupabase()!.from("user_device_sessions").update({ revoked_at: new Date().toISOString(), revoked_by: adminId }).eq("id", id);
  if (error) throw schemaError("Device session", error);
}

export interface RouteStop { id: string; assignmentId: string; order: number; supplierId: string; estateId?: string; status: "pending" | "arrived" | "completed" | "missed"; supplierName?: string; supplierNo?: string; estateName?: string }
export async function seedAssignmentStops(assignmentId: string, routeId: string): Promise<void> {
  const sb = getSupabase()!;
  const { data: assigned } = await sb.from("user_route_assignments").select("user_id").eq("route_id", routeId);
  const ids = (assigned ?? []).map((row) => row.user_id);
  if (!ids.length) return;
  const { data: users } = await sb.from("users").select("id,supplier_no").in("id", ids).eq("role", "supplier").eq("status", "active").order("supplier_no");
  const { data: estates } = await sb.from("estates").select("id,owner_supplier_id").in("owner_supplier_id", ids).eq("route_id", routeId).eq("status", "approved");
  const firstEstate = new Map<string, string>();
  for (const estate of estates ?? []) if (!firstEstate.has(estate.owner_supplier_id)) firstEstate.set(estate.owner_supplier_id, estate.id);
  const { data: existing, error: existingError } = await sb
    .from("collection_route_stops")
    .select("supplier_id,estate_id")
    .eq("assignment_id", assignmentId);
  if (existingError) throw schemaError("Route stops", existingError);
  const existingKeys = new Set((existing ?? []).map((row) => `${row.supplier_id}:${row.estate_id ?? ""}`));
  const rows = (users ?? [])
    .map((user, index) => ({ assignment_id: assignmentId, stop_order: index + 1, supplier_id: user.id, estate_id: firstEstate.get(user.id) ?? null }))
    .filter((row) => !existingKeys.has(`${row.supplier_id}:${row.estate_id ?? ""}`));
  if (rows.length) {
    const { error } = await sb.from("collection_route_stops").insert(rows);
    if (error) throw schemaError("Route stops", error);
  }
}

export async function readRouteStops(assignmentId: string): Promise<RouteStop[]> {
  const { data, error } = await getSupabase()!.from("collection_route_stops").select("id,assignment_id,stop_order,supplier_id,estate_id,status,users!collection_route_stops_supplier_id_fkey(name,supplier_no),estates(name)").eq("assignment_id", assignmentId).order("stop_order");
  if (error) {
    // Some databases cannot infer the text FK; keep the operational list usable.
    const fallback = await getSupabase()!.from("collection_route_stops").select("id,assignment_id,stop_order,supplier_id,estate_id,status").eq("assignment_id", assignmentId).order("stop_order");
    if (fallback.error) throw schemaError("Route stops", fallback.error);
    return (fallback.data ?? []).map((row) => ({ id: row.id, assignmentId: row.assignment_id, order: row.stop_order, supplierId: row.supplier_id, estateId: row.estate_id ?? undefined, status: row.status }));
  }
  return (data ?? []).map((row: any) => ({ id: row.id, assignmentId: row.assignment_id, order: row.stop_order, supplierId: row.supplier_id,
    estateId: row.estate_id ?? undefined, status: row.status, supplierName: row.users?.name, supplierNo: row.users?.supplier_no, estateName: row.estates?.name }));
}

export async function updateRouteStop(id: string, status: RouteStop["status"], missedReason?: string): Promise<void> {
  const patch: Record<string, unknown> = { status, missed_reason: missedReason ?? null };
  if (status === "arrived") patch.arrived_at = new Date().toISOString();
  if (status === "completed") patch.completed_at = new Date().toISOString();
  const { error } = await getSupabase()!.from("collection_route_stops").update(patch).eq("id", id);
  if (error) throw schemaError("Route stop", error);
}

export interface DuplicateUserGroup { field: "email" | "phone" | "supplier_no"; value: string; userIds: string[] }
export async function readDuplicateUsers(): Promise<DuplicateUserGroup[]> {
  const { data, error } = await getSupabase()!.from("users").select("id,email,phone,supplier_no");
  if (error) throw error;
  const result: DuplicateUserGroup[] = [];
  for (const field of ["email", "phone", "supplier_no"] as const) {
    const groups = new Map<string, string[]>();
    for (const row of data ?? []) { const value = String(row[field] ?? "").trim().toLowerCase(); if (value) groups.set(value, [...(groups.get(value) ?? []), row.id]); }
    for (const [value, userIds] of groups) if (userIds.length > 1) result.push({ field, value, userIds });
  }
  return result;
}

export async function readUserNames(userIds: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await getSupabase()!.from("users").select("id,name").in("id", unique);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((row) => [row.id, row.name ?? row.id]));
}

export interface CollectionReconciliation { collectorId: string; supplierCount: number; deliveryCount: number; totalKg: number }
export async function readCollectionReconciliation(date: string): Promise<CollectionReconciliation[]> {
  const start = `${date}T00:00:00`; const end = `${date}T23:59:59`;
  const sb = getSupabase()!;
  let result: { data: Array<{ collector_id: string | null; supplier_id: string | null; net_kg: number | null; record_status?: string }> | null; error: any } = await sb.from("harvest_records").select("collector_id,supplier_id,net_kg,record_status").gte("created_at", start).lte("created_at", end);
  if (result.error && (result.error.code === "42703" || result.error.code === "PGRST204")) {
    result = await sb.from("harvest_records").select("collector_id,supplier_id,net_kg").gte("created_at", start).lte("created_at", end);
  }
  const { data, error } = result;
  if (error) throw schemaError("Collection reconciliation", error);
  const groups = new Map<string, { suppliers: Set<string>; count: number; kg: number }>();
  for (const row of data ?? []) { if (row.record_status === "void") continue; const key = row.collector_id ?? "unassigned"; const group = groups.get(key) ?? { suppliers: new Set<string>(), count: 0, kg: 0 }; if (row.supplier_id) group.suppliers.add(row.supplier_id); group.count += 1; group.kg += Number(row.net_kg ?? 0); groups.set(key, group); }
  return [...groups].map(([collectorId, group]) => ({ collectorId, supplierCount: group.suppliers.size, deliveryCount: group.count, totalKg: group.kg }));
}

export interface MonthlyFactoryReport { factoryId: string; deliveryCount: number; supplierCount: number; totalKg: number; grossAmount: number }
export async function readMonthlyFactoryReport(periodMonth: string): Promise<MonthlyFactoryReport[]> {
  const start = `${periodMonth.slice(0, 7)}-01T00:00:00`;
  const next = new Date(`${periodMonth.slice(0, 7)}-01T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
  const sb = getSupabase()!;
  let result: { data: Array<{ factory_id: string | null; supplier_id: string | null; net_kg: number | null; amount: number | null; record_status?: string }> | null; error: any } = await sb.from("harvest_records").select("factory_id,supplier_id,net_kg,amount,record_status").gte("created_at", start).lt("created_at", next.toISOString());
  if (result.error && (result.error.code === "42703" || result.error.code === "PGRST204")) {
    result = await sb.from("harvest_records").select("factory_id,supplier_id,net_kg,amount").gte("created_at", start).lt("created_at", next.toISOString());
  }
  if (result.error) throw schemaError("Monthly factory report", result.error);
  const groups = new Map<string, { suppliers: Set<string>; count: number; kg: number; amount: number }>();
  for (const row of result.data ?? []) {
    if ((row as { record_status?: string }).record_status === "void") continue;
    const key = row.factory_id ?? "unassigned";
    const group = groups.get(key) ?? { suppliers: new Set<string>(), count: 0, kg: 0, amount: 0 };
    if (row.supplier_id) group.suppliers.add(row.supplier_id);
    group.count += 1; group.kg += Number(row.net_kg ?? 0); group.amount += Number(row.amount ?? 0); groups.set(key, group);
  }
  return [...groups].map(([factoryId, group]) => ({ factoryId, deliveryCount: group.count, supplierCount: group.suppliers.size, totalKg: group.kg, grossAmount: group.amount }));
}

export interface MonthClosure { id: string; factoryId?: string; periodMonth: string; status: "open" | "locked" | "reopened"; lockedAt?: string }
export async function setMonthClosure(factoryId: string | null, periodMonth: string, status: "locked" | "reopened", actorId: string, reason = ""): Promise<void> {
  const row: Record<string, unknown> = { factory_id: factoryId, period_month: `${periodMonth.slice(0,7)}-01`, status, reason };
  if (status === "locked") Object.assign(row, { locked_by: actorId, locked_at: new Date().toISOString() });
  else Object.assign(row, { reopened_by: actorId, reopened_at: new Date().toISOString() });
  const sb = getSupabase()!;
  const month = `${periodMonth.slice(0,7)}-01`;
  let existing = sb.from("month_end_closures").select("id").eq("period_month", month);
  existing = factoryId ? existing.eq("factory_id", factoryId) : existing.is("factory_id", null);
  const found = await existing.maybeSingle();
  const result = found.data?.id ? await sb.from("month_end_closures").update(row).eq("id", found.data.id) : await sb.from("month_end_closures").insert(row);
  const error = result.error;
  if (error) throw schemaError("Month-end", error);
}

export async function readMonthClosures(periodMonth?: string): Promise<MonthClosure[]> {
  let query = getSupabase()!.from("month_end_closures").select("id,factory_id,period_month,status,locked_at");
  if (periodMonth) query = query.eq("period_month", `${periodMonth.slice(0,7)}-01`);
  const { data, error } = await query;
  if (error) throw schemaError("Month-end", error);
  return (data ?? []).map((row) => ({ id: row.id, factoryId: row.factory_id ?? undefined, periodMonth: row.period_month, status: row.status, lockedAt: row.locked_at ?? undefined }));
}
