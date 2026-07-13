# Verda ERP · සම්පූර්ණ වැඩබිම මාර්ගෝපදේශය / Complete Workflow Guide

> **කියවන්නේ කවුද? / Who should read this:** මේ ලේඛනය ඕනෑම කෙනෙකුට මේ ERP පද්ධතිය භාවිත කරන්න අවශ්‍ය වුවහොත් — නව admin කෙනෙක්, නව developer කෙනෙක්, හෝ ඕනෑම operator කෙනෙක්. මේක පළමු කියවිය යුතු ලේඛනයයි. / Anyone who needs to use or take over this ERP — new admin, new developer, or any operator. This is the first document to read.

---

## 0 · මේ පද්ධතිය ගැන කෙටි විස්තරය / System at a Glance

**Verda** යනු **Tea Estate Enterprise ERP** පද්ධතියකි. එය තේ වතු සමාගමක් සම්පූර්ණයෙන් කළමනාකරණය කරයි — green leaf එකතු කිරීමේ සිට made tea නිෂ්පාදනය සහ අලෙවි කිරීම දක්වා.

**Verda** is a **Tea Estate Enterprise ERP** that manages an entire tea estate company — from green-leaf collection through to made-tea manufacturing and sales.

### 0.1 තාක්ෂණික ගෘහ නිර්මාණය / Tech Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  පරිශීලක උපාංගය / User Device                              │
│  ┌──────────────────┐    ┌──────────────────────────────────┐ │
│  │ Android App      │    │ Web PWA (Browser)                │ │
│  │ (React Native +  │    │ (React 19 + Vite + Tailwind v4)  │ │
│  │  Expo + WebView) │    │ ─────────────────────────────────│ │
│  │                  │    │ Offline-first PWA                │ │
│  │ Native bridges:  │    │ Service Worker + IndexedDB       │ │
│  │ • Camera         │    │ Tri-lingual (EN/SI/TA)           │ │
│  │ • GPS geofence   │    │                                  │ │
│  │ • FCM push       │    │                                  │ │
│  │ • Secure storage │    │                                  │ │
│  │ • Background sync│    │                                  │ │
│  └────────┬─────────┘    └──────────────┬───────────────────┘ │
└───────────┼─────────────────────────────┼─────────────────────┘
            │                             │
            ▼                             ▼
┌───────────────────────┐   ┌─────────────────────────────────┐
│  Firebase             │   │  Supabase (PostgreSQL)          │
│  ─────────────────    │   │  ──────────────────────────     │
│  • Authentication     │   │  • All business data            │
│    (Email/Password    │   │  • 25+ tables                   │
│     + Phone OTP)      │   │  • Row-Level Security (RLS)     │
│  • FCM Push           │   │  • Real-time subscriptions      │
│    Notifications      │   │  • REST + GraphQL APIs          │
│                       │   │                                 │
│  (No business data    │   │  (No auth — uses Firebase uid   │
│   stored here)        │   │   via custom JWT claims)        │
└───────────────────────┘   └─────────────────────────────────┘
```

### 0.2 පරිශීලක භූමිකාවන් / User Roles

| Role / භූමිකාව | සිංහල නාමය | Permissions / අවසර |
|-----|------|------|
| **Super Admin** | මහා පරිපාලක | සියල්ල — පරිපාලකයන් නිර්මාණය කිරීම ඇතුළුව / Everything — including creating admins |
| **Admin (Estate Director)** | පරිපාලක (වතු අධ්‍යක්ෂ) | සියලුම ERP මොඩියුල වල සම්පූර්ණ ප්‍රවේශය / Full access to all ERP modules |
| **Extension Officer** | දිගු සේවා නිළධාරී | Suppliers ලියාපදිංචි කිරීම + leaf weighing / Register suppliers + weigh leaf |
| **Supplier (VVIP)** | VVIP සැපයුම්කරු | තමන්ගේම භාරදීම්, ගෙවීම්, දැන්වීම් පමණි / Own deliveries, payments, alerts only |

---

## 1 · මුල සිට ආරම්භ කිරීම / Getting Started from Zero

### 1.1 අවශ්‍ය මෘදුකාංග / Prerequisites

**English:**
- Node.js 18+ (LTS recommended)
- npm 9+ or bun 1.2+
- A Supabase project (free tier is fine for evaluation)
- A Firebase project (free tier)
- An OpenWeatherMap API key (free)
- Git

**සිංහල:**
- Node.js 18+ (LTS නිර්දේශිතයි)
- npm 9+ හෝ bun 1.2+
- Supabase project එකක් (free tier මදි නැත)
- Firebase project එකක් (free tier)
- OpenWeatherMap API key එකක් (නොමිලයි)
- Git

### 1.2 Environment සැකසීම / Environment Setup

**English:**
1. Copy `.env.example` to `.env`
2. Fill in the following values:

```bash
# Supabase (PostgreSQL) — all business data
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-SUPABASE-ANON-KEY

# Firebase — Auth + FCM only (NO business data)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...   # For web push

# Weather (free OpenWeatherMap key)
VITE_OW_API_KEY=...
VITE_OW_LAT=6.9679             # Estate latitude
VITE_OW_LON=80.7618            # Estate longitude

# Optional — leave blank for deterministic mode
VITE_GEMINI_API_KEY=

VITE_APP_NAME=Verda
```

**සිංහල:**
1. `.env.example` file එක copy කරලා `.env` කරන්න
2. පහත values එකතු කරන්න (ඉහත code block එකේ ඇති දේ):

### 1.3 Database සැකසීම / Database Setup

**English — MANDATORY steps:**
1. Open your Supabase Dashboard → **SQL Editor** → New query
2. Paste the contents of `docs/supabase_schema.sql` → Run (base schema)
3. Open `docs/migration_full_crud.sql` → Run (operational tables)
4. Open `docs/migration_workers.sql` → Run (workers table + seed data)
5. Open `docs/seed_factories_and_routes.sql` → Run (factory/estates seed)
6. **Critical:** Open `/home/z/my-project/download/supabase_migration_fix3.sql` → Run (Phase-2 tables: Finance, Payroll, Factory, HR, Procurement)
7. Verify by running:
   ```sql
   select count(*) from gl_accounts;  -- should return 22
   select count(*) from stock_items;  -- should return 8
   ```

If Supabase asks about RLS → pick **"Run without RLS"** (the scripts handle RLS themselves).

**සිංහල — අනිවාර්ය පියවර:**
1. Supabase Dashboard → **SQL Editor** → New query විවෘත කරන්න
2. `docs/supabase_schema.sql` file එකේ අන්තර්ගතය paste කරලා Run කරන්න (base schema)
3. `docs/migration_full_crud.sql` → Run (operational tables)
4. `docs/migration_workers.sql` → Run (workers table + seed data)
5. `docs/seed_factories_and_routes.sql` → Run (factory/estates seed)
6. **අත්‍යවශ්‍ය:** `/home/z/my-project/download/supabase_migration_fix3.sql` → Run (Phase-2 tables: Finance, Payroll, Factory, HR, Procurement)
7. පරීක්ෂා කරන්න:
   ```sql
   select count(*) from gl_accounts;  -- 22 විය යුතුයි
   select count(*) from stock_items;  -- 8 විය යුතුයි
   ```

Supabase RLS ගැන ඇහුවොත් **"Run without RLS"** තෝරන්න (scripts එක්ක RLS handle වෙනවා).

### 1.4 Firebase සැකසීම / Firebase Setup

**English:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Add a Web App → copy the config values into `.env`
4. Enable **Authentication** → Sign-in method → **Email/Password** (and optionally Phone)
5. Generate VAPID key: Project settings → Cloud Messaging → Web configuration → Generate key pair
6. (Optional) Set up a Cloud Function `scheduledSupplierTick` per `functions/index.js`

**සිංහල:**
1. [Firebase Console](https://console.firebase.google.com/) වෙත යන්න
2. නව project එකක් හදන්න (හෝ පවතින එකක් පාවිච්චි කරන්න)
3. Web App එකක් එකතු කරලා config values `.env` එකට දාන්න
4. **Authentication** → Sign-in method → **Email/Password** enable කරන්න (Phone අමතරව)
5. VAPID key එක generate කරන්න: Project settings → Cloud Messaging → Web configuration
6. (අතිරේක) `functions/index.js` අනුව Cloud Function `scheduledSupplierTick` හදන්න

### 1.5 Local Development Server ක්‍රියාත්මක කිරීම / Run Locally

**English:**
```bash
# Install dependencies
cd verda-erp/
npm install

