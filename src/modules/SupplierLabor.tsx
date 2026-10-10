import { useEffect, useState } from "react";
import { Users, Plus, Trash2, Calendar, TrendingDown, Clock } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { fmtLKR, fmtLKRShort, TODAY_ISO } from "@/lib/data";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { useTranslation } from "react-i18next";

/**
 * SupplierLabor — "My Labor" module (supplier side)
 * ------------------------------------------------------------------
 * B32 (Round #14) — Supplier tracks their own daily labor costs.
 * B33 (Round #15) — Persisted to Supabase `supplier_labor_logs` table.
 * B34 (Round #16) — Worker details (name, phone) added per line item.
 *   Sinhala text corrected to professional standard.
 */

const LABOR_CATEGORIES = [
  "Kankanam",
  "Casual Plucking",
  "Temporary",
] as const;

const DEFAULT_WAGE: Record<string, number> = {
  Kankanam: 1800,
  "Casual Plucking": 1500,
  Temporary: 1200,
};

const STORAGE_KEY = (uid: string) => `kdu.supplier_labor.${uid}`;

interface LaborLine {
  category: string;
  headcount: number;
  wage: number;
  /** B34 — optional worker details per line */
  workerName?: string;
  workerPhone?: string;
}

interface LaborSnapshot {
  date: string;
  lines: { category: string; headcount: number; wage: number; subtotal: number; workerName?: string; workerPhone?: string }[];
  total: number;
  totalHeadcount: number;
}

