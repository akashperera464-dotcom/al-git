# How Things Work — KDU Tea Estate Management System

> **මෙම ලේඛනයේ අරමුණ:** App එක පළමුවරට භාවිත කරන කෙනෙකුට වුවත්, කවුද මොන වැඩේ කරන්නේද, එක් feature එකක දත්ත තවත් feature එකකට යන්නේ කොහොමද, සහ වැඩක් අවසන් වූ බව දැනගන්නේ කොහොමද කියා සරලව පැහැදිලි කිරීම.
>
> **Current system snapshot:** 2026-10-25
> **Audience:** Super Admin, Admin, Extension Officer/Collector, Supplier, system reviewer සහ support staff.

---

## 1. පද්ධතිය එක වාක්‍යයකින්

මෙය තේ වතු, suppliers, collectors, දලු බර, routes, factories, stock, workers, weather, payments සහ approvals එකම තැනක සම්බන්ධ කර පාලනය කරන Estate Management System (EMS) එකකි.

සරල කතාව මෙන්න:

1. Admin කෙනෙක් supplier/collector accounts, factories සහ routes සකස් කරයි.
2. Supplier තම estate එක, blocks සහ GPS location එක ලියාපදිංචි කරයි.
3. Admin estate එක පරීක්ෂා කර approve හෝ reject කරයි.
4. Admin collector කෙනෙකුට අද දින route එක assign කරයි.
5. Collector route එකේ supplier සහ exact estate එක තෝරා දලු බර record කරයි.
6. Supplier ට digital receipt, grade, weight, estimated amount සහ alert එක පෙනේ.
7. Weather, farm activity, fertilizer සහ pruning data එකිනෙකට සම්බන්ධ වී උපදෙස් පෙන්වයි.
8. Admin pending approvals, reconciliation, reports, errors සහ month-end වැඩ එකම Operations Center එකෙන් බලයි.

---

## 2. පරිශීලක වර්ග හතර

### 2.1 Super Admin

Super Admin කියන්නේ system එකේ ඉහළම පාලකයාය.

ඔහුට/ඇයට:

- සියලු Admin features භාවිත කළ හැක.
- Admin accounts ඇතුළුව users පාලනය කළ හැක.
- Branding & Settings මගින් company name, logo, login page සහ supplier portal branding වෙනස් කළ හැක.
- Pending price changes හෝ month-end reopen වැනි ඉහළ අවසර අවශ්‍ය තීරණ ගත හැක.

### 2.2 Admin

Admin කියන්නේ estate/factory operations පාලනය කරන කාර්ය මණ්ඩලයයි.

Adminගේ ප්‍රධාන වැඩ:

- Users, suppliers සහ collectors පාලනය කිරීම.
- Supplier registrations සහ estates approve/reject කිරීම.
- Factory, route සහ collector assignments පාලනය කිරීම.
- Stock, fertilizer, equipment, workers, harvest සහ factory data නඩත්තු කිරීම.
- Supplier requests සඳහා තීරණ දීම.
- Reports, reconciliation, audit සහ system health පරීක්ෂා කිරීම.

Adminට Branding & Settings වෙනස් කළ නොහැක; එය Super Admin සඳහා පමණි.

### 2.3 Extension Officer / Collector

App එකේ `extension_officer` role එක field collector/extension officer වැඩ සඳහා භාවිත වේ.

ඔහුගේ/ඇයගේ ප්‍රධාන වැඩ:

- නව supplier ලියාපදිංචි කිරීම.
- Admin assign කළ අද route එක පමණක් භාවිත කිරීම.
- Ordered stop list අනුව suppliers වෙත යාම.
- Supplier number හෝ QR මගින් supplier හඳුනාගැනීම.
- Supplierගේ exact estate/collection point එක තෝරා ගැනීම.
- Gross weight, deduction, grade සහ net weight record කිරීම.
- Weight slip photo සහ supplier confirmation එක එකතු කිරීම.
- අවශ්‍ය විට original record delete නොකර Void/Reweigh කිරීම.
- Collection ආරම්භ කිරීම, lorry GPS broadcast කිරීම සහ shift එක complete කිරීම.

### 2.4 Supplier

Supplier කෙනෙක්ට තමන්ගේ දත්ත පමණක් පෙන්වන mobile-first portal එකක් ලැබේ.

Supplierට:

- Estates එකක් හෝ කිහිපයක් register කළ හැක.
- තම deliveries, grades, receipts සහ earnings බලන්න පුළුවන්.
- Farm activities සහ labor costs ලියන්න පුළුවන්.
- Fertilizer, agrochemical සහ equipment ඉල්ලීම් යවන්න පුළුවන්.
- Live weather, lorry location, alerts, announcements සහ guidance බලන්න පුළුවන්.
- Weight dispute, profile change හෝ support request යවන්න පුළුවන්.

---

## 3. Login සිට Home screen දක්වා

1. User email සහ password දමා Sign in කරයි.
2. Firebase Authentication login එක පරීක්ෂා කරයි.
3. App එක Firebase UID එකෙන් Supabase `users` profile එක කියවයි.
4. Profile එකේ role, status, factory, routes සහ linked estate බලයි.
5. Role එක අනුව නිවැරදි interface එක විවෘත වේ:
   - Super Admin/Admin → Estate Dashboard
   - Extension Officer/Collector → Register New Supplier
   - Supplier → Home
6. `pending_approval`, `suspended` හෝ `rejected` account එකකට active user කෙනෙකුගේ access එක නොලැබේ.

භාෂාව English, සිංහල හෝ தமிழ் ලෙස language button එකෙන් වෙනස් කළ හැක. Branding database එකෙන් load වීම නිසා Super Admin save කළ logo සහ names සියලු අදාළ screens වල පෙන්වයි.

---

## 4. Supplier කෙනෙකුගේ සම්පූර්ණ ගමන

### 4.1 Account එක ලබා ගැනීම

Supplier account එක ආකාර දෙකකින් ලැබිය හැක:

- Login page එකේ Register Here භාවිත කර self-registration යැවීම.
- Admin හෝ Extension Officer විසින් account එක register කිරීම.

Self-registration එකක් සාමාන්‍යයෙන් `pending_approval` තත්ත්වයෙන් ආරම්භ වේ. Admin approve කළ පසු supplierට normal login කළ හැක.

### 4.2 Factory සහ routes

Supplier කෙනෙකුට factory එකක් සහ authorized routes එකක් හෝ කිහිපයක් assign කළ හැක. එක් route එක primary route වේ. Route dropdown වල `GAL-ANG — ANGAMMANA` වැනි route code සහ name පෙන්වයි.

### 4.3 Estate register කිරීම

Supplier `My Plot` තුළ:

- Estate name
- Acreage සහ bush count
- Cultivar සහ soil type
- Address සහ contact phone
- Factory සහ authorized route
- GPS latitude/longitude
- Photos සහ notes
- Estate blocks

ඇතුළත් කර Submit කරයි. New estate එක `pending` වේ. Admin approve කරන තුරු official active estate එකක් ලෙස සැලකෙන්නේ නැත.

Supplierට estates කිහිපයක් register කළ හැක. Delivery එකක් කරන විට exact estate එක තෝරා ගන්නා නිසා එක් supplierගේ estates අතර data මිශ්‍ර නොවේ.