# Start dev server (port 3000)
npm run dev

# Open browser at http://localhost:3000
```

**සිංහල:**
```bash
# Dependencies install කරන්න
cd verda-erp/
npm install

# Dev server ක්‍රියාත්මක කරන්න (port 3000)
npm run dev

# Browser එකේ http://localhost:3000 විවෘත කරන්න
```

### 1.6 Production Build / නිෂ්පාදන Build

**English:**
```bash
# Build single-file PWA (output: dist/index.html)
npm run build

# Preview the production build
npm run preview
```
The build produces a single self-contained `dist/index.html` (~2.7 MB) — all JS, CSS, and fonts inlined. Connects to your live Supabase + Firebase.

**සිංහල:**
```bash
# Single-file PWA build කරන්න (output: dist/index.html)
npm run build

# Production build එක preview කරන්න
npm run preview
```
Build එකෙන් self-contained `dist/index.html` (~2.7 MB) file එකක් ලැබෙනවා — JS, CSS, fonts සියල්ලම එක එකට. Live Supabase + Firebase වලට connect වෙනවා.

---

## 2 · පළමු පිවිසුම සහ පරිශීලක කළමනාකරණය / First Login & User Management

### 2.1 පළමු Admin Account සෑදීම / Creating the First Admin

**English:**
The first user must be created directly in Supabase:

1. Open Supabase Dashboard → **Authentication** → **Users** → **Add user**
2. Enter email + password (e.g. `superadmin@kdu.com` / `Verda@2026`)
3. After the user is created, copy their Firebase UID (shown in Auth → Users)
4. Open Supabase **Table Editor** → `users` table → **Insert row**:
   ```sql
   INSERT INTO users (id, name, email, role, status)
   VALUES ('FIREBASE_UID_HERE', 'Super Admin', 'superadmin@kdu.com', 'super_admin', 'active');
   ```
5. Now log in at the Verda login screen with these credentials.

**සිංහල:**
පළමු user එක Supabase එකේ directly හදන්න ඕනේ:

1. Supabase Dashboard → **Authentication** → **Users** → **Add user** විවෘත කරන්න
2. Email + password දාන්න (උදා. `superadmin@kdu.com` / `Verda@2026`)
3. User එක හැදුණාට පස්සේ Firebase UID එක copy කරගන්න (Auth → Users එකේ පෙන්නනවා)
4. Supabase **Table Editor** → `users` table → **Insert row**:
   ```sql
   INSERT INTO users (id, name, email, role, status)
   VALUES ('FIREBASE_UID_HERE', 'Super Admin', 'superadmin@kdu.com', 'super_admin', 'active');
   ```
5. දැන් Verda login screen එකේ මේ credentials වලින් පිවිසෙන්න.

### 2.2 පරිශීලක කළමනාකරණ මොඩියුලය / User Management Module

**English — Available to: Super Admin, Admin**

After login, navigate to **User Management** module. From here you can:
- **Create user accounts** — provisioned in Firebase Auth + Supabase simultaneously
- **Edit** user details (name, email, role, division)
- **Suspend / reactivate** users
- **Delete** users (removes Supabase profile; Firebase Auth entry must be deleted separately in Firebase Console)

To create a new user:
1. Click **"Add user"**
2. Fill in: Full name, Email, Temporary password (min 6 chars), Role, Estate/Division
3. Click **"Create & provision"**
4. The user can now log in with their email + temporary password

**සිංහල — අවසර: Super Admin, Admin**

Login වුණාට පස්සේ **User Management** මොඩියුලයට යන්න. එතනින්:
- **User accounts හදන්න** — Firebase Auth + Supabase දෙකටම එකවර හැදෙනවා
- **Edit** කරන්න (name, email, role, division)
- **Suspend / reactivate** කරන්න
- **Delete** කරන්න (Supabase profile එක remove වෙනවා; Firebase Auth entry එක වෙනම Firebase Console එකෙන් delete කරන්න ඕනේ)

නව user එකක් හදන්න:
1. **"Add user"** click කරන්න
2. පුරවන්න: Full name, Email, Temporary password (අවම අකුරු 6), Role, Estate/Division
3. **"Create & provision"** click කරන්න
4. User ට දැන් ඔවුන්ගේ email + temporary password එකෙන් login වෙන්න පුළුවන්

---

## 3 · දෛනික මෙහෙයුම් කාර්ය ප්‍රවාහයන් / Daily Operational Workflows

### 3.1 Extension Officer — නව Supplier ලියාපදිංචි කිරීම / Register New Supplier

**English — Workflow:**
1. Login as Extension Officer
2. Open **"Register New Supplier"** module (bottom nav → "Register")
3. Fill in:
   - Full name (e.g. "Sumithra Green Leaf Co.")
   - Email (e.g. `supplier@kdu.com`)
   - Temporary password (min 6 chars)
   - Phone (optional)
   - Factory (mandatory — select from dropdown)
   - Route/Division (optional)
4. Click **"Register Supplier"**
5. The supplier is now created in Firebase Auth + Supabase
6. Tell the supplier their email + temporary password — they can log in immediately

**සිංහල — කාර්ය ප්‍රවාහය:**
1. Extension Officer විදියට login වෙන්න
2. **"Register New Supplier"** මොඩියුලය විවෘත කරන්න (bottom nav → "Register")
3. පුරවන්න:
   - Full name (උදා. "Sumithra Green Leaf Co.")
   - Email (උදා. `supplier@kdu.com`)
   - Temporary password (අවම අකුරු 6)
   - Phone (අතිරේක)
   - Factory (අනිවාර්ය — dropdown එකෙන් තෝරන්න)
   - Route/Division (අතිරේක)
4. **"Register Supplier"** click කරන්න
5. Supplier Firebase Auth + Supabase දෙකේම හැදෙනවා
6. Supplier ට ඔවුන්ගේ email + temporary password කියන්න — ඉක්මනින්ම login වෙන්න පුළුවන්

### 3.2 Extension Officer — කොළ බර ඇතුළත් කිරීම / Leaf Weighing Entry

**English — Workflow:**
1. Open **"Leaf Weighing Entry"** module
2. Select Grade: **Super / Standard / Coarse**
3. Enter Gross weight (kg) — what the supplier brought
4. Adjust Deduction % slider (0–15%) — for water content, foreign matter
5. The **Net weight** is calculated automatically
6. Click **"Save & sync"**
7. The weigh-in is saved to Supabase
8. **A push notification is sent to the linked supplier** ("Weigh-in Recorded 🌿 — 12.5 kg net (Super) recorded at KDU Estate")
9. The supplier's delivery record updates in real-time

**Important:** This works **offline** — if no internet, the weigh-in queues in IndexedDB and syncs automatically when reconnected. Two officers cannot overwrite each other's weigh-ins — each record gets a unique ID, and the system uses version-based optimistic concurrency.

**සිංහල — කාර්ය ප්‍රවාහය:**
1. **"Leaf Weighing Entry"** මොඩියුලය විවෘත කරන්න
2. Grade එක තෝරන්න: **Super / Standard / Coarse**
3. Gross weight (kg) දාන්න — supplier ගෙනාපු බර
4. Deduction % slider එක adjust කරන්න (0–15%) — water content, foreign matter සඳහා
5. **Net weight** එක ස්වයංක්‍රීයව calculate වෙනවා
6. **"Save & sync"** click කරන්න
7. Weigh-in එක Supabase එකට save වෙනවා
8. **Linked supplier ට push notification එකක් යනවා** ("Weigh-in Recorded 🌿 — 12.5 kg net (Super) recorded at KDU Estate")
9. Supplier ගේ delivery record එක real-time එකේ update වෙනවා

**වැදගත්:** මේක **offline** වැඩ කරනවා — internet නැත්නම්, weigh-in එක IndexedDB එකේ queue වෙලා internet ආව ගමන් auto sync වෙනවා. Officer කෙනෙකුට තවත් කෙනෙකුගේ weigh-in එක overwrite කරන්න බැහැ — record එකට unique ID එකක් තියෙනවා, version-based optimistic concurrency පාවිච්චි කරනවා.

### 3.3 Supplier (VVIP) — දෛනික කටයුතු / Daily Workflow

**English:**
When a supplier logs in, they see 7 modules in the bottom navigation:

| Module | What they do here |
|--------|-------------------|
| **My Leaf Deliveries** | View daily net weight + quality grade recorded at collection centers |
| **Smart Alerts Panel** | FCM fertilizer cycle + plucking schedules + pruning advisory |
| **Payment Tracker** | Earnings + payment history for their green-leaf supply |
| **My Farm Activities** | Log fertilizer applications, pruning, self-harvest (feeds back into advisory engine) |
| **Estate Updates** | News + advisories published by admin |
| **Request Resources** | Raise tickets for workers or equipment |
| **(Language Switcher)** | Top-right corner — switch EN / සිංහල / தமிழ் |

**Daily flow:**
1. Wake up → check **Smart Alerts** → see if today is a fertilizer application day
2. Go to the estate → officer weighs their leaf → they see the record in **My Leaf Deliveries**
3. Verify their estate location by tapping **"Verify My Location at Estate"** button (uses GPS)
4. Log any farm activities (fertilizer applied today, pruning done) in **My Farm Activities**
5. Check **Payment Tracker** to see if last week's payment was settled
6. Read **Estate Updates** for admin announcements

**සිංහල:**
Supplier login වුණාම bottom navigation එකේ මොඩියුල 7ක් පෙන්නනවා:

| මොඩියුලය | මෙහි කරන දේ |
|--------|------|
| **මගේ කොළ භාරදීම්** | දෛනික net weight + quality grade බලන්න |
| **විද්‍යුත් දැන්වීම් පුවරුව** | FCM පොහොර චක්‍රය + කොළ නෙළීමේ කාලසටහන් + කප්පාදු උපදේශන |
| **ගෙවීම් ලුහුඬිය** | තමන්ගේ green-leaf supply එකේ ඉපැයීම් + ගෙවීම් ඉතිහාසය |
| **මගේ ගොවිපළ කටයුතු** | පොහොර, කප්පාදු, self-harvest log කරන්න (advisory engine එකට feedback) |
| **වතු යාවත්කාලීන** | Admin එකෙන් publish කරපු පුවත් + උපදේශන |
| **සම්පත් ඉල්ලීම** | ශ්‍රමිකයින් හෝ උපකරණ සඳහා ටිකට් යොමු කරන්න |
| **(භාෂා මාරුකරු)** | ඉහළ දකුණු කෙළවර — EN / සිංහල / தமிழ் මාරු කරන්න |

**දෛනික ප්‍රවාහය:**
1. අවදියා → **Smart Alerts** පරීක්ෂා කරන්න → අද පොහොර යෙදිය යුතු දිනයක්ද බලන්න
2. වත්තට යන්න → officer කොළ බර කරයි → **මගේ කොළ භාරදීම්** වල record එක පෙන්නනවා
3. **"වත්තේ මගේ ස්ථානය තහවුරු කරන්න"** button එක ඔබලා වත්තේ ස්ථානය තහවුරු කරන්න (GPS පාවිච්චි කරයි)
4. අද කළ ගොවිපළ කටයුතු (පොහොර, කප්පාදු) **මගේ ගොවිපළ කටයුතු** වල log කරන්න
5. පසුගිය සතියේ ගෙවීම settle වුණාද බලන්න **ගෙවීම් ලුහුඬිය** එකේ
6. Admin නිවේදන කියවන්න **වතු යාවත්කාලීන** වල

### 3.4 Admin — දෛනික Estate කළමනාකරණය / Daily Estate Management

**English — Admin sees all 20+ modules:**

| Module | Daily use |
|--------|-----------|
| **Estate Dashboard** | Overview KPIs — today's green leaf, attendance, weather |
| **Estate Master** | Manage estates → divisions → fields hierarchy |
| **Labor & HR** | Worker roster, attendance, leave requests, EPF/ETF master |
| **Harvest** | Daily green-leaf intake per field/supplier |
| **Factory Floor** | Track batches through withering → packing → dispatch |
| **Inventory** | Stock on hand, low-stock alerts |
| **Procurement** | Purchase orders, goods-receipt notes (GRN) |
| **Finance** | Journal entries, trial balance, P&L |
| **Payroll** | Generate monthly payroll with EPF/ETF (8%/12%/3%) |
| **Weather** | 7-day forecast, fertilizer timing alerts |
| **Announcements** | Publish news to suppliers |
| **Resource Requests** | Approve/reject supplier requisitions |
| **User Management** | Create/edit/suspend users |
| **Branding & Settings** | Logo, colors, login background |

**සිංහල — Admin ට මොඩියුල 20+ පෙන්නනවා:**

| මොඩියුලය | දෛනික භාවිතය |
|--------|------|
| **වතු උපකරණ පුවරුව** | Overview KPIs — අද එන green leaf, attendance, කාලගුණය |
| **වතු ප්‍රධාන කළමනාකරණය** | Estates → divisions → fields hierarchy කළමනාකරණය |
| **ශ්‍රම සහ HR** | Worker roster, attendance, leave requests, EPF/ETF master |
| **අස්වැන්න** | දෛනික green-leaf intake per field/supplier |
| **කර්මාන්තශාලා බිම** | Batches withering → packing → dispatch දක්වා track කරන්න |
| **තොග** | Stock on hand, low-stock alerts |
| **සැපයුම් කළමනාකරණය** | Purchase orders, goods-receipt notes (GRN) |
| **මූල්‍ය** | Journal entries, trial balance, P&L |
| **වැටුප්** | මාසික payroll EPF/ETF සහිතව (8%/12%/3%) |
| **කාලගුණය** | දින 7ක forecast, පොහොර timing alerts |
| **නිවේදන** | Suppliers ට පුවත් publish කරන්න |
| **සම්පත් ඉල්ලීම්** | Supplier requisitions approve/reject කරන්න |
| **පරිශීලක කළමනාකරණය** | Users හදන්න/edit/suspend කරන්න |
| **නාම සලකුණු සහ සැකසුම්** | Logo, colors, login background |

---

## 4 · මොඩියුල අනුව සවිස්තරාත්මක කාර්ය ප්‍රවාහයන් / Module-by-Module Detailed Workflows

### 4.1 Factory Floor — Batch Tracking / කර්මාන්තශාලා බිම

**English — Full batch lifecycle:**

A "batch" is a quantity of green leaf that goes through 7 manufacturing stages. Each stage logs measurements.

```
Green Leaf In (e.g. 500 kg)
    ↓
