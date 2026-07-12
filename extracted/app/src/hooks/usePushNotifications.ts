import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { BRIDGE } from "../config";

/**
 * usePushNotifications — FCM push notification wiring for the native shell.
 *
 * Responsibilities:
 *  1. Request permission & obtain the device push token (raw FCM token on
 *     Android, APNs token on iOS) that you persist to Firestore
 *     `fcm_tokens/{uid}` and dispatch to via `admin.messaging().send()`.
 *  2. Configure the Android notification channel.
 *  3. Forward FOREGROUND notifications into the WebView (so the PWA toast
 *     system can render them), and handle TAP actions (deep-link / reload).
 *
 * Pass the active WebView ref so tokens/notifications can be injected.
 */
export function usePushNotifications(
  webViewRef: React.RefObject<{ injectJavaScript: (js: string) => void } | null>
): void {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Top-level handler for notifications received while the app is foregrounded.
    Notifications.setNotificationHandler({
      handleNotification: () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    let mounted = true;

    (async () => {
      // Only real devices can receive push tokens.
      if (!Device.isDevice) {
        console.warn("[notifications] Push tokens require a physical device (not an emulator).");
        return;
      }

      const channel = await configureAndroidChannel();

      const token = await registerForPushNotificationsAsync();
      if (mounted && token) {
        // Persist the FCM token locally + forward to the PWA for Firestore registration.
        forwardToWebView(webViewRef, BRIDGE.FCM_TOKEN_EVENT, { token, platform: Platform.OS });
        console.info("[notifications] device token:", token, channel ? `(channel: ${channel})` : "");
      }
    })();

    // FOREGROUND: a notification arrives while the app is open.
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const payload = serialize(notification);
      forwardToWebView(webViewRef, BRIDGE.NOTIFICATION_EVENT, payload);
    });

    // TAP / user response (app foregrounded from a notification).
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const payload = serialize(response.notification);
      forwardToWebView(webViewRef, BRIDGE.NOTIFICATION_EVENT, { ...payload, tapped: true });
      // Optional: navigate the PWA by injecting the target route.
      const route = response.notification.request.content.data?.route;
      if (typeof route === "string") {
        webViewRef.current?.injectJavaScript(`window.location.hash = ${JSON.stringify("#" + route)}; true;`);
      }
    });

    return () => {
      mounted = false;
      if (notificationListener.current) Notifications.removeNotificationSubscription(notificationListener.current);
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [webViewRef]);
}

/**
 * Requests permission and returns the native device push token.
 * On Android this is the raw FCM token — exactly what `admin.messaging().send({ token })`
 * consumes server-side (see web app: src/lib/fcm.ts).
 */
async function registerForPushNotificationsAsync(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.warn("[notifications] Push permission not granted.");
    return null;
  }

  // getDevicePushTokenAsync → native FCM (Android) / APNs (iOS) token.
  const { data: token } = await Notifications.getDevicePushTokenAsync();
  return token ?? null;
}

/** Creates the default high-importance Android notification channel. */
async function configureAndroidChannel(): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  await Notifications.setNotificationChannelAsync("verda-default", {
    name: "Verda Alerts",
    description: "Green-leaf, fertilizer & plucking notifications",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#10B981",
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
  });
  return "verda-default";
}

/** Flattens an ExpoNotification into a JSON-safe payload for the WebView. */
function serialize(notification: Notifications.Notification) {
  const c = notification.request.content;
  return {
    id: notification.request.identifier,
    title: c.title ?? "",
    body: c.body ?? "",
    data: c.data ?? {},
    sound: Boolean(c.sound),
  };
}

/** Injects a CustomEvent dispatch into the PWA via the WebView bridge. */
function forwardToWebView(
  ref: React.RefObject<{ injectJavaScript: (js: string) => void } | null>,
  eventName: string,
  detail: unknown
): void {
  ref.current?.injectJavaScript(
    `(function(){
       try {
         window.dispatchEvent(new CustomEvent(${JSON.stringify(eventName)}, { detail: ${JSON.stringify(JSON.stringify(detail))} }));
       } catch (e) { /* PWA not yet loaded — retry on next event */ }
     })(); true;`
  );
}
