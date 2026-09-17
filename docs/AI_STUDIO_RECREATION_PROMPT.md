# KDU ERP — Google AI Studio Recreation Prompt
## Complete A-to-Z Project Specification

> **How to use this file:** Copy the entire prompt below (starting at "PROJECT SPECIFICATION") and paste it into Google AI Studio's prompt box. This will recreate the exact same Tea Estate ERP system with the same database connections, same features, and same architecture.

---

## PROJECT SPECIFICATION

Build a production-grade Integrated Tea Estate Enterprise ERP Platform as a Progressive Web App (PWA) with React 19 + Vite + TypeScript + Tailwind CSS v4. The app must be offline-first, tri-lingual (English/Sinhala/Tamil), and use a hybrid backend: Firebase for Authentication (Email/Password) + FCM Push, and Supabase PostgreSQL for all business data.

### CONNECT TO THIS EXACT DATABASE

```
Supabase Project: KDU ERP (id: lfeowzotqcrdximicoar)
URL: https://lfeowzotqcrdximicoar.supabase.co
ANON KEY: sb_publishable_kNeYkS0nB3aq1bLdJf4ZVQ_JUJxL2lC

Firebase Project: kdu-feedback-app
API Key: AIzaSyB7XZXgs6_7DZyqYWiU3emz4hjpUyXjJJY
Auth Domain: kdu-feedback-app.firebaseapp.com
Project ID: kdu-feedback-app
Storage Bucket: kdu-feedback-app.firebasestorage.app
Messaging Sender ID: 806242492907
App ID: 1:806242492907:web:584e11c34f5573cd3f39ae
Measurement ID: G-7HN27DN823

Weather API: OpenWeatherMap Key: 6a8d3f26e42eee17bfc9902c8c04309f

Super Admin Seed: email=akashperera@kdu.com, password=akashperera123*#, role=super_admin
```

### DATABASE SCHEMA (Supabase PostgreSQL — Run These SQL Migrations)

