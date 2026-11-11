# How the System Works — KDU Tea Estate Management System

> මෙම ලේඛනය change log එකක්, daily checklist එකක් හෝ development history එකක් නොවේ. මෙහි තිබෙන්නේ **දැනට system එක වැඩ කරන ආකාරය**, එක් feature එකක් තවත් feature එකකට සම්බන්ධ වන ආකාරය සහ data flow එක පමණි.

---

## System එකේ අරමුණ

KDU Tea Estate Management System (EMS) එකෙන් Admin, Supplier සහ Collector අතර තිබෙන ප්‍රධාන වැඩ එකම system එකක සම්බන්ධ කරයි:

- Suppliers, users, factories සහ routes පාලනය කිරීම
- Supplier estates සහ estate blocks ලියාපදිංචි කිරීම
- Collector route assignments සහ දලු එකතු කිරීම
- Delivery receipts, grades, weights සහ financial summaries පෙන්වීම
- Fertilizer, equipment සහ agrochemical requests පාලනය කිරීම
- Estate GPS අනුව weather සහ lorry location පෙන්වීම
- Approvals, alerts, reports, audit information සහ system settings පාලනය කිරීම

System එකේ සාමාන්‍ය operational flow එක මෙන්න:

```text
User account
  -> Factory + authorized route assignment
  -> Supplier estate + GPS registration
  -> Admin approval
  -> Collector daily route assignment
  -> Leaf collection + digital receipt
  -> Supplier delivery/finance view
  -> Admin reconciliation/reporting
```

---

## System එක සෑදී ඇති ප්‍රධාන කොටස්

| කොටස | System එකේ කාර්යය |
|---|---|
| **React + Vite application** | Admin, Supplier සහ Collector interfaces පෙන්වයි. |
| **Firebase Authentication** | Email/password login, logout සහ Firebase UID ලබාදෙයි. |
| **Supabase PostgreSQL** | Users, estates, routes, requests, harvest records, settings සහ අනෙකුත් business data තබයි. |
| **Vercel** | Web/PWA එක host කරයි සහ Office API server-side proxy functions ක්‍රියාත්මක කරයි. |
| **Factory Office APIs** | Supplierගේ office leaf, balance, monthly details සහ route lorry GPS read-only ලෙස ලබාදෙයි. |
| **OpenWeather** | Estate GPS coordinates අනුව current weather සහ forecast ලබාදෙයි. |
| **Supabase Realtime Broadcast** | Collector phone එකෙන් route-specific live GPS stream එක Supplier map එකට යවයි; location database rows නොලියයි. |
| **Service Worker / local device storage** | App shell cache කිරීම සහ supported offline records තාවකාලිකව queue කිරීම සිදු කරයි. |

Firebase authentication සඳහා පමණක් භාවිත වේ. Business data Firestore වෙත migrate නොකරයි; business database එක Supabase වේ.

---

## Login සහ user access වැඩ කරන ආකාරය

Login screen එක mobile-responsive **book page** එකක් ලෙස Supplier Login සහ Staff Login යන පැති දෙක පෙන්වයි. Branding logo/title එක background image හෝ video එක වසා නොදමන transparent header එකක පෙන්වන අතර login book එකට පමණක් liquid-glass surface එක භාවිත වේ. මේ වෙන් කිරීම UI guidance එකක් පමණි; authentication systems දෙකක් නොවේ.

- **Supplier Login** පැත්තෙන් existing supplier account එකට පිවිසිය හැකි අතර නව supplier registration request එකක්ද ඉදිරිපත් කළ හැක.
- **Staff Login** පැත්ත Super Admin, Admin, Collector සහ Extension Officer accounts සඳහා පැහැදිලි පිවිසුම් මුහුණතක් ලබාදෙයි. Staff registration මෙහි නොමැත.
- පැති දෙකම එකම Firebase email/password authentication function එක භාවිත කරයි.
- User තෝරන page එකෙන් role එක තීරණය නොවේ. Firebase login පසු Supabase `users` profile එකේ approved role/status අනුව නිවැරදි interface එක ස්වයංක්‍රීයව විවෘත වේ.
- Reduced-motion setting සක්‍රීය device එකක 3D animation වෙනුවට motion-free page switch එකක් භාවිත වේ.