### 4.4 Estate approval

Admin Estate Master හෝ pending inbox එකෙන් estate එක බලයි:

- විස්තර නිවැරදි නම් `approved`.
- තොරතුරු අඩු/වැරදි නම් reason එකක් සමඟ `rejected`.
- Supplier edit කර නැවත submit කළොත් එය නැවත `pending` වේ.

Approved estate එකේ GPS coordinates weather සහ lorry ETA සඳහා භාවිත වේ.

### 4.5 දලු එකතු කිරීම

Admin අද collectorට route එක assign කරයි. Collector collection එක start කර stop list අනුව supplier වෙත යයි.

Collector:

1. Supplier number/QR හෝ list එකෙන් supplier තෝරයි.
2. Supplierගේ estate කිහිපයක් තිබේ නම් අද දලු ආ estate එක තෝරයි.
3. Gross weight ඇතුළත් කරයි.
4. Deduction percentage දමයි.
5. Grade තෝරයි.
6. App එක net weight ගණනය කරයි.
7. Photo/signature evidence එකතු කළ හැක.
8. Save & Sync කරයි.

Record එක save වූ විට receipt number එකක් ලැබේ. Supplierගේ My Leaf Deliveries සහ Smart Alerts වල එය පෙනේ.

### 4.6 Delivery grade සහ amount

System එක grade-wise weight සහ amount වෙන වෙනම පෙන්වයි. Current operational labels අතර:

- Super / KT Super
- Standard / Normal Leaf
- PV Super
- Legacy records වල තිබිය හැකි වෙනත් grade values

Historical delivery එකේ save වූ amount පසුව price වෙනස් කළා කියා නැවත වෙනස් නොවේ. Supplier financial screen එක estimate සහ confirmed value වෙනස් බව පැහැදිලි කරයි.

### 4.7 Payment සහ deductions

Supplier `Earnings & Deductions` තුළ:

- Gross earnings
- Fertilizer deductions
- Other deductions
- Paid amount
- Estimated net payable
- Confirmed net payable
- Payment history

බලයි. Month-end confirm කිරීමට පෙර value එක estimate එකකි. Factory/Admin confirm කළ පසු confirmed value එක පෙන්වයි.

### 4.8 Weight dispute

Receipt/weight එක වැරදි යැයි supplier සිතන්නේ නම් dispute/support workflow එකෙන් request එකක් යවයි. Adminගේ Operations & Pending inbox එකට එය යයි. Original weigh-in record delete නොකර decision සහ audit trail තබාගනී.

---

## 5. Supplier Portal එකේ එක් එක් feature එක

| Feature | එයින් කරන්නේ කුමක්ද? | සම්බන්ධ වන දත්ත |
|---|---|---|
| **Home** | Greeting, current tea prices, weather, monthly summary සහ live lorry එකම තැනක පෙන්වයි. | linked estate, factory, route, prices, financial view, realtime lorry channel |
| **My Calendar** | Plucking/farm schedule සහ due activities දින අනුව පෙන්වයි. | farm activities, pruning/plucking dates |
| **My Leaf Deliveries** | Digital receipts, daily/monthly totals සහ grade breakdown පෙන්වයි. | harvest records, prices, financial summary |
| **Smart Alerts Panel** | Delivery, payment, request, weather සහ advisory alerts පෙන්වයි. | alerts/notification queue |
| **Earnings & Deductions** | මාසික estimated/confirmed financial summary සහ deduction explanations පෙන්වයි. | supplier financial summary, payments, deductions |
| **My Farm Activities** | Fertilizing, pruning, plucking, replanting සහ වෙනත් field actions record කරයි. | estate/block, activity history, weather advisory |
| **My Plot** | Estates සහ blocks register/edit කර approval status බලයි. | estates, estate blocks, factory, routes, GPS |
| **My Weather** | Linked/selected estate GPS සඳහා live forecast සහ farm warnings පෙන්වයි. | estate coordinates, OpenWeather API |
| **Tips & Guidance** | Estate area, cultivar, weather සහ recorded work අනුව practical guidance පෙන්වයි. | estate profile, weather, activities |
| **My Fertilizer** | Factory විසින් issue කළ fertilizer ledger/history සහ balances පෙන්වයි. | inventory issues, supplier fertilizer ledger |
| **Estate Updates** | Admin announcements/articles කියවීමට සහ read status තබා ගැනීමට භාවිත වේ. | announcements, announcement reads |
| **Request Resources** | Equipment, Fertilizer හෝ Agrochemical request යවයි; status බලයි. | stock availability, resource requests |
| **My Labor** | Supplierගේම workers සඳහා daily labor cost calculations සහ history තබයි. | supplier labor records |
| **My Profile** | Personal details, notification preferences සහ approval අවශ්‍ය profile changes පාලනය කරයි. | users profile, notification preferences, workflow requests |
| **Help & Support** | Support ticket යවා Admin response සහ offline sync details බලයි. | workflow requests, offline queue |

`More` button එකෙන් primary bottom tabs වල නොපෙනෙන supplier features විවෘත කළ හැක.

Mobile phone එකක **Request Resources** form fields එක යට එක ලෙස පෙන්වයි; විශාල screen එකක columns දෙකක් භාවිත වේ. **My Labor** form එකේ category full width වන අතර worker count/wage fields දෙක සහ optional name/phone fields mobile screen එකෙන් පිටතට නොයන ලෙස responsive වේ.

---

## 6. Collector / Extension Officer වැඩ පිළිවෙල

### 6.1 Register New Supplier

Collector/Officerට supplier details, supplier number, factory සහ authorized routes ඇතුළත් කර registration එක සකස් කළ හැක. Account එක active වීමට Admin review අවශ්‍ය විය හැක.

### 6.2 අද route assignment එක

Collector තමන්ට කැමති route එකක් manually තෝරන්නේ නැත. Admin assign කළ අද route එක පමණක් පෙන්වයි.

Assignment status:

- `assigned` — route එක දී ඇත, collection තවම ආරම්භ කර නැත.
- `started` — collection සහ GPS broadcast ක්‍රියාත්මක කළ හැක.
- `completed` — අද collection අවසන්.
- `cancelled` — assignment අවලංගු කර ඇත.

Assignment එකක් නැත්නම් “No route assigned for today — contact admin” පෙන්වයි.

### 6.3 Stop list

Today’s ordered stop list එක route order අනුව suppliers පෙන්වයි. එක් stop එක:

- Pending
- Arrived
- Completed
- Missed

විය හැක. Missed කළොත් reason එකක් තබයි. Shift අවසානයේ collected, missed සහ remaining ගණන පෙන්වයි.

### 6.4 Weighing Entry

Record එක save කිරීමට factory, route, supplier, exact estate, grade සහ positive gross weight අවශ්‍ය වේ. Net weight formula:

`Net kg = Gross kg − Deduction kg`

Online නම් Supabase වෙත වහාම save වේ. Offline නම් device queue එකේ unique client record ID එකක් සමඟ තබා connection ආ විට sync කරයි. එම record එක නැවත යැවූවත් duplicate delivery එකක් නොවන ලෙස idempotency භාවිත වේ.

### 6.5 Void / Reweigh

Wrong weight record එක delete නොකර:

- Void reason එක තබයි.
- Original receipt audit history එකේ පවතී.
- Reweigh නම් corrected weight සඳහා නව record එකක් සාදයි.

