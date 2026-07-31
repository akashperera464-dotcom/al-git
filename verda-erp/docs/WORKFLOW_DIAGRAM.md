# KDU ERP — A to Z Workflow Diagram (For Management)
### පද්ධතියේ සම්පූර්ණ ක්‍රියාපිළිවෙල — The Complete Business Workflow

> **Purpose / අරමුණ:** This document explains, in simple non-technical terms, exactly how the Tea Estate ERP system works from start to finish. It shows what happens when a Factory Owner, an Extension Officer, and a Supplier use the system, and how data flows between them.
>
> **අරමුණු:** මෙම ලේඛනය තුළින් පද්ධතියේ සම්පූර්ණ ක්‍රියාපිළිවෙල තාක්ෂණික නොවන සරල භාෂාවෙන් විස්තර කර ඇත. මෙයින් පෙන්වන්නේ වතු හිමියෙකු, දිගු සේවා නිළධාරීයෙකු සහ සැපයුම්කරුවෙකු පද්ධතිය භාවිතා කරන විට එය කෙසේ ක්‍රියාත්මක වේ ද යන්නයි.

---

## 1. System Overview / පද්ධතියේ සැලැස්ම

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         KDU TEA ESTATE ERP                              │
│                      (තේ වතු ව්‍යවහාරය)                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                    │
    ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐
    │   FACTORY   │     │ EXTENSION   │     │   SUPPLIER  │
    │   OWNER     │     │  OFFICER    │     │  (කොළ      │
    │ (පරිපාලක)  │     │ (ක්ෂේත්‍ර    │     │  සැපයුම්   │
    │             │     │  නිළධාරී)   │     │  කරු)       │
    │ Uses:       │     │ Uses:       │     │ Uses:       │
    │ Web Panel   │     │ Mobile App  │     │ Mobile App  │
    │ (Computer)  │     │ (Phone)     │     │ (Phone)     │
    └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
           │                    │                    │
           └────────────────────┼────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   CENTRAL DATABASE    │
                    │  (මධ්‍යම දත්ත ගබඩාව)    │
                    │                       │
                    │ All data is saved     │
                    │ here in real-time.    │
                    │ සියලු දත්ත මෙහි      │
                    │ සජීවීව ගබඩා වේ.       │
                    └───────────────────────┘
```

**Key Points / වැදගත් කරුණු:**
- වතු හිමියා පරිගණකයෙන් ද, නිළධාරීන් සහ සැපයුම්කරුවන් දුරකථන යෙදුමෙන් ද පද්ධතිය භාවිතා කරයි.
- Factory owners use computers, officers and suppliers use mobile apps.
- සියලු දත්ත එක් මධ්‍යම ස්ථානයක ගබඩා වේ. කවරෙකු විසින් දත්තයක් ඇතුළත් කළ විට, එය සැණෙකින් සියලු දෙනාට දර්ශනය වේ.
- All data is saved in one central place. When anyone enters data, it instantly appears for everyone.

---

## 2. Three User Roles / පරිශීලක කණ්ඩායම් තුන

### A. Factory Owner (Admin) / වතු හිමියා (පරිපාලක)
- **Uses:** Web Panel on a Computer
- **Power:** Full control. Can see everything, manage everyone, and create/delete any record.
- **භාවිතය:** පරිගණකයෙන් පරිපාලන පුවරුව
- **බලය:** සම්පූර්ණ පාලනය. සියල්ල දැකිය හැක, සියල්ල කළ හැක.

### B. Extension Officer / දිගු සේවා නිළධාරී
- **Uses:** Mobile App on a Phone
- **Power:** Field operations only. Can register new suppliers and record leaf weights.
- **භාවිතය:** දුරකථන යෙදුම
- **බලය:** ක්ෂේත්‍ර කටයුතු පමණි. නව සැපයුම්කරුවන් ලියාපදිංචි කළ හැක, කොළ බර සටහන් කළ හැක.

### C. Supplier / සැපයුම්කරු (කොළ සපයන්නා)
- **Uses:** Mobile App on a Phone
- **Power:** View own data only. Can see their deliveries, payments, and farm advisories.
- **භාවිතය:** දුරකථන යෙදුම
- **බලය:** තමන්ගේ දත්ත පමණි. තම භාරදීම්, ගෙවීම් සහ උපදේශන දැකිය හැක.

---

## 3. A-to-Z Workflow: Estate Setup / වත්තක් ආරම්භ කිරීම

```
Step 1: Factory Owner creates the Estate
පියවර 1: වතු හිමියා වත්ත නිර්මාණය කරයි

   [Admin Panel] → Click "Estate Master" → "Create Estate"
   ↳ Enter Name, Region, Area, GPS Coordinates, Planted Date
   ↳ System saves to Database ✅

                    ↓

