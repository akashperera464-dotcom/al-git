import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sprout, Scissors, Package, Plus, Loader2, Check, CalendarDays, History } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { useLiveData } from "@/lib/useLiveData";
import { recordFarmActivity, readFarmActivities } from "@/lib/repo";
import { TODAY_ISO, type FarmActivity, type FarmActivityType } from "@/lib/data";

const TAB_KEYS = [
  { id: "fertilizer", labelKey: "farm.fertilizer", icon: Sprout, tone: "emerald" },
  { id: "pruning", labelKey: "farm.pruning", icon: Scissors, tone: "amber" },
  { id: "self_harvest", labelKey: "farm.selfHarvest", icon: Package, tone: "sky" },
] as const;

const FERT_TYPE_KEYS = ["farm.fertUrea", "farm.fertMop", "farm.fertTsp", "farm.fertDolomite", "farm.fertCompost"] as const;
const PRUNE_TYPES = ["formative", "light", "medium", "deep", "skiffing"];
const PRUNE_TYPE_KEYS = ["farm.formative", "farm.light", "farm.medium", "farm.deep", "farm.skiffing"] as const;
const GRADE_KEYS = ["farm.gradeSuper", "farm.gradeStandard", "farm.gradeCoarse"] as const;

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
  const [fertType, setFertType] = useState(0);  // index into FERT_TYPE_KEYS
  const [fertQty, setFertQty] = useState(50);
  // pruning
  const [pruneType, setPruneType] = useState<string>(PRUNE_TYPES[3]);
  const [pruneArea, setPruneArea] = useState(1);
  // self-harvest
  const [field, setField] = useState("");
  const [kg, setKg] = useState(100);
  const [gradeIdx, setGradeIdx] = useState(0);  // index into GRADE_KEYS

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      let details: Record<string, unknown> = {};
      if (tab === "fertilizer") details = { type: t(FERT_TYPE_KEYS[fertType]), quantityKg: fertQty };
      else if (tab === "pruning") details = { type: pruneType, areaHa: pruneArea };
      else details = { field: field.trim() || "—", estimatedKg: kg, grade: t(GRADE_KEYS[gradeIdx]) };

      await recordFarmActivity(userUid, tab, date, details);
      setDone(true);
      window.setTimeout(() => setDone(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("farm.saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm";
  const labelCls = "text-[11px] font-medium text-slate-400";

  return (
    <div>
      <PageHeader
        eyebrow={t("farm.eyebrow")}
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
        {TAB_KEYS.map((tab2) => {
          const Icon = tab2.icon;
          const active = tab === tab2.id;
          return (
            <button
              key={tab2.id}
              onClick={() => { setTab(tab2.id); setDone(false); setError(null); }}
              className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition ${active ? "border-emerald-300 bg-emerald-50" : "border-slate-100 bg-white"}`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-emerald-600" : "text-slate-400"}`} />
              <span className={`text-[11px] font-semibold ${active ? "text-emerald-700" : "text-slate-500"}`}>{t(tab2.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic form */}
      <Card className="mt-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}><CalendarDays className="mr-1 inline h-3 w-3" />{t("farm.activityDate")}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>

          {tab === "fertilizer" && (
            <>
              <div className="col-span-2">
                <label className={labelCls}>{t("farm.fertilizerType")}</label>
                <select value={fertType} onChange={(e) => setFertType(+e.target.value)} className={inputCls}>
                  {FERT_TYPE_KEYS.map((k, idx) => <option key={k} value={idx}>{t(k)}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>{t("farm.quantityKg")}</label>
                <input type="number" value={fertQty} onChange={(e) => setFertQty(+e.target.value)} className={`${inputCls} tnum`} />
              </div>
            </>
          )}

          {tab === "pruning" && (
            <>
              <div className="col-span-2">
                <label className={labelCls}>{t("farm.pruningType")}</label>
                <select value={pruneType} onChange={(e) => setPruneType(e.target.value)} className={inputCls}>
                  {PRUNE_TYPES.map((p, idx) => <option key={p} value={p}>{t(PRUNE_TYPE_KEYS[idx])}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>{t("farm.areaCovered")}</label>
                <input type="number" step="0.1" value={pruneArea} onChange={(e) => setPruneArea(+e.target.value)} className={`${inputCls} tnum`} />
              </div>
            </>
          )}

          {tab === "self_harvest" && (
            <>
              <div>
                <label className={labelCls}>{t("farm.fieldBlock")}</label>
                <input value={field} onChange={(e) => setField(e.target.value)} placeholder={t("farm.fieldBlockPh")} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t("farm.grade")}</label>
                <select value={gradeIdx} onChange={(e) => setGradeIdx(+e.target.value)} className={inputCls}>
                  {GRADE_KEYS.map((k, idx) => <option key={k} value={idx}>{t(k)}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>{t("farm.estimatedWeight")}</label>
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
          <h3 className="font-display text-sm font-bold text-slate-800">{t("farm.recentActivities")}</h3>
        </div>
        {history.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">{t("farm.noActivities")}</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 8).map((a) => {
              const tabMeta = TAB_KEYS.find((x) => x.id === a.activityType);
              const Icon = tabMeta?.icon ?? Package;
              const label = tabMeta ? t(tabMeta.labelKey) : a.activityType.replace("_", "-");
              const summary =
                a.activityType === "fertilizer"
                  ? t("farm.summaryFertilizer", { type: (a.details as { type?: string }).type ?? "—", qty: String((a.details as { quantityKg?: number }).quantityKg ?? 0) })
                  : a.activityType === "pruning"
                    ? t("farm.summaryPrune", { type: (a.details as { type?: string }).type ?? "—", area: String((a.details as { areaHa?: number }).areaHa ?? 0) })
                    : t("farm.summaryHarvest", { qty: String((a.details as { estimatedKg?: number }).estimatedKg ?? 0), grade: (a.details as { grade?: string }).grade ?? "—" });
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold capitalize text-slate-700">{label}</p>
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
