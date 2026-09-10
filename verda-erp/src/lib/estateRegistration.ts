/**
 * Estate Registration Requests — shared types + storage helpers
 * ------------------------------------------------------------------
 * When a supplier registers their estate/plot, the request is stored
 * here (Phase 1: localStorage). Admin reviews in Supplier Insights
 * module and approves/rejects.
 *
 * On approval, the data is promoted to the supplier's "My Plot" cache
 * (kdu.supplier_plot.{userUid}) and the registration request status
 * changes to APPROVED.
 *
 * On rejection, supplier sees the rejection reason and can edit +
 * resubmit (creates a new request with status PENDING).
 */

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
    subFields: [],
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