Step 2: Add Divisions (Supply Routes)
පියවර 2: කොට්ටාශ එක් කිරීම (සැපයුම් මාර්ග)

   [Admin Panel] → Select Estate → "Create Division"
   ↳ Enter Route Name (e.g., "Sutton", "Craighead")
   ↳ System saves under that Estate ✅

                    ↓

Step 3: Add Fields under Divisions
පියවර 3: ක්ෂේත්‍ර එක් කිරීම

   [Admin Panel] → Select Estate + Division → "Create Field"
   ↳ Enter Field Code (e.g., "S-01"), Cultivar, Area
   ↳ System saves under that Division ✅
```

**Summary:** The Factory Owner builds the land hierarchy: Estate → Division → Field. This is the geographical foundation for everything else.
**සාරාංශය:** වතු හිමියා භූමි ධූරාවලිය ගොඩනඟයි: වත්ත → කොට්ටාශය → ක්ෂේත්‍රය.

---

## 4. A-to-Z Workflow: Supplier Onboarding / සැපයුම්කරුවෙකු ලියාපදිංචි කිරීම

```
Step 1: Extension Officer opens the App
පියවර 1: දිගු සේවා නිළධාරී යෙදුම විවෘත කරයි

   [Mobile App] → Login → Tap "Register New Supplier"
   ↳ Enter Supplier's Name, Email, Password
   ↳ Select which Factory (Estate) they belong to
   ↳ (Optional) Select which Route (Division)

                    ↓

Step 2: System creates the account
පියවර 2: පද්ධතිය ගිණුම සාදයි

   ↳ Creates a secure login for the supplier
   ↳ Links them to the selected Estate
   ↳ The supplier can now log in ✅

                    ↓

Step 3: Supplier logs in for the first time
පියවර 3: සැපයුම්කරු පළමු වරට පිවිසේ

   [Mobile App] → Supplier enters Email + Password
   ↳ System identifies them as a "Supplier"
   ↳ Shows only THEIR data (Deliveries, Payments, Alerts)
```

---

## 5. A-to-Z Workflow: Leaf Delivery & Payment / කොළ භාරදීම සහ ගෙවීම

```
Step 1: Supplier delivers green leaf to collection center
පියවර 1: සැපයුම්කරු කොළ භාරදෙයි

   [Physical Action] → Supplier brings tea leaf to the factory center

                    ↓

Step 2: Extension Officer weighs the leaf
පියවර 2: නිළධාරී කොළ බර කරයි

   [Mobile App] → Officer taps "Leaf Weighing Entry"
   ↳ Enters Gross Weight (e.g., 25 kg)
   ↳ Enters Deduction % (e.g., 4% for moisture)
   ↳ System calculates Net Weight (24 kg)
   ↳ Selects Quality Grade (Super / Standard / Coarse)
   ↳ Saves to Database → linked to that Supplier ✅

                    ↓ (AUTOMATIC - ස්වයංක්‍රීය)

Step 3: Supplier sees the delivery instantly
පියවර 3: සැපයුම්කරු භාරදීම සැණෙකින් දැකීම

   [Mobile App] → Supplier opens "My Leaf Deliveries"
   ↳ Sees: "24 kg net, Super grade, recorded today"
   ↳ (No refresh needed — appears in real-time)

                    ↓

Step 4: Admin processes payment
පියවර 4: පරිපාලක ගෙවීම සකසයි

   [Admin Panel] → Admin sets the price per kg (e.g., Rs 165)
   ↳ System calculates: 24 kg × Rs 165 = Rs 3,960
   ↳ Admin marks as "Paid"

                    ↓ (AUTOMATIC - ස්වයංක්‍රීය)

Step 5: Supplier sees payment status
පියවර 5: සැපයුම්කරු ගෙවීම් තත්වය දැකීම

   [Mobile App] → Supplier opens "Payment Tracker"
   ↳ Sees: "Rs 3,960 — Paid" (or "Pending")
```

---

## 6. A-to-Z Workflow: Smart Farm Advisory / බුද්ධිමත් ගොවි උපදේශන

```
Step 1: Supplier enters their plantation date
පියවර 1: සැපයුම්කරු වගා දිනය ඇතුළත් කරයි

   [Mobile App] → "Smart Alerts" → Sets "Planted Date"
   ↳ Example: Plants were planted on Jan 1, 2020

                    ↓

Step 2: System calculates plant age
පියවර 2: පද්ධතිය පැළ වයස ගණනය කරයි

   ↳ System knows: "These plants are 5 years old"
   ↳ Based on age → Determines pruning cycle is due

                    ↓

Step 3: System checks weather for that estate
පියවර 3: පද්ධතිය එම වත්තේ කාලගුණය පරීක්ෂා කරයි

   ↳ Fetches live weather for the estate's GPS location
   ↳ Example: "3 days of light rain expected (12mm)"

                    ↓

