import { getSupabase } from "./supabase";
import type { FarmActivity } from "./data";

export interface SupplierLedgerEntry {
  id: string; supplierName: string; stockItemCode: string; stockItemName: string;
  qtyIssued: number; unit: string; date: string; notes?: string;
  paymentMode: string; settled: boolean; unitPrice: number | null;
}

export async function readSupplierLedger(uid: string): Promise<SupplierLedgerEntry[]> {
  const sb = getSupabase();
  if (!sb || !uid) return [];
  const { data, error } = await sb.from("supplier_fertilizer_ledger")
    .select("*").eq("supplier_id", uid).order("issue_date", { ascending: false });
  if (error) throw new Error(`Could not load fertilizer ledger: ${error.message}`);
  return (data ?? []).map(row => ({
    id: row.id, supplierName: row.supplier_name, stockItemCode: row.stock_item_code,
    stockItemName: row.stock_item_name, qtyIssued: Number(row.qty_issued ?? 0),
    unit: row.unit, date: row.issue_date, notes: row.notes,
    paymentMode: row.payment_mode, settled: Boolean(row.settled),
    unitPrice: row.unit_price == null ? null : Number(row.unit_price),
  }));
}

/** Paginate instead of silently limiting lifetime fertilizer consumption to 30 logs. */
export async function readSupplierActivities(uid: string): Promise<FarmActivity[]> {
  const sb = getSupabase();
  if (!sb || !uid) return [];
  const result: FarmActivity[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await sb.from("farm_activities").select("*")
      .eq("user_id", uid).order("logged_date", { ascending: false }).order("id")
      .range(offset, offset + 499);
    if (error) throw new Error(`Could not load farm activities: ${error.message}`);
    result.push(...(data ?? []).map(row => ({ id: row.id, userId: row.user_id,
      activityType: row.activity_type, loggedDate: row.logged_date,
      details: row.details ?? {}, createdAt: row.created_at })));
    if (!data || data.length < 500) return result;
  }
}

export interface SupplierPlotSummary {
  acreage: number; region?: string; plotName?: string;
  latitude?: number; longitude?: number; fromPending?: boolean;
}
const coordinate = (value: unknown): number | undefined =>
  value == null || value === "" || !Number.isFinite(Number(value)) ? undefined : Number(value);

export async function readSupplierPlot(uid: string): Promise<SupplierPlotSummary[]> {
  const sb = getSupabase();
  if (!sb || !uid) return [];
  const { data: fields, error } = await sb.from("fields")
    .select("id,name,area_ha,latitude,longitude,divisions(estates(region))")
    .eq("supplier_id", uid).order("id");
  if (error) throw new Error(`Could not load your fields: ${error.message}`);
  if (fields?.length) {
    const located = fields.find(row => coordinate(row.latitude) !== undefined && coordinate(row.longitude) !== undefined);
    const first = fields[0];
    const division = first.divisions as unknown as { estates?: { region?: string } } | null;
    return [{ acreage: fields.reduce((sum, row) => sum + Number(row.area_ha || 0) * 2.471, 0),
      region: division?.estates?.region, plotName: located?.name ?? first.name,
      latitude: coordinate(located?.latitude), longitude: coordinate(located?.longitude) }];
  }
  // Existing registrations may predate the field ownership backfill. Keep this
  // fallback in the database; never read another device's localStorage cache.
  const { data: requests, error: requestError } = await sb.from("estate_registration_requests")
    .select("plot_name,acreage,region,latitude,longitude,status")
    .eq("supplier_id", uid).in("status", ["APPROVED", "PENDING"])
    .order("submitted_at", { ascending: false });
  if (requestError) throw new Error(`Could not load registration: ${requestError.message}`);
  const row = requests?.find(r => r.status === "APPROVED") ?? requests?.[0];
  return row ? [{ acreage: Number(row.acreage), region: row.region, plotName: row.plot_name,
    latitude: coordinate(row.latitude), longitude: coordinate(row.longitude), fromPending: row.status === "PENDING" }] : [];
}

export interface SupplierProfileData {
  name: string; phone: string; nic: string; address: string;
  emergencyContact: string; photoUrl: string;
  notificationPrefs: { paymentAlerts: boolean; requestAlerts: boolean; announcementAlerts: boolean;
    weatherAlerts: boolean; advisoryAlerts: boolean };
}

export async function readSupplierProfile(uid: string): Promise<Partial<SupplierProfileData> | null> {
  const sb = getSupabase();
  if (!sb) throw new Error("Database is not configured.");
  const { data, error } = await sb.from("supplier_profiles").select("*").eq("user_id", uid).maybeSingle();
  if (error) throw new Error(`Could not load profile: ${error.message}`);
  return data ? { name: data.name, phone: data.phone, nic: data.nic, address: data.address,
    emergencyContact: data.emergency_contact, photoUrl: data.photo_url,
    notificationPrefs: data.notification_prefs } : null;
}

export async function saveSupplierProfile(uid: string, profile: SupplierProfileData): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Database is not configured.");
  const { error } = await sb.from("supplier_profiles").upsert({ user_id: uid,
    name: profile.name, phone: profile.phone, nic: profile.nic, address: profile.address,
    emergency_contact: profile.emergencyContact, photo_url: profile.photoUrl,
    notification_prefs: profile.notificationPrefs, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(`Could not save profile: ${error.message}`);
}