1. Withering   — 12-18 hrs, moisture reduced 70% → 55%
    ↓
2. Rolling     — 30 min, breaks leaf cells
    ↓
3. Fermentation — 1-3 hrs, oxidation
    ↓
4. Drying      — 20-30 min @ 90-100°C, moisture → 3%
    ↓
5. Sorting & Grading — separated into BOP/BOPF/PEKOE/Dust
    ↓
6. Packing     — bagged in foil-lined chests
    ↓
7. Dispatched  — shipped to broker/buyer
```

**To create a new batch:**
1. Open **Factory Floor** module → **"New Batch"** tab
2. Enter Batch Code (auto-suggested: `BATCH-YYYYMMDD-NN`)
3. Enter Green Leaf In (kg)
4. Select Grade Code (BOP, BOPF, PEKOE, etc.)
5. Click **"Start Batch (Withering Stage)"**

**To advance a batch to the next stage:**
1. Find the batch in the Active Batches list
2. Click **"Advance to [Next Stage]"**
3. A modal opens — enter:
   - Output Weight (kg) — what came out of this stage
   - Moisture %, Temperature °C, Humidity %
   - (For sorting stage) Grade Code + Grade Name
   - Notes
4. Click **"Advance to [Stage]"**

**Recovery % calculation:**
- When batch reaches "Dispatched", the system computes:
  - `Output kg / Green Leaf In kg × 100%`
- Typical tea recovery: **20-25%** (450 kg green leaf → 100 kg made tea)
- Waste = Green Leaf In − Output (shown automatically)

**සිංහල — සම්පූර්ණ batch lifecycle:**

"Batch" එකක් කියන්නේ නිෂ්පාදන අවස්ථා 7කින් යවන green leaf ප්‍රමාණයක්. සෑම අවස්ථාවකින්ම measurements log වෙනවා.

```
Green Leaf In (උදා. 500 kg)
    ↓
1. Withering   — පැය 12-18, moisture 70% → 55%
    ↓