### 6.6 Bluetooth scale

Browser/device එක Web Bluetooth support කරන විට compatible scale එකට connect වීමට button එක ඇත. Device/browser support නොමැති නම් manual weight entry භාවිත කළ හැක.

### 6.7 Lorry location

Collector Start Collection කර GPS tracking සක්‍රීය කළ පසු coordinates route-specific Supabase Realtime Broadcast channel එකකට යවයි.

- Location rows database එකට save නොවේ.
- Supplier subscribe කරන්නේ තම assigned route channel එකට පමණි.
- Supplier map එකේ lorry marker සහ estate marker පෙන්වයි.
- Haversine calculation මගින් distance සහ ETA frontend එකේම ගණනය වේ.
- 1.5 kmට අඩු වූ විට **වතු උපදෙස්** card එකේ ලොරිය සහ දලු සූදානම පිළිබඳ උපදෙස් පෙන්වයි.

---

## 7. Admin සහ Super Admin features

### 7.1 Command

#### Estate Dashboard

System overview එකයි. Estates, harvest, field performance, activity, environmental warnings සහ compliance snapshot එකක් පෙන්වයි. මෙය detailed data entry screen එකක් නොව management overview එකකි. Generic farming-tip banners මෙහි නොපෙන්වයි; personalized agronomy guidance Supplierගේ Tips & Guidance module එකේ පෙන්වයි.

### 7.2 Estate & Land

#### Estate Master

Company estates සහ supplier-owned estates එකම workflow එකෙන් පාලනය කරයි. Estate/block hierarchy, GPS, acreage, bush count සහ approval status බලයි. Supplier submissions approve/reject කර audit history තබයි. එහි tabs මගින් Collector Routes assign කිරීම, tea Price Management සහ supplier Finance summary එකත් පාලනය කරයි.

#### Crop Management

Crop/field production records, planting and crop-related operational information පාලනය කරයි.

### 7.3 Field Operations

#### Labor Management

Worker roster, attendance, leave requests, lifecycle events, daily wages සහ daily labor cost snapshots පාලනය කරයි.

#### Harvest Management

Daily gross/net leaf totals, deductions, grade mix, collection centers සහ weigh-in records පෙන්වයි. Quick capture offline queue එක සමඟ භාවිත කළ හැක.

#### Resource Requisitions

Supplier ඉල්ලීම් සඳහා central inbox එකයි. Pending request එක approve/reject කර reason සහ allocation තබයි. Approved stock request එක inventory issue workflow එකට සම්බන්ධ වේ.

#### Equipment Requests

Operational equipment requests වෙනම ලැයිස්තුවක පාලනය කරයි. Approval සමඟ inventory availability බලයි.

#### Field Tools

Soil tests, disease reports සහ site visits record කර history බලයි.

### 7.4 Manufacturing සහ Inputs

#### Inventory

Stock items, batch/lot, expiry, supplier source, Purchase Orders, GRN, stock issues සහ movement history පාලනය කරයි. Fertilizer/chemical/equipment overview modules මෙහි stock data කියවයි.

#### Fertilizer

Fertilizer stock levels, low-stock warnings, division issues සහ block-level supplier fertilizer history පෙන්වයි.

#### Agrochemical

Agrochemical stock levels සහ low-stock status පෙන්වයි.

#### Equipment

Equipment stock levels සහ availability පෙන්වයි.

### 7.5 People & Pay

#### Worker Payments

Payroll runs, payslips, gross/net pay සහ statutory contribution fields පෙන්වයි/සකස් කරයි.

#### Worker Advances

Workersට දෙන advances සහ repayments පාලනය කරයි.

#### Worker Welfare

Welfare cases, housing units, repair needs සහ family details පාලනය කරයි.

### 7.6 Intelligence

#### Weather & Environment

Selected estate GPS අනුව current weather, forecast, rainfall trend සහ deterministic farm alerts පෙන්වයි.

#### Estate Intelligence

Yield projections, resource shortage, pruning impact සහ rule-based intelligence පෙන්වයි. External LLM panel එක connected නොමැති විට එය data source එකක් ලෙස සැලකිය නොහැක.

#### Supplier Insights

Supplier estates, acreage, bush count, expected yield සහ fertilizer credit balances එකතු කර management view එකක් දෙයි.

#### Estate Compliance

Certification status, audit checklist, compliance documents සහ audit history පාලනය කරයි.

### 7.7 Administration

#### User Management

Users create/edit/suspend/deactivate කරයි. Supplier number, factory, multiple routes සහ linked estate save කරයි. Self-registered suppliers approve/reject කරයි. Audit Log tab එකෙන් admin actions බලයි.

#### Operations & Pending

එකම operational inbox එකකි:

- Pending user registrations
- Pending estates
- Pending tea price changes
- Pending resource requests
- Month-end confirmations
- Weight disputes, support, profile සහ route-change requests
- Duplicate phone/email/supplier identities
- Firebase export ↔ Supabase profile mismatch check
- Sync/notification/error health events
- Device sessions සහ forced logout
- Daily collection reconciliation
- Monthly factory CSV/PDF reports
- Month-end lock/reopen

#### Announcements

Supplier portal සඳහා announcements/articles create, edit, publish සහ remove කරයි.

#### Branding & Settings — Super Admin only

Company/app logo, company name, tagline, supplier portal logo/names, login logo/background, login titles සහ accent color database එකේ save කරයි. PWA/browser content branding live update විය හැක. Installed native APK icon/name වෙනස් කිරීමට native rebuild/install එකක් අවශ්‍ය වේ.

### 7.8 More / Future

#### GPS & GIS Mapping

Estate/field geographic view සහ selected parcel telemetry පෙන්වයි.

#### Vehicle & Fuel

Fleet, status, service needs, fuel logs සහ monthly fuel cost පාලනය කරයි.

#### Factory Integration

Factory batches, processing stages, green-leaf intake, recovery, completed batches, expected supplier intake සහ related sales data පාලනය කරයි.

#### Mobile & Offline

Service Worker, installable PWA, offline cache සහ sync queue status පිළිබඳ operational view එකකි.

#### Architecture & Docs

Project structure, backend connection, local setup, deployment සහ mobile build technical reference පෙන්වයි. Day-to-day user instructions සඳහා මෙම `HOW_THINGS_WORK.md` ලේඛනය භාවිත කරන්න.

---

## 8. ප්‍රධාන end-to-end data flows

### 8.1 User → Estate → Weather

`User profile` → `linked/owned estate` → `estate GPS` → `OpenWeather forecast` → `Home + My Weather + farm alerts`

GPS coordinates නැත්නම් app එක live estate weather කියා ව්‍යාජව claim නොකර missing/demo/unavailable status පෙන්විය යුතුය.

### 8.2 Admin route assignment → Collector → Supplier lorry map

`Admin assigns collector + route + date` → `Collector starts collection` → `GPS broadcast on route channel` → `Supplier on same route receives marker` → `Client calculates distance/ETA`

මෙම live location stream එක database storage භාවිත නොකරයි.

### 8.3 Collector weigh-in → Supplier receipt → Finance

`Supplier + estate + grade + gross + deduction` → `net kg` → `harvest record + receipt number` → `supplier delivery history` → `monthly financial summary` → `month-end confirmation`

