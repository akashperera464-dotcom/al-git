/**
 * Verda · Minimal Native Shell config (app.config.js)
 * ------------------------------------------------------------------
 * Pure React Native WebView wrapper. NO native plugins. NO FCM.
 * NO camera/location/notifications. Just a WebView that loads the PWA.
 *
 * This keeps the Gradle build trivial — no Kotlin plugin code to compile
 * beyond the bare React Native runtime (react-native-webview + netinfo).
 */
export default {
  expo: {
    name: "Verda Tea Estate ERP",
    slug: "verda-tea-erp",
    version: "1.0.0",
    orientation: "default",
    userInterfaceStyle: "automatic",
    scheme: "verda",
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#064e3b",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.verda.teaerp",
    },
    android: {
      package: "com.verda.teaerp",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#064e3b",
      },
      // Bare minimum permissions for a WebView app.
      permissions: ["INTERNET", "ACCESS_NETWORK_STATE"],
      intentFilters: [
        { action: "VIEW", autoVerify: false, data: { scheme: "https" } },
      ],
    },
    web: { favicon: "./assets/favicon.png", bundling: true },
    // NO plugins array — keep the native build pure RN.
    extra: {
      webUrl: process.env.EXPO_PUBLIC_WEB_URL || "https://your-tea-erp.vercel.app",
      eas: { projectId: "71a981ec-8fd6-4e73-bbf2-58996a4f112e" },
    },
  },
};
