# 🍃 KDU ERP — System Architecture & End-to-End Workflow Master Blueprint
### Integrated Tea Estate Enterprise ERP Platform — Complete Reference Document
### අනුක්‍රමික තේ වතු සමාගම් ERP වේදිකාව — සම්පූර්ණ යොමු ලේඛනය

> **Document Purpose ලේඛනයේ අරමුණු:** This is the single source of truth for the entire KDU ERP system. It explains every architectural decision, every role permission, every module, and every user workflow — written in clear English (technical accuracy) mixed with natural Sinhala (so non-technical stakeholders can follow).
> මෙය KDU ERP පද්ධතිය සඳහා එකම නිල යොමු ලේඛනයයි. සෑම තාක්ෂණික තීරණයක්ම, සෑම කාර්ය භාරයක්ම, සෑම මොඩියුලයක්ම සහ සෑම පරිශීලක ක්‍රියාවලියක්ම මෙහි විස්තර කර ඇත.

---

## 📑 Table of Contents පටුන
1. [Global Architecture & Tech Stack](#1-global-architecture--tech-stack)
2. [Actor Roles & Permissions (RBAC)](#2-actor-roles--permissions-rbac)
3. [Component & Feature Workflow (A to Z)](#3-component--feature-workflow-a-to-z)
4. [User Workflow Walkthroughs](#4-user-workflow-walkthroughs)
5. [Data Security & Supabase RLS](#5-data-security--supabase-rls)
6. [Multi-Language (i18n) System](#6-multi-language-i18n-system)
7. [Deployment & Build](#7-deployment--build)

---

## 1. GLOBAL ARCHITECTURE & TECH STACK
### ගෝලීය ගෘහ නිර්මාණ ශිල්පය සහ තාක්ෂණය

### 1.1 The Two Coexisting Frontends (Web + Mobile)
### අන්තර්ජාල සහ ජංගම යෙදුම් — දෙකක් එකට වැඩ කරයි

This system is built on a **Hybrid Architecture**. There is ONE core application (a React Vite Progressive Web App) that runs in TWO surfaces:

මෙම පද්ධතිය ඉදිරිපත් කරන්නේ **Hybrid Architecture** (දෙමුහුම් ගෘහ නිර්මාණ ශිල්පයකි). මෙහි එක් ප්‍රධාන යෙදුමක් (React Vite Progressive Web App) දෙවරක් භාවිතා වේ:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        KDU ERP — Single Codebase                         │
│                    (එක් web codebase එකකින් දෙක වැඩ කරයි)                  │
└─────────────────────────────────────────────────────────────────────┘
        │                                                │
        ▼                                                ▼
┌───────────────────────┐                    ┌───────────────────────┐
│   WEB APP (PWA)       │                    │  NATIVE APP (Expo)    │
│   React + Vite + TS   │                    │  React Native + Expo  │
│                       │  ←──── එකම app ────→  │                       │
│  • Admins             │     එක් පිටුවකින්   │  • Supervisor         │
│  • Desktop-optimized  │     දෙක වැඩ කරයි   │  • Supplier (mobile)  │
│  • Full ERP features  │                    │  • WebView shell      │
└───────────────────────┘                    └───────────────────────┘
        │                                                │
        └────────────────┬───────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      HYBRID BACKEND                                   │
│  Firebase (Auth + Push)  +  Supabase (PostgreSQL Database)            │
│  Firebase (පිවිසුම + දැන්වීම්) + Supabase (දත්ත ගබඩාව)               │
└────────────────────────────────────────────────────────────────────-┘
```

**How they coexist (ඒවා කෙසේ එකට වැඩ කරයිද?):**

| Concept සංකල්පය | English | Sinhala |
|---|---|---|
| **Web App** | A website built with React + Vite. Opens in any browser. Installable as a PWA. Admins use it on desktop for big dashboards. | React + Vite වලින් හැදුනු වෙබ් අඩවියකි. ඕනෑම browser එකකින් විවෘත වේ. මෙය පරිපාලකයන් විසින් පරිගණකයෙන් භාවිතා කරයි. |
| **Native App** | A thin React Native/Expo shell that loads the SAME web app inside a WebView. Adds native FCM push notifications. | Expo වලින් හැදුනු ස්වදේශික යෙදුමකි. එකම web app එක WebView තුළ පෙන්වයි. දේශීය FCM දැන්වීම් එකතු කරයි. |
| **Why Hybrid?** | One codebase, zero duplication. Every feature works identically on web and mobile. | එක් කේතයකින් දෙකම. අනවශ්‍ය පිටපත් නැත. |

**Frontend Tech Stack ඉදිරි අන්ත තාක්ෂණය:**
- **React 19 + Vite + TypeScript** — fast, typed SPA
- **Tailwind CSS v4** — utility-first responsive design
- **recharts** — charts & data visualizations
- **lucide-react** — icon system
- **i18next + react-i18next** — tri-lingual support (English / Sinhala / Tamil)

### 1.2 The Hybrid Backend (Firebase + Supabase)
### දෙමුහුම් පසුබිම (Firebase + Supabase)

This is the most critical architectural decision. We split responsibilities between two free-tier cloud services:

මෙය වඩාත්ම වැදගත් තාක්ෂණික තීරණයයි. අපි වගකීම් දෙකක් අතර බෙදමු:

```
┌──────────────────────────────────┐      ┌──────────────────────────────────┐
│        FIREBASE (Free Tier)      │      │        SUPABASE (PostgreSQL)      │
│  Firebase භාවිතා කරන්නේ මෙයටයි:     │      │  Supabase භාවිතා කරන්නේ මෙයටයි:     │
│                                  │      │                                  │
│  ✅ Authentication               │      │  ✅ Estates, Divisions, Fields    │
│     (Phone OTP Login)            │      │  ✅ Users & Roles                 │
│     (දුරකථන OTP පිවිසුම)        │      │  ✅ Harvest Records (Leaf Weights) │
│                                  │      │  ✅ Resource Requests             │
│  ✅ Cloud Messaging (FCM)         │      │  ✅ Relational tables + Foreign Keys │
│     (Free Push Notifications)    │      │  ✅ Row-Level Security (RLS)      │
│     (නොමිලේ දැන්වීම්)             │      │     (පේළිලේඛන ආරක්ෂණය)            │
│                                  │      │                                  │
│  ❌ NO business data here!        │      │  ❌ NO authentication here!       │
└──────────────────────────────────┘      └──────────────────────────────────┘
```

**Why this split? (ඇයි මෙම බෙදීම?)**

| Service | Role | Sinhala Explanation |
|---|---|---|
| **Firebase** | Authenticates users with a phone OTP and sends push notifications. Does NOT store any business data. | පරිශීලකයන් දුරකථන OTP මගින් පිවිසේ සහ දැන්වීම් ලබා ගැනීමට Firebase භාවිතා කරයි. ව්‍යාපාරික දත්ත මෙහි තබන්නේ නැත. |
| **Supabase** | Stores ALL business data in relational PostgreSQL tables (estates, workers, harvest, payments). | සියලු ව්‍යාපාරික දත්ත සම්බන්ධිත PostgreSQL වගු තුළ Supabase හි ගබඩා කරයි. |
| **The Link** | When Firebase authenticates a user, the Firebase `uid` becomes the PRIMARY KEY (`id`) of the Supabase `users` table. | Firebase මගින් පරිශීලකයෙකු තහවුරු කළ විට, එම Firebase `uid` එක Supabase `users` වගුවේ `id` (Primary Key) බවට පත් වේ. |

**Connected Projects (යෙදවුම් සම්බන්ධිත ව්‍යාපෘති):**

| Layer ස්ථරය | Project | Configuration File |
|---|---|---|
| Web Auth + FCM | `kdu-feedback-app` | `.env` + `src/lib/firebase.ts` |
| Native Android FCM | `com.kdu.feedback` | `app/google-services.json` |
| Supabase Data | `KDU ERP` (`lfeowzotqcrdximicoar`) | `.env` + `src/lib/supabase.ts` |
| Weather API | OpenWeatherMap (`6a8d3f26e42...`) | `.env` + `src/lib/weather.ts` |
| AI (optional) | Google Gemini | `.env` + `src/lib/ai.ts` |

<details>
<summary><b>📁 Detailed File & Folder Map (click to expand)</b></summary>

```
KDU-ERP/
├─ /src                    ← Web App (React + Vite PWA)
│  ├─ App.tsx              ← Root: AppProvider → Shell → RouteGuard → Module
│  ├─ main.tsx             ← React entry + i18n init
│  ├─ context/AppContext.tsx  ← Global state: role, user, sync, requests
│  ├─ components/          ← Shell, RouteGuard, UI, charts, QR, LanguageSwitcher
│  ├─ modules/             ← 30 ERP modules (admin + supervisor + supplier)
│  ├─ lib/                 ← Backend logic (Firebase, Supabase, repo, rbac, i18n, weather)
│  └─ i18n/                ← Tri-lingual translations (en/si/ta)
├─ /app                    ← Native App (React Native + Expo)
│  ├─ App.tsx              ← WebView shell + FCM bridge + language switcher
│  ├─ google-services.json ← Firebase Android config (com.kdu.feedback)
│  └─ src/                 ← Native components, hooks, i18n
├─ /docs                   ← All SQL, deployment & migration docs
│  ├─ supabase_schema.sql  ← The complete database schema + RLS
│  ├─ HYBRID_MIGRATION.md  ← Firebase↔Supabase integration guide
│  ├─ I18N.md              ← Multi-language guide
│  └─ DEPLOYMENT.md        ← Web + EAS Mobile build manual
├─ /firestore.rules        ← Firebase security rules (placeholder)
└─ .env                    ← Live credentials (Supabase + Firebase + Weather)
```
</details>

---

## 2. ACTOR ROLES & PERMISSIONS (RBAC)
### පරිශීලක කාර්ය භාරයන් සහ අවසර (RBAC)

The system enforces role-based access at **FOUR layers** (defense-in-depth):
පද්ධතිය අවසර පාලනය කරන්නේ **ස්ථර හතරකින් (defense-in-depth):**

1. **UI Layer (අතුරු මුහුණත):** The navigation menu only renders modules the current role can access.
2. **Route Guard (`RouteGuard.tsx`):** Even if a user forces a URL, the component will not mount — an "Access Restricted" screen renders instead.
3. **Repo Guard (`repo.ts`):** Every database function runs `requireEstateAdmin()` or `requireOwnerOrAdmin()` before touching Supabase.
4. **Database (Supabase RLS):** The final, strongest layer — PostgreSQL itself rejects unauthorized queries.

### 2.1 Role Definitions (භූමිකා අර්ථ දැක්වීම)

#### 👑 ADMIN / FACTORY_OWNER (පරිපාලක / වතු හිමි)
**English:** The estate owner/director with full visibility across the entire ecosystem. Sees all 22+ ERP modules, manages all users, creates the estate hierarchy, and approves resource requests.
**Sinhala:** වතු හිමියා හෝ අධ්‍යක්ෂවරයෙකු වන අතර, සමස්ත පද්ධතිය පුරා සම්පූර්ණ දැකුම් ඇත. ERP මොඩියුල 22 කට වඩා දකින අතර, පරිශීලකයන් කළමනාකරණය කරයි, වතු ධූරාවලිය නිර්මාණය කරයි, සහ සම්පත් ඉල්ලීම් අනුමත කරයි.

**Capabilities (හැකියාවන්):** `dashboard.view`, `estate.master`, `labor.view`, `payroll.manage`, `loans.view`, `finance.view`, `users.manage`, `requests.manage`, `weather.view`, `ai.view`, `audit.view`, `offline.manage`, `platform.view` — and more.
**Layout (පිහිටීම):** Desktop-optimized panel with dark sidebar + fluid grids. (Desktop පරිගණකයෙන් භාවිතා කරන සම්පූර්ණ පාලන පුවරුව)

#### 🦺 SUPERVISOR (අධීක්ෂණ නිළධාරී)
**English:** A field officer with a mobile touch interface. Can ONLY see three field-capture tools. Cannot see any financial ledgers, payroll, or supplier banking.
**Sinhala:** ක්ෂේත්‍ර නිළධාරී ජංගම අතුරු මුහුණතක් භාවිතා කරයි. ක්ෂේත්‍ර මෙවලම් තුනක් පමණින් දැකිය හැක. මූල්‍ය වතු මුදල් හෝ සැපයුම්කරුවන්ගේ බැංකු තොරතුරු දැකිය නොහැක.

**Capabilities (ONLY 3):** `attendance.capture` (QR scan worker check-in), `allocation.manage` (daily work allocation), `weighing.capture` (leaf weight capture, offline-first).
**Layout (පිහිටීම):** Mobile-first phone shell with bottom navigation + 3 tabs. (ජංගම දුරකථන පරිහරණය, පහළ යෙදුම් තීරුව සහ ටැබ 3ක්)

#### 🌱 SUPPLIER (VVIP External Supplier)
**English:** An external entity that supplies green leaf to the estate. Mobile-first portal with only their own data. Cannot see worker rosters, payroll, or other suppliers.
**Sinhala:** වතුයේ කොළ තේ සපයන බාහිර පාර්ශ්වයකි. තමන්ගේම දත්ත පමණින් දැකිය හැක. ශ්‍රමිකයින්, වැටුප් හෝ වෙනත් සැපයුම්කරුවන් දැකිය නොහැක.

**Capabilities (ONLY 4):** `deliveries.own` (My Leaf Deliveries), `alerts.own` (Smart Alerts Panel), `payments.own` (Payment Tracker), `requests.create` (Request Resources).
**Layout (පිහිටීම):** Mobile-first portal with bottom navigation + 4 tabs. (ජංගම දුරකථනය, පහළ යෙදුම් තීරුව, 4 ටැබ්)

### 2.2 Permission Matrix (අවසර වගුව)

| Module Group මොඩියුල කාණ්ඩය | Admin | Supervisor | Supplier |
|---|:---:|:---:|:---:|
| Dashboard / Finance / Payroll / Loans / Ledger | ✅ | ❌ | ❌ |
| Estate Master / User Management / Labor Roster | ✅ | ❌ | ❌ |
| Digital Attendance / Work Allocation / Leaf Weighing | ❌ | ✅ | ❌ |
| My Deliveries / Smart Alerts / Payments / Resource Requests | ❌ | ❌ | ✅ |
| Resource Requisitions (admin inbox) | ✅ | ❌ | ❌ |
| Weather / AI / Audit / Compliance | ✅ | ❌ | ❌ |

---

## 3. COMPONENT & FEATURE WORKFLOW (A to Z)
### සෑම මොඩියුලයක්ම — මුල සිට අවසානය දක්වා

### 3.1 Estate Master Setup (Admin)
### වතු ධූරාවලිය නිර්මාණය (පරිපාලක)
**File:** `src/modules/EstateMaster.tsx`
**Role:** Admin-only (`requireEstateAdmin()` guard)

**What it does (ක්‍රියාකාරීත්වය):**
Admin creates the land hierarchy: **Estate → Division → Field**. This is the geographical foundation of the entire ERP. The admin enters details like name, region, area (hectares), elevation, cultivar, planting year.

**Sinhala:** පරිපාලක විසින් භූමි ධූරාවලිය නිර්මාණය කරයි: **වත්ත → කොට්ටාශය → ක්ෂේත්‍රය**. මෙය සමස්ත ERP පද්ධතියේ භූගෝලීය පදනමයි. නම, කලාපය, වර්ගඵලය, උන්නතාංශය, ප්‍රභේදය, වගා වර්ෂය වැනි විස්තර ඇතුළත් කරයි.

**Data Flow (දත්ත ගලායාම):**
```
UI Form (Admin clicks "Create Estate")
   ↓
AppContext.addEstate() → repo.createEstate(role, {...})
   ↓
requireEstateAdmin(role)  ← throws if not admin
   ↓
Supabase INSERT INTO estates (name, region, total_area_ha, ...)
   ↓
Returns new estate id → UI refreshes
```

**Admin Web Panel:** Sidebar → Estate Master → "Create Hierarchy Node" panel. Cascading dropdowns: pick estate → division → field.
**Mobile:** Not available (admin-only, desktop-optimized).

---

### 3.2 User Management & Estate Linking (Admin)
### පරිශීලක කළමනාකරණය හා වතු සම්බන්ධතාව (පරිපාලක)
**File:** `src/modules/UserManagement.tsx`
**Role:** Admin-only (`users.manage`)

**What it does:**
Admin creates supervisors & suppliers. When creating a SUPPLIER, a dynamic dropdown appears listing all estates. The selected estate id is stored as the supplier's `associated_entity_id`.

**Sinhala:** පරිපාලක විසින් අධීක්ෂණ නිළධාරීන් හා සැපයුම්කරුවන් නිර්මාණය කරයි. සැපයුම්කරුවෙකු නිර්මාණය කරන විට, සියලු වතු ලැයිස්තුගත කරන ගතික පැටිය මෙනුවක් මතු වේ. තෝරාගත් වත්තේ id එක එම සැපයුම්කරුගේ `associated_entity_id` ලෙස ගබඩා වේ.

**Data Flow:**
```
Admin fills form → Role: Supplier → selects Estate from dropdown
   ↓
Supabase INSERT INTO users (id=firebaseUid, role='supplier', associated_entity_id=estateId)
   ↓
Supplier can now only see data for that estate
```

---

### 3.3 Labor Management & Attendance (Admin view, Supervisor capture)
### ශ්‍රම කළමනාකරණය සහ පැමිණීම (පරිගණක දසුන, අධීක්ෂණ ග්‍රහණය)
**Files:** `src/modules/Labor.tsx` (admin roster), `src/modules/SupervisorField.tsx` (supervisor attendance)
**Role:** Admin (roster view), Supervisor (attendance capture)

**What it does:**
Admins see the full worker roster (names, NIC, bank, productivity). Supervisors use the QR scanner to clock workers in/out daily.

**Sinhala:** පරිපාලකයන්ට සම්පූර්ණ ශ්‍රමික ලැයිස්තුව දැකිය හැක (නම, NIC, බැංකු, ඵලදායිතා). අධීක්ෂණ නිළධාරීන් QR ස්කෑනරය භාවිතා කර සේවකයන් දෛනිකව ඇතුළත්/ඉවත් කරයි.

**Data Flow:**
```
Supervisor scans QR badge
   ↓
CaptureButton → AppContext.enqueueSync("Attendance: workerName")
   ↓
Offline? Queued in IndexedDB → Online → flush → Supabase INSERT INTO attendance
```

**Admin Web:** `Labor.tsx` → full roster table with productivity meters.
**Supervisor Mobile:** `SupAttendance` → QR scanner + checked-in list.

---

### 3.4 Harvest & Leaf Weight Tracking
### අස්වැන්න සහ කොළ බර ලුහුඬිය
**Files:** `src/modules/Harvest.tsx` (admin), `src/modules/SupervisorField.tsx` → `SupWeighing` (supervisor)
**Role:** Supervisor captures, Admin reviews, Supplier sees own.

**What it weighs:**
Worker, field, gross weight, deduction %, net weight, grade (Super/Standard/Coarse). The net weight becomes the supplier's delivery record.

**Sinhala:** ශ්‍රමිකයා, ක්ෂේත්‍රය, ඒකක බර, වට්ටම් %, ශුද්ධ බර, ශ්‍රේණිය. ශුද්ධ බර සැපයුම්කරුගේ භාරදීම් වාර්තාව බවට පත් වේ.

**Data Flow:**
```
Supervisor enters gross weight, deduction %
   ↓
AppContext → repo.saveLeafWeighing()
   ↓
Supabase INSERT INTO harvest_records (gross_kg, net_kg, grade, supplier_id=..., estate_id=...)
   ↓
Becomes Supplier's delivery record (read via repo.getMyDeliveries)
```

**Admin Web:** `Harvest.tsx` → weigh-in records table + grade distribution donut.
**Supervisor Mobile:** `SupWeighing` → offline-first capture form.
**Supplier Mobile:** `SupplierDeliveries` → reads only their own net weights (estate-scoped).

---

### 3.5 Resource Requests (Supplier → Admin)
### සම්පත් ඉල්ලීම් (සැපයුම්කරු → පරිපාලක)
**Files:** `src/modules/SupplierRequest.tsx` (supplier form), `src/modules/ResourceRequests.tsx` (admin inbox)
**Role:** Supplier creates, Admin approves/rejects.

**What it does:**
Supplier requests workers or equipment. Admin sees it in an inbox, cross-references the available pool, and clicks Approve & Allocate or Reject with Reason. A silent state change triggers an FCM push to the supplier.

**Sinhala:** සැපයුම්කරු ශ්‍රමිකයන් හෝ උපකරණ ඉල්ලයි. පරිපාලක එය ඉන්බොක්ස් එකක දැක, ලබා ගත හැකි සම්පත් හරහා සලකා බලා, අනුමත කරයි හෝ හේතුවක් සමග ප්‍රතික්ෂේප කරයි. නිහඬ තත්ත්ව වෙනසක් සැපයුම්කරුට FCM තල්ලුවක් ලබා දේ.

**Data Flow:**
```
Supplier fills request form (type, item, quantity, date, duration, note)
   ↓
AppContext.submitRequest() → repo.createResourceRequest()
   ↓
Supabase INSERT INTO resource_requests (status='PENDING')
   ↓ (realtime listeners)
Admin Resource Requests inbox (ResourceRequests.tsx) sees new PENDING ticket
   ↓
Admin clicks Approve → repo.decideResourceRequest()
   ↓
Supabase UPDATE resource_requests SET status='APPROVED'
   ↓
FCM push to supplier: "Resource Request Approved ✅"
```

**Supplier Mobile:** `SupplierRequest` → request form + "My Requests" tracking.
**Admin Web:** `ResourceRequests.tsx` → inbox table with approve/reject + pool cross-reference meters.

---

### 3.6 All Other Admin Modules (at a glance)
### සෙසු පරිපාලක මොඩියුල (එක දැක්මකින්)

| Module | File | Purpose (English / Sinhala) |
|---|---|---|
| **Estate Dashboard** | `Dashboard.tsx` | Executive KPIs (harvest, workers, loans, fertilizer stock, revenue) / විධායක KPI |
| **Crop Management** | `Crop.tsx` | Life-cycle (pruning, weeding), yield projection / වගා චක්‍රය, අස්වැන්න පුරෝකථනය |
| **GPS & GIS Mapping** | `GisMap.tsx` | Stylized field polygon map + telemetry / ක්ෂේත්‍ර සිතියම |
| **Vehicle & Fuel** | `Vehicles.tsx` | Fleet roster, fuel slips, mileage / වාහන, ඉන්ධන |
| **Factory Integration** | `Factory.tsx` | Green leaf → made tea (OP/BOP/Dust), waste, efficiency / කර්මාන්තශාලා ඒකාබද්ධතාව |
| **Inventory** | `Inventory.tsx` | QR-based asset allocation / QR ද්‍රව්‍ය කළමනාකරණය |
| **Fertilizer** | `Fertilizer.tsx` | Stock (Urea/MOP/TSP), cost per hectare / පොහොර කළමනාකරණය |
| **Agrochemical** | `Agrochemical.tsx` | Herbicide/pesticide inventory + cert audit / කෘෂි රසායනික |
| **Payroll System** | `Payroll.tsx` | Wage calculation, EPF/ETF, bank file export / වැටුප් පද්ධතිය |
| **Loans & Advances** | `Loans.tsx` | Advance logs, overdue risk, auto-deduct / ණය කළමනාකරණය |
| **Loyalty Program** | `Loyalty.tsx` | Gamified points, tiers, rewards catalog / පක්ෂපාතිත්ව වැඩසටහන |
| **Welfare Management** | `Welfare.tsx` | Housing registry, clinic visits, scholarships / සුබසාධන කළමනාකරණය |
| **Finance & Accounting** | `Finance.tsx` | General ledger, multi-dim P&L, AP/AR / මූල්‍ය හා ගිණුම්කරණය |
| **Weather & Environment** | `Weather.tsx` | Live OpenWeatherMap forecast + deterministic alerts / කාලගුණය |
| **AI & Analytics** | `AiAnalytics.tsx` | Deterministic yield model + optional Gemini / AI විශ්ලේෂණය |
| **Audit & Compliance** | `AuditCompliance.tsx` | Rainforest Alliance, Fairtrade, ISO vaults / විගණන හා අනුකූලතාව |
| **Mobile & Offline** | `MobileOffline.tsx` | Service Worker, IndexedDB sync queue / නොබැඳි සමමුහුර්තනය |
| **Architecture & Docs** | `Architecture.tsx` | In-app blueprint + live Supabase status / ගෘහ නිර්මාණ ශිල්පය |

---

## 4. USER WORKFLOW WALKTHROUGHS
### පරිශීලක ක්‍රියාවලිය — පියවරෙන් පියවර

### 4.1 Supplier Lifecycle (සැපයුම්කරුගේ ජීවන චක්‍රය)
**The VVIP external supplier journey from onboarding to payment:**

```
1. ONBOARDING (ඔන්බෝඩින්ක්‍රීයකරණය)
   - Admin creates supplier in User Management → enters phone
   - Phone receives OTP via Firebase → verifies identity → returns uid
   - upsertUserFromFirebase(uid) → Supabase INSERT INTO users (id=uid, role='supplier')
   ↓
2. ESTATE LINKING (වතු සම්බන්ධතාව)
   - Admin selects an Estate from dropdown → saves associated_entity_id
   ↓
3. DAILY DELIVERY (දෛනික භාරදීම)
   - Supervisor records leaf weight → harvest_records (supplier_id=uid, estate_id=link)
   - Supplier sees "My Leaf Deliveries" → scoped to supplier_id=uid AND estate_id=link
   ↓
4. PUSH NOTIFICATION (දැන්වීම්)
   - Supplier requests fertilizer → Resource Request created (PENDING)
   - Admin approves → FCM push: "Resource Request Approved ✅"
   - Supplier's phone buzzes
   ↓
5. PAYMENT (ගෙවීම)
   - Admin Finance → marks harvest as "Paid"
   - Supplier sees "Payment Tracker" → shows paid/pending amounts
   - Reads harvest_records WHERE supplier_id=uid AND estate_id=link
```

**Detailed Step-by-Step (විස්තරාත්මක පියවර):**

| Step | Actor | Action | Database |
|---|---|---|---|
| 1 | Admin | Creates supplier with phone | `users` (role='supplier') |
| 1.5 | Firebase | Sends OTP → uid created | Firebase Auth |
| 2 | Admin | Links supplier to estate | `users.associated_entity_id` |
| 3 | Supplier | Opens app → sees only their own portal | RLS filters `supplier_id=uid AND estate_id=link` |
| 4 | Supplier | Requests workers/equipment | `resource_requests` (PENDING) |
| 4.5 | Supervisor | Captures leaf weight | `harvest_records` (gross_kg, net_kg, grade) |
| 5 | Admin | Approves resource request | UPDATE `resource_requests` (APPROVED) + FCM push |
| 6 | Supplier | Sees payment pending → paid | reads `harvest_records` (estate-scoped) |

---

### 4.2 Supervisor Daily Workflow (අධීක්ෂණ නිළධාරීගේ දෛනික ක්‍රියාවලිය)

```
1. LOGIN (පිවිසීම)
   - Supervisor logs in via phone OTP (Firebase)
   - Lands on mobile shell with 3 tabs: Attendance | Allocation | Weighing
   ↓
2. DAILY FIELD ATTENDANCE (දෛනික පැමිණීම)
   - Opens "Digital Attendance" tab → scans worker QR badges
   - CaptureButton → enqueueSync → Supabase `attendance` table
   - Offline? Data is queued in IndexedDB → syncs on reconnect
   ↓
3. RECORDING LEAF WEIGHTS (කොළ බර වාර්තා කිරීම)
   - Opens "Leaf Weighing Entry" tab → enters gross weight, deduction %
   - App calculates net weight → saves to `harvest_records` (supplier_id, estate_id)
   - Offline? Queued → syncs on reconnect
   ↓
4. SYNCING DATA (දත්ත සමමුහුර්තනය)
   - If offline → data in IndexedDB queue
   - When back online → AppContext.flushSync() flushes all queued items to Supabase
   - App auto-detects connectivity via NetInfo
```

---

## 5. DATA SECURITY & SUPABASE RLS
### දත්ත ආරක්ෂාව හා පේළි මට්ටමේ ආරක්ෂණය (RLS)

The system uses **Row-Level Security (RLS)** in Supabase to enforce permissions at the database level. This is the strongest layer of security.

පද්ධතිය Supabase හි **Row-Level Security (RLS)** භාවිතා කරමින් දත්ත ගබඩාවේ මට්ටමේ අවසර බලනය කරයි. මෙය ශක්තිමත්ම ආරක්ෂක ස්ථරයයි.

**Why RLS matters (ඇයි RLS වැදගත්ද?):**
- Even if the frontend is compromised and an attacker manipulates the URL or code, the database will STILL refuse to serve data the user isn't authorized for.
- වෙබ් යෙදුම හැකර් විසින් වෙනස් කළත්, දත්ත ගබඩාව අනවසර දත්ත ලබා දීම තවමත් ප්‍රතික්ෂේප කරයි.

**Supabase Tables (දත්ත වගු):** `users`, `estates`, `divisions`, `fields`, `harvest_records`, `resource_requests`, + `managed_users` view + seed data. (Full SQL: `docs/supabase_schema.sql`)

> **ADMIN ESTATE CREATION RULE:** Creating an estate is **admin-only** — enforced by `requireEstateAdmin(role)` in `repo.ts` (throws for supplier/supervisor) AND the `RLS "hierarchy admin write"` policy. වත්තක් නිර්මාණය කිරීම **පරිපාලකයෙකුට පමණි** — `repo.ts` හි `requireEstateAdmin(role)` සහ RLS policy මගින් බලනය කෙරේ.

**RLS Policies (ආරක්ෂණ නීති):**
- `users`: a user reads their own row only; admin reads all; the `role` field is admin-only to change (enforced by `guard_user_role` trigger).
- `estates / divisions / fields`: admin-only writes (`is_admin()`).
- `harvest_records`: a supplier reads only their own rows for their linked estate (`supplier_id = caller_uid() AND estate_id = associated_entity_id`); admin reads all.
- `resource_requests`: a supplier creates/reads their own tickets; admin manages all (approve/reject).

**The `auth.uid()` cast fix:** Since Firebase uids are strings (`text`) and `auth.uid()` returns a `uuid`, the schema uses a `caller_uid()` helper function that casts: `auth.uid()::text`. This resolves the `operator does not exist: text = uuid` error.
**අවසර නිර්මාණය:** Firebase uids යනු අක්ෂර වැලක් (`text`) වන අතර `auth.uid()` යනු `uuid` එකක්, එබැවින් සැකිල්ල `caller_uid()` උපකාරක ශ්‍රිතය භාවිතා කරයි: `auth.uid()::text`.

**The Hybrid Auth Flow (දෙමුහුම් සත්‍යතාව ප්‍රවාහය):** Firebase authenticates the user and returns a `uid`. The `upsertUserFromFirebase(fbUser)` function (in `auth.hybrid.ts`) writes this `uid` to Supabase `users.id` (Primary Key). Supabase RLS then authorizes queries using `caller_uid()` = `auth.uid()::text`.

---

## 6. MULTI-LANGUAGE (i18n) SYSTEM
### බහුභාෂා පද්ධතිය (ඉංග්‍රීසි / සිංහල / දෙමළ)

The app supports **three languages**: English (en), Sinhala (si), and Tamil (ta). Built with `i18next` + `react-i18next`.
යෙදුම භාෂා **තුනක්** සහාය දක්වයි: ඉංග්‍රීසි (en), සිංහල (si), සහ දෙමළ (ta). `i18next` + `react-i18next` වලින් තනා ඇත.

**How it works (කෙසේ ක්‍රියාත්මක වේද):**
1. **Localization files:** `/src/i18n/locales/{en,si,ta}.json` contain every translatable string, organized by namespace (`common.*`, `nav.*`, `modules.*`, `roles.*`, `supervisor.*`, `supplier.*`, `domain.*`).
2. **Language Switcher:** `/src/components/LanguageSwitcher.tsx` — a globe dropdown button in the header. Toggling it changes `i18n.changeLanguage()` globally.
3. **Persistence:** The choice is saved in `localStorage` under key `verda.lang` and persists across sessions.
4. **Native Mirror:** The Expo shell mirrors this exact setup. Changing language in the native shell injects the choice into the WebView (sets `localStorage.verda.lang` and reloads) so the PWA follows the same language.

**In components:** Use `const { t } = useTranslation()` then `t("supplier.deliveries")`.
**කොටස් තුළ:** `const { t } = useTranslation()` භාවිතා කර `t("supplier.deliveries")` ලෙස භාෂා පරිවර්තනය කරයි.

---

### 6.5 Offline-First Architecture
### නොබැඳි-ප්‍රථම ගෘහ නිර්මාණ ශිල්පය

Field staff (supervisors) often work in remote tea fields with no internet. The system captures data offline and syncs automatically when connectivity returns.

ක්ෂේත්‍ර කාර්ය මණ්ඩලය (අධීක්ෂණ නිළධාරීන්) බොහෝවිට අන්තර්ජාලයක් නොමැති දුරස්ථ තේ වතු වල වැඩ කරයි. පද්ධතිය දත්ත නොබැඳිව ග්‍රහණය කරගෙන සම්බන්ධතාවය නැවත ලැබුණු විට ස්වයංක්‍රීයව සමමුහුර්ත කරයි.

**How it works (කෙසේ ක්‍රියාත්මක වේද):**
1. **CaptureButton:** When offline, clicks enqueue data into an in-memory sync queue (simulating IndexedDB) → shown as "queued" in the Mobile & Offline panel.
2. **NetInfo:** The app listens to network state. When back online, `AppContext.flushSync()` flushes the queue to Supabase.
3. **Service Worker:** `public/sw.ts` pre-caches the app shell and buffers mutations in a Workbox Background Sync queue (IndexedDB) — for true browser offline.
4. **Native App:** `app/App.tsx` uses `NetInfo` to show a native "You are offline" screen with Retry, preventing the user from seeing a broken WebView.

---

## 7. DEPLOYMENT & BUILD
### පරියවැය හා නිර්මාණය

### 7.1 Web App (PWA)
### වෙබ් යෙදුම (PWA)
**Build:** `npm run build` → produces a single-file `dist/index.html` (all JS/CSS inlined).
**Deploy:** `netlify deploy --prod --dir=dist` or `vercel --prod`. Both auto-detect Vite. Atomic, zero-downtime.
**Sinhala:** `npm run build` වලින් එක් ගොනුවක් හැදෙන්නේ. එය Netlify හෝ Vercel වලට යවයි.

### 7.2 Native App (Expo APK)
### ස්වදේශික යෙදුම (Expo APK)
**Prebuild:** `cd app && npx expo prebuild --platform android`
**Build APK:** `cd app && eas build -p android --profile preview`
**Build AAB (Play Store):** `eas build -p android --profile production`
**Sinhala:** `cd app && npx expo prebuild --platform android` සහ `eas build` වලින් Android යෙදුම APK බවට හැරවිය හැක.

### 7.3 Connected Integrations
### සම්බන්ධිත ඒකාබද්ධකරණය
| Service සේවාව | Project | Config |
|---|---|---|
| Supabase (data) | KDU ERP (`lfeowzotqcrdximicoar`) | `.env` + `supabase.ts` |
| Firebase (auth/FCM) | `kdu-feedback-app` | `.env` + `firebase.ts` + `google-services.json` |
| Weather API | OpenWeatherMap (`6a8d3f26e42...`) | `.env` + `weather.ts` |
| AI (optional) | Google Gemini | `.env` + `src/lib/ai.ts` |

---

## ✅ Quick-Reference Summary
### ඉක්මන් යොමු සාරාංශය

| Concern කාරණය | Answer පිළිතුර |
|---|---|
| **How many frontends?** | ONE codebase → Web (PWA) + Native (Expo WebView). එක් කේතයකින් දෙකම. |
| **Authentication?** | Firebase Phone OTP (free). Firebase දුරකථන OTP. |
| **Where is business data?** | Supabase PostgreSQL tables. Supabase වගු. |
| **How are they linked?** | Firebase `uid` = Supabase `users.id` (Primary Key). |
| **Role enforcement?** | 4 layers: UI nav + RouteGuard + Repo guard + Supabase RLS. |
| **Supplier data scoping?** | `supplier_id=uid AND estate_id=associated_entity_id`. |
| **Push notifications?** | FCM (free), via Firebase Cloud Messaging. |
| **Multi-language?** | English / Sinhala / Tamil (i18next). |
| **Offline support?** | IndexedDB + Service Worker + NetInfo. |
| **Weather alerts?** | Live OpenWeatherMap → deterministic (no AI). |

---

### 📝 Verification Commands (තහවුරු කිරීමේ විධානයන්)
```bash
# Web app
npm install && npm run dev      # http://localhost:5173
npm run build                   # single-file bundle in /dist

# Native app
cd app && npm install && npx expo start
cd app && eas build -p android --profile preview

# Supabase schema
# Run docs/supabase_schema.sql in Supabase SQL Editor

# Verifying connections
# Admin → Architecture & Docs → Backend tab → click "Test" (pings Supabase)
```

---

*KDU ERP — One codebase, two surfaces, three languages, hybrid backend, zero compromise.* 🍃
*එක් කේතයකින්, දෙකක් වැඩ කරයි, භාෂා තුනකින්, දෙමුහුම් පසුබිම, කිසිදු අඩුවක් නැත.* 🇱🇰