```text
Supplier Login page OR Staff Login page
  -> same Email + Password authentication
  -> Firebase Authentication
  -> Firebase UID
  -> Supabase users profile lookup
  -> role + status + factory + routes + estate link
  -> correct interface
```

- `super_admin` සහ `admin` users Admin interface එකට යයි.
- `extension_officer` role එක Collector/Extension Officer interface එකට යයි.
- `supplier` role එක Supplier mobile-first interface එකට යයි.
- `pending_approval`, `suspended` හෝ `rejected` account එකකට active account access නොලැබේ.

Current Free-plan architecture එක Firebase → Supabase JWT bridge එකක් භාවිත නොකරයි. Frontend Supabase client එක anon key භාවිත කරයි. Interface access `RouteGuard` සහ centralized RBAC capabilities මගින් පාලනය වේ. Office API access එක වෙනම Vercel server proxy එක Firebase token verify කර පාලනය කරයි.

---

## Core data relationships

System එකේ data වෙන වෙනම screens වල තිබුණත් ඒවා පහත සම්බන්ධතාවයෙන් ක්‍රියා කරයි:

```text
Factory
  -> Routes
      -> Suppliers / Collectors
          -> Estates
              -> Estate Blocks
                  -> Farm Activities

Admin daily route assignment
  -> Collector
      -> Route stops
          -> Supplier + selected estate
              -> Harvest/Delivery record
                  -> Digital receipt
                      -> Supplier delivery history + finance summary
```

### Factory සහ route

- සෑම route එකක්ම factory එකකට අයත් වේ.
- User එකකට factory එකක් සහ authorized routes එකක් හෝ කිහිපයක් assign කළ හැක.
- Multiple routes තිබේ නම් primary route එකක්ද තබයි.
- EMS human-readable route code එක සහ Office system route code එක වෙන වෙනම තිබිය හැක.

### Supplier සහ estate

- Supplier කෙනෙකුට estates කිහිපයක් තිබිය හැක.
- Estate එකකට blocks කිහිපයක් තිබිය හැක.
- Estate record එක supplier, factory, route, acreage, bush count, address සහ GPS coordinates සමඟ සම්බන්ධ වේ.
- Block එකකට land type, operational status සහ optional GPS polygon boundary එකක් තිබිය හැක. Polygon coordinates `estate_blocks.boundary_geojson` තුළ GeoJSON `[longitude, latitude]` order එකෙන් save වේ.
- Block boundary එක map එක මත manually mark කළ හැකි අතර, phone එක රැගෙන boundary එක වටා ඇවිදීමෙන් GPS points auto-record කිරීමටද හැක. මේ දෙකම අවසානයේ එකම `boundary_geojson` field එක භාවිත කරයි.
- Delivery එකක් record කරන විට supplier පමණක් නොව exact estate එකද තෝරන නිසා estates අතර data මිශ්‍ර නොවේ.

### Collector සහ daily assignment

- Collector තමන්ට කැමති route එකක් manually තෝරන්නේ නැත.
- Admin විසින් අද දිනයට assign කළ route එක Collectorට ලැබේ.
- එම route එකේ suppliers පමණක් stop list සහ collection screen වල පෙන්වයි.

---

## User roles වැඩ කරන ආකාරය

### Super Admin

Super Adminට Adminගේ සියලු capabilities සමඟ system-wide settings පාලනය කළ හැක:

- Users සහ Admin accounts පාලනය කිරීම
- Registrations, estates, requests සහ operational approvals පාලනය කිරීම
- Branding, company name, logos සහ login/supplier portal appearance වෙනස් කිරීම
- Office Lorry GPS API operational switch එක ON/OFF කිරීම
- High-level approvals සහ audit information බැලීම

### Admin

Admin operations සකස් කරයි:

