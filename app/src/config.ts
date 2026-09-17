/**
 * KDU TEA FACTORY · Native shell configuration
 * ------------------------------------------------------------------
 * The deployed PWA URL. Set via EXPO_PUBLIC_WEB_URL in .env (app/.env),
 * otherwise falls back to the live production URL.
 *
 * Expo v0.74+ exposes `process.env.EXPO_PUBLIC_*` to app code.
 */
export const WEB_URL: string =
  (process.env.EXPO_PUBLIC_WEB_URL as string | undefined) ??
  "https://akashpereraproject24.vercel.app";

/**
 * Namespace for the WebView ↔ PWA message bridge. The native shell injects
 * FCM tokens and forwarded push notifications onto `window` using these
 * event names; the PWA (web app) listens for them to register the device
 * and surface toasts:
 *
 *   window.addEventListener("verda:fcm-token", (e) => registerToken(e.detail));
 *   window.addEventListener("verda:notification", (e) => showToast(e.detail));
 */
export const BRIDGE = {
  FCM_TOKEN_EVENT: "verda:fcm-token",
  NOTIFICATION_EVENT: "verda:notification",
} as const;

/** Runs in the WebView BEFORE the page loads — flags the native shell. */
export const BOOTSTRAP_JS = `
  (function () {
    window.__VERDA_NATIVE__ = true;
    window.__VERDA_NATIVE_VERSION__ = '1.0.0';
  })();
  true;
`;