Step 4: System generates smart advice
පියවර 4: පද්ධතිය බුද්ධිමත් උපදේශ ලබා දේ

   ↳ "🌱 Fertilizer Window Open: 5 years old, light rain coming.
      Apply fertilizer now for best results."
   ↳ "✂️ Pruning Recommendation: Deep prune due within 2 months."

                    ↓

Step 5: Supplier logs what they did
පියවර 5: සැපයුම්කරු කළ දේ සටහන් කරයි

   [Mobile App] → "My Farm Activities" → Logs "Applied 50kg Urea"
   ↳ System reads this → Resets the fertilizer cycle
   ↳ Next advice: "Next fertilizer due in 90 days"
```

---

## 7. A-to-Z Workflow: Resource Requests / සම්පත් ඉල්ලීම්

```
Step 1: Supplier needs workers or equipment
පියවර 1: සැපයුම්කරුට ශ්‍රමිකයන් හෝ උපකරණ අවශ්‍යයි

   [Mobile App] → "Request Resources"
   ↳ Type: Workers / Equipment / Fertilizer / Agrochemical
   ↳ Quantity: e.g., "5 workers"
   ↳ Date needed: e.g., "Tomorrow"

                    ↓

Step 2: Factory Owner sees the request instantly
පියවර 2: වතු හිමියා ඉල්ලීම සැණෙකින් දැකීම

   [Admin Panel] → 🔔 Notification bell shows "1 new request"
   ↳ Opens "Resource Requisitions"
   ↳ Sees: "Supplier X wants 5 workers for tomorrow"

                    ↓

Step 3: Admin approves or rejects
පියවර 3: පරිපාලක අනුමත හෝ ප්‍රතික්ෂේප කරයි

   ↳ Admin clicks "Approve & Allocate" (or "Reject with Reason")

                    ↓ (AUTOMATIC - ස්වයංක්‍රීය)

Step 4: Supplier gets notified
පියවර 4: සැපයුම්කරුට දැනුම් දීම

   ↳ System sends a push notification to the supplier's phone
   ↳ "✅ Resource Request Approved: 5 workers allocated"
```

---

## 8. A-to-Z Workflow: Announcements / නිවේදන

```
Step 1: Admin writes an article
පියවර 1: පරිපාලක ලිපියක් ලියයි

   [Admin Panel] → "Announcements" → "New Article"
   ↳ Types Title, Category (News/Advisory), Body text, Image
   ↳ Clicks "Publish"

                    ↓ (INSTANT - ක්ෂණික)

Step 2: All suppliers see it immediately
පියවර 2: සියලු සැපයුම්කරුවන්ට ක්ෂණිකව දර්ශනය වේ

   [Mobile App] → Supplier opens "Estate Updates" tab
   ↳ Sees the full article with image and text
   ↳ Real-time — no refresh needed
```

---

## 9. Complete Navigation Map / සම්පූර්ණ යෙදුම් සිතියම

### Factory Owner (Admin Web Panel) / වතු හිමියා
| Module / මොඩියුලය | What it does / ක්‍රියාව |
|---|---|
| **Estate Dashboard** | Live KPIs: harvest today, workforce, revenue, pending requests |
| **Estate Master** | Create/edit Estates, Divisions, Fields + GPS coordinates |
| **Labor Management** | Full CRUD workers: add, edit, delete, QR attendance |
| **Harvest Management** | View all weigh-in records + grade distribution |
| **Inventory & Procurement** | Stock items, Purchase Orders, Receive Goods (GRN), Issue Stock |
| **Fertilizer** | Real-time fertilizer stock levels (read-only overview) |
| **Equipment** | Real-time equipment stock levels (read-only overview) |
| **Agrochemical** | Real-time agrochemical stock levels (read-only overview) |
| **Resource Requisitions** | Approve/reject supplier requests |
| **User Management** | Create/edit/delete all users (Officers, Suppliers, Admins) |
| **Announcements** | Publish articles/news visible to all suppliers |
| **Weather & Environment** | Per-estate live weather + deterministic alerts |
| **Payroll / Loans / Finance** | Full CRUD for all financial records |
| **Branding & Settings** | Customize logo, login page, colors (Super Admin only) |

### Extension Officer (Mobile App) / දිගු සේවා නිළධාරී
| Tab / ටැබ් | What it does / ක්‍රියාව |
|---|---|
| **Register Supplier** | Create new supplier accounts linked to an estate |
| **Leaf Weighing** | Record green leaf weights (offline-capable) |

### Supplier (Mobile App) / සැපයුම්කරු
| Tab / ටැබ් | What it does / ක්‍රියාව |
|---|---|
| **My Leaf Deliveries** | Real-time view of their own deliveries + GPS location verify |
| **Smart Alerts** | Fertilizer schedule, plucking plan, pruning advice (plant age-based) |
| **Payment Tracker** | Own earnings history, paid/pending amounts |
| **My Farm Activities** | Log fertilizer/pruning/harvest → updates advisory engine |
| **Estate Updates** | Read articles/news published by admin |
| **Request Resources** | Request workers/equipment → admin approves → push notification |

---

## 10. How Data Flows / දත්ත ගලායාම

```
                    INPUT                          OUTPUT
                    (ආදානය)                      (ප්‍රතිදානය)

