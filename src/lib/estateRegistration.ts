/**
 * Estate Registration Requests — shared types + storage helpers
 * ------------------------------------------------------------------
 * B31 (Round #13) — UNIFIED: now writes to BOTH localStorage (backwards compat)
 * AND Supabase `estate_registration_requests` table (real-time sync).
 *
 * When admin approves:
 *   1. Status → APPROVED in both localStorage + Supabase
 *   2. Real estate/division/field records created in Supabase (via repo functions)
 *   3. Supplier's My Plot cache updated (localStorage)
 *
 * Admin can approve from EITHER Estate Master OR Supplier Insights — both
 * read from the same data source.
 */

import { getSupabase, supabaseConfigured } from "./supabase";

export type RegistrationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface EstateRegistrationRequest {
  id: string;
  // Supplier identity
  supplierId: string;     // Firebase UID
  supplierName: string;   // Display name

  // Plot / Estate details — 100% SAME structure as admin's Estate + Field models
  plotName: string;            // වත්තේ නම (Land Name)
  acreage: number;             // අක්කර ගණන (Acreage)
  bushCount: number;          // තේ ගස් ගණන (Bush Count)
  cultivar: string;            // තේ ප්‍රභේදය (TRI Clones)
  region: "low-country" | "mid-country" | "up-country";

  // Crop Info — soil type (NEW per spec)
  soilType?: "sandy" | "loam" | "clay" | "sandy-loam" | "clay-loam" | "unknown";

  // Location
  latitude: number;
  longitude: number;
  address: string;
  contactPhone: string;

  // Divisions / Blocks (NEW per spec — වත්තේ කොටස් / කොට්ඨාස)
  // Supplier can divide their plot into blocks (e.g., උඩ කොටස, පහළ කොටස)
  blocks?: EstateBlock[];

  // Photos (URLs — Phase 1: text input; Phase 2: file upload to Supabase Storage)
  photoUrls: string[];

  // Optional land document
  landDocumentUrl?: string;

  // Notes from supplier
  notes: string;

  // Workflow
  status: RegistrationStatus;
  adminNotes: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;

  // Edit tracking
  editCount: number;
  lastEditedAt: string | null;
}

/** Estate Block / Division — same structure whether created by supplier or admin */
export interface EstateBlock {
  id: string;
  name: string;           // e.g., "උඩ කොටස" (Upper Block), "පහළ කොටස" (Lower Block)
  areaHa: number;         // area in hectares
  areaAcres?: number;     // area in acres (= ha × 2.471)
  bushCount: number;
  cultivar: string;
  soilType?: "sandy" | "loam" | "clay" | "sandy-loam" | "clay-loam" | "unknown";
}

const STORAGE_KEY = "kdu.estate_registration_requests";

/** Write a new or updated registration request to localStorage. */
export function saveRegistrationRequest(req: EstateRegistrationRequest): void {
  try {
    const all = readAllRegistrationRequests();
    const existingIdx = all.findIndex(r => r.id === req.id);
    if (existingIdx >= 0) {
      all[existingIdx] = req;
    } else {
      all.unshift(req);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 200)));
  } catch { /* ignore */ }
}

/** Read all registration requests (all suppliers). Admin uses this. */
export function readAllRegistrationRequests(): EstateRegistrationRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EstateRegistrationRequest[]) : [];
  } catch {
    return [];
  }
}

/** Read a specific supplier's registration requests (sorted by submittedAt desc). */
export function readMyRegistrationRequests(supplierId: string): EstateRegistrationRequest[] {
  return readAllRegistrationRequests()
    .filter(r => r.supplierId === supplierId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** Get the supplier's latest registration request (any status). */
export function getLatestRegistrationRequest(supplierId: string): EstateRegistrationRequest | null {
  const mine = readMyRegistrationRequests(supplierId);
  return mine.length > 0 ? mine[0] : null;
}

/** Update a registration request's status (admin approve/reject). */
export function updateRegistrationStatus(
  requestId: string,
  status: RegistrationStatus,
  adminNotes: string,
  reviewedBy: string,
): EstateRegistrationRequest | null {
  const all = readAllRegistrationRequests();
  const idx = all.findIndex(r => r.id === requestId);
  if (idx < 0) return null;
  all[idx] = {
    ...all[idx],
    status,
    adminNotes,
    reviewedAt: new Date().toISOString(),
    reviewedBy,
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 200))); } catch { /* ignore */ }
  return all[idx];
}

/** Promote approved registration data to the supplier's My Plot cache.
 *  Returns the PlotData object that was written (or null). */
export function promoteApprovedToMyPlot(req: EstateRegistrationRequest): {
  acreage: number; bushCount: number; verifiedAt: string | null;
  cultivar?: string; region?: string; lastUpdated?: string;
  plotName?: string; latitude?: number; longitude?: number;
  address?: string; contactPhone?: string; photoUrls?: string[];
  subFields?: any[];
} | null {
  if (req.status !== "APPROVED") return null;
  const plotData = {
    acreage: req.acreage,
    bushCount: req.bushCount,
    verifiedAt: req.reviewedAt ?? new Date().toISOString(),
    cultivar: req.cultivar,
    region: req.region,
    lastUpdated: new Date().toISOString(),
    plotName: req.plotName,
    latitude: req.latitude,
    longitude: req.longitude,
    address: req.address,
    contactPhone: req.contactPhone,
    photoUrls: req.photoUrls,
    subFields: (req.blocks ?? []).map(b => ({
      id: b.id,
      code: b.id.slice(0, 6).toUpperCase(),
      name: b.name,
      cultivar: b.cultivar || req.cultivar,
      plantingYear: new Date().getFullYear(),
      areaHa: b.areaHa,
      bushCount: b.bushCount,
      status: "plucking" as const,
    })),
  };
  try {
    localStorage.setItem(`kdu.supplier_plot.${req.supplierId}`, JSON.stringify(plotData));
  } catch { /* ignore */ }
  return plotData;
}

