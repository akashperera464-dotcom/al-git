/// <reference types="vite/client" />
/**
 * Verda / KDU ERP · Supabase (PostgreSQL) connection layer
 * ------------------------------------------------------------------
 * HYBRID ARCHITECTURE:
 *   Firebase  → Email/password authentication + Cloud Messaging (FCM).
 *   Supabase  → ALL business logic, master data & transactional tables.
 *
 * CONNECTED PROJECT: KDU ERP
 *
 * A Firebase-authenticated user's `uid` becomes the PRIMARY KEY (`id`) of the
 * Supabase `users` table (see auth.hybrid.ts). Supabase RLS then authorizes
 * operational queries using the text subject `auth.jwt()->>'sub'`.
 *
 * Demo mode (no env): exports a null client; repo.ts falls back to mock data
 * so the app + RBAC boundaries remain runnable & auditable.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { initFirebase } from "./firebase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** The client uses the base project URL; it appends /rest/v1/ automatically. */
export const SUPABASE_PROJECT_URL = SUPABASE_URL?.replace(/\/+$/, "");

export const supabaseConfigured = Boolean(
  SUPABASE_PROJECT_URL && SUPABASE_ANON_KEY && /^https?:\/\//.test(SUPABASE_PROJECT_URL)
);

let client: SupabaseClient | null = null;

/**
 * Idempotent init. Returns null in demo mode (no env) so the repo layer can
 * transparently fall back to the in-memory mock data.
 */
export function initSupabase(): SupabaseClient | null {
  if (client) return client;
  if (!supabaseConfigured) return null;
  client = createClient(SUPABASE_PROJECT_URL!, SUPABASE_ANON_KEY!, {
    // Firebase is the identity provider. Enable Firebase Third-Party Auth in
    // Supabase; its text UID is available to RLS as auth.jwt()->>'sub'.
    accessToken: async () => {
      const { auth } = initFirebase();
      if (!auth) return null;
      await auth.authStateReady();
      return (await auth.currentUser?.getIdToken()) ?? null;
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      // We authenticate via Firebase; Supabase RLS trusts the Firebase uid claim
      // rather than Supabase's own auth session.
      detectSessionInUrl: false,
    },
    global: { headers: { "x-client-info": "verda-erp-web" } },
  });
  return client;
}

/** Convenience accessor used by repo.ts / services. */
export function getSupabase(): SupabaseClient | null {
  return initSupabase();
}

/**
 * Lightweight health-check against the live project. Hits the REST health
 * endpoint and reports status to the console so you can confirm the wiring.
 * Safe to call before the schema is provisioned.
 */
export async function pingSupabase(): Promise<{ ok: boolean; project?: string }> {
  const sb = initSupabase();
  if (!sb || !SUPABASE_PROJECT_URL) return { ok: false };
  try {
    // A HEAD on /rest/v1/ returns 200/4xx with no body — enough to prove reachability.
    const res = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/`, {
      method: "HEAD",
      headers: { apikey: SUPABASE_ANON_KEY!, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const ok = res.status > 0 && res.status < 500;
    // eslint-disable-next-line no-console
    console.info(
      ok
        ? `%c[Supabase] ✓ connected to KDU ERP (YOUR-PROJECT-ID) — REST ${res.status}`
        : `[Supabase] ⚠ reachable but REST returned ${res.status}`,
      ok ? "color:#10b981;font-weight:700" : "color:#f59e0b"
    );
    return { ok, project: "KDU ERP" };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[Supabase] connection check failed", e);
    return { ok: false };
  }
}

/** Connection metadata surfaced to the UI (e.g. the Architecture/Backend panel). */
export const SUPABASE_META = {
  projectName: "KDU ERP",
  projectId: "YOUR-PROJECT-ID",
  region: "ap-southeast-1",
  restUrl: "https://YOUR-PROJECT.supabase.co/rest/v1/",
};