### 8.4 Supplier request → Admin approval → Inventory

`Supplier requests item` → `Resource Requisitions inbox` → `Admin checks availability` → `approve/reject` → `stock issue/ledger update` → `supplier sees status/alert`

### 8.5 Farm activity → Advice

`Supplier logs fertilizing/pruning/plucking/replanting` → `activity history` → `calendar/tips/weather rules` → `next-action advisory`

### 8.6 Profile/support/dispute → Pending inbox

`Supplier submits request` → `workflow request` → `Operations & Pending` → `Admin approve/reject/resolve with response` → `Supplier sees resolution`

---

## 9. Status වචන තේරුම් ගැනීම

| Status | සරල අර්ථය |
|---|---|
| `pending_approval` | Account එක Admin තීරණය බලා සිටී. |
| `active` | Account එක භාවිත කළ හැක. |
| `suspended` | තාවකාලිකව access නවතා ඇත. |
| `rejected` | Registration එක අනුමත නොවීය. |
| `pending` | Request/estate/price එක තවම review කර නැත. |
| `approved` | අනුමත කර ඇත. ඊළඟ operational step එක අවශ්‍ය විය හැක. |
| `rejected` | Reason එකක් සමඟ අනුමත නොවීය. |
| `resolved` | Support/dispute වැඩේ තීරණයකින් අවසන් කර ඇත. |
| `assigned` | Collectorට route එක දී ඇත. |
| `started` | Collection එක ක්‍රියාත්මකයි. |
| `completed` | වැඩේ අවසන්. |
| `cancelled` | වැඩේ අවලංගුයි. |
| `saved locally` / `queued` | Internet නැති නිසා device එකේ තාවකාලිකව තබා ඇත. |
| `synced` | Server database එකට සාර්ථකව ගොස් ඇත. |
| `failed` | Sync උත්සාහය අසාර්ථකයි; data recovery සඳහා queue එකේ තබා ඇත. |

---

## 10. Online, offline සහ sync

App එක online විට records Supabase වෙත save වේ. Connection නැති විට offline-capable records local queue එකේ තබා පසුව sync කරයි.

Userට පෙනෙන අර්ථ:

- **Online / Synced** — server සමඟ සම්බන්ධයි.
- **Saved locally** — data නැතිවී නැහැ; device එකේ queue වී ඇත.
- **Failed** — retry අවශ්‍යයි; error details Help & Support/Offline details තුළ බලන්න.

Service Worker static app files cache කරයි. Authenticated Supabase REST responses shared cache එකකට දමන්නේ නැත.

Offline data තිබියදී app storage/cache manually clear කිරීමෙන් queued records නැතිවිය හැක. Sync වීමට පෙර app data clear නොකරන්න.

---

## 11. Current technical condition

මෙම කොටස developer සහ quality reviewer සඳහාය.

- Frontend: React + Vite + TypeScript PWA.
- Hosting: GitHub `main` update වූ විට Vercel deployment ක්‍රියාත්මක වේ.
- Authentication: Firebase Email/Password only.
- Business database: Supabase PostgreSQL.
- Supabase plan: Free.
- Supabase client: anon key only; Firebase JWT bridge/Third-Party Auth භාවිත නොවේ.
- Current authorization model: client-side `RouteGuard` + centralized RBAC.
- Public operational tables සඳහා JWT-dependent `auth.uid()` RLS policies භාවිත නොකෙරේ; production setup එක RLS-disabled/client-RBAC architecture එකට අනුකූල විය යුතුය.
- Weather: OpenWeather key configure කර ඇති විට estate GPS අනුව live data.
- Realtime lorry: Supabase Realtime Broadcast; location database rows නොලියයි.
- Proximity advice: deployed `openrouter-advisory` Edge Function තිබේ නම් server-side AI; නැත්නම් safe local fallback.
- Branding: Supabase settings data; `.env` වෙනස් කිරීම අවශ්‍ය නැත.
- iPhone/Android Home Screen app: PWA manifest/icon cache වීම නිසා icon change එකට remove/re-add හෝ cache refresh අවශ්‍ය විය හැක.
- Native Android APK icon/name: installed binary එකේ resource නිසා Admin branding save කිරීමෙන් native launcher icon/name මාරු නොවේ; APK rebuild අවශ්‍යය.

---

## 12. Setup නොමැති විට feature එකේ හැසිරීම

| අවශ්‍ය දේ නොමැති නම් | App එකේ ප්‍රතිඵලය |
|---|---|
| Estate GPS නැත | Live estate weather, distance සහ ETA නිවැරදිව ගණනය කළ නොහැක. |
| Collector assignment නැත | Collectorට අද route එක නොපෙනේ; supplierට live lorry route නැත. |
| Collector tracking start කර නැත | Supplier map එක latest broadcast එක බලා සිටී. |
| OpenWeather key/response නැත | Live status නොපෙන්වා unavailable/demo/fallback message පෙන්වයි. |
| OpenRouter Edge Function/secret නැත | Safe local proximity advice භාවිත වේ. |
| Required SQL migration apply කර නැත | Schema warning හෝ missing-column/table error පෙන්විය හැක. |
| Supplierට linked/owned estate නැත | Estate-dependent weather, farm සහ delivery filtering සම්පූර්ණ නොවේ. |
| Internet නැත | Supported writes local queue වේ; server-only lists අලුත් නොවිය හැක. |

---

## 13. දෛනික checklist

### Admin — උදේ

1. Operations & Pending විවෘත කරන්න.
2. Pending registrations/estates/requests බලන්න.
3. Collectorsට අද routes assign කර තිබේද බලන්න.
4. Weather warnings සහ low-stock warnings බලන්න.
5. Duplicate identities හෝ open health errors තිබේද බලන්න.

### Collector — route එකට යාමට පෙර

1. Today’s Route නිවැරදිද බලන්න.
2. Lorry plate සහ ordered stop list බලන්න.
3. GPS, camera සහ Bluetooth permissions පරීක්ෂා කරන්න.
4. Battery සහ data connection ප්‍රමාණවත්ද බලන්න.
5. Start Collection ඔබන්න.

### Collector — එක් supplier කෙනෙකුගෙන් දලු ගන්නා විට

1. Supplier number/QR confirm කරන්න.
2. Exact estate/collection point තෝරන්න.
3. Weight සහ grade නිවැරදිව දමන්න.
4. Evidence/confirmation එකතු කරන්න.
5. Receipt save වූ බව හෝ Saved locally status එක බලන්න.

### Supplier — දිනපතා

1. Home weather සහ lorry status බලන්න.
2. New delivery receipt/alert තිබේද බලන්න.
3. Farm work සිදු කළ පසු My Farm Activities තුළ record කරන්න.
4. Request එකක් තිබේ නම් status බලන්න.
5. Sync indicator එක Failed නම් Help & Support details බලන්න.

### Admin — දවස අවසානයේ

1. Daily collection reconciliation බලන්න.
2. Collector completed/missed stops බලන්න.
3. Offline/failed records තිබේද පරීක්ෂා කරන්න.
4. Stock issues සහ requests එකට ගැළපෙනවාද බලන්න.
5. වැරදි records delete නොකර audit/void workflow භාවිත කරන්න.

---

## 14. සාමාන්‍ය ගැටලු සහ විසඳුම්

