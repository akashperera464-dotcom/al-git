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

  const fieldClass = "h-12 w-full rounded-md border border-slate-300 bg-white px-3.5 text-[15px] font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0e5e42] focus:ring-2 focus:ring-[#d3f0e3] disabled:bg-slate-50";
  const labelClass = "mb-1.5 block text-xs font-semibold text-[#11221b]";
  const ctaClass = "inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0e5e42] text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f8a5f] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60";

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
    /* Google Stitch design: split-screen desktop (editorial tea panel + white form),
       full-bleed mobile (tea photo + white card). Branding media overrides photo. */
    <div className="login-stage relative min-h-[100dvh] overflow-hidden bg-[#0b4a53] lg:grid lg:grid-cols-12">
      {/* ---------- LEFT: editorial tea-estate panel (desktop lg+) ---------- */}
      <aside className="relative hidden lg:col-span-7 lg:flex lg:flex-col lg:justify-between lg:p-12 overflow-hidden">
        {hasBg && isVideoUrl(branding.loginBackgroundUrl) ? (
          <video src={branding.loginBackgroundUrl} autoPlay loop muted playsInline preload="auto" aria-hidden="true"
            className="absolute inset-0 z-0 h-full w-full object-cover"
            onCanPlay={(e) => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
            onError={(e) => { (e.target as HTMLVideoElement).style.display = "none"; }} />
        ) : (
          <img src={hasBg ? branding.loginBackgroundUrl : "/tea-estate-bg.jpg"}
            alt="Misty Ceylon tea plantation at morning light"
            className="absolute inset-0 z-0 h-full w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}
        {/* Stitch scrim: dark gradient for text legibility */}
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#11221b]/95 via-[#11221b]/70 to-[#11221b]/80" />
        {hasBg && <div className="absolute inset-0 z-0 bg-black" style={{ opacity: branding.loginScrimOpacity / 100 }} aria-hidden="true" />}

        {/* Brand row */}
        <header className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white shadow-md overflow-hidden">
              {branding.loginLogoUrl && isMediaUrl(branding.loginLogoUrl) ? (
                <img src={branding.loginLogoUrl} alt="logo" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <Leaf className="h-6 w-6 text-[#0e5e42]" />
              )}
            </span>
            <div>
              <p className="font-display text-lg font-bold leading-tight text-white">{branding.companyName || t("common.appName")}</p>
              <p className="text-[13px] text-emerald-100/80">{branding.loginSubtitle || t("auth.platformSubtitle")}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-white/25 bg-black/40 px-4 py-1.5 text-[11px] font-semibold text-white/90">Ceylon Tea</span>
        </header>

        {/* Editorial headline */}
        <div className="relative z-10 max-w-xl pt-8">
          <h1 className="font-display text-4xl font-bold leading-[1.15] tracking-tight text-white text-balance">
            {t("auth.heroHeadline")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-emerald-100/85 text-pretty">
            {t("auth.heroSubheadline")}
          </p>
        </div>

        {/* Footer note */}
        <div className="relative z-10 text-[12px] text-emerald-100/60">{t("common.offlineReady")}</div>
      </aside>

      {/* ---------- RIGHT: white sign-in workspace ---------- */}
      <main className="relative min-h-[100dvh] bg-[#f5f8f5] lg:col-span-5 lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Mobile-only full-bleed tea background */}
        {!hasBg && (
          <div className="absolute inset-0 lg:hidden" aria-hidden="true">
            <img src="/tea-estate-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div className="absolute inset-0 bg-gradient-to-b from-[#11221b]/75 via-[#11221b]/55 to-[#11221b]/85" />
          </div>
        )}
        {hasBg && !isVideoUrl(branding.loginBackgroundUrl) && (
          <div className="absolute inset-0 lg:hidden" aria-hidden="true">
            <img src={branding.loginBackgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div className="absolute inset-0 bg-gradient-to-b from-[#11221b]/75 via-[#11221b]/55 to-[#11221b]/85" />
          </div>
        )}

        {/* Top controls */}
        <div className="relative z-10 flex items-center justify-end gap-2 px-4 pt-5 lg:px-0 lg:pt-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm lg:border-slate-200">
            {!embeddedAndroidApp && <LanguageSwitcher />}
            <ThemeToggle />
          </span>
        </div>

        {/* Mobile hero headline (above card, on photo bg) */}
        <div className="relative z-10 px-5 pt-8 lg:hidden">
          <h1 className="font-display text-[24px] font-bold leading-[1.3] text-white text-balance">
            {t("auth.heroHeadline")}
          </h1>
          <p className="mt-1.5 text-[13px] text-emerald-100/85">{t("auth.heroSubheadlineMobile")}</p>
        </div>

        {/* Sign-in workspace */}
        <div className="relative z-10 mx-auto w-full max-w-md flex-1 px-4 pb-8 pt-5 lg:max-w-md lg:px-0 lg:py-10">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#0e5e42]">{t("auth.portalEyebrow")}</span>
            <h2 className="font-display text-[26px] font-bold leading-tight tracking-tight text-slate-900 lg:text-[30px]">
              {registering ? t("auth.submitRegistration") : t("auth.signInToAccount")}
            </h2>
            <p className="text-sm leading-relaxed text-slate-500">{t("auth.workspaceHint")}</p>
          </div>

          {/* Portal switcher */}
          <div className="mt-5 w-full">
            <div role="tablist" aria-label={t("auth.choosePortal")} className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 bg-[#e7efea] p-1.5">
              <button type="button" role="tab" aria-selected={portal === "supplier"} onClick={() => changePortal("supplier")} disabled={busy} className={`flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-2.5 text-xs font-semibold transition sm:text-sm ${portal === "supplier" ? "bg-white text-[#0e5e42] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                <Sprout className="h-4 w-4 shrink-0" /><span className="truncate">{t("auth.supplierPortal")}</span>
              </button>
              <button type="button" role="tab" aria-selected={portal === "staff"} onClick={() => changePortal("staff")} disabled={busy} className={`flex min-w-0 items-center justify-center gap-1.5 rounded-md px-2 py-2.5 text-xs font-semibold transition sm:text-sm ${portal === "staff" ? "bg-white text-[#0e5e42] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                <ShieldCheck className="h-4 w-4 shrink-0" /><span className="truncate">{t("auth.staffPortal")}</span>
              </button>
            </div>
          </div>

          {/* White form card */}
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:mt-5 lg:p-6">
            <div className={`auth-book__pages ${portal === "staff" ? "is-flipped" : ""}`}>
              <section className="auth-book__page auth-book__page--front" aria-hidden={portal !== "supplier"}>
                {registering ? renderRegistrationForm() : renderSignInForm("supplier", portal === "supplier")}
                <button type="button" onClick={() => { setRegistering(value => !value); setError(null); setRegistrationDone(false); setRegistrationWarning(null); setShowPw(false); }} tabIndex={portal === "supplier" ? 0 : -1} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-[#0e5e42] transition hover:bg-[#d3f0e3] hover:text-[#063726]">
                  {registering ? <BookOpen className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />} {registering ? t("auth.backToSignIn") : t("auth.newSupplier")}
                </button>
              </section>

              <section className="auth-book__page auth-book__page--back" aria-hidden={portal !== "staff"}>
                {renderSignInForm("staff", portal === "staff")}
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-[#dce9e2]/60 p-3 text-[11.5px] leading-relaxed text-[#162a22]">
                  <UsersRound className="mt-0.5 h-4 w-4 shrink-0" /><span>{t("auth.staffRolesHint")}</span>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="relative z-10 flex items-center justify-between px-5 pb-6 text-[12px] text-emerald-100/80 lg:px-0 lg:text-slate-500">
          <span>{branding.companyName || t("common.appName")} · {t("common.appName")} PWA</span>
          <span>{t("common.offlineReady")}</span>
        </footer>
      </main>
    </div>
  );
}