/** Check if the supplier has a pending registration request. */
export function hasPendingRegistration(supplierId: string): boolean {
  const latest = getLatestRegistrationRequest(supplierId);
  return latest?.status === "PENDING";
}

/* ============================================================================
 * B31 (Round #13) — Supabase-backed functions (unified estate registration)
 * ============================================================================
 * These functions write/read from Supabase `estate_registration_requests` table
 * AND localStorage (backwards compat). Admin can approve from Estate Master
 * or Supplier Insights — both read the same data.
 * ========================================================================== */

/** Save registration request to Supabase (AND localStorage for backwards compat). */
export async function saveRegistrationRequestSupabase(req: EstateRegistrationRequest): Promise<void> {
  // Always save to localStorage (backwards compat for demo mode)
  saveRegistrationRequest(req);

  if (!supabaseConfigured) return;
  try {
    const sb = getSupabase()!;
    await sb.from("estate_registration_requests").upsert({
      id: req.id,
      supplier_id: req.supplierId,
      supplier_name: req.supplierName,
      plot_name: req.plotName,
      acreage: req.acreage,
      bush_count: req.bushCount,
      cultivar: req.cultivar,
      region: req.region,
      soil_type: req.soilType ?? null,
      latitude: req.latitude ?? null,
      longitude: req.longitude ?? null,
      address: req.address || null,
      contact_phone: req.contactPhone || null,
      blocks: req.blocks ?? null,
      photo_urls: req.photoUrls ?? null,
      land_document_url: req.landDocumentUrl ?? null,
      notes: req.notes || null,
      status: req.status,
      admin_notes: req.adminNotes || null,
      submitted_at: req.submittedAt,
      reviewed_at: req.reviewedAt ?? null,
      reviewed_by: req.reviewedBy ?? null,
      edit_count: req.editCount,
      last_edited_at: req.lastEditedAt ?? null,
    }, { onConflict: "id" });
  } catch (e) {
    console.warn("[estateRegistration] Supabase save failed, localStorage only:", e);
  }
}

/** Read all registration requests from Supabase (falls back to localStorage). */
export async function readAllRegistrationRequestsSupabase(): Promise<EstateRegistrationRequest[]> {
  if (!supabaseConfigured) return readAllRegistrationRequests();
  try {
    const sb = getSupabase()!;
    const { data, error } = await sb
      .from("estate_registration_requests")
      .select("*")
      .order("submitted_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapDbToRequest);
  } catch (e) {
    console.warn("[estateRegistration] Supabase read failed, using localStorage:", e);
    return readAllRegistrationRequests();
  }
}

/** Update registration status in Supabase (AND localStorage). */
export async function updateRegistrationStatusSupabase(
  requestId: string,
  status: RegistrationStatus,
  adminNotes: string,
  reviewedBy: string,
): Promise<EstateRegistrationRequest | null> {
  // Update localStorage (backwards compat)
  const updated = updateRegistrationStatus(requestId, status, adminNotes, reviewedBy);
  if (!updated) return null;

  // Update Supabase
  if (supabaseConfigured) {
    try {
      const sb = getSupabase()!;
      await sb.from("estate_registration_requests")
        .update({
          status,
          admin_notes: adminNotes,
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewedBy,
        })
        .eq("id", requestId);
    } catch (e) {
      console.warn("[estateRegistration] Supabase update failed, localStorage only:", e);
    }
  }

  return updated;
}

/** Map a Supabase row to the EstateRegistrationRequest interface. */
function mapDbToRequest(r: Record<string, unknown>): EstateRegistrationRequest {
  return {
    id: r.id as string,
    supplierId: r.supplier_id as string,
    supplierName: r.supplier_name as string,
    plotName: r.plot_name as string,
    acreage: Number(r.acreage ?? 0),
    bushCount: Number(r.bush_count ?? 0),
    cultivar: (r.cultivar as string) ?? "",
    region: (r.region as string) ?? "low-country",
    soilType: (r.soil_type as EstateRegistrationRequest["soilType"]) ?? "unknown",
    latitude: Number(r.latitude ?? 0),
    longitude: Number(r.longitude ?? 0),
    address: (r.address as string) ?? "",
    contactPhone: (r.contact_phone as string) ?? "",
    blocks: (r.blocks as EstateBlock[]) ?? undefined,
    photoUrls: (r.photo_urls as string[]) ?? [],
    landDocumentUrl: (r.land_document_url as string) ?? undefined,
    notes: (r.notes as string) ?? "",
    status: (r.status as RegistrationStatus) ?? "PENDING",
    adminNotes: (r.admin_notes as string) ?? "",
    submittedAt: (r.submitted_at as string) ?? new Date().toISOString(),
    reviewedAt: (r.reviewed_at as string) ?? null,
    reviewedBy: (r.reviewed_by as string) ?? null,
    editCount: Number(r.edit_count ?? 0),
    lastEditedAt: (r.last_edited_at as string) ?? null,
  };
}
