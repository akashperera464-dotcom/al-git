# KDU ERP — Getting Started Guide (A to Z)
### From download to deployed Web App + Android APK

> Follow these steps in order. Each step has the exact terminal commands to run.

---

## Step 0 — Prerequisites

Install these on your computer first:

```bash
# Node.js (v18 or higher) — check with:
node -v

# A code editor (VS Code recommended)

# Git (to clone the project)
git -v

# Expo CLI (for the Android APK build)
npm install -g eas-cli
```

Accounts you'll need (all free):
- **Supabase** account (database) → your project is already created: `KDU ERP` (`lfeowzotqcrdximicoar`)
- **Firebase** account (auth + push) → your project is already created: `kdu-feedback-app`
- **OpenWeatherMap** account (weather API) → your key is already active: `6a8d3f26e42eee17bfc9902c8c04309f`
- **Expo** account (for EAS cloud builds) → sign up free at expo.dev

---

## Step 1 — Download & Install the Web App

```bash
# 1. Download/clone the project
git clone <your-repo-url> kdu-erp
cd kdu-erp

# 2. Install web app dependencies
npm install
```

This installs: React 19, Vite, Tailwind CSS v4, Firebase, Supabase, recharts, lucide-react, i18next, and all other dependencies.

---

## Step 2 — Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Create the file (or copy from .env.example)
cp .env.example .env
```

Open `.env` and paste these exact values (they connect to your live database):

```env
# ── Supabase (PostgreSQL database) ──
VITE_SUPABASE_URL=https://lfeowzotqcrdximicoar.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_kNeYkS0nB3aq1bLdJf4ZVQ_JUJxL2lC

# ── Firebase (Authentication + FCM Push) ──
VITE_FIREBASE_API_KEY=AIzaSyB7XZXgs6_7DZyqYWiU3emz4hjpUyXjJJY
VITE_FIREBASE_AUTH_DOMAIN=kdu-feedback-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kdu-feedback-app
VITE_FIREBASE_STORAGE_BUCKET=kdu-feedback-app.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=806242492907
VITE_FIREBASE_APP_ID=1:806242492907:web:584e11c34f5573cd3f39ae
VITE_FIREBASE_MEASUREMENT_ID=G-7HN27DN823
VITE_FIREBASE_VAPID_KEY=

# ── Weather API (OpenWeatherMap) ──
VITE_OW_API_KEY=6a8d3f26e42eee17bfc9902c8c04309f
VITE_OW_LAT=6.9679
VITE_OW_LON=80.7618

# ── AI module (optional, leave blank) ──
VITE_GEMINI_API_KEY=
```

---

## Step 3 — Run Supabase SQL Migrations (CRITICAL)

Go to your **Supabase Dashboard** → **SQL Editor** → click **"+ New query"**.

Run each migration below. Some must run **alone** (noted). Copy-paste each block → Run → wait for "Success" → then do the next.

### Migration 1 — Add extension_officer role (RUN ALONE)

```sql
alter type user_role add value if not exists 'extension_officer';
```

> ⚠️ This one MUST run alone in its own query (Postgres can't add enum values inside a transaction).

### Migration 2 — Main schema + RLS (new query)

```sql
-- Update old supervisor rows to extension_officer
update users set role = 'extension_officer' where role = 'supervisor';

-- Estate columns: map embed, planted date, GPS coordinates
alter table estates add column if not exists google_maps_embed_url text;
alter table estates add column if not exists planted_date date;
alter table estates add column if not exists latitude numeric(9,6);
alter table estates add column if not exists longitude numeric(9,6);

-- Add email + division columns to users (Email/Password auth)
alter table users add column if not exists email text;
alter table users add column if not exists division text;