2. Rolling     — මිනිත්තු 30, leaf cells කඩනවා
    ↓
3. Fermentation — පැය 1-3, oxidation
    ↓
4. Drying      — මිනිත්තු 20-30 @ 90-100°C, moisture → 3%
    ↓
5. Sorting & Grading — BOP/BOPF/PEKOE/Dust වෙන් කරනවා
    ↓
6. Packing     — foil-lined chests වල දානවා
    ↓
7. Dispatched  — broker/buyer ට යවනවා
```

**නව batch එකක් හදන්න:**
1. **Factory Floor** මොඩියුලය → **"New Batch"** tab
2. Batch Code දාන්න (auto-suggested: `BATCH-YYYYMMDD-NN`)
3. Green Leaf In (kg) දාන්න
4. Grade Code තෝරන්න (BOP, BOPF, PEKOE, ආදී)
5. **"Start Batch (Withering Stage)"** click කරන්න

**Batch එක ඊළඟ අවස්ථාවට යවන්න:**
1. Active Batches list එකේ batch එක හොයන්න
2. **"Advance to [Next Stage]"** click කරන්න
3. Modal එකක් විවෘත වෙනවා — පුරවන්න:
   - Output Weight (kg) — මේ අවස්ථාවෙන් ආපු බර
   - Moisture %, Temperature °C, Humidity %
   - (Sorting අවස්ථාවට) Grade Code + Grade Name
   - Notes
4. **"Advance to [Stage]"** click කරන්න

**Recovery % ගණනය කිරීම:**
- Batch එක "Dispatched" වුණාම system එක calculate කරනවා:
  - `Output kg / Green Leaf In kg × 100%`
- සාමාන්‍ය tea recovery: **20-25%** (450 kg green leaf → 100 kg made tea)
- Waste = Green Leaf In − Output (ස්වයංක්‍රීයව පෙන්නනවා)

### 4.2 Finance — Double-Entry Ledger / මූල්‍ය — Double-Entry Ledger

**English — Core concepts:**
- **Chart of Accounts (GL Accounts)**: 22 pre-seeded accounts (Cash, Bank, Inventory, EPF Payable, Tea Sales Revenue, Wages, etc.)
- **Journal Entry**: A balanced transaction — debits = credits (at least 2 lines)
- **Trial Balance**: Sum of all debits/credits per account (posted entries only)
- **P&L**: Revenue − Expenses

**To create a journal entry:**
1. Open **Finance** module → **"New Entry"** tab
2. Enter Entry No (auto-suggested), Date, Description
3. Add lines — select account + debit OR credit
4. **The journal must balance** — Total Debit = Total Credit (shown live)
5. Click **"Create Draft Entry"**
6. The entry is saved as **draft** status
7. Switch to **"Journal Entries"** tab → find your draft → click **"Post"**
8. Posted entries are locked and appear in Trial Balance

**Example — Pay supplier Rs 50,000 for green leaf:**
| Account | Debit | Credit |
|---------|-------|--------|
| Green Leaf Cost (5000) | 50,000 | |
| Cash on Hand (1000) | | 50,000 |

**සිංහල — මූලික සංකල්ප:**
- **Chart of Accounts (GL Accounts)**: Pre-seeded accounts 22ක් (Cash, Bank, Inventory, EPF Payable, Tea Sales Revenue, Wages, ආදී)
- **Journal Entry**: Balanced transaction එකක් — debits = credits (අවම වශයෙන් lines 2ක්)
- **Trial Balance**: සෑම account එකකම debit/credit එකතුව (posted entries විතරයි)
- **P&L**: Revenue − Expenses

**Journal entry එකක් හදන්න:**
1. **Finance** මොඩියලය → **"New Entry"** tab
2. Entry No (auto-suggested), Date, Description දාන්න
3. Lines එකතු කරන්න — account + debit හෝ credit තෝරන්න
4. **Journal එක balance වෙන්න ඕනේ** — Total Debit = Total Credit (live පෙන්නනවා)
5. **"Create Draft Entry"** click කරන්න
6. Entry එක **draft** status එකේ save වෙනවා
7. **"Journal Entries"** tab එකට ගිහින් draft එක හොයන්න → **"Post"** click කරන්න
8. Posted entries lock වෙලා Trial Balance එකේ පෙන්නනවා

**උදාහරණය — Supplier ට රු. 50,000ක් green leaf සඳහා ගෙවීම:**
| Account | Debit | Credit |
|---------|-------|--------|
| Green Leaf Cost (5000) | 50,000 | |
| Cash on Hand (1000) | | 50,000 |

### 4.3 Payroll — EPF/ETF Statutory / වැටුප් — EPF/ETF නීතික

**English — Sri Lankan statutory rates:**
- **EPF Employee deduction**: 8% of gross (deducted from worker's pay)
- **EPF Employer contribution**: 12% of gross (paid by company, in addition)
- **ETF Employer contribution**: 3% of gross (paid by company)

So for a worker earning Rs 50,000 gross:
- Worker gets: 50,000 − 4,000 (EPF 8%) = Rs 46,000 net
- Company pays: 50,000 + 6,000 (EPF 12%) + 1,500 (ETF 3%) = Rs 57,500 total cost
- EPF/ETF remitted monthly to Department of Labour

**To generate a monthly payroll run:**
1. Open **Payroll** module → **"Generate New"** tab
2. Enter Run Code (e.g. `PR-2026-07`), Month, Year
3. Select workers (checkboxes)
4. For each selected worker, enter: Basic salary, OT pay, Allowances, Deductions, Days worked
5. Click **"Generate Run for N worker(s)"**
6. Payslips are computed automatically with EPF/ETF
7. Switch to **"Payroll Runs"** tab → select the new run → click **"Approve Run"**
8. (After physical payments are made) mark as Paid (via Supabase update — UI button coming soon)

**සිංහල — ශ්‍රී ලංකා නීතික rates:**
- **EPF Employee deduction**: gross එකෙන් 8% (worker ගේ වැටුපෙන් අඩු වෙනවා)
- **EPF Employer contribution**: gross එකෙන් 12% (සමාගම අමතරව ගෙවනවා)
- **ETF Employer contribution**: gross එකෙන් 3% (සමාගම ගෙවනවා)

ඒ නිසා රු. 50,000 gross උපයන worker කෙනෙකුට:
- Worker ට ලැබෙන්නේ: 50,000 − 4,000 (EPF 8%) = රු. 46,000 net
- සමාගම ගෙවන්නේ: 50,000 + 6,000 (EPF 12%) + 1,500 (ETF 3%) = රු. 57,500 මුළු වියදම
- EPF/ETF දෙකම මාසිකව Department of Labour ට යවනවා

**මාසික payroll run එකක් generate කරන්න:**
1. **Payroll** මොඩියුලය → **"Generate New"** tab
2. Run Code (උදා. `PR-2026-07`), Month, Year දාන්න
3. Workers තෝරන්න (checkboxes)
4. සෑම selected worker ටම දාන්න: Basic salary, OT pay, Allowances, Deductions, Days worked
5. **"Generate Run for N worker(s)"** click කරන්න
6. Payslips EPF/ETF සහිතව ස්වයංක්‍රීයව calculate වෙනවා
7. **"Payroll Runs"** tab එකට ගිහින් නව run එක තෝරන්න → **"Approve Run"** click කරන්න
8. (භෞතික ගෙවීම් වලින් පස්සේ) Paid ලෙස mark කරන්න (Supabase update එකෙන් — UI button එක ඉක්මනින් එයි)

### 4.4 Inventory & Procurement / තොග සහ සැපයුම්

**English — Three sub-workflows:**

**A) Add stock items (master data):**
1. Inventory module → "Stock Items" tab → "Add Stock Item" form
2. Code (e.g. `FERT-UREA`), Name (e.g. "Urea (46% N)"), Category, Unit
3. Click "Add"

**B) Create a Purchase Order (PO):**
1. "Purchase Orders" tab → "Create Purchase Order"
2. Enter Supplier Name (e.g. "CIC Fertilizers Ltd")
3. Add lines — select stock item + qty + unit cost
4. Click "Create PO" — status = draft

**C) Receive goods (GRN):**
1. "Receive Goods (GRN)" tab
2. Select the PO you want to receive against (lines auto-fill)
3. Verify qty received + unit cost per line
4. Enter Supplier Invoice No
5. Click "Receive & Update Stock"
6. **Stock on hand is updated** using moving-average cost valuation
7. A stock movement audit log entry is created automatically

**D) Issue stock (e.g. fertilizer applied to field):**
1. "Issue / Movements" tab
2. Select item, enter qty, enter notes (e.g. "Applied to Field S-01")
3. Click "Issue Out"
4. Stock on hand is reduced, movement logged

**සිංහල — උප-කාර්ය ප්‍රවාහයන් තුනක්:**

**A) Stock items එකතු කිරීම (master data):**
1. Inventory මොඩියුලය → "Stock Items" tab → "Add Stock Item" form
2. Code (උදා. `FERT-UREA`), Name (උදා. "Urea (46% N)"), Category, Unit
3. "Add" click කරන්න

**B) Purchase Order (PO) එකක් හදන්න:**
1. "Purchase Orders" tab → "Create Purchase Order"
2. Supplier Name දාන්න (උදා. "CIC Fertilizers Ltd")
3. Lines එකතු කරන්න — stock item + qty + unit cost තෝරන්න
4. "Create PO" click කරන්න — status = draft

**C) සපයුම් ලැබෙන විට (GRN):**
1. "Receive Goods (GRN)" tab
2. Receive කරන්න ඕනේ PO එක තෝරන්න (lines auto-fill වෙනවා)
3. සෑම line එකකටම qty received + unit cost පරීක්ෂා කරන්න
4. Supplier Invoice No දාන්න
5. "Receive & Update Stock" click කරන්න
6. **Stock on hand moving-average cost valuation එකෙන් update වෙනවා**
7. Stock movement audit log entry එක ස්වයංක්‍රීයව හැදෙනවා

**D) Stock issue කිරීම (උදා. පොහොර ක්ෂේත්‍රයට යෙදීම):**
1. "Issue / Movements" tab
2. Item තෝරන්න, qty දාන්න, notes දාන්න (උදා. "Applied to Field S-01")
3. "Issue Out" click කරන්න
4. Stock on hand අඩු වෙනවා, movement log වෙනවා

### 4.5 Labor & HR — Leave Workflow / ශ්‍රම සහ HR — Leave කාර්ය ප්‍රවාහය

**English:**
1. Worker requests leave → admin opens **Labor** module → **"Leave Requests"** tab
2. Or admin submits on behalf of worker:
   - Select Worker
   - Leave Type: Annual / Sick / Casual / Maternity / Nopay
   - Start date, End date
   - Reason
   - Click "Submit Request"
3. Pending requests appear at the top
4. Admin clicks **"Approve"** or **"Reject"**
5. Worker's leave balance is updated (for approved requests — UI coming; for now computed in app)

**Worker HR master data** (visible in roster detail):
- EPF Number, ETF Number
- Hire Date, Date of Birth
- Bank Name, Bank Branch, Bank Account
- Basic Salary
- Skill Matrix (e.g. { plucker: 5, sprayer: 3 })
- Leave Balance { annual: 14, sick: 7, casual: 3 }

**සිංහල:**
1. Worker leave ඉල්ලයි → admin **Labor** මොඩියුලය → **"Leave Requests"** tab විවෘත කරයි
2. හෝ admin worker වෙනුවෙන් submit කරයි:
   - Worker තෝරන්න
   - Leave Type: Annual / Sick / Casual / Maternity / Nopay
   - Start date, End date
   - Reason
   - "Submit Request" click කරන්න
3. Pending requests ඉහළින් පෙන්නනවා
4. Admin **"Approve"** හෝ **"Reject"** click කරයි
5. Worker ගේ leave balance එක update වෙනවා (approved requests සඳහා — UI එකේ; දැනට app එකේ compute වෙනවා)

**Worker HR master data** (roster detail එකේ පෙන්නනවා):
- EPF Number, ETF Number
- Hire Date, Date of Birth
- Bank Name, Bank Branch, Bank Account
- Basic Salary
- Skill Matrix (උදා. { plucker: 5, sprayer: 3 })
- Leave Balance { annual: 14, sick: 7, casual: 3 }

### 4.6 Smart Advisory Engine (Auto-Computed) / බුද්ධිමය උපදේශන එන්ජිමය

**English — How it works:**
The "AI" in this system is **deterministic rules** (not ML). It runs entirely client-side + server-side Cloud Function — no external AI calls (Gemini API key is optional and blank by default).

**Three advisory engines:**

**1. Fertilizer Window (Weather-based)**
- Reads: last fertilizer application date, soil moisture, 7-day forecast
- Computes: optimal application window based on rain forecast (apply before rain, not during)
- Output: "Apply by [date]" or "Hold — heavy rain expected"

**2. Pruning Cycle (Plant-age based)**
- Reads: plantation date (entered by supplier)
- Computes: tea plant age → current cycle (formative / light / medium / deep / skiffing)
- Output: "Next pruning window: [date]" + "Peak Yield Phase" if applicable

**3. Plucking Schedule (Weather + Field status)**
- Reads: field status (plucking/pruned/young/nursery), 7-day forecast
- Computes: which fields should be plucked today, tomorrow
- Output: list of fields with reasons

**Closed-loop feedback:**
When a supplier logs a new activity in **My Farm Activities** (fertilizer applied, pruning done, self-harvest), the advisory engines automatically recompute using the new data. This is the "feedback loop" mentioned in the UI.

**සිංහල — ක්‍රියාත්මක වන ආකාරය:**
මේ system එකේ "AI" එක **deterministic rules** (ML නෙවෙයි). සම්පූර්ණයෙන්ම client-side + server-side Cloud Function එකේ run වෙනවා — external AI calls නැහැ (Gemini API key අතිරේක වශයෙන් blank වෙනවා).

**Advisory engines තුනක්:**

**1. පොහොර කවචය (කාලගුණ මත)**
- කියවනවා: අවසන් පොහොර යෙදු දිනය, soil moisture, දින 7ක forecast
- ගණනය කරනවා: rain forecast මත පදනම්ව optimal application window (වැසි පෙර යොදන්න, වැසි අතර නෙවෙයි)
- Output: "[date] වන විට යොදන්න" හෝ "රැඳී සිටින්න — බර වැසි අපේක්ෂිතයි"

**2. කප්පාදු චක්‍රය (ශාක වයස මත)**
- කියවනවා: plantation date (supplier දාපු)
- ගණනය කරනවා: තේ ශාකයේ වයස → current cycle (formative / light / medium / deep / skiffing)
- Output: "ඊළඟ කප්පාදු කවචය: [date]" + "Peak Yield Phase" නම්

**3. කොළ නෙළීමේ කාලසටහන (කාලගුණ + Field status)**
- කියවනවා: field status (plucking/pruned/young/nursery), දින 7ක forecast
- ගණනය කරනවා: අද, හෙට නෙළිය යුතු fields මොනවද
- Output: reasons සහි fields list එක

**Closed-loop feedback:**
Supplier කෙනෙක් **මගේ ගොවිපළ කටයුතු** වල නව activity එකක් log කරද්දී (පොහොර යෙදුවා, කප්පාදු කළා, self-harvest), advisory engines නව data පාවිච්චි කරලා ස්වයංක්‍රීයව recompute කරනවා. මේක UI එකේ සඳහන් "feedback loop" එකයි.

---

## 5 · Android App Build / Android App Build කිරීම

### 5.1 Prerequisites

**English:**
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Expo account (free)
- Android device or emulator for testing
- (For Play Store) Google Play Developer account ($25 one-time)

**සිංහල:**
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Expo account (නොමිලයි)
- පරීක්ෂා කිරීමට Android device හෝ emulator
- (Play Store සඳහා) Google Play Developer account ($25 one-time)

### 5.2 Setup app/.env

**English:**
```bash
cd app/
cp .env.example .env
# Fill in same Supabase + Firebase + OpenWeather values as the web .env
# Plus:
EXPO_PUBLIC_WEB_URL=https://your-tea-erp.vercel.app  # URL of deployed PWA
EAS_PROJECT_ID=your-eas-project-id                    # From expo.dev
```

**සිංහල:**
```bash
cd app/
cp .env.example .env
# Web .env එකේ ඇති Supabase + Firebase + OpenWeather values මේකටත් දාන්න
# අමතරව:
EXPO_PUBLIC_WEB_URL=https://your-tea-erp.vercel.app  # Deployed PWA එකේ URL
EAS_PROJECT_ID=your-eas-project-id                    # expo.dev එකෙන්
```

### 5.3 Install dependencies + prebuild

**English:**
```bash
cd app/
npm install
npx expo prebuild --clean    # Generates native android/ and ios/ folders
```

**සිංහල:**
```bash
cd app/
npm install
npx expo prebuild --clean    # native android/ සහ ios/ folders හදනවා
```

### 5.4 Build APK (for testing) / AAB (for Play Store)

**English:**
```bash
# APK for direct installation on devices (testing)
npm run build:apk
# → Outputs a downloadable .apk from EAS Build dashboard