### “No linked estate” පෙන්වයි

Admin → User Management → supplier Edit → Link to Estate තෝරා Save කරන්න. Save පසු directory row එකේ estate name පෙන්වනවාද බලන්න. Supplier නැවත login/refresh කළ විට weather සහ estate data එම link එකෙන් load වේ.

### Supplier weather වැරදියි

Linked/selected estate එක, latitude/longitude සහ OpenWeather configuration පරීක්ෂා කරන්න. App එකේ badge එක `Live` ද `demo/missing` ද බලන්න.

### Database schema update required

Frontend version එකට අවශ්‍ය migration තවම Supabase project එකට apply වී නැති හෝ schema-check function නොපෙනෙන බවයි. `docs/MIGRATION_CHECKLIST.md` අනුව pending migration පමණක් apply කරන්න. Production data backup එකක් නොගෙන destructive SQL run නොකරන්න.

### APK/PWA එකේ පරණ UI පෙන්වයි

Vercel deployment complete ද බලන්න. Browser refresh කරන්න. Installed PWA නම් service worker/cache update සඳහා app එක සම්පූර්ණයෙන් වසා නැවත විවෘත කරන්න. අවශ්‍ය නම් Home Screen app remove කර නැවත add කරන්න. Unsynced local records තිබේ නම් app data clear නොකරන්න.

### Collectorට suppliers නොපෙනේ

Collectorට අද assignment එකක්ද, route එක authorized ද, supplier එම route එකට assign කර තිබේද සහ supplier active ද බලන්න.

### Save button වැඩ නොකරයි

Required fields, displayed red error, network/sync badge සහ database schema status බලන්න. Error message එක සඟවා success කියා නොසලකන්න.

---

## 15. System reviewer සඳහා acceptance path

Quality review එකේ අවම end-to-end test එක:

1. Admin login.
2. Test supplier සහ collector active බව බලන්න.
3. Supplierට factory, two routes සහ linked approved estate assign කරන්න.
4. Collectorට අද primary route assign කරන්න.
5. Supplier login කර estate, weather සහ route code නිවැරදිද බලන්න.
6. Collector login කර route start කරන්න.
7. Supplier/estate තෝරා test weigh-in save කරන්න.
8. Supplier My Leaf Deliveries තුළ receipt, kg සහ grade බලන්න.
9. Supplier resource request එකක් යවන්න.
10. Admin pending inbox එකෙන් request එක බලන්න.
11. Offline test record එකක් queue කර online වූ පසු එක වරක් පමණක් sync වෙනවාද බලන්න.
12. Audit/reconciliation/report screens වල test activity පෙනෙනවාද බලන්න.

---

## 16. Office API එකෙන් දලු, balance සහ ලොරි ස්ථානය ලැබෙන ආකාරය

Office API mapping එක Admin විසින් සකස් කළ supplier කෙනෙකු login වූ විට, app එක ඔහුගේ/ඇයගේ factory code, route code සහ දැනටමත් තිබෙන Supplier No භාවිත කර office system එකෙන් current leaf, monthly leaf, balance සහ lorry location ලබාගනී.

### 16.1 Big Picture — මුළු පද්ධතිය එකවර තේරුම් ගැනීම

Office එකෙන් ලබාදුන් APIs හතර EMS database එකක් නොවේ. ඒවා Factory Office system එකේ තිබෙන read-only data ලබාදෙන HTTP endpoints හතරකි. Supplierගේ browser/iPhone/Android app එක එම HTTP server එකට direct call නොකරයි. සියලු calls Vercel server-side proxy එක හරහා යයි.

```text
Supplier Web/PWA/Android wrapper
  -> HTTPS request to our Vercel endpoint (/api/crop, /api/balance, ...)
  -> Vercel verifies the Firebase login token
  -> Vercel reads the supplier/factory/route mapping from Supabase
  -> Vercel adds the server-only Office API secret
  -> read-only HTTP request to the Factory Office API
  -> response validation + normalization + cache
  -> safe JSON response to the Supplier interface
```

මෙම flow එකෙන් Supplierගේ browser එකට Office secret එක හෝ full upstream URL එක ලැබෙන්නේ නැත. Factory Office system එකේ data වෙනස් කරන `POST`, `PUT`, `PATCH` හෝ `DELETE` request කිසිවක් EMS එකෙන් යවන්නේ නැත.

### 16.2 Office APIs හතර සහ EMS endpoints

| Office endpoint filename | Vercel endpoint | භාවිතය / Purpose |
|---|---|---|
| `get_current_crop_balance.php` | `/api/crop` | Current crop records, monthly quantity සහ delivery count ලබාගැනීම |
| `get_current_balance.php` | `/api/balance` | Account quantity, gross pay, deductions, balance සහ previous-month `lm` summary ලබාගැනීම |
| `get_monthly_details.php` | `/api/monthly` | දින අනුව monthly leaf details සහ yesterday record ලබාගැනීම |
| `get_lorry_deatails.php` | `/api/lorry` | Assigned route එකේ latest Office GPS snapshot ලබාගැනීම |

Office එකෙන් ලබාදුන් full URLs හතරෙම එකම පොදු URL prefix එක සහ `secret` query parameter එක තිබුණි. Code එක ඒවා මෙහෙම වෙන් කර භාවිත කරයි:

```text
FACTORY_API_BASE_URL  = common URL portion before the endpoint filename
FACTORY_API_SECRET    = value between "secret=" and "&factoryCode="
```

Actual values Vercel **Environment Variables** තුළ පමණක් තැබිය යුතුය. API secret එක, service-role key එක හෝ වෙනත් credential එක GitHub source files, screenshots හෝ මෙම documentation එකට ලියන්නේ නැත.

### 16.3 Project එකේ API code තිබෙන exact files

#### Vercel route entry files

- `api/crop.ts` — `/api/crop` route එක `crop` handler එකට සම්බන්ධ කරයි.
- `api/balance.ts` — `/api/balance` route එක `balance` handler එකට සම්බන්ධ කරයි.
- `api/monthly.ts` — `/api/monthly` route එක `monthly` handler එකට සම්බන්ධ කරයි.
- `api/lorry.ts` — `/api/lorry` route එක `lorry` handler එකට සම්බන්ධ කරයි.
- `api/health.ts` — Vercel Node function runtime එක load වෙනවාද පරීක්ෂා කරන lightweight health endpoint එකයි; Factory data ඉල්ලන්නේ නැත.

මෙම files තුළ Office URL හෝ secret hard-code කර නැත. ඒවා `createVercelHandler(...)` call එකෙන් shared server logic එකට route type එක පමණක් ලබාදෙයි.

#### Server-side security, mapping සහ Office fetch

- `server/vercelAdapter.ts` — Vercel `IncomingMessage/ServerResponse` request එක Web `Request/Response` format එකට adapt කරයි.
- `server/factoryProxy.ts` — ප්‍රධාන server logic එකයි. Firebase token verify කිරීම, Supabase mapping read කිරීම, Admin GPS switch check කිරීම, Environment Variables read කිරීම, Office URL assemble කිරීම, timeout, caching, backoff සහ safe error response මෙහි සිදු වේ.

#### Frontend API client සහ response parser

