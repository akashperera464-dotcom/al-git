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
 * Supplier and staff portals share Firebase authentication, but each portal
 * accepts only the matching approved account role. Branding (logo, background
 * image/video, texts) is controlled by Branding & Settings.
 *
 * When a background image/video is set, a dark scrim auto-applies so all text
 * and the login card stay fully readable.
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
  const accent = branding.accentColor || "#10b981";
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

  // Round 72: the authentication scene is always immersive estate-night dark;
  // admin branding media renders over the generated scene with its scrim kept.
  const subTextColor = "text-emerald-100/55";
  const labelClass = "mb-1.5 block lx-eyebrow";

  const renderError = () => error ? (
    <div className="lx-note lx-note--err" role="alert">
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
          <div className="lx-field">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 lx-icon" />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@kdu.com"
              className="w-full bg-transparent py-3 pl-10 pr-3 text-sm text-white placeholder:text-white/30 outline-none"
              disabled={busy}
              tabIndex={active ? 0 : -1}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>{t("common.password")}</label>
          <div className="lx-field">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 lx-icon" />
            <input
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="w-full bg-transparent py-3 pl-10 pr-10 text-sm text-white placeholder:text-white/30 outline-none"
              disabled={busy}
              tabIndex={active ? 0 : -1}
            />
            <button
              type="button"
              onClick={() => setShowPw((visible) => !visible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 lx-icon transition hover:text-emerald-300"
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
          className={`lx-cta ${staff ? "lx-cta--staff" : ""}`}
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
        <div><label className={labelClass}>{t("auth.supplierNo")}</label><input value={registration.supplierNo} onChange={event => setRegistration({ ...registration, supplierNo: event.target.value })} placeholder="e.g., 237" className="lx-input-plain" disabled={busy} /></div>
        <div><label className={labelClass}>{t("common.name")}</label><input value={registration.name} onChange={event => setRegistration({ ...registration, name: event.target.value })} className="lx-input-plain" disabled={busy} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={labelClass}>{t("auth.factory")}</label><select value={registration.factoryId} onChange={event => setRegistration({ ...registration, factoryId: event.target.value, routeIds: [] })} className="lx-input-plain" disabled={busy}><option value="">{t("auth.selectFactory")}</option>{factories.map(factory => <option key={factory.id} value={factory.id}>{factory.name}</option>)}</select></div>
        <div><label className={labelClass}>{t("auth.routes")}</label><RouteMultiSelect routes={routes} selected={registration.routeIds} onChange={(routeIds) => setRegistration({ ...registration, routeIds })} disabled={!registration.factoryId || busy} emptyText={t("auth.selectFactoryFirst")} /></div>
      </div>
      <div>
        <label className={labelClass}>{t("auth.emailUsername")}</label>
        <div className="lx-field"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 lx-icon" /><input type="email" autoComplete="email" value={registration.email} onChange={event => setRegistration({ ...registration, email: event.target.value })} placeholder="you@kdu.com" className="w-full bg-transparent py-3 pl-10 pr-3 text-sm text-white placeholder:text-white/30 outline-none" disabled={busy} /></div>
      </div>
      <div>
        <label className={labelClass}>{t("common.password")}</label>
        <div className="lx-field"><Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 lx-icon" /><input type={showPw ? "text" : "password"} autoComplete="new-password" value={registration.password} onChange={event => setRegistration({ ...registration, password: event.target.value })} placeholder="••••••••" className="w-full bg-transparent py-3 pl-10 pr-10 text-sm text-white placeholder:text-white/30 outline-none" disabled={busy} /><button type="button" onClick={() => setShowPw((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 lx-icon transition hover:text-emerald-300" aria-label={showPw ? "Hide password" : "Show password"}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
      </div>
      <div><label className={labelClass}>{t("common.phone")}</label><input value={registration.phone} onChange={event => setRegistration({ ...registration, phone: event.target.value })} placeholder="+94 77 000 0000" className="lx-input-plain" disabled={busy} /></div>

      {registrationDone && <div className="lx-note lx-note--ok"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>{t("auth.registrationSuccess")}</span></div>}
      {registrationWarning && <div className="lx-note lx-note--warn"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{registrationWarning}</span></div>}
      {renderError()}

      <button type="submit" disabled={busy} className="lx-cta">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {busy ? t("auth.registering") : t("auth.submitRegistration")}
      </button>
    </form>
  );

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-start overflow-x-hidden px-4 pb-8 pt-20 sm:min-h-screen sm:justify-center sm:p-5" style={{ "--brand-accent": accent, colorScheme: "dark" } as React.CSSProperties}>
      {/* ---- Immersive estate-night scene (round 72) ---- */}
      {!hasBg && (
        <>
          <div className="lx-scene" aria-hidden="true" />
          <div className="lx-glow lx-glow--leaf" aria-hidden="true" />
          <div className="lx-glow lx-glow--sun" aria-hidden="true" />
        </>
      )}
      {/* ---- Background layer ---- */}
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
              crossOrigin="anonymous"
              className="absolute inset-0 h-full w-full object-cover"
              // Browsers can stall autoplay if the video isn't muted or doesn't
              // have playsInline. We have both — but if autoplay still fails
              // (e.g., user has reduced-motion preference), force-play on canplay.
              onCanPlay={(e) => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
              onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }}
            />
          ) : (
            <img
              src={branding.loginBackgroundUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          {/* Readability scrim — opacity controlled by the Super Admin slider. */}
          <div className="absolute inset-0 bg-black" style={{ opacity: branding.loginScrimOpacity / 100 }} />
          {/* Subtle bottom-up gradient for extra contrast behind the card. */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
        </>
      ) : (
        <>
          <div className="app-aurora absolute inset-0" />
          <div className="grid-overlay pointer-events-none absolute inset-0 opacity-50" />
        </>
      )}

      {/* Keep the selector in the viewport's top-right corner on every screen size.
          safe-top-absolute moves it below a mobile display notch when necessary. */}
      <div className="safe-top-absolute absolute right-4 top-4 z-20 flex items-center gap-2">
        {!embeddedAndroidApp && <LanguageSwitcher dark />}
        <ThemeToggle darkSurface />
      </div>

      <div className="relative z-10 w-full max-w-xl">
        {/* brand */}
        <div className="lx-rise mx-auto mb-6 flex max-w-md flex-col items-center px-6 text-center">
          <div
            className="lx-logo relative mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl shadow-2xl shadow-emerald-950/60 sm:mb-5 sm:h-[4.5rem] sm:w-[4.5rem]"
            style={{ background: "linear-gradient(150deg, #0d8a66, #054534)" }}
          >
            {branding.loginLogoUrl && isMediaUrl(branding.loginLogoUrl) ? (
              <img
                src={branding.loginLogoUrl}
                alt="logo"
                className="h-full w-full object-cover"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  t.style.display = "none";
                }}
              />
            ) : (
              <Leaf className="h-8 w-8 text-emerald-100 sm:h-9 sm:w-9" />
            )}
            <span className="lx-logo__seed absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-amber-400 ring-2 ring-[#06251c]" />
          </div>
          <p className="lx-eyebrow mb-2.5">KDU · EMS</p>
          <h1 className="lx-title font-display text-[1.7rem] font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            {branding.loginTitle || t("common.appName")}
          </h1>
          <p className={`mt-2 max-w-xs text-sm leading-relaxed ${subTextColor}`}>
            {branding.loginSubtitle || t("auth.platformSubtitle")}
          </p>
        </div>

        <div className={`auth-book lx-card lx-rise rounded-[2rem] p-2 backdrop-blur-2xl sm:p-3 ${hasBg ? "bg-black/30" : ""}`} style={{ animationDelay: "120ms" }}>
          <div className="lx-switcher mb-2 grid grid-cols-2 gap-1 rounded-[1.35rem] p-1" role="tablist" aria-label={t("auth.choosePortal")}>
            <button type="button" role="tab" aria-selected={portal === "supplier"} onClick={() => changePortal("supplier")} disabled={busy} className={`lx-tab lx-tab--supplier flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold sm:text-sm ${portal === "supplier" ? "is-on" : ""}`}>
              <Sprout className="h-4 w-4 shrink-0" /><span className="truncate">{t("auth.supplierPortal")}</span><span className="lx-pip" aria-hidden="true" />
            </button>
            <button type="button" role="tab" aria-selected={portal === "staff"} onClick={() => changePortal("staff")} disabled={busy} className={`lx-tab lx-tab--staff flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold sm:text-sm ${portal === "staff" ? "is-on" : ""}`}>
              <UsersRound className="h-4 w-4 shrink-0" /><span className="truncate">{t("auth.staffPortal")}</span><span className="lx-pip" aria-hidden="true" />
            </button>
          </div>

          <div className={`auth-book__pages ${portal === "staff" ? "is-flipped" : ""}`}>
            <section className="auth-book__page auth-book__page--front lx-face rounded-[1.55rem] border p-5 sm:p-7" aria-hidden={portal !== "supplier"}>
              <div className="mb-5 flex items-start gap-3">
                <span className="lx-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"><Sprout className="h-5 w-5" /></span>
                <div className="min-w-0"><p className="lx-eyebrow">{t("auth.supplierPortal")}</p><h2 className="font-display text-lg font-bold text-white">{registering ? t("auth.submitRegistration") : t("auth.signInToAccount")}</h2><p className={`mt-1 text-xs leading-relaxed ${subTextColor}`}>{registering ? t("auth.supplierRegistrationHint") : t("auth.supplierPortalHint")}</p></div>
              </div>

              {registering ? renderRegistrationForm() : renderSignInForm("supplier", portal === "supplier")}

              <button type="button" onClick={() => { setRegistering(value => !value); setError(null); setRegistrationDone(false); setRegistrationWarning(null); setShowPw(false); }} tabIndex={portal === "supplier" ? 0 : -1} className="lx-cta lx-cta--ghost mt-4">
                {registering ? <BookOpen className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />} {registering ? t("auth.backToSignIn") : t("auth.newSupplier")}
              </button>
            </section>

            <section className="auth-book__page auth-book__page--back lx-face lx-face--staff rounded-[1.55rem] border p-5 sm:p-7" aria-hidden={portal !== "staff"}>
              <div className="mb-5 flex items-start gap-3">
                <span className="lx-chip lx-chip--staff flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"><ShieldCheck className="h-5 w-5" /></span>
                <div className="min-w-0"><p className="lx-eyebrow !text-indigo-300">{t("auth.staffPortal")}</p><h2 className="font-display text-lg font-bold text-white">{t("auth.signInToAccount")}</h2><p className={`mt-1 text-xs leading-relaxed ${subTextColor}`}>{t("auth.staffPortalHint")}</p></div>
              </div>

              {renderSignInForm("staff", portal === "staff")}

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-indigo-300/25 bg-indigo-400/10 p-3 text-[11px] leading-relaxed text-indigo-100/80"><UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" /><span>{t("auth.staffRolesHint")}</span></div>
            </section>
          </div>

          <div className="lx-cardfoot" aria-hidden="true">
            <span className="lx-trustline" /><span className="lx-trustdot" /><span className="lx-trustline" />
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
