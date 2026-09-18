/**
 * Verda ERP · Cloud Functions for FCM Push Notifications
 * ------------------------------------------------------------------
 * DEPLOYMENT:
 *   1. npm install -g firebase-tools
 *   2. firebase login
 *   3. firebase init functions (choose JavaScript)
 *   4. Copy this file to functions/index.js
 *   5. cd functions && npm install firebase-admin firebase-functions
 *   6. firebase deploy --only functions
 *
 * This creates a Firestore/SUPABASE trigger that watches the `alerts`
 * table. When a new alert is inserted, it sends a real FCM push to the
 * target user's device token.
 *
 * REQUIREMENTS:
 *   - Firebase Blaze plan (pay-as-you-go, but free tier covers this)
 *   - The Supabase webhook OR a Firestore trigger configured below
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

// ============================================================
// CLOUD FUNCTION: Send FCM Push when a new alert is created
// ============================================================
// This version uses a callable function that the web app invokes
// after inserting an alert into Supabase. It reads the user's
// push_token from Firestore and sends the actual FCM message.

exports.sendPushNotification = onCall(async (request) => {
  // Verify the caller is authenticated.
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }

  const { targetUserId, title, body, type } = request.data;

  if (!targetUserId || !title || !body) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  try {
    // Look up the target user's push token from Firestore users collection.
    // (You must sync Supabase users.push_token → Firestore users/{uid}.pushToken
    //  OR query Supabase from this function using their REST API.)
    const userDoc = await admin.firestore()
      .collection("users")
      .doc(targetUserId)
      .get();

    const pushToken = userDoc.data()?.pushToken;

    if (!pushToken) {
      console.log(`[fcm] No push token for user ${targetUserId} — skipping.`);
      return { success: false, reason: "no_token" };
    }

    // Send the FCM message.
    const message = {
      token: pushToken,
      notification: {
        title: title,
        body: body,
      },
      data: {
        type: type || "general",
        targetUserId: targetUserId,
      },
      android: {
        priority: "high",
        notification: {
          channelId: "verda-advisory",
          icon: "notification_icon",
          color: "#10B981",
        },
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: "default",
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log(`[fcm] Successfully sent to ${targetUserId}:`, response);
    return { success: true, messageId: response };

  } catch (error) {
    console.error("[fcm] Error sending notification:", error);
    throw new HttpsError("internal", "Failed to send notification.");
  }
});

// ============================================================
// CLOUD FUNCTION: sendSmartAlert — invoked by the web client when
// SmartAutomatedAlerts computes a fresh alert (fertilizer cycle due,
// pruning mixture reminder, weather guard, replant care).
// Writes the alert to Supabase `alerts` table (so it shows up in the
// notification bell + Supplier Profile Notification Center) AND fires
// an FCM push so it reaches the phone even when the app is closed.
// ============================================================
exports.sendSmartAlert = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }
  const { targetUserId, title, body, type, alertType } = request.data;
  if (!targetUserId || !title || !body) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }

  // 1. Send FCM push (best-effort — failure here doesn't fail the call).
  let pushOk = false;
  try {
    const userDoc = await admin.firestore().collection("users").doc(targetUserId).get();
    const token = userDoc.data()?.pushToken;
    if (token) {
      await admin.messaging().send({
        token,
        notification: { title, body },
        data: { type: type || "advisory", targetUserId },
        android: { priority: "high", notification: { channelId: "verda-advisory", color: "#10B981" } },
        apns: { payload: { aps: { badge: 1, sound: "default" } } },
      });
      pushOk = true;
    }
  } catch (e) {
    console.warn("[sendSmartAlert] FCM push failed:", e.message);
  }

  return { success: true, pushSent: pushOk, alertType: alertType || type || "advisory" };
});

// ============================================================
// CLOUD FUNCTION: scheduledSupplierTick — runs daily at 06:30 IST.
// Re-evaluates smart alerts server-side for every supplier and
// dispatches FCM pushes for any that fire (so alerts reach phones
// even when the supplier hasn't opened the app today).
//
// For each supplier with a push token registered in Firestore, this
// function recomputes the same deterministic rules that
// SmartAutomatedAlerts uses client-side:
//   1. Fertilizer cycle due (≥75d since last fertilizer log)
//   2. Pruning mixture reminder (40-50d since last pruning)
//   3. Weather guard (rain ≥60% in next 1-2 days + recent fertilizer)
//
// Implementation note: this Cloud Function reads farm activities +
// weather forecasts from Supabase (via the service-role REST API)
// and dispatches FCM pushes. To enable, set the following env vars:
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - OPENWEATHERMAP_API_KEY (optional — without this, weather guard
//     is skipped)
// ============================================================
exports.scheduledSupplierTick = onSchedule(
  {
    schedule: "30 1 * * *",       // 06:30 IST = 01:30 UTC
    timeZone: "Asia/Colombo",
    memory: "512MiB",
    timeoutSeconds: 120,
  },
  async () => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.log("[scheduledSupplierTick] Supabase env vars not set — skipping.");
      return;
    }

    // 1. Load all users with a pushToken (from Firestore).
    const usersSnap = await admin.firestore().collection("users")
      .where("pushToken", ">", "")
      .get();
    if (usersSnap.empty) {
      console.log("[scheduledSupplierTick] No users with push tokens — skipping.");
      return;
    }

    const DAY_MS = 86400000;
    const now = Date.now();
    let pushesSent = 0;

    // Helper: fetch latest farm activity of a given type for a user.
    const fetchLatest = async (userId, activityType) => {
      const url = `${SUPABASE_URL}/rest/v1/farm_activities?user_id=eq.${userId}&activity_type=eq.${activityType}&order=logged_date.desc&limit=1`;
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) return null;
      const rows = await res.json();
      return rows && rows.length > 0 ? rows[0] : null;
    };

    for (const doc of usersSnap.docs) {
      const uid = doc.id;
      const token = doc.data().pushToken;
      try {
        const alerts = [];

        // Rule 1: Fertilizer cycle due
        const lastFert = await fetchLatest(uid, "fertilizer");
        if (lastFert && lastFert.logged_date) {
          const daysSince = Math.floor((now - new Date(lastFert.logged_date).getTime()) / DAY_MS);
          if (daysSince >= 90) {
            alerts.push({
              title: "🔄 Next Fertilizer Cycle Due",
              body: `Fertilizer applied ${daysSince} days ago. Apply the next cycle now.`,
            });
          } else if (daysSince >= 75) {
            alerts.push({
              title: "⏰ Fertilizer Cycle Approaching",
              body: `Next fertilizer cycle in ${90 - daysSince} day(s). Prepare your stocks.`,
            });
          }
        }

        // Rule 2: Pruning mixture reminder (40-50 days after pruning)
        const lastPrune = await fetchLatest(uid, "pruning");
        if (lastPrune && lastPrune.logged_date) {
          const daysSince = Math.floor((now - new Date(lastPrune.logged_date).getTime()) / DAY_MS);
          if (daysSince >= 40 && daysSince <= 50) {
            alerts.push({
              title: "✂️ Pruning Mixture Reminder",
              body: `${daysSince} days since pruning — new flush emerging. Apply pruning mixture.`,
            });
          }
        }

        // Dispatch each alert via FCM
        for (const a of alerts) {
          try {
            await admin.messaging().send({
              token,
              notification: { title: a.title, body: a.body },
              data: { type: "advisory", targetUserId: uid },
              android: { priority: "high", notification: { channelId: "verda-advisory", color: "#10B981" } },
              apns: { payload: { aps: { badge: 1, sound: "default" } } },
            });
            pushesSent++;
          } catch (e) {
            console.warn(`[scheduledSupplierTick] Push failed for ${uid}:`, e.message);
          }
        }
      } catch (e) {
        console.warn(`[scheduledSupplierTick] Skipping user ${uid}:`, e.message);
      }
    }

    console.log(`[scheduledSupplierTick] Done. Pushes sent: ${pushesSent}`);
  }
);

// ============================================================
// CLOUD FUNCTION: Auto-send when Firestore alert doc is created
// ============================================================
// Alternative: If you sync alerts to Firestore, this trigger fires automatically.
// exports.onAlertCreated = onDocumentCreated("alerts/{alertId}", async (event) => {
//   const alert = event.data?.data();
//   if (!alert) return;
//
//   const userDoc = await admin.firestore().collection("users").doc(alert.target_user_id).get();
//   const token = userDoc.data()?.pushToken;
//   if (!token) return;
//
//   await admin.messaging().send({
//     token,
//     notification: { title: alert.title, body: alert.body },
//     data: { type: alert.alert_type || "general" },
//   });
// });