Extension Officer  ────┐                    ┌────  Supplier sees delivery
records leaf weight    │                    │     (real-time, no refresh)
                       │                    │
Admin sets price   ────┼──→  DATABASE  ────┼────  Supplier sees payment
                       │    (දත්ත ගබඩාව)    │
Admin publishes    ────┤                    ├────  All suppliers see article
announcement           │                    │
                       │                    │
Supplier requests  ────┘                    └────  Admin gets notification
workers                                      🔔
```

**The Golden Rule / රන් නීතියයි:**
> කවරෙකු විසින් දත්තයක් ඇතුළත් කරන විට, එය තත්පරයකින් සියලු දෙනාට දර්ශනය වේ. ප්‍රතිපෝෂණය කිරීමක් (refresh) අවශ්‍ය නොවේ.
>
> When anyone enters data, it appears for everyone in less than a second. No refresh needed.

---

*This document provides a complete non-technical overview of the KDU TEA FACTORY Estate ERP system workflow.*
*මෙම ලේඛනය තුළින් KDU TEA FACTORY තේ වතු ERP පද්ධතියේ සම්පූර්ණ ක්‍රියාපිළිවෙල තාක්ෂණික නොවන ආකාරයෙන් විස්තර කර ඇත.*

---

## 11. A-to-Z Workflow: Stock & Inventory Management / තොග හා ද්‍රව්‍ය කළමනාකරණය

> **Purpose / අරමුණ:** Track all fertilizer, equipment, agrochemicals, fuel and other stock — from purchase to issue — with full audit trail and supplier-request linking.

### Three Sub-Tabs in the Inventory Module / තොග මොඩියුලයේ ටැබ් තුන

```
┌──────────────────────────────────────────────────────────────────┐
│                    INVENTORY MODULE (තොග මොඩියුලය)              │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ Stock Items │  │ Purchase    │  │ Receive     │  │ Issue / │ │
│  │             │  │ Orders (PO) │  │ Goods (GRN) │  │Movement│ │
│  │ Add items   │  │ Order from  │  │ Add qty to  │  │ Issue  │ │
│  │ + opening   │  │ suppliers   │  │ stock       │  │ out +  │ │
│  │ balance     │  │             │  │             │  │ link   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Stock Lifecycle / තොග ජීවන චක්‍රය

**Step 1 — Add Stock Item / තොග අයිතමයක් එක් කිරීම**
```
[Admin Web Panel] → Inventory → "Stock Items" tab → "Add Stock Item"
   ↳ Code: e.g., FERT-UREA
   ↳ Name: e.g., Urea (46% N)
   ↳ Category: Fertilizer / Agrochemical / Fuel / Equipment / Other
   ↳ Unit: kg / L / pcs
   ↳ Opening Qty: e.g., 1250 (initial quantity in stock)
   ↳ Unit Cost: e.g., Rs 95 (used for valuation)
   ↳ Reorder Level: e.g., 200 (alert threshold)
       ↓
   ↳ System shows live preview: "Opening value: Rs 118,750"
   ↳ Click "Add" → stock item is saved with opening balance
```

**Step 2 — Create Purchase Order (PO) / ิත්‍ර ගැනීමේ ඇණවුමක් සෑදීම**
```
[Admin Web Panel] → Inventory → "Purchase Orders" tab
   ↳ Supplier Name: e.g., "CIC Fertilizers Ltd"
   ↳ Add lines: select stock item + qty + unit cost
   ↳ Click "Create PO" → PO saved as "draft" status
```

**Step 3 — Receive Goods (GRN) / භාණ්ඩ පිළිගැනීම**
```
[Admin Web Panel] → Inventory → "Receive Goods (GRN)" tab
   ↳ Select PO (optional) → lines auto-fill
   ↳ Or direct receipt (no PO) — add lines manually
   ↳ Supplier Invoice No
   ↳ Adjust qty received if partial delivery
   ↳ Click "Receive & Update Stock"
       ↓
   ↳ Stock qty_on_hand increases automatically
   ↳ Movement audit trail records "IN" transaction
   ↳ PO status updates to "received" or "partially_received"
```