- Supplier සහ Collector accounts create/edit/approve කිරීම
- Factory, authorized routes සහ linked estate assign කිරීම
- Supplier estates approve/reject කිරීම
- Collector daily routes assign කිරීම
- Harvest, stock, fertilizer, equipment සහ requests පාලනය කිරීම
- Reports, reconciliation, alerts සහ pending work බැලීම

### Collector / Extension Officer

Collector field collection flow එක ක්‍රියාත්මක කරයි:

- Admin assign කළ අද route එක බැලීම
- Ordered stop list භාවිත කිරීම
- Supplier number/QR හෝ list එකෙන් supplier හඳුනාගැනීම
- Exact estate/collection point තෝරා weight සහ grade record කිරීම
- Digital receipt එකක් සෑදීම
- Wrong record delete නොකර void/reweigh flow භාවිත කිරීම
- අවශ්‍ය විට route-specific live GPS broadcast කිරීම

### Supplier

Supplierට තමන්ට අදාළ data පමණක් පෙන්වන portal එක ලැබේ:

- Estates register/edit කිරීම සහ approval status බැලීම
- Weather, deliveries, receipts, finance සහ deductions බැලීම
- Farm activities සහ labor costs record කිරීම
- Fertilizer/equipment/agrochemical requests යැවීම
- Lorry location, alerts, announcements සහ guidance බැලීම
- Weight dispute, support හෝ profile change request යැවීම

---

## Admin interface එකේ features වැඩ කරන ආකාරය

| Module | System එකේ කාර්යය | සම්බන්ධ වන flow |
|---|---|---|
| **Estate Dashboard** | Estates, harvest, workforce, pending items සහ management indicators පෙන්වයි. | Supabase operational records එකතු කර overview එකක් සකස් කරයි. |
| **Estate Master** | Estates/blocks create, edit, approve, GPS point සහ block boundaries පාලනය කරයි. | Supplier estate, GPS, weather, farm activities සහ collection filters සමඟ සම්බන්ධ වේ. |
| **Crop Management** | Crop/field production information පාලනය කරයි. | Estate සහ block records සමඟ සම්බන්ධ වේ. |
| **Labor Management** | Worker roster, attendance, leave සහ labor costs පාලනය කරයි. | Estate operations සහ worker payments සමඟ සම්බන්ධ වේ. |
| **Harvest Management** | Gross/net leaf, grade, deductions සහ weigh-in records පෙන්වයි. | Collector entry → Supplier receipt → finance flow එකේ source එකකි. |
| **Resource Requisitions** | Supplier requests approve/reject කර allocation/status තබයි. | Supplier Request Resources → stock/ledger → Supplier status. |
| **Inventory** | Stock items, GRN, issues සහ movements පාලනය කරයි. | Fertilizer, agrochemical සහ equipment modules වෙත stock data දෙයි. |
| **Worker Payments/Advances/Welfare** | Payroll, advances සහ welfare data පාලනය කරයි. | Labor records සහ financial operations සමඟ සම්බන්ධ වේ. |
| **Weather & Intelligence** | Estate GPS අනුව weather සහ rule-based operational indicators පෙන්වයි. | Estates සහ OpenWeather response භාවිත කරයි. |
| **User Management** | Users, roles, status, Supplier No, factory, routes සහ linked estate save කරයි. | Login profile, Office API mapping, weather සහ Collector filtering පාලනය කරයි. |
| **Operations & Pending** | Pending registrations, estates, requests සහ other workflow items එකම inbox එකක පෙන්වයි. | Supplier/Collector/Admin workflows වල pending records එකතු කරයි. |
| **Announcements** | Supplier portal සඳහා announcements publish කරයි. | Published items Supplier interface එකේ පෙන්වයි. |
| **Branding & Settings** | Company/app branding සහ operational settings save කරයි. | Login, Admin header, Supplier header සහ Vercel Office GPS control එකට බලපායි. |

Admin branding save කිරීමෙන් web/PWA interface logo සහ names වෙනස් කළ හැක. Installed native Android APK launcher icon/name binary resource එකක් බැවින් එය වෙනස් කිරීමට APK rebuild/install එකක් අවශ්‍ය වේ.

---

