/// <reference types="vite/client" />
/**
 * Verda · FCM Dispatch (calls Cloud Function for real push)
 * ------------------------------------------------------------------
 * Previously this was a fake 120ms delay. Now it calls the Cloud Function
 * `sendPushNotification` which sends a REAL FCM push to the device.
 *
 * If Cloud Functions aren't deployed yet, it falls back to the alert table
 * (which still shows in the notification bell + supplier portal in real-time).
 */
import { getFunctions, httpsCallable } from "firebase/functions";
import { initFirebase, firebaseConfigured } from "./firebase";

export interface FcmPayload {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendFcmToSupplier(payload: FcmPayload): Promise<{ ok: boolean; reason?: string }> {
  if (!firebaseConfigured) {
    // Demo mode — the alert table insert (in notifications.ts) still works.
    return { ok: false, reason: "demo_mode" };
  }

  try {
    const { app } = initFirebase();
    if (!app) return { ok: false, reason: "no_app" };
    const functions = getFunctions(app);
    const sendPush = httpsCallable(functions, "sendPushNotification");

    // Extract targetUserId from the token (format: "fcm:{uid}") or from data.
    const targetUserId = payload.data?.targetUserId ?? payload.token.replace("fcm:", "");

    const result = await sendPush({
      targetUserId,
      title: payload.title,
      body: payload.body,
      type: payload.data?.type ?? "general",
    });

    const data = result.data as { success?: boolean };
    return { ok: Boolean(data?.success) };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[fcm] Cloud Function call failed — alert table still updated:", e);
    return { ok: false, reason: "cloud_function_not_deployed" };
  }
}

/**
 * B10 FIX: Send a "smart" advisory alert (fertilizer cycle due, pruning
 * mixture reminder, weather guard, replant care) via the dedicated
 * `sendSmartAlert` Cloud Function. This routes through a separate channel
 * so advisory pushes can be visually distinguished + their delivery tracked.
 *
 * The Cloud Function fires the actual FCM push AND writes to the alerts
 * table (so it shows up in the notification bell + Notification Center).
 *
 * In demo mode (no Firebase) this is a no-op — the caller should also
 * invoke `createAlert()` from notifications.ts to persist locally.
 */
export async function sendSmartAlert(input: {
  targetUserId: string;
  title: string;
  body: string;
  type?: string;
  alertType?: "fertilizer" | "plucking" | "weather" | "general";
}): Promise<{ ok: boolean; pushSent?: boolean; reason?: string }> {
  if (!firebaseConfigured) {
    return { ok: false, reason: "demo_mode" };
  }
  try {
    const { app } = initFirebase();
    if (!app) return { ok: false, reason: "no_app" };
    const functions = getFunctions(app);
    const send = httpsCallable(functions, "sendSmartAlert");
    const result = await send({
      targetUserId: input.targetUserId,
      title: input.title,
      body: input.body,
      type: input.type ?? "advisory",
      alertType: input.alertType ?? "general",
    });
    const data = result.data as { success?: boolean; pushSent?: boolean };
    return { ok: Boolean(data?.success), pushSent: data?.pushSent };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[fcm] sendSmartAlert call failed:", e);
    return { ok: false, reason: "cloud_function_not_deployed" };
  }
}
