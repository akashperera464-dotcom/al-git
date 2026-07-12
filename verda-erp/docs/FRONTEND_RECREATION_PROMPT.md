# PROMPT: Recreate the KDU Tea Estate ERP Frontend (100% Identical)

Copy everything below this line and paste into Google AI Studio:

---

Build a production-grade Integrated Tea Estate Enterprise ERP Platform as a Progressive Web App using React 19 + Vite + TypeScript + Tailwind CSS v4. It must be offline-first, tri-lingual (English/Sinhala/Tamil via i18next), and connect to a hybrid backend: Firebase Email/Password Auth + Supabase PostgreSQL.

## DESIGN SYSTEM
- Primary: Emerald (#10b981) + Teal gradient. Dark pine-green sidebar (#04231A→#064e3b).
- Fonts: Plus Jakarta Sans (display/headings) + Inter (body). Import from Google Fonts.
- Admin Shell: Dark sidebar with grouped nav categories, white content area, sticky backdrop-blur header with weather pill + language switcher + bell + role switcher + logout.
- Mobile Shell: Centered phone frame (max-w-md) on desktop, full-bleed on phones. Gradient header (from-pine-900 to-pine-800). Sticky bottom navigation tabs. Full-width red logout button at bottom of every page.
- Cards: white, rounded-xl, subtle shadow, hover lift. StatCard = icon chip + big number + sparkline.
- Charts: use recharts (AreaTrend, BarSeries, Donut, RadialGauge).
- Icons: lucide-react.
- Animations: fade-up on mount, floaty on logos, shimmer on loading bars.

## FOUR USER ROLES (RBAC — 4 layers of enforcement)

### 1. super_admin
- Desktop Admin Shell (dark sidebar). Full system control.
- Capabilities: ALL admin modules + Branding & Settings (super_admin only) + can create other admins.
- Landing module: dashboard.
- Avatar tone: from-emerald-600 to-teal-700. Initials: "AP".

### 2. admin (Estate Director)
- Desktop Admin Shell. Full ERP access except Branding & Settings.
- Same sidebar modules as super_admin minus settings.
- Landing module: dashboard.
- Avatar tone: from-emerald-500 to-teal-600. Initials: "AW".

### 3. extension_officer (field officer — replaced old "supervisor")
- Mobile Shell (phone frame, bottom nav). 
- ONLY 2 modules: "Register New Supplier" + "Leaf Weighing Entry".
- CANNOT see: finance, payroll, dashboards, any admin modules.
- Landing module: eo-register.
- Avatar tone: from-amber-500 to-orange-600. Initials: "RK".

### 4. supplier (VVIP External Supplier)
- Mobile Shell (phone frame, bottom nav).
- ONLY 5 modules: "My Leaf Deliveries" + "Smart Alerts Panel" + "Payment Tracker" + "My Farm Activities" + "Request Resources".
- Data is scoped to their own uid + associated estate_id.
- CANNOT see: worker rosters, payroll, other suppliers, dashboards.
- Landing module: supplier-deliveries.
- Avatar tone: from-violet-500 to-fuchsia-600. Initials: "SG".

### RBAC Enforcement (4 layers):
1. Nav only renders modules the role can access (modulesForRole).
2. RouteGuard component blocks mounting if canAccess() fails → shows "Access Restricted" screen.
3. repo.ts functions run requireEstateAdmin() or requireOwnerOrAdmin() before any DB call.
4. Supabase RLS policies (open write — client RBAC is the real gate).

### Role Switcher:
In demo/preview mode (not authenticated), the avatar dropdown lets you switch between all 4 roles freely. When authenticated (real session), it shows a "Sign out" button instead.

## AUTHENTICATION (Email/Password via Firebase)

### Login Screen (src/components/Login.tsx):
- Full-screen with branding background (image/video from Supabase settings table + dark scrim for readability).
- Email + Password fields with eye toggle.
- On submit: signInWithEmail(email, password) → Firebase Auth → returns uid → fetchUserByUid(uid) reads Supabase users table → gets role → setSession({uid, role}) → Shell auto-routes by role.
- Super Admin bootstrap: first login with akashperera@kdu.com / akashperera123*# auto-creates the Firebase user + Supabase row with role=super_admin.
- Error messages are specific (never "Authentication failed" — map every Firebase error code to actionable text).
- Language switcher globe button in top-right corner.

### Auth Flow:
- BrandingProvider wraps AppProvider wraps Root.
- Root: if !authReady → AuthSplash (leaf logo + shimmer bar). If !isAuthenticated → Login. If session → Shell + RouteGuard + Module + Toaster.
- watchHybridSession() replays persisted Firebase session on mount (so refresh keeps you logged in).
- signOut() clears both Firebase session + local state.

### User Provisioning (provisionUser):
- Uses a SECONDARY Firebase app instance with inMemoryPersistence (so the admin creating a user is NOT signed out).
- createUserWithEmailAndPassword → gets uid → provisionSupabaseUser(uid, {name, role, email, associatedEntityId}) → INSERT into Supabase users.

## ALL 33 MODULES

### Admin Sidebar Categories (in this exact order):
1. **Command**: Estate Dashboard
2. **Estate & Land**: Estate Master, Crop Management
3. **Field Operations**: Labor Management, Harvest Management, Resource Requisitions
4. **Manufacturing**: Inventory
5. **Inputs**: Fertilizer, Agrochemical
6. **People & Pay**: Payroll System, Loans & Advances, Loyalty Program
7. **Finance**: Finance & Accounting
8. **Intelligence**: Weather & Environment
9. **Administration**: User Management, Branding & Settings (super_admin only)
10. **More / Future**: GPS & GIS Mapping, Vehicle & Fuel, Factory Integration, AI & Analytics, Audit & Compliance, Welfare Management, Mobile & Offline, Architecture & Docs

### Module Details:

**Estate Dashboard**: KPI grid (harvest today, monthly target %, active workforce, outstanding loans, fertilizer stock value, revenue MTD, pest alerts, plucking due). 14-day harvest area chart. Revenue mix donut. Division performance bar chart. Live activity feed. Smart plucking priority. Environmental alerts. Compliance snapshot meters.

**Estate Master**: Estate selector buttons. Selected estate shows gradient header card with region/area/elevation/coordinates. GPS Coordinates Editor (Set/Edit lat+lon → drives per-estate weather). Google Maps embed iframe (admin can paste/edit embed URL). Creation form with tabs: Estate (name, region, area, elevation, map URL, planted date, lat, lon) / Division (parent estate dropdown, name, manager, area) / Field (parent estate+division cascading dropdowns, code, name, cultivar, status). Cultivar mix donut. Field utilization meters by status.

**Labor Management**: Full CRUD. Add worker form (name, NIC, role dropdown, division, bank account, avg kg/day, points, present toggle). Edit form (pencil button per row). Delete with confirmation dialog. Toggle present status by clicking badge. Real-time useLiveData("workers"). DataTable with avatar initials, role badges, productivity meters. QR attendance panel. 30-day attendance bars.

**Harvest Management**: Weigh-in records table. Grade distribution donut (Super/Standard/Coarse). Quick capture form (center, field, worker, gross weight, deduction %, net weight calc).

**User Management**: Full CRUD. Create form: Full name, Role dropdown (Extension Officer / VVIP Supplier / Admin / Super Admin), Email, Temp Password, Phone. Dynamic fields: Supplier→Estate dropdown, Extension Officer→Division dropdown, Admin→"Full access" badge. Real-time useLiveData("users"). Edit form. Delete (super_admin only) with confirmation. Suspend/reactivate toggle. Directory table with role badges, scope links, status dots. Filter tabs (All / Super Admin / Admin / Extension Officer / Supplier).

**Branding & Settings** (super_admin only): Company logo URL, name, tagline. Login title, subtitle, logo URL, background image/video URL, scrim opacity slider (0-100%), accent color picker. Live phone-shaped preview. Save/reset. Persists to Supabase settings table (key='branding', jsonb).

**Weather & Environment**: Estate selector dropdown (if multiple estates). Live OpenWeatherMap forecast for selected estate's lat/lon. Current hero card (blue gradient, temp, condition, rain prob, wind, min temp). 7-day forecast strip. Annual rainfall area chart. Actionable deterministic alerts (heavy rain→pause ops, dry stress→irrigate, wind→reschedule spray, good conditions→pluck). Badge: "Live · OpenWeatherMap" or "Demo data".

**Resource Requisitions**: Admin inbox. Filter tabs (Pending/Approved/Rejected/All). Each ticket: supplier name, type, item, quantity, date, duration, note, pool availability meter (cross-reference labor/inventory), approve/reject buttons. Reject opens inline reason textarea. On approve/reject: silent Supabase update + FCM push toast.

**Extension Officer — Register New Supplier**: Form with Full name, Email, Temp Password, Estate dropdown (fetched live from Supabase). On submit: provisionUser() creates Firebase Auth + Supabase insert with role=supplier + associated_entity_id.

**Extension Officer — Leaf Weighing Entry**: Offline-first form (center, gross weight, deduction slider, net weight calc). CaptureButton queues to sync if offline.

**Supplier — My Leaf Deliveries**: Real-time useLiveData("harvest_records", filter=supplier_id). StatCards (net supplied, delivery count, super grade %). Delivery cards with kg, grade badge, date, amount, paid/pending status. "Verify My Location at Estate" GPS button (browser Geolocation API → INSERT supplier_locations). Loading indicator "Syncing live deliveries…".

**Supplier — Smart Alerts Panel**: Fertilizer schedule card (gradient, level color, recommended date). Plucking schedule (fields to pluck today). Push notifications list. PruningAdvisory component: planted date input, pruning recommendation card (age display, cycle type, next window, peak yield badge), weather-based fertilizer trigger, feedback loop card (last fertilizer + last pruning dates from farm_activities).

**Supplier — Payment Tracker**: Real-time payment history. StatCards (total earned, pending, rate/kg). Payment history list with date, kg, grade, amount, paid/pending badge.

**Supplier — My Farm Activities**: 3 tabs (Fertilizer / Pruning / Self-Harvest). Fertilizer form: date, type dropdown (Urea/MOP/TSP/Dolomite/Organic), quantity kg. Pruning form: date, type (Formative/Light/Medium/Deep/Skiffing), area ha. Self-Harvest form: date, field, grade dropdown, estimated kg. Real-time activity history list. StatCards per type count. Closes advisory feedback loop.

**Supplier — Request Resources**: Form (type Workers/Equipment toggle, item dropdown, quantity, date+time, duration days, note). Submit creates PENDING ticket. "My Requests" list with status badges (PENDING/APPROVED/REJECTED) + admin notes.

## COMPONENTS

- **Shell.tsx**: AdminShell (dark sidebar grouped by category, sticky header) + MobileShell (phone frame, bottom nav, red logout). RoleSwitcher dropdown. SyncPill (online/offline toggle). Brand component reads branding context.
- **Login.tsx**: Email/password form with branding background.
- **RouteGuard.tsx**: Checks canAccess(role, moduleKey) before rendering. Shows "Access Restricted" with role-specific message + "Return to my console" button.
- **EstateMap.tsx**: Google Maps embed iframe + inline edit link for admins.
- **LocationCheckIn.tsx**: "Verify My Location at Estate" GPS button + admin location history view.
- **PruningAdvisory.tsx**: Plant age calc + pruning cycle recommendation + weather trigger + feedback loop.
- **LanguageSwitcher.tsx**: Globe dropdown (EN/SI/TA) with flags.
- **Toaster.tsx**: FCM-style toast notifications (top-right, auto-expire 5s).
- **CaptureButton.tsx**: Offline-first button (queues to sync if offline, shows WifiOff icon).
- **QR.tsx**: Deterministic QR code SVG generator.
- **ui.tsx**: Card, StatCard (with Sparkline), Panel, Badge (with dot), Meter, DataTable, Segmented, PageHeader, IconChip, Hint.
- **charts.tsx**: AreaTrend, BarSeries, Donut, RadialGauge, Legend (all recharts).

## LIBRARIES & LOGIC

- **firebase.ts**: Lazy init Firebase Auth only.
- **supabase.ts**: Lazy init Supabase client.
- **auth.hybrid.ts**: signInWithEmail, provisionUser (secondary app), updateUserProfile, deleteUserProfile, watchHybridSession, explainAuthError (maps every Firebase error to actionable text).
- **repo.ts**: All CRUD functions (createEstate, readWorkers, recordFarmActivity, etc.). requireEstateAdmin/requireOwnerOrAdmin guards. isValidUuid helper.
- **rbac.ts**: ROLE_CAPABILITIES matrix, MODULES array (33 entries with key/label/short/icon/category/roles/capability), canAccess(), modulesForRole(), usesAdminShell(), homeModuleFor().
- **identity.ts**: canonicalRole() (maps SUPER_ADMIN→super_admin, EXTENSION_OFFICER→extension_officer, etc.), isEstateAdmin(), isSuperAdmin().
- **predictive.ts**: evaluateFertilizerWindow (deterministic), recommendPlucking (deterministic), recommendPruning (plant age→cycle), weatherToAlerts (If/Else), ageBasedFertilizerTrigger, estimateYieldKgPerHa.
- **weather.ts**: fetchForecast(lat, lon) → OpenWeatherMap 5-day/3-hour → aggregate to daily. 10-min cache per coordinate pair. Falls back to mock on error.
- **branding.tsx**: BrandingProvider reads/writes Supabase settings table. localStorage cache for instant first paint.
- **useLiveData.ts**: Generic real-time hook. Fetches on mount + subscribes to postgres_changes. Debounced refetch (250ms). Falls back to mock in demo mode.
- **data.ts**: All TypeScript interfaces (Estate, Worker, Role, SupplyRecord, ResourceRequest, FarmActivity, etc.) + mock seed data.

## i18n (Tri-Lingual)
- i18next + react-i18next + i18next-browser-languagedetector.
- locales/en.json, si.json, ta.json with parallel keys.
- Namespaces: common, auth, modules (label+short per module), roles, supplier, farm, officer, userMgmt, domain.
- LanguageSwitcher persists choice to localStorage 'verda.lang'.
- Module labels translated via moduleLabel(t, key) and moduleShort(t, key) helpers.

## .env VARIABLES
```
VITE_SUPABASE_URL=https://lfeowzotqcrdximicoar.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_kNeYkS0nB3aq1bLdJf4ZVQ_JUJxL2lC
VITE_FIREBASE_API_KEY=AIzaSyB7XZXgs6_7DZyqYWiU3emz4hjpUyXjJJY
VITE_FIREBASE_AUTH_DOMAIN=kdu-feedback-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kdu-feedback-app
VITE_FIREBASE_STORAGE_BUCKET=kdu-feedback-app.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=806242492907
VITE_FIREBASE_APP_ID=1:806242492907:web:584e11c34f5573cd3f39ae
VITE_OW_API_KEY=6a8d3f26e42eee17bfc9902c8c04309f
```

## CRITICAL BEHAVIORS
1. Estates load from Supabase on mount (not mock seed) — refresh-safe.
2. Workers, Users, Deliveries all use useLiveData for real-time sync.
3. Weather fetches per-estate coordinates with 10-min cache.
4. Branding saves to Supabase settings table (shared across all devices).
5. Farm activities close the advisory feedback loop.
6. GPS location check-in writes to supplier_locations.
7. Estate creation includes lat/lon fields.
8. All forms validate before submit with specific error messages.
9. Super Admin seed auto-bootstraps on first login.
10. Secondary Firebase app for user provisioning (admin stays logged in).
11. Logout clears both Firebase + local state (no auto-replay on refresh).
12. Mobile shell has always-visible red logout button at bottom + top-right.
