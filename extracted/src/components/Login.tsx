import { useState } from "react";
import { Leaf, Mail, Lock, LogIn, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { signInWithEmail } from "@/lib/auth.hybrid";
import { usesAdminShell } from "@/lib/rbac";
import type { Role } from "@/lib/data";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useBranding, isMediaUrl, isVideoUrl } from "@/lib/branding";
import { useTranslation } from "react-i18next";

/**
 * Unified Login Screen — Email + Password (Firebase Auth).
 * ------------------------------------------------------------------
 * ALL roles log in here. Branding (logo, background image/video, texts) is
 * controlled by the Super Admin via the Branding & Settings screen.
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(t("auth.enterEmailPassword"));
      return;
    }
    setBusy(true);
    try {
      const session = await signInWithEmail(email.trim(), password);
      setSession(session);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  const hasBg = Boolean(branding.loginBackgroundUrl && isMediaUrl(branding.loginBackgroundUrl));
  const accent = branding.accentColor || "#10b981";

  // When a background image is set, text + card switch to a light-on-dark scheme
  // for guaranteed readability over the scrimmed background.
  const textColor = hasBg ? "text-white" : "text-slate-900";
  const subTextColor = hasBg ? "text-white/85" : "text-slate-500";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-5">
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
              className="absolute inset-0 h-full w-full object-cover"
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

      {/* language switcher */}
      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher dark />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-up">
        {/* brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="relative mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl shadow-2xl"
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
              <Leaf className="h-10 w-10 text-white" />
            )}
            <span className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-amber-400 ring-2 ring-white" />
          </div>
          <h1 className={`font-display text-3xl font-extrabold tracking-tight drop-shadow-md ${textColor}`}>
            {branding.loginTitle || "Verda ERP"}
          </h1>
          <p className={`mt-1 text-sm drop-shadow ${subTextColor}`}>
            {branding.loginSubtitle || "Integrated Tea Estate Enterprise Platform"}
          </p>
        </div>

        {/* card */}
        <div
          className={`rounded-2xl p-7 shadow-2xl backdrop-blur-xl transition ${
            hasBg ? "border border-white/20 bg-white/10" : "card card-elev"
          }`}
        >
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" style={{ color: hasBg ? "#fff" : accent }} />
            <h2 className={`font-display text-lg font-bold ${hasBg ? "text-white" : "text-slate-800"}`}>
              Sign in to your account
            </h2>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {/* email */}
            <div>
              <label className={`mb-1.5 block text-xs font-semibold ${hasBg ? "text-white/70" : "text-slate-500"}`}>Email / Username</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@kdu.com"
                  className={`w-full rounded-xl border py-3 pl-10 pr-3 text-sm outline-none transition focus:ring-2 ${
                    hasBg
                      ? "border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-white/40 focus:ring-white/20"
                      : "border-slate-200 bg-white text-slate-800 focus:border-emerald-400 focus:ring-emerald-100"
                  }`}
                  disabled={busy}
                />
              </div>
            </div>

            {/* password */}
            <div>
              <label className={`mb-1.5 block text-xs font-semibold ${hasBg ? "text-white/70" : "text-slate-500"}`}>Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full rounded-xl border py-3 pl-10 pr-10 text-sm outline-none transition focus:ring-2 ${
                    hasBg
                      ? "border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-white/40 focus:ring-white/20"
                      : "border-slate-200 bg-white text-slate-800 focus:border-emerald-400 focus:ring-emerald-100"
                  }`}
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* error */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-300/60 bg-rose-500/20 p-3 text-xs text-rose-100 backdrop-blur">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* submit */}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: accent, boxShadow: `0 10px 30px -8px ${accent}80` }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {busy ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>

          {/* footer */}
          <div className="mt-5 border-t pt-4" style={{ borderColor: hasBg ? "rgba(255,255,255,0.1)" : "rgb(241 245 249)" }}>
            <p className={`text-center text-[11px] leading-relaxed ${hasBg ? "text-white/60" : "text-slate-400"}`}>
              Super Admin, Admin, Supervisor & Supplier — all sign in here.
              <br />
              {t("auth.accountsCreatedByAdmin")}
            </p>
          </div>
        </div>

        <p className={`mt-5 text-center text-[11px] ${hasBg ? "text-white/50" : "text-slate-400"}`}>
          Secured by Firebase Authentication · Data by Supabase
        </p>
      </div>
    </div>
  );
}

/** Convenience used by the Shell to render a logout control. */
export function logoutLabel(role: Role): string {
  return usesAdminShell(role) ? "Exit Admin Panel" : "Sign out";
}
