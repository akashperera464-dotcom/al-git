import { useEffect, useState } from "react";
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
import { validateRegistration } from "@/lib/registrationHardening";
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
    try {
      await assertMultiRouteSchemaReady();
      await validateRegistration({ email: registration.email, phone: registration.phone });
      const userId = await registerSupplier({ ...registration, routeId: registration.routeIds[0] });
      // The users row already carries factory_id + primary route_id, so a
      // failing set_user_routes RPC must not orphan the account: degrade to
      // an admin follow-up warning instead of blocking the registration.
      const routeOutcome = await replaceUserRoutesBestEffort({ userId, factoryId: registration.factoryId, routeIds: registration.routeIds, primaryRouteId: registration.routeIds[0], registrationEmail: registration.email });
      setRegistrationDone(true);
      setRegistrationWarning(routeOutcome.ok ? null : t("auth.registrationRoutesWarning"));
      setRegistration({ supplierNo: "", name: "", email: "", password: "", phone: "", factoryId: "", routeIds: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.registrationFailed"));
    } finally {
      setBusy(false);
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

  // When a background image is set, text + card switch to a light-on-dark scheme
  // for guaranteed readability over the scrimmed background.
  const textColor = hasBg ? "text-white" : "text-slate-900 dark:text-white";
  const subTextColor = hasBg ? "text-white/85" : "text-slate-500 dark:text-slate-300";
  const labelClass = hasBg ? "text-white/75" : "text-slate-500 dark:text-slate-300";
  const inputClass = hasBg
    ? "border-white/25 bg-white/10 text-white placeholder:text-white/45 focus:border-white/50 focus:ring-white/20"
    : "border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-950";

  const renderError = () => error ? (
    <div className={`flex items-start gap-2 rounded-xl border p-3 text-xs backdrop-blur ${hasBg ? "border-rose-300/60 bg-rose-500/20 text-rose-50" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200"}`} role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error}</span>
    </div>
  ) : null;

  const renderSignInForm = (kind: "supplier" | "staff", active: boolean) => {
    const staff = kind === "staff";
    const pageAccent = staff ? "#4f46e5" : accent;
    return (
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={`mb-1.5 block text-xs font-semibold ${labelClass}`}>{t("auth.emailUsername")}</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@kdu.com"
              className={`w-full rounded-xl border py-3 pl-10 pr-3 text-sm outline-none transition focus:ring-2 ${inputClass}`}
              disabled={busy}
              tabIndex={active ? 0 : -1}
            />
          </div>
        </div>

        <div>
          <label className={`mb-1.5 block text-xs font-semibold ${labelClass}`}>{t("common.password")}</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className={`w-full rounded-xl border py-3 pl-10 pr-10 text-sm outline-none transition focus:ring-2 ${inputClass}`}
              disabled={busy}
              tabIndex={active ? 0 : -1}
            />
            <button
              type="button"
              onClick={() => setShowPw((visible) => !visible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg transition enabled:hover:-translate-y-0.5 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: pageAccent, boxShadow: `0 10px 30px -8px ${pageAccent}80` }}
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
        <div><label className={`mb-1.5 block text-xs font-semibold ${labelClass}`}>{t("auth.supplierNo")}</label><input value={registration.supplierNo} onChange={event => setRegistration({ ...registration, supplierNo: event.target.value })} placeholder="e.g., 237" className={`w-full rounded-xl border px-3 py-3 text-sm outline-none transition focus:ring-2 ${inputClass}`} disabled={busy} /></div>
        <div><label className={`mb-1.5 block text-xs font-semibold ${labelClass}`}>{t("common.name")}</label><input value={registration.name} onChange={event => setRegistration({ ...registration, name: event.target.value })} className={`w-full rounded-xl border px-3 py-3 text-sm outline-none transition focus:ring-2 ${inputClass}`} disabled={busy} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={`mb-1.5 block text-xs font-semibold ${labelClass}`}>{t("auth.factory")}</label><select value={registration.factoryId} onChange={event => setRegistration({ ...registration, factoryId: event.target.value, routeIds: [] })} className={`w-full rounded-xl border px-3 py-3 text-sm outline-none transition focus:ring-2 ${inputClass}`} disabled={busy}><option value="">{t("auth.selectFactory")}</option>{factories.map(factory => <option key={factory.id} value={factory.id}>{factory.name}</option>)}</select></div>
        <div><label className={`mb-1.5 block text-xs font-semibold ${labelClass}`}>{t("auth.routes")}</label><RouteMultiSelect routes={routes} selected={registration.routeIds} onChange={(routeIds) => setRegistration({ ...registration, routeIds })} disabled={!registration.factoryId || busy} emptyText={t("auth.selectFactoryFirst")} /></div>
      </div>
      <div>
        <label className={`mb-1.5 block text-xs font-semibold ${labelClass}`}>{t("auth.emailUsername")}</label>
        <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="email" autoComplete="email" value={registration.email} onChange={event => setRegistration({ ...registration, email: event.target.value })} placeholder="you@kdu.com" className={`w-full rounded-xl border py-3 pl-10 pr-3 text-sm outline-none transition focus:ring-2 ${inputClass}`} disabled={busy} /></div>
      </div>
      <div>
        <label className={`mb-1.5 block text-xs font-semibold ${labelClass}`}>{t("common.password")}</label>
        <div className="relative"><Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type={showPw ? "text" : "password"} autoComplete="new-password" value={registration.password} onChange={event => setRegistration({ ...registration, password: event.target.value })} placeholder="••••••••" className={`w-full rounded-xl border py-3 pl-10 pr-10 text-sm outline-none transition focus:ring-2 ${inputClass}`} disabled={busy} /><button type="button" onClick={() => setShowPw((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPw ? "Hide password" : "Show password"}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
      </div>
      <div><label className={`mb-1.5 block text-xs font-semibold ${labelClass}`}>{t("common.phone")}</label><input value={registration.phone} onChange={event => setRegistration({ ...registration, phone: event.target.value })} placeholder="+94 77 000 0000" className={`w-full rounded-xl border px-3 py-3 text-sm outline-none transition focus:ring-2 ${inputClass}`} disabled={busy} /></div>

      {registrationDone && <div className={`rounded-xl border p-3 text-xs ${hasBg ? "border-emerald-300/60 bg-emerald-500/20 text-emerald-50" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"}`}>{t("auth.registrationSuccess")}</div>}
      {registrationWarning && <div className={`rounded-xl border p-3 text-xs ${hasBg ? "border-amber-300/60 bg-amber-500/20 text-amber-50" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200"}`}>{registrationWarning}</div>}
      {renderError()}

      <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg transition enabled:hover:-translate-y-0.5 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60" style={{ background: accent, boxShadow: `0 10px 30px -8px ${accent}80` }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {busy ? t("auth.registering") : t("auth.submitRegistration")}
      </button>
    </form>
  );

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-start overflow-x-hidden px-4 pb-8 pt-24 sm:min-h-screen sm:justify-center sm:p-5">
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
        {!embeddedAndroidApp && <LanguageSwitcher dark={hasBg} />}
        <ThemeToggle darkSurface={hasBg} />
      </div>

      <div className="relative z-10 w-full max-w-xl animate-fade-up">
        {/* brand */}
        <div className="mx-auto mb-5 flex max-w-sm flex-col items-center px-6 py-2 text-center sm:mb-6">
          <div
            className="relative mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl shadow-2xl sm:mb-4 sm:h-20 sm:w-20 sm:rounded-3xl"
            style={{ background: hasBg ? "rgba(255,255,255,0.15)" : accent, backdropFilter: hasBg ? "blur(8px)" : undefined }}
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
              <Leaf className="h-8 w-8 text-white sm:h-10 sm:w-10" />
            )}
            <span className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-amber-400 ring-2 ring-white" />
          </div>
          <h1 className={`font-display text-2xl font-extrabold tracking-tight drop-shadow-md sm:text-3xl ${textColor}`}>
            {branding.loginTitle || t("common.appName")}
          </h1>
          <p className={`mt-1 text-sm drop-shadow ${subTextColor}`}>
            {branding.loginSubtitle || t("auth.platformSubtitle")}
          </p>
        </div>

        <div className={`auth-book rounded-[2rem] border p-2 shadow-2xl backdrop-blur-2xl sm:p-3 ${hasBg ? "border-white/25 bg-black/15" : "border-white/90 bg-white/60 shadow-emerald-950/10 dark:border-slate-700 dark:bg-slate-950/60"}`}>
          <div className={`mb-2 grid grid-cols-2 gap-1 rounded-[1.35rem] border p-1 ${hasBg ? "border-white/10 bg-black/25" : "border-white/80 bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900"}`} role="tablist" aria-label={t("auth.choosePortal")}>
            <button type="button" role="tab" aria-selected={portal === "supplier"} onClick={() => changePortal("supplier")} disabled={busy} className={`flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition sm:text-sm ${portal === "supplier" ? "bg-white text-emerald-700 shadow-md dark:bg-slate-800 dark:text-emerald-300" : hasBg ? "text-white/70 hover:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}>
              <Sprout className="h-4 w-4 shrink-0" /><span className="truncate">{t("auth.supplierPortal")}</span>
            </button>
            <button type="button" role="tab" aria-selected={portal === "staff"} onClick={() => changePortal("staff")} disabled={busy} className={`flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition sm:text-sm ${portal === "staff" ? "bg-white text-indigo-700 shadow-md dark:bg-slate-800 dark:text-indigo-300" : hasBg ? "text-white/70 hover:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}>
              <UsersRound className="h-4 w-4 shrink-0" /><span className="truncate">{t("auth.staffPortal")}</span>
            </button>
          </div>

          <div className={`auth-book__pages ${portal === "staff" ? "is-flipped" : ""}`}>
            <section className={`auth-book__page auth-book__page--front rounded-[1.55rem] border p-5 shadow-xl sm:p-7 ${hasBg ? "border-white/25 bg-white/10 backdrop-blur-xl" : "border-emerald-100/80 bg-white/90 backdrop-blur-xl dark:border-emerald-950 dark:bg-slate-900/95"}`} aria-hidden={portal !== "supplier"}>
              <div className="mb-5 flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${hasBg ? "bg-white/15 text-white" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}><Sprout className="h-5 w-5" /></span>
                <div className="min-w-0"><p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${hasBg ? "text-emerald-200" : "text-emerald-600 dark:text-emerald-300"}`}>{t("auth.supplierPortal")}</p><h2 className={`font-display text-lg font-bold ${hasBg ? "text-white" : "text-slate-800 dark:text-slate-100"}`}>{registering ? t("auth.submitRegistration") : t("auth.signInToAccount")}</h2><p className={`mt-1 text-xs leading-relaxed ${subTextColor}`}>{registering ? t("auth.supplierRegistrationHint") : t("auth.supplierPortalHint")}</p></div>
              </div>

              {registering ? renderRegistrationForm() : renderSignInForm("supplier", portal === "supplier")}

              <button type="button" onClick={() => { setRegistering(value => !value); setError(null); setRegistrationDone(false); setRegistrationWarning(null); setShowPw(false); }} tabIndex={portal === "supplier" ? 0 : -1} className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${hasBg ? "text-white hover:bg-white/10" : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50"}`}>
                {registering ? <BookOpen className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />} {registering ? t("auth.backToSignIn") : t("auth.newSupplier")}
              </button>
            </section>

            <section className={`auth-book__page auth-book__page--back rounded-[1.55rem] border p-5 shadow-xl sm:p-7 ${hasBg ? "border-white/25 bg-white/10 backdrop-blur-xl" : "border-indigo-100/80 bg-white/90 backdrop-blur-xl dark:border-indigo-950 dark:bg-slate-900/95"}`} aria-hidden={portal !== "staff"}>
              <div className="mb-5 flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${hasBg ? "bg-white/15 text-white" : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"}`}><ShieldCheck className="h-5 w-5" /></span>
                <div className="min-w-0"><p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${hasBg ? "text-indigo-200" : "text-indigo-600 dark:text-indigo-300"}`}>{t("auth.staffPortal")}</p><h2 className={`font-display text-lg font-bold ${hasBg ? "text-white" : "text-slate-800 dark:text-slate-100"}`}>{t("auth.signInToAccount")}</h2><p className={`mt-1 text-xs leading-relaxed ${subTextColor}`}>{t("auth.staffPortalHint")}</p></div>
              </div>

              {renderSignInForm("staff", portal === "staff")}

              <div className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-[11px] leading-relaxed ${hasBg ? "border-white/15 bg-black/15 text-white/75" : "border-indigo-100 bg-indigo-50/70 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200"}`}><UsersRound className="mt-0.5 h-4 w-4 shrink-0" /><span>{t("auth.staffRolesHint")}</span></div>
            </section>
          </div>

          <div className={`mt-2 flex items-center justify-center gap-2 py-1 text-[10px] font-medium ${hasBg ? "text-white/60" : "text-slate-400 dark:text-slate-500"}`}><BookOpen className="h-3.5 w-3.5" /><span>{t("auth.secureRoleRouting")}</span></div>
        </div>
      </div>
    </div>
  );
}

/** Convenience used by the Shell to render a logout control. */
export function logoutLabel(role: Role, t: (k: string) => string): string {
  return usesAdminShell(role) ? t("common.exitAdmin") : t("common.logout");
}
