import { useEffect, useRef, useState } from "react";
import { Leaf, Mail, Lock, LogIn, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2, UserPlus, Sprout, UsersRound, BookOpen, ArrowRight, LockOpen, Trees, CloudSun, Package } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { registerSupplier, signInWithEmail, signOutFirebase } from "@/lib/auth.hybrid";
import { readFactories, readRoutes, readUserOperationalProfile, type FactoryOption, type RouteOption } from "@/lib/supplierOperations";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useBranding, isMediaUrl, isVideoUrl } from "@/lib/branding";
import { useTranslation } from "react-i18next";
import { validateRegistration, withTimeout, REGISTRATION_FIREBASE_TIMEOUT_MS, REGISTRATION_STEP_TIMEOUT_MS, REGISTRATION_UI_STUCK_TIMEOUT_MS } from "@/lib/registrationHardening";
import { RouteMultiSelect } from "@/components/RouteMultiSelect";
import { assertMultiRouteSchemaReady, replaceUserRoutesBestEffort } from "@/lib/userRoutes";
import { isAndroidEmbeddedWebView } from "@/lib/platform";
import { isRoleAllowedForPortal, LOGIN_PORTAL_BLOCKED_UID_KEY, LOGIN_PORTAL_INTENT_KEY, type LoginPortal } from "@/lib/loginPortal";

/** The three most valuable supplier capabilities, shown as pills over the photo
    (Stitch-style). Icons mirror the supplier bottom-nav modules so the login
    promise matches what the supplier actually sees after signing in. */
const SUPPLIER_FEATURES = [
  { icon: Trees, labelKey: "auth.featureTeaLands" },
  { icon: CloudSun, labelKey: "auth.featureWeather" },
  { icon: Package, labelKey: "auth.featureDeliveries" },
] as const;

