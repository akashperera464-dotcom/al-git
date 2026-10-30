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
- 1.5 kmට අඩු වූ විට AI/safe-fallback advice පෙන්විය හැක.

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

- Admin → Estate Master → **Office API** තුළ factory සහ route codes save කරයි.
- Supplier register/edit කරන විට **Supplier No / Office Card ID** එකම field එකට office number එක save කරයි. වෙනම Office Supplier ID field එකක් අවශ්‍ය නැහැ.
- Supplier Home එකේ monthly kg, delivery count, earnings සහ deductions office system එකෙන් පෙන්වයි.
- My Deliveries තුළ Normal Leaf/Super Leaf දින අනුව පෙන්වයි.
- Payments තුළ office system එකේ gross pay, deductions සහ current balance පෙන්වයි.
- My Lorry Map එක route එකේ office GPS coordinate එක තත්පර 25කට ආසන්න වාරයකින් refresh කරයි. Supplier වෙනත් route එකක location එක ඉල්ලිය නොහැක.

Office mapping තවම දාලා නැත්නම් හෝ office server එක තාවකාලිකව unavailable නම්, app එක බිඳෙන්නේ නැහැ. Supplier financial/leaf screens existing EMS records පෙන්වයි; map එක existing EMS live broadcast එකට fallback වෙයි. Screen එකේ **Factory office system** හෝ **EMS records** යන source label එකෙන් භාවිත වන දත්ත මූලාශ්‍රය හඳුනාගත හැක.

### Office දලු අගයන් දෙක පෙන්වන්නේ ඇයි?

Supplier Home එකේ office API එකෙන් වෙන වෙනම ලැබෙන අගයන් දෙකක් තිබේ:

- **Current crop recorded** — current crop API වාර්තාවේ දැනට ඇති දලු එකතුව.
- **Quantity reflected in account statement** — balance API එකේ account statement තුළ දැක්වෙන දලු ප්‍රමාණය.

මෙම API දෙකේ නිල business meaning එක office documentation එකෙන් තවම නිශ්චිතව දී නැති නිසා app එක එකක් “Pending” සහ අනෙක “Confirmed” ලෙස හඳුන්වන්නේ නැහැ. යාවත්කාලීන වන වේලාව වෙනස් වීමෙන් අගයන් දෙක අතර තාවකාලික වෙනසක් තිබිය හැක. App එක එම වෙනස සැඟවීමකින් තොරව පෙන්වයි.

### API එක තාවකාලිකව ක්‍රියා නොකළොත්

අවසන් වරට සාර්ථකව ලැබුණු office record එක එම supplier account එකට පමණක් පැය 24ක් දක්වා තාවකාලිකව සුරැකේ. API/server failure එකක් ඇති විට `0 kg` හෝ `Rs 0` ලෙස වැරදි අගයක් පෙන්වීම වෙනුවට එම අවසන් record එක සහ **Last updated** වේලාව පෙන්වයි. Cached record එකක් බව warning එකකින් පැහැදිලි කරයි. Login/access/mapping error එකක් ඇති විට පැරණි financial data පෙන්වන්නේ නැහැ.

**Refresh** බොත්තමෙන් නව office record එකක් ඉල්ලිය හැක. Office server එකට අනවශ්‍ය requests යැවීම වැළැක්වීමට නැවත refresh කිරීමට තත්පර 30ක් බලා සිටිය යුතුය.

### ඊයේ දලු සහ අඩුකිරීම්

- **Yesterday's crop** monthly details API එකේ ඊයේ දිනයට ගැළපෙන record එකෙන් ගනී. Record එකක් නැත්නම් ඒ බව පැහැදිලිව පෙන්වයි.
- **Cash advances** සහ **Fertilizer deductions** balance API එකේ වත්මන් මාසයේ fields එකතු කර සාරාංශයක් ලෙස පෙන්වයි.
- Payments screen එකේ fertilizer, ATM/POS/route/office advances, loan, transport, tea සහ වෙනත් සෑම non-zero deduction එකක්ම වෙන වෙනම පෙන්වයි.
- Current account balance එක office API එකෙන් ලැබුණු අගයමයි; app එක එය නැවත ගණනය කර official confirmation එකක් ලෙස නම් නොකරයි.

## 17. ලේඛන නඩත්තු කිරීමේ නීතිය

App feature එකක් add, remove, rename හෝ flow එකක් වෙනස් කරන සෑම commit එකකදීම:

1. `docs/WORKFLOW_DIAGRAM.md` හි technical/history update එක එකතු කරන්න.
2. User කෙනෙකුගේ වැඩ කරන ක්‍රමය වෙනස් වුණොත් මෙම `docs/HOW_THINGS_WORK.md` එකත් update කරන්න.
3. Future idea එකක් current feature එකක් ලෙස නොලියන්න.
4. Demo/fallback data එක live production data ලෙස නොලියන්න.
5. Internal conversation, පුද්ගල නාම හෝ “කෙනෙක් කියපු විදිහට” වැනි අනුමැති වාක්‍ය documentation එකට දාන්න එපා.
6. API keys, passwords, tokens හෝ private credentials documentation එකට දාන්න එපා.

මෙම ලේඛනය app එකේ current user-facing behavior සඳහා සරල reference එකයි. Migration order සහ deployment commands සඳහා `docs/MIGRATION_CHECKLIST.md`; detailed technical change history සඳහා `docs/WORKFLOW_DIAGRAM.md` භාවිත කරන්න.