- `src/lib/officeApi.ts` — Supplier browser එකෙන් අපේ `/api/*` endpoints call කරයි. Firebase ID token එක Authorization header එකට දමයි. Per-user client cache, last-known cache සහ manual refresh cooldown මෙහි පාලනය වේ.
- `src/lib/officeApiContracts.ts` — Office response formats validate සහ normalize කරයි. Leaf/balance JSON fields canonical objects වලට මාරු කරයි. Lorry HTML/JSON `x/y`, `lat/lng`, `latitude/longitude` formats parse කර Sri Lanka geographic bounds පරීක්ෂා කරයි.
- `src/lib/officeSupplierSummary.ts` — yesterday crop, crop comparison සහ deduction groups වැනි Supplier-facing summaries ගණනය කරයි.
- `src/lib/officeMapping.ts` — Admin UI එකෙන් factory/route Office codes read සහ save කරන Supabase helpers අඩංගු වේ.

#### Admin mapping සහ operational control UI

- `src/modules/FactoryApiMapping.tsx` — Factories සහ routes සඳහා Office codes enter/save කරන Admin interface එකයි.
- `src/modules/EstateMaster.tsx` — Office API mapping section එක Admin navigation තුළ සම්බන්ධ කරයි.
- `src/modules/Settings.tsx` — Super Adminගේ **Office Lorry GPS API ON/OFF** emergency control එක පෙන්වයි.
- `src/lib/branding.tsx` — එම operational switch එක existing Supabase `settings` JSON record එකේ save කරයි. Default value එක `OFF`ය.

#### Supplier data display files

- `src/modules/SupplierHome.tsx` — Crop, Balance සහ Monthly APIs එකවර load කර monthly kg, delivery count, income, deductions සහ quick summaries පෙන්වයි.
- `src/modules/SupplierDeliveries.tsx` — Monthly deliveries, Normal/Super grade breakdown සහ statement data පෙන්වයි.
- `src/modules/SupplierPortal.tsx` — Current/previous month payment statement, deductions සහ PDF download flow පෙන්වයි.
- `src/modules/LorryTracking.tsx` — Route name සහ on-demand lorry map පෙන්වයි. Automatic Office GPS polling මෙහි නැත.

#### Mapping SQL/reference file

- `docs/migration_phase3_round17_office_route_codes.sql` — Official factory/route code mappings database එකට apply කරන migration/reference script එකයි. Secret හෝ full Office API URL මෙහි නැත.

### 16.4 Supplier සහ Office codes එකිනෙකට ගැළපෙන ආකාරය

Supplier login email/password එක API supplier number එක නොවේ. Firebase login එකෙන් user UID එක හඳුනාගත් පසු Vercel proxy එක Supabase records කියවයි:

```text
users.id                 -> Firebase UID
users.supplier_no        -> Office Supplier/Card Number
users.factory_id         -> assigned EMS factory
users.route_id           -> primary assigned EMS route
factories.office_factory_code -> Office factory code
routes.office_route_code       -> Office route code
```

Supplierට routes කිහිපයක් authorized නම් `user_route_assignments` record එකද පරීක්ෂා කරයි. Supplierට assign කර නැති route ID එකක් browser request එකේ වෙනස් කර යැව්වත් server proxy එක `ROUTE_ACCESS_DENIED` ලෙස නවත්වයි.

### 16.5 Authentication සහ Free-plan architecture

1. Firebase Email/Password login Supplier identity එක ලබාදෙයි.
2. Frontend `src/lib/officeApi.ts` Firebase ID token එක ලබාගෙන Vercel `/api/*` endpoint එකට යවයි.
3. `server/factoryProxy.ts` Firebase Identity Toolkit මගින් token එක verify කර UID එක ලබාගනී.
4. Vercel server-side `SUPABASE_SERVICE_ROLE_KEY` භාවිත කර එම UID එකට අදාළ mapping records පමණක් කියවයි.
5. Browser එකට service-role key හෝ Office secret එක කිසිවිටක ලබා නොදෙයි.

මෙය Firebase → Supabase Third-Party Auth/JWT bridge එකක් නොවේ. Supabase Free plan එකට අනුකූල current architecture එකම භාවිත කරයි. Frontend `src/lib/supabase.ts` Firebase token එක Supabase Authorization header එකට inject නොකරයි.

### 16.6 Supplier Home එක open වූ විට data flow එක

1. Supplier login වී Home interface එක open කරයි.
2. `SupplierHome.tsx` Crop, Balance සහ Monthly endpoints තුන එකවර request කරයි.
3. `officeApi.ts` valid unexpired client cache එකක් තිබේ නම් Vercel/Office request නොයවා එය භාවිත කරයි.
4. Cache expired නම් Firebase token සහිත HTTPS request එක Vercel වෙත යයි.
5. Vercel token verify කර Supplier No, factory code සහ route code resolve කරයි.
6. Vercel Environment Variables වල Base URL සහ Secret එක request execution memory තුළ පමණක් එකතු කර Office endpoint එකට read-only GET එකක් යවයි.
7. Office response එක `officeApiContracts.ts` මගින් validate/normalize කරයි.
8. Valid response එක server cache සහ supplier-specific browser cache එකට තාවකාලිකව තබයි.
9. Supplier UI එක data source සහ last-updated time සමඟ values පෙන්වයි.

Home interface එක open තබාගෙන සිටීමෙන් Crop, Balance හෝ Monthly requests නැවත නැවත යන්නේ නැත. Current cache windows:

- Crop: විනාඩි 5 / 5 minutes
- Balance: විනාඩි 10 / 10 minutes
- Monthly details: විනාඩි 15 / 15 minutes
- Manual Office Data refresh cooldown: විනාඩි 5 / 5 minutes

### 16.7 Lorry GPS request flow එක

1. Supplier Home එකේ route/status card එක පමණක් load වේ; Office GPS request එකක් නොයයි.
2. Supplier **ලොරියේ ස්ථානය බලන්න / View lorry location** press කරයි.
3. `/api/lorry` server handler එක මුලින් Super Admin operational switch එක පරීක්ෂා කරයි.
4. Switch එක `OFF` නම් HTTP `423` safe response එකක් ලබාදී Office server එකට request `0`ක් යවයි.
5. Switch එක `ON` නම් assigned route validate කර Office GPS endpoint එකට snapshot request එකක් පමණක් යවයි.
6. Snapshot එක map marker, estate marker, distance සහ ETA සමඟ පෙන්වයි.
7. Map එක open තබාගෙන සිටියත් automatic polling සිදු නොවේ.
8. Manual refresh cooldown එක තත්පර 60කි.
9. Page hide, app background, map close, module change හෝ logout විට pending request සහ fallback WebSocket subscription abort වේ.

Success GPS snapshot එක තත්පර 60ක් cache වේ. `Location unavailable` response එක විනාඩි 5ක් cache වේ. Timeout/network/upstream errors සඳහා විනාඩි 2–5ක backoff එකක් ඇත. එකම warm Vercel function instance එකට එකවර එන same-route requests එක in-flight request එක share කරයි.

### 16.8 Vercel Environment Variables නොමැති විට

`FACTORY_API_BASE_URL` හෝ `FACTORY_API_SECRET` නොමැති deployment එකක Vercel proxy එක `503 Server configuration is missing...` response එකක් ලබාදෙයි. එම අවස්ථාවේ request එක Factory Office server එකට යන්නේ නැත. Supplier UI එක `Office data is temporarily unavailable` ලෙස පෙන්වයි.

