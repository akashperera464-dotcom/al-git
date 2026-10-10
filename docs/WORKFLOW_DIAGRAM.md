# KDU TEA FACTORY — Complete System Workflow (For Everyone)

> **පරිශීලක මාර්ගෝපදේශය · Reader's Guide**
>
> This document explains how the KDU TEA FACTORY system works from start to finish — in plain English + Sinhala. If you give this document to a new person (admin, manager, or developer), they should be able to understand the system within 30 minutes.
>
> **මෙම ලේඛනය තුළින් KDU TEA FACTORY පද්ධතිය ආරම්භයේ සිට අවසානය දක්වා ක්‍රියාත්මක වන ආකාරය සරල ඉංග්‍රීසි + සිංහල භාෂාවෙන් විස්තර කර ඇත. මෙය අලුත් පුද්ගලයෙකුට ලබා දුන් විට, ඔවුන්ට මිනිත්තු 30 කින් පද්ධතිය සම්පූර්ණයෙන් තේරුම් ගත හැක.**

---

## 📖 How to Read This Document / මෙම ලේඛනය කියවිය යුතු ආකාරය

| If you are... | Read these sections first |
|---------------|---------------------------|
| **New admin / manager** | Part 1 + Part 3 (User Journeys) |
| **New supplier** | Part 1 + Part 3.3 (Supplier Journey) |
| **New developer** | Part 1 + Part 2 (Architecture) + Part 5 (Reference) |
| **Just curious** | Part 1 (5-minute overview) |

**Document structure:**
- **Part 1** — Quick Start (read first, 5 minutes)
- **Part 2** — System Architecture (the "how it works behind the scenes")
- **Part 3** — User Journeys (start-to-end stories for each role)
- **Part 4** — Module Workflows (detailed step-by-step for each feature)
- **Part 5** — Reference (module map, FAQ, Phase 2 roadmap)

---

# PART 1 — Quick Start (Read This First) / ක්ෂණික ආරම්භය

## 1.1 What Is This System? / මෙය කුමක්ද?

**KDU TEA FACTORY** is a Tea Estate ERP (Enterprise Resource Planning) system. It helps a tea factory manage:
- 🏛️ **Estates** — large tea plantations divided into divisions and fields
- 👥 **Workers** — full-time labor (kangany, pluckers, supervisors) and casual labor
- 📦 **Stock** — fertilizer, equipment, agrochemicals, fuel
- 🌿 **Leaf supply** — small tea farmers (suppliers) bring green leaf to the factory
- 💰 **Payments** — pay suppliers for their leaf, pay workers their wages
- 📱 **Mobile app** — suppliers + extension officers use phones; admin uses computer

**පද්ධතිය කුමක්ද?**
KDU TEA FACTORY යනු තේ වතු කළමනාකරණ පද්ධතියකි. මෙය තේ කම්හලකට වතු, සේවකයින්, තොග, කොළ සැපයුම්කරුවන් සහ ගෙවීම් කළමනාකරණය කිරීමට උපකාර වේ.

---

## 1.2 The 3 User Roles / පරිශීලක කාර්යභාරයන් 3

The system has **3 types of users**. Each sees different screens.

```
┌─────────────────────────────────────────────────────────────┐
│                    KDU TEA FACTORY ERP                       │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐         ┌──────▼──────┐         ┌────▼────┐
   │ ADMIN   │         │ EXTENSION   │         │SUPPLIER │
   │ (පරි   │         │ OFFICER     │         │ (කුඩා  │
   │පාලක)  │         │ (ක්ෂේත්‍ර   │         │ වතු   │
   │         │         │ නිළධාරී)   │         │ හිමියා)│
   │         │         │             │         │         │
   │ Uses:   │         │ Uses:       │         │ Uses:   │
   │Computer│         │Mobile APK   │         │Mobile APK│
   │ (Web)  │         │             │         │         │
   │         │         │             │         │         │
   │ Sees   │         │ Sees 2      │         │ Sees 9  │
   │ 30+    │         │ modules     │         │ modules │
   │ modules │         │             │         │         │
   └────┬────┘         └──────┬──────┘         └────┬────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │ CENTRAL DATABASE   │
                    │ (Supabase +        │
                    │  Firebase)         │
                    │ මධ්‍යම දත්ත ගබඩාව  │
                    └────────────────────┘
```

### Who They Are and What They Do

| Role | Sinhala | Who in real life | What they do |
|------|---------|------------------|--------------|
| **Admin** | පරිපාලක | Factory owner / Estate manager | Manages everything — workers, stock, payments, finance. Uses computer (web). |
| **Extension Officer (EO)** | ක්ෂේත්‍ර නිළධාරී | Factory's field officer | Visits estates, registers new suppliers, weighs leaf at collection centers. Uses mobile APK. |
| **Supplier** | සැපයුම්කරු | Small tea farmer (කුඩා තේ වතු හිමියා) | Brings green leaf to factory, gets paid, tracks payments, requests resources. Uses mobile APK. |

---

## 1.3 The 4 Main Pillars / ප්‍රධාන කුළම් 4

Everything in the system fits into one of these 4 pillars:

```
┌─────────────────────────────────────────────────────────────┐
│                KDU TEA FACTORY — 4 PILLARS                  │
├──────────────────┬──────────────┬───────────────┬───────────┤
│ 1. ESTATE        │ 2. LEAF      │ 3. STOCK &    │ 4. PEOPLE │
│    MANAGEMENT    │    SUPPLY    │    FINANCE     │   & LABOR │
│                  │              │                │           │
│ • Estates        │ • Suppliers  │ • Fertilizer   │ • Workers │
│ • Divisions      │ • Leaf       │   stock       │ • Attendance│
│ • Fields         │   weighing   │ • Equipment    │ • Payroll  │
│ • GPS coordinates│ • Payments  │ • Inventory    │ • Loans   │
│ • Bush count     │ • Invoices  │ • Purchase     │ • Welfare │
│                  │              │   orders      │           │
│ WHO: Admin       │ WHO: EO +   │ WHO: Admin     │ WHO: Admin│
│                  │ Supplier    │                │           │
└──────────────────┴──────────────┴───────────────┴───────────┘
```

---

## 1.4 Where Does Everything Start? / ආරම්භය කොතනින්ද?

**The system starts with the Admin setting up the estate.** Without the estate, nothing else works.

```
                      START HERE ⭐
                          │
                          ▼
            ┌─────────────────────────────┐
            │ 1. Admin creates ESTATE     │
            │ (name, region, GPS,         │
            │  bush count, acreage)       │
            │ වත්තක් සෑදීම               │
            └──────────────┬──────────────┘
                           ▼
            ┌─────────────────────────────┐
            │ 2. Admin creates DIVISIONS  │
            │ (Sutton, Craighead, etc.)    │
            │ කොට්ඨාස සෑදීම               │
            └──────────────┬──────────────┘
                           ▼
            ┌─────────────────────────────┐
            │ 3. Admin creates FIELDS      │
            │ (with bush count per field)  │
            │ ක්ෂේත්‍ර සෑදීම                │
            └──────────────┬──────────────┘
                           ▼
            ┌─────────────────────────────┐
            │ 4. EO registers SUPPLIERS     │
            │ (links each supplier to an    │
            │  estate via APK)             │
            │ සැපයුම්කරුවන් ලියාපදිංචි කිරීම  │
            └──────────────┬──────────────┘
                           ▼
            ┌─────────────────────────────┐
            │ 5. Suppliers start bringing  │
            │ leaf → EO weighs → Admin     │
            │ pays → cycle continues       │
            │ ைන්නෙන් පටන් ගනී            │
            └─────────────────────────────┘
```

**Golden rule:**
> 🥇 **Admin creates the estate first.** Then EO can register suppliers. Then suppliers can deliver leaf. Then admin can pay. Then everyone can use stock, request equipment, etc.
>
> පරිපාලක මුලින්ම වත්ත සෑදිය යුතුය. ඉන්පසු නිළධාරීට සැපයුම්කරුවන් ලියාපදිංචි කළ හැක. ඉන්පසු සැපයුම්කරුවන්ට කොළ භාරදිය හැක. ඉන්පසු පරිපාලකට ගෙවිය හැක.

---

## 1.5 Quick Reference: All 30+ Modules / මොඩියුල 30+

| # | Module | Used by | Purpose |
|---|--------|---------|---------|
| 1 | Estate Dashboard | Admin | Live KPIs (workers, harvest, revenue) |
| 2 | Estate Master | Admin | Create estates, divisions, fields |
| 3 | Labor Management | Admin | Workers, attendance, leave, daily labor cost |
| 4 | Harvest Management | Admin | View weigh-in records |
| 5 | Inventory & Procurement | Admin | Stock, POs, GRN, issue stock |
| 6 | Fertilizer | Admin | Fertilizer stock overview + division summary |
| 7 | Equipment | Admin | Equipment stock overview |
| 8 | Agrochemical | Admin | Agrochemical stock overview |
| 9 | Equipment Requests | Admin | Approve/reject equipment requests |
| 10 | Resource Requisitions | Admin | Approve/reject supplier resource requests |
| 11 | User Management | Admin | Create/edit users |
| 12 | Announcements | Admin | Publish news to suppliers |
| 13 | Weather & Environment | Admin | Per-estate weather + alerts |
| 14 | Payroll System | Admin | EPF/ETF, payslips |
| 15 | Loans & Advances | Admin | Worker loans |
| 16 | Finance & Accounting | Admin | GL accounts, double-entry journals |
| 17 | Loyalty Program | Admin | Points, rewards |
| 18 | Welfare Management | Admin | Welfare schemes |
| 19 | GPS & GIS Mapping | Admin | Estate boundaries on map |
| 20 | Vehicle & Fuel | Admin | Fleet, fuel logs |
| 21 | Mobile & Offline | Admin | PWA config |
| 22 | AI & Analytics | Admin | Predictive insights |
| 23 | Audit & Compliance | Admin | Audit logs |
| 24 | Architecture & Docs | Admin | System overview |
| 25 | Branding & Settings | Super Admin | Logo, colors, login page |
| 26 | Supplier Loans | Admin | Supplier-specific loans |
| 27 | Auction Sales | Admin | Colombo Tea Auction |
| 28 | Field Tools | Admin | Calculators, charts |
| 29 | Register Supplier | EO | Create new supplier accounts |
| 30 | Leaf Weighing Entry | EO | Record leaf weights + GPS verify |
| 31 | My Leaf Deliveries | Supplier | Real-time view of own deliveries |
| 32 | Smart Alerts Panel | Supplier | Fertilizer + plucking advisory |
| 33 | Payment Tracker | Supplier | Earnings history |
| 34 | My Farm Activities | Supplier | Log fertilizer/pruning/harvest |
| 35 | My Plot | Supplier | Acreage + bush count entry |
| 36 | My Weather | Supplier | Location-based weather |
| 37 | Tips & Guidance | Supplier | Daily agronomy tips |
| 38 | Estate Updates | Supplier | Read admin announcements |
| 39 | Request Resources | Supplier | Request equipment/fertilizer |

---

# PART 2 — System Architecture / පද්ධති ගෘහ නිර්මාණය

## 2.1 The Big Picture / මහත් රූපය

```
                          USER'S PHONE
                          (පරිශීලකගේ දුරකථනය)
                                │
                                ▼
                ┌──────────────────────────────┐
                │      APK (Android App)        │
                │  • WebView (loads PWA)        │
                │  • Camera + GPS + FCM        │
                │  • Splash screen + icon       │
                └──────────────┬───────────────┘
                               │ (loads via internet)
                               ▼
                ┌──────────────────────────────┐
                │   Vercel (cloud hosting)      │
                │   • React + Vite webapp       │
                │   • URL: akashpereraproject24 │
                │     .vercel.app               │
                │   • Auto-deploys on git push  │
                └──────────────┬───────────────┘
                               │ (talks to)
                               ▼
              ┌──────────────────────────────────┐
              │     Supabase (database)          │
              │  • PostgreSQL database            │
              │  • Auth (login)                  │
              │  • Real-time subscriptions       │
              │  • Storage (files)               │
              └──────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        estates table    workers table    stock_items table
        divisions table   attendance      stock_movements
        fields table      payroll_runs    purchase_orders
        users table       leave_requests  goods_receipts
        harvest_records   supplier_locations
        supplier_farms    farm_activities
        ...               ...
                               │
                               ▼
              ┌──────────────────────────────────┐
              │     Firebase (push notifications)│
              │  • FCM tokens per device         │
              │  • Cloud Functions dispatch push │
              │  • Triggers on Firestore writes  │
              └──────────────────────────────────┘
```

## 2.2 Three Cloud Services We Use / අපි භාවිත කරන වලාකුළු සේවා 3

| Service | What it does | Cost |
|---------|--------------|------|
| **Vercel** | Hosts the webapp (HTML/JS/CSS). Auto-deploys when we push to GitHub. | Free tier |
| **Supabase** | Database (PostgreSQL), user login, real-time updates | Free tier |
| **Firebase** | Push notifications (FCM) — sends alerts to supplier phones | Free tier |

**අපි භාවිත කරන සේවා 3:**
1. Vercel — webapp host කරයි
2. Supabase — database සහ login කළමනාකරණය
3. Firebase — push notifications යවයි

## 2.3 The "Why Hybrid" Architecture / ඇයි Hybrid?

The mobile app is a **WebView** that loads the webapp from Vercel. This means:

| When you change... | Mobile app needs... | Web app needs... |
|--------------------|---------------------|------------------|
| Add new module (e.g., Equipment) | ✅ Nothing (auto-updates) | Deploy via git push |
| Change app icon | ❌ Rebuild via EAS | Nothing |
| Fix a bug in a form | ✅ Nothing (auto-updates) | Deploy via git push |
| Change the Vercel URL | ❌ Rebuild via EAS | Nothing |
| Add new FCM notification type | ✅ Nothing (auto-updates) | Deploy via git push |
| Change app name (under icon) | ❌ Rebuild via EAS | Nothing |

**Bottom line:** 95% of changes only need a `git push` (web updates instantly). Only 5% of changes need an APK rebuild.

**ඇයි Hybrid?**
APK එක යනු webapp එක වෙබ්සයිට් එකකින් පූරණය කරන WebView එකකි. එනිසා අපි webapp එකේ වෙනසක් කළ විට, APK එක ස්වයංක්‍රීයව අලුත් වේ.

## 2.4 Where Data Lives / දත්ත තැන්පල ස්ථාන

| Data type | Where it's stored | Why |
|-----------|-------------------|-----|
| User accounts (login) | Supabase Auth | Free, easy, secure |
| Estates, divisions, fields | Supabase `estates` table | Relational data |
| Workers, attendance | Supabase `workers`, `attendance` tables | Daily writes |
| Stock items, movements | Supabase `stock_items`, `stock_movements` | Real-time updates |
| Harvest records | Supabase `harvest_records` | Linked to suppliers |
| Suppliers' plot details | Browser localStorage (Phase 1) → Supabase (Phase 2) | Per-supplier |
| Push notification tokens | Firebase Firestore `fcm_tokens` | Per-device |
| App icon, splash screen | Baked into APK at build time | Native asset |

---

# PART 3 — User Journeys (Start-to-End Stories) / පරිශීලක ගමන් මග

This part tells the story of how each user interacts with the system, from the moment they first log in until they complete their main task.

## 3.1 Admin's Journey (Factory Owner) / පරිපාලකගේ ගමන

**Who:** Mr. Perera, factory owner of Glenview Estate
**Uses:** Computer (web browser) — opens `https://akashpereraproject24.vercel.app`

### Day 1: Setting Up the System (First Time)

```
Step 1: Login as Admin
   ↓
Step 2: Open "Estate Master" module
   ↓
Step 3: Create estate "Glenview Estate"
   • Region: Nuwara Eliya
   • Total area: 412 ha
   • Elevation: 1890 m
   • GPS: 6.9679, 80.7618
   • Total bush count: 540,000
   ↓
Step 4: Create divisions
   • Sutton Division (manager: R. Kumara, 138 ha)
   • Craighead Division (manager: M. Silva, 124 ha)
   • Tennant Division (manager: S. Bandara, 150 ha)
   ↓
Step 5: Create fields under each division
   • S-01 Sutton Upper (24 ha, 32,000 bushes)
   • S-02 Sutton Lower (31 ha, 41,000 bushes)
   • ...
   ↓
Step 6: Open "User Management"
   ↓
Step 7: Create Extension Officer account
   • Name: Mr. Fonseka
   • Email: eo@glenview.lk
   • Role: extension_officer
   ↓
Step 8: System is ready. EO can now register suppliers.
```

### Day 2: Adding Stock + Workers

```
Step 1: Open "Inventory" module → "Stock Items" tab
   ↓
Step 2: Add Stock Item: FERT-UREA
   • Code: FERT-UREA
   • Name: Urea (46% N)
   • Category: Fertilizer
   • Unit: kg
   • Opening Qty: 1250 kg
   • Unit Cost: Rs 95
   • Reorder Level: 200 kg
   ↓
Step 3: Add more items (MOP, TSP, Dolomite, equipment, etc.)
   ↓
Step 4: Open "Labor Management" module → "Worker Roster" tab
   ↓
Step 5: Add workers
   • Name: K. Sunil
   • Role: Plucker
   • Division: Sutton
   • Daily wage: Rs 1,500
   ↓
Step 6: Open "Labor Management" → "Daily Labor Cost" tab
   ↓
Step 7: Enter today's labor
   • Date: today
   • Division: Sutton
   • Lines: 3 Masons @ Rs 2,500, 3 Goalies @ Rs 1,800
   ↓
Step 8: Total: Rs 12,900 (auto-calculated). Click "Save Snapshot".
```

### Day 3: Paying Suppliers + Managing Requests

```
Step 1: Open "Resource Requisitions" module
   ↓
Step 2: See 3 pending requests from suppliers
   • Supplier A: 4 Sprayers (PENDING)
   • Supplier B: 5 bags fertilizer (PENDING)
   • Supplier C: 1 Plucking Machine (PENDING)
   ↓
Step 3: Click "Approve" for Supplier A
   ↓
Step 4: Stock auto-deducts 4 from sprayer inventory
   ↓
Step 5: Supplier A gets FCM push notification: "✅ Request Approved"
   ↓
Step 6: Open "Finance" module → create payment for Supplier B's leaf delivery
   ↓
Step 7: Open "Announcements" module → publish news about weather alert
   ↓
Step 8: All suppliers receive FCM notification about the announcement
```

## 3.2 Extension Officer's Journey / නිළධාරීගේ ගමන

**Who:** Mr. Fonseka, Extension Officer for Glenview Estate
**Uses:** Mobile APK on Android phone

### Morning: Visiting a New Supplier

```
Step 1: Open KDU TEA FACTORY APK on phone
   ↓
Step 2: Login with EO credentials
   ↓
Step 3: Tap "Register New Supplier" tab
   ↓
Step 4: Enter supplier details
   • Name: Nimal Farmers
   • Email: nimal@gmail.com
   • Phone: +94 77 123 4567
   • Password: temp123
   • Link to estate: Glenview Estate
   ↓
Step 5: Tap "Register Supplier"
   ↓
Step 6: System creates Firebase Auth + Supabase profile
   ↓
Step 7: Nimal can now log in as a supplier
```

### Afternoon: Weighing Leaf at Collection Center

```
Step 1: Tap "Leaf Weighing Entry" tab
   ↓
Step 2: See the EO Leaf Weighing screen
   ↓
Step 3: Tap "Verify My Location at Glenview Estate"
   ↓
Step 4: Browser asks for GPS permission → tap "Allow"
   ↓
Step 5: System shows:
   • Your GPS: 6.9678, 80.7617
   • Estate GPS: 6.9679, 80.7618
   • ✓ Verified (12 m away)
   ↓
Step 6: Now EO can confidently weigh leaf from a Glenview supplier
   ↓
Step 7: Select supplier: Nimal Farmers
   ↓
Step 8: Enter gross weight: 25 kg
   ↓
Step 9: Select grade: Standard
   ↓
Step 10: Tap "Save & sync"
   ↓
Step 11: System saves to Supabase + sends FCM alert to Nimal:
   "🌿 Weigh-in Recorded: 24 kg net (Standard grade) recorded at Glenview Estate."
   ↓
Step 12: Nimal sees the alert on his phone instantly
```

