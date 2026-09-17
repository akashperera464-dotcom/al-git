/**
 * Native FCM Notifications Bridge — Expo push + FCM tokens
 * ------------------------------------------------------------------
 * Uses expo-notifications to:
 *   1. Request permission
 *   2. Get the native push token (Expo Push Token on iOS, FCM on Android)
 *   3. Listen for incoming notifications (foreground + background)
 *   4. Post notifications into the WebView bridge (so the PWA UI can react)
 *
 * Install:
 *   npx expo install expo-notifications
 *
 * In app.config.js plugins:
 *   To use FCM directly (not Expo's servers), follow EAS Build with:
 *     "googleServicesFile": "./google-services.json",
 *     "plugins": ["expo-notifications"]
 */
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import type { WebView } from "react-native-webview";

// Configure how notifications appear while app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

export interface PushTokenResult {
  token: string | null;
  source: "expo" | "fcm" | "apns" | "none";
}

/**
 * Register for push notifications and return the device token.
 * Returns { token: null } on emulators / denied permissions.
 *
 * In production with EAS Build + google-services.json, this returns the FCM
 * token directly on Android. iOS uses APNs via Expo's proxy.
 */
export async function registerForPushNotifications(): Promise<PushTokenResult> {
  if (!Device.isDevice) {
    return { token: null, source: "none" };
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return { token: null, source: "none" };
  }

  const tokenData = await Notifications.getDevicePushTokenAsync();
  return {
    token: tokenData.data,
    source: Platform.OS === "android" ? "fcm" : "apns",
  };
}

/**
 * Hook up notification listeners. Forwards every notification + the FCM token
 * into the WebView via postMessage so the PWA UI can react.
 *
 * Returns a cleanup function.
 */
export function attachNotificationListeners(webViewRef: React.RefObject<WebView>): () => void {
  const postToWebView = (type: string, payload: unknown) => {
    const msg = JSON.stringify({ source: "verda-native", type, payload });
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(msg)} })); true;`
    );
  };

  // 1) Token refresh
  const tokenSub = Notifications.addPushTokenListener(({ data }) => {
    postToWebView("pushTokenRefresh", { token: data });
  });

  // 2) Notification received while app is OPEN (foreground)
  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    postToWebView("notificationReceived", {
      id: notification.request.identifier,
      title: notification.request.content.title,
      body: notification.request.content.body,
      data: notification.request.content.data,
    });
  });

  // 3) User tapped a notification (app was backgrounded or closed)
  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    postToWebView("notificationTapped", {
      id: response.notification.request.identifier,
      title: response.notification.request.content.title,
      body: response.notification.request.content.body,
      data: response.notification.request.content.data,
      actionIdentifier: response.actionIdentifier,
    });
  });

  return () => {
    tokenSub.remove();
    receivedSub.remove();
    responseSub.remove();
  };
}

/**
 * Schedule a local notification (used by background sync tasks for
 * "synced N items" confirmations).
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<string> {
  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: "default" },
    trigger: null, // immediate
  });
  return id;
}

/**
 * Set the badge count (iOS) / notification count (Android).
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}
