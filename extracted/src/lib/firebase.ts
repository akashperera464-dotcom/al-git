/// <reference types="vite/client" />
/**
 * Verda · Firebase connection layer
 * ------------------------------------------------------------------
 * THE Firestore connection file. Lazily initialises Auth + Firestore from
 * VITE_FIREBASE_* env vars. In demo mode (no env configured) it stays
 * uninitialised and src/lib/repo.ts transparently falls back to mock data,
 * so the app — and its security boundaries — remain runnable & auditable.
 *
 * Never read/write Firestore directly from a component. Always go through
 * src/lib/repo.ts so the RBAC guards run on every call.
 */
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

/** Idempotent init. Returns null handles in demo mode (no env). */
export function initFirebase(): { app: FirebaseApp | null; db: Firestore | null; auth: Auth | null } {
  if (app) return { app, db, auth };
  if (!firebaseConfigured) {
    // Demo mode — repo layer falls back to mock data; boundaries still enforced.
    return { app: null, db: null, auth: null };
  }
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  return { app, db, auth };
}

/** Convenience accessor used by repo.ts. */
export function getDb(): Firestore | null {
  return initFirebase().db;
}