**Step 4 — Issue Stock to Supplier / Field / තොග නිකුත් කිරීම**
```
[Admin Web Panel] → Inventory → "Issue / Movements" tab → "Issue Stock"
   ↳ Select item (dropdown shows current qty on hand)
   ↳ Quantity to issue
   ↳ Link to Supplier Request (optional):
        - Dropdown filters pending requests matching the item
        - Selecting shows: "Supplier asked for X, you're issuing Y"
        - Audit trail records the request reference
   ↳ Notes (optional): recipient name / field block / reason
   ↳ Click "Issue Out"
       ↓
   ↳ Stock qty_on_hand decreases
   ↳ Movement audit trail records "OUT" transaction with request ref
```

### Stock Visibility — Three Read-Only Overview Modules / තුන් තොටම් දර්ශනය

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   FERTILIZER     │  │    EQUIPMENT     │  │  AGROCHEMICAL    │
│   MODULE         │  │     MODULE       │  │     MODULE       │
│                  │  │                  │  │                  │
│ Shows only       │  │ Shows only       │  │ Shows only       │
│ fertilizer stock │  │ equipment stock  │  │ agrochem stock   │
│ from Inventory   │  │ from Inventory   │  │ from Inventory   │
│                  │  │                  │  │                  │
│ Stats:           │  │ Stats:           │  │ Stats:           │
│ • Types count    │  │ • Types count    │  │ • Types count    │
│ • Stock value    │  │ • Stock value    │  │ • Stock value    │
│ • Low stock      │  │ • Low stock      │  │ • Low stock      │
│                  │  │                  │  │                  │
│ Export CSV       │  │ Export CSV       │  │ Export CSV       │
└──────────────────┘  └──────────────────┘  └──────────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ↓
              (All 3 read from stock_items table
                filtered by category=fertilizer /
                category=equipment / category=agrochemical)
```

**Key Points / වැදගත් කරුණු:**
- තොග අයිතම එකතු කිරීමේදී ආරම්භක ප්‍රමාණය, ඒකක මිල සහ නැවත ඇණවුම් මට්ටම ඇතුළත් කළ හැක.
- එක් ස්ථානයකින් තොග කළමනාකරණය කරයි — Fertilizer, Equipment, Agrochemical යන මොඩියුල සියල්ල එකම `stock_items` පද්ධතියෙන් කියවයි.
- සැපයුම්කරුගේ ඉල්ලීමට අදාළව තොග නිකුත් කිරීමේදී, ඉල්ලීමේ යොමුව ස්වයංක්‍රීයව වාර්තා ලොගයට එකතු වේ.
- Add Stock Item form now captures opening qty + unit cost + reorder level — no need to create fake PO/GRN just to set initial values.

---

## 12. A-to-Z Workflow: Push Notifications (FCM) / දැනුම්දීම් පණිවිඩ

> **Purpose / අරමුණ:** Real-time push notifications to suppliers' phones — even when the app is closed. Uses Firebase Cloud Messaging (FCM).

### How Push Notifications Flow / දැනුම්දීම් ගලායාම

```
   Admin Action (e.g., approve supplier request)
                  ↓
   ┌──────────────────────────────────┐
   │   Webapp writes to Firestore     │
   │   notifications/{notifId}        │
   │   + triggers Cloud Function      │
   └──────────────────────────────────┘
                  ↓
   ┌──────────────────────────────────┐
   │   Cloud Function looks up        │
   │   supplier's FCM token in        │
   │   fcm_tokens/{supplierUid}       │
   └──────────────────────────────────┘
                  ↓
   ┌──────────────────────────────────┐
   │   Cloud Function calls           │
   │   admin.messaging().send({token})│
   └──────────────────────────────────┘
                  ↓
   ┌──────────────────────────────────┐
   │   Firebase delivers to phone     │
   │   via FCM channel                │
   └──────────────────────────────────┘
                  ↓
   ┌──────────────────────────────────┐
   │   APK's expo-notifications       │
   │   plugin shows system notif      │
   │   🔔 (even if app is closed)     │
   └──────────────────────────────────┘
                  ↓
   Supplier taps notification → APK opens → navigates to relevant screen
```

### When Suppliers Get Notifications / දැනුම්දීම් ලැබෙන අවස්ථා

| Trigger / ක්‍රියාව | Recipient / ලාභී | Notification Title / මාතෘකාව |
|------|----------|----------------|
| Admin approves supplier's resource request | That supplier | "✅ Request Approved" |
| Admin rejects supplier's resource request | That supplier | "❌ Request Rejected" |
| Admin publishes new announcement | All suppliers | "📢 New Announcement" |
| Admin marks supplier's leaf delivery as paid | That supplier | "💰 Payment Received" |
| Admin sends custom broadcast | All suppliers | Custom title |
| Weather alert triggered (deterministic) | All estate suppliers | "🌦️ Weather Alert" |
| Smart farm advisory scheduled (fertilizer/pruning) | Affected supplier | "🌱 Advisory: …" |

### FCM Token Registration Flow / ටෝකන් ලියාපදිංචිය

```
   1. Supplier opens APK → APK calls Notifications.getDevicePushTokenAsync()
       ↓
   2. APK gets FCM token from Firebase (unique per device)
       ↓
   3. APK forwards token to WebView via bridge event "verda:fcm-token"
       ↓
   4. Webapp (PWA) listens for bridge event:
        window.addEventListener("verda:fcm-token", (e) =>
          registerFcmToken(e.detail.token));   // → Firestore fcm_tokens
       ↓
   5. Token saved in Firestore: fcm_tokens/{supplierUid} = { token, updatedAt }
       ↓
   6. Cloud Function can now send push to this supplier using their token
