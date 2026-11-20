/**
 * Detect the embedded Android WebView used by separately packaged Expo shells
 * (native bridge, "wv" UA marker, or the legacy WebView UA).
 *
 * Policy note (Nov 2026): this used to suppress the web language switcher
 * because the shell drew its own native language overlay in the same corner.
 * That overlay is gone, so the language switcher is now rendered everywhere —
 * keeping the detector as a utility for future shell-specific tweaks (safe
 * areas, keyboard insets, native bridges).
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
