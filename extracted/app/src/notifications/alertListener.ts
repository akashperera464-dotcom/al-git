import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Notification handler config — call this ONCE in the root layout (App.tsx)
 * before any screen renders.
 *
 * This configures how incoming notifications behave while the app is
 * in the foreground (show alert + play sound).
 */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Start a real-time alerts listener using Supabase Realtime.
 *
 * In production with Firestore, this would be:
 *   const unsub = db.collection('alerts')
 *     .where('targetUserId', '==', userId)
 *     .onSnapshot(snapshot => { ... })
 *
 * With Supabase, we use the postgres_changes subscription to listen
 * for new INSERTs on an `alerts` table. When a new alert doc appears,
 * we immediately fire a local notification.
 *
 * Call this in the root layout after auth resolves.
 * Returns an unsubscribe function.
 */
export function startAlertListener(userId: string): () => void {
  if (Platform.OS === "web" || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return () => {};
  }

  let closed = false;

  // Use Supabase Realtime via WebSocket to listen for new alerts.
  // We create a channel that watches for INSERT events on the alerts table.
  const channelName = `alerts-${userId}-${Date.now()}`;
  const wsUrl = `${SUPABASE_URL.replace("https", "wss")}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;

  let ws: WebSocket | null = null;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (closed) return;
      // Join the Realtime channel.
      ws?.send(
        JSON.stringify({
          topic: `realtime:${channelName}`,
          event: "phx_join",
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              presence: { key: "" },
              postgres_changes: [
                {
                  event: "INSERT",
                  schema: "public",
                  table: "alerts",
                  filter: `target_user_id=eq.${userId}`,
                },
              ],
            },
          },
          ref: "1",
        })
      );
    };

    ws.onmessage = (event) => {
      if (closed) return;
      try {
        const msg = JSON.parse(event.data);
        // Check if this is a postgres_changes event with new row data.
        if (msg?.payload?.data?.record) {
          const record = msg.payload.data.record;
          fireLocalNotification({
            title: record.title ?? "New Alert",
            body: record.body ?? record.message ?? "You have a new update.",
            data: record,
          });
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = (e) => {
      console.warn("[alert-listener] WebSocket error:", e);
    };

    ws.onclose = () => {
      if (!closed) console.info("[alert-listener] Connection closed.");
    };
  } catch (e) {
    console.error("[alert-listener] Failed to start:", e);
  }

  // Return cleanup function.
  return () => {
    closed = true;
    if (ws) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  };
}

/** Fire a local notification immediately. */
async function fireLocalNotification(opts: { title: string; body: string; data?: Record<string, unknown> }) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.title,
        body: opts.body,
        data: opts.data ?? {},
        sound: true,
      },
      trigger: null, // immediate
    });
  } catch (e) {
    console.error("[alert-listener] Notification failed:", e);
  }
}
