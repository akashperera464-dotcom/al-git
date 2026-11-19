import { useEffect, useRef, useState } from "react";
import { Leaf, Mail, Lock, LogIn, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2, UserPlus, Sprout, UsersRound, BookOpen, ArrowRight } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { registerSupplier, signInWithEmail, signOutFirebase } from "@/lib/auth.hybrid";
import { readFactories, readRoutes, readUserOperationalProfile, type FactoryOption, type RouteOption } from "@/lib/supplierOperations";
import { usesAdminShell } from "@/lib/rbac";
import type { Role } from "@/lib/data";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useBranding, isMediaUrl, isVideoUrl } from "@/lib/branding";
import { useTranslation } from "react-i18next";
import { validateRegistration, withTimeout, REGISTRATION_FIREBASE_TIMEOUT_MS, REGISTRATION_STEP_TIMEOUT_MS, REGISTRATION_UI_STUCK_TIMEOUT_MS } from "@/lib/registrationHardening";
import { RouteMultiSelect } from "@/components/RouteMultiSelect";
import { assertMultiRouteSchemaReady, replaceUserRoutesBestEffort } from "@/lib/userRoutes";
import { isAndroidEmbeddedWebView } from "@/lib/platform";
import { isRoleAllowedForPortal, LOGIN_PORTAL_BLOCKED_UID_KEY, LOGIN_PORTAL_INTENT_KEY, type LoginPortal } from "@/lib/loginPortal";

/**
 * Unified Login Screen — Email + Password (Firebase Auth).
 * ------------------------------------------------------------------
 * Round 74 "Clarity": a calm split-screen. The left panel carries estate
 * identity and photography; the right panel is a crisp, high-contrast form
 * surface. No heavy glass/blur over text, so every glyph — Latin, Sinhala and
 * Tamil — renders sharply on low-end phones.
 *
 * Authentication behaviour is unchanged: both portals share Firebase
 * email/password, and the resolved Supabase profile role decides access.
 */