```sql
-- ENUM TYPES
create type user_role as enum ('super_admin','admin','extension_officer','supplier');
create type user_status as enum ('active','suspended');
create type field_status as enum ('plucking','pruned','young','nursery');
create type request_status as enum ('PENDING','APPROVED','REJECTED');
create type request_type as enum ('Workers','Equipment');

-- USERS (id == Firebase uid, TEXT PRIMARY KEY)
create table users (
  id text primary key,
  name text not null default 'Verda User',
  email text,
  phone text,
  division text,
  role user_role not null default 'supplier',
  associated_entity_id uuid,
  status user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ESTATES (uuid PK, with GPS coordinates + map embed + planted date)
create table estates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,
  total_area_ha numeric(10,2),
  elevation_m integer,
  google_maps_embed_url text,
  planted_date date,
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_at timestamptz not null default now()
);

-- DIVISIONS (estate_id FK)
create table divisions (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references estates(id) on delete cascade,
  name text not null,
  manager text,
  area_ha numeric(10,2),
  created_at timestamptz not null default now()
);

-- FIELDS (division_id FK)
create table fields (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references divisions(id) on delete cascade,
  code text not null,
  name text not null,
  cultivar text,
  planting_year integer,
  area_ha numeric(10,2),
  elevation_m integer,
  status field_status not null default 'plucking',
  last_yield_kg numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- HARVEST RECORDS (supplier leaf weights)
create table harvest_records (
  id uuid primary key default gen_random_uuid(),
  supplier_id text references users(id),
  estate_id uuid references estates(id),
  worker_id text,
  field_id uuid references fields(id),
  center_id uuid,
  gross_kg numeric(10,2) not null default 0,
  net_kg numeric(10,2) not null default 0,
  grade text,
  amount numeric(12,2) not null default 0,
  status text not null default 'Pending',
  weighed_at date not null default current_date,
  created_at timestamptz not null default now()
);

-- RESOURCE REQUESTS (supplier → admin ticket flow)
create table resource_requests (
  id uuid primary key default gen_random_uuid(),
  supplier_id text not null references users(id),
  type request_type not null,
  item_details text not null,
  quantity integer not null default 1,
  date_needed timestamptz,
  duration_days integer not null default 1,
  note text,
  status request_status not null default 'PENDING',
  admin_notes text,
  timestamp timestamptz not null default now()
);

-- SUPPLIER LOCATIONS (GPS check-ins)
create table supplier_locations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  delivery_id uuid references harvest_records(id) on delete set null,
  created_at timestamptz not null default now()
);

-- FARM ACTIVITIES (advisory feedback loop)
create table farm_activities (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  activity_type text not null check (activity_type in ('fertilizer','pruning','self_harvest')),
  logged_date date not null default current_date,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- SETTINGS (branding/white-label, single row, jsonb)
create table settings (
  key text primary key default 'branding',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ALL TABLES: enable RLS with OPEN WRITE policies
-- (client RBAC enforces role-based access; RLS write policies are permissive
-- because Firebase Auth means auth.uid() is NULL in Supabase)
alter table users enable row level security;
alter table estates enable row level security;
alter table divisions enable row level security;
alter table fields enable row level security;
alter table harvest_records enable row level security;
alter table resource_requests enable row level security;
alter table supplier_locations enable row level security;
alter table farm_activities enable row level security;
alter table settings enable row level security;

-- Open write policies for all tables (client RBAC gates the UI)
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

### FOUR ROLES (RBAC)

```
1. super_admin — full system control + branding + can create other admins
2. admin — full ERP access (all modules except branding settings)
3. extension_officer — mobile field tools: register suppliers + log leaf weights
4. supplier — mobile portal: own deliveries, payments, farm activities, alerts
```

### MODULE LIST (33 total)

**Admin Desktop Shell (sidebar nav):**
1. Estate Dashboard (KPIs, harvest trends, division performance, live activity)
2. Estate Master (create Estate→Division→Field with lat/lon + map embed + planted date + GPS coordinates editor)
3. Crop Management (lifecycle tasks: pruning/weeding/tipping, yield projection)
4. GPS & GIS Mapping (field polygon SVG map + telemetry)
5. Labor Management (worker roster, QR attendance, productivity)
6. Harvest Management (weigh-in records, grade distribution donut)
7. Vehicle & Fuel (fleet roster, fuel slips, mileage)
8. Resource Requisitions (admin inbox: approve/reject supplier requests)
9. Factory Integration (green leaf→made tea conversion, waste, efficiency)
10. Inventory (QR-based asset allocation)
11. Fertilizer (stock control, consumption logs, cost/ha)
12. Agrochemical (herbicide/pesticide inventory + cert audit trail)
13. Payroll System (wage calc, EPF/ETF 8%/12%/3%, bank file export)
14. Loans & Advances (overdue risk, auto-deduction triggers)
15. Loyalty Program (gamified points, tiers, rewards catalog)
16. Welfare Management (housing, clinic visits, scholarships)
17. Finance & Accounting (general ledger, multi-dim P&L)
18. Weather & Environment (PER-ESTATE live OpenWeatherMap forecast + deterministic alerts + estate selector dropdown)
19. AI & Analytics [PREMIUM] (deterministic yield model + optional Gemini)
20. Audit & Compliance (Rainforest Alliance, Fairtrade, ISO vaults)
21. Mobile & Offline (service worker config, IndexedDB sync queue)
22. Architecture & Docs (in-app blueprint + live Supabase connection status)
23. User Management (CRUD: create/edit/suspend/delete users with Firebase Auth + Supabase)
24. Branding & Settings [SUPER ADMIN ONLY] (logo, login page, background image, accent color — saved to Supabase settings table)

**Extension Officer Mobile Shell (bottom nav):**
25. Register New Supplier (Firebase Auth + Supabase insert with estate link)
26. Leaf Weighing Entry (offline-first weight capture)

**Supplier Mobile Shell (bottom nav):**
27. My Leaf Deliveries (real-time harvest_records scoped to supplier_id + estate_id)
28. Smart Alerts Panel (deterministic fertilizer window + plucking schedule + pruning advisory + weather trigger + feedback loop)
29. Payment Tracker (real-time payment history, estate-scoped)
30. My Farm Activities (log fertilizer/pruning/self_harvest → closes advisory loop)
31. Request Resources (workers/equipment → admin inbox → FCM push on approval)

### KEY ARCHITECTURAL PATTERNS

**1. Auth Flow (Email/Password):**
```
Login.tsx → signInWithEmail(email, password) → Firebase Auth → returns uid
→ fetchUserByUid(uid) → reads Supabase users table → gets role
→ AppContext.setSession({uid, role, associatedEntityId})
→ Shell routes: super_admin/admin → AdminShell (desktop sidebar)
                extension_officer → MobileShell (bottom nav)
                supplier → MobileShell (bottom nav)
