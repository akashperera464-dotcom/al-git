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
 * NOTE: Background sync (expo-background-fetch + expo-task-manager) was
 * removed because the plugins had a Gradle incompatibility with RN 0.74.
 * The PWA Service Worker now handles background sync via web APIs.
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

import { captureReceipt, pickFromGallery } from "./Camera";
import { getCurrentPosition, verifyEstateGeofence, type EstateGeofence } from "./Location";
import { setSecure, getSecure, clearAllSecure } from "./SecureStorage";

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
        clearAllSecure();
        return { ok: true };
      }
      default:
        return { ok: false, error: `Unknown bridge type: ${req.type}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Bridge call failed" };
  }
}
