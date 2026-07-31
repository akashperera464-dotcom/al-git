/**
 * KDU TEA FACTORY · Dynamic Expo config (app.config.js)
 * ------------------------------------------------------------------
 * app.json stays static for tooling; app.config.js layers on the
 * environment-dependent bits (PWA URL, FCM, notification icon).
 *
 * NOTE: slug + package stay as 'verda-tea-erp' / 'com.kdu.feedback' so the
 * new APK can update over the existing install. Only user-visible name
 * + branding changes.
 */
export default {
  expo: {
    name: "KDU TEA FACTORY",
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
        NSCameraUsageDescription: "KDU TEA FACTORY uses the camera to capture receipts and scan worker QR badges for attendance.",
        NSLocationWhenInUseUsageDescription: "KDU TEA FACTORY uses your location to verify your check-in at the estate.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "KDU TEA FACTORY uses background location to verify estate attendance during deliveries.",
        NSPhotoLibraryUsageDescription: "KDU TEA FACTORY needs photo library access to attach saved receipt images.",
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
      // Bump Gradle memory to prevent OOM during dexing of large dependency set.
      gradle: {
        properties: {
          "org.gradle.jvmargs":
            "-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dkotlin.daemon.jvm.options=-Xmx2048m",
          "org.gradle.parallel": "true",
          "org.gradle.caching": "true",
        },
      },
    },
    web: { favicon: "./assets/favicon.png", bundling: true },
    plugins: [
      [
        "expo-camera",
        {
          cameraPermission: "KDU TEA FACTORY needs camera access to capture receipts, documents, and scan worker QR badges for attendance.",
          microphonePermission: false,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "KDU TEA FACTORY needs photo library access to attach saved receipt images.",
          cameraPermission: "KDU TEA FACTORY needs camera access to capture receipts and field documents.",
        },
      ],
      [
        "expo-media-library",
        {
          photosPermission: "KDU TEA FACTORY saves captured documents to your photo library for offline reference.",
          savePhotosPermission: false,
          isAccessMediaLocationEnabled: true,
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "KDU TEA FACTORY uses your location to verify estate check-ins during deliveries, even when the app is closed.",
          locationWhenInUsePermission: "KDU TEA FACTORY uses your location to verify your check-in at the estate.",
          isAndroidBackgroundLocationEnabled: true,
          androidBackgroundLocationMode: "fusedLocationProvider",
        },
      ],
      [
        "expo-secure-store",
        { faceIDPermission: "KDU TEA FACTORY uses Face ID to securely unlock your account." },
      ],
      "expo-file-system",
      "expo-font", // peer dep of @expo/vector-icons — required for native build
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
      webUrl: process.env.EXPO_PUBLIC_WEB_URL || "https://akashpereraproject24.vercel.app",
      eas: { projectId: "71a981ec-8fd6-4e73-bbf2-58996a4f112e" },
    },
  },
};