# AAB for Google Play Store
npm run build:aab
# → Upload to Play Console
```

**සිංහල:**
```bash
# APK — devices එකේ direct install කරන්න (testing)
npm run build:apk
# → EAS Build dashboard එකෙන් downloadable .apk එකක් ලැබෙනවා

# AAB — Google Play Store සඳහා
npm run build:aab
# → Play Console එකට upload කරන්න
```

### 5.5 Native Bridges (Already Wired)

**English — The Android app has these native bridges (in `app/src/native/`):**

| Bridge | Purpose |
|--------|---------|
| `Camera.ts` | Capture receipt photos offline, save to device storage |
| `Location.ts` | Foreground GPS + background geofence (verify supplier at estate) |
| `SecureStorage.ts` | Encrypted credential vault (Firebase refresh token persists across app restarts) |
| `Notifications.ts` | Native FCM push notifications (not web push) |
| `BackgroundSync.ts` | Replays IndexedDB write queue every 15 min when app is closed |
| `index.ts` | Unified WebView bridge handler |

The PWA inside the WebView calls these via:
```js
window.ReactNativeWebView?.postMessage(JSON.stringify({
  id: "req-1",
  type: "captureReceipt",
  payload: { ... }
}));
```

**සිංහල — Android app එකේ native bridges මේවා (`app/src/native/` එකේ):**

| Bridge | අරමුණ |
|--------|------|
| `Camera.ts` | Receipt photos offline ගහන්න, device storage එකට save කරන්න |
| `Location.ts` | Foreground GPS + background geofence (supplier වත්තේ දැයි තහවුරු කරන්න) |
| `SecureStorage.ts` | Encrypted credential vault (Firebase refresh token app restart වලින් පවතිනවා) |
| `Notifications.ts` | Native FCM push notifications (web push නෙවෙයි) |
| `BackgroundSync.ts` | App එක close වෙලා ඉන්නකොට සෑම මිනිත්තු 15කට වරක් IndexedDB write queue replay කරනවා |
| `index.ts` | Unified WebView bridge handler |

PWA එක WebView එක ඇතුළෙන් මේවා මෙහෙයවන්නේ:
```js
window.ReactNativeWebView?.postMessage(JSON.stringify({
  id: "req-1",
  type: "captureReceipt",
  payload: { ... }
}));
```

---

## 6 · Offline-First Behavior / Offline හැසිරීම

**English — How offline works:**

| Action | Online | Offline |
|--------|--------|---------|
| View data | Live from Supabase | Cached from last sync (IndexedDB) |
| Weigh leaf | Save + sync immediately | Queue in IndexedDB, sync when reconnected |
| Log farm activity | Save + sync immediately | Queue, sync later |
| Push notifications | FCM delivered instantly | Stored, delivered on reconnect |
| Smart Advisory | Uses latest weather forecast | Uses last cached forecast |

**Conflict resolution:**
- Every transactional table has a `version` column (integer)
- When you update a record, the WHERE clause includes `version = expected_value`
- If 0 rows update → another user modified it → conflict detected
- The system refetches the current row and shows a conflict message
- The user can retry with the latest version

**සිංහල — Offline ක්‍රියාත්මක වන ආකාරය:**

| ක්‍රියාව | Online | Offline |
|--------|--------|---------|
| Data බැලීම | Supabase එකෙන් live | Last sync එකේ cached (IndexedDB) |
| කොළ බර | Save + sync වහාම | IndexedDB එකේ queue කරනවා, internet ආව ගමන් sync |
| Farm activity log | Save + sync වහාම | Queue, පස්සේ sync |
| Push notifications | FCM වහාම ලැබෙනවා | Store කරනවා, internet ආව ගමන් ලැබෙනවා |
| Smart Advisory | අලුත්ම weather forecast | Last cached forecast |

**Conflict resolution:**
- සෑම transactional table එකටම `version` column එකක් තියෙනවා (integer)
- Record එකක් update කරද්දී WHERE clause එකේ `version = expected_value` එකතු වෙනවා
- 0 rows update වුණොත් → වෙන කෙනෙක් modify කරලා → conflict detect වෙනවා
- System එක current row එක refetch කරලා conflict message එක පෙන්නනවා
- User ට අලුත්ම version එකෙන් retry කරන්න පුළුවන්

---

## 7 · Tri-Lingual Language Switching / ත්‍රි-භාෂා මාරු කිරීම

**English:**
- Top-right corner of every screen has a **Language** button (globe icon)
- Click to open the dropdown: 🇬🇧 English / 🇱🇰 සිංහල / 🇮🇳 தமிழ்
- Choice persists in `localStorage` — survives page refresh
- `<html lang>` attribute updates for accessibility / font shaping
- **Mobile-side modules** (Supplier Portal, Extension Officer, Farm Activities, Login) are fully translated
- **Admin-side modules** (Dashboard, Estate Master, Finance, Payroll, etc.) are currently English-only — translation is a future task

**සිංහල:**
- සෑම screen එකකම ඉහළ දකුණු කෙළවරේ **Language** button එකක් තියෙනවා (globe icon)
- Click කරලා dropdown එක විවෘත වෙනවා: 🇬🇧 English / 🇱🇰 සිංහල / 🇮🇳 தமிழ்
- තේරීම `localStorage` එකේ save වෙනවා — page refresh වලින් පවතිනවා
- `<html lang>` attribute එක accessibility / font shaping සඳහා update වෙනවා
- **Mobile-side මොඩියුල** (Supplier Portal, Extension Officer, Farm Activities, Login) සම්පූර්ණයෙන්ම translate වෙලා
- **Admin-side මොඩියුල** (Dashboard, Estate Master, Finance, Payroll, ආදී) දැනට English විතරයි — translation අනාගත කාර්යයක්

---

## 8 · Branding & White-Label / නාම සලකුණු

**English:**
Admin can customize branding via **Branding & Settings** module:
- **App name** (e.g. "Verda ERP" → "KDU ERP")
- **Company name** (shown in headers, footers)
- **Logo** (URL — shown in sidebar + login screen)
- **Login background** (image or video URL)
- **Accent color** (hex — buttons, links, highlights)

Settings are stored in Supabase `settings` table (key='branding') and apply instantly across the app.

**සිංහල:**
Admin විසින් **Branding & Settings** මොඩියුලය හරහා branding customize කරන්න පුළුවන්:
- **App name** (උදා. "Verda ERP" → "KDU ERP")
- **Company name** (headers, footers වල පෙන්නනවා)
- **Logo** (URL — sidebar + login screen එකේ පෙන්නනවා)
- **Login background** (image හෝ video URL)
- **Accent color** (hex — buttons, links, highlights)

Settings Supabase `settings` table එකේ (key='branding') store වෙනවා සහ app එක පුරා වහාම apply වෙනවා.

---

## 9 · Troubleshooting / ගැටලු විසඳීම

### 9.1 Login fails / Login අසාර්ථකයි

**English:**
| Symptom | Fix |
|---------|-----|
| "Login failed" | Check `.env` Firebase values are correct |
| Email not found | User not created in Firebase Auth — create via User Management module |
| User can login but sees nothing | User not in Supabase `users` table — insert row manually (see §2.1) |
| Role is wrong | Update `users.role` in Supabase Table Editor |

**සිංහල:**
| ලක්ෂණය | විසඳුම |
|---------|------|
| "Login failed" | `.env` Firebase values හරිද බලන්න |
| Email හමු නොවේ | User Firebase Auth එකේ නෑ — User Management මොඩියුලයෙන් හදන්න |
| Login වෙනවා ඒත් කිසිවක් පේන්නේ නෑ | User Supabase `users` table එකේ නෑ — manually row එකක් insert කරන්න (§2.1 බලන්න) |
| Role වැරදියි | Supabase Table Editor එකේ `users.role` update කරන්න |

### 9.2 Supabase connection error / Supabase connection දෝෂයක්

**English:**
- Open browser DevTools (F12) → Console
- Look for `[Supabase]` messages
- "✓ connected" = working
- "⚠ reachable but REST returned 401" = anon key is wrong
- "connection check failed" = URL is wrong or network blocked

**සිංහල:**
- Browser DevTools (F12) → Console විවෘත කරන්න
- `[Supabase]` messages බලන්න
- "✓ connected" = වැඩ කරනවා
- "⚠ reachable but REST returned 401" = anon key වැරදියි
- "connection check failed" = URL වැරදියි හෝ network block කරලා

### 9.3 Push notifications not arriving / Push notifications එන්නේ නෑ

**English:**
1. Check FCM VAPID key is set in `.env` (`VITE_FIREBASE_VAPID_KEY`)
2. Browser must allow notifications for the site
3. iOS Safari requires the PWA to be installed to home screen first
4. On Android native app, the FCM token is registered automatically on first launch
5. Check Supabase `users.fcm_token` is populated (run: `select id, fcm_token from users;`)

**සිංහල:**
1. FCM VAPID key `.env` එකේ set වෙලාද බලන්න (`VITE_FIREBASE_VAPID_KEY`)
2. Browser එක site එකට notifications allow කරලාද බලන්න
3. iOS Safari එකේ PWA එක home screen එකට install කරලා තියෙන්න ඕනේ
4. Android native app එකේ FCM token එක first launch එකේදී ස්වයංක්‍රීයව register වෙනවා
5. Supabase `users.fcm_token` populate වෙලාද බලන්න (run: `select id, fcm_token from users;`)

### 9.4 Build errors / Build දෝෂ

**English:**
| Error | Fix |
|-------|-----|
| `vite: not found` | Run `npm install` in `verda-erp/` |
| `Port 3000 already in use` | Kill existing process: `pkill -f "npm run dev"` |
| TypeScript errors | Run `npx tsc --noEmit` to see all type errors |
| Module not found | Check `tsconfig.json` paths config + import paths use `@/` alias |

**සිංහල:**
| දෝෂය | විසඳුම |
|-------|------|
| `vite: not found` | `verda-erp/` එකේ `npm install` run කරන්න |
| `Port 3000 already in use` | Existing process kill කරන්න: `pkill -f "npm run dev"` |
| TypeScript දෝෂ | `npx tsc --noEmit` run කරලා සියලුම type දෝෂ බලන්න |
| Module not found | `tsconfig.json` paths config + import paths `@/` alias පාවිච්චි කරනවද බලන්න |

### 9.5 SQL migration errors / SQL migration දෝෂ

**English:**
If you get `column "estate_id" does not exist`:
1. Run `/home/z/my-project/download/supabase_migration_fix3.sql` — it drops all phase-2 tables and recreates them cleanly
2. Verify: `select count(*) from gl_accounts;` → should return 22

If you get `relation "X" already exists`:
- Safe to ignore — `IF NOT EXISTS` clause means the table is already there
- The script continues

**සිංහල:**
`column "estate_id" does not exist` ආවොත්:
1. `/home/z/my-project/download/supabase_migration_fix3.sql` run කරන්න — එක phase-2 tables සියල්ලම drop කරලා clean එකක් අරින්න recreate කරනවා
2. Verify කරන්න: `select count(*) from gl_accounts;` → 22 විය යුතුයි

`relation "X" already exists` ආවොත්:
- Ignore කරන්න — `IF NOT EXISTS` clause එකෙන් table එක දැනටමත් තියෙන බව කියනවා
- Script එක ඉදිරියට යනවා

---

## 10 · Daily / Monthly / Annual Checklists / දෛනික මාසික වාර්ෂික පරීක්ෂක ලැයිස්තු

### Daily / දෛනික

**English:**
- [ ] Login as Admin → check Estate Dashboard for today's KPIs
- [ ] Extension Officers weigh all supplier deliveries (offline-first, syncs auto)
- [ ] Check **Resource Requests** module — approve/reject pending supplier requisitions
- [ ] Check **Labor** module → Leave Requests tab — approve/reject pending leave
- [ ] Check **Inventory** — any item below reorder level? Raise PO if needed
- [ ] Open **Factory Floor** — advance any batches that completed a stage overnight

**සිංහල:**
- [ ] Admin විදියට login වෙන්න → අද KPIs සඳහා Estate Dashboard බලන්න
- [ ] Extension Officers supplier භාරදීම් සියල්ල බර කරන්න (offline-first, auto sync වෙනවා)
- [ ] **Resource Requests** මොඩියුලය පරීක්ෂා කරන්න — pending supplier requisitions approve/reject කරන්න
- [ ] **Labor** මොඩියුලය → Leave Requests tab — pending leave approve/reject කරන්න
- [ ] **Inventory** පරීක්ෂා කරන්න — reorder level එකට පහළ කිසිවක් තියෙනවද? ඕනෙනම් PO යවන්න
- [ ] **Factory Floor** විවෘත කරන්න — රාත්‍රියේ අවස්ථාවක් අවසන් කළ batches ඊළඟ අවස්ථාවට යවන්න

### Monthly / මාසික

**English:**
- [ ] **Payroll** module → Generate run for current month → select all workers → verify → approve
- [ ] Submit EPF/ETF returns to Department of Labour (use Payslips totals)
- [ ] **Finance** → post all draft journal entries → run Trial Balance → verify debits = credits
- [ ] **Inventory** → physical stock count → adjust discrepancies via "Issue / Movements" tab (adjust type)
- [ ] **Supplier Invoices** → generate invoices for all suppliers based on their deliveries
- [ ] **Announcements** → publish monthly estate update for suppliers

**සිංහල:**
- [ ] **Payroll** මොඩියුලය → මේ මාසයට run එක generate කරන්න → workers සියල්ල තෝරන්න → verify → approve
- [ ] EPF/ETF returns Department of Labour ට යවන්න (Payslips totals පාවිච්චි කරන්න)
- [ ] **Finance** → draft journal entries සියල්ල post කරන්න → Trial Balance run කරන්න → debits = credits දැයි verify
- [ ] **Inventory** → භෞතික stock count → "Issue / Movements" tab එකෙන් discrepancies adjust කරන්න (adjust type)
- [ ] **Supplier Invoices** → suppliers ගේ භාරදීම් අනුව invoices generate කරන්න
- [ ] **Announcements** → suppliers සඳහා මාසික වතු යාවත්කාලීනයක් publish කරන්න

### Annual / වාර්ෂික

**English:**
- [ ] Generate annual P&L report (Finance → Trial Balance → sum revenue and expense accounts)
- [ ] File annual returns with Sri Lanka Tea Board
- [ ] EPF/ETF annual reconciliation
- [ ] Worker performance review (use Loyalty Points + attendance data)
- [ ] Backup Supabase database (Settings → Database → Backup)
- [ ] Update leave balances for new year (workers table `leave_balance` JSON)

**සිංහල:**
- [ ] වාර්ෂික P&L report එකක් generate කරන්න (Finance → Trial Balance → revenue සහ expense accounts එකතු කරන්න)
- [ ] ශ්‍රී ලංකා Tea Board එකට වාර්ෂික returns ගහන්න
- [ ] EPF/ETF වාර්ෂික reconciliation
- [ ] Worker performance review (Loyalty Points + attendance data පාවිච්චි කරන්න)
- [ ] Supabase database backup කරන්න (Settings → Database → Backup)
- [ ] අලුත් වසරට leave balances update කරන්න (workers table `leave_balance` JSON)

---

## 11 · File Structure Quick Reference / File ව්‍යුහය ඉක්මන් යොමුව

```
verda-erp/
├── .env                          # Environment variables (Supabase, Firebase, OW, etc.)
├── .env.example                  # Template
├── index.html                    # PWA shell
├── package.json                  # Web app dependencies
├── vite.config.ts                # Vite config (Tailwind v4 + single-file plugin)
├── tsconfig.json                 # TypeScript config
├── docs/                         # All documentation (YOU ARE HERE)
│   ├── supabase_schema.sql       # Base schema
│   ├── migration_full_crud.sql   # Operational tables
│   ├── migration_workers.sql     # Workers + seed
│   ├── seed_factories_and_routes.sql
│   ├── FIRESTORE_SCHEMA.md       # Legacy — Supabase replaced Firestore
│   ├── DEPLOYMENT.md
│   ├── GETTING_STARTED.md
│   ├── HYBRID_MIGRATION.md
│   └── WORKFLOW_GUIDE.md         # ← This document
├── public/
│   ├── manifest.json             # PWA manifest
│   └── sw.ts                     # Service worker
├── src/
│   ├── main.tsx                  # React entry
│   ├── App.tsx                   # Provider + Shell + module router
│   ├── index.css                 # Tailwind theme
│   ├── context/
│   │   └── AppContext.tsx        # Global state (role, online, sync queue)
│   ├── lib/
│   │   ├── data.ts               # Domain models + types + mock seed
│   │   ├── repo.ts               # CRUD layer (Phase 1)
│   │   ├── repo.phase2.ts        # CRUD layer (Phase 2 — Finance/Payroll/Factory/HR/Procurement)
│   │   ├── auth.hybrid.ts        # Firebase Auth + Supabase session bridge
│   │   ├── firebase.ts           # Firebase init
│   │   ├── supabase.ts           # Supabase init
│   │   ├── identity.ts           # RBAC guards
│   │   ├── rbac.ts               # Role-based access control
│   │   ├── predictive.ts         # Smart Advisory engines
│   │   ├── weather.ts            # OpenWeatherMap integration
│   │   ├── notifications.ts      # In-app notifications
│   │   ├── fcm.ts                # Web push FCM
│   │   ├── pdfExport.ts          # PDF generation (jsPDF)
│   │   ├── branding.tsx          # White-label branding context
│   │   └── useLiveData.ts        # Real-time Supabase subscription hook
│   ├── components/
│   │   ├── ui.tsx                # Card, Panel, Badge, StatCard, DataTable, etc.
│   │   ├── Shell.tsx             # Adaptive shell (admin desktop / mobile)
│   │   ├── Login.tsx
│   │   ├── LanguageSwitcher.tsx
│   │   ├── LocationCheckIn.tsx   # GPS verification
│   │   ├── PruningAdvisory.tsx   # Pruning recommendation card
│   │   ├── CrudPanel.tsx         # Generic CRUD scaffold
│   │   ├── RouteGuard.tsx        # Per-module RBAC guard
│   │   ├── Toaster.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── EstateMap.tsx
│   │   ├── CaptureButton.tsx
│   │   ├── charts.tsx
│   │   ├── Icon.tsx
│   │   └── QR.tsx
│   ├── modules/
│   │   ├── Dashboard.tsx
│   │   ├── EstateMaster.tsx
│   │   ├── Labor.tsx             # Roster + HR + Leave (Phase 2 enhanced)
│   │   ├── Payroll.tsx           # EPF/ETF payroll (Phase 2)
│   │   ├── Finance.tsx           # Double-entry ledger (Phase 2)
│   │   ├── Factory.tsx           # Batch tracking (Phase 2)
│   │   ├── Inventory.tsx         # Stock + PO + GRN (Phase 2)
│   │   ├── Harvest.tsx
│   │   ├── Weather.tsx
│   │   ├── SupplierPortal.tsx    # VVIP supplier mobile portal
│   │   ├── SupplierRequest.tsx
│   │   ├── SupplierAnnouncements.tsx
│   │   ├── ExtensionOfficer.tsx  # Register + Weighing
│   │   ├── FarmActivities.tsx
│   │   ├── MobileOffline.tsx
│   │   ├── UserManagement.tsx
│   │   ├── Settings.tsx
│   │   ├── Announcements.tsx
│   │   ├── ResourceRequests.tsx
│   │   ├── Architecture.tsx
│   │   ├── AuditCompliance.tsx
│   │   ├── AiAnalytics.tsx
│   │   ├── Crop.tsx
│   │   ├── GisMap.tsx
│   │   ├── Vehicles.tsx
│   │   ├── Loans.tsx
│   │   ├── Loyalty.tsx
│   │   ├── Welfare.tsx
│   │   ├── Fertilizer.tsx
│   │   ├── Agrochemical.tsx
│   │   └── registry.ts           # Module registry
│   ├── i18n/
│   │   ├── index.ts              # i18next config
│   │   ├── modules.ts            # Helpers for module labels
│   │   └── locales/
│   │       ├── en.json           # English (400 keys)
│   │       ├── si.json           # Sinhala (400 keys)
│   │       └── ta.json           # Tamil (400 keys)
│   └── utils/
│       └── cn.ts                 # Tailwind class merge helper
├── app/                          # Android / iOS native shell (React Native + Expo)
│   ├── App.tsx                   # Native entry — WebView wrapper
│   ├── app.config.js             # Expo config + plugins
│   ├── package.json              # Native dependencies
│   ├── google-services.json      # FCM config (Android)
│   └── src/
│       ├── native/               # Native bridges (Phase 2)
│       │   ├── Camera.ts         # expo-camera + image-picker
│       │   ├── Location.ts       # expo-location + geofence
│       │   ├── SecureStorage.ts  # expo-secure-store
│       │   ├── Notifications.ts  # expo-notifications (FCM)
│       │   ├── BackgroundSync.ts # expo-background-fetch + task-manager
│       │   └── index.ts          # Unified bridge handler
│       ├── components/
│       ├── hooks/
│       ├── background/
│       ├── notifications/
│       ├── screens/
│       ├── i18n/
│       └── config.ts
├── functions/                    # Cloud Functions (FCM scheduledSupplierTick)
│   └── index.js
├── firestore.rules               # Legacy — Supabase RLS replaced
└── README.md
```

---

## 12 · Quick Command Reference / ඉක්මන් විධාන යොමුව

```bash
# ─── Web App ─────────────────────────────────────────────────────
cd verda-erp/
npm install                    # Install dependencies
npm run dev                    # Start dev server (port 3000)
npm run build                  # Production build → dist/index.html
npm run preview                # Preview production build

