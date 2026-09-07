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