```

**Key Points / වැදගත් කරුණු:**
- සැපයුම්කරු APK එක ස්ථාපනය කර පළාත් පිවිසුණු විට, FCM ටෝකනය ස්වයංක්‍රීයව ලියාපදිංචි වේ.
- යෙදුම වසා ඇති විටදීත්, දැනුම්දීම් පණිවිඩ ලැබේ (FCM හරහා).
- සැබෑ දැනුම්දීම් ලැබීමට අවශ්‍ය නම්, APK ස්ථාපනය කර තිබිය යුතුය (වෙබ් බ්‍රවුසරයෙන් පමණක් දැනුම්දීම් ලැබෙන්නේ නැත).
- Push notifications only work on the installed APK (not in browser PWA — browsers don't receive FCM natively on Android).

---

## 13. Mobile App Architecture / ජංගම යෙදුම් ගෘහ නිර්මාණ ශිල්පය

> **Purpose / අරමුණ:** Explains why the APK is small, why updates don't require Play Store review, and how the app loads new features instantly.

### Hybrid WebView Architecture / දෙමුහුම් ගෘහ නිර්මාණය

```
┌─────────────────────────────────────────────────────────────┐
│                    KDU TEA FACTORY APK                       │
│                  (Installed on Android Phone)                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────┐  ┌──────────────────────────────────────┐   │
│  │  Native    │  │     WebView (Chrome engine)          │   │
│  │  Shell     │  │                                      │   │
│  │  (Kotlin)  │  │  Loads https://akashpereraproject24  │   │
│  │            │──│  .vercel.app in full-screen mode     │   │
│  │  • Splash  │  │                                      │   │
│  │  • Status  │  │  ← PWA (the actual ERP)              │   │
│  │    bar     │  │                                      │   │
│  │  • FCM     │  │  All 30+ modules (Inventory,         │   │
│  │    push    │  │  Labor, Fertilizer, Equipment,       │   │
│  │  • Camera  │  │  Finance, Payroll, etc.) live here  │   │
│  │    bridge  │  │                                      │   │
│  │  • Location│  │  Hosted on Vercel (CDN-edge)         │   │
│  │    bridge  │  │                                      │   │
│  │  • Secure  │  │  ←─── Updates deployed via git push  │   │
│  │    storage │  │       (Vercel auto-builds + deploys) │   │
│  └────────────┘  └──────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              ↕
                              Internet
                              ↕
   ┌──────────────────────────────────────────────────────┐
   │           VERCEL HOSTING (Cloud)                     │
   │                                                      │
   │   • React + Vite build → static HTML/JS/CSS          │
   │   • Auto-deploys on every push to GitHub main branch │
   │   • Global CDN = fast loading from any location      │
   │   • URL: https://akashpereraproject24.vercel.app     │
   └──────────────────────────────────────────────────────┘
