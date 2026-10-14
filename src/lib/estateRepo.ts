/**
 * Unified Estate Repository (Round 11)
 * --------------------------------------------------------------------------
 * This is the single data path used by the admin Estate Master and the
 * supplier My Tea Estates screen.  Firebase still owns authentication;
 * Supabase owns estate data and workflow state.
 */
import { getSupabase, supabaseConfigured } from "./supabase";

export type EstateStatus = "pending" | "approved" | "rejected";
export type EstateSizeCategory = "small" | "medium" | "large";

export interface EstateBlock {
  id: string;
  estateId: string;
  name: string;
  areaHa: number;
  bushCount: number;
  cultivar?: string;
  soilType?: string;
  status: "plucking" | "pruned" | "young" | "nursery";
  plantingYear?: number;
}

export interface EstateOwner {
  id: string;
  supplierNo: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
}

export interface Estate {
  id: string;
  ownerSupplierId: string | null;
  owner?: EstateOwner;
  name: string;
  sizeCategory: EstateSizeCategory;
  acreage: number;
  bushCount: number;
  cultivar?: string;
  region?: string;
  soilType?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  contactPhone?: string;
  photoUrls?: string[];
  factoryId?: string;
  routeId?: string;
  factoryName?: string;
  routeName?: string;
  status: EstateStatus;
  submittedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  editCount: number;
  lastEditedAt?: string;
  createdByAdmin: boolean;
  notes?: string;
  blocks: EstateBlock[];
}

export interface SupplierSearchResult {
  id: string;
  supplierNo: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  factoryId?: string;
  routeId?: string;
  factoryName?: string;
  routeName?: string;
  status: string;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminName?: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface CreateEstateInput {
  ownerSupplierId?: string | null;
  name: string;
  sizeCategory: EstateSizeCategory;
  acreage: number;
  bushCount: number;
  cultivar: string;
  region: string;
  soilType?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  contactPhone?: string;
  photoUrls?: string[];
  factoryId?: string;
  routeId?: string;
  blocks?: Array<{
    name: string;
    areaHa: number;
    bushCount: number;
    cultivar?: string;
    soilType?: string;
    status?: EstateBlock["status"];
    plantingYear?: number;
  }>;
  notes?: string;
  createdByAdmin: boolean;
  actorId?: string;
}

const DEMO_KEY = "verda.round11.estates";

function numberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function nestedObject(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined;
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return undefined;
}

function mapEstate(row: Record<string, any>): Estate {
  const owner = nestedObject(row.owner);
  const factory = nestedObject(row.factory);
  const route = nestedObject(row.route);
  const blocks = Array.isArray(row.estate_blocks) ? row.estate_blocks : [];
  const totalHa = Number(row.total_area_ha ?? 0);
  return {
    id: String(row.id),
    ownerSupplierId: row.owner_supplier_id ?? row.supplier_id ?? null,
    owner: owner ? {
      id: String(owner.id),
      supplierNo: (owner.supplier_no as string | null) ?? null,
      name: String(owner.name ?? "Supplier"),
      phone: (owner.phone as string | null) ?? null,
      email: (owner.email as string | null) ?? null,
      status: String(owner.status ?? "active"),
    } : undefined,
    name: String(row.name ?? "Unnamed estate"),
    sizeCategory: (row.size_category ?? sizeFromAcreage(Number(row.total_area_acres ?? totalHa * 2.471))) as EstateSizeCategory,
    acreage: Number(row.total_area_acres ?? totalHa * 2.471),
    bushCount: Number(row.total_bush_count ?? 0),
    cultivar: row.cultivar ?? undefined,
    region: row.region ?? undefined,
    soilType: row.soil_type ?? undefined,
    latitude: numberOrUndefined(row.latitude),
    longitude: numberOrUndefined(row.longitude),
    address: row.address ?? undefined,
    contactPhone: row.contact_phone ?? undefined,
    photoUrls: Array.isArray(row.photo_urls) ? row.photo_urls : [],
    factoryId: row.factory_id ?? undefined,
    routeId: row.route_id ?? undefined,
    factoryName: factory?.name as string | undefined,
    routeName: route?.route_name as string | undefined,
    status: (row.status ?? "approved") as EstateStatus,
    submittedAt: row.submitted_at ?? row.created_at ?? new Date().toISOString(),
    approvedAt: row.approved_at ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    editCount: Number(row.edit_count ?? 0),
    lastEditedAt: row.last_edited_at ?? undefined,
    createdByAdmin: Boolean(row.created_by_admin),
    notes: row.notes ?? undefined,
    blocks: blocks.map((b: Record<string, any>): EstateBlock => ({
      id: String(b.id),
      estateId: String(b.estate_id),
      name: String(b.name),
      areaHa: Number(b.area_ha ?? 0),
      bushCount: Number(b.bush_count ?? 0),
      cultivar: b.cultivar ?? undefined,
      soilType: b.soil_type ?? undefined,
      status: (b.status ?? "plucking") as EstateBlock["status"],
      plantingYear: numberOrUndefined(b.planting_year),
    })),
  };
}

function readDemoEstates(): Estate[] {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) ?? "[]") as Estate[];
  } catch {
    return [];
  }
}

