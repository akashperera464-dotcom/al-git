# PROMPT: Recreate the KDU Tea Estate ERP Mobile App (Supplier + Extension Officer Only)

Copy everything below this line and paste into Google AI Studio:

---

Build a production-grade **mobile-only** ERP application for **Suppliers** and **Extension Officers** of a Tea Estate Enterprise. This is a React Progressive Web App (PWA) that looks and behaves like a native mobile app. It must connect to our existing live backend WITHOUT harming any data.

## CRITICAL RULES

1. **NEVER delete or overwrite existing data.** All operations must be additive (INSERT new records) or read-only.
2. **NEVER run migrations that DROP tables or policies.** The database is already fully set up and live with real users.
3. **Connect to this EXACT backend (already live, do not modify):**
   - Supabase Project URL: `https://lfeowzotqcrdximicoar.supabase.co`
   - Supabase Anon Key: `sb_publishable_kNeYkS0nB3aq1bLdJf4ZVQ_JUJxL2lC`
   - Firebase Project: `kdu-feedback-app`
   - Firebase API Key: `AIzaSyB7XZXgs6_7DZyqYWiU3emz4hjpUyXjJJY`
   - Firebase Auth Domain: `kdu-feedback-app.firebaseapp.com`
   - Firebase Project ID: `kdu-feedback-app`
   - Firebase Storage Bucket: `kdu-feedback-app.firebasestorage.app`
   - Firebase Messaging Sender ID: `806242492907`
   - Firebase App ID: `1:806242492907:web:584e11c34f5573cd3f39ae`
   - Weather API Key (OpenWeatherMap): `6a8d3f26e42eee17bfc9902c8c04309f`

## TECH STACK

- **React 19 + Vite + TypeScript** (mobile-optimized PWA).
- **Tailwind CSS v4**: Mobile-first design. Phone-frame layout on desktop.
- **Firebase Auth**: Email/Password login.
- **Supabase**: Real-time data sync for all business logic.
- **recharts**: Charts and visualizations.
- **lucide-react**: Icons.
- **i18next + react-i18next**: Tri-lingual support (English, Sinhala, Tamil).

## ROLES & ACCESS (RBAC)

Only two roles use this mobile app:

### 1. Extension Officer (`extension_officer`)
- **Landing**: "Register New Supplier" screen.
- **Bottom Nav Tabs**:
  1. **Register New Supplier**: Form (Full Name, Email, Temp Password). Dynamic Estate dropdown (fetched live from Supabase `estates` table). On submit: creates Firebase Auth user (using a secondary app instance so the officer stays logged in) and inserts a row into Supabase `users` table with `role='supplier'` and `associated_entity_id` set to the selected estate.
  2. **Leaf Weighing Entry**: Offline-first weight capture form (Center, Gross Weight, Deduction %). Calculates Net Weight. Saves to Supabase `harvest_records` table.
- **Must NOT access**: Admin dashboards, finance, payroll, ledger, other users' data.

### 2. Supplier (`supplier`)
- **Landing**: "My Leaf Deliveries" screen.
- **Bottom Nav Tabs**:
  1. **My Leaf Deliveries**: Real-time list (Supabase realtime) of their own delivery records from `harvest_records` (filtered by `supplier_id = current user uid`). Shows net weight, quality grade, payment status. Includes a **"Verify My Location at Estate"** button (browser Geolocation API) that inserts their GPS coordinates into `supplier_locations`.
  2. **Smart Alerts Panel**: Shows deterministic fertilizer schedule (reads latest `farm_activities` record). Plucking schedule. **Pruning Advisory** (calculates plant age from estate's `planted_date`). Weather-based fertilizer trigger (fetches OpenWeatherMap forecast using estate coordinates). Feedback loop card (shows last fertilizer/pruning dates). **PruningAdvisory component** requires a planted date input.
  3. **Payment Tracker**: Real-time payment history from `harvest_records`. Total earned, pending amounts.
  4. **My Farm Activities**: Forms to log real field actions into `farm_activities` table. Three types: Fertilizer (date, type, quantity), Pruning (date, type, area), Self-Harvest (date, field, kg, grade). Shows recent activity history.
  5. **Request Resources**: Form to request Workers or Equipment (inserts into `resource_requests`). Shows their own request history with status (PENDING/APPROVED/REJECTED).
- **Must NOT access**: Worker rosters, other suppliers' data, finance/payroll.

## DATABASE TABLES (Read-Only Reference — DO NOT MODIFY)

The app reads from and writes to these existing tables:

- `users` (id, name, email, role, associated_entity_id) — Read/Insert.
- `estates` (id, name, region, latitude, longitude, planted_date, google_maps_embed_url) — Read only.
- `harvest_records` (id, supplier_id, estate_id, net_kg, grade, amount, status) — Read/Insert.
- `farm_activities` (id, user_id, activity_type, logged_date, details) — Read/Insert.
- `resource_requests` (id, supplier_id, type, item_details, quantity, status) — Read/Insert.
- `supplier_locations` (id, user_id, latitude, longitude) — Read/Insert.
- `settings` (key, data) — Read (for branding/logo).

## DESIGN SYSTEM (Mobile-First)

- **Layout**: Centered phone frame (`max-w-md`) on desktop. Full-bleed on mobile. Gradient header (from-pine-900 to-pine-800).
- **Colors**: Primary Emerald (#10b981) + Teal gradient. Extension Officer = Amber/Orange. Supplier = Violet/Purple.
- **Navigation**: Sticky bottom nav bar with icons. **Always-visible red Sign Out button** at the bottom of every content page.
- **Branding**: Read logo/company name from Supabase `settings` table. Display in header.
- **Language**: Globe icon in header for EN/SI/TA switch.
- **Offline**: If offline, show a "You are offline" screen. Queue data capture (CaptureButton component).
- **Fonts**: Plus Jakarta Sans (display), Inter (body).
- **Charts**: recharts (Area charts for weather/finance, Donuts for grades).
- **Icons**: lucide-react.

## AUTH FLOW

1. **Login Screen**: Email + Password fields. Calls Firebase `signInWithEmailAndPassword`. On success, reads `users` table by the Firebase `uid` to get `role`.
2. **Routing**: If role is `extension_officer`, route to Officer Dashboard. If `supplier`, route to Supplier Dashboard. Otherwise show "Access Restricted".
3. **Session**: Persist session via Firebase `onAuthStateChanged`.
4. **Logout**: Clears Firebase auth + local state. Shows Login screen.

## IMPORTANT BEHAVIORS

1. **Real-time sync**: Use Supabase `.on('postgres_changes')` subscriptions so lists update instantly.
2. **Per-estate weather**: Fetch weather using the estate's specific `latitude`/`longitude` (not a global default).
3. **Advisory feedback loop**: When a supplier logs a fertilizer activity, the Smart Alerts panel must read that new record and recalculate the next recommended date dynamically.
4. **Location verification**: The "Verify My Location" button must request browser GPS permissions and insert the exact coordinates into `supplier_locations`.
5. **Supplier registration**: Extension Officers can register new suppliers. Use a **secondary Firebase app instance** (with `inMemoryPersistence`) to create the new Auth user so the officer is NOT signed out. Then insert the new user into Supabase `users` with the selected estate's UUID as `associated_entity_id`.

---

*This prompt recreates the KDU ERP Mobile App (Supplier + Extension Officer) exactly. It connects to the live backend without modifying the database schema or deleting data.*