## Supplier interface එකේ features වැඩ කරන ආකාරය

| Feature | System එකේ කාර්යය | Data source / connection |
|---|---|---|
| **Home** | Greeting, weather-aware visual scene සහ field guidance, tea rates, lorry card, monthly supply, deliveries, earnings සහ deductions පෙන්වයි. | User profile, linked estate, OpenWeather, Office APIs සහ EMS records. |
| **My Calendar** | Farm/plucking activities දින අනුව පෙන්වයි. | Farm activity records. |
| **My Leaf Deliveries** | Daily/monthly deliveries, receipt details සහ grade breakdown පෙන්වයි. | Office crop/monthly data සහ EMS harvest records. |
| **Earnings & Deductions** | Current/previous month account summary සහ deduction breakdown පෙන්වයි. | Office balance response සහ available EMS finance records. |
| **My Farm Activities** | Fertilizing, pruning, plucking සහ replanting records exact estate block එකට save කරයි. | Supabase `estates`/`estate_blocks` සහ activity history. |
| **My Plot / My Estates** | Estates/blocks register/edit කර approval status බලයි; map එකෙන් GPS point සහ block boundary ලකුණු කරයි. | Supabase estates, estate blocks සහ OpenStreetMap. |
| **My Weather** | Selected/linked estate GPS සඳහා condition-aware forecast, animated weather scene, field guidance සහ verified warnings පෙන්වයි. | Estate coordinates → OpenWeather. |
| **Request Resources** | Equipment, Fertilizer හෝ Agrochemical request යවයි. | Request record → Admin inbox → approval/rejection. |
| **My Fertilizer** | Supplier fertilizer ledger සහ issued fertilizer history පෙන්වයි. | Supplier fertilizer ledger/inventory issues. |
| **My Labor** | Supplierගේ daily worker cost records ගණනය කර save කරයි. | Supplier labor records. |
| **My Profile** | Profile data සහ change requests පාලනය කරයි. | Users profile සහ approval workflow. |
| **Help & Support / Disputes** | Support හෝ weight dispute request යවයි. | Workflow request → Admin pending inbox → resolution. |

Supplier screen එකේ **Factory office system** සහ **EMS records** වැනි source labels භාවිත කරන්නේ පෙන්වන අගය පැමිණියේ කොහෙන්ද කියා පැහැදිලි කිරීමටයි.

---

## Collector collection flow එක

```text
Admin creates today's route assignment
  -> Collector sees assigned route
  -> Collector starts collection
  -> Route stop list appears
  -> Collector selects supplier
  -> Collector selects exact estate
  -> Gross weight + deduction + grade
  -> Net weight calculation
  -> Save/sync
  -> Receipt number
  -> Supplier delivery history and alerts
```

Net weight calculation:

```text
Net kg = Gross kg - Deduction kg
```

Wrong weight එකක් හඳුනාගත් විට original record delete නොකර void reason එක තබා corrected reweigh record එකක් සාදයි. මෙයින් audit history එක රැකේ.

Online connection තිබේ නම් record එක Supabase වෙත save වේ. Supported offline flow එකක connection නැත්නම් unique client record ID එකක් සමඟ local queue එකේ තබා පසුව sync කරයි. Idempotency field එක එකම offline record එක දෙවරක් delivery records දෙකක් ලෙස save වීම වැළැක්වීමට භාවිත වේ.

---

## Estate registration සහ weather data flow

```text
Supplier/Admin enters estate details
  -> GPS latitude/longitude captured or selected on map
  -> Estate saved as pending/approved according to workflow
  -> User is linked to the estate
  -> Supplier Weather resolves linked/owned estate
  -> Estate GPS sent to OpenWeather
  -> Current weather + forecast + farm warnings displayed
  -> condition/rain/wind classified locally as sunny/cloudy/rain/storm/mist
  -> Supplier Home + My Weather colors, atmosphere and guidance update
```

