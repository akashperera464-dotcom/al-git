/**
 * Native Secure Storage — encrypted credential + token vault
 * ------------------------------------------------------------------
 * Uses expo-secure-store for Keychain (iOS) / Keystore (Android) backed
 * encrypted storage. Stores Firebase refresh tokens + Supabase access tokens
 * so users stay logged in across app restarts without re-entering password.
 *
 * Install:
 *   npx expo install expo-secure-store
 *
 * Values are encrypted at rest by the OS. ~2KB max per key on iOS Keychain.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY_PREFIX = "verda.";

export type SecureKey =
  | "firebase.refresh_token"
  | "firebase.uid"
  | "supabase.access_token"
  | "user.role"
  | "user.associated_entity_id"
  | "fcm.token"
  | "auth.last_login";

/**
 * Save a value to secure storage. Throws if value exceeds ~2KB.
 */
export async function setSecure(key: SecureKey, value: string): Promise<void> {
  if (!value) {
    await removeSecure(key);
    return;
  }
  if (value.length > 2000) {
    throw new Error(`Value for ${key} is too large (${value.length} chars > 2000)`);
  }
  await SecureStore.setItemAsync(KEY_PREFIX + key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED, // require device unlocked
    requireAuthentication: false,                  // set true for biometric-gated secrets
  });
}

/**
 * Read a value from secure storage. Returns null if missing.
 */
export async function getSecure(key: SecureKey): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY_PREFIX + key);
  } catch {
    return null;
  }
}

/**
 * Delete a key from secure storage.
 */
export async function removeSecure(key: SecureKey): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_PREFIX + key);
}

/**
 * Clear ALL Verda secrets — used on sign-out.
 */
export async function clearAllSecure(): Promise<void> {
  const keys: SecureKey[] = [
    "firebase.refresh_token", "firebase.uid",
    "supabase.access_token", "user.role",
    "user.associated_entity_id", "fcm.token",
    "auth.last_login",
  ];
  await Promise.all(keys.map(k => removeSecure(k)));
}

/**
 * Persist the full auth session (called after successful Firebase login).
 */
export async function persistSession(input: {
  uid: string;
  refreshToken: string;
  accessToken?: string;
  role?: string;
  associatedEntityId?: string;
}): Promise<void> {
  await setSecure("firebase.uid", input.uid);
  await setSecure("firebase.refresh_token", input.refreshToken);
  if (input.accessToken) await setSecure("supabase.access_token", input.accessToken);
  if (input.role) await setSecure("user.role", input.role);
  if (input.associatedEntityId) await setSecure("user.associated_entity_id", input.associatedEntityId);
  await setSecure("auth.last_login", new Date().toISOString());
}

/**
 * Restore the saved session (called on app boot). Returns null if not logged in.
 */
export async function restoreSession(): Promise<{
  uid: string;
  refreshToken: string;
  accessToken?: string;
  role?: string;
  associatedEntityId?: string;
  lastLogin?: string;
} | null> {
  const uid = await getSecure("firebase.uid");
  const refreshToken = await getSecure("firebase.refresh_token");
  if (!uid || !refreshToken) return null;
  return {
    uid,
    refreshToken,
    accessToken: await getSecure("supabase.access_token") ?? undefined,
    role: await getSecure("user.role") ?? undefined,
    associatedEntityId: await getSecure("user.associated_entity_id") ?? undefined,
    lastLogin: await getSecure("auth.last_login") ?? undefined,
  };
}

/**
 * Check device security posture (for biometric auth gating).
 */
export async function deviceSecurityCheck(): Promise<{
  hasBiometrics: boolean;
  canUseBiometrics: boolean;
}> {
  if (Platform.OS === "web") return { hasBiometrics: false, canUseBiometrics: false };
  const hardware = await SecureStore.canUseBiometricAuthentication?.() ?? false;
  return { hasBiometrics: hardware, canUseBiometrics: hardware };
}