# ─── Android App ─────────────────────────────────────────────────
cd app/
npm install                    # Install native dependencies
npx expo prebuild --clean      # Generate native ios/ and android/ folders
npm run build:apk              # Build .apk (testing)
npm run build:aab              # Build .aab (Play Store)

# ─── Database ────────────────────────────────────────────────────
# Run these in Supabase SQL Editor (in order):
# 1. docs/supabase_schema.sql
# 2. docs/migration_full_crud.sql
# 3. docs/migration_workers.sql
# 4. docs/seed_factories_and_routes.sql
# 5. /home/z/my-project/download/supabase_migration_fix3.sql  (Phase 2)

# ─── Verification Queries ────────────────────────────────────────
select count(*) from gl_accounts;     -- should return 22
select count(*) from stock_items;     -- should return 8
select count(*) from users;           -- count of provisioned users
select id, name, email, role from users;  -- user directory
```

---

## 13 · Contact & Handover Notes / සම්බන්ධතා සහ භාරදීම සටහන්

**English:**
- This document is the **canonical workflow guide** for Verda ERP
- For technical architecture details, see `SYSTEM_ARCHITECTURE_AND_WORKFLOW.md`
- For deployment instructions, see `docs/DEPLOYMENT.md`
- For Firestore migration history, see `docs/HYBRID_MIGRATION.md`
- The system is currently at **~85% ERP completeness** (see assessment conversation)
- Outstanding items: admin-side i18n (11 modules English-only), Welfare/Loyalty/Vehicles stubs, automated tests, security hardening

**සිංහල:**
- මේ ලේඛනය Verda ERP සඳහා **canonical workflow guide** එකයි
- තාක්ෂණික architecture විස්තර සඳහා `SYSTEM_ARCHITECTURE_AND_WORKFLOW.md` බලන්න
- Deployment උපදෙස් සඳහා `docs/DEPLOYMENT.md` බලන්න
- Firestore migration ඉතිහාසය සඳහා `docs/HYBRID_MIGRATION.md` බලන්න
- System එක දැනට **~85% ERP completeness** එකේ තියෙනවා
- ඉතුරු වැඩ: admin-side i18n (මොඩියුල 11ක් English විතරයි), Welfare/Loyalty/Vehicles stubs, automated tests, security hardening

---

**Document version: 1.0 · ලේඛනයේ වෙළුම: 1.0**
**Last updated: 2026-07-13 · අවසන් යාවත්කාලීනය: 2026-07-13**
