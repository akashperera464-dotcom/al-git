# 🍃 Verda — Integrated Tea Estate Enterprise ERP Platform

A production-grade, **offline-first PWA** (with a ready-to-compile **React Native / Expo (EAS)** hybrid shell) that unifies **Factory Owners/Admins**, **Field Supervisors**, and **VVIP External Suppliers** inside a single, context-aware codebase with adaptive layouts.

> Built with **React 19 + Vite + TypeScript + Tailwind CSS v4**, **Firebase** (Auth + Firestore + **FCM** free push), and **IndexedDB / Service-Worker** offline sync. Weather & plucking logic is **100% deterministic**; the only optional external AI call lives in the premium Analytics module.

---

## 🧭 The three roles (one adaptive shell)

| Role | Layout | Key surface |
|------|--------|-------------|
| **Admin / Estate Director** | Desktop-optimised: dark sidebar + executive grids | All 20 modules, full ledger, compliance |
| **Field Supervisor** | Mobile-first phone shell (offline capture) | Labor, Weigh-in, Fertilizer, Weather, offline sync |
| **VVIP Supplier** | Mobile-first alert portal | Predictive Fertilizer Advisor, plucking plan, supply ledger |

Switch roles live from the avatar menu (top-right on desktop, header on mobile).

---

## 📦 The 20 core modules

Dashboard · Estate Master · Labor · Payroll · Loans & Advances · Fertilizer · Agrochemical · Crop Management · Harvest · Factory Integration · Inventory · Finance & Accounting · Loyalty · Welfare · GPS/GIS · Weather · Vehicle & Fuel · Mobile & Offline · **AI & Analytics (Premium)** · Audit & Compliance — plus an in-app **Architecture & Docs** blueprint.

---

## 1 · Complete project folder structure

```
verda-tea-erp/
├─ index.html                 # PWA shell, theme-color, Google fonts
├─ public/
│  ├─ manifest.json           # PWA manifest (installable)
│  ├─ sw.ts                   # Workbox service worker (offline engine)
│  └─ icons/                  # 192 / 512 / maskable icons
├─ src/
│  ├─ main.tsx                # React 19 entry
│  ├─ App.tsx                 # Provider + adaptive Shell + module router
│  ├─ index.css               # Tailwind v4 theme + design tokens
│  ├─ context/AppContext.tsx  # role / online / sync-queue state
│  ├─ lib/
│  │  ├─ data.ts              # domain models (mirror Firestore)
│  │  ├─ predictive.ts        # deterministic decision engines
│  │  ├─ nav.ts               # adaptive navigation registry
│  │  └─ firebase.ts          # Auth + Firestore + FCM init
│  ├─ components/             # ui, charts, Shell, QR, Icon, CaptureButton
│  └─ modules/                # 20 ERP modules + role consoles (RoleScreens)
├─ app/                       # Expo wrapper (loads PWA in WebView)
│  ├─ app.json · eas.json
├─ docs/                      # FIRESTORE_SCHEMA.md, DEPLOYMENT.md
├─ .env.example               # Firebase + OpenWeatherMap + Gemini keys
└─ vite.config.ts             # Vite + PWA + single-file plugin
```

---

## 2 · Firestore architecture (summary)

Root collections with role-scoped security rules. Full detail in [`docs/FIRESTORE_SCHEMA.md`](docs/FIRESTORE_SCHEMA.md).

```
estates → divisions → fields → blocks        (hierarchy)
workers, attendance, payroll_runs, loans      (people & pay)
fertilizer_stock/logs, agrochemical_stock/audit, crop_tasks   (inputs)
collection_centers, harvest, factory_batches, inventory_items  (ops)
ledger_entries, cashbook, welfare_units/cases, loyalty_points  (finance)
suppliers → supplies, fcm_tokens, push_log    (VVIP + notifications)
```

A Cloud Function `scheduledSupplierTick` re-runs the client's `evaluateFertilizerWindow()` nightly and fires FCM pushes — same deterministic code on client and server.

