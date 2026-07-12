/**
 * Verda Native Bridge Index
 * ------------------------------------------------------------------
 * Exports all native bridges + a unified WebView message handler that the
 * React Native shell injects. The PWA calls these via:
 *
 *   window.ReactNativeWebView?.postMessage(JSON.stringify({
 *     type: "captureReceipt" | "verifyLocation" | "saveSecure" | ...
 *     ...
 *   }))
 *
 * Install all required native modules:
 *   npx expo install expo-camera expo-image-picker expo-media-library \
 *     expo-location expo-secure-store expo-notifications \
 *     expo-background-fetch expo-task-manager @react-native-async-storage/async-storage \
 *     expo-file-system
 *
 * Then in app.config.js, add the plugins array (see app.config.js updates).
 */
export {
  captureReceipt, pickFromGallery, saveOffline, listOfflineImages,
  type CapturedImage,
} from "./Camera";

export {
  requestLocationPermissions, getCurrentPosition, verifyEstateGeofence,
  startBackgroundGeofence, stopBackgroundGeofence, haversineMeters,
  type EstateGeofence, type VerifiedLocation,
} from "./Location";

export {
  setSecure, getSecure, removeSecure, clearAllSecure,
  persistSession, restoreSession, deviceSecurityCheck,
  type SecureKey,
} from "./SecureStorage";

export {
  registerForPushNotifications, attachNotificationListeners,
  scheduleLocalNotification, setBadgeCount,
  type PushTokenResult,
} from "./Notifications";

export {
  registerBackgroundSync, startBackgroundSync, stopBackgroundSync,
  flushQueueNow, enqueueMutation, getQueueLength,
  FLUSH_QUEUE_TASK,
  type QueuedMutation,
} from "./BackgroundSync";

import { captureReceipt, pickFromGallery } from "./Camera";
import { getCurrentPosition, verifyEstateGeofence, type EstateGeofence } from "./Location";
import { setSecure, getSecure, clearAllSecure } from "./SecureStorage";
import { flushQueueNow, enqueueMutation, getQueueLength } from "./BackgroundSync";

/**
 * Handle a message posted from the PWA's WebView.
 * Returns a JSON-serializable result.
 *
 * Usage in App.tsx:
 *   const onMessage = async (e: WebViewMessageEvent) => {
 *     const req = JSON.parse(e.nativeEvent.data);
 *     const res = await handleBridgeMessage(req);
 *     webViewRef.current?.injectJavaScript(
 *       `window.dispatchEvent(new CustomEvent('verda:bridge:${req.id}', { detail: ${JSON.stringify(res)} })); true;`
 *     );
 *   };
 */
export async function handleBridgeMessage(req: {
  id: string;
  type: string;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    switch (req.type) {
      case "captureReceipt": {
        const img = await captureReceipt();
        return { ok: true, data: img };
      }
      case "pickFromGallery": {
        const img = await pickFromGallery();
        return { ok: true, data: img };
      }
      case "getCurrentPosition": {
        const pos = await getCurrentPosition();
        return { ok: true, data: pos };
      }
      case "verifyEstateGeofence": {
        const estate = req.payload as EstateGeofence;
        const result = await verifyEstateGeofence(estate);
        return { ok: true, data: result };
      }
      case "setSecure": {
        await setSecure(req.payload?.key as any, req.payload?.value as string);
        return { ok: true };
      }
      case "getSecure": {
        const val = await getSecure(req.payload?.key as any);
        return { ok: true, data: val };
      }
      case "clearAllSecure": {
        await clearAllSecure();
        return { ok: true };
      }
      case "flushQueueNow": {
        const result = await flushQueueNow();
        return { ok: true, data: result };
      }
      case "enqueueMutation": {
        await enqueueMutation(req.payload as any);
        return { ok: true };
      }
      case "getQueueLength": {
        const len = await getQueueLength();
        return { ok: true, data: len };
      }
      default:
        return { ok: false, error: `Unknown bridge type: ${req.type}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bridge call failed" };
  }
}
