import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sprout, Scissors, Package, Plus, Loader2, Check, CalendarDays, History } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { useLiveData } from "@/lib/useLiveData";
import { recordFarmActivity, readFarmActivities } from "@/lib/repo";
import { TODAY_ISO, type FarmActivity, type FarmActivityType } from "@/lib/data";

const TABS: { id: FarmActivityType; label: string; icon: typeof Sprout; tone: "emerald" | "amber" | "sky" }[] = [
  { id: "fertilizer", label: "Fertilizer", icon: Sprout, tone: "emerald" },
  { id: "pruning", label: "Pruning", icon: Scissors, tone: "amber" },
  { id: "self_harvest", label: "Self-Harvest", icon: Package, tone: "sky" },
];

const FERT_TYPES = ["Urea (46% N)", "MOP (Potash)", "TSP (Phosphate)", "Dolomite", "Organic Compost"];
const PRUNE_TYPES = ["formative", "light", "medium", "deep", "skiffing"];
const GRADES = ["Super", "Standard", "Coarse"];

/**
 * My Farm Activities — the feedback loop for the Smart Advisory Engine.
 *
 * Suppliers log real field actions here. The advisory engine reads the LATEST
 * record of each type to recompute recommendations dynamically.
 */
export function FarmActivities() {
  const { t } = useTranslation();
  const { userUid } = useApp();
  const [tab, setTab] = useState<FarmActivityType>("fertilizer");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live activity history (real-time).
  const { data: history } = useLiveData<FarmActivity>("farm_activities", () => readFarmActivities(userUid), `user_id=eq.${userUid}`);

  // ---- shared form state ----
  const [date, setDate] = useState(TODAY_ISO);
  // fertilizer
  const [fertType, setFertType] = useState(FERT_TYPES[0]);
  const [fertQty, setFertQty] = useState(50);
  // pruning
  const [pruneType, setPruneType] = useState<string>(PRUNE_TYPES[3]);
  const [pruneArea, setPruneArea] = useState(1);
  // self-harvest
  const [field, setField] = useState("");
  const [kg, setKg] = useState(100);
  const [grade, setGrade] = useState(GRADES[0]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      let details: Record<string, unknown> = {};
      if (tab === "fertilizer") details = { type: fertType, quantityKg: fertQty };
      else if (tab === "pruning") details = { type: pruneType, areaHa: pruneArea };
      else details = { field: field.trim() || "—", estimatedKg: kg, grade };

      await recordFarmActivity(userUid, tab, date, details);
      setDone(true);
      window.setTimeout(() => setDone(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save activity.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm";
  const labelCls = "text-[11px] font-medium text-slate-400";

  return (
    <div>
      <PageHeader
        eyebrow="VVIP Supplier Portal"
        title={t("farm.title")}
        desc={t("farm.desc")}
        icon={<IconChip icon={Sprout} tone="emerald" className="h-12 w-12" />}
      />

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard icon={Sprout} label={t("farm.fertilizerLogs")} value={String(history.filter((h) => h.activityType === "fertilizer").length)} tone="emerald" />
        <StatCard icon={Scissors} label={t("farm.pruningLogs")} value={String(history.filter((h) => h.activityType === "pruning").length)} tone="amber" />
        <StatCard icon={Package} label={t("farm.harvestLogs")} value={String(history.filter((h) => h.activityType === "self_harvest").length)} tone="sky" />
      </div>

      {/* Tabs */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setDone(false); setError(null); }}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition ${active ? "border-emerald-300 bg-emerald-50" : "border-slate-100 bg-white"}`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-emerald-600" : "text-slate-400"}`} />
              <span className={`text-[11px] font-semibold ${active ? "text-emerald-700" : "text-slate-500"}`}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic form */}
      <Card className="mt-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}><CalendarDays className="mr-1 inline h-3 w-3" />Activity Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>

          {tab === "fertilizer" && (
            <>
              <div className="col-span-2">
                <label className={labelCls}>Fertilizer Type</label>
                <select value={fertType} onChange={(e) => setFertType(e.target.value)} className={inputCls}>
                  {FERT_TYPES.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Quantity (kg)</label>
                <input type="number" value={fertQty} onChange={(e) => setFertQty(+e.target.value)} className={`${inputCls} tnum`} />
              </div>
            </>
          )}

          {tab === "pruning" && (
            <>
              <div className="col-span-2">
                <label className={labelCls}>Pruning Type</label>
                <select value={pruneType} onChange={(e) => setPruneType(e.target.value)} className={inputCls}>
                  {PRUNE_TYPES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Area Covered (ha)</label>
                <input type="number" step="0.1" value={pruneArea} onChange={(e) => setPruneArea(+e.target.value)} className={`${inputCls} tnum`} />
              </div>
            </>
          )}

          {tab === "self_harvest" && (
            <>
              <div>
                <label className={labelCls}>Field / Block</label>
                <input value={field} onChange={(e) => setField(e.target.value)} placeholder="e.g. S-01" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Grade</label>
                <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputCls}>
                  {GRADES.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Estimated Weight (kg)</label>
                <input type="number" value={kg} onChange={(e) => setKg(+e.target.value)} className={`${inputCls} tnum`} />
              </div>
            </>
          )}
        </div>

        {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}

        <button
          onClick={save}
          disabled={busy}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition enabled:hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : done ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          {done ? t("farm.logged") : busy ? t("farm.saving") : t("farm.logActivity")}
        </button>
      </Card>

      {/* Recent activity history */}
      <Card className="mt-4 p-4">
        <div className="mb-2 flex items-center gap-2">
          <History className="h-4 w-4 text-slate-400" />
          <h3 className="font-display text-sm font-bold text-slate-800">Recent Activities</h3>
        </div>
        {history.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">{t("farm.noActivities")}</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 8).map((a) => {
              const Icon = TABS.find((t) => t.id === a.activityType)?.icon ?? Package;
              const summary =
                a.activityType === "fertilizer"
                  ? `${(a.details as { type?: string }).type ?? "—"} · ${(a.details as { quantityKg?: number }).quantityKg ?? 0} kg`
                  : a.activityType === "pruning"
                    ? `${(a.details as { type?: string }).type ?? "—"} prune · ${(a.details as { areaHa?: number }).areaHa ?? 0} ha`
                    : `${(a.details as { estimatedKg?: number }).estimatedKg ?? 0} kg · ${(a.details as { grade?: string }).grade ?? "—"}`;
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold capitalize text-slate-700">{a.activityType.replace("_", "-")}</p>
                    <p className="text-[11px] text-slate-400">{summary}</p>
                  </div>
                  <Badge tone="slate">{a.loggedDate}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