```

**2. Super Admin Bootstrap:**
First login with akashperera@kdu.com / akashperera123*# auto-creates the Firebase user + Supabase row with role=super_admin.

**3. Secondary Firebase App for User Creation:**
provisionUser() spins up a throwaway Firebase app instance with inMemoryPersistence so the admin creating a new user is NOT signed out. Creates the Auth user, gets the uid, then INSERTs into Supabase users with that uid.

**4. Real-Time Sync (useLiveData hook):**
```
useLiveData("harvest_records", fetcher, "supplier_id=eq.{uid}")
→ initial fetch on mount
→ subscribes to Supabase postgres_changes (INSERT/UPDATE/DELETE)
→ debounced refetch (250ms) on any change
→ every active screen auto-updates without manual refresh
```

**5. Per-Estate Weather:**
```
fetchForecast(estate.latitude, estate.longitude)
→ calls OpenWeatherMap /data/2.5/forecast with estate-specific coords
→ 10-minute in-memory cache per coordinate pair
→ falls back to Nuwara Eliya defaults if estate has no coords
→ feeds into weatherToAlerts() + evaluateFertilizerWindow() + recommendPlucking()
```

**6. Smart Advisory Feedback Loop:**
```
Supplier logs fertilizer application in "My Farm Activities"
→ INSERT farm_activities (type='fertilizer', details={type, quantityKg})
→ PruningAdvisory reads readLatestFarmActivity(uid, 'fertilizer')
→ Advisory recalculates from real feedback (not static dates)
→ Shows "Last Fertilizer: 2024-07-14" in feedback loop card
```

**7. Deterministic Pruning Schedule:**
```
recommendPruning(plantedDate, today)
→ computePlantAge → {years, months, display}
→ <1yr: tipping | 1-3yr: formative | 3-5yr: light | 5-40yr: deep (4yr cycle) | >40yr: replant
→ 100% If/Else, NO AI
```

**8. Branding (Database-Backed):**
```
BrandingProvider reads settings table (key='branding', jsonb data)
→ Login screen: background image/video + scrim + logo + title
→ App shell: company logo + name + tagline
→ Accent color drives buttons
→ Saves to Supabase (shared across all devices)
```

**9. Tri-Lingual i18n:**
```
i18next + react-i18next
→ locales/en.json, si.json, ta.json (parallel keys)
→ LanguageSwitcher globe button in header
→ Persisted in localStorage 'verda.lang'
→ Every module label, form field, button, alert translated
```

**10. RBAC Enforcement (4 layers):**
```
Layer 1: UI nav — only shows modules the role can access
Layer 2: RouteGuard — blocks module mounting if canAccess() fails
Layer 3: repo.ts — requireEstateAdmin() / requireOwnerOrAdmin() guards
Layer 4: Supabase RLS — open write policies (client RBAC is the real gate)
```

### FILE STRUCTURE

```
src/
├─ App.tsx                    → BrandingProvider → AppProvider → Root → Shell + RouteGuard
├─ main.tsx                   → i18n init + React root
├─ context/AppContext.tsx     → session, role, estates, resourceRequests, toasts, syncQueue
├─ components/
│  ├─ Shell.tsx              → AdminShell (sidebar) + MobileShell (bottom nav) + RoleSwitcher
│  ├─ Login.tsx              → Email/Password form with branding background
│  ├─ RouteGuard.tsx         → blocks unauthorized module access
│  ├─ EstateMap.tsx          → Google Maps embed iframe + edit link
│  ├─ LocationCheckIn.tsx    → "Verify My Location" GPS button + admin history view
│  ├─ PruningAdvisory.tsx    → plant age + pruning cycle + feedback loop
│  ├─ FarmActivities.tsx     → fertilizer/pruning/harvest logging forms
│  ├─ LanguageSwitcher.tsx   → EN/SI/TA globe dropdown
│  ├─ Toaster.tsx            → FCM-style toast notifications
│  ├─ CaptureButton.tsx      → offline-first capture button
│  ├─ QR.tsx                 → deterministic QR code SVG
│  ├─ ui.tsx                 → Card, StatCard, Panel, Badge, Meter, DataTable, Segmented, etc.
│  └─ charts.tsx             → AreaTrend, BarSeries, Donut, RadialGauge (recharts)
├─ modules/                   → 33 ERP modules (see MODULE LIST above)
├─ lib/
│  ├─ firebase.ts            → Firebase init (Auth only)
│  ├─ supabase.ts            → Supabase client init
│  ├─ auth.hybrid.ts         → signInWithEmail, provisionUser, updateUserProfile, deleteUserProfile
│  ├─ repo.ts                → all CRUD functions (createEstate, readUsersForAdmin, etc.)
│  ├─ rbac.ts                → ROLE_CAPABILITIES, MODULES, canAccess(), modulesForRole()
│  ├─ identity.ts            → canonicalRole(), isEstateAdmin(), isSuperAdmin()
│  ├─ predictive.ts          → evaluateFertilizerWindow, recommendPlucking, recommendPruning, weatherToAlerts
│  ├─ weather.ts             → fetchForecast(lat, lon) → OpenWeatherMap
│  ├─ branding.tsx           → BrandingProvider (Supabase settings table)
│  ├─ useLiveData.ts         → real-time Supabase sync hook
│  ├─ fcm.ts                 → FCM push dispatch simulation
│  └─ data.ts                → TypeScript types + mock seed data
└─ i18n/
   ├─ index.ts               → i18next config
   ├─ modules.ts             → moduleLabel(), moduleShort(), roleTitle() helpers
   └─ locales/{en,si,ta}.json → all translations
