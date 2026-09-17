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