---

## 3 · Adaptive responsive layout framework

A single `<Shell>` reads `role` from context and reflows:

- **Admin** → `AdminShell`: sticky dark sidebar (grouped nav), backdrop-blur top bar, fluid desktop grids (`lg:grid-cols-3/4`). Collapses to a slide-over drawer < `lg`.
- **Supervisor / Supplier** → `MobileShell`: centered phone frame on desktop, full-bleed on phones, gradient header, **sticky bottom tab bar** + a "More" bottom-sheet listing every role-permitted module.

Every module is mobile-first (cards stack at `grid-cols-2 → lg:grid-cols-4`) so the same component renders beautifully in both shells. See `src/components/Shell.tsx`.

---

## 4 · VVIP Supplier Predictive Calculator

The hero of the supplier portal (`src/modules/RoleScreens.tsx → SupplierAdvisor`) — a live, interactive engine in `src/lib/predictive.ts`:

```ts
evaluateFertilizerWindow({
  lastApplicationDate, cropStage, cultivar,
  soilMoisturePct, temperatureC, forecast[], region
}, today)
```

**Deterministic rules (no AI):**
1. **Overdue** = `daysSince(lastApp) − interval(stage)`; `>14d` → *critical*, `≥0` → *due*.
2. **Rain wash-in window** = first run of `5–35mm` (≥45% prob) in the 7-day forecast.
3. **Heavy-rain penalty** (>40mm tomorrow) → defer to avoid leaching.
4. **Soil band** 30–70% boosts the readiness score; <25% / >80% triggers caveats.
5. Outputs `level`, `score`, `recommendedDate`, `message`, and human-readable `reasons[]`.

The supplier can drag **soil moisture** and switch **crop stage** — the gauge, recommendation and reasons recompute instantly. A second engine, `recommendPlucking()`, tells suppliers/supervisors **exactly which field to pluck today** using cycle maturity × shoot length × incoming rain.

---

## 5 · Local initialization checklist

```bash
npm install
cp .env.example .env        # add Firebase + OpenWeatherMap keys
npm run dev                 # → http://localhost:5173
npm run build && npm run preview
```

> The app runs fully on mock data without keys. Add Firebase/OW keys to connect real data; `VITE_GEMINI_API_KEY` is optional (AI module only).

---

## 6 · Web deployment manual (zero-downtime)

The build emits a **single inlined `index.html`** — atomic deploys, no broken asset paths.

```bash
# Netlify
npm i -g netlify-cli && netlify deploy --prod --dir=dist
# Vercel
npm i -g vercel && vercel --prod
```
Add `public/_redirects` → `/*  /index.html  200` for SPA routing.

---

## 7 · EAS Cloud Build — Android APK (no Android Studio)

```bash
npm i -g eas-cli
cd app && eas login && eas init
eas credentials            # "EAS manages credentials" — no local keystore
eas build -p android --profile preview   # cloud build → downloadable .apk
eas build:list --status finished         # grab the download URL
```

`app/app.json` + `app/eas.json` (preview = APK, production = AAB for Play Store) are provided. The Expo app wraps the deployed PWA in a WebView for native FCM push + installability.

---

## ✅ Notifications policy

Push uses **Firebase Cloud Messaging only** (free). **No Twilio, WhatsApp, or paid SMS gateways** are integrated. `public/sw.ts` handles `push` events and displays notifications even when the app is closed.

## 🤖 AI policy

Weather, plucking and fertilizer alerts are **deterministic If/Else** (`src/lib/predictive.ts`). The **only** external LLM integration point is the premium AI module (`src/modules/AiAnalytics.tsx` → `src/lib/ai.ts`, Gemini/DeepSeek), which adds narrative on top of the deterministic baseline and is disabled without `VITE_GEMINI_API_KEY`.

---

*Verda ERP — one codebase, three contexts, zero downtime.*
