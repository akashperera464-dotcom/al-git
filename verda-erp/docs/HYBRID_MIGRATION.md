# Verda · Hybrid Architecture Migration Runbook (Firebase + Supabase)

## Architecture

```
┌─────────────────────────────┐        ┌───────────────────────────────────┐
│  Firebase (free)            │        │  Supabase (PostgreSQL)            │
│  ─────────────              │        │  ────────────────────────────     │
│  • Phone OTP Authentication │  uid   │  • users (id == Firebase uid)     │
│  • Cloud Messaging (FCM)    │ ─────▶ │  • estates / divisions / fields   │
│                             │        │  • harvest_records                │
│  (NO business data here)    │        │  • resource_requests              │
└─────────────────────────────┘        │  + Row-Level Security             │
                                       └───────────────────────────────────┘
```

- **Firebase** authenticates the user (Phone OTP) and returns a `uid`. It also
  holds the FCM device token for push. **No ERP/business data lives in Firebase.**
- The **Firebase `uid` becomes the Supabase `users.id` PRIMARY KEY.** After login,
  every read/write flows to Supabase, keyed by that uid.

## Files

| Concern | File |
|---|---|
| Firebase (Auth + FCM only) | `src/lib/firebase.ts` |
| Supabase client | `src/lib/supabase.ts` |
| Hybrid auth (uid mapping) | `src/lib/auth.hybrid.ts` |
| RBAC-enforced data repo | `src/lib/repo.ts` |
| Identity / role guard | `src/lib/identity.ts` |
| SQL schema + RLS | `docs/supabase_schema.sql` |
| FCM push (client) | `src/lib/fcm.ts` |
| State provider | `src/context/AppContext.tsx` |

## 1 · Provision Supabase

1. Create a project at supabase.com → copy **Project URL** + **anon key**.
2. Open the SQL editor → run [`docs/supabase_schema.sql`](./supabase_schema.sql).
   This creates the `users`, `estates`, `divisions`, `fields`, `harvest_records`,
   `resource_requests` tables, the `managed_users` view, plus all RLS policies.

## 2 · Link Firebase uids to Supabase auth (RLS)

Supabase RLS uses `auth.uid()`. To make it equal the Firebase uid, configure a
**custom access-token hook** in Supabase → Auth → Hooks that reads the Firebase
`uid` from the incoming JWT (`request.jwt.claims.firebase`) and returns it as the
actor. (Easiest path: mint a Supabase JWT server-side whose `sub` = the Firebase
uid, or use the official `supabase_custom_access_token_hook` template.) Then
`auth.uid()` resolves to the Firebase uid everywhere, and the policies in
`supabase_schema.sql` enforce the exact same RBAC as the client.

## 3 · Environment

Add to `.env` (see `.env.example`):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Firebase vars stay (Auth + FCM). Without them the app runs in **demo mode**
(mock data) with all RBAC boundaries still enforced.

## 4 · Onboarding flow (uid linking)

```
sendOtp(phone)                ── Firebase reCAPTCHA + SMS
   └─ verifyOtp(code) → uid   ── Firebase confirms OTP
        └─ upsertUserFromFirebase(fbUser)
               └─ supabase.from('users').upsert({ id: uid, phone, name })
                    • new row → role 'supplier' (fail-closed) until admin promotes
                    • existing → role/associated_entity_id preserved
```

An admin then sets `role` / `associated_entity_id` via **User Management**, which
calls `adminSetUserRole()` → Supabase `update`. The role-guard trigger prevents
non-admins from ever editing those fields.

## 5 · Migrate existing Firestore data

For each Firestore collection, export then `insert` into the matching Supabase
table (a one-off ETL). Snake-case the field names (e.g. `areaHa` → `area_ha`).
Keep document ids stable where referenced by FKs.