export function SupplierLabor() {
  const { t } = useTranslation();
  const { userUid, notify } = useApp();
  const [date, setDate] = useState(TODAY_ISO);
  const [lines, setLines] = useState<LaborLine[]>([
    { category: "Kankanam", headcount: 1, wage: DEFAULT_WAGE["Kankanam"] },
  ]);
  const [history, setHistory] = useState<LaborSnapshot[]>([]);

  // Load history from localStorage (instant) + Supabase (authoritative)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(userUid));
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* ignore */ }

    void (async () => {
      if (!supabaseConfigured) return;
      try {
        const sb = getSupabase()!;
        const { data, error } = await sb
          .from("supplier_labor_logs")
          .select("*")
          .eq("supplier_id", userUid)
          .order("log_date", { ascending: false })
          .limit(365);
        if (error) throw error;
        if (data && data.length > 0) {
          const snapshots: LaborSnapshot[] = data.map((r: Record<string, unknown>) => ({
            date: r.log_date as string,
            lines: (r.lines as LaborSnapshot["lines"]) ?? [],
            total: Number(r.total_cost ?? 0),
            totalHeadcount: Number(r.total_headcount ?? 0),
          }));
          setHistory(snapshots);
          try { localStorage.setItem(STORAGE_KEY(userUid), JSON.stringify(snapshots)); } catch { /* ignore */ }
        }
      } catch (e) {
        console.warn("[SupplierLabor] Supabase load failed:", e);
      }
    })();
  }, [userUid]);

  const updateLine = (idx: number, patch: Partial<LaborLine>) =>
    setLines(lines.map((l, i) => i === idx ? { ...l, ...patch } : l));

  const addLine = () =>
    setLines([...lines, { category: LABOR_CATEGORIES[0], headcount: 1, wage: DEFAULT_WAGE[LABOR_CATEGORIES[0]] }]);

  const removeLine = (idx: number) => lines.length > 1 && setLines(lines.filter((_, i) => i !== idx));

  const totalCost = lines.reduce((sum, l) => sum + (l.headcount * l.wage), 0);
  const totalHeadcount = lines.reduce((sum, l) => sum + l.headcount, 0);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTotal = history
    .filter(h => h.date.slice(0, 7) === thisMonth)
    .reduce((sum, h) => sum + h.total, 0);

  const saveSnapshot = () => {
    if (totalHeadcount === 0) {
      notify({ title: t("supplierLabor.noWorkersTitle"), body: t("supplierLabor.noWorkersBody"), tone: "rose", channel: "system" });
      return;
    }
    const snap: LaborSnapshot = {
      date,
      lines: lines.map(l => ({ ...l, subtotal: l.headcount * l.wage })),
      total: totalCost,
      totalHeadcount,
    };
    const next = [snap, ...history.filter(h => !(h.date === date))].slice(0, 365);
    setHistory(next);
    try { localStorage.setItem(STORAGE_KEY(userUid), JSON.stringify(next)); } catch { /* ignore */ }

    void (async () => {
      if (!supabaseConfigured) return;
      try {
        const sb = getSupabase()!;
        await sb.from("supplier_labor_logs").upsert({
          supplier_id: userUid,
          log_date: date,
          lines: snap.lines,
          total_cost: snap.total,
          total_headcount: snap.totalHeadcount,
        }, { onConflict: "supplier_id,log_date" });
      } catch (e) {
        console.warn("[SupplierLabor] Supabase save failed:", e);
      }
    })();

    notify({
      title: `✅ ${t("supplierLabor.saved")}`,
      body: t("supplierLabor.savedBody", { date, count: totalHeadcount, amount: fmtLKR(totalCost) }),
      tone: "emerald",
      channel: "system",
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem(`kdu.supplier_labor.month_total.${userUid}`, String(monthTotal));
    } catch { /* ignore */ }
  }, [monthTotal, userUid]);

  const inputCls = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm";
  const labelCls = "text-[11px] font-medium text-slate-400";

  return (
    <div>
      <PageHeader
        eyebrow={t("supplierLabor.eyebrow")}
        title={`👷 ${t("supplierLabor.title")}`}
        desc={t("supplierLabor.desc")}
        icon={<IconChip icon={Users} tone="amber" className="h-12 w-12" />}
      />

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={TrendingDown} label={t("supplierLabor.todayCost")} value={fmtLKRShort(totalCost)} sub={t("supplierLabor.workerCount", { count: totalHeadcount })} tone="amber" />
        <StatCard icon={Calendar} label={t("supplierLabor.thisMonth")} value={fmtLKRShort(monthTotal)} sub={t("supplierLabor.daysRecorded", { count: history.filter(h => h.date.slice(0, 7) === thisMonth).length })} tone="rose" />
        <StatCard icon={Clock} label={t("supplierLabor.recordedDays")} value={String(history.length)} sub={t("supplierLabor.total")} tone="sky" />
        <StatCard icon={Users} label={t("supplierLabor.categories")} value={String(LABOR_CATEGORIES.length)} tone="violet" />
      </div>

      {/* Daily Labor Cost Calculator */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">📋 {t("supplierLabor.calculator")}</h3>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className={labelCls}><Calendar className="mr-1 inline h-3 w-3" />{t("common.date")}</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Labor lines — with worker details (B34) */}
        <div className="space-y-3">
          {lines.map((l, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 p-2.5">
              {/* Row 1: Category + Headcount + Wage + Remove */}
              <div className="grid grid-cols-12 gap-1 items-center">
                <select
                  value={l.category}
                  onChange={e => updateLine(idx, { category: e.target.value, wage: DEFAULT_WAGE[e.target.value] ?? l.wage })}
                  className="col-span-5 rounded border border-slate-200 px-2 py-2 text-xs"
                >
                  {LABOR_CATEGORIES.map(c => <option key={c} value={c}>{t(`supplierLabor.category.${c.replace(/\s+/g, "_").toLowerCase()}`)}</option>)}
                </select>
                <input
                  type="number" min={0}
                  value={l.headcount || ""}
                  onChange={e => updateLine(idx, { headcount: +e.target.value })}
                  placeholder={t("supplierLabor.headcount")}
                  className="col-span-3 rounded border border-slate-200 px-2 py-2 text-xs tnum text-right"
                />
                <input
                  type="number" min={0} step="any"
                  value={l.wage || ""}
                  onChange={e => updateLine(idx, { wage: +e.target.value })}
                  placeholder={t("supplierLabor.wage")}
                  className="col-span-3 rounded border border-slate-200 px-2 py-2 text-xs tnum text-right"
                />
                <button
                  onClick={() => removeLine(idx)}
                  disabled={lines.length === 1}
                  className="col-span-1 text-rose-500 hover:text-rose-700 disabled:opacity-30 flex justify-center"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Row 2: Worker details (B34 — optional) */}
              <div className="grid grid-cols-12 gap-1 mt-1">
                <input
                  type="text"
                  value={l.workerName || ""}
                  onChange={e => updateLine(idx, { workerName: e.target.value })}
                  placeholder={t("supplierLabor.workerName")}
                  className="col-span-7 rounded border border-slate-200 px-2 py-1.5 text-[11px]"
                />
                <input
                  type="tel"
                  value={l.workerPhone || ""}
                  onChange={e => updateLine(idx, { workerPhone: e.target.value })}
                  placeholder={t("supplierLabor.workerPhone")}
                  className="col-span-5 rounded border border-slate-200 px-2 py-1.5 text-[11px]"
                />
              </div>
              {l.headcount > 0 && l.wage > 0 && (
                <p className="mt-1 text-[10px] text-slate-400 text-right">
                  {t("supplierLabor.subtotal")}: {fmtLKR(l.headcount * l.wage)}
                </p>
              )}
            </div>
          ))}
        </div>
        <button onClick={addLine} className="mt-2 text-xs font-semibold text-emerald-600 hover:underline inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> {t("supplierLabor.addWorker")}
        </button>

        {/* Auto-calculated total */}
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-amber-700 font-semibold">{t("supplierLabor.totalDaily")}</p>
              <p className="text-2xl font-extrabold text-amber-700 tnum">{fmtLKR(totalCost)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-amber-700 font-semibold">{t("supplierLabor.totalWorkers")}</p>
              <p className="text-xl font-bold text-amber-700 tnum">{totalHeadcount}</p>
            </div>
            <button
              onClick={saveSnapshot}
              className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      </Card>

      {/* History */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">📜 {t("supplierLabor.recent")}</h3>
        {history.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">{t("supplierLabor.empty")}</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.slice(0, 30).map((h, i) => (
              <div key={i} className="rounded-lg border border-slate-100 p-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{fmtLKR(h.total)}</p>
                    <p className="text-[10px] text-slate-400">{h.date} · {t("supplierLabor.workerCount", { count: h.totalHeadcount })}</p>
                  </div>
                  <Badge tone="sky">{t("supplierLabor.typeCount", { count: h.lines.length })}</Badge>
                </div>
                <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-500">
                  {h.lines.map((l, j) => (
                    <li key={j}>
                      {l.headcount}× {l.category} @ {fmtLKR(l.wage)} = <span className="tnum font-semibold">{fmtLKR(l.subtotal)}</span>
                      {l.workerName && <span className="text-slate-400"> · {l.workerName}{l.workerPhone ? ` (${l.workerPhone})` : ""}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Phase 2 note */}
      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-700">
        <p className="font-semibold">📌 {t("supplierLabor.futureTitle")}</p>
        <p className="mt-1 leading-relaxed">{t("supplierLabor.futureBody")}</p>
      </div>
    </div>
  );
}
