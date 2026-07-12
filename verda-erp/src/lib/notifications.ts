/**
 * Verda · Notifications Engine
 * ------------------------------------------------------------------
 * 1. createAlert() → INSERT into Supabase `alerts` table (real-time feed).
 * 2. dispatchFcm() → sends actual Firebase Cloud Messaging push to device.
 *
 * Together: when an event happens (payment, weighing, advisory), we write
 * an alert row AND fire an FCM push. The admin bell + supplier portal read
 * the alerts table via real-time subscriptions.
 */
import { getSupabase, supabaseConfigured } from "./supabase";

export type AlertType =
  | "payment"
  | "delivery"
  | "fertilizer"
  | "plucking"
  | "weather"
  | "resource"
  | "general";

export interface AlertInput {
  targetUserId: string;
  title: string;
  body: string;
  type?: AlertType;
}

/**
 * Insert an alert into the Supabase `alerts` table.
 * This triggers real-time updates on any subscribed screen (admin bell, supplier portal).
 */
export async function createAlert(input: AlertInput): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase()!;
  const { error } = await sb.from("alerts").insert({
    target_user_id: input.targetUserId,
    title: input.title,
    body: input.body,
    alert_type: input.type ?? "general",
    read: false,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[alerts] Insert failed:", error.message);
  }
}

/**
 * Read alerts for a user (most recent first).
 */
export async function readAlerts(userId: string, limit = 20): Promise<AlertRow[]> {
  if (!supabaseConfigured) return [];
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("alerts")
    .select("id, target_user_id, title, body, alert_type, read, created_at")
    .eq("target_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as AlertRow[];
}

/**
 * Mark all alerts as read for a user.
 */
export async function markAlertsRead(userId: string): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase()!;
  await sb.from("alerts").update({ read: true }).eq("target_user_id", userId).eq("read", false);
}

export interface AlertRow {
  id: string;
  target_user_id: string;
  title: string;
  body: string;
  alert_type: string;
  read: boolean;
  created_at: string;
}

// ---- ALERT TYPE ICONS (for UI) ----
export const ALERT_ICONS: Record<string, string> = {
  payment: "Wallet",
  delivery: "Package",
  fertilizer: "Droplets",
  plucking: "Leaf",
  weather: "CloudSun",
  resource: "Inbox",
  general: "Bell",
};
