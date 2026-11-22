import { sendPasswordResetEmail } from "firebase/auth";
import { getFirebaseAuth } from "./auth.hybrid";
import { firebaseConfigured } from "./firebase";

/**
 * Sends a Firebase password-reset email without exposing whether an account
 * exists. Keeping this outside auth.hybrid preserves the established sign-in
 * and role-resolution pipeline.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth || !firebaseConfigured) {
    throw new Error("Firebase is not configured.");
  }

  try {
    await sendPasswordResetEmail(auth, email.trim());
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code ?? "";
    // Account-enumeration safe: the UI always gives the same result for an
    // unknown/disabled account as it does for a known account.
    if (code === "auth/user-not-found" || code === "auth/user-disabled") return;
    if (code === "auth/network-request-failed") {
      throw new Error("network");
    }
    if (code === "auth/too-many-requests") {
      throw new Error("rate-limit");
    }
    throw error;
  }
}
