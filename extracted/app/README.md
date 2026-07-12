# Verda · Native Hybrid Shell (React Native + Expo)

A thin native wrapper that loads the deployed **Verda PWA** (React + Vite) in a
full-screen `WebView`, with **native FCM push notifications** and offline handling.

> The entire ERP feature set lives in the web app. This shell only:
> renders the WebView, handles connectivity, and bridges FCM tokens + notifications.

## Structure

```
app/
├─ App.tsx                      # Shell: WebView + loader + offline + bridge
├─ app.config.js                # Dynamic Expo config (URL, FCM, plugins)
├─ package.json                 # Expo + react-native-webview + expo-notifications
├─ babel.config.js / metro.config.js / tsconfig.json
├─ .env.example                 # EXPO_PUBLIC_WEB_URL, EAS_PROJECT_ID
└─ src/
   ├─ config.ts                 # PWA URL + WebView↔PWA bridge constants
   ├─ hooks/usePushNotifications.ts   # FCM token + notification listeners
   └─ components/
      ├─ LoadingScreen.tsx      # Branded ActivityIndicator
      └─ OfflineScreen.tsx      # "You are offline" + Retry
```

## 1 · Install & run

```bash
cd app
npm install
cp .env.example .env            # set EXPO_PUBLIC_WEB_URL to your deployed PWA
npx expo start                  # then press a (Android) / i (iOS) in an emulator
```

> Push tokens only work on a **physical device** — emulators log a warning.

## 2 · FCM setup (free native push)

The app uses `expo-notifications`, which speaks **FCM** on Android and **APNs** on iOS.

1. Create a Firebase project → add an **Android** app (package `com.verda.teaerp`)
   and download **`google-services.json`** into `app/`.
2. (iOS) add an iOS app → download **`GoogleService-Info.plist`** into `app/`.
3. `app.config.js` already points `googleServicesFile` at these.

The hook calls `Notifications.getDevicePushTokenAsync()` → the **raw FCM token**,
which it forwards into the WebView as a `verda:fcm-token` event. The PWA persists
it to Firestore `fcm_tokens/{uid}`, and your Cloud Function dispatches via
`admin.messaging().send({ token })` (see web app `src/lib/fcm.ts`).

## 3 · PWA bridge (web side — optional wiring)

To consume the bridge in the web app, add anywhere on mount:

```ts
window.addEventListener("verda:fcm-token", (e) =>
  registerFcmToken((e as CustomEvent).detail.token));   // → Firestore fcm_tokens
window.addEventListener("verda:notification", (e) =>
  showToast((e as CustomEvent).detail));                // → existing Toaster
const isNative = Boolean((window as any).__VERDA_NATIVE__);
```

## 4 · Build a standalone APK (no Android Studio)

```bash
cd app
eas login && eas init
eas build -p android --profile preview          # cloud build → downloadable .apk
eas build -p android --profile production        # .aab for Play Store
```

## Assets required

Place these in `app/assets/` before building:
`icon.png`, `splash.png`, `adaptive-icon.png`, `favicon.png`, `notification-icon.png`.
