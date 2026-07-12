import { useEffect, useState } from "react";
import { Palette, Save, RotateCcw, Building2, LogIn, ImageIcon, Type, Check, Eye, Cloud, ShieldAlert, Loader2 } from "lucide-react";
import { PageHeader, Card, Badge, IconChip } from "@/components/ui";
import { useBranding, DEFAULT_BRANDING, isMediaUrl, isVideoUrl } from "@/lib/branding";
import { useApp } from "@/context/AppContext";

/**
 * Branding & Settings — Super Admin ONLY (capability: settings.manage).
 * ------------------------------------------------------------------
 * Edit the company logo, name texts, login page logo, background image/video,
 * and accent color. All media fields accept a Cloudinary (or any CDN) URL.
 * Changes persist instantly (localStorage) and apply across the whole app.
 */
export default function Settings() {
  const { branding, setBranding, resetBranding, source, saving, syncError } = useBranding();
  const { notify } = useApp();

  // local draft so we can preview-save explicitly
  const [draft, setDraft] = useState(branding);

  // Keep the draft in sync if the canonical branding changes (e.g. DB sync).
  useEffect(() => {
    setDraft(branding);
  }, [branding]);

  const update = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const save = async () => {
    const ok = await setBranding(draft);
    if (ok) {
      notify({ title: "Branding saved to database ✅", body: "Your changes are live across ALL devices & users.", tone: "emerald", channel: "system" });
    } else {
      notify({ title: "Save failed", body: syncError ?? "Could not write to the database.", tone: "rose", channel: "system" });
    }
  };

  const reset = async () => {
    setDraft(DEFAULT_BRANDING);
    const ok = await resetBranding();
    notify({ title: ok ? "Branding reset" : "Reset failed", body: ok ? "Restored to default Verda branding." : syncError ?? "DB error", tone: ok ? "amber" : "rose", channel: "system" });
  };

  const inputCls = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm";
  const labelCls = "text-[11px] font-medium text-slate-400";

  return (
    <div>
      <PageHeader
        eyebrow="Super Admin · Administration"
        title="Branding & Settings"
        desc="White-label the platform: company logo, name texts, login page, background media. Paste Cloudinary URLs for images/video."
        icon={<IconChip icon={Palette} tone="emerald" className="h-12 w-12" />}
        actions={
          <div className="flex flex-col items-end gap-1.5">
            <Badge tone={source === "database" ? "emerald" : source === "cache" ? "amber" : "slate"} dot>
              {source === "database" ? "💾 Saved in database" : source === "cache" ? "Cached locally" : "Default (unsaved)"}
            </Badge>
            {syncError && <span className="text-[10px] font-semibold text-rose-600">⚠ {syncError}</span>}
            <Badge tone="emerald" dot>Super Admin</Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* LEFT: edit forms */}
        <div className="space-y-4 lg:col-span-2">
          {/* Company / Shell branding */}
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" />
              <h3 className="font-display text-sm font-bold text-slate-800">Company / App Shell</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MediaField label="Company Logo URL" icon={ImageIcon} hint="Cloudinary image. Shown in app headers. Empty = default leaf badge." value={draft.companyLogoUrl} onChange={(v) => update("companyLogoUrl", v)} inputCls={inputCls} labelCls={labelCls} preview="logo" />
              <div className="sm:col-span-1">
                <label className={labelCls}>Company Name</label>
                <input value={draft.companyName} onChange={(e) => update("companyName", e.target.value)} className={inputCls} placeholder="Verda" />
              </div>
              <div className="sm:col-span-1">
                <label className={labelCls}>Tagline</label>
                <input value={draft.companyTagline} onChange={(e) => update("companyTagline", e.target.value)} className={inputCls} placeholder="Tea Estate ERP" />
              </div>
            </div>
          </Card>

          {/* Login page branding */}
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <LogIn className="h-4 w-4 text-emerald-600" />
              <h3 className="font-display text-sm font-bold text-slate-800">Login Page</h3>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}><Type className="mr-1 inline h-3 w-3" />Login Title</label>
                <input value={draft.loginTitle} onChange={(e) => update("loginTitle", e.target.value)} className={inputCls} placeholder="Verda ERP" />
              </div>
              <div>
                <label className={labelCls}><Type className="mr-1 inline h-3 w-3" />Login Subtitle</label>
                <input value={draft.loginSubtitle} onChange={(e) => update("loginSubtitle", e.target.value)} className={inputCls} placeholder="Integrated Tea Estate Platform" />
              </div>
              <MediaField label="Login Logo URL" icon={ImageIcon} hint="Cloudinary image. The hero logo on the login card. Empty = default leaf badge." value={draft.loginLogoUrl} onChange={(v) => update("loginLogoUrl", v)} inputCls={inputCls} labelCls={labelCls} preview="logo" />
              <MediaField label="Login Background Image / Video URL" icon={ImageIcon} hint="Cloudinary image or .mp4 video. A dark scrim auto-applies so text stays readable." value={draft.loginBackgroundUrl} onChange={(v) => update("loginBackgroundUrl", v)} inputCls={inputCls} labelCls={labelCls} preview="bg" video={isVideoUrl(draft.loginBackgroundUrl)} />
              <div className="sm:col-span-2">
                <label className={labelCls}>Text Readability Scrim: {draft.loginScrimOpacity}%</label>
                <input type="range" min={0} max={100} value={draft.loginScrimOpacity} onChange={(e) => update("loginScrimOpacity", Number(e.target.value))} className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-600" />
                <p className="mt-1 text-[11px] text-slate-400">Higher = darker overlay over the background image, so white text stays crisp. Recommended 60–85%.</p>
              </div>
            </div>
          </Card>

          {/* Accent color */}
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Palette className="h-4 w-4 text-emerald-600" />
              <h3 className="font-display text-sm font-bold text-slate-800">Accent Color</h3>
            </div>
            <div className="flex items-center gap-3">
              <input type="color" value={draft.accentColor} onChange={(e) => update("accentColor", e.target.value)} className="h-10 w-16 cursor-pointer rounded-lg border border-slate-200" />
              <input value={draft.accentColor} onChange={(e) => update("accentColor", e.target.value)} className={inputCls + " max-w-[140px]"} placeholder="#10b981" />
              <p className="text-xs text-slate-400">Used for buttons & highlights across the app.</p>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition enabled:hover:brightness-110 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : source === "database" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving to database…" : source === "database" ? "Saved to database ✓" : "Save branding"}
            </button>
            <button onClick={reset} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 disabled:opacity-60">
              <RotateCcw className="h-4 w-4" /> Reset to default
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            {syncError
              ? `⚠ ${syncError}`
              : source === "database"
                ? "✓ Persisted to the Supabase database — shared across ALL devices & users."
                : "After editing, click “Save branding”. It saves to the database (shared everywhere)."}
          </p>
        </div>

        {/* RIGHT: live preview */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-600" />
              <h3 className="font-display text-sm font-bold text-slate-800">Live Preview</h3>
            </div>
            {/* Login preview */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200" style={{ aspectRatio: "9 / 16", maxHeight: 420 }}>
              {draft.loginBackgroundUrl && isMediaUrl(draft.loginBackgroundUrl) ? (
                isVideoUrl(draft.loginBackgroundUrl) ? (
                  <video src={draft.loginBackgroundUrl} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <img src={draft.loginBackgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-700" />
              )}
              {/* readability scrim */}
              <div className="absolute inset-0 bg-black" style={{ opacity: draft.loginScrimOpacity / 100 }} />
              {/* content */}
              <div className="relative flex h-full flex-col items-center justify-center gap-3 p-5 text-center text-white">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                  {draft.loginLogoUrl && isMediaUrl(draft.loginLogoUrl) ? (
                    <img src={draft.loginLogoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <Leaf className="h-7 w-7" />
                  )}
                </div>
                <h2 className="font-display text-xl font-extrabold drop-shadow">{draft.loginTitle || "Verda ERP"}</h2>
                <p className="text-xs text-white/80 drop-shadow">{draft.loginSubtitle}</p>
                <div className="mt-2 w-full max-w-[160px] rounded-lg px-3 py-2 text-center text-[11px] font-semibold text-white shadow" style={{ background: draft.accentColor }}>
                  Sign in
                </div>
              </div>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">Login screen preview</p>

            {/* Shell header preview */}
            <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-emerald-950 px-3 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                {draft.companyLogoUrl && isMediaUrl(draft.companyLogoUrl) ? (
                  <img src={draft.companyLogoUrl} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <Leaf className="h-4 w-4 text-white" />
                )}
              </span>
              <div className="leading-tight">
                <p className="font-display text-sm font-bold text-white">{draft.companyName || "Verda"}</p>
                <p className="text-[9px] text-emerald-300/80">{draft.companyTagline}</p>
              </div>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-slate-400">App header preview</p>
          </Card>

          {/* Cloudinary hint */}
          <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
            <div className="mb-1 flex items-center gap-2">
              <Cloud className="h-4 w-4 text-sky-600" />
              <p className="text-xs font-bold text-sky-800">Using Cloudinary?</p>
            </div>
            <p className="text-[11px] leading-relaxed text-sky-700">
              Upload your image/video at <span className="font-mono">cloudinary.com</span>, open the asset → copy the <strong>secure URL</strong> (looks like <span className="font-mono">https://res.cloudinary.com/…</span>) → paste it into the fields above.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-xs text-amber-700">
          This screen is restricted to <strong>Super Admin</strong> only. Branding is stored locally (and would sync to a Supabase <code className="rounded bg-white px-1 font-mono">settings</code> table in production). All changes apply instantly across the login screen and app shell.
        </p>
      </div>
    </div>
  );
}

/* ----------------------------- media field ----------------------------- */

function Leaf({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C3 8 9.5 5 17 8z" />
    </svg>
  );
}

function MediaField({
  label,
  icon: Icon,
  hint,
  value,
  onChange,
  inputCls,
  labelCls,
  preview,
  video,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  inputCls: string;
  labelCls: string;
  preview: "logo" | "bg";
  video?: boolean;
}) {
  const valid = value && isMediaUrl(value);
  return (
    <div className="sm:col-span-2">
      <label className={labelCls}>
        <Icon className="mr-1 inline h-3 w-3" />
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder="https://res.cloudinary.com/..." />
        {valid && preview === "logo" && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200">
            <img src={value} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{hint}</p>
      {valid && video && <Badge tone="sky" className="mt-1">📹 Video detected</Badge>}
    </div>
  );
}
