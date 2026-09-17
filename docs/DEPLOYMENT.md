# Verda ERP · Web Deployment & EAS Mobile Build

## A. Local setup

```bash
npm install
cp .env.example .env          # fill Firebase + OpenWeatherMap keys
npm run dev                   # PWA on http://localhost:5173
npm run build                 # single-file production bundle in /dist
npm run preview               # preview the production build
```

## B. Web deploy (zero-downtime)

**Netlify**
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```
Add `public/_redirects` containing `/*  /index.html  200` for SPA routing.

**Vercel**
```bash
npm i -g vercel
vercel --prod
```
Both auto-detect Vite. Output is a single inlined `index.html`, so there are no
broken asset paths and deploys are atomic.

## C. EAS Cloud Build — standalone Android APK (no Android Studio)

The native shell is an Expo app that loads the deployed PWA in a WebView, giving
you FCM push + installability without a local Android toolchain.

```bash
# 1. Install Expo CLI + EAS
npm i -g eas-cli
npx create-expo-app app --template blank-typescript
cd app

# 2. Authenticate & create the cloud project
eas login
eas init                       # writes projectId into app.json -> extra.eas

# 3. Generate eas.json profiles (already provided in app/eas.json)
eas build:configure

# 4. Let EAS manage signing keys in the cloud (no local keystore needed)
eas credentials                # follow prompts; choose "EAS manages credentials"

# 5. Build a downloadable APK in the cloud
eas build -p android --profile preview --non-interactive

# 6. When finished, EAS prints a download URL for the .apk
eas build:list --status finished --platform android
```

### Submitting to Play Store (optional)
```bash
eas build -p android --profile production     # produces an .aab
eas submit -p android --profile production    # uploads to Play Console
```

## D. Free push notifications (FCM only)

1. Enable Cloud Messaging in the Firebase console.
2. Add `VITE_FIREBASE_VAPID_KEY` (Web Push certificate) to `.env`.
3. The service worker (`public/sw.ts`) handles `push` events — no paid SMS gateway required.
