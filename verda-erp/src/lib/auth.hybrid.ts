/**
 * Verda · Hybrid Auth Repository (Firebase Email/Password ⇄ Supabase users)
 * ------------------------------------------------------------------
 * AUTH STRATEGY (refactored): ALL roles (Super Admin, Admin, Supervisor,
 * Supplier) log in via Firebase **Email/Password** Auth. Phone OTP is removed.
 *
 *   Firebase  → identity (who you are) + FCM push token.
 *   Supabase  → profile (role, name, email, associated_entity_id) + ERP data.
 *
 * Flow on sign-in:
 *   1. Firebase verifies email+password → returns a UserCredential with `.uid`.
 *   2. fetchUserByUid() reads the Supabase `users` row (id == firebaseUid).
 *   3. The resolved profile (incl. canonical role) → AppContext.setSession().
 *
 * Account creation (admins, from UserManagement):
 *   - provisionUser() registers the new user in Firebase Auth via a SECONDARY
 *     app instance (so the logged-in admin is NOT signed out), retrieves the
 *     new uid, then INSERTs the profile into Supabase `users` with that uid.
 */
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth as fbGetAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  inMemoryPersistence,
  type User as FirebaseUser,
  type Auth,
  type UserCredential,
} from "firebase/auth";
import { initFirebase, firebaseConfigured } from "./firebase";
import { getSupabase, supabaseConfigured } from "./supabase";
import { canonicalRole } from "./identity";
import { isValidUuid } from "./repo";
import type { Role } from "./data";

/** Canonical application auth state. */
export interface AuthState {
  uid: string; // Firebase uid == Supabase users.id (PRIMARY KEY)
  email: string | null;
  name: string;
  phone: string | null;
  role: Role;
  associatedEntityId: string | null; // estate link (suppliers)
  status: "active" | "suspended";
  provider: "firebase";
}

/**
 * The configured Super Admin seed. On first login with these credentials,
 * the account is auto-provisioned in BOTH Firebase Auth and Supabase so the
 * very first sign-in "just works" without manual console setup.
 */
export const SUPER_ADMIN_SEED = {
  email: "akashperera@kdu.com",
  password: "akashperera123*#",
  name: "Akash Perera",
  role: "super_admin" as Role,
};

/* ======================= Firebase Auth handle ======================= */

/** Returns the primary Firebase Auth handle (null in demo mode). */
export function getFirebaseAuth(): Auth | null {
  const { auth } = initFirebase();
  return auth;
}

/* ======================= Email/Password sign-in ======================= */

/** Map a raw Firebase error code to a human-friendly message. */
function friendlyError(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "That email address is malformed.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password is too weak (use at least 6 characters).";
    case "auth/operation-not-allowed":
      return "Email/Password sign-in is NOT enabled in the Firebase Console.";
    case "auth/admin-restricted-operation":
      return "Operation blocked (admin-restricted). Check Firebase Authorized domains & user actions.";
    case "auth/configuration-not-found":
      return "Firebase config mismatch — projectId/apiKey don't match, or Email/Password isn't enabled.";
    case "auth/network-request-failed":
      return "Network error — Firebase could not be reached.";
    default:
      return code ? `${code.replace("auth/", "").replace(/-/g, " ")}` : "Authentication failed — check the browser console.";
  }
}

/**
 * Sign in with email + password, then resolve the Supabase profile.
 * Returns the resolved AuthState (role drives routing).
 */
export async function signInWithEmail(email: string, password: string): Promise<AuthState> {
  const auth = getFirebaseAuth();
  if (!auth || !firebaseConfigured) {
    throw new Error("Firebase is not configured. Set VITE_FIREBASE_* in .env.");
  }

  // ---- Super Admin bootstrap: auto-provision on first login ----
  if (email.trim().toLowerCase() === SUPER_ADMIN_SEED.email) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return await resolveSession(cred.user);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/user-not-found" || code === "auth/invalid-credential" || code === "auth/wrong-password") {
        // First-ever login for the seed → create it, then sign in, then provision Supabase.
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await provisionSupabaseUser(cred.user.uid, {
          email,
          name: SUPER_ADMIN_SEED.name,
          role: SUPER_ADMIN_SEED.role,
        });
        return await resolveSession(cred.user);
      }
      throw new Error(friendlyError(code));
    }
  }

  const cred = await signInWithEmailAndPassword(auth, email, password);
  return await resolveSession(cred.user);
}

