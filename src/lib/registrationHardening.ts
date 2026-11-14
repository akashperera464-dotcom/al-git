import { getSupabase, supabaseConfigured } from "./supabase";

declare global { interface Window { grecaptcha?: { ready(callback: () => void): void; execute(siteKey: string, options: { action: string }): Promise<string> } } }

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

/**
 * Bounded waits for every registration pipeline step. A step that never
 * settles (stalled reCAPTCHA execute, hung functions-relay connection,
 * unresponsive RPC) must never leave the login spinner spinning forever:
 * it either fails with a clear message (integrity steps) or degrades the
 * guard (anti-abuse steps), and the UI has a final safety net on top.
 */
export const REGISTRATION_DUPLICATE_CHECK_TIMEOUT_MS = 20_000;
export const REGISTRATION_GUARD_TIMEOUT_MS = 15_000;
export const REGISTRATION_STEP_TIMEOUT_MS = 15_000;
export const REGISTRATION_FIREBASE_TIMEOUT_MS = 45_000;
export const REGISTRATION_ROUTE_STEP_TIMEOUT_MS = 15_000;
export const REGISTRATION_UI_STUCK_TIMEOUT_MS = 180_000;
const RECAPTCHA_LOAD_TIMEOUT_MS = 6_000;
const RECAPTCHA_EXECUTE_TIMEOUT_MS = 8_000;

export function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s. Please check your connection and try again.`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

async function loadRecaptcha(): Promise<void> {
  if (!SITE_KEY || window.grecaptcha) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(SITE_KEY)}`;
    script.async = true; script.defer = true; script.onload = () => resolve(); script.onerror = () => reject(new Error("reCAPTCHA could not be loaded."));
    document.head.appendChild(script);
  });
}

async function recaptchaToken(): Promise<string | null> {
  if (!SITE_KEY) return null;
  try {
    await withTimeout(loadRecaptcha(), RECAPTCHA_LOAD_TIMEOUT_MS, "reCAPTCHA load");
  } catch (error) {
    warnGuardUnavailable("verify-recaptcha", error);
    return null;
  }
  try {
    return await withTimeout(
      new Promise<string>((resolve, reject) =>
        window.grecaptcha!.ready(() =>
          window.grecaptcha!.execute(SITE_KEY, { action: "supplier_registration" }).then(resolve).catch(reject)
        )
      ),
      RECAPTCHA_EXECUTE_TIMEOUT_MS,
      "reCAPTCHA execute",
    );
  } catch (error) {
    // A stalled reCAPTCHA (site-key/domain mismatch, blocked endpoint,
    // offline device) previously froze the spinner forever: degrade instead.
    warnGuardUnavailable("verify-recaptcha", error);
    return null;
  }
}

/**
 * Edge-function guards can fail for infrastructure reasons: the function is
 * not deployed on this Supabase project, the functions relay is down, the
 * device is offline, the function crashed (any non-2xx reply makes
 * `functions.invoke` return an error), or the connection simply hangs.
 * None of those outcomes is an abuse verdict — a real verdict is always an
 * HTTP 200 JSON body within the bounded wait. An unavailable guard degrades
 * gracefully (warn + continue) while real verdicts are still enforced.
 */
function warnGuardUnavailable(guard: string, error: unknown): void {
  // eslint-disable-next-line no-console
  console.warn(`[registration] "${guard}" guard is unavailable; continuing without it.`, error instanceof Error ? error.message : error);
}

export async function validateRegistration(input: { email: string; phone?: string }): Promise<void> {
  if (!supabaseConfigured) return;
  const sb = getSupabase()!;
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.replace(/\s+/g, "") || null;
  // Integrity step: a timeout here surfaces as a clear error (blocking is
  // safer than skipping the duplicate check), but it can never hang forever.
  const { data: duplicate, error } = await withTimeout(
    sb.from("users").select("id").or(`email.eq.${email}${phone ? `,phone.eq.${phone}` : ""}`).limit(1),
    REGISTRATION_DUPLICATE_CHECK_TIMEOUT_MS,
    "Account duplicate check",
  );
  if (error) throw new Error(`Could not validate registration: ${error.message}`);
  if (duplicate?.length) throw new Error("An account with this phone/email already exists");

  const token = await recaptchaToken();
  if (token) {
    let data: { ok?: boolean } | null = null;
    let verifyError: unknown = null;
    try {
      ({ data, error: verifyError } = await withTimeout(
        sb.functions.invoke("verify-recaptcha", { body: { token, action: "supplier_registration" } }),
        REGISTRATION_GUARD_TIMEOUT_MS,
        "verify-recaptcha",
      ));
    } catch (timeoutError) {
      verifyError = timeoutError;
    }
    if (verifyError) warnGuardUnavailable("verify-recaptcha", verifyError);
    else if (data && data.ok === false) throw new Error("Suspicious activity detected. Please try again later.");
  }
  let rate: { allowed?: boolean; reason?: string } | null = null;
  let rateError: unknown = null;
  try {
    ({ data: rate, error: rateError } = await withTimeout(
      sb.functions.invoke("rate-limit", { body: { email, phone } }),
      REGISTRATION_GUARD_TIMEOUT_MS,
      "rate-limit",
    ));
  } catch (timeoutError) {
    rateError = timeoutError;
  }
  if (rateError) {
    warnGuardUnavailable("rate-limit", rateError);
    return;
  }
  if (rate?.reason === "account_exists") throw new Error("An account with this phone/email already exists");
  if (rate && rate.allowed === false) throw new Error("Too many registration attempts from this connection. Please try again later.");
}