function writeDemoEstates(rows: Estate[]): void {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(rows)); } catch { /* demo only */ }
}

const ESTATE_SELECT = `
  id, owner_supplier_id, supplier_id, name, size_category, total_area_ha,
  total_area_acres, total_bush_count, cultivar, region, soil_type, latitude,
  longitude, address, contact_phone, photo_urls, factory_id, route_id, status,
  submitted_at, approved_at, approved_by, rejection_reason, edit_count,
  last_edited_at, created_by_admin, notes, created_at,
  owner:users!estates_owner_supplier_fk(id, supplier_no, name, phone, email, status),
  factory:factories!estates_factory_fk(name), route:routes!estates_route_fk(route_name),
  estate_blocks(id, estate_id, name, area_ha, bush_count, cultivar, soil_type, status, planting_year)
`;

export function sizeFromAcreage(acreage: number): EstateSizeCategory {
  if (acreage < 5) return "small";
  if (acreage <= 50) return "medium";
  return "large";
}

/** Admin read: all estates, with optional workflow/ownership filters. */
export async function readEstates(filters: {
  status?: EstateStatus;
  sizeCategory?: EstateSizeCategory;
  factoryId?: string;
  routeId?: string;
  ownerSupplierId?: string;
} = {}): Promise<Estate[]> {
  if (!supabaseConfigured) {
    return readDemoEstates().filter((e) =>
      (!filters.status || e.status === filters.status) &&
      (!filters.sizeCategory || e.sizeCategory === filters.sizeCategory) &&
      (!filters.factoryId || e.factoryId === filters.factoryId) &&
      (!filters.routeId || e.routeId === filters.routeId) &&
      (!filters.ownerSupplierId || e.ownerSupplierId === filters.ownerSupplierId)
    );
  }
  let query = getSupabase()!.from("estates").select(ESTATE_SELECT).order("submitted_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.sizeCategory) query = query.eq("size_category", filters.sizeCategory);
  if (filters.factoryId) query = query.eq("factory_id", filters.factoryId);
  if (filters.routeId) query = query.eq("route_id", filters.routeId);
  if (filters.ownerSupplierId) query = query.eq("owner_supplier_id", filters.ownerSupplierId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load estates: ${error.message}. Run the Round 11 SQL migration first.`);
  return (data ?? []).map((row) => mapEstate(row as Record<string, any>));
}

/** Supplier read: explicitly owner-filtered in addition to database policy. */
export async function readMyEstates(supplierId: string): Promise<Estate[]> {
  return readEstates({ ownerSupplierId: supplierId });
}

export async function readEstate(estateId: string): Promise<Estate | null> {
  if (!supabaseConfigured) return readDemoEstates().find((e) => e.id === estateId) ?? null;
  const { data, error } = await getSupabase()!.from("estates").select(ESTATE_SELECT).eq("id", estateId).maybeSingle();
  if (error) throw new Error(`Could not load estate: ${error.message}`);
  return data ? mapEstate(data as Record<string, any>) : null;
}

/** Create an admin-approved or supplier-pending estate in the same table. */
export async function createEstate(input: CreateEstateInput): Promise<{ success: boolean; estateId?: string; error?: string }> {
  const now = new Date().toISOString();
  const status: EstateStatus = input.createdByAdmin ? "approved" : "pending";
  const ownerId = input.ownerSupplierId || null;
  if (!supabaseConfigured) {
    const estateId = crypto.randomUUID();
    const estate: Estate = {
      id: estateId,
      ownerSupplierId: ownerId,
      name: input.name.trim(),
      sizeCategory: input.sizeCategory,
      acreage: input.acreage,
      bushCount: input.bushCount,
      cultivar: input.cultivar,
      region: input.region,
      soilType: input.soilType,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address,
      contactPhone: input.contactPhone,
      photoUrls: input.photoUrls ?? [],
      factoryId: input.factoryId,
      routeId: input.routeId,
      status,
      submittedAt: now,
      approvedAt: input.createdByAdmin ? now : undefined,
      approvedBy: input.createdByAdmin ? input.actorId : undefined,
      editCount: 0,
      createdByAdmin: input.createdByAdmin,
      notes: input.notes,
      blocks: (input.blocks ?? []).map((b) => ({ ...b, id: crypto.randomUUID(), estateId, status: b.status ?? "plucking" })),
    };
    writeDemoEstates([estate, ...readDemoEstates()]);
    return { success: true, estateId };
  }

  const sb = getSupabase()!;
  const row = {
    owner_supplier_id: ownerId,
    supplier_id: ownerId,
    name: input.name.trim(),
    size_category: input.sizeCategory,
    total_area_ha: +(input.acreage / 2.471).toFixed(4),
    total_area_acres: input.acreage,
    total_bush_count: input.bushCount,
    cultivar: input.cultivar || null,
    region: input.region || "—",
    elevation_m: 0,
    soil_type: input.soilType || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    address: input.address || null,
    contact_phone: input.contactPhone || null,
    photo_urls: input.photoUrls?.length ? input.photoUrls : null,
    factory_id: input.factoryId || null,
    route_id: input.routeId || null,
    status,
    submitted_at: now,
    approved_at: input.createdByAdmin ? now : null,
    approved_by: input.createdByAdmin ? input.actorId || null : null,
    created_by_admin: input.createdByAdmin,
    notes: input.notes || null,
  };

  const { data, error } = await sb.from("estates").insert(row).select("id").single();
  if (error || !data) return { success: false, error: error?.message ?? "Estate was not created." };
  const estateId = String(data.id);

  if (input.blocks?.length) {
    const { error: blockError } = await sb.from("estate_blocks").insert(input.blocks.map((b) => ({
      estate_id: estateId,
      name: b.name.trim(),
      area_ha: b.areaHa,
      bush_count: b.bushCount,
      cultivar: b.cultivar || input.cultivar || null,
      soil_type: b.soilType || input.soilType || null,
      status: b.status ?? "plucking",
      planting_year: b.plantingYear ?? null,
    })));
    if (blockError) {
      await sb.from("estates").delete().eq("id", estateId);
      return { success: false, error: `Estate blocks could not be saved: ${blockError.message}` };
    }
  }

  if (input.createdByAdmin && input.actorId) {
    await sb.from("admin_audit_log").insert({
      admin_id: input.actorId,
      action: "create",
      entity_type: "estate",
      entity_id: estateId,
      details: { supplier_id: ownerId, name: input.name, created_by_admin: true },
    });
  }
  if (input.createdByAdmin && ownerId) {
    const { data: supplier } = await sb.from("users").select("associated_entity_id").eq("id", ownerId).maybeSingle();
    if (supplier && !supplier.associated_entity_id) {
      await sb.from("users").update({ associated_entity_id: estateId }).eq("id", ownerId);
    }
  }
  return { success: true, estateId };
}

export async function updateEstate(estateId: string, patch: Partial<Estate>, actorId?: string): Promise<boolean> {
  if (!supabaseConfigured) {
    const rows = readDemoEstates();
    writeDemoEstates(rows.map((e) => e.id === estateId ? { ...e, ...patch } : e));
    return rows.some((e) => e.id === estateId);
  }
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.sizeCategory !== undefined) row.size_category = patch.sizeCategory;
  if (patch.acreage !== undefined) { row.total_area_acres = patch.acreage; row.total_area_ha = +(patch.acreage / 2.471).toFixed(4); }
  if (patch.bushCount !== undefined) row.total_bush_count = patch.bushCount;
  if (patch.cultivar !== undefined) row.cultivar = patch.cultivar || null;
  if (patch.region !== undefined) row.region = patch.region || "—";
  if (patch.soilType !== undefined) row.soil_type = patch.soilType || null;
  if (patch.latitude !== undefined) row.latitude = patch.latitude ?? null;
  if (patch.longitude !== undefined) row.longitude = patch.longitude ?? null;
  if (patch.address !== undefined) row.address = patch.address || null;
  if (patch.contactPhone !== undefined) row.contact_phone = patch.contactPhone || null;
  if (patch.photoUrls !== undefined) row.photo_urls = patch.photoUrls;
  if (patch.factoryId !== undefined) row.factory_id = patch.factoryId || null;
  if (patch.routeId !== undefined) row.route_id = patch.routeId || null;
  if (patch.notes !== undefined) row.notes = patch.notes || null;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.rejectionReason !== undefined) row.rejection_reason = patch.rejectionReason || null;
  if (patch.editCount !== undefined) row.edit_count = patch.editCount;
  row.last_edited_at = new Date().toISOString();
  const { error } = await getSupabase()!.from("estates").update(row).eq("id", estateId);
  if (error) throw new Error(`Could not update estate: ${error.message}`);
  if (actorId) {
    await getSupabase()!.from("admin_audit_log").insert({ admin_id: actorId, action: "edit", entity_type: "estate", entity_id: estateId, details: row });
  }
  return true;
}

export async function replaceEstateBlocks(
  estateId: string,
  blocks: CreateEstateInput["blocks"],
): Promise<void> {
  if (!supabaseConfigured) {
    const rows = readDemoEstates();
    writeDemoEstates(rows.map((estate) => estate.id === estateId ? {
      ...estate,
      blocks: (blocks ?? []).map((block) => ({
        ...block,
        id: crypto.randomUUID(),
        estateId,
        status: block.status ?? "plucking",
      })),
    } : estate));
    return;
  }
  const sb = getSupabase()!;
  const { error: deleteError } = await sb.from("estate_blocks").delete().eq("estate_id", estateId);
  if (deleteError) throw new Error(`Could not update blocks: ${deleteError.message}`);
  if (!blocks?.length) return;
  const { error } = await sb.from("estate_blocks").insert(blocks.map((block) => ({
    estate_id: estateId,
    name: block.name.trim(),
    area_ha: block.areaHa,
    bush_count: block.bushCount,
    cultivar: block.cultivar || null,
    soil_type: block.soilType || null,
    status: block.status ?? "plucking",
    planting_year: block.plantingYear ?? null,
  })));
  if (error) throw new Error(`Could not save blocks: ${error.message}`);
}

export async function approveEstate(estateId: string, adminId: string, notes?: string): Promise<boolean> {
  if (!supabaseConfigured) return updateEstate(estateId, { status: "approved", approvedAt: new Date().toISOString(), approvedBy: adminId });
  const { error } = await getSupabase()!.rpc("approve_estate_transaction", { p_estate_id: estateId, p_admin_id: adminId, p_admin_notes: notes ?? null });
  if (error) throw new Error(`Could not approve estate: ${error.message}`);
  return true;
}

export async function rejectEstate(estateId: string, adminId: string, reason: string): Promise<boolean> {
  if (!supabaseConfigured) return updateEstate(estateId, { status: "rejected", rejectionReason: reason, approvedBy: adminId });
  const { error } = await getSupabase()!.rpc("reject_estate_transaction", { p_estate_id: estateId, p_admin_id: adminId, p_reason: reason });
  if (error) throw new Error(`Could not reject estate: ${error.message}`);
  return true;
}

export async function deleteEstate(estateId: string): Promise<boolean> {
  if (!supabaseConfigured) {
    const before = readDemoEstates();
    writeDemoEstates(before.filter((e) => e.id !== estateId));
    return before.some((e) => e.id === estateId);
  }
  const { error } = await getSupabase()!.from("estates").delete().eq("id", estateId);
  if (error) throw new Error(`Could not delete estate: ${error.message}`);
  return true;
}

/** Supplier-number/name/phone autocomplete for Estate Master. */
export async function searchSupplierByNo(query: string): Promise<SupplierSearchResult[]> {
  if (!supabaseConfigured) return [];
  const term = query.trim().replace(/[,%()]/g, "");
  if (!term) return [];
  const { data, error } = await getSupabase()!
    .from("users")
    .select("id,supplier_no,name,phone,email,factory_id,route_id,status,factories!users_factory_id_fkey(name),routes!users_route_id_fkey(route_name)")
    .eq("role", "supplier")
    .is("deactivated_at", null)
    .or(`supplier_no.ilike.%${term}%,name.ilike.%${term}%,phone.ilike.%${term}%`)
    .order("name")
    .limit(12);
  if (error) throw new Error(`Could not search suppliers: ${error.message}`);
  return (data ?? []).map((row: Record<string, any>) => ({
    id: String(row.id),
    supplierNo: row.supplier_no ?? null,
    name: row.name ?? "Supplier",
    phone: row.phone ?? null,
    email: row.email ?? null,
    factoryId: row.factory_id ?? undefined,
    routeId: row.route_id ?? undefined,
    factoryName: nestedObject(row.factories)?.name as string | undefined,
    routeName: nestedObject(row.routes)?.route_name as string | undefined,
    status: row.status ?? "active",
  }));
}

export async function readAuditLog(filters: { adminId?: string; action?: string; entityType?: string; entityId?: string; limit?: number } = {}): Promise<AuditLogEntry[]> {
  if (!supabaseConfigured) return [];
  let query = getSupabase()!.from("admin_audit_log").select("id,admin_id,action,entity_type,entity_id,details,created_at").order("created_at", { ascending: false }).limit(filters.limit ?? 100);
  if (filters.adminId) query = query.eq("admin_id", filters.adminId);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.entityId) query = query.eq("entity_id", filters.entityId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load audit log: ${error.message}`);
  return (data ?? []).map((row: Record<string, any>) => ({
    id: row.id,
    adminId: row.admin_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    details: row.details ?? {},
    createdAt: row.created_at,
  }));
}

export async function setUserDeactivated(targetUid: string, deactivated: boolean, adminId: string): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase()!;
  const { error } = await sb.from("users").update({ deactivated_at: deactivated ? new Date().toISOString() : null, status: deactivated ? "suspended" : "active" }).eq("id", targetUid);
  if (error) throw new Error(`Could not ${deactivated ? "deactivate" : "reactivate"} user: ${error.message}`);
  await sb.from("admin_audit_log").insert({ admin_id: adminId, action: deactivated ? "deactivate" : "reactivate", entity_type: "user", entity_id: targetUid, details: {} });
}

export async function isUserDeactivated(targetUid: string): Promise<boolean> {
  if (!supabaseConfigured) return false;
  const { data, error } = await getSupabase()!.from("users").select("deactivated_at").eq("id", targetUid).maybeSingle();
  // Frontend may deploy before the administrator runs the Round 11 migration.
  if (error?.message?.includes("deactivated_at")) return false;
  if (error) throw new Error(`Could not validate account status: ${error.message}`);
  return Boolean(data?.deactivated_at);
}

export async function countPendingEstates(): Promise<number> {
  if (!supabaseConfigured) return readDemoEstates().filter((e) => e.status === "pending").length;
  const { count, error } = await getSupabase()!.from("estates").select("id", { count: "exact", head: true }).eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}