Environment Variable එක Vercel Settings තුළ add/change/delete කළ පමණින් දැනට active deployment එක වෙනස් නොවේ. Latest source code එකෙන් Production **Redeploy** කළ පසු පමණක් අලුත් variables deployment එකට ලැබේ.

### 16.9 Error, cache සහ fallback behavior

- Authentication/access/mapping error එකකදී වෙන supplier කෙනෙකුගේ cached financial data කිසිවිටක පෙන්වන්නේ නැත.
- Temporary network/server error එකකදී එම supplierගේ last successful cache එක තිබේ නම් source warning සහ updated time සමඟ පෙන්වයි.
- Raw Office payload, API secret, exact upstream URL හෝ service-role key browser console/UI එකට පෙන්වන්නේ නැත.
- Service Worker එක Office API GET requests queue, replay හෝ background-sync කරන්නේ නැත.
- Office GPS snapshot එක නොලැබුණොත් user map එක විවෘත කර ඇති විට පමණක් assigned route Supabase Realtime Broadcast fallback එක බලා සිටිය හැක. එය location database row ලියන්නේ නැත.

### 16.10 Production enable/test checklist

1. GitHub `main` හි latest request-control commit Vercel Production deployment එකේ `Ready` බව බලන්න.
2. `FACTORY_API_BASE_URL` සහ `FACTORY_API_SECRET` server-only Production variables ලෙස Vercel තුළ තිබේද බලන්න. `VITE_` prefix දාන්න එපා.
3. Redeploy කරන්න.
4. Super Admin → Branding & Settings → Office Lorry GPS API `OFF` බව තහවුරු කරන්න.
5. Supplier Home එක open කර Crop/Balance/Monthly requests එකවර පමණක් යනවාද Network/Office logs වලින් බලන්න.
6. Office IT සමඟ test window එකක් තීරණය කර GPS switch එක `ON` කරන්න.
7. එක් Supplier account එකකින් **View lorry location** එකවරක් press කරන්න.
8. Office log එකේ lorry endpoint request එකක් පමණක් ලැබුණාද confirm කරන්න.
9. Test අවසානයේ switch එක නැවත `OFF` කරන්න.

### 16.11 Current Supplier UI summary

- Admin → Estate Master → **Office API** තුළ factory සහ route codes save කරයි.
- Supplier register/edit කරන විට **Supplier No / Office Card ID** එකම field එකට office number එක save කරයි. වෙනම Office Supplier ID field එකක් අවශ්‍ය නැහැ.
- Supplier Home එකේ monthly kg, delivery count, earnings සහ deductions office system එකෙන් පෙන්වයි.
- My Deliveries තුළ Normal Leaf/Super Leaf දින අනුව පෙන්වයි.
- Payments තුළ office system එකේ gross pay, deductions සහ current balance පෙන්වයි.
- Supplier Home එකේ ලොරි card එක ස්වයංක්‍රීය Office GPS request යවන්නේ නැත. Supplier **ලොරියේ ස්ථානය බලන්න** button එක press කළ විට පමණක් තමන්ට පවරා ඇති route එකේ GPS snapshot එක එක වරක් ඉල්ලයි. Supplier වෙනත් route එකක location එක ඉල්ලිය නොහැක.

Office mapping තවම දාලා නැත්නම් හෝ office server එක තාවකාලිකව unavailable නම්, app එක බිඳෙන්නේ නැහැ. Supplier financial/leaf screens existing EMS records පෙන්වයි; map එක existing EMS live broadcast එකට fallback වෙයි. Screen එකේ **Factory office system** හෝ **EMS records** යන source label එකෙන් භාවිත වන දත්ත මූලාශ්‍රය හඳුනාගත හැක.

### 16.12 Office දලු අගයන් දෙක පෙන්වන්නේ ඇයි?

Supplier Home එකේ office API එකෙන් වෙන වෙනම ලැබෙන අගයන් දෙකක් තිබේ:

- **Current crop recorded** — current crop API වාර්තාවේ දැනට ඇති දලු එකතුව.
- **Quantity reflected in account statement** — balance API එකේ account statement තුළ දැක්වෙන දලු ප්‍රමාණය.

මෙම API දෙකේ නිල business meaning එක office documentation එකෙන් තවම නිශ්චිතව දී නැති නිසා app එක එකක් “Pending” සහ අනෙක “Confirmed” ලෙස හඳුන්වන්නේ නැහැ. යාවත්කාලීන වන වේලාව වෙනස් වීමෙන් අගයන් දෙක අතර තාවකාලික වෙනසක් තිබිය හැක. App එක එම වෙනස සැඟවීමකින් තොරව පෙන්වයි.

### 16.13 API එක තාවකාලිකව ක්‍රියා නොකළොත්

අවසන් වරට සාර්ථකව ලැබුණු office record එක එම supplier account එකට පමණක් පැය 24ක් දක්වා තාවකාලිකව සුරැකේ. API/server failure එකක් ඇති විට `0 kg` හෝ `Rs 0` ලෙස වැරදි අගයක් පෙන්වීම වෙනුවට එම අවසන් record එක සහ **Last updated** වේලාව පෙන්වයි. Cached record එකක් බව warning එකකින් පැහැදිලි කරයි. Login/access/mapping error එකක් ඇති විට පැරණි financial data පෙන්වන්නේ නැහැ.

**Refresh Office Data** බොත්තමෙන් නව office record එකක් ඉල්ලිය හැක. Office server එකට අනවශ්‍ය requests යැවීම වැළැක්වීමට නැවත refresh කිරීමට විනාඩි 5ක් බලා සිටිය යුතුය. Crop data විනාඩි 5ක්, balance data විනාඩි 10ක් සහ monthly details විනාඩි 15ක් client/server cache භාවිත කරයි. Supplier Home එක open තබාගැනීමෙන් මේ APIs නැවත නැවත call නොවේ.

### 16.14 ඊයේ දලු සහ අඩුකිරීම්

- **Yesterday's crop** monthly details API එකේ ඊයේ දිනයට ගැළපෙන record එකෙන් ගනී. Record එකක් නැත්නම් ඒ බව පැහැදිලිව පෙන්වයි.
- **Cash advances** සහ **Fertilizer deductions** balance API එකේ වත්මන් මාසයේ fields එකතු කර සාරාංශයක් ලෙස පෙන්වයි.
- Payments screen එකේ fertilizer, ATM/POS/route/office advances, loan, transport, tea සහ වෙනත් සෑම non-zero deduction එකක්ම වෙන වෙනම පෙන්වයි.
- Supplier Home එකේ **මුළු අඩුකිරීම්** card එක Office API `totalDeduction` අගයම පෙන්වයි. එය labour/fertilizer වතු වියදමක් නොව advances, fertilizer, loans, transport, previous debt සහ වෙනත් office deductions එකතුවකි.
- Current account balance එක office API එකෙන් ලැබුණු අගයමයි; app එක එය නැවත ගණනය කර official confirmation එකක් ලෙස නම් නොකරයි.

### 16.15 පෙර මාසයේ ගිණුම් ප්‍රකාශය