- Estate GPS නැත්නම් system එක live estate weather ලෙස ව්‍යාජ data claim නොකරයි.
- Supplierට linked estate එකක් තිබේ නම් එය weather source එක ලෙස ප්‍රමුඛව භාවිත වේ.
- Multiple estates තිබේ නම් selected estate අනුව weather වෙනස් විය හැක.
- Admin සහ Supplier screens දෙකම එකම estate coordinates භාවිත කරන නිසා device එක වෙනස් වුවත් data source එක එකම වේ.
- Weather visual classification සහ CSS atmosphere browser එක තුළම ක්‍රියා කරයි. ඒ සඳහා අමතර OpenWeather request, image download, database row හෝ paid service එකක් භාවිත නොවේ.
- Live data නොලැබෙන විට UI එක demo weather ලෙස පැහැදිලිව ලකුණු කරයි; demo condition එක operational warning එකක් සෑදීමට භාවිත නොවේ.

### Estate block GPS map data flow

```text
Admin/Supplier selects estate GPS point
  -> adds estate blocks
  -> opens Block Map only when needed (lazy-loaded)
  -> selects a block
      -> Draw on map: manually marks at least three boundary points
      OR
      -> Walk boundary with GPS: records filtered phone GPS points while walking
          -> poor-accuracy and near-duplicate packets are ignored
          -> Pause/Resume/Cancel/Finish controls the local recording
  -> browser calculates an operational hectare estimate
  -> user presses Save changes / Submit request
  -> GeoJSON Polygon + land type saved in estate_blocks
  -> Admin/Supplier read-only map renders the same boundary
  -> Farm Activities loads those same block IDs from Supabase
  -> fertilizer/pruning/plucking record keeps blockId + estateId
```

- Map tiles come from OpenStreetMap through the existing Leaflet stack; no paid map plan is required.
- The map bundle is loaded only after **Map blocks / View GPS map** is opened, so ordinary estate screens do not pay the map startup cost.
- Walk recording uses the phone browser's high-accuracy Geolocation API. A point is accepted only when reported accuracy is within 35 m and it is at least 5 m from the previous accepted point.
- While walking, points, distance, current GPS accuracy and estimated area are calculated on the device. The unfinished walk is kept only in that tab's `sessionStorage`; it does not write every GPS packet to Supabase.
- If the app goes into the background, GPS recording auto-pauses. The user must reopen the app and press **Resume**. **Finish boundary** prepares the polygon, but the estate form's **Save changes / Submit request** is still required for the one final database save.
- Calculated area is an operational planning estimate. It is not a cadastral or legal land survey.
- `docs/migration_phase3_round18_estate_block_maps.sql` adds only `land_type` and `boundary_geojson`; it does not add a table or change authentication/RLS.

---

## Resource request data flow

```text
Supplier selects request type
  -> item + quantity + required date + note
  -> request saved as pending
  -> Admin Resource Requisitions inbox
  -> Admin checks availability
  -> approve or reject with response
  -> stock/ledger updated where applicable
  -> Supplier sees updated status
```

Request types අතර Equipment, Fertilizer සහ Agrochemical තිබේ. Approval එකක් request status එක පමණක් වෙනස් කරනවාද, stock issue එකක්ද සෑදෙන්නේද යන්න අදාළ inventory workflow එක මත රඳා පවතී.

---

## Delivery සහ finance data flow

System එකේ delivery data sources දෙකක් තිබිය හැක:

- **EMS harvest records** — Collector/EMS flow එකෙන් save වූ records.
- **Factory Office API records** — Office system එකෙන් read-only ලෙස ලැබෙන crop, monthly සහ balance data.

```text
Collector/Office leaf record
  -> Supplier + factory + route identity
  -> quantity/grade/date/receipt
  -> monthly supplied + delivery count
  -> gross earnings and deductions
  -> account balance / payment view
```

Historical receipt එකේ save වූ amount එක පසුව tea rate වෙනස් කළ පමණින් rewrite නොකළ යුතුය. Office API values app එක නැවත official amount ලෙස recalculate නොකර, Office response එකේ තිබෙන ආකාරයෙන් neutral labels සමඟ පෙන්වයි.

### Office crop අගයන් දෙක

