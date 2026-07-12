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