```

### Why This Architecture / ඇයි මෙම ගෘහ නිර්මාණය

| Benefit / වාසිය | Explanation / පැහැදිලි කිරීම |
|------|-------------|
| **Instant updates / ක්ෂණික යාවත්කාලීන** | Fix a bug → push to GitHub → Vercel deploys → all users see new version next time they open the APK. No Play Store review (3-7 days). |
| **Small APK size / කුඩා APK ප්‍රමාණය** | APK is ~15MB (just the WebView shell). The actual ERP code lives on Vercel, not in the APK. |
| **One codebase / එක් කේත පද්ධතියක්** | Write once (React + Vite). Runs on web, Android, iOS, desktop — all from the same code. |
| **Easy maintenance / എളുപ്ഄ නඩත්තුව** | One team, one codebase, one deploy pipeline. Bug fix takes 5 minutes, not days. |
| **A/B testing / A/B පරීක්ෂණ** | Server-side flags can roll features to 10% of users — impossible with native apps. |
| **Hotfixes / ක්ෂණික අලුත්වැඩියාව** | Production bug? Fix + deploy in 5 minutes. Native apps take days for Play Store review. |

### When Does the APK Need Rebuilding? / APK නැවත සෑදිය යුතු අවස්ථා

**APK does NOT need rebuild for:**
- ✅ New ERP modules added (e.g., we added Equipment module — no rebuild needed)
- ✅ Bug fixes in webapp code
- ✅ UI/UX changes (colors, layouts, new fields)
- ✅ Database schema changes
- ✅ Branding updates (logo, title) — these are stored on Supabase and fetched live

**APK NEEDS rebuild for:**
- ❌ Changing the WEB_URL (e.g., switching from one Vercel URL to another)
- ❌ Changing app icon / splash screen image (baked into APK at build time)
- ❌ Adding/removing native permissions (camera, location, notifications)
- ❌ Updating FCM/Firebase configuration
- ❌ Changing app name (the name under the icon on the phone)

### PWA vs APK — Feature Comparison / PWA vs APK සැසඳීම

| Feature | PWA (Browser) | APK (Installed) |
|---------|---------------|-----------------|
| Loads from `akashpereraproject24.vercel.app` | ✅ | ✅ |
| All 30+ ERP modules work | ✅ | ✅ |
| Camera (web getUserMedia API) | ✅ | ✅ |
| Geolocation | ✅ | ✅ |
| Offline cache (Service Worker) | ✅ | ✅ |
| **Push notifications (FCM)** | ❌ | ✅ |
| **App icon on home screen** | ⚠️ (via "Add to Home Screen") | ✅ (proper native icon) |
| **Background sync** | ⚠️ (limited) | ✅ |
| **Secure storage (Keychain/Keystore)** | ❌ | ✅ |
| **Auto-launch on phone boot** | ❌ | ✅ |
| Full-screen mode (no browser UI) | ❌ | ✅ |

**Recommendation / නිර්දේශය:**
- **Suppliers** → Install APK (need push notifications)
- **Admin/Officers** → Use web panel on desktop (faster typing, bigger screen)
- **Field staff** → Install APK (need offline + push)

---

## 14. A-to-Z Workflow: Branding & White-Label / සන්නාම සහ සුදු-ලේබල්

> **Purpose / අරමුණ:** Super Admin can customize the company name, logo, login page colors, and tagline — without code changes. Changes sync instantly to all devices.

### Branding System Overview / සන්නාම පද්ධතිය

```
   ┌─────────────────────────────────────────────────────────┐
   │              Super Admin → Settings Module              │
   │                                                         │
   │  • Company Name      (e.g., "KDU TEA FACTORY")         │
   │  • Company Tagline   (e.g., "Tea Estate ERP")          │
   │  • Company Logo URL  (Cloudinary/upload)               │
   │  • Login Title       (e.g., "KDU TEA FACTORY")         │
   │  • Login Subtitle    (e.g., "Integrated Platform")     │
   │  • Login Logo URL    (Cloudinary/upload)               │
   │  • Login Background URL (optional image/video)         │
   │  • Scrim Opacity     (0-100, darkens background)       │
   │  • Accent Color      (hex color, e.g., #10b981)        │
   └─────────────────────────────────────────────────────────┘
                              ↓
   ┌─────────────────────────────────────────────────────────┐
   │    Saved to Supabase `settings` table (key='branding') │
   │    + localStorage cache for instant first paint        │
   └─────────────────────────────────────────────────────────┘
                              ↓
   ┌─────────────────────────────────────────────────────────┐
   │      All devices + browsers + users get the new        │
   │      branding on next page load (no APK rebuild)       │
   └─────────────────────────────────────────────────────────┘
```

### Where Branding Appears / සන්නාම දර්ශනය වන ස්ථාන

| Location / ස්ථානය | What shows / පෙන්වන දේ |
|----------|-------------|
| **Browser tab title** | `KDU TEA FACTORY · Integrated Tea Estate ERP Platform` |
| **Login page** | KDU TEA FACTORY title + KDU logo + tagline |
| **Sidebar header (top-left)** | KDU TEA FACTORY company name + tagline |
| **Mobile header (top bar)** | KDU TEA FACTORY |
| **PDF report headers** | "KDU TEA FACTORY" + "Generated [timestamp]" |
| **PWA manifest (Add to Home Screen)** | App name = KDU TEA FACTORY |
| **APK loading screen** | "KDU TEA FACTORY" + KDU logo |
| **APK app icon (under icon on phone)** | "KDU TEA FACTORY" |

### How Super Admin Changes Branding / සන්නාම වෙනස් කරන ආකාරය

```
1. Log in as Super Admin (only Super Admin can access Settings)
       ↓
2. Navigate to Settings module (sidebar → "Branding & Settings")
       ↓
3. Edit fields in the form:
   - Company Name: e.g., "KDU TEA FACTORY"
   - Company Logo URL: paste Cloudinary URL (e.g., https://res.cloudinary.com/.../logokdu.png)
   - Login Title: e.g., "KDU TEA FACTORY"
   - Accent Color: pick from color picker
       ↓
4. Click "Save" → writes to Supabase settings table
       ↓
5. All devices refresh → new branding appears (no APK rebuild needed)
```

### Default Branding (Current) / වර්තමාන පෙරනිමි සන්නාම

```javascript
{
  companyName: "KDU TEA FACTORY",
  companyTagline: "Tea Estate ERP",
  companyLogoUrl: "https://res.cloudinary.com/dhd06wdov/image/upload/v1781669562/logokdu_xo5m6f.png",
  loginTitle: "KDU TEA FACTORY",
  loginSubtitle: "Integrated Tea Estate Enterprise Platform",
  loginLogoUrl: "https://res.cloudinary.com/dhd06wdov/image/upload/v1781669562/logokdu_xo5m6f.png",
  loginBackgroundUrl: "",
  loginScrimOpacity: 70,
  accentColor: "#10b981"
}
```

**Key Points / වැදගත් කරුණු:**
- සන්නාම වෙනස් කිරීම Super Admin විසින් පමණක් කළ හැක.
- සියලු දත්ත Supabase `settings` පද්ධතියේ ගබඩා වේ — ඕනෑම උපාංගයකින් වෙනස් කළ හැක, සියලු දෙනාට ක්ෂණිකව දර්ශනය වේ.
- Logo එකක් URL එකක් ලෙස ඇතුළත් කළ යුතුය (Cloudinary හෝ වෙනත් CDN හරහා).
- APK loading screen සහ app icon වෙනස් කිරීමට අවශ්‍ය නම්, නව EAS build එකක් අවශ්‍ය වේ.

---

## 15. Complete Module Map (Updated) / සම්පූර්ණ මොඩියුල සිතියම

### All 30+ Modules / සියලුම මොඩියුල 30+

```
ADMIN PANEL (Web) — Factory Owner Role:
├── 📊 Estate Dashboard        (live KPIs)
├── 🏛️ Estate Master           (estates, divisions, fields, GPS)
├── 👥 Labor Management         (workers, attendance, leave, transfers)
├── ⚖️ Harvest Management       (weigh-in records, grade distribution)
├── 📦 Inventory & Procurement  (NEW: stock + PO + GRN + issue + link-to-request)
├── 🌱 Fertilizer              (read-only stock overview)
├── 🔧 Equipment               (NEW: read-only stock overview)
├── 🧪 Agrochemical            (UPDATED: now reads from stock_items)
├── 📥 Resource Requisitions   (approve/reject supplier requests)
├── 👤 User Management          (CRUD all users)
├── 📢 Announcements            (publish to all suppliers)
├── 🌦️ Weather & Environment    (per-estate live weather + alerts)
├── 💰 Payroll System           (EPF/ETF, payslips, runs)
├── 🏦 Loans & Advances         (worker loans, advances)
├── 🧮 Finance & Accounting     (GL accounts, journals, double-entry)
├── 🏆 Loyalty Program          (points, rewards, redemption)
├── ❤️ Welfare Management       (welfare schemes)
├── 🗺️ GPS & GIS Mapping        (estate boundaries, fields)
├── 🚚 Vehicle & Fuel           (fleet, fuel logs)
├── 📱 Mobile & Offline         (PWA config, offline sync status)
├── 🧠 AI & Analytics           (predictive insights)
├── 🛡️ Audit & Compliance       (audit logs)
├── 📐 Architecture & Docs      (system overview)
├── 🎨 Branding & Settings      (NEW: KDU TEA FACTORY rebrand + logo)
├── 💼 Supplier Loans           (supplier-specific loans)
├── 🔨 Auction Sales            (Colombo Tea Auction integration)
└── 🛠️ Field Tools              (field calculators, charts)

EXTENSION OFFICER (Mobile App):
├── 📝 Register Supplier        (create supplier accounts)
└── ⚖️ Leaf Weighing            (record weights, offline-capable)

SUPPLIER (Mobile App):
├── 📊 My Leaf Deliveries       (real-time view + GPS verify)
├── 🔔 Smart Alerts             (fertilizer/pruning/plucking advice)
├── 💵 Payment Tracker          (earnings history, paid/pending)
├── 🌾 My Farm Activities       (log fertilizer/pruning/harvest)
├── 📰 Estate Updates           (read admin announcements)
└── 📥 Request Resources        (request workers/equipment/fertilizer)
```

**Total: 30+ modules across 3 user roles, all backed by Supabase PostgreSQL.**
**එකතු: පරිශීලක කාර්යභාරයන් 3 ක් හරහා මොඩියුල 30+ ක්, සියල්ල Supabase PostgreSQL මගින් සපයයි.**

---

*End of Workflow Diagram. Last updated: July 2026. KDU TEA FACTORY rebrand + Equipment module + Add Stock form improvements + Push Notifications documentation + Mobile App Architecture + Branding System.*