export function Login() {
  const { t } = useTranslation();
  const { setSession } = useApp();
  const { branding } = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [portal, setPortal] = useState<LoginPortal>("supplier");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registrationDone, setRegistrationDone] = useState(false);
  const [registrationWarning, setRegistrationWarning] = useState<string | null>(null);
  const registrationInFlightRef = useRef(false);
  const [factories, setFactories] = useState<FactoryOption[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [registration, setRegistration] = useState({ supplierNo: "", name: "", email: "", password: "", phone: "", factoryId: "", routeIds: [] as string[] });

  useEffect(() => {
    const blocked = sessionStorage.getItem("verda.auth.blocked");
    if (blocked) { setError(blocked); sessionStorage.removeItem("verda.auth.blocked"); }
  }, []);
  useEffect(() => { void readFactories().then(setFactories).catch(() => setFactories([])); }, []);
  useEffect(() => {
    setRoutes([]);
    setRegistration(current => ({ ...current, routeIds: [] }));
    if (registration.factoryId) void readRoutes(registration.factoryId).then(setRoutes).catch(() => setRoutes([]));
  }, [registration.factoryId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(t("auth.enterEmailPassword"));
      return;
    }
    setBusy(true);
    try {
      try {
        sessionStorage.removeItem(LOGIN_PORTAL_BLOCKED_UID_KEY);
        sessionStorage.setItem(LOGIN_PORTAL_INTENT_KEY, portal);
      } catch { /* Session storage can be unavailable in restricted browsers. */ }
      const session = await signInWithEmail(email.trim(), password);
      if (!isRoleAllowedForPortal(portal, session.role)) {
        try {
          sessionStorage.setItem(LOGIN_PORTAL_BLOCKED_UID_KEY, session.uid);
          sessionStorage.removeItem(LOGIN_PORTAL_INTENT_KEY);
        } catch { /* Session storage can be unavailable in restricted browsers. */ }
        await signOutFirebase().catch(() => {});
        throw new Error(t(portal === "supplier" ? "auth.supplierPortalOnly" : "auth.staffPortalOnly"));
      }
      const access = await readUserOperationalProfile(session.uid);
      if (access?.deactivatedAt) {
        await signOutFirebase();
        throw new Error("Your account has been deactivated. Please contact your administrator.");
      }
      if (access?.status !== "active") {
        await signOutFirebase();
        throw new Error(t("auth.pendingApprovalMessage"));
      }
      try { sessionStorage.removeItem(LOGIN_PORTAL_INTENT_KEY); } catch { /* ignore */ }
      setSession(session);
    } catch (err: unknown) {
      try { sessionStorage.removeItem(LOGIN_PORTAL_INTENT_KEY); } catch { /* ignore */ }
      setError(err instanceof Error ? err.message : t("auth.signInFailed"));
    } finally {
      setBusy(false);
    }
  };

  const submitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    // A previous submission may still be finishing in the background after
    // the UI safety net released the spinner: never start a second pipeline.
    if (registrationInFlightRef.current) return;
    setError(null);
    if (!registration.supplierNo.trim() || !registration.name.trim() || !registration.email.trim() || !registration.password || !registration.factoryId || !registration.routeIds.length) {
      setError(t("auth.registrationRequired"));
      return;
    }
    if (registration.password.length < 6) {
      setError(t("auth.passwordMin6"));
      return;
    }
    setBusy(true);
    registrationInFlightRef.current = true;
    // Hard UI safety net: even if some awaited step never settles, the
    // spinner can never spin forever.
    const stuckTimer = window.setTimeout(() => {
      setBusy(false);
      setError(current => current ?? t("auth.registrationTimeout"));
    }, REGISTRATION_UI_STUCK_TIMEOUT_MS);
    try {
      await withTimeout(assertMultiRouteSchemaReady(), REGISTRATION_STEP_TIMEOUT_MS, "Database schema check");
      await validateRegistration({ email: registration.email, phone: registration.phone });
      const userId = await withTimeout(registerSupplier({ ...registration, routeId: registration.routeIds[0] }), REGISTRATION_FIREBASE_TIMEOUT_MS, "Firebase account creation");
      // The users row already carries factory_id + primary route_id, so a
      // failing set_user_routes RPC must not orphan the account: degrade to
      // an admin follow-up warning instead of blocking the registration.
      const routeOutcome = await replaceUserRoutesBestEffort({ userId, factoryId: registration.factoryId, routeIds: registration.routeIds, primaryRouteId: registration.routeIds[0], registrationEmail: registration.email });
      setError(null);
      setRegistrationDone(true);
      setRegistrationWarning(routeOutcome.ok ? null : t("auth.registrationRoutesWarning"));
      setRegistration({ supplierNo: "", name: "", email: "", password: "", phone: "", factoryId: "", routeIds: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.registrationFailed"));
    } finally {
      window.clearTimeout(stuckTimer);
      setBusy(false);
      registrationInFlightRef.current = false;
    }
  };

  const hasBg = Boolean(branding.loginBackgroundUrl && isMediaUrl(branding.loginBackgroundUrl));
  const accent = branding.accentColor || "#0f766e";
  const embeddedAndroidApp = isAndroidEmbeddedWebView();

  const changePortal = (nextPortal: LoginPortal) => {
    if (busy || nextPortal === portal) return;
    setPortal(nextPortal);
    setRegistering(false);
    setRegistrationDone(false);
    setRegistrationWarning(null);
    setError(null);
    setShowPw(false);
  };

  const fieldClass = "login-input h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[15px] text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 disabled:bg-slate-50";
  const labelClass = "mb-1.5 block text-xs font-semibold text-slate-600";
  const ctaClass = "login-cta inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60";

  const renderError = () => error ? (
    <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-700" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error}</span>
    </div>
  ) : null;

  const renderSignInForm = (kind: "supplier" | "staff", active: boolean) => {
    const staff = kind === "staff";
    return (
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelClass}>{t("auth.emailUsername")}</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@kdu.com"
              className={`${fieldClass} pl-10`}
              disabled={busy}
              tabIndex={active ? 0 : -1}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>{t("common.password")}</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className={`${fieldClass} pl-10 pr-10`}
              disabled={busy}
              tabIndex={active ? 0 : -1}
            />
            <button
              type="button"
              onClick={() => setShowPw((visible) => !visible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-600"
              tabIndex={active ? 0 : -1}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {renderError()}

        <button
          type="submit"
          disabled={busy}
          tabIndex={active ? 0 : -1}
          className={ctaClass}
          style={{ background: staff ? "linear-gradient(135deg,#4f46e5,#4338ca)" : `linear-gradient(135deg,${accent},#0d9488)` }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {busy ? t("auth.signingIn") : staff ? t("auth.staffSignIn") : t("auth.supplierSignIn")}
          {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
    );
  };

  const renderRegistrationForm = () => (
    <form onSubmit={submitRegistration} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={labelClass}>{t("auth.supplierNo")}</label><input value={registration.supplierNo} onChange={event => setRegistration({ ...registration, supplierNo: event.target.value })} placeholder="e.g., 237" className={fieldClass} disabled={busy} /></div>
        <div><label className={labelClass}>{t("common.name")}</label><input value={registration.name} onChange={event => setRegistration({ ...registration, name: event.target.value })} className={fieldClass} disabled={busy} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={labelClass}>{t("auth.factory")}</label><select value={registration.factoryId} onChange={event => setRegistration({ ...registration, factoryId: event.target.value, routeIds: [] })} className={fieldClass} disabled={busy}><option value="">{t("auth.selectFactory")}</option>{factories.map(factory => <option key={factory.id} value={factory.id}>{factory.name}</option>)}</select></div>
        <div><label className={labelClass}>{t("auth.routes")}</label><RouteMultiSelect routes={routes} selected={registration.routeIds} onChange={(routeIds) => setRegistration({ ...registration, routeIds })} disabled={!registration.factoryId || busy} emptyText={t("auth.selectFactoryFirst")} /></div>
      </div>
      <div>
        <label className={labelClass}>{t("auth.emailUsername")}</label>
        <div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="email" autoComplete="email" value={registration.email} onChange={event => setRegistration({ ...registration, email: event.target.value })} placeholder="you@kdu.com" className={`${fieldClass} pl-10`} disabled={busy} /></div>
      </div>
      <div>
        <label className={labelClass}>{t("common.password")}</label>
        <div className="relative"><Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type={showPw ? "text" : "password"} autoComplete="new-password" value={registration.password} onChange={event => setRegistration({ ...registration, password: event.target.value })} placeholder="••••••••" className={`${fieldClass} pl-10 pr-10`} disabled={busy} /><button type="button" onClick={() => setShowPw((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400" aria-label={showPw ? "Hide password" : "Show password"}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
      </div>
      <div><label className={labelClass}>{t("common.phone")}</label><input value={registration.phone} onChange={event => setRegistration({ ...registration, phone: event.target.value })} placeholder="+94 77 000 0000" className={fieldClass} disabled={busy} /></div>

      {registrationDone && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-700"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>{t("auth.registrationSuccess")}</span></div>}
      {registrationWarning && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{registrationWarning}</span></div>}
      {renderError()}

      <button type="submit" disabled={busy} className={ctaClass} style={{ background: `linear-gradient(135deg,${accent},#0d9488)` }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {busy ? t("auth.registering") : t("auth.submitRegistration")}
      </button>
    </form>
  );

  return (
    <div className="login-stage relative min-h-[100dvh] overflow-hidden bg-[#04231a] px-4 py-8 sm:px-6">
      {/* ---- Background layer ----------------------------------------------
          Admin-configured branding media (image OR video) always wins when it
          is set: it renders full-bleed underneath everything, followed by the
          configured readability scrim so the white form card stays legible.
          The CSS mesh stage is only used when no branding media is configured.
          ---------------------------------------------------------------- */}
      {hasBg ? (
        <>
          {isVideoUrl(branding.loginBackgroundUrl) ? (
            <video
              src={branding.loginBackgroundUrl}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              aria-hidden="true"
              className="absolute inset-0 z-0 h-full w-full object-cover"
              // Muted + playsInline is enough for most browsers; force-play on
              // canplay covers stricter autoplay policies.
              onCanPlay={(e) => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
              onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }}
            />
          ) : (
            <img
              src={branding.loginBackgroundUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 z-0 h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          {/* Super Admin readability scrim (opacity from Branding & Settings). */}
          <div className="absolute inset-0 z-0 bg-black" style={{ opacity: branding.loginScrimOpacity / 100 }} aria-hidden="true" />
          {/* Extra depth so the brand lockup and card never sit on a busy area. */}
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/45 via-transparent to-black/55" aria-hidden="true" />
        </>
      ) : (
        <>
          {/* Generated ambient stage: mesh gradient, slow orbs, fine grain. */}
          <div className="login-mesh" aria-hidden="true" />
          <div className="login-orb login-orb--one" aria-hidden="true" />
          <div className="login-orb login-orb--two" aria-hidden="true" />
          <div className="login-grain" aria-hidden="true" />
        </>
      )}

      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        {!embeddedAndroidApp && <LanguageSwitcher dark />}
        <ThemeToggle darkSurface />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[26.5rem] flex-col justify-center">
        {/* Brand lockup on the emerald canvas */}
        <div className="login-rise mb-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/25 backdrop-blur-sm">
            {branding.loginLogoUrl && isMediaUrl(branding.loginLogoUrl) ? (
              <img src={branding.loginLogoUrl} alt="logo" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <Leaf className="h-7 w-7 text-emerald-200" />
            )}
          </span>
          <h1 className="mt-3 font-display text-xl font-bold tracking-tight text-white sm:text-[22px]">
            {branding.loginTitle || t("common.appName")}
          </h1>
          <p className="mx-auto mt-1.5 max-w-[19rem] text-[12.5px] leading-relaxed text-emerald-100/60">
            {branding.loginSubtitle || t("auth.platformSubtitle")}
          </p>
        </div>

        {/* Form card */}
        <div className="login-rise login-card auth-book relative overflow-hidden rounded-2xl bg-white p-1.5" style={{ animationDelay: "80ms" }}>
          <span className="login-card__edge" aria-hidden="true" />
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label={t("auth.choosePortal")}>
            <button type="button" role="tab" aria-selected={portal === "supplier"} onClick={() => changePortal("supplier")} disabled={busy} className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${portal === "supplier" ? "bg-white text-teal-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              <Sprout className="h-4 w-4 shrink-0" /><span className="truncate">{t("auth.supplierPortal")}</span>
            </button>
            <button type="button" role="tab" aria-selected={portal === "staff"} onClick={() => changePortal("staff")} disabled={busy} className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${portal === "staff" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              <UsersRound className="h-4 w-4 shrink-0" /><span className="truncate">{t("auth.staffPortal")}</span>
            </button>
          </div>

          <div className={`auth-book__pages ${portal === "staff" ? "is-flipped" : ""}`}>
            <section className="auth-book__page auth-book__page--front p-4 sm:p-5" aria-hidden={portal !== "supplier"}>
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Sprout className="h-[18px] w-[18px]" /></span>
                <div className="min-w-0">
                  <h2 className="font-display text-[17px] font-bold leading-tight tracking-tight text-slate-900">{registering ? t("auth.submitRegistration") : t("auth.signInToAccount")}</h2>
                  <p className="text-[11.5px] leading-snug text-slate-500">{registering ? t("auth.supplierRegistrationHint") : t("auth.supplierPortalHint")}</p>
                </div>
              </div>

              {registering ? renderRegistrationForm() : renderSignInForm("supplier", portal === "supplier")}

              <button type="button" onClick={() => { setRegistering(value => !value); setError(null); setRegistrationDone(false); setRegistrationWarning(null); setShowPw(false); }} tabIndex={portal === "supplier" ? 0 : -1} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-teal-800 transition hover:bg-teal-50">
                {registering ? <BookOpen className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />} {registering ? t("auth.backToSignIn") : t("auth.newSupplier")}
              </button>
            </section>

            <section className="auth-book__page auth-book__page--back p-4 sm:p-5" aria-hidden={portal !== "staff"}>
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><ShieldCheck className="h-[18px] w-[18px]" /></span>
                <div className="min-w-0">
                  <h2 className="font-display text-[17px] font-bold leading-tight tracking-tight text-slate-900">{t("auth.signInToAccount")}</h2>
                  <p className="text-[11.5px] leading-snug text-slate-500">{t("auth.staffPortalHint")}</p>
                </div>
              </div>

              {renderSignInForm("staff", portal === "staff")}

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-[11.5px] leading-relaxed text-indigo-800">
                <UsersRound className="mt-0.5 h-4 w-4 shrink-0" /><span>{t("auth.staffRolesHint")}</span>
              </div>
            </section>
          </div>
        </div>

      </div>
    </div>
  );
}

/** Convenience used by the Shell to render a logout control. */
export function logoutLabel(role: Role, t: (k: string) => string): string {
  return usesAdminShell(role) ? t("common.exitAdmin") : t("common.logout");
}
