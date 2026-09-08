import { useEffect, useState } from "react";
import { Sprout, Save, Check, CalendarDays, TrendingUp, Trees, RefreshCw } from "lucide-react";
import { PageHeader, StatCard, Card, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { fmtNum } from "@/lib/data";
// (translation hook is not used here — all text is hard-coded for now)

/**
 * SupplierPlot — "My Plot" module (supplier side)
 * ------------------------------------------------------------------
 * Per Sir's Phase 1 spec #1 + #4:
 *   #1 — Acreage & Bush Count Management: තමන්ගේ වත්තේ අක්කර ගණන සහ තේ ගස් ගණන (Bush Count) Enter කිරීමේ පහසුකම.
 *   #4 — Auto Bush-Count Verification Prompt: මාස 6කට සැරයක් "Verify your bush count" Reminder.
 *
 * Each supplier enters their own plot acreage + bush count. The system:
 *   - Auto-calculates bushes/acre ratio (density)
 *   - Auto-calculates potential max yield (1500 kg green leaf/acre/year for low-country)
 *   - Shows a 6-month re-verify reminder banner
 *   - Saves to localStorage (Phase 1) — Phase 2 will sync to Supabase `supplier_plots` table
 */
const STORAGE_KEY = (userUid: string) => `kdu.supplier_plot.${userUid}`;

interface PlotSubField {
  id: string;
  code: string;            // e.g., "P-01"
  name: string;            // e.g., "Upper Plot"
  cultivar: string;        // e.g., "TRI 2025 (VP)"
  plantingYear: number;
  areaHa: number;
  bushCount: number;
  status: "plucking" | "pruned" | "young" | "nursery";
}

interface PlotData {
  acreage: number;
  bushCount: number;
  verifiedAt: string | null; // ISO timestamp of last verification
  cultivar?: string; // e.g. TRI 2025 (VP)
  region?: string; // low-country / mid-country / up-country
  lastUpdated?: string;
  // NEW (Sir's spec — suppliers create their own sub-fields like Estate Master):
  subFields?: PlotSubField[];
}

const DEFAULT_PLOT: PlotData = {
  acreage: 0,
  bushCount: 0,
  verifiedAt: null,
  subFields: [],
};

/** Yield per acre per year by region (kg green leaf) — Sri Lankan agronomy */
const YIELD_BY_REGION: Record<string, number> = {
  "low-country": 1500,
  "mid-country": 1100,
  "up-country": 800,
  "default": 1200,
};

export function SupplierPlot() {
  const { userUid, notify } = useApp();

  const [plot, setPlot] = useState<PlotData>(DEFAULT_PLOT);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form state (only used when editing)
  const [formAcreage, setFormAcreage] = useState(0);
  const [formBushCount, setFormBushCount] = useState(0);
  const [formCultivar, setFormCultivar] = useState("TRI 2025 (VP)");
  const [formRegion, setFormRegion] = useState<"low-country" | "mid-country" | "up-country">("low-country");

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(userUid));
      if (raw) {
        const data = JSON.parse(raw) as PlotData;
        setPlot(data);
        setFormAcreage(data.acreage);
        setFormBushCount(data.bushCount);
        setFormCultivar(data.cultivar ?? "TRI 2025 (VP)");
        setFormRegion((data.region as any) ?? "low-country");
      }
    } catch { /* ignore */ }
  }, [userUid]);

  const persist = (next: PlotData) => {
    setPlot(next);
    try { localStorage.setItem(STORAGE_KEY(userUid), JSON.stringify(next)); } catch { /* ignore */ }
  };

  const save = () => {
    if (formAcreage < 0 || formBushCount < 0) {
      notify({ title: "Invalid input", body: "Acreage + bush count cannot be negative.", tone: "rose", channel: "system" });
      return;
    }
    setBusy(true);
    const now = new Date().toISOString();
    const next: PlotData = {
      acreage: formAcreage,
      bushCount: formBushCount,
      verifiedAt: now, // saving also marks verification
      cultivar: formCultivar,
      region: formRegion,
      lastUpdated: now,
    };
    persist(next);
    setBusy(false);
    setEditing(false);
    notify({
      title: "Plot details saved ✅",
      body: `${formAcreage} acres · ${fmtNum(formBushCount)} bushes · bush count verified today.`,
      tone: "emerald",
      channel: "system",
    });
  };

  const verifyNow = () => {
    const now = new Date().toISOString();
    persist({ ...plot, verifiedAt: now, lastUpdated: now });
    notify({
      title: "Bush count verified ✅",
      body: "Today's date marked as the new verified snapshot. Next reminder in 6 months.",
      tone: "emerald",
      channel: "system",
    });
  };

  // NEW (Sir's spec): Sub-field management — like admin's Estate Master but for the supplier's own plot.
  // Suppliers can divide their plot into sub-sections (e.g., "Upper Plot", "Lower Plot") and
  // track per-section bush count + area + cultivar. The plot's total acreage + bush count
  // are auto-aggregated from sub-fields when present (overriding manual entry).
  const [showSubFieldForm, setShowSubFieldForm] = useState(false);
  const [editingSubFieldId, setEditingSubFieldId] = useState<string | null>(null);
  const [subCode, setSubCode] = useState("P-01");
  const [subName, setSubName] = useState("");
  const [subCultivar, setSubCultivar] = useState("TRI 2025 (VP)");
  const [subYear, setSubYear] = useState(new Date().getFullYear());
  const [subAreaHa, setSubAreaHa] = useState(0);
  const [subBush, setSubBush] = useState(0);
  const [subStatus, setSubStatus] = useState<PlotSubField["status"]>("plucking");

  const startAddSubField = () => {
    setEditingSubFieldId(null);
    setSubCode(`P-${String((plot.subFields?.length ?? 0) + 1).padStart(2, "0")}`);
    setSubName("");
    setSubCultivar(plot.cultivar ?? "TRI 2025 (VP)");
    setSubYear(new Date().getFullYear());
    setSubAreaHa(0);
    setSubBush(0);
    setSubStatus("plucking");
    setShowSubFieldForm(true);
  };

  const startEditSubField = (sf: PlotSubField) => {
    setEditingSubFieldId(sf.id);
    setSubCode(sf.code);
    setSubName(sf.name);
    setSubCultivar(sf.cultivar);
    setSubYear(sf.plantingYear);
    setSubAreaHa(sf.areaHa);
    setSubBush(sf.bushCount);
    setSubStatus(sf.status);
    setShowSubFieldForm(true);
  };

  const saveSubField = () => {
    if (!subName.trim() || subAreaHa <= 0) {
      notify({ title: "Missing fields", body: "Sub-field name + area are required", tone: "rose", channel: "system" });
      return;
    }
    const newSf: PlotSubField = {
      id: editingSubFieldId ?? `sf-${Date.now()}`,
      code: subCode.trim() || `P-${String((plot.subFields?.length ?? 0) + 1).padStart(2, "0")}`,
      name: subName.trim(),
      cultivar: subCultivar,
      plantingYear: subYear,
      areaHa: subAreaHa,
      bushCount: subBush,
      status: subStatus,
    };
    const existing = plot.subFields ?? [];
    const updated = editingSubFieldId
      ? existing.map(sf => sf.id === editingSubFieldId ? newSf : sf)
      : [...existing, newSf];

    // Auto-aggregate plot totals from sub-fields (in hectares → acres conversion)
    const totalHa = updated.reduce((s, sf) => s + sf.areaHa, 0);
    const totalBush = updated.reduce((s, sf) => s + sf.bushCount, 0);
    const now = new Date().toISOString();
    const next: PlotData = {
      ...plot,
      subFields: updated,
      // Auto-update acreage + bush count from sub-fields (when present)
      acreage: +(totalHa * 2.471).toFixed(2),  // ha → acres
      bushCount: totalBush,
      lastUpdated: now,
    };
    persist(next);
    setShowSubFieldForm(false);
    setEditingSubFieldId(null);
    notify({
      title: editingSubFieldId ? "Sub-field updated ✅" : "Sub-field added ✅",
      body: `${newSf.name} (${newSf.areaHa} ha, ${fmtNum(newSf.bushCount)} bushes). Plot totals auto-updated.`,
      tone: "emerald",
      channel: "system",
    });
  };

  const deleteSubField = (id: string) => {
    const updated = (plot.subFields ?? []).filter(sf => sf.id !== id);
    const totalHa = updated.reduce((s, sf) => s + sf.areaHa, 0);
    const totalBush = updated.reduce((s, sf) => s + sf.bushCount, 0);
    const next: PlotData = {
      ...plot,
      subFields: updated,
      acreage: updated.length > 0 ? +(totalHa * 2.471).toFixed(2) : plot.acreage,
      bushCount: updated.length > 0 ? totalBush : plot.bushCount,
      lastUpdated: new Date().toISOString(),
    };
    persist(next);
  };

  // Calculations
  const bushesPerAcre = plot.acreage > 0 ? Math.round(plot.bushCount / plot.acreage) : 0;
  const expectedYieldKgPerYear = plot.acreage > 0
    ? Math.round(plot.acreage * (YIELD_BY_REGION[plot.region ?? "default"] ?? YIELD_BY_REGION.default))
    : 0;
  const expectedMonthlyKg = Math.round(expectedYieldKgPerYear / 12);

  // 6-month staleness check
  const now = Date.now();
  const SIX_MONTHS_MS = 6 * 30 * 86400_000;
  const lastDate = plot.verifiedAt ? new Date(plot.verifiedAt) : null;
  const isStale = !lastDate || (now - lastDate.getTime()) > SIX_MONTHS_MS;
  const monthsAgo = lastDate ? Math.floor((now - lastDate.getTime()) / (30 * 86400_000)) : null;

  return (
    <div>
      <PageHeader
        eyebrow="VVIP Supplier Portal"
        title="My Plot"
        desc="Track your tea plot acreage + bush count. The system reminds you every 6 months to re-verify the bush count (since plants die or get replanted). Auto-calculates potential yield."
        icon={<IconChip icon={Sprout} tone="emerald" className="h-12 w-12" />}
      />

      {/* 6-month bush count re-verification reminder */}
      {isStale && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800">
          <p className="flex items-center gap-1.5 text-sm font-bold mb-1">
            <RefreshCw className="h-4 w-4" /> 🌳 Bush count re-verification due
          </p>
          <p className="text-xs leading-relaxed">
            {monthsAgo === null
              ? "Bush count has never been verified. Set your plot details below and verify it now."
              : `Last verified ${monthsAgo} month(s) ago. Plants may have died or been replanted — please re-count.`}
            {" "}Tap "Verify Now" to mark today's date as the new verified snapshot.
          </p>
          <div className="mt-2 flex gap-2">
            {plot.bushCount > 0 && (
              <button
                onClick={verifyNow}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 inline-flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" /> Verify Now
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-amber-600 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              Edit Plot Details
            </button>
          </div>
        </div>
      )}

      {/* Stats overview */}
      {plot.acreage > 0 && !editing && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Sprout} label="Acreage" value={`${plot.acreage}`} sub="acres" tone="emerald" />
          <StatCard icon={Trees} label="Bush Count" value={fmtNum(plot.bushCount)} sub="bushes" tone="sky" />
          <StatCard icon={TrendingUp} label="Bushes / Acre" value={fmtNum(bushesPerAcre)} sub="density" tone="violet" />
          <StatCard icon={CalendarDays} label="Last Verified" value={lastDate ? lastDate.toLocaleDateString() : "—"} sub={monthsAgo !== null ? `${monthsAgo}m ago` : "never"} tone={isStale ? "rose" : "amber"} />
        </div>
      )}

      {/* Yield prediction */}
      {plot.acreage > 0 && !editing && (
        <Card className="mt-4 p-4">
          <h3 className="font-display text-sm font-bold text-slate-800 mb-2">📊 Yield Potential ({{ "low-country": "Low-Country", "mid-country": "Mid-Country", "up-country": "Up-Country" }[plot.region ?? "default"] || "Default"})</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-[11px] text-emerald-700 font-semibold">Expected Annual Yield</p>
              <p className="text-2xl font-extrabold text-emerald-700 tnum">{fmtNum(expectedYieldKgPerYear)} kg</p>
              <p className="text-[10px] text-emerald-600">green leaf per year</p>
            </div>
            <div className="rounded-lg bg-sky-50 p-3">
              <p className="text-[11px] text-sky-700 font-semibold">Monthly Average</p>
              <p className="text-2xl font-extrabold text-sky-700 tnum">{fmtNum(expectedMonthlyKg)} kg</p>
              <p className="text-[10px] text-sky-600">green leaf per month</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            * Yield estimates based on Sri Lankan tea agronomy: low-country ~1,500 kg/acre/year, mid-country ~1,100 kg/acre/year, up-country ~800 kg/acre/year. Actual yield depends on fertilizer, pruning cycles, and weather.
          </p>
        </Card>
      )}

      {/* Edit form */}
      {(editing || plot.acreage === 0) && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">
            {plot.acreage === 0 ? "Enter Your Plot Details" : "Edit Plot Details"}
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">Acreage (acres)</label>
                <input
                  type="number" min={0} step="any" value={formAcreage || ""}
                  onChange={e => setFormAcreage(+e.target.value)}
                  placeholder="e.g. 2.5"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Bush Count (total tea bushes)</label>
                <input
                  type="number" min={0} value={formBushCount || ""}
                  onChange={e => setFormBushCount(+e.target.value)}
                  placeholder="e.g. 5400"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">Cultivar (tea variety)</label>
                <select
                  value={formCultivar}
                  onChange={e => setFormCultivar(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm"
                >
                  <option value="TRI 2025 (VP)">TRI 2025 (VP)</option>
                  <option value="TRI 2023 (VP)">TRI 2023 (VP)</option>
                  <option value="TRI 2024 (VP)">TRI 2024 (VP)</option>
                  <option value="Seedling">Seedling</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Region (drives yield estimate)</label>
                <select
                  value={formRegion}
                  onChange={e => setFormRegion(e.target.value as any)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm"
                >
                  <option value="low-country">Low-Country (පහතරට) — ~1,500 kg/acre</option>
                  <option value="mid-country">Mid-Country (මැදරට) — ~1,100 kg/acre</option>
                  <option value="up-country">Up-Country (ඉහළරට) — ~800 kg/acre</option>
                </select>
              </div>
            </div>
            {formAcreage > 0 && formBushCount > 0 && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-700">
                <strong>{fmtNum(Math.round(formBushCount / formAcreage))}</strong> bushes/acre density
                · Expected yield: <strong>{fmtNum(Math.round(formAcreage * (YIELD_BY_REGION[formRegion] ?? YIELD_BY_REGION.default)))} kg/year</strong>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={busy}
                className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                <Save className="h-3.5 w-3.5" /> Save & Verify
              </button>
              {plot.acreage > 0 && (
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500"
                >
                  Cancel
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Phase 1: saved to browser localStorage. Phase 2 will sync to Supabase + send FCM reminder 6 months from now.
            </p>
          </div>
        </Card>
      )}

      {/* Show saved details (when not editing) */}
      {plot.acreage > 0 && !editing && (
        <Card className="mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-800">Plot Details</h3>
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-emerald-600 hover:underline"
            >
              Edit
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-[11px] text-slate-400">Acreage</dt><dd className="font-semibold text-slate-800 tnum">{plot.acreage} acres</dd></div>
            <div><dt className="text-[11px] text-slate-400">Bush Count</dt><dd className="font-semibold text-slate-800 tnum">{fmtNum(plot.bushCount)} bushes</dd></div>
            <div><dt className="text-[11px] text-slate-400">Cultivar</dt><dd className="font-semibold text-slate-800">{plot.cultivar ?? "—"}</dd></div>
            <div><dt className="text-[11px] text-slate-400">Region</dt><dd className="font-semibold text-slate-800 capitalize">{plot.region?.replace("-", " ") ?? "—"}</dd></div>
            <div><dt className="text-[11px] text-slate-400">Verified At</dt><dd className="font-semibold text-slate-800">{lastDate ? lastDate.toLocaleDateString() : "—"}</dd></div>
            <div><dt className="text-[11px] text-slate-400">Last Updated</dt><dd className="font-semibold text-slate-800">{plot.lastUpdated ? new Date(plot.lastUpdated).toLocaleDateString() : "—"}</dd></div>
          </dl>
        </Card>
      )}

      {/* NEW (Sir's spec — supplier-side estate management):
          Sub-fields management — suppliers can divide their plot into sub-sections
          (like admin's Estate Master but for the supplier's own plot). Each sub-field
          has its own area + bush count + cultivar. Plot totals auto-aggregate. */}
      {plot.acreage > 0 && !editing && (
        <Card className="mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-800">Plot Sub-Fields / Sections</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Divide your plot into sub-sections (e.g., Upper Plot, Lower Plot) to track each section separately.
                Plot totals auto-aggregate from sub-fields.
              </p>
            </div>
            <button
              onClick={startAddSubField}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
            >
              + Add Sub-Field
            </button>
          </div>

          {/* Sub-fields list */}
          {(plot.subFields?.length ?? 0) > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Cultivar</th>
                    <th className="pb-2 text-right">Area (ha)</th>
                    <th className="pb-2 text-right">Bushes</th>
                    <th className="pb-2 text-center">Status</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {plot.subFields!.map(sf => (
                    <tr key={sf.id} className="border-t border-slate-100">
                      <td className="py-2 font-mono text-xs">{sf.code}</td>
                      <td className="py-2 font-semibold text-slate-800">{sf.name}</td>
                      <td className="py-2 text-slate-600">{sf.cultivar}</td>
                      <td className="py-2 text-right tnum">{sf.areaHa}</td>
                      <td className="py-2 text-right tnum">{fmtNum(sf.bushCount)}</td>
                      <td className="py-2 text-center">
                        <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
                          sf.status === "plucking" ? "bg-emerald-100 text-emerald-700"
                          : sf.status === "pruned" ? "bg-amber-100 text-amber-700"
                          : sf.status === "young" ? "bg-sky-100 text-sky-700"
                          : "bg-violet-100 text-violet-700"
                        }`}>
                          {sf.status}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <button onClick={() => startEditSubField(sf)} className="text-xs text-emerald-600 hover:underline mr-2">Edit</button>
                        <button onClick={() => deleteSubField(sf.id)} className="text-xs text-rose-500 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200">
                    <td colSpan={3} className="py-2 text-right text-xs font-semibold text-slate-600">Total</td>
                    <td className="py-2 text-right tnum font-bold text-slate-800">{(plot.subFields ?? []).reduce((s, sf) => s + sf.areaHa, 0).toFixed(2)} ha</td>
                    <td className="py-2 text-right tnum font-bold text-slate-800">{fmtNum((plot.subFields ?? []).reduce((s, sf) => s + sf.bushCount, 0))}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-slate-400">
              No sub-fields yet. Add sub-fields to track different sections of your plot separately.
            </p>
          )}

          {/* Add/Edit sub-field form */}
          {showSubFieldForm && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h4 className="mb-2 text-sm font-bold text-slate-800">
                {editingSubFieldId ? "Edit Sub-Field" : "Add Sub-Field"}
              </h4>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[11px] text-slate-400">Code</label>
                  <input value={subCode} onChange={e => setSubCode(e.target.value)} placeholder="P-01" className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Name *</label>
                  <input value={subName} onChange={e => setSubName(e.target.value)} placeholder="e.g., Upper Plot" className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Cultivar</label>
                  <select value={subCultivar} onChange={e => setSubCultivar(e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs">
                    <option value="TRI 2025 (VP)">TRI 2025 (VP)</option>
                    <option value="TRI 2023 (VP)">TRI 2023 (VP)</option>
                    <option value="TRI 2024 (VP)">TRI 2024 (VP)</option>
                    <option value="Seedling">Seedling</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Planting Year</label>
                  <input type="number" value={subYear} onChange={e => setSubYear(+e.target.value)} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs tnum" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Area (ha) *</label>
                  <input type="number" step="any" min={0} value={subAreaHa || ""} onChange={e => setSubAreaHa(+e.target.value)} placeholder="0.5" className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs tnum" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Bush Count</label>
                  <input type="number" min={0} value={subBush || ""} onChange={e => setSubBush(+e.target.value)} placeholder="1200" className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs tnum" />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-slate-400">Status</label>
                  <select value={subStatus} onChange={e => setSubStatus(e.target.value as PlotSubField["status"])} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-xs">
                    <option value="plucking">Plucking</option>
                    <option value="pruned">Pruned</option>
                    <option value="young">Young</option>
                    <option value="nursery">Nursery</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveSubField}
                  className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:brightness-110"
                >
                  {editingSubFieldId ? "Update" : "Add"}
                </button>
                <button
                  onClick={() => { setShowSubFieldForm(false); setEditingSubFieldId(null); }}
                  className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                * Adding sub-fields auto-updates your plot's total acreage + bush count.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
