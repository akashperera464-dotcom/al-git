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
   ↳ Type: Workers or Equipment
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

*This document provides a complete non-technical overview of the KDU Tea Estate ERP system workflow.*
*මෙම ලේඛනය තුළින් KDU තේ වතු ERP පද්ධතියේ සම්පූර්ණ ක්‍රියාපිළිවෙල තාක්ෂණික නොවන ආකාරයෙන් විස්තර කර ඇත.*