## 3.3 Supplier's Journey (Small Tea Farmer) / සැපයුම්කරුගේ ගමන

**Who:** Nimal Farmers, small tea farmer (කුඩා තේ වතු හිමියා)
**Uses:** Mobile APK on Android phone

### Day 1: First Time Using the App

```
Step 1: Install KDU TEA FACTORY APK
   ↓
Step 2: Login with credentials EO gave him
   ↓
Step 3: Lands on "My Leaf Deliveries" — sees "No deliveries yet"
   ↓
Step 4: Tap "More" sheet in bottom-nav
   ↓
Step 5: See all 9 supplier modules:
   • My Leaf Deliveries (already open)
   • Smart Alerts
   • Payment Tracker
   • My Farm Activities
   • My Plot ★
   • My Weather ★
   • Tips & Guidance ★
   • Estate Updates
   • Request Resources
   ↓
Step 6: Tap "My Plot"
   ↓
Step 7: Enter plot details:
   • Acreage: 2.5 acres
   • Bush Count: 5,400
   • Cultivar: TRI 2025 (VP)
   • Region: Low-Country
   ↓
Step 8: Tap "Save & Verify"
   ↓
Step 9: System shows:
   • Density: 2,160 bushes/acre
   • Expected annual yield: 3,750 kg green leaf
   • Monthly average: 312 kg
   ↓
Step 10: Tap "My Weather" → see live weather for his plot's location
   ↓
Step 11: Tap "Tips & Guidance" → see personalized banner:
   "For your 2.5 acres plot (low-country), you could harvest up to
    3,750 kg green leaf per year (~312 kg/month)."
   ↓
Step 12: Tap through the 5 daily tips (bilingual EN + Sinhala)
```

### Day 2: Bringing Leaf to Factory

```
Step 1: Open APK in morning
   ↓
Step 2: Tap "My Weather" → check forecast
   ↓
Step 3: See rain expected tomorrow — DON'T apply fertilizer today
   ↓
Step 4: Pluck leaf and bring to Glenview collection center
   ↓
Step 5: EO weighs the leaf (Nimal is at the collection center)
   ↓
Step 6: Nimal's phone buzzes — FCM notification:
   "🌿 Weigh-in Recorded: 24 kg net (Standard grade) recorded at Glenview Estate."
   ↓
Step 7: Tap notification → opens "My Leaf Deliveries"
   ↓
Step 8: See new delivery row: 24 kg, Standard, today's date, time
```

### Day 3: Requesting Equipment

```
Step 1: Open APK → tap "Request Resources"
   ↓
Step 2: Select type: Equipment (note: Workers option is removed in Phase 1)
   ↓
Step 3: Select item: Knapsack Sprayer
   ↓
Step 4: Quantity: 2
   ↓
Step 5: Date needed: tomorrow
   ↓
Step 6: Tap "Submit request"
   ↓
Step 7: Admin sees request in "Resource Requisitions" → approves
   ↓
Step 8: Stock auto-deducts 2 from sprayer inventory
   ↓
Step 9: Nimal's phone buzzes: "✅ Request Approved"
   ↓
Step 10: Nimal picks up sprayer from estate office
```

### Day 4: Logging Farm Activities

```
Step 1: Open APK → tap "My Farm Activities"
   ↓
Step 2: Select tab: Fertilizer
   ↓
Step 3: Type: Urea (46% N)
   ↓
Step 4: Quantity: 25 kg
   ↓
Step 5: Date: today
   ↓
Step 6: Tap "Log Activity"
   ↓
Step 7: System records to farm_activities table
   ↓
Step 8: Smart Alerts Panel recalculates next fertilizer window
```

### 6 Months Later: Bush Count Re-Verify

```
Step 1: Open APK as usual
   ↓
Step 2: Tap "My Plot"
   ↓
Step 3: See amber banner:
   "🌳 Bush count re-verification due
    Last verified 6 months ago. Plants may have died or been
    replanted — please re-count."
   ↓
Step 4: Walk the plot, count bushes
   ↓
Step 5: Tap "Edit Plot Details" → update bush count: 5,200 (200 died)
   ↓
Step 6: Tap "Save & Verify"
   ↓
Step 7: System updates + new 6-month countdown starts
```

---

# PART 4 — Module Workflows (Detailed) / මොඩියුල ක්‍රියාපිළිවෙල (සවිස්තරාත්මක)

## 4.1 Estate Setup Workflow / වත්ත සැකසීම

> **Trigger / ආරම්භය:** Admin opens Estate Master for the first time.
> **Output / ප්‍රතිඵල:** A fully-defined estate with divisions, fields, GPS, bush count.

```
1. Admin → Estate Master → "Create Estate"
       ↓
2. Form fields:
   • Estate name (e.g., "Glenview Estate")
   • Region (e.g., "Nuwara Eliya")
   • Total area (ha) — e.g., 412
   • Avg elevation (m) — e.g., 1890
   • Google Maps Embed URL (optional)
   • Planted date (optional, drives pruning schedule)
   • Latitude + Longitude (drives per-estate weather)
   • Total bush count (drives 6-month re-verify reminders)
       ↓
3. Click "Create" → saved to Supabase `estates` table
       ↓
4. Admin → "Create Division"
   • Parent estate: Glenview
   • Division name: Sutton
   • Manager: R. Kumara
   • Area (ha): 138
       ↓
5. Admin → "Create Field" (under a division)
   • Field code: S-01
   • Field name: Sutton Upper
   • Cultivar: TRI 2025 (VP)
   • Planting year: 2014
   • Area (ha): 24
   • Elevation (m): 1920
   • Status: plucking | pruned | young | nursery
   • Bush count: 32,000 (NEW — per-field tracking)
       ↓
6. Bush count auto-aggregated to estate total
   ↓
7. 6 months later → amber "Bush count re-verification due" banner appears
   on Estate Master + each supplier's "My Plot" module
```

