/**
 * Detect the embedded Android WebView used by separately packaged APK shells.
 * Normal Chrome and installed browser PWAs must keep the web language control;
 * APK shells often add their own native language overlay in the same corner.
 */
export function isAndroidEmbeddedWebView(
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
  hasNativeBridge = typeof window !== "undefined" && Boolean(
    (window as Window & { Android?: unknown; ReactNativeWebView?: unknown }).Android ||
    (window as Window & { Android?: unknown; ReactNativeWebView?: unknown }).ReactNativeWebView,
  ),
): boolean {
  if (!/android/i.test(userAgent)) return false;
  return hasNativeBridge || /\bwv\b/i.test(userAgent) || /version\/4\.0.*chrome\//i.test(userAgent);
}