/**
 * Unified Login Screen — Email + Password (Firebase Auth).
 * ------------------------------------------------------------------
 * Dalu Plus (Google Stitch) design, implemented 1:1:
 *  · Desktop — editorial split screen: tea-estate photography panel (7/12)
 *    with brand, display headline and supplier feature pills + crisp white
 *    sign-in workspace (5/12).
 *  · Mobile — full-bleed tea photo with dark scrim, brand bar, headline and
 *    three glass feature pills floating over the photo, elevated white card.
 * Branding media (video or image URL set by the admin) overrides the default
 * estate photograph everywhere it appears.
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
  const bgIsVideo = hasBg && isVideoUrl(branding.loginBackgroundUrl);
  const bgSrc = hasBg && !bgIsVideo ? branding.loginBackgroundUrl : "/tea-estate-bg.jpg";
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

  /* ---- Design tokens (Dalu Plus Stitch) ---- */
  const fieldClass = "login-input h-12 w-full rounded-xl border border-dalu-outline-variant bg-white pl-10 pr-3 text-[15px] font-medium text-dalu-on-surface outline-none transition placeholder:text-dalu-outline focus:border-dalu-primary focus:ring-2 focus:ring-dalu-primary-container disabled:bg-dalu-surface-low";
  const labelClass = "mb-1.5 block text-xs font-semibold text-dalu-on-surface";
  const ctaClass = "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-dalu-primary text-[14px] font-semibold text-white shadow-sm transition hover:bg-dalu-accent active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";
  const secondaryCtaClass = "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dalu-outline-variant bg-white px-3 py-2.5 text-[13px] font-semibold text-dalu-primary transition hover:bg-dalu-primary-container hover:text-dalu-on-primary-container";

  /** Brand media for the photographic panel: admin video > admin image > estate photo. */
  const renderBackdropMedia = (extraClass: string) =>
    bgIsVideo ? (
      <video src={branding.loginBackgroundUrl} autoPlay loop muted playsInline preload="auto" aria-hidden="true"
        className={extraClass}
        onCanPlay={(e) => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
        onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }} />
    ) : (
      <img src={bgSrc} alt="Misty Ceylon tea plantation at morning light" className={extraClass}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
    );

  const renderError = () => error ? (
    <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-700" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error}</span>
    </div>
  ) : null;

  /** Supplier feature pills floating over the photography (Stitch style:
      dark rounded tile, icon on top, label below). */
  const renderFeaturePills = (glass: boolean) => (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {SUPPLIER_FEATURES.map((feature) => {
        const Icon = feature.icon;
        return (
          <div
            key={feature.labelKey}
            className={
              glass
                ? "min-w-0 rounded-xl border border-white/20 bg-[#11221b]/65 p-2.5 shadow-sm backdrop-blur-md sm:p-3"
                : "min-w-0 rounded-xl border border-white/15 bg-[#11221b]/80 p-3 sm:p-4"
            }
          >
            <Icon className="h-4 w-4 text-dalu-primary-container" strokeWidth={2} />
            {/* No truncate/leading-none here: Sinhala vowel signs + descenders
                paint outside a 1em line box, and overflow-hidden would slice
                them in half. Wrap instead — grid rows stretch equally. */}
            <p className="mt-1 min-w-0 text-[10.5px] font-bold leading-[1.55] text-white">
              {t(feature.labelKey)}
            </p>
          </div>
        );
      })}
    </div>
  );

  const renderSignInForm = (kind: "supplier" | "staff", active: boolean) => {
    const staff = kind === "staff";
    return (
      <form onSubmit={submit} className="space-y-3 lg:space-y-4">
        <div>
          <label className={labelClass}>{t("auth.emailUsername")}</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dalu-outline" />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@kdu.com"
              className={fieldClass}
              disabled={busy}
              tabIndex={active ? 0 : -1}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>{t("common.password")}</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dalu-outline" />
            <input
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className={`${fieldClass} pr-10`}
              disabled={busy}
              tabIndex={active ? 0 : -1}
            />
            <button
              type="button"
              onClick={() => setShowPw((visible) => !visible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-dalu-outline transition hover:text-dalu-on-surface"
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
          style={staff ? { background: "#0d5c75" } : undefined}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {busy ? t("auth.signingIn") : staff ? t("auth.staffSignIn") : t("auth.supplierSignIn")}
          {!busy && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
    );
  };

  const renderRegistrationForm = () => (
    <form onSubmit={submitRegistration} className="space-y-3 lg:space-y-4">
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
        <div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dalu-outline" /><input type="email" autoComplete="email" value={registration.email} onChange={event => setRegistration({ ...registration, email: event.target.value })} placeholder="you@kdu.com" className={fieldClass} disabled={busy} /></div>
      </div>
      <div>
        <label className={labelClass}>{t("common.password")}</label>
        <div className="relative"><Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dalu-outline" /><input type={showPw ? "text" : "password"} autoComplete="new-password" value={registration.password} onChange={event => setRegistration({ ...registration, password: event.target.value })} placeholder="••••••••" className={`${fieldClass} pr-10`} disabled={busy} /><button type="button" onClick={() => setShowPw((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-dalu-outline" aria-label={showPw ? "Hide password" : "Show password"}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
      </div>
      <div><label className={labelClass}>{t("common.phone")}</label><input value={registration.phone} onChange={event => setRegistration({ ...registration, phone: event.target.value })} placeholder="+94 77 000 0000" className={fieldClass} disabled={busy} /></div>

      {registrationDone && <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-dalu-success-container p-3 text-xs leading-relaxed text-dalu-on-success-container"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>{t("auth.registrationSuccess")}</span></div>}
      {registrationWarning && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-dalu-warning-container p-3 text-xs leading-relaxed text-dalu-on-warning-container"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{registrationWarning}</span></div>}
      {renderError()}

      <button type="submit" disabled={busy} className={ctaClass}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {busy ? t("auth.registering") : t("auth.submitRegistration")}
      </button>
    </form>
  );

  /** Shared portal switcher (Stitch tabs-with-icon). */
  const renderPortalTabs = () => (
    <div role="tablist" aria-label={t("auth.choosePortal")} className="grid grid-cols-2 gap-1.5 rounded-xl border border-dalu-outline-variant bg-dalu-surface-container p-1.5">
      <button type="button" role="tab" aria-selected={portal === "supplier"} onClick={() => changePortal("supplier")} disabled={busy} className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-[13px] font-semibold transition ${portal === "supplier" ? "bg-white text-dalu-primary shadow-sm" : "text-dalu-on-surface-variant hover:text-dalu-on-surface"}`}>
        <Sprout className="h-4 w-4 shrink-0" /><span className="truncate">{t("auth.supplierPortal")}</span>
      </button>
      <button type="button" role="tab" aria-selected={portal === "staff"} onClick={() => changePortal("staff")} disabled={busy} className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-[13px] font-semibold transition ${portal === "staff" ? "bg-white text-dalu-primary shadow-sm" : "text-dalu-on-surface-variant hover:text-dalu-on-surface"}`}>
        <ShieldCheck className="h-4 w-4 shrink-0" /><span className="truncate">{t("auth.staffPortal")}</span>
      </button>
    </div>
  );

  const brandLockup = (compact: boolean) => (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md ring-1 ring-black/5" style={{ width: compact ? 48 : 64, height: compact ? 48 : 64 }}>
        {branding.loginLogoUrl && isMediaUrl(branding.loginLogoUrl) ? (
          <img src={branding.loginLogoUrl} alt="logo" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <Leaf className={compact ? "h-6 w-6 text-dalu-primary" : "h-8 w-8 text-dalu-primary"} style={{ fill: "currentColor" }} />
        )}
      </span>
      <div className="min-w-0">
        <p className={compact ? "truncate font-display text-[16px] font-bold leading-tight text-white" : "truncate font-display text-[18px] font-bold leading-tight text-white"}>{branding.companyName || t("common.appName")}</p>
        <p className={compact ? "truncate text-[12px] font-medium text-dalu-primary-container" : "truncate text-[12.5px] font-medium text-dalu-primary-container"}>{branding.loginSubtitle || t("auth.platformSubtitle")}</p>
      </div>
    </div>
  );

  return (
    <div className="login-stage relative min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-dalu-hero lg:grid lg:grid-cols-12 lg:overflow-hidden">
      {/* ---------- LEFT: editorial tea-estate panel (desktop lg+) ---------- */}
      <aside className="relative hidden overflow-hidden lg:col-span-7 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:p-10 xl:p-12">
        {renderBackdropMedia("absolute inset-0 z-0 h-full w-full object-cover")}
        {/* Stitch scrim: dark gradient for text legibility */}
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#11221b]/95 via-[#11221b]/70 to-[#11221b]/80" />
        {hasBg && <div className="absolute inset-0 z-0 bg-black" style={{ opacity: branding.loginScrimOpacity / 100 }} aria-hidden="true" />}

        {/* Brand row */}
        <header className="relative z-10 flex items-center justify-between gap-3">
          {brandLockup(false)}
          <span className="shrink-0 rounded-full border border-white/25 bg-black/40 px-4 py-1.5 text-[11px] font-semibold text-white/90">Ceylon Tea</span>
        </header>

        {/* Editorial headline + supplier feature pills */}
        <div className="relative z-10 flex max-w-2xl flex-col gap-6 py-10">
          <h1 className="font-display text-[34px] font-bold leading-[1.18] tracking-tight text-white text-balance xl:text-[40px]">
            {t("auth.heroHeadline")}
          </h1>
          <p className="text-[15px] leading-relaxed text-dalu-primary-container text-pretty">
            {t("auth.heroSubheadline")}
          </p>
          {renderFeaturePills(false)}
        </div>

        {/* Footer note */}
        <div className="relative z-10 text-xs text-emerald-100/60">{t("common.offlineReady", { defaultValue: "Offline-ready PWA" })}</div>
      </aside>

      {/* ---------- RIGHT: sign-in workspace ---------- */}
      <main className="relative min-h-[100dvh] bg-dalu-surface lg:col-span-5 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:p-10 xl:p-12">
        {/* Mobile-only full-bleed tea background (branding video/image still wins) */}
        <div className="absolute inset-0 lg:hidden" aria-hidden="true">
          {bgIsVideo ? (
            <video src={branding.loginBackgroundUrl} autoPlay loop muted playsInline preload="auto"
              className="absolute inset-0 h-full w-full object-cover"
              onCanPlay={(e) => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
              onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }} />
          ) : (
            <img src={bgSrc} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-[#11221b]/75 via-[#11221b]/55 to-[#11221b]/85" />
          {hasBg && <div className="absolute inset-0 bg-black" style={{ opacity: branding.loginScrimOpacity / 100 }} />}
        </div>

        {/* Top controls — two standalone white buttons (Stitch reference:
            translate-pill + moon circle). login-safe-top keeps this row below
            the iPhone notch / Dynamic Island. z-30 lifts the language dropdown
            ABOVE the hero/form so its options stay tappable. */}
        <div className="login-safe-top relative z-30 flex items-center justify-between gap-2 px-4 lg:justify-end lg:px-0">
          <div className="lg:hidden">{brandLockup(true)}</div>
          <div className="flex shrink-0 items-center gap-2">
            {!embeddedAndroidApp && <LanguageSwitcher pill />}
            <ThemeToggle pill />
          </div>
        </div>

        {/* Mobile hero headline + feature pills (over the photo) —
            tightened so the whole page fits one screen with no scroll. */}
        <div className="relative z-10 flex-1 px-4 pb-2 pt-3 lg:hidden">
          <h1 className="font-display text-[21px] font-bold leading-[1.3] tracking-tight text-white text-balance">
            {t("auth.heroHeadline")}
          </h1>
          <p className="mt-1 text-[12.5px] font-medium text-dalu-primary-container">{t("auth.heroSubheadlineMobile")}</p>
          <div className="mt-2">{renderFeaturePills(true)}</div>
        </div>

        {/* Desktop headline block (right panel, above form) */}
        <div className="hidden lg:block" />
        <div className="login-safe-bottom relative z-10 mx-auto w-full max-w-md flex-1 px-4 pt-2 lg:max-w-md lg:px-0 lg:py-10">
          <div className="hidden flex-col gap-1.5 lg:flex">
            <span className="text-xs font-bold uppercase tracking-wide text-dalu-primary">{t("auth.portalEyebrow")}</span>
            <h2 className="font-display text-[34px] font-bold leading-tight tracking-tight text-dalu-on-surface">
              {t("auth.signInToAccount")}
            </h2>
            <p className="text-sm leading-relaxed text-dalu-on-surface-variant">{t("auth.workspaceHint")}</p>
          </div>
          {/* Mobile card header lives inside the card (Stitch mobile login) */}
          <div className="mt-1 lg:hidden" />

          {/* White form card */}
          <div className="mt-2 rounded-3xl border border-white/60 bg-white/95 p-4 shadow-xl backdrop-blur-md lg:mt-6 lg:rounded-3xl lg:border-dalu-outline-variant lg:bg-white lg:p-6 lg:shadow-sm">
            {/* Mobile card header (Stitch: eyebrow + title + lock chip) */}
            <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wide text-dalu-primary">{t("auth.portalEyebrow")}</span>
                <h2 className="mt-0.5 font-display text-[22px] font-bold leading-snug tracking-tight text-dalu-on-surface">
                  {registering ? t("auth.submitRegistration") : t("auth.signInToAccount")}
                </h2>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-dalu-primary-container text-dalu-on-primary-container">
                <LockOpen className="h-5 w-5" />
              </span>
            </div>

            {renderPortalTabs()}

            <div className={`auth-book__pages mt-4 ${portal === "staff" ? "is-flipped" : ""}`}>
              <section className="auth-book__page auth-book__page--front" aria-hidden={portal !== "supplier"}>
                {registering ? renderRegistrationForm() : renderSignInForm("supplier", portal === "supplier")}
                <button type="button" onClick={() => { setRegistering(value => !value); setError(null); setRegistrationDone(false); setRegistrationWarning(null); setShowPw(false); }} tabIndex={portal === "supplier" ? 0 : -1} className={`mt-2 ${secondaryCtaClass}`}>
                  {registering ? <BookOpen className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />} {registering ? t("auth.backToSignIn") : t("auth.newSupplier")}
                </button>
              </section>

              <section className="auth-book__page auth-book__page--back" aria-hidden={portal !== "staff"}>
                {renderSignInForm("staff", portal === "staff")}
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-dalu-outline-variant bg-dalu-secondary-container/60 p-3 text-[11.5px] leading-relaxed text-dalu-on-secondary-container">
                  <UsersRound className="mt-0.5 h-4 w-4 shrink-0" /><span>{t("auth.staffRolesHint")}</span>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Footer — desktop only. On mobile the bottom row is removed so the
            page fits one screen; login-safe-bottom on the form container keeps
            the submit button clear of the home indicator. */}
        <footer className="hidden lg:flex relative z-10 items-center justify-between px-4 pb-6 text-[11.5px] font-medium text-dalu-on-surface-variant">
          <span className="truncate">{branding.companyName || t("common.appName")} · {branding.loginSubtitle || t("auth.platformSubtitle")}</span>
          <span className="shrink-0">{t("common.offlineReady", { defaultValue: "Offline-ready PWA" })}</span>
        </footer>
      </main>
    </div>
  );
}