- **Current Crop Recorded** — current crop endpoint එකෙන් ලැබෙන quantity.
- **Quantity Reflected in Account Statement** — balance endpoint account statement එකේ quantity.

Office එකෙන් official business meaning එක වෙනම තහවුරු කර නොමැති නිසා system එක එකක් “Pending” සහ අනෙක “Confirmed” ලෙස අනුමාන නොකරයි.

### Deductions

Office balance response එකේ non-zero deduction fields itemized කර පෙන්වයි. ඒවාට cash/route/office advances, fertilizer, loans, transport, tea, previous debt සහ වෙනත් Office deductions ඇතුළත් විය හැක. Supplier Home එකේ monthly deductions card එක labor/farm expense එකක් ලෙස නොව **Office account deductions** ලෙස අර්ථ දක්වයි.

### Previous month

Previous Month Statement එක `get_current_balance.php` response එකේ `lm` object එකෙන් ලැබේ. එයින් previous month quantity, earnings, deductions සහ account balance පෙන්වයි. Previous-month PDF එක එම summary එකෙන් සාදයි; මේ සඳහා Office system එකට write කිරීමක් හෝ Supabase archive table එකක් අවශ්‍ය නොවේ.

---

## Factory Office APIs වැඩ කරන ආකාරය — A to Z

Office APIs EMS database එක නොවේ. ඒවා Factory Office system එකේ තිබෙන data read-only ලෙස ලබාදෙන endpoints හතරකි. Browser එක Office HTTP server එකට direct call නොකරයි; Vercel server-side proxy එක මැදින් භාවිත වේ.

### APIs හතර

| Office endpoint filename | EMS Vercel endpoint | ලබාදෙන data |
|---|---|---|
| `get_current_crop_balance.php` | `/api/crop` | Current crop/month quantity සහ delivery-related data. |
| `get_current_balance.php` | `/api/balance` | Account quantity, earnings, deductions, balance සහ `lm` previous-month summary. |
| `get_monthly_details.php` | `/api/monthly` | Current month daily leaf details සහ yesterday record සොයාගැනීමට අවශ්‍ය data. |
| `get_lorry_deatails.php` | `/api/lorry` | Assigned route එකේ latest Office GPS snapshot. |

`get_lorry_deatails.php` යන spelling එක Office upstream endpoint එකේ තිබෙන spelling එකමයි.

### Project එකේ API code තිබෙන files

**Vercel route entry files**

- `api/crop.ts`
- `api/balance.ts`
- `api/monthly.ts`
- `api/lorry.ts`
- `api/health.ts` — function runtime health check එකක් පමණි; Factory data request නොකරයි.

**Shared server logic**

- `server/vercelAdapter.ts` — Vercel request/response එක shared Web handler format එකට adapt කරයි.
- `server/factoryProxy.ts` — authentication, mapping lookup, Office URL construction, read-only fetch, timeout, caching, backoff සහ safe errors පාලනය කරයි.

**Frontend client සහ response handling**

- `src/lib/officeApi.ts` — Firebase token සමඟ EMS `/api/*` routes call කර client cache සහ refresh cooldown පාලනය කරයි.
- `src/lib/officeApiContracts.ts` — Office payload validate/normalize කර lorry coordinate formats parse කරයි.
- `src/lib/officeSupplierSummary.ts` — yesterday crop, comparisons සහ deduction summaries සකස් කරයි.
- `src/lib/officeMapping.ts` — Admin factory/route Office-code mapping save/read helpers තබයි.

**Data පෙන්වන modules**

- `src/modules/SupplierHome.tsx`
- `src/modules/SupplierDeliveries.tsx`
- `src/modules/SupplierPortal.tsx`
- `src/modules/LorryTracking.tsx`

**Admin mapping/control modules**

- `src/modules/FactoryApiMapping.tsx`
- `src/modules/EstateMaster.tsx`
- `src/modules/Settings.tsx`
- `src/lib/branding.tsx`

### Office API request එකේ සම්පූර්ණ data flow

