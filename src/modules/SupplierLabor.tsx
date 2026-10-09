import { useEffect, useState } from "react";
import { Users, Plus, Trash2, Calendar, TrendingDown, Clock, User } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { fmtLKR, fmtLKRShort, fmtNum, TODAY_ISO } from "@/lib/data";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

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
      notify({ title: "සේවකයන් නොමැත", body: "කම්කරු පිරිවැය සුරැකීමට අවම වශයෙන් එක් සේවකයෙකුවත් ඇතුළත් කරන්න.", tone: "rose", channel: "system" });
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
      title: "✅ කම්කරු පිරිවැය සුරැකිණි",
      body: `${date} · සේවකයන් ${totalHeadcount} දෙනෙක් · ${fmtLKR(totalCost)}`,
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
        eyebrow="VVIP Supplier Portal"
        title="👷 මාගේ කම්කරු සේවාව"
        desc="දිනපතා වත්තේ වැඩට පැමිණෙන කම්කරුවන්ගේ විස්තර සහ දෛනික ආයතන පිරිවැය මෙහි ඇතුළත් කරන්න. මුළු කම්කරු පිරිවැය ස්වයංක්‍රීයව ගණනය වේ."
        icon={<IconChip icon={Users} tone="amber" className="h-12 w-12" />}
      />

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={TrendingDown} label="අද පිරිවැය" value={fmtLKRShort(totalCost)} sub={`සේවකයන් ${totalHeadcount} දෙනෙක්`} tone="amber" />
        <StatCard icon={Calendar} label="මෙම මාසය" value={fmtLKRShort(monthTotal)} sub={`${history.filter(h => h.date.slice(0, 7) === thisMonth).length} දින සටහන් කර ඇත`} tone="rose" />
        <StatCard icon={Clock} label="සටහන් කළ දින" value={String(history.length)} sub="සම්පූර්ණ" tone="sky" />
        <StatCard icon={Users} label="වර්ගීකරණය" value={String(LABOR_CATEGORIES.length)} sub="කන්කානම් / කැෂුවල් / තාවකාලික" tone="violet" />
      </div>

      {/* Daily Labor Cost Calculator */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">📋 දෛනික කම්කරු පිරිවැය · Daily Labor Cost Calculator</h3>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className={labelCls}><Calendar className="mr-1 inline h-3 w-3" />දිනය</label>
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
                  {LABOR_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="number" min={0}
                  value={l.headcount || ""}
                  onChange={e => updateLine(idx, { headcount: +e.target.value })}
                  placeholder="ගණන"
                  className="col-span-3 rounded border border-slate-200 px-2 py-2 text-xs tnum text-right"
                />
                <input
                  type="number" min={0} step="any"
                  value={l.wage || ""}
                  onChange={e => updateLine(idx, { wage: +e.target.value })}
                  placeholder="පඩිය (රු)"
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
                  placeholder="සේවකයාගේ නම (අත්‍යවශ්‍ය නොවේ)"
                  className="col-span-7 rounded border border-slate-200 px-2 py-1.5 text-[11px]"
                />
                <input
                  type="tel"
                  value={l.workerPhone || ""}
                  onChange={e => updateLine(idx, { workerPhone: e.target.value })}
                  placeholder="දුරකථන අංකය"
                  className="col-span-5 rounded border border-slate-200 px-2 py-1.5 text-[11px]"
                />
              </div>
              {l.headcount > 0 && l.wage > 0 && (
                <p className="mt-1 text-[10px] text-slate-400 text-right">
                  උප එකතුව: {fmtLKR(l.headcount * l.wage)}
                </p>
              )}
            </div>
          ))}
        </div>
        <button onClick={addLine} className="mt-2 text-xs font-semibold text-emerald-600 hover:underline inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> තවත් සේවකයෙක් එක් කරන්න
        </button>

        {/* Auto-calculated total */}
        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-amber-700 font-semibold">මුළු දෛනික කම්කරු පිරිවැය</p>
              <p className="text-2xl font-extrabold text-amber-700 tnum">{fmtLKR(totalCost)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-amber-700 font-semibold">මුළු සේවකයන්</p>
              <p className="text-xl font-bold text-amber-700 tnum">{totalHeadcount}</p>
            </div>
            <button
              onClick={saveSnapshot}
              className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:brightness-110"
            >
              සුරැකීම
            </button>
          </div>
        </div>
      </Card>

      {/* History */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">📜 පසුගිය සටහන් · Recent Records</h3>
        {history.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">තවම කම්කරු පිරිවැය සටහන් කර නොමැත.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.slice(0, 30).map((h, i) => (
              <div key={i} className="rounded-lg border border-slate-100 p-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{fmtLKR(h.total)}</p>
                    <p className="text-[10px] text-slate-400">{h.date} · සේවකයන් {h.totalHeadcount} දෙනෙක්</p>
                  </div>
                  <Badge tone="sky">{h.lines.length} වර්ග</Badge>
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
        <p className="font-semibold">📌 අනාගත සැලැස්ම (අදියර 2)</p>
        <p className="mt-1 leading-relaxed">
          අනාගතයේ කම්කරු හිඟයක් පැමිණි විට, කර්මාන්තශාලාව මගින් කම්කරුවන් සපයනු ලැබේ.
          එවිට කම්කරු ඉල්ලීම් පද්ධතිය ක්‍රියාත්මක වන අතර, එම පිරිවැයද මෙහි ඇතුළත් වනු ඇත.
        </p>
      </div>
    </div>
  );
}