-- Farm activities table (advisory feedback loop)
create table if not exists farm_activities (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  activity_type text not null check (activity_type in ('fertilizer','pruning','self_harvest')),
  logged_date date not null default current_date,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_farm_activities_user on farm_activities(user_id, logged_date desc);

-- Supplier locations table (GPS check-ins)
create table if not exists supplier_locations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  delivery_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_supplier_locations_user on supplier_locations(user_id, created_at desc);

-- Settings table (branding/white-label)
create table if not exists settings (
  key text primary key default 'branding',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into settings (key, data) values ('branding', '{}'::jsonb) on conflict (key) do nothing;
```

### Migration 3 — Enable RLS + open policies (new query)

```sql
-- Enable RLS on all tables
alter table users enable row level security;
alter table estates enable row level security;
alter table divisions enable row level security;
alter table fields enable row level security;
alter table harvest_records enable row level security;
alter table resource_requests enable row level security;
alter table supplier_locations enable row level security;
alter table farm_activities enable row level security;
alter table settings enable row level security;

-- Drop any old restrictive policies
drop policy if exists "hierarchy admin write" on estates;
drop policy if exists "hierarchy admin write" on divisions;
drop policy if exists "hierarchy admin write" on fields;
drop policy if exists "users self insert" on users;
drop policy if exists "users update own profile" on users;
drop policy if exists "requests insert own" on resource_requests;
drop policy if exists "requests admin update" on resource_requests;
drop policy if exists "harvest insert" on harvest_records;
drop policy if exists "supplier_loc insert own" on supplier_locations;
drop policy if exists "settings admin write" on settings;

-- Create OPEN policies (client RBAC enforces role-based access)
create policy "open write" on users for all using (true) with check (true);
create policy "open write" on estates for all using (true) with check (true);
create policy "open write" on divisions for all using (true) with check (true);
create policy "open write" on fields for all using (true) with check (true);
create policy "open write" on harvest_records for all using (true) with check (true);
create policy "open write" on resource_requests for all using (true) with check (true);
create policy "open write" on supplier_locations for all using (true) with check (true);
create policy "open write" on farm_activities for all using (true) with check (true);
create policy "open read" on settings for select using (true);
create policy "open write" on settings for all using (true) with check (true);
```

### Migration 4 — Enable Real-time (new query)

```sql
-- Enable real-time on key tables so useLiveData() works
alter publication supabase_realtime add table harvest_records;
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table estates;
alter publication supabase_realtime add table resource_requests;
alter publication supabase_realtime add table farm_activities;
alter publication supabase_realtime add table supplier_locations;
```

> If any of these say "already added," that's fine — just continue.

---

## Step 4 — Enable Firebase Email/Password Auth

1. Go to **Firebase Console** → `kdu-feedback-app` project
2. **Authentication** → **Sign-in method**
3. Click **Email/Password** → **Enable** → **Save**
4. Go to **Authentication** → **Settings** → **Authorized domains**
5. Add your domains: `localhost`, `your-app.vercel.app` (or wherever you'll deploy)

> The Super Admin account (`akashperera@kdu.com` / `akashperera123*#`) auto-creates on first login.

---

## Step 5 — Run the Web App Locally

```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

**Login:** `akashperera@kdu.com` / `akashperera123*#`

You should see the Super Admin dashboard. Test these:
- **Estate Master** → Create an estate (with lat/lon coordinates)
- **User Management** → Create a supplier/extension officer
- **Branding & Settings** → Upload a logo / change login background
- **Weather & Environment** → Switch estates, see per-estate weather
- Switch language (🌐 button) → Sinhala/Tamil

---

## Step 6 — Build the Production Web App

```bash
# Build the single-file production bundle
npm run build

# Preview it locally to verify
npm run preview
```

This creates `dist/index.html` — a single file with all JS/CSS inlined.

---

## Step 7 — Deploy the Web App (choose one)

### Option A: Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### Option B: Vercel
```bash
npm install -g vercel
vercel --prod
```

### Option C: Any static host
Upload the `dist/` folder to any web host (GitHub Pages, Cloudflare Pages, etc.).

After deploying, add your deployed URL to **Firebase → Authorized domains** so auth works.

---

## Step 8 — Build the Android APK (Native App)

The native app wraps your deployed web app in a WebView with FCM push notifications.

### 8a. Install native app dependencies
```bash
cd app
npm install
cd ..
```

### 8b. Configure the native environment
Create `app/.env`:
```bash
cp app/.env.example app/.env
```

Edit `app/.env`:
```env
EXPO_PUBLIC_WEB_URL=https://your-deployed-app.vercel.app
EXPO_PUBLIC_SUPABASE_URL=https://lfeowzotqcrdximicoar.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_kNeYkS0nB3aq1bLdJf4ZVQ_JUJxL2lC
EAS_PROJECT_ID=your-eas-project-id
```

> Replace `EXPO_PUBLIC_WEB_URL` with your actual deployed web app URL from Step 7.

### 8c. Login to Expo & initialize
```bash
cd app
eas login
eas init
```

> `eas init` creates a project ID on expo.dev and writes it to `app.json`.

### 8d. Configure cloud credentials
```bash
eas credentials
```
- Choose **Android**
- Choose **"EAS manages credentials"** (no local Android Studio needed)

### 8e. Build the APK (cloud build — no local Android SDK)
```bash
eas build -p android --profile preview
```

> This builds in the cloud. Takes ~10-15 minutes. When done, it gives you a download URL for the `.apk` file.

### 8f. Download the APK
```bash
# List completed builds
eas build:list --status finished --platform android
```

Or open the URL printed in the terminal. Download the `.apk` → install on any Android phone.

---

## Step 9 — Verify Everything Works

| Feature | How to test |
|---|---|
| **Login** | Super Admin: `akashperera@kdu.com` / `akashperera123*#` |
| **Create Estate** | Estate Master → add lat/lon → save → refresh → still there |
| **Create User** | User Management → create supplier → they can log in |
| **Weather** | Weather module → switch estates → different forecasts |
| **Branding** | Settings → change logo → logout → login screen updated |
| **Farm Activities** | Supplier → My Farm Activities → log fertilizer → advisory updates |
| **GPS Check-in** | Supplier → Verify My Location → coordinates saved |
| **Real-time sync** | Open two browser tabs → create a user in one → appears in the other |
| **Languages** | Click 🌐 → switch to Sinhala/Tamil → everything translates |
| **APK** | Install on Android → login → FCM push works |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "RLS policy violation" error | Run Migration 3 (open write policies) |
| Estate disappears on refresh | Check Supabase is reachable: Admin → Architecture → Backend → Test |
| Can't create users ("auth failed") | Firebase Console → Authentication → enable Email/Password |
| Weather shows "Demo data" | Check `.env` has `VITE_OW_API_KEY=6a8d3f26e42...` |
| Weather same for all estates | Set lat/lon per estate in Estate Master → "Set Coordinates" |
| Branding doesn't save | Run Migration 2 (settings table) + Migration 3 (open policy) |
| Language not translating | Check `src/i18n/locales/` files exist with matching keys |
| APK won't build | Ensure `app/.env` has correct `EXPO_PUBLIC_WEB_URL` |
| Real-time not syncing | Run Migration 4 (enable real-time publications) |

---

## File Summary

```
kdu-erp/
├─ .env                        ← your database keys (Step 2)
├─ src/                        ← the React web app (Steps 5-7)
├─ app/                        ← the Expo native app (Step 8)
│  ├─ .env                     ← native app config
│  ├─ google-services.json     ← Firebase Android config
│  └─ app.config.js            ← Expo config
├─ docs/                       ← all documentation
│  ├─ GETTING_STARTED.md       ← THIS FILE
│  └─ AI_STUDIO_RECREATION_PROMPT.md  ← recreate prompt
└─ dist/                       ← built web app (Step 6)
```

---

*That's it — from download to deployed web app + Android APK.*