```text
Supplier opens a connected screen
  -> src/lib/officeApi.ts calls our HTTPS /api endpoint
  -> Firebase ID token is sent in Authorization header
  -> server/factoryProxy.ts verifies the Firebase token
  -> Firebase UID identifies the Supabase user profile
  -> server resolves Supplier No + Factory + authorized Route
  -> Office factory/route codes are resolved
  -> server reads FACTORY_API_BASE_URL and FACTORY_API_SECRET
  -> server sends one read-only GET to the correct Office endpoint
  -> response is validated and normalized
  -> cache is updated
  -> safe JSON is returned to the Supplier interface
```

Actual Office URL සහ secret value Vercel Environment Variables තුළ පමණක් තබයි. ඒවා source code, GitHub documentation හෝ browser UI එකට ලියන්නේ නැත.

### Supplier/Factory/Route mapping

```text
users.id                       -> Firebase UID
users.supplier_no              -> Office Supplier/Card ID
users.factory_id               -> assigned EMS factory
users.route_id                 -> primary EMS route
factories.office_factory_code  -> Office factory code
routes.office_route_code       -> Office route code
```

Supplierට multiple routes තිබේ නම් authorized route assignmentsද validate කරයි. Browser request එක වෙනස් කර වෙනත් route එකක data ඉල්ලුවත් Vercel proxy එක mapping/access check එකෙන් නවත්වයි.

### Request frequency සහ cache

- Crop cache: **5 minutes**
- Balance cache: **10 minutes**
- Monthly details cache: **15 minutes**
- Manual Office data refresh cooldown: **5 minutes**
- Successful lorry snapshot cache: **60 seconds**
- Lorry “location unavailable” cache: **5 minutes**
- Temporary lorry/network failures: **2–5 minute backoff**, error type එක අනුව

Supplier Home එක open තබාගැනීමෙන් crop, balance හෝ monthly endpoint polling loop එකක් ක්‍රියා නොකරයි. Service Worker එක Office API requests queue/replay/background-sync නොකරයි.

### Office API unavailable වූ විට

- Same supplierගේ valid last-known cache එක තිබේ නම් updated time සහ warning සමඟ පෙන්විය හැක.
- Login/access/mapping error එකකදී cached financial data පෙන්වන්නේ නැත.
- Cache එකක් නැත්නම් unavailable message එක පෙන්වයි; `0 kg` හෝ `Rs 0` කියා ව්‍යාජ live value එකක් නොසලකයි.
- `FACTORY_API_BASE_URL` හෝ `FACTORY_API_SECRET` Vercel deployment එකේ නැත්නම් proxy එක `503` ලබාදී Office server එකට request එක යවන්නේ නැත.

### Office system එකට EMS එකෙන් වෙනස්කම් සිදු වෙනවාද?

නැහැ. Current integration එක `GET` read requests පමණක් යවයි. Office system data වෙනස් කරන `POST`, `PUT`, `PATCH` හෝ `DELETE` requests මෙහි නැත.

---

## Lorry location systems දෙක වැඩ කරන ආකාරය

Supplier map එකට location source දෙකක් තිබිය හැක.

### Office GPS snapshot

```text
Supplier sees compact lorry card
  -> no Office GPS request yet
  -> Supplier presses View lorry location
  -> Vercel checks Super Admin Office Lorry GPS switch
  -> OFF: request stops at Vercel; Office receives nothing
  -> ON: assigned route is validated
  -> one Office GPS snapshot is requested
  -> coordinates are validated
  -> lorry marker + estate marker + distance/ETA displayed
```

- Automatic Office GPS polling නැත.
- Manual refresh cooldown තත්පර 60කි.
- Map close, app background, module change හෝ logout විට pending request නවතී.
- Admin switch එක default `OFF` වේ.

### Collector live broadcast

```text
Collector starts route tracking
  -> phone GPS coordinates
  -> route-specific Supabase Realtime Broadcast channel
  -> Supplier subscribed to the same authorized route
  -> moving lorry marker
  -> frontend Haversine distance + ETA
```

Broadcast location database table එකකට save නොවේ. Supplier වෙනත් route channel එකක data UI එකෙන් තෝරාගත නොහැක. Office snapshot fail වූ විට map open කර ඇති user සඳහා route broadcast fallback එක භාවිත විය හැක.

