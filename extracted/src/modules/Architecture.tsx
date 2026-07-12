import { useEffect, useState } from "react";
import { Workflow, Database, Terminal, Rocket, GitBranch, Copy, ServerCog, CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";
import { PageHeader, Panel, Badge, IconChip, Segmented } from "@/components/ui";
import { pingSupabase, SUPABASE_META, supabaseConfigured } from "@/lib/supabase";

const TREE = `verda-tea-erp/
├─ index.html               # PWA shell, theme-color, fonts
├─ public/
│  ├─ manifest.json         # PWA manifest (installable)
│  ├─ icons/                # 192 / 512 maskable icons
│  └─ sw.ts                 # Workbox service worker (offline)
├─ src/
│  ├─ main.tsx              # React 19 entry
│  ├─ App.tsx               # Provider + adaptive Shell + router
│  ├─ index.css             # Tailwind v4 theme + design tokens
│  ├─ context/AppContext.tsx# role / online / sync-queue state
│  ├─ lib/
│  │  ├─ data.ts            # domain models + Firestore mirrors
│  │  ├─ predictive.ts      # deterministic decision engines
│  │  ├─ nav.ts             # adaptive nav registry
│  │  ├─ firebase.ts        # Firebase Auth (Phone OTP) + FCM only
│  │  ├─ supabase.ts        # Supabase (PostgreSQL) client — ERP data
│  │  ├─ auth.hybrid.ts     # Firebase uid ⇄ Supabase users mapping
│  │  ├─ repo.ts            # RBAC-enforced data access (Supabase)
│  │  └─ i18n/              # i18next · EN / SI / TA locales
│  ├─ components/           # ui, charts, Shell, QR, Icon, LanguageSwitcher
│  └─ modules/              # 20 ERP modules + role consoles (tri-lingual)
├─ app/                     # Expo (React Native) wrapper
│  ├─ app.config.js · eas.json
│  └─ App.tsx               # loads PWA bundle in WebView + FCM bridge
├─ docs/                    # supabase_schema.sql, HYBRID_MIGRATION.md
├─ .env.example             # Firebase + Supabase + Gemini keys
└─ vite.config.ts           # Vite + PWA + single-file`;

const SCHEMA = [
  { col: "users", fields: "id(==Firebase uid) PK, name, role, phone, associated_entity_id, status" },
  { col: "estates", fields: "name, region, total_area_ha, elevation_m → divisions" },
  { col: "divisions", fields: "estate_id FK, name, manager, area_ha → fields" },
  { col: "fields", fields: "division_id FK, code, cultivar, planting_year, area_ha, status" },
  { col: "harvest_records", fields: "supplier_id FK, estate_id FK, gross_kg, net_kg, grade, amount" },
  { col: "resource_requests", fields: "supplier_id FK, type, item_details, quantity, status" },
  { col: "fcm_tokens", fields: "user_id FK, token, platform (FCM device tokens)" },
  { col: "RLS", fields: "Supabase Row-Level Security mirrors src/lib/rbac.ts" },
];

const SETUP = `# 1. Install dependencies
npm install

# 2. Copy env template and fill keys
cp .env.example .env
#   VITE_FIREBASE_*    = Auth (Phone OTP) + FCM  (free)
#   VITE_SUPABASE_URL / _ANON_KEY = PostgreSQL ERP data
#   VITE_OW_API_KEY=...        # OpenWeatherMap
#   VITE_GEMINI_API_KEY=...    # optional (AI module only)
#   Then run docs/supabase_schema.sql in the Supabase SQL editor.

# 3. Run the dev server (PWA on :5173)
npm run dev

# 4. Build the production single-file bundle
npm run build && npm run preview`;

const DEPLOY = `# Netlify (zero-downtime)
npm i -g netlify-cli
netlify deploy --prod --dir=dist

# Vercel
npm i -g vercel
vercel --prod

# Both auto-detect Vite. Add SPA redirect:
# public/_redirects  →  /*  /index.html  200`;

const EAS = `# 1. Install Expo + EAS
npm i -g eas-cli
npx create-expo-app app --template blank

# 2. Login & link project
eas login
eas init            # creates expo project id

# 3. Configure eas.json (profile: preview = apk)
eas build:configure

# 4. Build a standalone APK in the cloud (no Android Studio)
eas build -p android --profile preview

# 5. Download the .apk from the provided URL
eas build:list --status finished`;

export default function Architecture() {
  const [tab, setTab] = useState<"structure" | "backend" | "firestore" | "setup" | "deploy" | "eas">("structure");

  return (
    <div>
      <PageHeader
        eyebrow="Platform Blueprint"
        title="Architecture & Manuals"
        desc="Project layout, Firestore schema and the local / deploy / EAS build runbooks — all in one place."
        icon={<IconChip icon={Workflow} tone="emerald" className="h-12 w-12" />}
      />

      <div className="mb-4 overflow-x-auto no-scrollbar">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "structure", label: "Folder", icon: <GitBranch className="h-3.5 w-3.5" /> },
            { value: "backend", label: "Backend", icon: <ServerCog className="h-3.5 w-3.5" /> },
            { value: "firestore", label: "Schema", icon: <Database className="h-3.5 w-3.5" /> },
            { value: "setup", label: "Local", icon: <Terminal className="h-3.5 w-3.5" /> },
            { value: "deploy", label: "Deploy", icon: <Rocket className="h-3.5 w-3.5" /> },
            { value: "eas", label: "EAS Mobile", icon: <Rocket className="h-3.5 w-3.5" /> },
          ]}
        />
      </div>

      {tab === "structure" && (
        <Panel title="Complete Project Structure" subtitle="Modular React + Vite PWA layout" icon={<IconChip icon={GitBranch} tone="emerald" className="h-9 w-9" />} action={<CopyChip />}>
          <pre className="overflow-x-auto rounded-xl bg-[#04231a] p-4 text-[11px] leading-relaxed text-emerald-200 no-scrollbar"><code>{TREE}</code></pre>
        </Panel>
      )}

      {tab === "backend" && <BackendPanel />}

      {tab === "firestore" && (
        <Panel title="Firestore Database Architecture" subtitle="Collections · fields · sub-collection refs" icon={<IconChip icon={Database} tone="sky" className="h-9 w-9" />}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {SCHEMA.map((s) => (
              <div key={s.col} className="rounded-xl border border-slate-100 p-3">
                <div className="flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-emerald-600" />
                  <code className="text-sm font-bold text-emerald-700">{s.col}/</code>
                </div>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-slate-500">{s.fields}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">Sub-collections use the <code className="rounded bg-slate-100 px-1 font-mono">parent/{`{id}`}/child</code> pattern. Security rules enforce role-scoped access (admin / supervisor / supplier).</p>
        </Panel>
      )}

      {tab === "setup" && (
        <Panel title="Local Initialization Checklist" subtitle="Get running in 4 commands" icon={<IconChip icon={Terminal} tone="emerald" className="h-9 w-9" />}>
          <pre className="overflow-x-auto rounded-xl bg-[#04231a] p-4 text-[11px] leading-relaxed text-emerald-200 no-scrollbar"><code>{SETUP}</code></pre>
        </Panel>
      )}

      {tab === "deploy" && (
        <Panel title="Web Deployment Manual" subtitle="Zero-downtime on Netlify / Vercel" icon={<IconChip icon={Rocket} tone="violet" className="h-9 w-9" />}>
          <pre className="overflow-x-auto rounded-xl bg-[#04231a] p-4 text-[11px] leading-relaxed text-emerald-200 no-scrollbar"><code>{DEPLOY}</code></pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="emerald">Single-file output</Badge>
            <Badge tone="sky">Atomic deploys</Badge>
            <Badge tone="violet">Edge CDN</Badge>
          </div>
        </Panel>
      )}

      {tab === "eas" && (
        <Panel title="EAS Cloud Build — Android APK" subtitle="No Android Studio required" icon={<IconChip icon={Rocket} tone="amber" className="h-9 w-9" />}>
          <pre className="overflow-x-auto rounded-xl bg-[#04231a] p-4 text-[11px] leading-relaxed text-emerald-200 no-scrollbar"><code>{EAS}</code></pre>
          <p className="mt-3 text-xs text-slate-400">Credentials are managed by EAS in the cloud (<code className="rounded bg-slate-100 px-1 font-mono">eas credentials</code>). The Expo shell simply wraps the built PWA in a WebView for native push + offline installability.</p>
        </Panel>
      )}
    </div>
  );
}

function CopyChip() {
  return (
    <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
      <Copy className="h-3 w-3" /> Copy
    </button>
  );
}

/** Live Supabase connection status for the connected KDU ERP project. */
function BackendPanel() {
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "fail">("idle");

  const run = async () => {
    setStatus("checking");
    const { ok } = await pingSupabase();
    setStatus(ok ? "ok" : "fail");
  };

  // Auto-check once on mount.
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tone = status === "ok" ? "emerald" : status === "fail" ? "rose" : "amber";

  const rows: [string, string][] = [
    ["Project", `${SUPABASE_META.projectName} (${SUPABASE_META.projectId})`],
    ["Region", SUPABASE_META.region],
    ["REST endpoint", SUPABASE_META.restUrl],
    ["Mode", supabaseConfigured ? "Hybrid · live (Firebase Auth + Supabase data)" : "Demo · mock fallback"],
  ];

  return (
    <Panel
      title="Backend Connection · Supabase"
      subtitle="KDU ERP — PostgreSQL business data + RLS"
      icon={<IconChip icon={ServerCog} tone="emerald" className="h-9 w-9" />}
      action={
        <button
          onClick={run}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <RefreshCw className={`h-3 w-3 ${status === "checking" ? "animate-spin" : ""}`} /> Test
        </button>
      }
    >
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
          {status === "ok" ? <CheckCircle2 className="h-5 w-5" /> : status === "fail" ? <AlertCircle className="h-5 w-5" /> : <ServerCog className="h-5 w-5" />}
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-800">
            {status === "ok" ? "Connected" : status === "fail" ? "Not reachable" : status === "checking" ? "Pinging project…" : "Verifying…"}
          </p>
          <p className="text-xs text-slate-400">Hybrid: Firebase Auth/FCM + Supabase PostgreSQL</p>
        </div>
        <Badge tone={tone} dot>{supabaseConfigured ? "Configured" : "Demo"}</Badge>
      </div>

      <div className="space-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between border-b border-slate-50 pb-2">
            <span className="text-slate-400">{k}</span>
            <span className="max-w-[60%] truncate font-mono text-xs text-slate-700">{v}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-700">
        <Database className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Run <code className="rounded bg-white px-1 font-mono">docs/supabase_schema.sql</code> in the Supabase SQL editor to create the ERP tables + RLS. The app
          {supabaseConfigured ? " is now reading/writing KDU ERP live." : " falls back to demo data until keys are present."}
        </span>
      </div>
    </Panel>
  );
}
