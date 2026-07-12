/**
 * Verda · Dynamic Expo config (app.config.js)
 * ------------------------------------------------------------------
 * app.json stays static for tooling; app.config.js layers on the
 * environment-dependent bits (PWA URL, FCM, notification icon).
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
      infoPlist: {
        NSCameraUsageDescription: "Verda uses the camera to scan worker QR badges for attendance.",
        NSLocationWhenInUseUsageDescription: "Verda uses your location to verify your check-in at the estate.",
      },
      // APNs / Firebase for push on iOS
      googleServicesFile: "./GoogleService-Info.plist",
    },
    android: {
      // MUST match package_name in google-services.json → client (com.kdu.feedback).
      package: "com.kdu.feedback",
      // FCM credentials for native push (live config committed at ./google-services.json).
      googleServicesFile: "./google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#064e3b",
      },
      permissions: ["CAMERA", "INTERNET", "VIBRATE", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "POST_NOTIFICATIONS"],
      // Keep notification/external links inside the app (not the phone browser).
      intentFilters: [
        { action: "VIEW", autoVerify: false, data: { scheme: "https" } },
      ],
    },
    web: { favicon: "./assets/favicon.png", bundling: true },
    plugins: [
      [
        "expo-camera",
        { cameraPermission: "Allow Verda to scan QR badges for attendance." },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow Verda to use your location to verify estate check-ins.",
          locationWhenInUsePermission: "Allow Verda to use your location to verify estate check-ins.",
        },
      ],
      // Background fetch for the agri advisory engine.
      "expo-background-fetch",
      "expo-task-manager",
      // expo-notifications plugin — configures FCM at build time.
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#10B981",
          enableBackgroundRemoteNotifications: true,
        },
      ],
    ],
    extra: {
      // Exposed to app code via Constants.expoConfig.extra
      webUrl: process.env.EXPO_PUBLIC_WEB_URL || "https://your-tea-erp.vercel.app",
      eas: { projectId: process.env.EAS_PROJECT_ID || "your-eas-project-id" },
    },
  },
};
