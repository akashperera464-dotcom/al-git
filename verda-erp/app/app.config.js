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
        NSCameraUsageDescription: "Verda uses the camera to capture receipts and scan worker QR badges for attendance.",
        NSLocationWhenInUseUsageDescription: "Verda uses your location to verify your check-in at the estate.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Verda uses background location to verify estate attendance during deliveries.",
        NSPhotoLibraryUsageDescription: "Verda needs photo library access to attach saved receipt images.",
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
      permissions: [
        "CAMERA",
        "INTERNET",
        "VIBRATE",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "POST_NOTIFICATIONS",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION",
        "RECEIVE_BOOT_COMPLETED",
        "WAKE_LOCK",
      ],
      // Keep notification/external links inside the app (not the phone browser).
      intentFilters: [
        { action: "VIEW", autoVerify: false, data: { scheme: "https" } },
      ],
    },
    web: { favicon: "./assets/favicon.png", bundling: true },
    plugins: [
      [
        "expo-camera",
        {
          cameraPermission: "Verda needs camera access to capture receipts, documents, and scan worker QR badges for attendance.",
          microphonePermission: false,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Verda needs photo library access to attach saved receipt images.",
          cameraPermission: "Verda needs camera access to capture receipts and field documents.",
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission: "Verda saves captured documents to your photo library for offline reference.",
          savePhotosPermission: false,
          isAccessMediaLocationEnabled: true,
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Verda uses your location to verify estate check-ins during deliveries, even when the app is closed.",
          locationWhenInUsePermission: "Verda uses your location to verify your check-in at the estate.",
          isAndroidBackgroundLocationEnabled: true,
          androidBackgroundLocationMode: "fusedLocationProvider",
        },
      ],
      [
        "expo-secure-store",
        { faceIDPermission: "Verda uses Face ID to securely unlock your account." },
      ],
      // Background fetch for both the agri advisory engine + the offline sync queue.
      [
        "expo-background-fetch",
        { backgroundTaskName: "verda-flush-queue" },
      ],
      "expo-task-manager",
      "expo-file-system",
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
      eas: { projectId: "71a981ec-8fd6-4e73-bbf2-58996a4f112e" },
    },
  },
};
