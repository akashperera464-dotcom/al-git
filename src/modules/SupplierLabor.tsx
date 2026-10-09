import { useEffect, useState } from "react";
import { Users, Plus, Trash2, Calendar, TrendingDown, Clock } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { fmtLKR, fmtLKRShort, fmtNum, TODAY_ISO } from "@/lib/data";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

/**
 * SupplierLabor — "My Labor" module (supplier side)
 * ------------------------------------------------------------------
 * B32 (Round #14) — Supplier tracks their own daily labor costs.
 * B33 (Round #15) — Now persisted to Supabase `supplier_labor_logs` table
 *   (survives localStorage clearing / phone reset). localStorage kept as
 *   backwards-compat fallback + instant UI load.
 *
 * Sir's spec:
 *   Phase 1: Supplier brings their own workers (from their village).
 *   Supplier enters headcount + daily wage per category.
 *   System auto-calculates total daily labor cost.
 *   This cost appears as a deduction in "Earnings & Deductions".
 *
 *   Phase 2 (future): Factory provides workers when labor shortage hits.
 *   At that time, "Labor Request" feature will be re-enabled.
 *
 * Labor Categories (per Sir's spec):
 *   - Kankanam (කන්කානම්ලා)
 *   - Casual Plucking (වත්තේ සේවකයෝ / කැෂුවල් දලු කඩන්නෝ)
 *   - Temporary (තාවකාලික සේවකයෝ)
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
}

interface LaborSnapshot {
  date: string;
  lines: { category: string; headcount: number; wage: number; subtotal: number }[];
  total: number;
  totalHeadcount: number;
}

export function SupplierLabor() {
  const { userUid, notify } = useApp();
  const [date, setDate] = useState(TODAY_ISO);
  const [lines, setLines] = useState<LaborLine[]>([
    { category: "Kankanam", headcount: 1, wage: DEFAULT_WAGE["Kankanam"] },
  ]);
  const [history, setHistory] = useState<LaborSnapshot[]>([]);

  // Load history from localStorage (instant) + Supabase (authoritative)
  useEffect(() => {
    // 1. localStorage — instant load
    try {
      const raw = localStorage.getItem(STORAGE_KEY(userUid));
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* ignore */ }

    // 2. Supabase — authoritative source (B33 fix)
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
            lines: (r.lines as { category: string; headcount: number; wage: number; subtotal: number }[]) ?? [],
            total: Number(r.total_cost ?? 0),
            totalHeadcount: Number(r.total_headcount ?? 0),
          }));
          setHistory(snapshots);
          // Also update localStorage cache
          try { localStorage.setItem(STORAGE_KEY(userUid), JSON.stringify(snapshots)); } catch { /* ignore */ }
        }
      } catch (e) {
        console.warn("[SupplierLabor] Supabase load failed, using localStorage:", e);
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

  // This month's total labor cost (for Earnings & Deductions)
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTotal = history
    .filter(h => h.date.slice(0, 7) === thisMonth)
    .reduce((sum, h) => sum + h.total, 0);

  const saveSnapshot = () => {
    if (totalHeadcount === 0) {
      notify({ title: "No workers", body: "Enter at least 1 worker to save.", tone: "rose", channel: "system" });
      return;
    }
    const snap: LaborSnapshot = {
      date,
      lines: lines.map(l => ({ ...l, subtotal: l.headcount * l.wage })),
      total: totalCost,
      totalHeadcount,
    };
    // 1. Save to localStorage (instant UI update)
    const next = [snap, ...history.filter(h => !(h.date === date))].slice(0, 365);
    setHistory(next);
    try { localStorage.setItem(STORAGE_KEY(userUid), JSON.stringify(next)); } catch { /* ignore */ }

    // 2. Save to Supabase (B33 — survives localStorage clearing)
    void (async () => {
      if (!supabaseConfigured) return;
      try {
        const sb = getSupabase()!;
        // Upsert: unique index on (supplier_id, log_date) means same date = update
        await sb.from("supplier_labor_logs").upsert({
          supplier_id: userUid,
          log_date: date,
          lines: snap.lines,
          total_cost: snap.total,
          total_headcount: snap.totalHeadcount,
        }, { onConflict: "supplier_id,log_date" });
      } catch (e) {
        console.warn("[SupplierLabor] Supabase save failed, localStorage only:", e);
      }
    })();

    notify({
      title: "✅ Labor cost saved",
      body: `${date} · ${totalHeadcount} workers · ${fmtLKR(totalCost)}`,
      tone: "emerald",
      channel: "system",
    });
  };

  // Export month total to Earnings & Deductions (via localStorage key that SupplierPayments reads)
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
        eyebrow="VVIP Supplier Portal"
        title="👷 My Labor"
        desc="දිනපතා වත්තට එන සේවකයන්ගේ ප්‍රමාණය සහ පඩිය ඇතුළත් කරන්න. මුළු කම්කරු පිරිවැය ස්වයංක්‍රීයව ගණනය වේ. · Track your daily labor cost — headcount × wage = total."
        icon={<IconChip icon={Users} tone="amber" className="h-12 w-12" />}
      />

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={TrendingDown} label="අද පිරිවැය · Today" value={fmtLKRShort(totalCost)} sub={`${totalHeadcount} workers`} tone="amber" />
        <StatCard icon={Calendar} label="මෙම මාසය · This Month" value={fmtLKRShort(monthTotal)} sub={`${history.filter(h => h.date.slice(0, 7) === thisMonth).length} days logged`} tone="rose" />
        <StatCard icon={Clock} label="ලොග් කළ දින · Days Logged" value={String(history.length)} sub="total" tone="sky" />
        <StatCard icon={Users} label="කාණ්ඩ · Categories" value={String(LABOR_CATEGORIES.length)} sub="Kankanam / Casual / Temp" tone="violet" />
      </div>

      {/* Daily Labor Cost Calculator */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">📋 දෛනික කම්කරු පිරිවැය · Daily Labor Cost Calculator</h3>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className={labelCls}><Calendar className="mr-1 inline h-3 w-3" />දිනය · Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
          <div className="flex items-end">
            <div className="w-full rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              සර්ගේ උපදෙස්: ඔබ ගමේ ඉන්න අයව අරගෙන වැඩ කරවන්න. ඔවුන්ගේ ගණන සහ පඩිය මෙහි දාන්න.
            </div>
          </div>
        </div>

        {/* Labor lines */}
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <div className="col-span-5">වර්ගය · Category</div>
            <div className="col-span-3 text-right">ගණන · Headcount</div>
            <div className="col-span-3 text-right">පඩිය · Daily Wage (Rs)</div>
            <div className="col-span-1"></div>
          </div>
          {lines.map((l, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-1 items-center">
              <select
                value={l.category}
                onChange={e => updateLine(idx, { category: e.target.value, wage: DEFAULT_WAGE[e.target.value] ?? l.wage })}
                className="col-span-5 rounded border border-slate-200 px-2 py-2 text-xs"
              >
                {LABOR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                type="number" min={0}
                value={l.headcount || ""}
                onChange={e => updateLine(idx, { headcount: +e.target.value })}
                placeholder="0"
                className="col-span-3 rounded border border-slate-200 px-2 py-2 text-xs tnum text-right"
              />
              <input
                type="number" min={0} step="any"
                value={l.wage || ""}
                onChange={e => updateLine(idx, { wage: +e.target.value })}
                placeholder="0"
                className="col-span-3 rounded border border-slate-200 px-2 py-2 text-xs tnum text-right"
              />
              <button
                onClick={() => removeLine(idx)}
                disabled={lines.length === 1}
                className="col-span-1 text-rose-500 hover:text-rose-700 disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addLine} className="mt-2 text-xs font-semibold text-emerald-600 hover:underline inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> තවත් පේළිලියක් · Add line
        </button>

        {/* Auto-calculated total */}
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-amber-700 font-semibold">මුළු දෛනික කම්කරු පිරිවැය · Total Daily Labor Cost</p>
              <p className="text-2xl font-extrabold text-amber-700 tnum">{fmtLKR(totalCost)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-amber-700 font-semibold">මුළු සේවකයෝ · Total Headcount</p>
              <p className="text-xl font-bold text-amber-700 tnum">{totalHeadcount}</p>
            </div>
            <button
              onClick={saveSnapshot}
              className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
            >
              Save Snapshot
            </button>
          </div>
        </div>

        {/* Per-line breakdown */}
        {lines.length > 0 && (
          <div className="mt-2 text-[10px] text-slate-400">
            {lines.map((l, i) => (
              <span key={i}>
                {i > 0 && " · "}
                {l.headcount}× {l.category} @ {fmtLKR(l.wage)} = {fmtLKR(l.headcount * l.wage)}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* History */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">📜 පසුගිය පිරිවැය · Recent Snapshots</h3>
        {history.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">තවම පිරිවැය ඇතුළත් කර නොමැත · No snapshots saved yet.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.slice(0, 30).map((h, i) => (
              <div key={i} className="rounded-lg border border-slate-100 p-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{fmtLKR(h.total)}</p>
                    <p className="text-[10px] text-slate-400">{h.date} · {h.totalHeadcount} workers</p>
                  </div>
                  <Badge tone="sky">{h.lines.length} lines</Badge>
                </div>
                <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-500">
                  {h.lines.map((l, j) => (
                    <li key={j}>{l.headcount}× {l.category} @ {fmtLKR(l.wage)} = <span className="tnum font-semibold">{fmtLKR(l.subtotal)}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Phase 2 note */}
      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-700">
        <p className="font-semibold">📌 Phase 2 (අනාගතය)</p>
        <p className="mt-1 leading-relaxed">
          සේවක හිගයක් පැමිණි විට, කර්මාන්තශාලාව මගින් සේවකයන් සපයනු ඇත.
          එවිට "Labor Request" පද්ධතිය ක්‍රියාත්මක වේ.
          එම කම්කරු පිරිවැයද මෙහි එකතු වනු ඇත.
        </p>
        <p className="mt-1 text-[10px] text-sky-600">
          When labor shortage hits, factory will provide workers. That cost will also appear here.
          The "Labor Request" feature is disabled in Phase 1 per Sir's spec.
        </p>
      </div>
    </div>
  );
}