Payments screen එකේ **Previous Month Statement** කොටස `get_current_balance.php` response එකේ `lm` object එකෙන්ම load වේ. මෙහි පෙර මාසයේ Normal/Super දලු ප්‍රමාණය, මුළු ආදායම, අඩුකිරීම් සහ Account Balance එක පෙන්වයි. Non-zero deduction fields වෙන වෙනම කියවිය හැක.

**Current vs Previous Month** කොටසෙන් දලු ප්‍රමාණය, මුළු ආදායම, මුළු අඩුකිරීම් සහ ගිණුම් ශේෂය සසඳයි. පෙර අගය `0` නම් වැරදි හෝ අනන්ත percentage එකක් නොපෙන්වා **No previous base** ලෙස පෙන්වයි. ඉහළ/පහළ badge එක වෙනස පමණක් පෙන්වන අතර එය හොඳ හෝ නරක වෙනසක් ලෙස තීරණය නොකරයි.

**Download PDF** මගින් `lm` object එකේ පෙර මාසික summary සහ deduction breakdown එක PDF ගොනුවක් ලෙස ලබාගත හැක. මෙය previous month daily delivery list එකක් නොව account statement summary එකකි. මේ සඳහා Supabase archive table එකක් හෝ database write එකක් භාවිත නොවේ.

### 16.16 Light Mode සහ Dark Mode

Login, Admin, Supplier සහ Collector interfaces වල header එකේ ඉර/සඳ icon button එකෙන් Light Mode සහ Dark Mode අතර මාරු විය හැක. Cards, text, forms, tables, charts, popup සහ map controls සියල්ල selected mode එකට ගැළපෙන readable colors භාවිත කරයි.

App එක fresh open හෝ refresh කරන සෑම අවස්ථාවකදීම Light Mode භාවිත වේ. User කැමති නම් ඉර/සඳ button එකෙන් Dark Mode තෝරාගත හැකි අතර app session එක විවෘතව තිබෙන තුරු එය සියලු screens සඳහා පවතී. App එක නැවත open/refresh කළ විට නැවත Light Mode වෙයි. Phone එකේ system appearance එක Dark වුවත් හෝ කලින් Dark Mode තෝරා තිබුණත් startup එකේ app එක Dark Mode නොවේ. මෙය UI preference එකක් පමණි; user records, office API data හෝ Supabase database එක වෙනස් නොකරයි.

### 16.17 Admin header එක device අනුව පෙනෙන ආකාරය

Phone සහ පටු tablet screens වල Admin header එකේ module name එක එක පේළියක පෙන්වන අතර Sync සහ Language controls icon ලෙස compact වේ. Screen එක පුළුල් වන විට ඒවායේ full labels නැවත පෙන්වයි. මෙය layout වෙනසක් පමණි; mobile සහ desktop දෙකම එකම account, module, sync state සහ live data භාවිත කරයි.

Estate Dashboard එකේ weather-based alerts/recommendations දිගටම live estate weather භාවිත කරයි. Dashboard title එක අසල පළමු estate නම organization-wide weather එකක් ලෙස පෙන්වූ duplicate desktop card එක ඉවත් කර ඇත.

### 16.18 Office GPS response එක නොලැබුණොත්

Supplierගේ ලොරි map එක මුලින් compact card එකක් ලෙස පෙන්වයි. Supplier **ලොරියේ ස්ථානය බලන්න** press කළ පසු පමණක් Office GPS snapshot එකක් ඉල්ලයි. Map එක open තබාගෙන සිටියත් automatic polling සිදු නොවේ. Manual refresh එකකට පසු නැවත refresh කිරීමට තත්පර 60ක් බලා සිටිය යුතුය.

Super Admin → Branding & Settings තුළ **Office Lorry GPS API** ON/OFF control එක තිබේ. Default එක OFFය. OFF විට Vercel server proxy එකෙන්ම request එක නවතා Office server එකට කිසිවක් යවන්නේ නැත. ON කළත් user button එක press කළ විට පමණක් snapshot එකක් යවයි. Control එක වෙනස් කළ user සහ වේලාව එම settings record එකේ පෙන්වයි.

Office GPS API එකෙන් පැරණි HTML `x/y` format එක හෝ JSON/latitude/longitude වැනි නව format එකක් ලැබුණත් ඒවා Sri Lanka GPS සීමාව තුළදැයි පරීක්ෂා කර පෙන්වයි. Office system එකේ අදාළ route එකට live location එකක් නොමැති නම් එම failure එක විනාඩි 5ක් cache කර repeated requests නවත්වයි. Timeout/network failures සඳහාද retry delay එකක් ඇත. Last successful location එක තිබේ නම් එහි updated time එක පෙන්වයි; නැත්නම් user-friendly unavailable message එක පෙන්වයි. Technical credentials හෝ raw error payload Supplierට පෙන්වන්නේ නැත.

Office API snapshot එක fail වූ විට user විසින් map එක විවෘත කර තිබේ නම් පමණක් existing route-scoped live Broadcast channel එකෙන් GPS update එකක් බලා සිටිය හැක. Map එක close/background කළ විට pending request සහ Broadcast subscription නවතී. මෙම fallback එකෙන් Factory API හෝ database එකට කිසිදු location data write එකක් සිදු නොවේ.

### 16.19 Future maintenance rule for this integration

Office endpoint, response field, route mapping, request interval, cache duration හෝ Supplier UI meaning එකක් වෙනස් කරන සෑම update එකකදීම අවම වශයෙන් පහත files පරීක්ෂා/update කළ යුතුය:

- `server/factoryProxy.ts`
- `src/lib/officeApi.ts`
- `src/lib/officeApiContracts.ts`
- අදාළ `src/modules/Supplier*.tsx` හෝ `src/modules/LorryTracking.tsx`
- `src/lib/__tests__/officeApiContracts.test.ts`
- `src/lib/__tests__/officeRequestControl.test.ts`
- `docs/WORKFLOW_DIAGRAM.md`
- `docs/HOW_THINGS_WORK.md`

Documentation එකේ current production behavior පමණක් ලියන්න. Future plan එක current feature එකක් ලෙස නොලියන්න. API secrets, tokens සහ passwords කිසිවිටක documentation/GitHub වෙත commit නොකරන්න.

## 17. ලේඛන නඩත්තු කිරීමේ නීතිය

App feature එකක් add, remove, rename හෝ flow එකක් වෙනස් කරන සෑම commit එකකදීම:

1. `docs/WORKFLOW_DIAGRAM.md` හි technical/history update එක එකතු කරන්න.
2. User කෙනෙකුගේ වැඩ කරන ක්‍රමය වෙනස් වුණොත් මෙම `docs/HOW_THINGS_WORK.md` එකත් update කරන්න.
3. Future idea එකක් current feature එකක් ලෙස නොලියන්න.
4. Demo/fallback data එක live production data ලෙස නොලියන්න.
5. Internal conversation, පුද්ගල නාම හෝ “කෙනෙක් කියපු විදිහට” වැනි අනුමැති වාක්‍ය documentation එකට දාන්න එපා.
6. API keys, passwords, tokens හෝ private credentials documentation එකට දාන්න එපා.

මෙම ලේඛනය app එකේ current user-facing behavior සඳහා සරල reference එකයි. Migration order සහ deployment commands සඳහා `docs/MIGRATION_CHECKLIST.md`; detailed technical change history සඳහා `docs/WORKFLOW_DIAGRAM.md` භාවිත කරන්න.