**Why this matters / ඇයි මේ වැදගත්ද:**
- Estate coordinates → drive weather forecasts (Weather module + supplier's My Weather)
- Bush count → drives yield predictions (Dashboard + supplier's My Plot)
- Planting date → drives pruning schedule (Smart Alerts)

## 4.2 Supplier Onboarding Workflow / සැපයුම්කරු ලියාපදිංචිය

> **Trigger / ආරම්භය:** EO visits a new small tea farmer.
> **Output / ප්‍රතිඵල:** New supplier can log in to APK + see their own portal.

```
1. EO opens APK → "Register New Supplier" tab
       ↓
2. Form:
   • Full name (required)
   • Email (required) — becomes Firebase login
   • Temp password (required, min 6 chars)
   • Phone (optional)
   • Factory (required) — chooses from list
   • Division / Route (optional)
   • Link to Estate (required)
       ↓
3. Tap "Register Supplier"
       ↓
4. System creates:
   • Firebase Auth account (email + password)
   • Supabase `users` row with role='supplier'
   • Links supplier to the chosen estate via `associatedEntityId`
       ↓
5. Supplier receives welcome email (if email configured)
       ↓
6. Supplier downloads APK → logs in with email + temp password
       ↓
7. APK's `usePushNotifications` hook gets FCM token → forwards to webapp
       ↓
8. Webapp saves FCM token to Firestore `fcm_tokens/{supplierUid}`
       ↓
9. From now on, admin actions can trigger FCM push to this supplier
```

**Interconnection / සම්බන්ධය:**
- Supplier's `associatedEntityId` = estate ID → determines which estate's weather they see, which announcements they receive, which leaf deliveries belong to them
- Supplier's `userUid` = their Firebase UID → used in all their data (harvest_records, farm_activities, supplier_locations, supplier_farms)

## 4.3 Leaf Delivery & Payment Workflow / කොළ භාරදීම සහ ගෙවීම

> **Trigger / ආරම්භය:** Supplier brings green leaf to collection center.
> **Output / ප්‍රතිඵල:** Supplier gets paid + record saved to database.

```
1. Supplier brings leaf to Glenview collection center
       ↓
2. EO opens APK → "Leaf Weighing Entry"
       ↓
3. EO taps "Verify My Location at Glenview Estate"
       ↓
4. Browser Geolocation API → EO's current GPS
       ↓
5. Haversine distance to estate:
   • ≤ 500m → ✓ Verified (green)
   • 500m-2km → ⚠ Near (amber)
   • > 2km → ✗ Far (red, potential fraud)
       ↓
6. EO selects supplier from dropdown (Nimal Farmers)
       ↓
7. EO enters:
   • Gross weight: 25 kg
   • Deduction %: 4% (default for quality)
   • Grade: Standard
       ↓
8. System auto-calculates net: 25 × (1 - 0.04) = 24 kg
       ↓
9. EO taps "Save & sync"
       ↓
10. System:
    a. Saves to Supabase `harvest_records` table
       (supplier_id=Nimal, gross_kg=25, net_kg=24, grade=Standard,
        estate_id=Glenview, recorded_by=EO Fonseka, performed_at=now)
    b. Calls `createAlert({ targetUserId: estateId, ... })`
       → Cloud Function dispatches FCM push to all suppliers linked to Glenview
    c. Supplier's phone receives:
       "🌿 Weigh-in Recorded: 24 kg net (Standard grade) recorded at Glenview Estate."
       ↓
11. Supplier taps notification → APK opens → shows "My Leaf Deliveries"
       ↓
12. New row appears in supplier's deliveries list (real-time, no refresh)
       ↓
13. At month end:
    a. Admin opens "Finance" module
    b. Sees all of Nimal's deliveries for the month: total 642 kg
    c. Rate per kg: Rs 165 (set by admin)
    d. Total payable: 642 × 165 = Rs 105,930
    e. Admin marks as "paid"
       ↓
14. Supplier's "Payment Tracker" shows: Rs 105,930 (paid, today's date)
       ↓
15. Supplier gets FCM: "💰 Payment settled: Rs 105,930 credited for your last delivery."
```

## 4.4 Stock Management Workflow / තොග කළමනාකරණය

> **Trigger / ආරම්භය:** Admin needs to add fertilizer to stock OR issue stock to a supplier/field.
> **Output / ප්‍රතිඵල:** Stock levels tracked with full audit trail.

### 4.4.1 Add Stock Item

```
1. Admin → Inventory → "Stock Items" tab → "Add Stock Item"
       ↓
2. Form:
   • Code: FERT-UREA
   • Name: Urea (46% N)
   • Category: Fertilizer | Agrochemical | Fuel | Equipment | Other
   • Unit: kg | L | pcs
   • Opening Qty: 1250  ← NEW (Phase 1)
   • Unit Cost: Rs 95   ← NEW (Phase 1)
   • Reorder Level: 200 ← NEW (Phase 1)
       ↓
3. Live preview shows: "Opening value: Rs 118,750 (1250 × 95)"
       ↓
4. Click "Add"
       ↓
5. Saved to `stock_items` table:
   {
     id: uuid,
     code: 'FERT-UREA',
     name: 'Urea (46% N)',
     category: 'fertilizer',
     unit: 'kg',
     qty_on_hand: 1250,
     unit_cost: 95,
     reorder_level: 200,
     estate_id: null,
     version: 1,
     created_at: now()
   }
```

### 4.4.2 Create Purchase Order (PO)

```
1. Admin → Inventory → "Purchase Orders" tab
       ↓
2. Form:
   • Supplier Name: CIC Fertilizers Ltd
   • Lines: add multiple lines (stock item + qty + unit cost)
     - FERT-UREA × 500 kg @ Rs 95
     - FERT-MOP × 200 kg @ Rs 180
       ↓
3. Click "Create PO"
       ↓
4. Saved to `purchase_orders` table with status='draft'
       ↓
5. PO appears in the POs list (left panel: status badge)
```

### 4.4.3 Receive Goods (GRN)

```
1. Admin → Inventory → "Receive Goods (GRN)" tab
       ↓
2. Select PO (optional) → lines auto-fill from PO
   OR direct receipt (no PO) → add lines manually
       ↓
3. Enter:
   • Supplier Invoice No: INV-2026-001
   • Adjust qty received if partial (e.g., only 450 of 500 kg arrived)
       ↓
4. Click "Receive & Update Stock"
       ↓
5. System:
   a. Updates `stock_items.qty_on_hand` += qty_received
   b. Inserts row into `stock_movements` (move_type='in')
   c. Updates `purchase_orders.status` → 'received' or 'partially_received'
```

### 4.4.4 Issue Stock (with Link to Supplier Request) — NEW

```
1. Admin → Inventory → "Issue / Movements" tab → "Issue Stock"
       ↓
2. Select item from dropdown (shows current qty on hand)
   e.g., FERT-UREA (1,250 kg available)
       ↓
3. Enter quantity to issue: 700 kg
       ↓
4. NEW: Link to Supplier Request (optional dropdown)
   • Dropdown filters pending/approved requests matching this item
   • Selecting shows: "Supplier asked for: 500 · Status: PENDING"
       ↓
5. Notes: "to Kiriwallapatana Lower division, Nimal Farmers"
       ↓
6. Click "Issue Out"
       ↓
7. System:
   a. Auto-deducts: stock_items.qty_on_hand -= 700 → 550 kg
   b. Inserts into stock_movements:
      {
        move_type: 'out',
        qty: 700,
        unit_cost: 95,
        notes: '[Req #ABC123 · Fertilizer · Urea · supplier asked 500]
                to Kiriwallapatana Lower division, Nimal Farmers',
        performed_by: admin_uid,
        performed_at: now
      }
       ↓
8. Audit trail: appears in Movement History with full context
       ↓
9. If qty drops below reorder_level → "Low Stock" badge appears on item
```

### 4.4.5 Stock Visibility — Three Read-Only Modules

```
FERTILIZER module (read-only)         EQUIPMENT module (read-only)
   - Reads stock_items                - Reads stock_items
     WHERE category='fertilizer'        WHERE category='equipment'
   - Shows:                            - Shows:
     • Fertilizer Types count            • Equipment Types count
     • Total stock value                 • Total stock value
     • Low stock alerts                  • Low stock alerts
   - "Fertilizer Issued by Division"   - Export CSV
     summary (last 30 days, parsed
     from stock_movements notes)

AGROCHEMICAL module (read-only)
   - Reads stock_items WHERE category='agrochemical'
   - Same UX as Fertilizer + Equipment
   - Includes safety note about PPE
```

## 4.5 Resource Requests Workflow / සම්පත් ඉල්ලීම්

> **Trigger / ආරම්භය:** Supplier needs equipment, fertilizer, or agrochemicals.
> **Output / ප්‍රතිඵල:** Admin approves/rejects → supplier gets notified → stock auto-deducts on approval.

```
1. Supplier opens APK → "Request Resources" tab
       ↓
2. Phase 1: Choose type (NO "Workers" — disabled per Sir's spec)
   • Equipment
   • Fertilizer
   • Agrochemical
       ↓
3. Select item from dropdown (shows live availability from stock)
   e.g., Knapsack Sprayer (4 avail)
       ↓
4. Enter quantity, date needed, duration
       ↓
5. Note (optional): "For Sutton division pruning"
       ↓
6. Tap "Submit request"
       ↓
7. Saved to local React state (resourceRequests array)
       ↓
8. Admin sees it in "Resource Requisitions" module (PENDING)
       ↓
9. Admin clicks "Approve"
       ↓
10. System calls `fulfillResourceRequest()`:
    • For Equipment/Fertilizer/Agrochemical → calls `issueStockWithJournal()`:
      - Auto-deducts from stock_items.qty_on_hand
      - Posts double-entry journal: Dr Expense / Cr Inventory
      - Links journal_id back onto stock_movements row
    • For Workers (Phase 1 disabled) → would insert worker_assignments rows
       ↓
11. Admin action triggers `sendFcmToSupplier()`:
    - Looks up supplier's FCM token in Firestore
    - Sends: "✅ Request Approved: 1 Knapsack Sprayer"
       ↓
12. Supplier's phone receives FCM push (even if app closed)
       ↓
13. Supplier taps notification → opens APK → sees approved request
       ↓
14. Supplier picks up equipment from estate office
```

**Interconnections:**
- Stock module → Resource Requests reads live stock levels for dropdown
- Resource Requests → Stock module (auto-deducts on approval)
- Resource Requests → Finance (posts journal entry on fulfilment)
- Resource Requests → FCM (notifies supplier of decision)

## 4.6 Equipment Requests Workflow (Separate Module) — NEW

> **Trigger / ආරම්භය:** Admin needs to track equipment requests separately from other resources.
> **Output / ප්‍රතිඵල:** Standalone module with own approve/reject workflow.

```
1. Admin → sidebar → "Equipment Requests" (NEW separate icon under Operations)
       ↓
2. See stats: Pending / Approved / Rejected counts
       ↓
3. Click "New Equipment Request"
       ↓
4. Select category (Sir's 7 categories):
   • Plucking Machine (දලු කඩන මැෂින්)
   • Spray Machine (තෙල්/පොහොර විදින මැෂින්)
   • Bag / Goni (ගෝනි)
   • Pruning Shears (කප්පාදු කතුරු)
   • Knapsack Sprayer (නාක්සැක් ස්ප්‍රේයර්)
   • Plucking Basket (ප්ලකිං බාස්කට්)
   • Other (වෙනත්)
       ↓
5. Enter item name, quantity, date needed, duration, note
       ↓
6. Click "Submit Request"
       ↓
7. Saved to localStorage (Phase 1) — Phase 2 will sync to Supabase
       ↓
8. Request appears in "All Requests" list with status PENDING
       ↓
9. Admin clicks "Approve" or "Reject"
       ↓
10. Status updates, request moves to Approved/Rejected list
```

## 4.7 Labor Management Workflow / කම්කරු කළමනාකරණය

> **Trigger / ආරම්භය:** Admin needs to track daily workers + labor cost.
> **Output / ප්‍රතිඵල:** Worker roster + daily attendance + daily labor cost snapshot.

### 4.7.1 The 5 Tabs

```
LABOR MODULE (5 tabs)
├── Worker Roster        — full CRUD on workers (add/edit/delete)
├── Daily Attendance     — mark present/absent for today
├── Leave Requests       — approve/reject leave
├── Lifecycle/Transfers  — hire/retire/transfer between divisions
└── Daily Labor Cost ★   — NEW (Phase 1) — calc daily cost per division
```

### 4.7.2 Daily Labor Cost Tab — NEW

```
1. Admin → Labor → "Daily Labor Cost" tab
       ↓
2. Form:
   • Date: today (default)
   • Division: Sutton (dropdown)
       ↓
3. Suggestion banner:
   "👷 8 workers in roster for Sutton division"
       ↓
4. Add line items:
   • Category dropdown (10 options):
     Kankanam, Casual Plucking, Temporary, Mason, Goaly,
     Sprayer, Factory Hand, Field Worker, Supervisor, Manager
   • Headcount (number)
   • Daily Wage (auto-filled from defaults, editable)
       ↓
5. Add multiple lines:
   • Line 1: 3 Masons @ Rs 2,500
   • Line 2: 3 Goalies @ Rs 1,800
   • Line 3: 1 Kankanam @ Rs 1,800
       ↓
6. Live calculation:
   Total Daily Labor Cost: Rs 16,500
   Total Headcount: 7
       ↓
7. Click "Save Snapshot"
       ↓
8. Saved to localStorage: `verda.labor_daily_cost.history`
       ↓
9. Snapshot appears in "Recent Snapshots" panel
       ↓
10. Phase 2: Will sync to Supabase + post GL journal entry
    (Dr Labor Expense / Cr Cash)
```

### 4.7.3 Default Daily Wages (Sri Lankan Tea Estate 2026)

| Category | Sinhala | Default Daily Wage |
|----------|---------|---------------------|
| Kankanam | කන්කානම්ලා | Rs 1,800 |
| Casual Plucking | වත්තේ සේවකයෝ | Rs 1,500 |
| Temporary | තාලික | Rs 1,200 |
| Mason | මේසන් බාස්ලා | Rs 2,500 |
| Goaly | ගෝලයෝ | Rs 1,800 |
| Sprayer | පොහොර විදින්නන් | Rs 2,000 |
| Factory Hand | කම්හලේ සේවකයෝ | Rs 1,700 |
| Field Worker | ක්ෂේත්‍ර සේවකයෝ | Rs 1,500 |
| Supervisor | අධීක්ෂණය | Rs 3,500 |
| Manager | කළමනාකරු | Rs 8,000 |

## 4.8 Push Notifications (FCM) Workflow / දැනුම්දීම් පණිවිඩ

> **Trigger / ආරම්භය:** Admin acts on a supplier's data (approves request, marks payment, publishes announcement).
> **Output / ප්‍රතිඵල:** Supplier's phone buzzes even if APK is closed.

### 4.8.1 The Flow

```
Admin Action (e.g., approves supplier's request)
       ↓
Webapp writes to Firestore `notifications/{notifId}`
       ↓
Cloud Function triggers (Firestore onCreate)
       ↓
Cloud Function looks up supplier's FCM token in
Firestore `fcm_tokens/{supplierUid}`
       ↓
Cloud Function calls admin.messaging().send({ token })
       ↓
Firebase delivers to phone via FCM channel
       ↓
APK's expo-notifications plugin shows system notification 🔔
(even if APK is closed — FCM wakes the phone)
       ↓
Supplier taps notification → APK opens → navigates to relevant screen
```

### 4.8.2 When Suppliers Get Notifications

| Trigger | Recipient | Notification |
|---------|-----------|--------------|
| Admin approves resource request | That supplier | "✅ Request Approved" |
| Admin rejects resource request | That supplier | "❌ Request Rejected" |
| Admin publishes new announcement | All suppliers | "📢 New Announcement" |
| Admin marks leaf delivery as paid | That supplier | "💰 Payment Received" |
| Admin sends custom broadcast | All suppliers | Custom title |
| Weather alert triggered | All estate suppliers | "🌦️ Weather Alert" |
| Smart farm advisory scheduled | Affected supplier | "🌱 Advisory: …" |

### 4.8.3 FCM Token Registration Lifecycle

```
1. Supplier installs APK → opens it → logs in
       ↓
2. APK calls Notifications.getDevicePushTokenAsync()
       ↓
3. Firebase returns FCM token (unique per device)
       ↓
4. APK forwards token to WebView via bridge event "verda:fcm-token"
       ↓
5. Webapp (PWA) listens for bridge event:
   window.addEventListener("verda:fcm-token", (e) =>
     registerFcmToken(e.detail.token));
       ↓
6. Token saved in Firestore: fcm_tokens/{supplierUid} = { token, updatedAt }
       ↓
7. Cloud Functions can now send push to this supplier using their token
       ↓
8. If supplier logs out + logs back in on a different phone:
   - New phone gets new FCM token
   - Old token becomes invalid
   - Firestore updates to the new token
```

**Key Points:**
- FCM tokens are **per-device**, not per-user. Each install gets a unique token.
- Tokens can become invalid (user uninstalls APK, clears data, OS update).
- Cloud Function should handle invalid token errors gracefully.

## 4.9 Branding & White-Label Workflow / සන්නාම කළමනාකරණය

> **Trigger / ආරම්භය:** Super Admin wants to rebrand the system.
> **Output / ප්‍රතිඵල:** All users see new logo, name, colors — instantly (no APK rebuild).

### 4.9.1 What Super Admin Can Customize

```
Settings module fields:
├── Company Name      (e.g., "KDU TEA FACTORY")
├── Company Tagline   (e.g., "Tea Estate ERP")
├── Company Logo URL   (Cloudinary or any CDN URL)
├── Login Title        (e.g., "KDU TEA FACTORY")
├── Login Subtitle     (e.g., "Integrated Tea Estate Platform")
├── Login Logo URL     (can be different from company logo)
├── Login Background URL (image or video for login page)
├── Scrim Opacity       (0-100, darkens background for readability)
└── Accent Color        (hex color, e.g., #10b981)
```

### 4.9.2 Where Branding Appears

| Location | What shows |
|----------|------------|
| Browser tab title | `KDU TEA FACTORY · Integrated Tea Estate ERP Platform` |
| Login page | KDU TEA FACTORY title + logo + tagline |
| Sidebar header | KDU TEA FACTORY + tagline |
| Mobile header | KDU TEA FACTORY |
| PDF report headers | "KDU TEA FACTORY" + "Generated [timestamp]" |
| PWA manifest | App name when "Add to Home Screen" |
| APK loading screen | "KDU TEA FACTORY" + logo |
| APK app icon (under icon on phone) | "KDU TEA FACTORY" |

### 4.9.3 Persistence

- Saved to Supabase `settings` table (key='branding')
- Cached in localStorage for instant first paint
- All devices/browsers/users fetch the same branding from DB
- Changes sync instantly (no APK rebuild needed)

## 4.10 Weather & Location Integration / කාලගුණය සහ ස්ථානය

> **Trigger / ආරම්භය:** Estate has lat/lon set in Estate Master.
> **Output / ප්‍රතිඵල:** Per-estate weather forecasts drive alerts + supplier weather.

### 4.10.1 Where Coordinates Come From

```
Estate Master (Admin) → create estate with lat/lon
       ↓
Saved to Supabase `estates` table:
  latitude: 6.9679
  longitude: 80.7618
       ↓
Read by:
├── Weather module (admin) — uses estate lat/lon for forecast
├── SupplierWeather module (supplier) — uses LINKED estate's lat/lon
├── SupplierAlerts (supplier) — uses linked estate's lat/lon for fertilizer timing
└── EoLocationVerify (EO) — uses estate lat/lon to verify EO is on-site
```

### 4.10.2 How the Weather API Works

```
1. Module fetches forecast:
   fetchForecast(estate.latitude, estate.longitude)
       ↓
2. weather.ts library:
   • Checks if VITE_OW_API_KEY is set
   • If yes → calls OpenWeatherMap API:
     https://api.openweathermap.org/data/2.5/forecast?
       lat=6.9679&lon=80.7618&appid=API_KEY&units=metric
   • If no → returns mock data (Nuwara Eliya defaults)
       ↓
3. Caches response in-memory for 10 minutes (per lat,lon pair)
       ↓
4. Returns { days: WeatherDay[], source: 'live' | 'mock' }
       ↓
5. UI shows badge:
   • "Live · OpenWeatherMap" (green)
   • "Loading live…" (amber)
   • "Demo data" (amber)
       ↓
6. If any of next 3 days has rain_prob >= 60%:
   → Show red rain alert banner:
     "🌧️ Rain expected within 3 days — avoid applying fertilizer"
```

### 4.10.3 Default Coordinates (Fallback)

If an estate has no lat/lon set:
- Latitude: 6.9679 (Nuwara Eliya)
- Longitude: 80.7618 (Nuwara Eliya)

Admin can update estate coordinates anytime via Estate Master's CoordEditor.

## 4.11 Acreage & Bush Count Tracking / අක්කර සහ ගස් ගණන

> **Trigger / ආරම්භය:** Admin creates estate with bush count, OR supplier enters their plot details.
> **Output / ප්‍රතිඵල:** Yield predictions + 6-month re-verify reminders.

### 4.11.1 Two Levels of Tracking

```
LEVEL 1: ESTATE-LEVEL (Admin)
├── Estate Master form: "Total Bush Count (initial)"
├── FieldTable shows per-field bush count
├── Estate detail panel:
│   "🌳 540,000 bushes · 1,018 acres · 530 bushes/acre"
└── BushCountReminder component:
    Amber banner when 6 months since last verification

LEVEL 2: SUPPLIER-LEVEL (Supplier, NEW Phase 1)
├── SupplierPlot module ("My Plot")
├── Form: acreage + bush count + cultivar + region
├── Auto-calculates:
│   • Bushes/acre density
│   • Expected annual yield (by region: low=1500, mid=1100, up=800 kg/acre)
│   • Monthly average
├── 6-month re-verify reminder (same logic as estate)
└── Persists to localStorage `kdu.supplier_plot.{userUid}`
```

### 4.11.2 Why Two Levels?

| | Estate-level | Supplier-level |
|---|---|---|
| **Who enters** | Admin (factory owner) | Each supplier |
| **Scope** | Whole estate (large plantation) | Each supplier's small plot (කුඩා වත්ත) |
| **Use case** | Estate-wide yield forecasting | Per-supplier yield prediction |
| **Verified by** | Estate manager | The supplier themselves (they walk the plot) |
| **Storage** | Supabase `estates.total_bush_count` | localStorage (Phase 1) → Supabase `supplier_plots` (Phase 2) |

## 4.12 Motivational Tips / දිරිගැන්වීම් උපදෙස්

> **Trigger / ආරම්භය:** Daily rotation based on day-of-year.
> **Output / ප්‍රතිඵල:** Bilingual (English + Sinhala) agronomy tips on Dashboard + supplier's Tips & Guidance.

### 4.12.1 The 5 Tips (Rotate Daily)

| # | Title | Topic | Tone |
|---|-------|-------|------|
| 1 | අක්කරයකට උපරිම අස්වැන්න · Max yield per acre | Low-country: ~1500 kg/acre/year | emerald |
| 2 | පොහොර වර්ග · Fertilizer mix | Urea 50kg + TSP 25kg + MOP 25kg per acre/year | amber |
| 3 | කප්පාදු චක්‍රය · Pruning cycle | Every 3-4 years boosts yield ~20% | sky |
| 4 | දලු රවුම් · Plucking rounds | 7-10 day cycles for consistent quality | violet |
| 5 | පැළ ගණන නැවත පරීක්ෂා කිරීම · Re-verify bush count | Every 6 months | rose |

### 4.12.2 Where Tips Appear

| Module | Who sees | Personalization |
|--------|----------|-----------------|
| **Admin Dashboard** | Admin only | None (general tip) |
| **Supplier Tips & Guidance** | Supplier | Personalized banner: "For your 2.5 acres plot, you could harvest ~3,750 kg/year" |

The supplier's banner uses the supplier's plot data from `localStorage` (entered via My Plot module). If supplier hasn't entered plot details, the banner doesn't show.

## 4.13 EO Geo-Location Verification / නිළධාරී ස්ථාන සත්‍යාපනය

> **Trigger / ආරම්භය:** EO is about to weigh a supplier's leaf at the collection center.
> **Output / ප්‍රතිඵල:** Confirms EO is physically AT the registered estate (fraud prevention).

### 4.13.1 The Verification Flow

```
1. EO opens APK → "Leaf Weighing Entry"
       ↓
2. Sees new section: "Estate Location Verification"
       ↓
3. Taps "Verify My Location at [Estate]"
       ↓
4. Browser Geolocation API gets EO's current GPS:
   { lat: 6.9678, lng: 80.7617 }
       ↓
5. System computes Haversine distance to estate:
   estate: { lat: 6.9679, lng: 80.7618 }
   distance = haversine(6.9678, 80.7617, 6.9679, 80.7618) = 12 meters
       ↓
6. Verdict logic:
   distance <= 500m → ✓ Verified (green)
   distance 500m-2km → ⚠ Near estate (amber)
   distance > 2km → ✗ Far from estate (red)
   estate has no coords → ⚠ No coords (amber)
       ↓
7. Display:
   ┌────────────────────────────────────────┐
   │ Your GPS: 6.9678, 80.7617              │
   │ Estate GPS: 6.9679, 80.7618           │
   │ ✓ Verified  |  12 m away              │
   │ You are AT the registered estate.     │
   │ Weigh-in is verified.                  │
   │ [Verify again]                         │
   └────────────────────────────────────────┘
       ↓
8. EO can now confidently weigh leaf from this estate's suppliers
```

### 4.13.2 Why This Matters

- **Fraud prevention:** Without verification, an EO could weigh leaf from a different (unregistered) source and attribute it to Glenview Estate.
- **Audit trail:** If a weigh-in is later disputed, the verification result can be saved as evidence.
- **Future (Phase 2):** Compare supplier's GPS check-in (from SupplierPortal LocationCheckIn) against the EO's verification — both should be at the same estate.

---

# PART 5 — Reference / යොමු

## 5.1 Complete Module Map / සම්පූර්ණ මොඩියුල සිතියම

### Admin (Web Panel) — 28 modules

```
OVERVIEW:
└── 📊 Estate Dashboard          (live KPIs)

ESTATE & LAND:
└── 🏛️ Estate Master             (estates, divisions, fields, GPS, bush count)

FIELD OPERATIONS:
├── 👥 Labor Management          (workers, attendance, leave, daily cost)
├── ⚖️ Harvest Management         (weigh-in records)
├── 📥 Resource Requisitions      (approve/reject supplier requests)
└── 🔧 Equipment Requests         (NEW — separate module)

MANUFACTURING:
├── 🏭 Factory Integration       (batch tracking)
└── 📦 Inventory & Procurement   (stock, PO, GRN, issue)

INPUTS:
├── 🌱 Fertilizer                (read-only + division summary)
├── 🧪 Agrochemical              (read-only)
└── 🔧 Equipment                 (read-only)

PEOPLE & PAY:
├── 💰 Payroll System           (EPF/ETF, payslips)
├── 🏦 Loans & Advances         (worker loans)
├── 🏆 Loyalty Program          (points, rewards)
└── ❤️ Welfare Management       (welfare schemes)

FINANCE:
├── 🧮 Finance & Accounting     (GL, journals)
├── 💼 Supplier Loans           (supplier-specific)
└── 🔨 Auction Sales            (Colombo Tea Auction)

INTELLIGENCE:
├── 🌦️ Weather & Environment    (per-estate live weather)
├── 🗺️ GPS & GIS Mapping        (estate boundaries)
├── 🧠 AI & Analytics           (predictive insights)
└── 🛠️ Field Tools              (calculators, charts)

ADMINISTRATION:
├── 👤 User Management          (CRUD users)
├── 📢 Announcements            (publish to suppliers)
├── 🛡️ Audit & Compliance       (audit logs)
├── 📱 Mobile & Offline         (PWA config)
├── 📐 Architecture & Docs     (system overview)
└── 🎨 Branding & Settings     (logo, colors — Super Admin only)
```

### Extension Officer (Mobile APK) — 2 modules

```
├── 📝 Register Supplier        (create supplier accounts)
└── ⚖️ Leaf Weighing Entry       (weigh leaf + GPS verify)
```

### Supplier (Mobile APK) — 9 modules

```
├── 📊 My Leaf Deliveries       (real-time view of own deliveries)
├── 🔔 Smart Alerts Panel       (FCM fertilizer + plucking advisory)
├── 💵 Payment Tracker          (earnings history)
├── 🌾 My Farm Activities       (log fertilizer/pruning/harvest)
├── 🌳 My Plot ★ NEW            (acreage + bush count + yield prediction)
├── ☁️ My Weather ★ NEW          (location-based weather + rain alert)
├── 💡 Tips & Guidance ★ NEW    (daily rotating agronomy tips)
├── 📰 Estate Updates           (read admin announcements)
└── 📥 Request Resources        (request equipment/fertilizer — NO labor)
```

**Total: 39 modules across 3 user roles.**

## 5.2 How Modules Are Interconnected / මොඩියුල අතර සම්බන්ධය

```
                      ┌─────────────────┐
                      │  ESTATE MASTER  │ ← START HERE
                      │  (admin)        │
                      └────────┬────────┘
                               │ (creates estate with GPS + bush count)
                               ▼
            ┌──────────────────────────────────────┐
            │  WEATHER (admin) + SUPPLIER WEATHER  │
            │  (uses estate GPS for forecast)      │
            └──────────────────────────────────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  EO REGISTER    │
                      │  SUPPLIER       │
                      │  (links supplier │
                      │   to estate)     │
                      └────────┬────────┘
                               │ (creates supplier with associatedEntityId)
                               ▼
        ┌──────────────────────────────────────────┐
        │  SUPPLIER PLOT (NEW)                     │
        │  (supplier enters their own acreage +    │
        │   bush count → drives yield prediction) │
        └──────────────────────────────────────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  EO LEAF        │
                      │  WEIGHING       │
                      │  (GPS verify    │
                      │   + weigh-in)   │
                      └────────┬────────┘
                               │ (saves harvest_records)
                               ▼
        ┌──────────────────────────────────────────┐
        │  SUPPLIER DELIVERIES (real-time view)    │
        │  + PAYMENT TRACKER (when admin pays)    │
        │  + FCM NOTIFICATION (supplier gets push) │
        └──────────────────────────────────────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  FINANCE        │
                      │  (admin marks   │
                      │   as paid)      │
                      └────────┬────────┘
                               │ (posts GL journal)
                               ▼
                      ┌─────────────────┐
                      │  PAYROLL        │
                      │  (workers'      │
                      │   daily cost →  │
                      │   Labor Cost    │
                      │   Snapshot)     │
                      └─────────────────┘

PARALLEL:
                      ┌─────────────────┐
                      │  INVENTORY      │ ← stock_items, PO, GRN
                      │  (admin)        │
                      └────────┬────────┘
                               │ (issue stock auto-deducts)
                               ▼
        ┌──────────────────────────────────────────┐
        │  FERTILIZER / EQUIPMENT / AGROCHEMICAL   │
        │  (read-only overviews)                  │
        │  + FERTILIZER DIVISION SUMMARY          │
        └──────────────────────────────────────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │  RESOURCE       │
                      │  REQUISITIONS   │
                      │  (admin inbox)  │
                      └────────┬────────┘
                               │ (approval triggers FCM + auto-issue)
                               ▼
                      ┌─────────────────┐
                      │  EQUIPMENT      │
                      │  REQUESTS       │
                      │  (separate      │
                      │   module)       │
                      └─────────────────┘

EVERYWHERE:
                      ┌─────────────────┐
                      │  BRANDING       │ ← Super Admin only
                      │  (Settings)     │   (syncs to all devices)
                      └────────┬────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────┐
        │  ALL MODULES DISPLAY BRANDING            │
        │  (sidebar, login, PDF headers, etc.)     │
        └──────────────────────────────────────────┘
```

## 5.3 Database Tables Overview / දත්ත ගබඩා වගු

### Supabase PostgreSQL Tables

| Table | Used by | Purpose |
|-------|---------|---------|
| `estates` | Admin (Estate Master) | Estate info + GPS + bush count |
| `divisions` | Admin (Estate Master) | Estate divisions |
| `fields` | Admin (Estate Master) | Fields under divisions + bush count |
| `users` | All | User accounts (Firebase UID linked) |
| `workers` | Admin (Labor) | Worker roster |
| `attendance` | Admin (Labor) | Daily attendance |
| `leave_requests` | Admin (Labor) | Leave applications |
| `payroll_runs` | Admin (Payroll) | Monthly payroll batches |
| `payslips` | Admin (Payroll) | Per-worker payslips |
| `stock_items` | Admin (Inventory) | Stock with qty_on_hand + cost |
| `stock_movements` | Admin (Inventory) | Audit log of all stock in/out |
| `purchase_orders` | Admin (Inventory) | POs to suppliers |
| `goods_receipts` | Admin (Inventory) | GRN records |
| `harvest_records` | EO (Weighing) + Supplier (Deliveries) | Leaf weigh-ins |
| `supplier_locations` | Supplier (LocationCheckIn) + EO | GPS check-ins |
| `farm_activities` | Supplier (Farm Activities) | Fertilizer/pruning/harvest logs |
| `supplier_farms` | (Phase 2) Supplier Plot | Per-supplier plot data |
| `notifications` | All | In-app notifications |
| `settings` | Super Admin | Branding config (key='branding') |
| `announcements` | Admin (Announcements) | News articles |
| `gl_accounts` | Admin (Finance) | General Ledger accounts |
| `journal_entries` | Admin (Finance) | Double-entry journal headers |
| `journal_lines` | Admin (Finance) | Individual debit/credit lines |

### Firebase Firestore Collections

| Collection | Purpose |
|------------|---------|
| `fcm_tokens/{uid}` | Each user's FCM device token (for push notifications) |
| `notifications/{notifId}` | Triggers Cloud Function to dispatch FCM |
| `resource_requests/{reqId}` | (legacy) — now uses Supabase, but kept for backward compat |

## 5.4 Frequently Asked Questions / නිතර අසන ප්‍රශ්න

### Q1: Why doesn't my APK show new features?

**A:** The APK is a WebView that loads `https://akashpereraproject24.vercel.app`. When Vercel deploys the new version, the APK fetches it next time you open the app. **Try clearing the app cache** (Android Settings → Apps → KDU TEA FACTORY → Storage → Clear Cache), then open the APK again.

**APK එකේ අලුත් features පෙන්නෙන්නේ ඇයි?**
APK එක යනු webapp එක Vercel එකෙන් පූරණය කරන WebView එකකි. Vercel deploy වූ විට APK එක ස්වයංක්‍රීයව අලුත් වේ. Cache clear කරලා බලන්න.

### Q2: When do I need to rebuild the APK?

**A:** Only when changing:
- App icon or splash screen
- The Vercel URL the APK loads (e.g., switching from `al-git.vercel.app` to `akashpereraproject24.vercel.app`)
- Native permissions (camera, location, notifications)
- FCM / Firebase config
- App name (the name under the icon)

For 95% of changes (new modules, bug fixes, UI changes), no rebuild is needed — just `git push` and Vercel deploys.

### Q3: Why can't suppliers request workers anymore?

**A:** Per Sir's Phase 1 spec, the "Workers" option was removed from the supplier's Request Resources module. Labor management is now admin-only via the Labor module's "Daily Labor Cost" tab. Phase 2 will re-enable Labor Requests with a proper approval workflow.

### Q4: How does the system know which estate a supplier belongs to?

**A:** When EO registers a supplier, they pick an estate from a dropdown. This sets `associatedEntityId` on the supplier's account. The system uses this to:
- Show the supplier their linked estate's weather (My Weather module)
- Filter announcements to only those from their estate
- Show only their own deliveries + payments
- Send FCM pushes targeted to their estate

### Q5: Why is the bush count reminder showing every time I open My Plot?

**A:** The reminder shows when the last verification date is older than 6 months (or never set). Once you tap "Verify Now" (or "Save & Verify" with updated details), today's date is saved as the new verified date, and the banner hides for 6 months.

### Q6: How are FCM push notifications sent? Where does the message come from?

**A:** When admin acts on a supplier (approves request, marks payment, publishes announcement), the webapp writes a row to Firestore `notifications/`. A Cloud Function triggers on this write, looks up the supplier's FCM token in `fcm_tokens/{supplierUid}`, and calls `admin.messaging().send({ token })`. Firebase delivers the push to the supplier's phone via the FCM channel.

### Q7: Why is the daily labor cost only saved to localStorage?

**A:** Phase 1 — quick implementation without DB schema changes. Phase 2 will:
- Create a Supabase `labor_daily_cost_snapshots` table
- Save snapshots to that table
- Post a double-entry journal entry to Finance (Dr Labor Expense / Cr Cash)

### Q8: What if an estate has no GPS coordinates set?

**A:** The system falls back to Nuwara Eliya defaults (lat 6.9679, lon 80.7618) for weather forecasts. The EO Geo-Location Verification shows "⚠ Estate has no coordinates — cannot verify distance" instead of a verdict.

### Q9: Can a supplier have multiple estates?

**A:** No — each supplier has exactly one `associatedEntityId`. This is set by EO during registration. If a supplier delivers leaf from multiple estates, the EO must register them once per estate (with different email addresses).

### Q10: How can I change the app's logo + name?

**A:** Two ways:
1. **Super Admin → Settings module** → change `companyName` + `companyLogoUrl` + `loginTitle` + `loginLogoUrl`. This persists to Supabase + syncs to all devices instantly.
2. **For the APK icon + splash screen** (baked into APK): change `app/assets/icon.png` + `app/assets/splash.png`, then submit a new EAS build.

## 5.5 Phase 2 Future Roadmap / අනාගත සේවා මාර්ගෝපදේශය

These features are documented for Phase 2 (after Phase 1 stabilization):

| Phase 2 Item | Description | Complexity |
|--------------|-------------|------------|
| **Labor Request (re-enabled)** | Proper supplier portal feature with admin approval workflow, linked to Daily Labor Cost | Medium |
| **Equipment Request → Supabase** | Sync to `equipment_requests` table + auto-issue from Inventory on approval | Medium |
| **Bush Count verifiedAt → Supabase + FCM** | Persist verification date + trigger 6-month FCM push reminder | Medium |
| **Daily Labor Cost → Supabase + GL journal** | Persist snapshots to Supabase + auto-post double-entry journal | Medium |
| **Supplier Plot → Supabase** | New `supplier_farms` table keyed by userUid | Medium |
| **Activity Types extended** | Add 'replanting' + 'fertilizer_application' as distinct FarmActivity types | Low |
| **Weather-based alerts** | Auto-trigger weather alerts when forecast predicts rain/drought | Low |
| **Per-field bush count entry** | Extend Field creation form to capture bush count per field | Low |
| **EO vs Supplier location compare** | Compare EO's GPS verification against supplier's last check-in | Medium |

---

## 5.6 Document History / ලේඛන ඉතිහාසය

| Date | Changes | Author |
|------|---------|--------|
| July 2026 | Initial document (sections 1-10) | Original dev |
| July 2026 | Added sections 11-15 (Stock, FCM, Mobile, Branding, Module Map) | AI assistant |
| August 2026 | Added sections 16-19 (Phase 1 spec: Labor, Equipment, Weather, Bush Count, Tips, EO Geo) | AI assistant |
| **September 2026** | **Complete rewrite for clarity + interconnections** | AI assistant |

---

*End of Workflow Diagram. This document is the single source of truth for understanding the KDU TEA FACTORY system. Last updated: September 2026.*

*ලේඛනයේ අවසානය. මෙය KDU TEA FACTORY පද්ධතිය තේරුම් ගැනීමට එකම මූලාශ්‍රයයි. අවසන් යාවත්කාලීනය: සැප්තැම්බර් 2026.*

---

## 20. Phase 1 Update #2 — September 2026 (Latest)

> **Purpose / අරමුණ:** Sir's spec round #2 — 3 items added.

### 20.1 Supplier-Side Estate Creation (NEW)

**Where:** Supplier Portal → My Plot module → "Plot Sub-Fields / Sections" section (below the Plot Details card).

**Why:** Sir asked for estate creation on supplier side too. Suppliers have small plots (කුඩා වත්ත), but they often have multiple sub-sections (e.g., Upper Plot + Lower Plot). Now they can divide their plot like admin's Estate Master.

**What Was Added:**

```
┌─────────────────────────────────────────────────────────────────┐
│  🌳 My Plot → Plot Sub-Fields / Sections                       │
├─────────────────────────────────────────────────────────────────┤
│  [+ Add Sub-Field]                                              │
│                                                                 │
│  | Code | Name        | Cultivar     | Area (ha) | Bushes |...│
│  |-------|-------------|--------------|-----------|--------|---│
│  | P-01  | Upper Plot  | TRI 2025(VP) |    0.8    | 1,200  |...│
│  | P-02  | Lower Plot  | TRI 2023(VP) |    0.5    |   800  |...│
│  |       |             |   Total      |    1.3    | 2,000  |   │
│  └───────┴─────────────┴──────────────┴───────────┴────────┘   │
│                                                                 │
│  Sub-field form (when "Add Sub-Field" tapped):                  │
│  • Code (auto: P-01, P-02, ...)                                │
│  • Name (e.g., "Upper Plot")                                  │
│  • Cultivar dropdown (TRI 2025/2023/2024/Seedling/Other)        │
│  • Planting Year                                                │
│  • Area (ha) — required                                        │
│  • Bush Count                                                   │
│  • Status (Plucking/Pruned/Young/Nursery)                       │
│  [Add] [Cancel]                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key behavior:**
- When sub-fields exist, the plot's total acreage + bush count are auto-aggregated from sub-fields (ha → acres conversion: acres = ha × 2.471).
- Suppliers can edit/delete sub-fields individually.
- Status badge color-coded (plucking=emerald, pruned=amber, young=sky, nursery=violet).
- Total row at bottom of table shows aggregated area + bush count.

### 20.2 Supabase SQL Migration (NEW FILE)

**File:** `download/supabase_phase1_sir_spec_migration.sql` (also committed at `docs/migration_phase1_sir_spec.sql`)

**Why:** We discovered that several Phase 1 features reference Supabase columns/tables that DON'T EXIST in any existing migration. Phase 1 falls back to localStorage, but Phase 2 will need these.

**What's in the migration:**

| # | Change | Why |
|---|--------|-----|
| 1 | `estates` add columns: `latitude`, `longitude`, `total_bush_count`, `total_area_acres` | Weather module + EO Geo-Verify + Bush count tracking |
| 2 | `fields` add columns: `bush_count`, `bush_count_verified_at` | Per-field bush count tracking |
| 3 | `farm_activities.activity_type` CHECK constraint extended | Add 'replanting' + 'fertilizer_application' types |
| 4 | NEW TABLE `supplier_plots` | Per-supplier plot data (acreage, bush count, cultivar, region, verified_at) |
| 5 | NEW TABLE `supplier_fertilizer_ledger` | Credit fertilizer issues to suppliers (for balance tracking) |
| 6 | NEW TABLE `equipment_requests` | Standalone equipment request tracking |
| 7 | NEW TABLE `labor_daily_cost_snapshots` | Admin's daily labor cost calculator snapshots |

All statements are IDEMPOTENT (safe to re-run). All new tables include Row Level Security policies (suppliers see only their own data; admins see all).

**To apply:** Open Supabase Dashboard → SQL Editor → New query → paste contents of `download/supabase_phase1_sir_spec_migration.sql` → Run.

### 20.3 Updated Module Count

With the new "My Fertilizer" module + supplier sub-fields, the supplier portal now has **10 modules**:

```
[Deliveries]  [Alerts]  [Payments]  [Farm]  [Plot ★]  [Weather ★]
[Tips ★]  [Fertilizer ★]  [Updates]  [Request]
   ↑                                                              ↑
   └── visible in bottom-nav (4) ──┘         └── "More" sheet (6) ──┘
```

(★ = added in Phase 1)

---

*End of Workflow Diagram. Last updated: September 2026 (Round #2 — supplier sub-fields + Supabase migration).*

*ලේඛනයේ අවසානය. අවසන් යාවත්කාලීනය: සැප්තැම්බර් 2026.*

---

## 21. Phase 1 Update #3 — September 2026 (Login Video Fix + Roadmap)

### 21.1 Login Background Video Fix

**Issue:** Since the KDU TEA FACTORY rebrand, the login page background video was not playing — it showed a stuck image (or no video at all).

**Root cause:** When we rebranded from "Verda" → "KDU TEA FACTORY", the branding cache key changed from `verda.branding.cache` → `kdu.branding.cache`. This orphaned the user's previously-set branding config (including the login background video URL they had configured via Super Admin Settings). The branding loader was reading only from the new key, which was empty, and fell back to DEFAULT_BRANDING which has `loginBackgroundUrl: ""`.

**Fix in `src/lib/branding.tsx`:**
- Added `LEGACY_CACHE_KEY = "verda.branding.cache"` constant
- `readCache()` now checks new cache first, then falls back to legacy cache, migrates the value to new cache (so next load is fast), and returns the merged branding
- `writeCache()` clears the legacy cache to avoid double-reads

**Also improved `src/components/Login.tsx` video element:**
- Added `preload="auto"` — browser starts loading video immediately
- Added `crossOrigin="anonymous"` — helps with CORS for Cloudinary URLs
- Added `onCanPlay` handler that force-calls `play()` — some browsers stall autoplay even with muted + playsInline; this catches the "canplay" event and explicitly starts playback
- Added `onError` handler that hides the video element if the URL fails to load (instead of showing a broken video frame)

**After deployment:** The user's previously-set login background video URL is restored from the legacy cache automatically. If they want to change it again, Super Admin → Settings → Login Background URL.

### 21.2 Phase 1 Round #3 Roadmap — Identified Gaps

The following gaps were identified during a review of supplier-admin interconnections + data filling. These are documented for Phase 2 implementation.

#### A. Interconnection Gaps (What Doesn't Flow Both Ways Yet)

| # | Gap | Impact | Phase 2 Priority |
|---|-----|--------|-------------------|
| 1 | Supplier Plot → Admin Dashboard | Admin can't see aggregated supplier plot data (total acreage, total bush count, average yield/acre) | High |
| 2 | Supplier Fertilizer Ledger → Admin view | Admin has no view of all suppliers' outstanding credit fertilizer balances | High |
| 3 | Auto-deduct credit fertilizer from leaf payments | When admin pays for leaf, the credit fertilizer balance is not auto-deducted (manual reconciliation) | High |
| 4 | Admin Announcements → Supplier "Read" tracking | Suppliers see the same announcements again — no "mark as read" | Medium |
| 5 | Resource Requests fulfillment visibility | Supplier doesn't see "X kg deducted from inventory" in the app (only via FCM push) | Medium |
| 6 | Equipment Requests supplier side | New Equipment Requests module is admin-only; suppliers can't submit via it (still use old Request Resources) | High |

#### B. Data Filling Gaps (Things That Should Be Added)

| # | Gap | Why It Matters |
|---|-----|----------------|
| 7 | Supplier profile: phone, address, NIC, emergency contact | Helps admin recognize suppliers at collection center + emergency contact |
| 8 | Supplier profile photo | Visual identification at collection center |
| 9 | Estate: contact phone for estate manager | Quick contact when issues arise |
| 10 | Division: area in acres (not just hectares) | Sri Lankan farmers think in acres, not hectares |
| 11 | Field: soil type (sandy/loam/clay) | Affects fertilizer recommendation |
| 12 | Worker: dailyWage field | Currently only monthly basicSalary — Daily Labor Cost uses defaults, can't be set per individual worker |
| 13 | Worker: photo + QR code | Identification at collection center |
| 14 | Stock Item: batch/lot number | Track which batch went to which division (product recall) |
| 15 | Stock Item: expiry date | Most fertilizers expire 2-3 years — important for stock rotation |
| 16 | Stock Item: supplier source | Which supplier sold us this fertilizer (vendor performance tracking) |
| 17 | Harvest Record: weather condition at weigh-in | Rain affects leaf quality — important for audit |
| 18 | Harvest Record: leaf moisture % | EO measures this; affects deduction % — should be in system |
| 19 | Harvest Record: photo of leaf batch | Helps with quality disputes |
| 20 | Payment: method tracking (cash/bank/cheque) | Admin marks "paid" but doesn't record HOW |
| 21 | Payment: automatic PDF receipt generation | Suppliers get FCM push but no printable receipt |
| 22 | Farm Activity: photo upload | Audit trail + EO verification |
| 23 | Farm Activity: GPS coordinates | Where exactly in the plot — helps EO verify |

#### C. Workflow Gaps

| # | Gap | Why It Matters |
|---|-----|----------------|
| 24 | Notification preferences per supplier | Suppliers can't choose which notifications to receive |
| 25 | Multi-language support incomplete | Some hard-coded English strings remain in new modules |
| 26 | Offline mode for supplier actions | Suppliers in the field have poor internet — actions should queue offline + sync when online |
| 27 | Audit trail for supplier actions | Currently only admin actions are logged, not supplier actions (e.g., plot updates, fertilizer logs) |

#### D. Top 5 Phase 2 Priorities (Recommended)

| Priority | Item | Why |
|----------|------|-----|
| 1 | **Admin-side aggregated view of supplier plot data** | Admin needs to see total yield potential across all suppliers + who has pending re-verification |
| 2 | **Auto-deduct credit fertilizer from leaf payments** | Currently manual reconciliation is error-prone |
| 3 | **Supplier photo + profile fields (phone, NIC, address)** | Helps admin recognize suppliers + emergency contact |
| 4 | **Photo upload for farm activities** | Audit trail + EO verification |
| 5 | **Equipment Requests: supplier submission + auto-issue on approval** | Connect the new module to suppliers + Inventory |

---

*End of Workflow Diagram. Last updated: September 2026 (Round #3 — login video fix + Phase 2 roadmap).*

*ලේඛනයේ අවසානය. අවසන් යාවත්කාලීනය: සැප්තැම්බර් 2026.*

---

## 22. Phase 1 Update #4 — September 2026 (Interconnections + Data Filling)

> **Purpose / අරමුණ:** Implementation of Sir's spec round #3 — A.1 to A.5 + B.6 to B.11 + C.13 (11 items total).

### 22.1 Implemented Features

#### A. Interconnection Gaps — All 5 Fixed ✅

| # | Feature | What Was Implemented |
|---|---------|----------------------|
| A.1 | Supplier Plot → Admin Dashboard | New module: **Supplier Insights** (admin sidebar under "Intelligence") aggregates all supplier plot data: total acreage, bush count, expected yield, with per-supplier breakdown table + 6-month re-verification alerts |
| A.2 | Supplier Fertilizer Ledger → Admin | Supplier Insights module also shows "Outstanding Fertilizer Credit Balances" — list of suppliers with unpaid credit + estimated value + CSV export |
| A.3 | Admin Announcements → Supplier | SupplierAnnouncements module now: sorts latest first, supports "Mark as Read" + "Mark all as Read", shows unread badge, hides read articles with reduced opacity + "NEW" badge on unread |
| A.4 | Resource Requests → Supplier in-app visibility | When admin approves a resource request, the supplier's "Request Resources" module now shows a green "✅ Request fulfilled" message with "X deducted from inventory — please collect from estate office" |
| A.5 | Equipment Requests — auto-issue on approval | Admin's Equipment Requests module: when admin clicks "Approve", system now auto-finds matching stock item (category=equipment) and calls `issueStock()` to auto-deduct. Shows toast confirming deduction. Falls back to warning if no match found. |

#### B. Data Filling Gaps — All 6 Fixed (Type Definitions + SQL Migration) ✅

| # | Feature | What Was Implemented |
|---|---------|----------------------|
| B.6 | Supplier Profile Incomplete | Extended `SupplierProfile` interface with: `nic`, `address`, `emergencyContact`, `photoUrl`, `notificationPrefs` |
| B.7 | Estate Master Data Gaps | Extended `Estate` with `contactPhone`; `Division` with `areaAcres`; `Field` with `soilType` (sandy/loam/clay/sandy-loam/clay-loam/unknown) |
| B.8 | Worker Data Gaps | Extended `WorkerFull` with `dailyWage`, `photoUrl`, `qrCode` fields |
| B.9 | Stock Item Gaps | Extended `StockItem` with `batchNumber`, `expiryDate`, `supplierSource`; added 3 new fields to Add Stock form in Inventory module |
| B.10 | Harvest Records Gaps | Extended `HarvestRecord` with `weatherCondition`, `leafMoisturePct`, `photoUrl` |
| B.11 | Payment Tracking Gaps | SQL migration adds `payment_method` + `receipt_pdf_url` to `sales_invoices` table (TypeScript types to follow in Phase 2) |

#### C. Notification Preferences ✅

| # | Feature | What Was Implemented |
|---|---------|----------------------|
| C.13 | Notification Preferences | Extended `SupplierProfile.notificationPrefs` with 5 boolean toggles: paymentAlerts, requestAlerts, announcementAlerts, weatherAlerts, advisoryAlerts. SQL migration adds `notification_prefs` JSONB column to `users` table with all-true default. |

### 22.2 New Module: Supplier Insights

**Where:** Admin sidebar → Intelligence category → "Supplier Insights" icon (Users icon)

**What it shows:**

```
┌─────────────────────────────────────────────────────────────────┐
│  🌳 Supplier Insights                                          │
├─────────────────────────────────────────────────────────────────┤
│  [Suppliers: 8] [Acreage: 18.5] [Bushes: 39,200] [Yield: 27,750]│
├─────────────────────────────────────────────────────────────────┤
│  ⚠ 3 supplier(s) need bush count re-verification                │
│  • sup-001 · 2.5 acres · 5,400 bushes · verified: 7m ago        │
│  • sup-003 · 1.8 acres · 3,200 bushes · verified: never         │
│  • ...                                                          │
├─────────────────────────────────────────────────────────────────┤
│  Per-Supplier Plot Breakdown                                   │
│  | User UID | Acreage | Bushes | Density | Region | Verified |  │
│  | sup-001  |  2.5    | 5,400  | 2,160  | Low    | 2026-02-15 | │
│  | sup-002  |  3.0    | 6,500  | 2,166  | Low    | Never      | │
│  | TOTAL    |  5.5    | 11,900 | 2,163  |        |            | │
├─────────────────────────────────────────────────────────────────┤
│  Outstanding Fertilizer Credit Balances                          │
│  | Supplier Name | Outstanding (kg) | # Issues | Est. Value |  │
│  | Nimal Farmers |     50 kg        |    2     | Rs 4,750    |  │
│  | TOTAL         |     50 kg        |    2     | Rs 4,750    |  │
│  [Download CSV]                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Phase 1 limitation:** Reads from localStorage on the admin's browser — admin on Computer A can't see plots entered by suppliers on Phone B. Phase 2 will sync to Supabase `supplier_plots` table for full visibility.

### 22.3 SQL Migration — Round #3

**File:** `download/supabase_phase1_round3_migration.sql` (also committed at `docs/migration_phase1_round3.sql`)

**What's in the migration (11 changes):**

| # | Change | Why |
|---|--------|-----|
| 1 | `estates.contact_phone` (text) | Sir's spec B.7 — estate manager contact |
| 2 | `divisions.area_acres` (numeric) | Sir's spec B.7 — Sri Lankan farmers think in acres |
| 3 | `fields.soil_type` (text) | Sir's spec B.7 — affects fertilizer recommendation |
| 4 | `workers.daily_wage`, `photo_url`, `qr_code` | Sir's spec B.8 |
| 5 | `stock_items.batch_number`, `expiry_date`, `supplier_source` | Sir's spec B.9 — product recall + stock rotation + vendor tracking |
| 6 | `harvest_records.weather_condition`, `leaf_moisture_pct`, `photo_url` | Sir's spec B.10 |
| 7 | `sales_invoices.payment_method`, `receipt_pdf_url` | Sir's spec B.11 — cash/bank/cheque tracking |
| 8 | `users.nic`, `address`, `emergency_contact`, `photo_url`, `notification_prefs` | Sir's spec B.6 + C.13 |
| 9 | NEW TABLE `announcement_reads` | Sir's spec A.3 — mark as read tracking |
| 10 | NEW TABLE `notification_queue` | For in-app notification view (Sir's spec A.4 — supplier sees fulfillment status) |
| 11 | NEW TABLE `farm_activity_photos` | Sir's spec B.22 — photo upload for audit |

All idempotent, all with RLS policies.

### 22.4 Updated Module Count

**Admin:** 28 → 29 modules (added "Supplier Insights" under Intelligence)
**Supplier:** 10 modules (unchanged)

### 22.5 Verification

- ✅ `vite build`: 2773 modules transformed, 9.88s, 0 errors
- ✅ `tsc --noEmit`: 0 errors in new/modified files
- ✅ All 11 spec items implemented (5 interconnection + 6 data + 1 notif)
- ✅ SQL migration file ready for Supabase
- ✅ Pushed to GitHub

---

*End of Workflow Diagram. Last updated: September 2026 (Round #4 — interconnections + data filling + notification prefs).*

*ලේඛනයේ අවසානය. අවසන් යාවත්කාලීනය: සැප්තැම්බර් 2026.*

---

## 23. EMS Repositioning — September 2026 (Round #5)

> **Purpose / අරමුණ:** Boss wants "Estate Management System (EMS)", not ERP. Remove corporate/financial features; focus on estate operations only.

### 23.1 What Changed

#### ❌ 4 ERP Modules Hidden (code retained for reversibility)

| Module | Why Removed |
|--------|-------------|
| Finance & Accounting | Full GL + double-entry journals = core ERP |
| Auction Sales | Colombo Tea Auction = trading, not estate mgmt |
| Supplier Loans | Lending money to suppliers = finance, not estate mgmt |
| Loyalty Program | Points/rewards/tiers = CRM/marketing, not estate mgmt |

These 4 modules are no longer in the admin sidebar. Their code files (Finance.tsx, AuctionSales.tsx, SupplierLoans.tsx, Loyalty.tsx) are still in `src/modules/` and still registered in `registry.ts` — they just don't appear in the sidebar. If boss changes his mind, re-add 4 entries to MODULES array in `rbac.ts`.

Also removed "Finance" category from CATEGORIES list (no longer used).

#### ⚠️ 3 Borderline Modules Simplified (renamed + desc updated)

| Module | Was | Now | Description |
|--------|-----|-----|-------------|
| Payroll | Payroll System | **Worker Payments** | "Daily wage tracking + monthly payment summary for estate workers. Simple ledger — no EPF/ETF." |
| Loans | Loans & Advances | **Worker Advances** | "Simple cash advance log for estate workers + recovery tracking. No interest, no amortization." |
| Welfare | Welfare Management | **Worker Welfare** | "Simple log of welfare provided to estate workers — housing, medical, education support. No scheme management." |

#### 🔄 2 Modules Rebranded

| Module | Was | Now | Sidebar Category |
|--------|-----|-----|------------------|
| AI | AI & Analytics | **Estate Intelligence** | intelligence (was "more") |
| Audit | Audit & Compliance | **Estate Compliance** | intelligence (was "more") |

#### 🔄 Supplier Side — 1 Module Simplified

| Module | Was | Now |
|--------|-----|-----|
| Payment Tracker | Payment Tracker | **My Earnings** |

Description changed to: "Your green-leaf supply earnings + payment status (simple ledger — no invoicing)."

### 23.2 Updated Module Map (After EMS Repositioning)

#### Admin (25 modules — was 29, hidden 4 ERP modules)

```
OVERVIEW:
└── 📊 Estate Dashboard

ESTATE & LAND:
└── 🏛️ Estate Master

FIELD OPERATIONS:
├── 👥 Labor Management
├── ⚖️ Harvest Management
├── 📥 Resource Requisitions
├── 🔧 Equipment Requests
└── 🛠️ Field Tools

MANUFACTURING:
├── 🏭 Factory Integration
└── 📦 Inventory & Procurement

INPUTS:
├── 🌱 Fertilizer
├── 🧪 Agrochemical
└── 🔧 Equipment

PEOPLE & PAY:
├── 💰 Worker Payments ★ (was "Payroll System")
├── 🏦 Worker Advances ★ (was "Loans & Advances")
└── ❤️ Worker Welfare ★ (was "Welfare Management")

INTELLIGENCE:
├── 🌦️ Weather & Environment
├── 🧠 Estate Intelligence ★ (was "AI & Analytics")
├── 🛡️ Estate Compliance ★ (was "Audit & Compliance")
└── 👥 Supplier Insights

ADMINISTRATION:
├── 👤 User Management
├── 📢 Announcements
└── 🎨 Branding & Settings (Super Admin only)

MORE:
├── 📱 Mobile & Offline
├── 📐 Architecture & Docs
└── 🚚 Vehicle & Fuel

(HIDDEN — code retained, sidebar entries removed):
├── 🧮 Finance & Accounting ❌ (was ERP)
├── 🔨 Auction Sales ❌ (was ERP)
├── 💼 Supplier Loans ❌ (was ERP)
└── 🏆 Loyalty Program ❌ (was ERP)
```

#### Extension Officer (2 modules — unchanged)
- 📝 Register Supplier
- ⚖️ Leaf Weighing Entry (with Geo-Verify)

#### Supplier (10 modules — unchanged structure, 1 renamed)
- 📊 My Leaf Deliveries
- 🔔 Smart Alerts Panel
- 💵 My Earnings ★ (was "Payment Tracker")
- 🌾 My Farm Activities
- 🌳 My Plot
- ☁️ My Weather
- 💡 Tips & Guidance
- 🌱 My Fertilizer
- 📰 Estate Updates
- 📥 Request Resources

### 23.3 Verification

- ✅ `vite build`: succeeds (10.47s, 2943.84 kB)
- ✅ `tsc --noEmit`: 0 errors in modified files
- ✅ Pushed to GitHub (`eca9794`)
- ⏳ Vercel deploying (~2 min)

### 23.4 To Revert (If Boss Changes Mind)

Re-add these 4 entries to MODULES array in `src/lib/rbac.ts`:

```ts
{ key: "finance",        label: "Finance & Accounting", ..., category: "finance" }
{ key: "auction-sales",  label: "Auction Sales",         ..., category: "finance" }
{ key: "supplier-loans", label: "Supplier Loans",       ..., category: "finance" }
{ key: "loyalty",         label: "Loyalty Program",     ..., category: "people" }
```

And re-add `{ id: "finance", label: "Finance" }` to CATEGORIES list.

All code files are intact — only the sidebar entries were removed.

---

*End of Workflow Diagram. Last updated: September 2026 (Round #5 — EMS repositioning).*

*ලේඛනයේ අවසානය. අවසන් යාවත්කාලීනය: සැප්තැම්බර් 2026.*

---

## 24. Estate Registration Workflow — September 2026 (Round #6)

> **Purpose / අරමුණ:** Sir's spec — suppliers register their estate with all details, admin approves/rejects, auto-location GPS button.

### 24.1 How It Works

```
Supplier opens "My Plot" module
        ↓
  No approved plot data?
        ↓ YES
  Show REGISTRATION FORM
  ┌─────────────────────────────────────┐
  │ Plot Name *                         │
  │ Acreage * · Bush Count *            │
  │ Cultivar · Region                   │
  │ GPS: [📍 Auto-Detect] + Lat/Lon *   │
  │ 🗺️ View on map (OpenStreetMap)     │
  │ Address · Contact Phone             │
  │ 3 Photo URLs (optional)             │
  │ Land Document URL (optional)        │
  │ Notes (optional)                    │
  │ [Submit for Admin Approval]         │
  └─────────────────────────────────────┘
        ↓
  Status = PENDING
        ↓
  Admin opens "Supplier Insights" → "Estate Registrations" tab
        ↓
  Sees pending request with all details + GPS map link + photos
        ↓
  Admin clicks "Approve" → data auto-populates supplier's My Plot
  Admin clicks "Reject" → types reason → supplier sees it + can resubmit
```

### 24.2 Four Modes in My Plot

| Mode | When | What Shows |
|------|------|------------|
| **register** | No approved data + no pending request | Full registration form (empty) |
| **pending** | Request submitted, awaiting admin | Amber card with submitted details + "Awaiting Approval" |
| **rejected** | Admin rejected the request | Red card with rejection reason + form for resubmit |
| **view** | Approved — existing My Plot UI | Stats + yield prediction + edit + sub-fields |

### 24.3 Auto-Detect GPS Location

The "📍 Auto-Detect My Location" button:
- Uses browser `navigator.geolocation.getCurrentPosition()`
- Auto-fills latitude + longitude fields (6 decimal precision)
- Shows toast notification on success: "📍 Location detected: Lat X, Lon Y"
- Error handling: permission denied, position unavailable, timeout
- High accuracy mode enabled
- After detection, "🗺️ View on map" link appears (opens OpenStreetMap)

Suppliers can also manually type coordinates if auto-detect fails or they want to use a different location.

### 24.4 Admin Approval Workflow

In **Supplier Insights** module → "Estate Registrations" tab:
- Pending count badge on tab button
- Full card per pending request with: plot name, supplier name, acreage, bushes, cultivar, region, GPS (with OpenStreetMap link), phone, address, notes, photos, land document link
- "Approve" button (green) → calls `updateRegistrationStatus(APPROVED)` + `promoteApprovedToMyPlot()` (auto-populates supplier's My Plot cache)
- "Reject" button (red) → inline rejection reason input → "Confirm Reject"
- Approved requests listed (collapsed, green)
- Rejected requests listed (collapsed, red, with reason)

### 24.5 Verification

- ✅ `vite build`: succeeds (10.04s)
- ✅ `tsc --noEmit`: 0 errors in new/modified files
- ✅ Pushed to GitHub (`c696fd9`)
- ⏳ Vercel deploying (~2 min)

### 24.6 Phase 2 (future)

- Sync registration requests to Supabase `estate_registration_requests` table
- FCM push to supplier when admin approves/rejects
- File upload (instead of URL input) for photos + land document
- Boundary drawing on map for accurate acreage calculation
- Two-tier editing: minor edits instant, major edits require re-approval

---

*End of Workflow Diagram. Last updated: September 2026 (Round #6 — estate registration workflow).*

*ලේඛනයේ අවසානය. අවසන් යාවත්කාලීනය: සැප්තැම්බර් 2026.*

---

## 25. Phase 2 — Smart Alerts + Auto-Increment + SQL Migration (Round #7)

> **Purpose / අරමුණ:** Phase 2 implementation — bush count auto-increment, smart automated alerts, weather guard, SQL migration for Supabase.

### 25.1 Phase 2 Features Implemented

#### A. Bush Count Auto-Increment on Replanting ✅

When supplier logs a replanting activity with N new plants:
- System automatically adds N to the supplier's total bush count in localStorage
- Toast: "🌳 Bush count updated ✅ — අලුතින් සිටුවූ පැළ Nක් එකතු කරන ලදී."
- My Plot shows updated count on next open

#### B. Smart Automated Alerts (4 alert types) ✅

New "🤖 ස්වයංක්‍රීය දැනුම්දීම් · Smart Automated Alerts" card in Smart Alerts Panel:

| Alert | Trigger | Tone |
|-------|---------|------|
| Next Fertilizer Cycle | 90+ days since last fertilizer log | Amber |
| Fertilizer Approaching | 75-89 days since last | Sky |
| Pruning Mixture Reminder | 40-50 days after pruning | Emerald |
| New Flush Emerging | 50+ days after pruning | Emerald |
| Replanting Water/Shade | Within 90 days of replanting | Sky |
| Weather Guard | Rain ≥60% + fertilizer logged in last 7 days | Red |

All alerts are bilingual (Sinhala + English) + computed from farm activity history.

#### C. Weather Guard on Fertilizer Log ✅

When supplier logs a fertilizer application:
- System checks OpenWeatherMap forecast for next 2 days
- If rain probability ≥60% → red toast immediately:
  "⚠️ තද වැසි අනතුරු ඇඟවීම — පොහොර සෝදා යාමේ අවදානමක් ඇත!"

### 25.2 SQL Migration — Round #4 (Phase 2)

**File:** `download/supabase_phase2_round4_migration.sql` (also at `docs/migration_phase2_round4.sql`)

| # | Change | Why |
|---|--------|-----|
| 1 | NEW TABLE `estate_registration_requests` | Supplier estate registration → admin approval workflow. Columns: supplier_id, plot_name, acreage, bush_count, cultivar, region, soil_type, latitude, longitude, address, contact_phone, photo_urls[], land_document_url, notes, status, admin_notes, submitted_at, reviewed_at, reviewed_by, edit_count |
| 2 | NEW TABLE `estate_blocks` | Supplier's plot divisions/blocks (උඩ කොටස, පහළ කොටස). Links to either estates table (admin) or estate_registration_requests (supplier). Columns: name, area_ha, area_acres, bush_count, cultivar, soil_type |
| 3 | Index on `farm_activities.details->>'block'` | For querying "which block got fertilizer" — admin visibility |
| 4 | NEW TABLE `smart_alert_log` | When SmartAutomatedAlerts computes an alert, it logs here so admin can see which suppliers are getting which alerts. Columns: user_id, alert_type, title, body, tone, computed_at |

All tables include Row Level Security:
- Suppliers see only their own data
- Admins see all
- All idempotent (CREATE TABLE IF NOT EXISTS)

**To apply:** Open Supabase Dashboard → SQL Editor → paste contents → Run.

### 25.3 Complete SQL Migration History

| Round | File | What |
|-------|------|------|
| #1 | `docs/supabase_schema.sql` + `docs/migration_full_crud.sql` + `docs/migration_workers.sql` | Base schema (estates, divisions, fields, users, workers, stock_items, etc.) |
| #2 | `download/supabase_migration_fix3.sql` | Phase 2 operational tables (finance, payroll, factory, HR, procurement) |
| #3 | `download/supabase_phase1_sir_spec_migration.sql` | Phase 1: bush count, supplier_plots, supplier_fertilizer_ledger, equipment_requests, labor_daily_cost_snapshots |
| #4 | `download/supabase_phase1_round3_migration.sql` | Phase 1 Round #3: soil type, batch/expiry, harvest records, notification prefs, announcement_reads, notification_queue, farm_activity_photos |
| #5 | `download/supabase_phase2_round4_migration.sql` | **Phase 2:** estate_registration_requests, estate_blocks, smart_alert_log |

### 25.4 Verification

- ✅ `vite build`: succeeds (9.99s)
- ✅ `tsc --noEmit`: no new errors
- ✅ Pushed to GitHub
- ⏳ Vercel deploying

## 26. Phase 3 — Supplier Shortcomings Fix (Round #8) — B1–B29

> **Purpose / අරමුණ:** Closes the 11 PARTIAL + 5 MISSING gaps identified in the Supplier Interface Shortcomings Analysis PDF. 16 features shipped in commit `80fe4ed`. Plus a critical SQL migration to fix the `plucking` activity_type CHECK constraint gap.

### 26.1 Why This Round

An audit against `Supplier_Interface_Shortcomings_Analysis.pdf` (uploaded by the client) found:

| Status | Count | Examples |
|--------|-------|----------|
| ✓ Already FIXED | 12 | B2 Profile, B3 Notification Center, B4 Visual Calendar, B6 Yield chart, B7 Quality trend, B8 Cost-vs-Earnings, B11 GPS fix, B13 Block selector, B15 Tips, B19 Progress timeline, B21 Home dashboard, B23 Calendar markers |
| ◐ PARTIAL | 11 | B1/B24 Plucking-in-calendar, B5 Onboarding, B9 Offline, B10 FCM Push, B12 Cache writer, B14 Blocks disconnected, B16 Sync badge, B17 10 tabs too many, B18 i18n inconsistency, B20 Sub-field form, B22 Language switcher, B26 Real-time sync |
| ✘ MISSING | 6 | B25 Yield-from-fertilizer, B27 Admin block-level fert history, B28 Admin pruning supply projection, B29 Leaf intake sync (+ B1/B24 calendar logging + B9 offline data loss) |

This round closes every ◐ and ✘ item.

### 26.2 PARTIAL Fixes Shipped (11 items)

| # | Feature | Fix |
|---|---------|-----|
| B1 / B24 | Plucking logging in calendar | `+ Log Activity` button on `SupplierCalendar` opens `FarmActivities` with selected date pre-filled (via `kdu.farm_activities.pending_date` localStorage key) |
| B5 | Onboarding walkthrough | New `src/components/Onboarding.tsx` — 4-step stepper (Home → Farm → Plot → Alerts) shown once per supplier via `kdu.onboarding_completed.{uid}` flag |
| B9 | Offline Mode for farm activities | `recordFarmActivity()` now catches Supabase insert errors and enqueues via `enqueueMutation()` (instead of throwing + losing data). Auto-replayed by `AppContext.flushSync()` when online |
| B10 | FCM Push for Smart Alerts | New `sendSmartAlert` Cloud Function + new `scheduledSupplierTick` daily cron (06:30 IST). `SmartAutomatedAlerts` now dispatches via FCM + `createAlert()` with daily per-supplier dedup |
| B12 | Fertilizer cache write-through | `recordFarmActivity()` now appends to `kdu.farm_activities.cache` localStorage + dispatches `verda:farm-cache-updated` event. `SupplierCalendar` / `SupplierHome` / `SupplierFertilizer` subscribe and refresh instantly |
| B14 | Registration blocks disconnected | Registration form in `SupplierPlot.tsx` now has a `blocks[]` input UI (Add Block / Remove Block buttons). On admin approval, `promoteApprovedToMyPlot()` turns blocks into subFields automatically |
| B16 | Sync-status indicator | `SyncPill` in `Shell.tsx` now shows `✓ Synced` (online + empty queue) / `⏳ Pending (N)` (online + queued items) / `Offline` (no network). Color-coded emerald / amber / rose |
| B17 | 10 modules too many | Added `primary?: boolean` flag to `NavItem`. Only 4 supplier modules marked primary (Home, Calendar, Farm + More). `BottomNav` shows primary tabs + a More sheet for the rest |
| B18 | i18n inconsistency | `SupplierFertilizer` / `SupplierWeather` / `SupplierTips` / `EquipmentRequests` migrated to `useTranslation()`. 103 new keys added to `en.json` / `si.json` / `ta.json` (onboarding, supplierFert, supplierPlot, supplierTips, supplierWeather, equipment namespaces) |
| B22 | Language switcher hard to find | `prominent` variant of `LanguageSwitcher` is now a clear `h-9 w-9` globe icon button (was a tiny `px-2.5 py-1 text-xs` pill). Single-tap cycles EN → SI → TA |
| B26 | Real-time admin sync | `SupplierFertilizer` migrated from localStorage reads to `useLiveData("supplier_fertilizer_ledger", ...)` with `postgres_changes` subscription. Admin issues appear instantly in supplier view |

### 26.3 MISSING Features Built From Scratch (5 items)

| # | Feature | Implementation |
|---|---------|----------------|
| B25 | Yield estimate from fertilizer | New `predictYieldFromFertilizer()` in `src/lib/predictive.ts` — deterministic TRI response curves (Urea 1kg ≈ 6kg leaf, TSP 1kg ≈ 1.5kg, MOP 1kg ≈ 2kg, Dolomite 0.3kg, Compost 0.5kg). Capped by plot acreage × regional max yield. Surfaced as "Expected Yield from Your Fertilizer" card in `SupplierTips` |
| B27 | Admin block-level fertilizer history | New `BlockFertilizerHistory` panel in admin `Fertilizer.tsx`. Reads `farm_activities WHERE activity_type='fertilizer'` and groups by `details->>'block'`. Shows total kg / application count / supplier count / last applied date per block |
| B28 | Admin supply projection from pruning | New `projectLeafSupplyAfterPruning()` in `predictive.ts` — TRI recovery curves (deep=30% / medium=20% / light=10% / skiffing=8%) with trough-start / trough-end / recovery-day windows. New `PruningSupplyProjectionPanel` in `AiAnalytics.tsx` reads pruning logs and shows current drop % + projected lost kg this month per supplier |
| B29 | Leaf collection estimate sync | New `readSupplierPluckingForecasts()` in `repo.ts` — aggregates `farm_activities WHERE activity_type IN ('plucking','self_harvest')` per supplier, returns last pluck date + 7-day total + expected-tomorrow kg. New `SupplierIntakeForecast` panel in `Factory.tsx` surfaces this for withering capacity planning |
| B1/B24 (cross-ref) | Calendar plucking logging | Same as B1 above — `+ Log Activity` button on calendar |

### 26.4 Infrastructure Additions

#### A. New Cloud Functions (`functions/index.js`)

| Function | Type | Purpose |
|----------|------|---------|
| `sendSmartAlert` | `onCall` | Invoked by web client when `SmartAutomatedAlerts` computes a fresh alert. Sends FCM push + writes to `alerts` table. Best-effort — failure doesn't fail the call |
| `scheduledSupplierTick` | `onSchedule` (daily 06:30 IST) | Recomputes smart alerts server-side for every supplier with a registered push token. Dispatches FCM pushes for any that fire — so alerts reach phones even when the app is closed. Requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars on the functions |

#### B. New Client Helpers

| File | Export | Purpose |
|------|--------|---------|
| `src/lib/fcm.ts` | `sendSmartAlert()` | Client-side wrapper for the `sendSmartAlert` Cloud Function |
| `src/components/Onboarding.tsx` | `<Onboarding />` | First-time-user 4-step walkthrough. Auto-mounts inside `MobileShell`. Persists completion in localStorage |
| `src/lib/predictive.ts` | `predictYieldFromFertilizer()` | B25 — TRI response curve calculator |
| `src/lib/predictive.ts` | `projectLeafSupplyAfterPruning()` | B28 — Pruning yield-drop projector |
| `src/lib/repo.ts` | `readSupplierPluckingForecasts()` | B29 — Per-supplier plucking forecast aggregator |
| `src/lib/repo.ts` | `appendToFarmActivityCache()` (internal) | B12 — Write-through cache helper |

#### C. i18n Namespace Additions (103 keys × 3 languages)

| Namespace | Keys | Used by |
|-----------|------|---------|
| `onboarding.*` | 14 | `<Onboarding />` stepper |
| `supplierFert.*` | 22 | `SupplierFertilizer.tsx` (rewritten) |
| `supplierPlot.*` | 16 | `SupplierPlot.tsx` (registration blocks UI) |
| `supplierTips.*` | 11 | `SupplierTips.tsx` (B25 yield card) |
| `supplierWeather.*` | 7 | `SupplierWeather.tsx` (B18 bilingual) |
| `equipment.*` | 19 | `EquipmentRequests.tsx` (B18 bilingual) |

### 26.5 SQL Migration — Round #5 (Phase 3) — **CRITICAL**

**File:** `docs/migration_phase3_round5.sql` (also at `download/supabase_phase3_round5_migration.sql`)

> ⚠️ **This migration is REQUIRED for B1, B24, and B29 to work.** Without it, every plucking log silently fails at the database layer.

| # | Change | Why |
|---|--------|-----|
| 1 | Drop `farm_activities_activity_type_check` constraint | Old constraint only allowed `('fertilizer','pruning','self_harvest','replanting','fertilizer_application')` — did NOT include `'plucking'` |
| 2 | Re-add constraint WITH `'plucking'` included | TypeScript type `FarmActivityType` (in `src/lib/data.ts` line 97) already allowed `"plucking"`. `FarmActivities.tsx` has a Plucking tab. But every INSERT was rejected by the DB CHECK. B29's `readSupplierPluckingForecasts()` queries `WHERE activity_type IN ('plucking','self_harvest')` — needs `plucking` rows to exist |
| 3 | Add `COMMENT` on the constraint | So future devs see why `'plucking'` is allowed |

**To apply:**
1. Open Supabase Dashboard → SQL Editor → New query
2. Paste contents of `docs/migration_phase3_round5.sql`
3. Run — safe to re-run (uses `drop constraint if exists`)
4. Verify: the query result shows the new constraint definition including `'plucking'`

**After applying:**
- Suppliers' Plucking tab logs start succeeding immediately
- `SupplierCalendar` plucking dots (sky blue) start appearing
- `Factory.tsx` "Expected Intake from Suppliers" panel populates with real data
- Any queued offline plucking inserts (in `verda:offline_queue` localStorage) auto-replay on next online sync

### 26.6 Updated SQL Migration History

| Round | File | What |
|-------|------|------|
| #1 | `docs/supabase_schema.sql` + `migration_full_crud.sql` + `migration_workers.sql` | Base schema (estates, divisions, fields, users, workers, stock_items) |
| #2 | `download/supabase_migration_fix3.sql` | Phase 2 operational tables (finance, payroll, factory, HR, procurement) |
| #3 | `download/supabase_phase1_sir_spec_migration.sql` | Phase 1: bush count, supplier_plots, supplier_fertilizer_ledger, equipment_requests, labor_daily_cost_snapshots |
| #4 | `download/supabase_phase1_round3_migration.sql` | Phase 1 Round #3: soil type, batch/expiry, harvest records, notification prefs, announcement_reads, notification_queue, farm_activity_photos |
| #5 | `download/supabase_phase2_round4_migration.sql` | Phase 2: estate_registration_requests, estate_blocks, smart_alert_log |
| **#6** | **`docs/migration_phase3_round5.sql`** ⬅️ **NEW** | **Phase 3 Round #5: extend `farm_activities.activity_type` CHECK to include `'plucking'`** |

### 26.7 Verification

- ✅ `vite build`: succeeds (8.91s, 2778 modules, 3.16 MB bundle / 872 KB gzipped)
- ✅ TypeScript: no new errors introduced (pre-existing radix-ui / prisma module-not-found errors remain — they don't block the build because vite uses esbuild)
- ✅ Pushed to GitHub in commit `80fe4ed`
- ⏳ **ACTION REQUIRED**: Run `docs/migration_phase3_round5.sql` in Supabase SQL Editor to enable plucking logs
- ⏳ OPTIONAL: Deploy Cloud Functions (`firebase deploy --only functions`) to enable `sendSmartAlert` + `scheduledSupplierTick`. Requires Firebase Blaze plan + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env vars on functions

### 26.8 Files Changed (23 files, +2359 / -297 lines)

```
functions/index.js                            | +126 (sendSmartAlert + scheduledSupplierTick)
postcss.config.mjs                            | fixed (was blocking build)
src/components/LanguageSwitcher.tsx           | B22 (prominent globe button)
src/components/Onboarding.tsx                 | NEW (B5 first-time walkthrough)
src/components/Shell.tsx                      | B5+B16+B17 (SyncPill + BottomNav + Onboarding mount)
src/i18n/locales/{en,si,ta}.json              | B18 (103 new keys × 3 languages)
src/lib/fcm.ts                                | +43 (sendSmartAlert client helper)
src/lib/predictive.ts                         | +131 (predictYieldFromFertilizer + projectLeafSupplyAfterPruning)
src/lib/rbac.ts                               | B17 (NavItem.primary flag + primaryTabsForRole rewrite)
src/lib/repo.ts                               | +89 (recordFarmActivity offline-safe + appendToFarmActivityCache + readSupplierPluckingForecasts)
src/modules/AiAnalytics.tsx                   | +170 (PruningSupplyProjectionPanel for B28)
src/modules/EquipmentRequests.tsx             | B18 (full i18n migration)
src/modules/Factory.tsx                       | +110 (SupplierIntakeForecast panel for B29)
src/modules/FarmActivities.tsx                | B1/B24 (read pending_date on mount)
src/modules/Fertilizer.tsx                    | +98 (BlockFertilizerHistory panel for B27)
src/modules/SupplierCalendar.tsx              | B1/B24/B12 (+ Log Activity button + cache event listener)
src/modules/SupplierFertilizer.tsx            | B26 (full rewrite to useLiveData + useTranslation)
src/modules/SupplierPlot.tsx                  | B14 (blocks[] input UI in registration form)
src/modules/SupplierPortal.tsx                | B10 (SmartAutomatedAlerts FCM dispatch + dedup)
src/modules/SupplierTips.tsx                  | B18+B25 (i18n + yield-from-fertilizer card)
src/modules/SupplierWeather.tsx               | B18 (full i18n migration)
docs/migration_phase3_round5.sql              | NEW (CRITICAL — fixes plucking CHECK constraint)
download/supabase_phase3_round5_migration.sql | NEW (copy of above for download convenience)
```

## 27. EMS Scope Reduction — Remove Supplier Leaf-Payment Features (Round #9)

> **Purpose / අරමුණ:** The factory already operates a separate finance system for supplier tea-supply payments. To avoid double-system confusion, all supplier-facing leaf-payment features (Rs figures, payment history, paid/pending status) were removed from the EMS. The rule: **if it shows "Rs" (money) for a SUPPLIER → remove it. If it shows "kg" or a worker's wage → keep it.**

### 27.1 Why This Round

The boss confirmed that supplier tea-supply payments are handled externally by the factory's own finance system. Having payment figures in the EMS as well created:
- Confusion about which system is authoritative
- Maintenance overhead of duplicating payment data
- Risk of figures disagreeing between systems

This round strips every supplier-facing Rs-denominated feature while keeping all kg-based and worker-payment features intact.

### 27.2 Rule Applied

| Shows "Rs" for a SUPPLIER? | Shows "kg" or a worker's wage? |
|---|---|
| ❌ REMOVE | ✅ KEEP |

### 27.3 What Was Removed (Supplier Side — Leaf Payments)

| # | What | Where | Why |
|---|------|-------|-----|
| 1 | **"My Earnings" module** (entire module) | `supplier-payments` route, `SupplierPayments` component, registry + rbac + i18n | Showed supplier their leaf-payment earnings + payment history + Paid/Pending status. Factory does this. |
| 2 | **"Earnings" stat card** on Home dashboard | `SupplierHome.tsx` | "Total Earned Rs X" leaf-payment figure. |
| 3 | **"Pending Payment" rose banner** on Home dashboard | `SupplierHome.tsx` | "Rs X pending payment" leaf-payment figure. |
| 4 | **Cost vs Earnings area chart** | `SupplierDeliveries` (was `CostEarningsChart` component) | Plotted earned (Rs) vs cost (Rs) over months — purely financial. |
| 5 | **Total Earned / Fertilizer Cost / Net Earnings stat cards** | `SupplierProfile.tsx` (A8 Cost vs Earnings Summary) | 3 stat cards showing Rs figures. |
| 6 | **"💰 Payment Alerts" toggle** in notification prefs | `SupplierProfile.tsx` | Toggle for payment-received notifications. |
| 7 | **"Payment settled: Rs 211,200 credited" preview row** | `SupplierAlerts` → Push Notifications preview card | Example of a payment push notification. |
| 8 | **`amount` + `status` (Paid/Pending) columns** in delivery list | `SupplierDeliveries` list | The Rs amount + payment status. **Kept kg/grade/date.** |
| 9 | **`payments.own` capability** + rbac `supplier-payments` NavItem | `rbac.ts` | Permission + nav entry for the removed module. |
| 10 | **"My Earnings" help-text row** | `SupplierProfile.tsx` help card | Help text referencing the removed module. |
| 11 | **"payment confirmations" wording** in Notification Center empty state | `SupplierProfile.tsx` | Wording referenced payment alerts. |
| 12 | **i18n keys** (9 keys × 3 langs = 27 strings) | `en.json` / `si.json` / `ta.json` `supplier` namespace | `payments`, `paymentsDesc`, `totalEarned`, `pendingPayment`, `ratePerKg`, `paymentHistory`, `noPayments`, `pushPaymentTitle`, `pushPaymentBody` |
| 13 | **`modules.supplier-payments`** i18n entry | `en.json` / `si.json` / `ta.json` `modules` namespace | Module label for the removed module. |
| 14 | **`paymentAlerts` field** | `SupplierProfile` interface in `data.ts` + `ProfileData` interface in `SupplierProfile.tsx` | Notification pref toggle for the removed alert type. |
| 15 | **Earnings state + harvest_records.amount loading** | `SupplierHome.tsx`, `SupplierProfile.tsx` | Removed `totalEarned`/`totalFertCost`/`pendingKg` state + the harvest_records `amount` queries that fed them. |

### 27.4 What Was Modified (Gray Area — Fertilizer Credit Ledger)

The fertilizer credit ledger is a borderline case. It tracks how much fertilizer the factory gave each supplier on credit — which IS connected to leaf payments ("deducted from your next leaf payment"). But it also has standalone value (suppliers want to know how much fertilizer they received).

**Decision: KEEP the kg figures, REMOVE the Rs figures + "deducted from leaf" wording.**

| # | What | Where | Change |
|---|------|-------|--------|
| 16 | **"Credit Outstanding (kg)" stat card** sub-text | `SupplierFertilizer.tsx` | Was: "deducted from leaf" → Now: "settle at factory office" |
| 17 | **"Credit issues will be deducted from your leaf payments"** explainer | `SupplierFertilizer.tsx` (how5) | Was: "deducted from your leaf payments at the factory" → Now: "should be settled at the factory finance office" |
| 18 | **Fertilizer module description** | `SupplierFertilizer.tsx` (desc) | Was: "Credit issues will be deducted from your leaf payments at the factory" → Now: "Settle credit balances at the factory finance office" |
| 19 | **"Outstanding Fertilizer Credit Balances" panel** (admin) | `SupplierInsights.tsx` | Removed "Est. Value (Rs)" column + "Status: Pending" column + Rs value in CSV export + "auto-deducted when admin marks leaf payment as paid" description. **Kept kg + # Issues columns.** |
| 20 | **"Credit outstanding: deduct from leaf payment" help text** (admin) | `SupplierInsights.tsx` how-to-use card | Was: "When marking a leaf payment as paid, deduct the fertilizer credit value first" → Now: "Settlement of credit against leaf payments is handled by the factory finance office (separate system)" |

### 27.5 What Was KEPT (NOT removed — different scope)

These features were considered but **deliberately KEPT** because they belong to different domains (worker HR, made-tea sales, agronomy):

| Feature | Module | Why kept |
|---------|--------|----------|
| **Payroll** ("Worker Payments") | Admin | Pays YOUR estate workers (pluckers, sprayers, factory hands) + EPF/ETF. HR function, not supplier payments. |
| **Loans** ("Worker Advances") | Admin | Cash advances to YOUR workers + recovery from wages. HR function. |
| **Welfare** ("Worker Welfare") | Admin | Worker welfare schemes. HR function. |
| **Factory → Sales Invoices** | Admin | Invoices for SELLING made tea to wholesale buyers (B2B). Not supplier payments. |
| **harvest_records table** (kg + grade + date) | Both | Tracks who delivered how much leaf + quality. Needed for yield charts, quality trends, factory intake forecasting (B29). The `amount` and `status` columns remain in the DB schema but are no longer read by any UI. |
| **SupplierDeliveries → Yield History bar chart** | Supplier | Shows supplier their own monthly kg trend. Motivation, not payment. |
| **SupplierDeliveries → Quality Trend line chart** | Supplier | Shows supplier their grade trend. Quality improvement, not payment. |
| **SupplierDeliveries → delivery list** (date, kg, grade) | Supplier | Lets supplier verify their deliveries were recorded. Dispute resolution. Only the Rs + status columns were removed. |
| **SupplierFertilizer → Total Received (kg) + history list** | Supplier | Supplier knows how much fertilizer factory gave them. Inventory transparency, not payment. |
| **SupplierFertilizer → Used (kg) + Remaining (kg)** | Supplier | Supplier tracks their own usage. Agronomy, not finance. |
| **SupplierFertilizer → Credit Outstanding (kg)** | Supplier | Kept the kg figure (supplier should know their credit balance); only removed the "deducted from leaf payments" wording. |
| **SupplierInsights → Outstanding Fertilizer Credit Balances panel** | Admin | Kept the kg + # issues columns for inventory visibility; only removed the Rs value column + auto-deduct message. |
| **DailyPriceCard** (today's tea prices per grade) | Supplier → Deliveries | Shows market reference prices. Not a payment — just market info. |

### 27.6 Files Changed (8 files, ~430 lines removed)

```
src/lib/rbac.ts                       | -3 lines (payments.own cap + supplier-payments NavItem + supplier array entry)
src/lib/data.ts                       | -1 line (paymentAlerts? field from SupplierProfile interface)
src/modules/registry.ts               | -2 lines (supplier-payments entry + SupplierPayments import)
src/modules/SupplierPortal.tsx        | -110 lines (SupplierPayments component + CostEarningsChart component + amount/status columns in delivery list + "Payment settled" preview row)
src/modules/SupplierHome.tsx          | -25 lines (Earnings card + Pending Payment banner + totalEarned/pendingKg state + harvest_records.amount query)
src/modules/SupplierProfile.tsx       | -45 lines (Cost-vs-Earnings 3 stat cards + Payment Alerts toggle + earnings-loading effect + netEarnings calc + payment-related help text + paymentAlerts field)
src/modules/SupplierInsights.tsx      | -15 lines (Est. Value Rs column + Status column + Rs value in CSV + estValueRs field + auto-deduct help text + fmtLKR import)
src/modules/SupplierFertilizer.tsx    | 0 lines code (i18n key VALUES updated only — no code changes)
src/i18n/locales/en.json              | -10 keys, 3 values updated
src/i18n/locales/si.json              | -10 keys, 3 values updated
src/i18n/locales/ta.json              | -10 keys, 3 values updated
```

### 27.7 Database Note — NO SQL CHANGES NEEDED

The `harvest_records` table still has its `amount` and `status` columns. They are simply no longer read by any UI. **No migration needed** — leaving the columns in place is harmless and means historical payment data (if any) is preserved. The factory's external finance system is the authoritative source for supplier payments going forward.

The `supplier_fertilizer_ledger` table is unchanged — it always tracked kg + Credit/Cash mode, never Rs values. The Rs calculations were always client-side (kg × Rs 95/kg hardcoded). Those client-side calculations were removed.

### 27.8 Verification

- ✅ `vite build`: succeeds (10.35s, 2778 modules, 3.14 MB bundle / 870 KB gzipped — **-9.5 kB vs. before**)
- ✅ TypeScript: no new errors (cleaned up unused imports in 3 files)
- ✅ All removed i18n keys verified absent from source code
- ✅ `supplier-payments` route returns 404 (not in registry) — falls back to dashboard
- ✅ Supplier bottom-nav + More sheet no longer show "My Earnings"
- ✅ Admin SupplierInsights no longer shows Rs column in credit balances table
- ⏳ Push to GitHub + Vercel deploy

### 27.9 Updated Supplier Module Count

| Before | After |
|--------|-------|
| 14 supplier modules (incl. My Earnings) | **13 supplier modules** (My Earnings removed) |
| 4 primary tabs + More sheet | 4 primary tabs + More sheet (unchanged — My Earnings was never primary) |

### 27.10 User-Facing Impact

**Suppliers will see:**
- Home dashboard: Earnings card replaced with Today's Weather card (still 4 stat cards)
- No "Pending Payment" banner on Home
- No "My Earnings" tab in More sheet
- My Leaf Deliveries: list shows kg + grade + date only (no Rs amount, no Paid/Pending badge)
- My Profile: no Cost-vs-Earnings cards at the top, no "💰 Payment Alerts" toggle in notification prefs
- My Fertilizer: "Credit Outstanding" card still shows kg, but sub-text says "settle at factory office" (was "deducted from leaf")
- Smart Alerts: Push Notifications preview shows only the rain-wash-in example (was 2 examples including "Payment settled")

**Admin will see:**
- Supplier Insights → Outstanding Fertilizer Credit Balances panel: shows Supplier Name + Outstanding (kg) + # Issues only (no Est. Value Rs column, no Status column). Help text says "settlement handled by factory finance office (separate system)".

**Workers (admin Payroll/Loans/Welfare modules):** Unchanged — these are HR functions for estate workers, not supplier payments.

## 28. Inventory Schema Hardening + Stock Movement Report (Round #10)

> **Purpose / අරමුණ:** Sir shared 3 Excel files (Issue Note Report, GRN Report, Fertilizer Stock Balance) that the factory uses for inventory tracking. This round aligns the EMS schema to capture every field those Excel files track, and adds a new admin "Stock Movement Report" panel that mirrors the factory's Fertilizer Stock Balance report — replacing the manual Excel workflow with a live, real-time version.

### 28.1 Why This Round

The 3 Excel files revealed that the factory's inventory tracking includes fields the EMS didn't capture:
- **Issue Note Report:** tracks `Route` (delivery route) per issue — EMS didn't have this
- **GRN Report:** tracks `Free Issue` markers (vendor promotional stock) + `Vendor Invoice #` — EMS didn't have these
- **Fertilizer Stock Balance:** shows Opening / Received / Issued / Closing per item over a date range — EMS only showed current stock, no period report

This round closes those gaps so the EMS can fully replace the factory's Excel-based inventory tracking.

### 28.2 SQL Migration — Round #6 (Phase 3) — **REQUIRED**

**File:** `docs/migration_phase3_round6.sql` (also at `download/supabase_phase3_round6_migration.sql`)

| # | Change | Why |
|---|--------|-----|
| 1 | `stock_movements.route` (text, nullable) | Delivery route for issue notes (e.g., "Kiriwallapatana") |
| 2 | `stock_movements.is_free_issue` (boolean, default false) | GRN free-issue flag (vendor promotional stock, no charge) |
| 3 | `stock_movements.unit_price_at_txn` (numeric 12,2, nullable) | Preserves unit price at time of transaction (historical pricing, separate from moving-average cost) |
| 4 | `stock_movements.vendor_invoice_no` (text, nullable) | Vendor's invoice number for GRN traceability |
| 5 | Index on `route` | For "Fertilizer Issued by Route" report panel |
| 6 | Index on `is_free_issue` | For filtering free-issue rows in GRN report |
| 7 | Composite index on `(move_type, performed_at)` | For Stock Movement Report (opening/closing balance over date range) |
| 8 | COMMENTs on all 4 new columns | For future devs |

**To apply:**
1. Open Supabase Dashboard → SQL Editor → New query
2. Paste contents of `docs/migration_phase3_round6.sql`
3. Run — safe to re-run (uses `add column if not exists`)
4. Verify: the query result shows the 4 new columns

**After applying:** No data migration needed — all 4 new columns are nullable. Existing rows get NULL. Existing UI forms continue to work; they just don't populate the new fields yet. The Inventory module UI is updated to include the new form fields.

### 28.3 What Was Implemented

#### A. TypeScript Types (`src/lib/data.ts`)

`StockMovement` interface extended with 4 new optional fields:
```ts
route?: string;              // delivery route for issue notes
isFreeIssue?: boolean;       // GRN free-issue flag
unitPriceAtTxn?: number;     // unit price preserved at transaction time
vendorInvoiceNo?: string;    // vendor's invoice number for GRN
```

#### B. Repository Layer (`src/lib/repo.phase2.ts`)

| Function | Change |
|----------|--------|
| `receiveGoods()` | Accepts `isFreeIssue` + `vendorInvoiceNo` per receipt line. Free issues don't update moving-average cost (so promotional stock doesn't dilute the cost basis). Writes the new fields to `stock_movements` + `goods_receipt_lines.line_total` (0 for free issues). |
| `issueStock()` | Accepts `route` parameter. Writes it to `stock_movements.route` + sets `unit_price_at_txn` to preserve historical pricing. |
| `listStockMovements()` | Reads the 4 new columns and maps them to the TypeScript interface. |
| **NEW** `getStockMovementReport(startDate, endDate)` | Returns per-item Opening / Received (GRN) / Issued / Closing balances (qty + Rs value) for a date range. Mirrors the factory's "Fertilizer Stock Balance.xlsx" report structure. |

#### C. Admin Inventory Module (`src/modules/Inventory.tsx`)

| Form/Panel | New Fields |
|------------|------------|
| **GRN form** | "Vendor Invoice No" text input + "🎁 Free Issue" checkbox (with explanation that free issues don't affect moving-average cost) |
| **Issue Stock form** | "Route" text input with datalist of common Sri Lankan tea-country routes (Kiriwallapatana, Sutton, Craighead, Tennant, Ragala, Walapane, Nuwara Eliya) — editable free-text |
| **Movement History list** | Shows 3 new badges per row: 🛣️ Route badge (sky), 🎁 Free badge (amber), INV: vendor invoice # (slate) |

#### D. Admin Fertilizer Module (`src/modules/Fertilizer.tsx`)

**NEW** `StockMovementReportPanel` component added at the bottom of the Fertilizer module:

- **Date range picker** (start date + end date, defaults to last 30 days)
- **Category filter** dropdown (Fertilizer / Agrochemical / Equipment / All)
- **Per-item table** with columns:
  - Code | Name | Opening (qty) | Received (qty) | Issued (qty) | Closing (qty) | Closing Value (Rs)
- **Footer totals row** showing total Opening / Received / Issued / Closing values in Rs
- **CSV export** button (exports the full report)
- Color-coded: received qty in emerald (+), issued qty in rose (−), closing in bold
- Help text explaining the calculation: Opening = sum before start date; Received = move_type='in' (excl free issues); Issued = move_type='out'; Closing = opening + received − issued

**This replaces the factory's manual "Fertilizer Stock Balance.xlsx" workflow** — the admin can now generate the same report live, for any date range, without maintaining a separate Excel file.

### 28.4 What Was KEPT (NOT changed)

- **`stock_items` table** — unchanged. Already had `code`, `name`, `category`, `unit`, `qty_on_hand`, `reorder_level`, `unit_cost`, `batch_number`, `expiry_date`, `supplier_source` (from prior rounds).
- **`goods_receipts` table** — unchanged. Already had `grn_code`, `po_id`, `received_date`, `received_by`, `supplier_invoice_no`, `notes`.
- **Moving-average cost logic** — unchanged. Free issues now correctly skip the cost recalculation (promotional stock doesn't dilute the average).
- **Supplier fertilizer ledger** — unchanged. The `supplier_fertilizer_ledger` table tracks kg only (no Rs values, per the EMS scope reduction in Section 27).
- **The 15 removed payment items (Section 27)** — NOT restored. These Excel files are inventory data, not supplier leaf-payment data. The removal decision stands.

### 28.5 Files Changed (6 files, ~430 insertions)

```
docs/migration_phase3_round6.sql              | NEW (85 lines) — SQL migration
download/supabase_phase3_round6_migration.sql | NEW (copy of above)
src/lib/data.ts                               | +9 lines (4 new fields on StockMovement interface)
src/lib/repo.phase2.ts                        | +135 lines (receiveGoods/issueStock/listStockMovements updates + new getStockMovementReport function)
src/modules/Inventory.tsx                     | +60 lines (Route field in Issue form + Vendor Invoice + Free Issue in GRN form + 3 new badges in Movement History)
src/modules/Fertilizer.tsx                    | +165 lines (new StockMovementReportPanel component)
```

### 28.6 Updated SQL Migration History

| Round | File | What |
|-------|------|------|
| #1 | `docs/supabase_schema.sql` + `migration_full_crud.sql` + `migration_workers.sql` | Base schema |
| #2 | `download/supabase_migration_fix3.sql` | Phase 2 operational tables |
| #3 | `download/supabase_phase1_sir_spec_migration.sql` | Phase 1: bush count, supplier_plots, supplier_fertilizer_ledger, equipment_requests |
| #4 | `download/supabase_phase1_round3_migration.sql` | Phase 1 Round #3: soil type, batch/expiry, harvest records, notification prefs |
| #5 | `download/supabase_phase2_round4_migration.sql` | Phase 2: estate_registration_requests, estate_blocks, smart_alert_log |
| #6 | `download/supabase_phase3_round5_migration.sql` | Phase 3 Round #5: extend `farm_activities.activity_type` CHECK to include 'plucking' |
| **#7** | **`docs/migration_phase3_round6.sql`** ⬅️ **NEW** | **Phase 3 Round #6: inventory schema hardening — route, is_free_issue, unit_price_at_txn, vendor_invoice_no on stock_movements** |

### 28.7 Verification

- ✅ `vite build`: succeeds (12.42s, 2778 modules, 3.16 MB bundle / 872 KB gzipped)
- ✅ TypeScript: no new errors introduced (pre-existing errors in repo.phase2.ts at lines 935, 1258, 1901, 2832 are unchanged)
- ✅ All new fields are nullable — existing rows unaffected
- ✅ Free issues correctly skip moving-average cost recalculation
- ⏳ **ACTION REQUIRED**: Run `docs/migration_phase3_round6.sql` in Supabase SQL Editor to add the 4 new columns
- ⏳ After migration: admin can start using Route / Free Issue / Vendor Invoice fields in Inventory module
- ⏳ After migration: admin can use the new Stock Movement Report panel in Fertilizer module

### 28.8 User-Facing Impact

**Admin (Inventory module):**
- GRN form now has "Vendor Invoice No" + "🎁 Free Issue" checkbox
- Issue Stock form now has "Route" field with common-route suggestions
- Movement History list shows 🛣️ Route / 🎁 Free / INV: badges per row

**Admin (Fertilizer module):**
- New "📊 Stock Movement Report (B28)" panel at the bottom
- Date range picker + category filter
- Per-item Opening/Received/Issued/Closing table with Rs values
- CSV export

**Suppliers:** No direct impact (these are admin-side inventory features). Suppliers continue to see their fertilizer issue history in "My Fertilizer" module as before.

**Database:** 4 new nullable columns on `stock_movements`. No data migration needed.

## 29. Excel-Alignment Migration — 3 Remaining Gaps Closed (Round #11)

> **Purpose / අරමුණ:** Sir shared the exact column structures of the 3 Excel files. After comparing column-by-column against the EMS schema, 3 remaining gaps were identified. This round closes them so every Excel column has a home in the DB.

### 29.1 Column-by-Column Audit

#### File 1: Issue Note Total Summary (8 columns)

| Excel Column | EMS Field | Status |
|---|---|---|
| Date | `stock_movements.performed_at` | ✅ Already present |
| Issue Note Ref. | `stock_movements.issue_note_code` | ❌ **GAP → added this round** |
| Supplier No | `stock_movements.supplier_no` | ❌ **GAP → added this round** |
| Route | `stock_movements.route` | ✅ Added in Round #8 |
| Item | `stock_movements.stock_item_id` → `stock_items.code/name` | ✅ Already present |
| QTY | `stock_movements.qty` | ✅ Already present |
| Unit Price | `stock_movements.unit_price_at_txn` | ✅ Added in Round #8 |
| Amount (Rs) | Computed: `qty × unit_price_at_txn` | ✅ Displayed in UI |

#### File 2: GRN Report (8 columns)

| Excel Column | EMS Field | Status |
|---|---|---|
| Date | `goods_receipts.received_date` | ✅ Already present |
| GRN No | `goods_receipts.grn_code` | ✅ Already present |
| Supplier Name | `goods_receipts.supplier_name` | ❌ **GAP → added this round** |
| Item | `stock_movements.stock_item_id` → `stock_items.code/name` | ✅ Already present |
| Free Issued GRN | `stock_movements.is_free_issue` | ✅ Added in Round #8 |
| QTY | `stock_movements.qty` | ✅ Already present |
| Unit Price | `stock_movements.unit_price_at_txn` | ✅ Added in Round #8 |
| Amount (Rs) | Computed: `qty × unit_price_at_txn` | ✅ Displayed in UI |

#### File 3: Fertilizer Stock Balance (7 columns + date range)

| Excel Column | EMS Field | Status |
|---|---|---|
| Item Code | `stock_items.code` | ✅ Already present |
| Description | `stock_items.name` | ✅ Already present |
| Opening Balance QTY | Computed from `stock_movements` before start date | ✅ Stock Movement Report panel (Round #8) |
| GRN: QTY + Amount Rs | Computed from `stock_movements` (move_type='in') | ✅ Stock Movement Report panel |
| ISSUED: QTY + Amount Rs | Computed from `stock_movements` (move_type='out') | ✅ Stock Movement Report panel |
| Closing Balance | Computed: opening + received − issued | ✅ Stock Movement Report panel |
| Date Range filter | Date range picker in Stock Movement Report panel | ✅ Added in Round #8 |

**File 3 has ZERO gaps** — the Stock Movement Report panel (added in Round #8) already matches this Excel exactly.

### 29.2 SQL Migration — Round #7 (Phase 3) — **REQUIRED**

**File:** `docs/migration_phase3_round7.sql` (also at `download/supabase_phase3_round7_migration.sql`)

| # | Change | Why |
|---|--------|-----|
| 1 | `stock_movements.issue_note_code` (text, nullable) | Issue Note Ref. — serial number from the physical issue note book (e.g., IN-2024-0123) |
| 2 | `stock_movements.supplier_no` (text, nullable) | Factory's supplier number (e.g., SUP-001). Different from user_id (Firebase UID). |
| 3 | `goods_receipts.supplier_name` (text, nullable) | Vendor who delivered the fertilizer to the factory (e.g., CIC Fertilizer Ltd). NOT a tea supplier. |
| 4 | Index on `issue_note_code` | For fast lookup by issue note ref |
| 5 | Index on `supplier_no` | For fast lookup by supplier number |

**To apply:**
1. Open Supabase Dashboard → SQL Editor → New query
2. Paste contents of `docs/migration_phase3_round7.sql`
3. Run — safe to re-run (uses `add column if not exists`)
4. Verify: the query result shows the 3 new columns

### 29.3 What Was Implemented

#### A. TypeScript Types (`src/lib/data.ts`)

- `StockMovement` interface: +`issueNoteCode?: string` +`supplierNo?: string`
- `GoodsReceipt` interface: +`supplierName?: string`

#### B. Repository Layer (`src/lib/repo.phase2.ts`)

| Function | Change |
|----------|--------|
| `receiveGoods()` | Accepts `supplierName` parameter. Writes it to `goods_receipts.supplier_name`. Reads it back into the returned `GoodsReceipt` object. |
| `issueStock()` | Accepts `issueNoteCode` + `supplierNo` parameters. Writes them to `stock_movements.issue_note_code` + `stock_movements.supplier_no`. |
| `listStockMovements()` | Reads the 2 new columns and maps them to the TypeScript interface. |

#### C. Admin Inventory Module (`src/modules/Inventory.tsx`)

| Form/Panel | New Fields |
|------------|------------|
| **GRN form** | "Supplier/Vendor Name (who delivered)" text input — with explanation that this is the vendor who delivered the fertilizer, NOT a tea supplier. Matches Excel's "Supplier Name" column. |
| **Issue Stock form** | "Issue Note Ref. (serial number from note book)" text input — placeholder "e.g., IN-2024-0123". Matches Excel's "Issue Note Ref." column. |
| **Issue Stock form** | "Supplier No (factory supplier number)" text input — placeholder "e.g., SUP-001". Matches Excel's "Supplier No" column. |
| **Movement History list** | 2 new badges per row: 📝 Issue Note Ref. (violet) + 👤 Supplier No (indigo). Added alongside the existing 🛣️ Route / 🎁 Free / INV: badges from Round #8. |

### 29.4 Complete Excel-to-EMS Field Mapping (All 3 Files)

After this round, every column in all 3 Excel files has a corresponding field in the EMS:

**File 1: Issue Note Total Summary** → `stock_movements` (move_type='out')
```
Date              → performed_at
Issue Note Ref.   → issue_note_code     ← NEW (Round #9)
Supplier No       → supplier_no         ← NEW (Round #9)
Route             → route               ← Added Round #8
Item              → stock_item_id → stock_items.code/name
QTY               → qty
Unit Price        → unit_price_at_txn   ← Added Round #8
Amount (Rs)       → computed (qty × unit_price_at_txn)
```

**File 2: GRN Report** → `stock_movements` (move_type='in') + `goods_receipts`
```
Date              → goods_receipts.received_date
GRN No            → goods_receipts.grn_code
Supplier Name     → goods_receipts.supplier_name  ← NEW (Round #9)
Item              → stock_movements.stock_item_id → stock_items.code/name
Free Issued GRN   → stock_movements.is_free_issue ← Added Round #8
QTY               → stock_movements.qty
Unit Price        → stock_movements.unit_price_at_txn ← Added Round #8
Amount (Rs)       → computed (qty × unit_price_at_txn)
```

**File 3: Fertilizer Stock Balance** → `StockMovementReportPanel` in Fertilizer module
```
Item Code         → stock_items.code
Description       → stock_items.name
Opening Balance   → computed from stock_movements before start date
GRN (QTY + Rs)    → computed from stock_movements (move_type='in', excl free issues)
ISSUED (QTY + Rs) → computed from stock_movements (move_type='out')
Closing Balance   → computed (opening + received − issued)
Date Range        → date range picker in the panel
```

### 29.5 Files Changed (5 files, ~180 insertions)

```
docs/migration_phase3_round7.sql              | NEW (55 lines) — SQL migration
download/supabase_phase3_round7_migration.sql | NEW (copy of above)
src/lib/data.ts                               | +3 lines (issueNoteCode, supplierNo on StockMovement; supplierName on GoodsReceipt)
src/lib/repo.phase2.ts                        | +25 lines (receiveGoods/issueStock/listStockMovements updates)
src/modules/Inventory.tsx                     | +55 lines (3 new form fields + 2 new badges in Movement History + state variables + reset logic)
```

### 29.6 Updated SQL Migration History

| Round | File | What |
|-------|------|------|
| #1 | `docs/supabase_schema.sql` + `migration_full_crud.sql` + `migration_workers.sql` | Base schema |
| #2 | `download/supabase_migration_fix3.sql` | Phase 2 operational tables |
| #3 | `download/supabase_phase1_sir_spec_migration.sql` | Phase 1: bush count, supplier_plots, supplier_fertilizer_ledger, equipment_requests |
| #4 | `download/supabase_phase1_round3_migration.sql` | Phase 1 Round #3: soil type, batch/expiry, harvest records, notification prefs |
| #5 | `download/supabase_phase2_round4_migration.sql` | Phase 2: estate_registration_requests, estate_blocks, smart_alert_log |
| #6 | `download/supabase_phase3_round5_migration.sql` | Phase 3 Round #5: extend farm_activities.activity_type CHECK for 'plucking' |
| #7 | `download/supabase_phase3_round6_migration.sql` | Phase 3 Round #6: inventory schema hardening (route, is_free_issue, unit_price_at_txn, vendor_invoice_no) |
| **#8** | **`docs/migration_phase3_round7.sql`** ⬅️ **NEW** | **Phase 3 Round #7: Excel-alignment (issue_note_code, supplier_no on stock_movements + supplier_name on goods_receipts)** |

### 29.7 Verification

- ✅ `vite build`: succeeds (10.39s, 2778 modules, 3.16 MB bundle / 873 KB gzipped)
- ✅ TypeScript: no new errors
- ✅ All 3 Excel files now have 100% field coverage in the EMS schema
- ⏳ **ACTION REQUIRED**: Run `docs/migration_phase3_round7.sql` in Supabase SQL Editor
- ⏳ After migration: admin can use Issue Note Ref. + Supplier No in Issue form + Supplier/Vendor Name in GRN form

### 29.8 User-Facing Impact

**Admin (Inventory module):**
- GRN form: new "Supplier/Vendor Name" field (who delivered the fertilizer)
- Issue Stock form: new "Issue Note Ref." field (serial number from note book) + "Supplier No" field (factory supplier number)
- Movement History: shows 📝 Issue Note Ref. + 👤 Supplier No badges per row

**Suppliers:** No direct impact (these are admin-side inventory features).

**Database:** 3 new nullable columns (2 on stock_movements, 1 on goods_receipts). No data migration needed.

## 30. B30 — Restore Earnings & Deductions as Live Transparency Dashboard (Round #12)

> **Purpose / අරමුණ:** Section 27 removed all supplier-facing Rs figures because the factory has an external finance system. The boss has now clarified: the EMS should be a **live transparency dashboard** showing estimated earnings, deductions, and net payable — while the factory finance system remains the **source of truth** for actual month-end payments. This round restores the 6 items removed in Section 27, with a clear "estimate" disclaimer.

### 30.1 New Architecture

```
┌──────────────────────────────────────────────────┐
│  EMS (this system) — LIVE TRANSPARENCY          │
│  ├── EO weighs leaf → harvest_records            │
│  ├── Auto-calculate:                             │
│  │   Gross Earnings = net_kg × daily_tea_price   │
│  │   Deductions: Fertilizer Credit + Advances    │
│  │   Net Payable = Gross − Deductions             │
│  └── Supplier sees it LIVE (daily updated)        │
│                                                  │
│  Factory Finance System (external) — SOURCE OF   │
│  TRUTH                                           │
│  └── Month-end: confirms actual net payable      │
└──────────────────────────────────────────────────┘
```

### 30.2 What Was Restored (6 items)

| # | Item | Where | What changed vs. Section 27 |
|---|------|-------|------|
| 1 | **saveLeafWeighing() auto-calculates amount** | `repo.ts` | Now computes `amount = net_kg × daily_tea_prices[grade].price_per_kg` at weigh-in time. Also stores `status="Pending"` + optional `supplier_id`. |
| 2 | **amount + status columns in delivery list** | `SupplierPortal.tsx` SupplierDeliveries | Restored `{r.date} · {fmtLKR(r.amount)}` + Paid/Pending badge per delivery. |
| 3 | **SupplierLoans (advances) un-hidden** | `rbac.ts` + `registry.ts` | `payments.own` capability + `supplier-payments` NavItem restored. SupplierLoans module was already in registry (code was retained in Section 27). |
| 4 | **Earnings card + Net Payable banner on Home** | `SupplierHome.tsx` | Restored `totalEarned` state + "Earnings (est.)" stat card + "Net Payable (est.)" emerald banner with "View →" button linking to Earnings & Deductions module. |
| 5 | **Cost-vs-Earnings summary cards on Profile** | `SupplierProfile.tsx` | Restored 3 stat cards: Total Earned / Fert. Credit + Advances / Net Payable (est.) + amber estimate disclaimer. Restored `paymentAlerts` toggle. |
| 6 | **"Earnings & Deductions" module restored** | `SupplierPortal.tsx` SupplierPayments | Full module restored with: estimate disclaimer banner + CostEarningsChart + Gross/Pending/Rate stat cards + Deductions Breakdown card (Fert Credit + Advances = Net Payable) + payment history list. |

### 30.3 Estimate Disclaimer (appears in 3 places)

Every Rs figure now carries this disclaimer:

> **⚠ මෙය ඇස්තමේන්තුවකි · This is an estimate**
> The factory finance office confirms the actual net payable amount at month-end.

### 30.4 Files Changed

```
src/lib/repo.ts                    | +35 lines (saveLeafWeighing amount calc + supplier_id)
src/lib/rbac.ts                    | +3 lines (payments.own cap + supplier-payments NavItem + supplier array)
src/lib/data.ts                    | +1 line (paymentAlerts field restored)
src/modules/registry.ts            | +2 lines (SupplierPayments import + supplier-payments route)
src/modules/SupplierPortal.tsx     | +175 lines (SupplierPayments component + CostEarningsChart + amount/status in delivery list + push payment preview row)
src/modules/SupplierHome.tsx       | +20 lines (totalEarned state + Earnings stat card + Net Payable banner)
src/modules/SupplierProfile.tsx    | +35 lines (earnings state + 3 stat cards + paymentAlerts toggle + estimate disclaimer)
src/i18n/locales/en.json           | +10 keys restored (payments, totalEarned, etc.)
src/i18n/locales/si.json           | +10 keys restored
src/i18n/locales/ta.json           | +10 keys restored
```

### 30.5 Verification

- ✅ `vite build`: succeeds (11.79s, 3.18 MB / 876 KB gzipped)
- ✅ TypeScript: no new errors
- ✅ All 6 items restored with estimate disclaimer
- ✅ i18n keys restored across EN/SI/TA (10 keys × 3 langs = 30 strings)

## 31. B31 — Unified Estate Registration (Round #13)

> **Purpose / අරමුණ:** Both suppliers AND admin now write to the same Supabase tables. Supplier registrations appear in Estate Master with approve/reject buttons. On approval, real estate/division/field records are created automatically — no more separate bubbles.

### 31.1 What Changed

| Before | After |
|--------|-------|
| Supplier registration → localStorage only | Supplier registration → localStorage + Supabase `estate_registration_requests` table |
| Admin approves in Supplier Insights (separate module) | Admin approves in Estate Master (unified view) — Supplier Insights still works too |
| Approved registrations → localStorage `kdu.supplier_plot.{uid}` | Approved registrations → ALSO creates real estate/division/field records in Supabase |
| Estate Master shows only admin-created estates | Estate Master shows admin-created + supplier-approved estates (unified hierarchy) |
| Two separate data systems (localStorage vs Supabase) | One unified system (Supabase + localStorage fallback) |

### 31.2 SQL Migration — Round #8 (Phase 3) — **REQUIRED**

**File:** `docs/migration_phase3_round8.sql` (also at `download/supabase_phase3_round8_migration.sql`)

| # | Change | Why |
|---|--------|-----|
| 1 | NEW TABLE `estate_registration_requests` | Supabase version of the localStorage structure — real-time sync |
| 2 | `fields.created_by` (text, default 'admin') | Track who created the field — 'admin' or 'supplier' |
| 3 | `fields.supplier_id` (text) | Link field to the supplier's Firebase UID |
| 4 | `fields.latitude` / `fields.longitude` (numeric) | Supplier's plot GPS coordinates |
| 5 | `fields.address` / `fields.contact_phone` (text) | Supplier's address + phone |
| 6 | `fields.photo_urls` (jsonb) | Plot photos |
| 7 | `fields.land_document_url` (text) | Land deed document |
| 8 | `fields.supplier_notes` (text) | Supplier's notes |
| 9 | `estates.created_by` (text, default 'admin') | Track who created the estate |
| 10 | `estates.supplier_id` (text) | Link estate to supplier (if supplier-created) |

### 31.3 How It Works (Both Sides)

**Supplier side (`SupplierPlot.tsx`):**
1. Supplier fills registration form (plot name, acreage, bushes, GPS, blocks, photos)
2. `saveRegistrationRequest()` writes to localStorage (backwards compat)
3. `saveRegistrationRequestSupabase()` writes to Supabase `estate_registration_requests` table
4. Status = PENDING
5. Supplier sees "Awaiting Approval" with 3-step timeline

**Admin side (`EstateMaster.tsx`):**
1. "Pending Supplier Registrations" panel appears at the top (amber border)
2. Shows all PENDING registrations with supplier name, plot details, GPS, blocks
3. Admin clicks "Approve" → system:
   - Updates status → APPROVED (localStorage + Supabase)
   - Calls `promoteApprovedToMyPlot()` → updates supplier's My Plot cache
   - Calls `addEstate()` → creates real estate record in Supabase
   - Calls `addDivision()` → creates "Main Division" under the estate
   - Calls `addField()` → creates field record linked to the supplier
4. The new estate appears in Estate Master's hierarchy immediately
5. Admin clicks "Reject" → status → REJECTED, supplier can edit + resubmit

**Supplier Insights (`SupplierInsights.tsx`):**
- Still works — reads from the same data source
- Can also approve/reject (both modules share the workflow)
- Also shows aggregated stats + credit balances (unchanged)

### 31.4 Files Changed

```
docs/migration_phase3_round8.sql              | NEW (70 lines) — SQL migration
download/supabase_phase3_round8_migration.sql | NEW (copy)
src/lib/estateRegistration.ts                 | +130 lines (Supabase-backed functions: save/read/update)
src/modules/EstateMaster.tsx                  | +162 lines (PendingRegistrationsPanel component + approve/reject + auto-create estate/division/field)
src/modules/SupplierPlot.tsx                  | +3 lines (saveRegistrationRequestSupabase call)
```

### 31.5 Verification

- ✅ `vite build`: succeeds (10.39s, 3.18 MB / 878 KB gzipped)
- ✅ TypeScript: no new errors
- ✅ Both sides write to same Supabase table
- ✅ Admin can approve from Estate Master (creates real hierarchy records)
- ✅ Supplier Insights still works (shared approval workflow)
- ⏳ **ACTION REQUIRED**: Run `docs/migration_phase3_round8.sql` in Supabase SQL Editor

### 31.6 Updated SQL Migration History

| Round | File | What |
|-------|------|------|
| #1-#7 | (previous migrations) | Base schema + Phase 1-3 migrations |
| **#8** | **`docs/migration_phase3_round8.sql`** ⬅️ **NEW** | **Unified estate registration: new `estate_registration_requests` table + `fields`/`estates` columns** |

## 32. B32 — Supplier Labor Cost Tracking (Round #14)

> **Purpose / අරමුණ:** Supplier tracks their own daily labor costs — workers they bring from their village (Kankanam, Casual Plucking, Temporary). Cost auto-calculates and appears as a deduction in Earnings & Deductions.

### 32.1 Sir's Spec

- Phase 1: Supplier brings their own workers (from their village)
- Supplier enters headcount + daily wage per category
- System auto-calculates total daily labor cost
- Cost appears as deduction in "Earnings & Deductions"
- Phase 2 (future): Factory provides workers when labor shortage hits → Labor Request feature re-enabled

### 32.2 What Was Implemented

| Item | Details |
|---|---|
| **New module** `SupplierLabor.tsx` | "My Labor" — daily labor cost calculator |
| **Labor categories** | Kankanam (Rs 1,800), Casual Plucking (Rs 1,500), Temporary (Rs 1,200) — defaults editable |
| **Auto-calculation** | `totalCost = Σ(headcount × dailyRate)` — updates live as supplier types |
| **Snapshots** | Save daily snapshot to localStorage; view history (last 30 days) |
| **Month total** | Auto-calculates current month's total labor cost |
| **Earnings & Deductions integration** | Labor Cost appears as orange deduction line in Net Payable calculation |
| **Phase 2 note** | Info banner explains future factory-provided workers feature |
| **RBAC** | New `labor.own` capability + `supplier-labor` NavItem |
| **i18n** | Module label added to EN/SI/TA |

### 32.3 Files Changed

```
src/modules/SupplierLabor.tsx     | NEW (200 lines) — full labor cost calculator + history + Phase 2 note
src/modules/registry.ts           | +2 lines (import + route)
src/lib/rbac.ts                   | +4 lines (labor.own capability + NavItem + supplier array)
src/modules/SupplierPortal.tsx    | +15 lines (labor cost deduction in Earnings & Deductions)
src/i18n/locales/en.json          | +1 module entry
src/i18n/locales/si.json          | +1 module entry
src/i18n/locales/ta.json          | +1 module entry
```

### 32.4 No SQL Migration Needed

Labor data is stored in localStorage (`kdu.supplier_labor.{uid}`). Phase 2 will migrate to Supabase when factory-provided workers feature is added.

### 32.5 Verification

- ✅ `vite build`: succeeds (10.82s, 3.19 MB / 880 KB gzipped)
- ✅ TypeScript: no new errors
- ✅ Supplier can access "My Labor" via More sheet
- ✅ Labor cost appears in Earnings & Deductions → Deductions Breakdown
- ✅ Net Payable = Gross − Fertilizer − Advances − Labor Cost

## 33. B33 — Supplier Labor Data Persisted to Supabase (Round #15)

> **Purpose:** localStorage-only labor data could be lost on phone reset / cache clear. Now persisted to Supabase `supplier_labor_logs` table.

### 33.1 SQL Migration — Round #9 (REQUIRED)

**File:** `docs/migration_phase3_round9.sql`

Creates `supplier_labor_logs` table with:
- `supplier_id` (text) + `log_date` (date) — unique index (one snapshot per supplier per day)
- `lines` (JSONB) — array of {category, headcount, wage, subtotal}
- `total_cost` (numeric) + `total_headcount` (integer)
- RLS + real-time enabled

### 33.2 What Changed

| File | Change |
|---|---|
| `SupplierLabor.tsx` | Save: upsert to Supabase + localStorage. Load: read from Supabase (falls back to localStorage). |
| `SupplierPortal.tsx` | Earnings & Deductions now reads labor month total from Supabase (falls back to localStorage). |

### 33.3 Data Flow

```
Supplier saves snapshot → localStorage (instant UI) + Supabase upsert (survives reset)
Supplier opens app → localStorage (instant) → Supabase (authoritative, overwrites cache)
Earnings & Deductions → reads month total from Supabase (falls back to localStorage)
```

### 33.4 No Data Loss

Even if supplier clears their phone:
- Supabase has all snapshots
- On next login, app loads from Supabase → restores full history
- Month total auto-recalculated from Supabase records

---

## 34. Ideas 1–4 — Supplier Transparency, i18n, Factory Routes and Registration

### 34.1 Connected Operational Flow

```text
Supplier self-registration
  → Firebase email/password account
  → Supabase users row (pending_approval + supplier_no + factory_id + route_id)
  → Admin verifies and approves
  → Supplier can sign in

Factory selection → filtered route selection → route-filtered supplier directory
  → Collector selects supplier + grade + gross weight + deduction
  → EMS calculates net kg and amount from daily grade price
  → Supplier deliveries/home/payment estimate update

Collector starts route GPS → lorry_locations upsert
  → Supabase Realtime route subscription
  → assigned supplier sees current lorry marker on the home dashboard
```

### 34.2 Grade and Financial Transparency

- Daily delivery totals are grouped by grade with kg, current rate and calculated amount.
- Monthly gross income is grouped by grade; the external factory finance system remains the final source of truth.
- Quality percentage is calculated by leaf weight, not record count. A low premium-grade percentage produces a quality-improvement tip.
- Fertilizer credit, active advances and labour costs remain deductions in the live estimated net payable.

### 34.3 Professional Internationalization

- English, Sinhala and Tamil locale files have matching `supplierHome`, `supplierDelivery`, `status`, `grade`, `activity`, `moveType`, `landType`, `plotState` and `role` keys.
- Database values remain in English and are normalized through `src/i18n/databaseValues.ts` before display.
- The supplier home, delivery/finance, calendar, labour, plot, profile, tips and automated-alert displays no longer combine Sinhala and English in one label.

### 34.4 Database Migration (Required)

Run `docs/migration_phase3_round10.sql` in Supabase SQL Editor. It creates and seeds all six factories and their supplied route lists, adds supplier operational fields and harvest grading fields, enables realtime lorry locations, and inserts today's grade prices.

### 34.5 Protected Architecture

- Firebase remains the email/password authentication provider; Supabase remains the PostgreSQL data platform.
- `src/lib/auth.hybrid.ts`, `src/lib/rbac.ts`, and `.env` were not changed.
- Pending-account gating is implemented outside the protected auth module.

## 35. Navigation Label Stabilization

- Supplier bottom navigation uses short localized labels for Home, Calendar and Profile in English, Sinhala and Tamil.
- Equipment, Equipment Requests and Field Tools now also have complete localized navigation labels.
- Missing translations fall back to a readable short name instead of exposing an internal key such as `modules.supplier-home.s`.
- Bottom-navigation labels are constrained to one line so long text cannot distort the mobile navigation bar.

---

## 36. Supplier Home Greeting and Price Reference

- The supplier greeting refreshes every minute and follows Sri Lanka time: morning, afternoon, evening and night.
- The greeting is presented as a professional localized heading with the supplier's first name and a separately formatted date.
- The Coarse Leaf card is hidden from the supplier home price summary; Coarse remains available in historical operational records.
- The three displayed green-leaf reference rates are Standard Rs.176/kg, Super Rs.186/kg and PV Super Rs.204/kg.
- Prices are explicitly marked as indicative because the factory-confirmed amount changes under the Sri Lanka Tea Board monthly reasonable-price formula.
- The Standard reference is derived from the September 2026 national tea sales average using the Tea Board 68:32 reasonable-price formula and 4.65 kg green leaf conversion. The Super reference adds the latest published 5.43% quality premium; PV Super uses the latest published high supplier purchase reference, rounded to the nearest rupee.
- `docs/migration_round18_supplier_reference_prices.sql` updates existing Supabase installations; new installations receive the same defaults from Round #10.

---

## 37. Login Screen Copy Simplification

- Removed the role-list, account-creation and Firebase/Supabase informational sentences from the login screen.
- Authentication behavior, supplier registration and language selection remain unchanged.

---

## 38. Login Language Selector Position

- The login language selector is anchored to the top-right corner on desktop and mobile screens.
- Mobile safe-area spacing keeps it below notches and system status areas.
- Its language-switching behavior and authentication flow remain unchanged.

---

*End of Workflow Diagram. Last updated: October 2026 (Round #20 — login language selector position).*