---

## Offline, sync සහ mobile/PWA behavior

- PWA Service Worker එක app shell/static assets cache කරයි.
- Authenticated Supabase REST data සහ Office API responses shared Service Worker cache එකකට දමා replay නොකරයි.
- Supported field records offline නම් local queue එකේ තබා online වූ පසු sync කළ හැක.
- `Saved locally` යනු server එකට තවම ගොස් නැති device record එකකි.
- `Synced` යනු server database එකට සාර්ථකව ගොස් ඇති record එකකි.
- `Failed` යනු retry හෝ user/admin attention අවශ්‍ය record එකකි.
- Unsynced records තිබෙන විට browser/app storage clear කිරීමෙන් local queue නැති විය හැක.

Web app, iPhone Home Screen PWA සහ Android wrapper එක එකම deployed web interface load කරයි. Installed PWA icon එක manifest/browser cache මත රඳා පවතී. Native APK icon/name වෙනස් වන්නේ APK rebuild කළ විට පමණි.

---

## Common statuses වල system meaning

| Status | System meaning |
|---|---|
| `pending_approval` | User registration එක Admin approval බලා සිටී. |
| `active` | Userට normal access ඇත. |
| `suspended` | User access තාවකාලිකව නවතා ඇත. |
| `pending` | Estate/request/other workflow item එක review බලා සිටී. |
| `approved` | Item එක approve කර ඇත; ඊළඟ operational step එක තිබිය හැක. |
| `rejected` | Item එක reason එකක් සමඟ reject කර ඇත. |
| `assigned` | Route Collectorට assign කර ඇත. |
| `started` | Collection route එක ක්‍රියාත්මකයි. |
| `completed` | Assignment/work item එක අවසන්. |
| `cancelled` | Assignment/work item එක අවලංගු කර ඇත. |
| `queued` / `saved locally` | Offline record එක device එකේ තාවකාලිකව ඇත. |
| `synced` | Record එක server වෙත සාර්ථකව save වී ඇත. |
| `failed` | Operation/sync එක අසාර්ථක වී attention අවශ්‍යය. |

---

## Source of truth තීරණය කරන ආකාරය

- **Login identity:** Firebase Authentication
- **User role/profile:** Supabase `users`
- **Estate/GPS:** Supabase estates/estate blocks
- **Factory and route assignment:** Supabase factories, routes සහ user route assignments
- **EMS collection receipts:** Supabase harvest/delivery records
- **Official Office leaf/account response:** Factory Office APIs
- **Live estate weather:** OpenWeather response for estate GPS
- **Collector live lorry stream:** Supabase Realtime Broadcast
- **Company/app branding:** Supabase settings record

Screen එකක data sources දෙකක් තිබේ නම් source label එක පෙන්වීමෙන් Office record එක සහ EMS fallback record එක වෙනස් කර හඳුනාගත යුතුය.

---

## Documentation maintenance rule

Feature එකක් add/remove/rename කරන විට හෝ data flow, API endpoint, mapping, cache duration, status meaning හෝ user behavior වෙනස් කරන විට:

- මෙම `docs/HOW_THINGS_WORK.md` file එකේ **current system behavior** update කළ යුතුය.
- Technical change/history එක `docs/WORKFLOW_DIAGRAM.md` file එකේ update කළ යුතුය.
- HOW_THINGS_WORK file එකට daily work notes, commit history, round history හෝ future idea current feature එකක් ලෙස ලියන්න එපා.
- API keys, passwords, tokens, service-role keys සහ private URLs/credentials documentation එකට ලියන්න එපා.
- Internal conversation වචන හෝ “කෙනෙක් කියපු විදිහට” වැනි වාක්‍ය documentation එකට ඇතුළත් නොකරන්න.

මෙම file එකේ අරමුණ එකම එකයි: **දැනට EMS system එක වැඩ කරන ආකාරය සහ data එක feature අතර ගලායන ආකාරය ඕනෑම කෙනෙකුට පැහැදිලි කිරීම.**