/* ======================= Resolve session from a Firebase user ======================= */

/** Read (or create) the Supabase `users` row for this Firebase user. */
async function resolveSession(fb: FirebaseUser): Promise<AuthState> {
  if (!supabaseConfigured) return demoAuthStateFromEmail(fb.uid, fb.email, fb.displayName);

  const row = await fetchUserByUid(fb.uid);
  if (row) return toAuthState(row);

  // Row missing → the account exists in Firebase but not yet provisioned in Supabase.
  // Self-heal ONLY for the Super Admin seed (e.g. a previous bootstrap whose Supabase
  // insert failed because the schema hadn't been migrated yet).
  if (fb.email?.trim().toLowerCase() === SUPER_ADMIN_SEED.email) {
    await provisionSupabaseUser(fb.uid, {
      email: fb.email,
      name: SUPER_ADMIN_SEED.name,
      role: SUPER_ADMIN_SEED.role,
    });
    const retry = await fetchUserByUid(fb.uid);
    if (retry) return toAuthState(retry);
  }

  // Everyone else: fail closed — admins must provision their accounts.
  throw new Error(
    "Your account is not provisioned yet. Please contact your Super Admin / Administrator to create your account."
  );
}

/** Read a user row from Supabase by Firebase uid (the table PK). */
export async function fetchUserByUid(uid: string): Promise<UserRow | null> {
  if (!supabaseConfigured) return null;
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from("users")
    .select("id, name, email, phone, role, associated_entity_id, status")
    .eq("id", uid)
    .single();
  if (error || !data) return null;
  return data as UserRow;
}

/**
 * INSERT a profile into Supabase `users` (id == firebaseUid). Used by both the
 * Super Admin bootstrap and the admin user-creation flow.
 */
export async function provisionSupabaseUser(
  firebaseUid: string,
  profile: {
    email: string;
    name: string;
    role: Role;
    associatedEntityId?: string | null;
    phone?: string | null;
    division?: string | null;
  }
): Promise<void> {
  if (!supabaseConfigured) {
    // eslint-disable-next-line no-console
    console.info("[auth:demo] would INSERT users", { id: firebaseUid, ...profile });
    return;
  }
  const sb = getSupabase()!;
  // Build the row conditionally: only include optional columns when they have a
  // value, so a table missing e.g. `division`/`email` (pre-migration) won't fail
  // the whole insert. The required columns are always present.
  const row: Record<string, unknown> = {
    id: firebaseUid,
    name: profile.name,
    role: profile.role,
    status: "active",
  };
  if (profile.email) row.email = profile.email;
  if (profile.phone) row.phone = profile.phone;
  // associated_entity_id is a UUID column — only set it if it's a valid UUID.
  if (profile.associatedEntityId && isValidUuid(profile.associatedEntityId)) {
    row.associated_entity_id = profile.associatedEntityId;
  }
  if (profile.division) row.division = profile.division;

  const { error } = await sb.from("users").insert(row);
  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
}

/* ======================= Admin: create a new Auth user ======================= */

/**
 * Register a NEW user in Firebase Auth WITHOUT signing out the current admin.
 *
 * Implementation note: the client SDK's `createUserWithEmailAndPassword`
 * creates AND signs in the user — which would log the admin out. To avoid
 * that, we spin up a SECOND, temporary Firebase app instance dedicated to
 * provisioning, perform the create there, then tear it down. The admin's
 * primary session is never affected.
 *
 * (Production alternative: a Cloud Function using the Admin SDK — but the
 * secondary-app pattern needs no backend and works on the free tier.)
 */
