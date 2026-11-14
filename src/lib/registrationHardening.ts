import { getSupabase, supabaseConfigured } from "./supabase";

declare global { interface Window { grecaptcha?: { ready(callback: () => void): void; execute(siteKey: string, options: { action: string }): Promise<string> } } }

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

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
  await loadRecaptcha();
  return new Promise((resolve, reject) => window.grecaptcha!.ready(() => window.grecaptcha!.execute(SITE_KEY, { action: "supplier_registration" }).then(resolve).catch(reject)));
}

/**
 * Edge-function guards can fail for infrastructure reasons: the function is
 * not deployed on this Supabase project, the functions relay is down, the
 * device is offline, or the function itself crashed (any non-2xx reply makes
 * `functions.invoke` return an error with no data). None of those outcomes is
 * an abuse verdict — a real verdict is always an HTTP 200 JSON body, which
 * `functions.invoke` surfaces as `data` with `error: null`.
 *
 * Blocking every registration on an infrastructure failure made supplier
 * self-registration unusable, so an unavailable guard degrades gracefully
 * (warn + continue) while real verdicts are still enforced below.
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
  const { data: duplicate, error } = await sb.from("users").select("id").or(`email.eq.${email}${phone ? `,phone.eq.${phone}` : ""}`).limit(1);
  if (error) throw new Error(`Could not validate registration: ${error.message}`);
  if (duplicate?.length) throw new Error("An account with this phone/email already exists");

  const token = await recaptchaToken();
  if (SITE_KEY && !token) throw new Error("Suspicious activity detected. Please try again later.");
  if (token) {
    const { data, error: verifyError } = await sb.functions.invoke("verify-recaptcha", { body: { token, action: "supplier_registration" } });
    if (verifyError) warnGuardUnavailable("verify-recaptcha", verifyError);
    else if (data && data.ok === false) throw new Error("Suspicious activity detected. Please try again later.");
  }
  const { data: rate, error: rateError } = await sb.functions.invoke("rate-limit", { body: { email, phone } });
  if (rateError) {
    warnGuardUnavailable("rate-limit", rateError);
    return;
  }
  if (rate?.reason === "account_exists") throw new Error("An account with this phone/email already exists");
  if (rate && rate.allowed === false) throw new Error("Too many registration attempts from this connection. Please try again later.");
}