```

### ENVIRONMENT VARIABLES (.env)

```
VITE_SUPABASE_URL=https://lfeowzotqcrdximicoar.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_kNeYkS0nB3aq1bLdJf4ZVQ_JUJxL2lC
VITE_FIREBASE_API_KEY=AIzaSyB7XZXgs6_7DZyqYWiU3emz4hjpUyXjJJY
VITE_FIREBASE_AUTH_DOMAIN=kdu-feedback-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kdu-feedback-app
VITE_FIREBASE_STORAGE_BUCKET=kdu-feedback-app.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=806242492907
VITE_FIREBASE_APP_ID=1:806242492907:web:584e11c34f5573cd3f39ae
VITE_FIREBASE_MEASUREMENT_ID=G-7HN27DN823
VITE_OW_API_KEY=6a8d3f26e42eee17bfc9902c8c04309f
VITE_OW_LAT=6.9679
VITE_OW_LON=80.7618
```

### DESIGN SYSTEM

- **Primary color:** Emerald (#10b981) + Teal gradient
- **Font:** Plus Jakarta Sans (display) + Inter (body)
- **Admin Shell:** Dark pine-green sidebar (#04231A → #064e3b), white content area
- **Mobile Shell:** Centered phone frame on desktop, full-bleed on mobile, gradient header
- **Cards:** White with subtle shadow, rounded-xl, hover lift
- **Stat cards:** Icon chip + big number + sparkline
- **Charts:** recharts (AreaTrend, BarSeries, Donut, RadialGauge)
- **Icons:** lucide-react

### IMPORTANT BEHAVIORS

1. Estates load from Supabase on mount (not mock seed) — refresh-safe
2. User Management uses real-time useLiveData("users", ...) — auto-syncs
3. Supplier deliveries use real-time useLiveData("harvest_records", ..., filter)
4. Weather fetches per-estate coordinates with 10-min cache
5. Branding saves to Supabase settings table (shared across devices)
6. Farm activities close the advisory feedback loop
7. GPS location check-in writes to supplier_locations
8. Estate creation includes lat/lon fields (no SQL needed)
9. All forms validate before submit
10. Error messages surface the real Supabase/Firebase error (never masked)

### BUILD OUTPUT

`npm run build` → single-file `dist/index.html` (all JS/CSS inlined via vite-plugin-singlefile). Deploy to Netlify/Vercel with zero config.

---

*This prompt recreates the KDU ERP system exactly as it exists now — all 33 modules, 4 roles, 9 database tables, real-time sync, tri-lingual support, per-estate weather, smart advisory engine, and branding system.*