export async function provisionUser(
  email: string,
  password: string,
  profile: {
    name: string;
    role: Role;
    associatedEntityId?: string | null;
    division?: string | null;
    phone?: string | null;
  }
): Promise<string> {
  if (!firebaseConfigured) {
    // Demo mode — synthesize a deterministic uid and provision the (mock) profile.
    const uid = `demo-${Date.now()}`;
    await provisionSupabaseUser(uid, { email, ...profile });
    return uid;
  }

  // 1) Spin up a throwaway Firebase app + auth, separate from the admin's.
  //    CRITICAL: use inMemoryPersistence so the temp app NEVER touches the
  //    admin's localStorage/IndexedDB session — that interference was the root
  //    cause of "Authentication failed." errors on user creation.
  const tmpName = `secondary-${Date.now()}`;
  const tmpApp = initializeApp(firebaseConfigObject(), tmpName);
  const tmpAuth = fbGetAuth(tmpApp);
  await setPersistence(tmpAuth, inMemoryPersistence);
  try {
    const cred: UserCredential = await createUserWithEmailAndPassword(tmpAuth, email, password);
    const uid = cred.user.uid;
    // 2) Persist the profile to Supabase with that exact uid.
    await provisionSupabaseUser(uid, { email, ...profile });
    // 3) Sign out + tear down the temp app (best-effort cleanup).
    await signOut(tmpAuth);
    return uid;
  } catch (err: unknown) {
    // Dump the FULL raw error to the console so the exact cause is visible
    // in devtools (the UI only shows a short message).
    // eslint-disable-next-line no-console
    console.error("[provisionUser] raw Firebase error:", err);
    throw new Error(explainAuthError(err));
  } finally {
    try {
      await deleteApp(tmpApp);
    } catch {
      /* already cleaned up — ignore */
    }
  }
}

/**
 * Convert ANY auth error into a precise, actionable message — never the vague
 * "Authentication failed." Every known code maps to a fix; unknown errors
 * surface their raw code + message verbatim so nothing is hidden.
 */
export function explainAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const msg = (err as { message?: string })?.message ?? "";
  const SERVER_ERRORS: Record<string, string> = {
    "auth/operation-not-allowed":
      "Email/Password sign-in is NOT enabled. In the Firebase Console go to: Authentication → Sign-in method → enable Email/Password, then retry.",
    "auth/admin-restricted-operation":
      "This operation is blocked (admin-restricted). In the Firebase Console → Authentication → Settings → scroll to 'User actions' and ensure 'Create users' is allowed; also add your website domain under Authorized domains.",
    "auth/email-already-in-use":
      "An account with this email already exists. Use a different email or have the existing user reset their password.",
    "auth/invalid-email":
      "That email address is not valid.",
    "auth/weak-password":
      "The password is too weak — use at least 6 characters.",
    "auth/network-request-failed":
      "Network error — Firebase could not be reached. Check the device's internet connection and try again.",
    "auth/configuration-not-found":
      "Firebase config mismatch — the projectId/apiKey in .env don't match the project, OR Email/Password isn't enabled for this project.",
    "auth/api-key-not-valid":
      "The Firebase API key in .env is invalid. Double-check VITE_FIREBASE_API_KEY.",
  };
  if (code && SERVER_ERRORS[code]) return SERVER_ERRORS[code];
  if (code) return `${code.replace("auth/", "").replace(/-/g, " ")}${msg ? ` — ${msg}` : ""}`;
  if (msg) return msg;
  return "Could not create user (unknown error). Check the browser console for details.";
}

/* ======================= Admin: edit + delete users (Supabase) ======================= */

/**
 * Update a user's profile in Supabase (name, role, association, status, phone).
 *
 * NOTE: changing a user's role / association here re-scopes them on their NEXT
 * login. The Firebase Auth password/email can only be changed by that user
 * themselves (or via a Cloud Function with the Admin SDK) — so email/password
 * are intentionally NOT editable here.
 */
export async function updateUserProfile(
  targetUid: string,
  patch: {
    name?: string;
    role?: Role;
    associatedEntityId?: string | null;
    division?: string | null;
    phone?: string | null;
    status?: "active" | "suspended";
  }
): Promise<void> {
  if (!supabaseConfigured) {
    // eslint-disable-next-line no-console
    console.info("[auth:demo] would UPDATE users", { id: targetUid, ...patch });
    return;
  }
  const sb = getSupabase()!;
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.role !== undefined) row.role = patch.role;
  // associated_entity_id is a UUID column — only write a value if it's a valid UUID.
  if (patch.associatedEntityId !== undefined) {
    row.associated_entity_id = patch.associatedEntityId && isValidUuid(patch.associatedEntityId) ? patch.associatedEntityId : null;
  }
  if (patch.division !== undefined) row.division = patch.division ?? null;
  if (patch.phone !== undefined) row.phone = patch.phone ?? null;
  if (patch.status !== undefined) row.status = patch.status;
  if (!Object.keys(row).length) return;

  const { error } = await sb.from("users").update(row).eq("id", targetUid);
  if (error) throw new Error(`Supabase update failed: ${error.message}`);
}

/**
 * Permanently delete a user's Supabase profile.
 *
 * The user's Firebase Auth account CANNOT be deleted from the client (it would
 * need the Admin SDK / a Cloud Function). But deleting the Supabase row fully
 * DE-AUTHORIZES them: on their next login, `resolveSession()` finds no profile
 * and throws "not provisioned" — so they can no longer access the system.
 *
 * For a complete hard-delete (removing the Firebase Auth user too), deploy the
 * companion Cloud Function `deleteAuthUser` (see docs) — or delete the user in
 * the Firebase Console → Authentication.
 */
export async function deleteUserProfile(targetUid: string): Promise<void> {
  if (!supabaseConfigured) {
    // eslint-disable-next-line no-console
    console.info("[auth:demo] would DELETE from users", { id: targetUid });
    return;
  }
  const sb = getSupabase()!;
  const { error } = await sb.from("users").delete().eq("id", targetUid);
  if (error) throw new Error(`Supabase delete failed: ${error.message}`);
}

/** The raw config object (needed to initialise a secondary app). */
function firebaseConfigObject() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

/* ======================= Reactive session ======================= */

/**
 * Subscribe to the Firebase session. On mount, if a session exists (e.g.
 * persisted from a previous login), resolve + replay it. Returns the unsubscribe.
 */
export function watchHybridSession(cb: (state: AuthState | null) => void): () => void {
  const auth = getFirebaseAuth();
  if (!auth || !firebaseConfigured) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, async (fb: FirebaseUser | null) => {
    if (!fb) {
      cb(null);
      return;
    }
    try {
      const state = await resolveSession(fb);
      cb(state);
    } catch {
      // Profile not provisioned — treat as not authenticated.
      cb(null);
    }
  });
}

export async function signOutFirebase(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) await signOut(auth);
}

/* ======================= helpers ======================= */

interface UserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  associated_entity_id: string | null;
  status: string | null;
}

function toAuthState(row: UserRow): AuthState {
  return {
    uid: row.id,
    email: row.email,
    name: row.name ?? "KDU User",
    phone: row.phone ?? null,
    role: canonicalRole(row.role ?? undefined),
    associatedEntityId: row.associated_entity_id,
    status: row.status === "suspended" ? "suspended" : "active",
    provider: "firebase",
  };
}

/** Demo fallback so the app is usable without a live backend. */
function demoAuthStateFromEmail(uid: string, email: string | null, name: string | null): AuthState {
  const role: Role = email === SUPER_ADMIN_SEED.email ? "super_admin" : "supplier";
  return {
    uid,
    email,
    name: name ?? "KDU User",
    phone: null,
    role,
    associatedEntityId: role === "supplier" ? "est-glenview" : null,
    status: "active",
    provider: "firebase",
  };
}

// Re-export so legacy imports keep working.
export { fbGetAuth as getAuth };
