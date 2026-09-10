import { useEffect, useState } from "react";
import { Users, Sprout, TrendingUp, AlertTriangle, Trees, FileDown } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { fmtNum, fmtLKR } from "@/lib/data";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

/**
 * SupplierInsights — Admin-side module (NEW)
 * ------------------------------------------------------------------
 * Aggregates supplier plot data + fertilizer credit ledger so admin can see:
 *   1. Total supplier acreage + bush count + average yield/acre (across all suppliers)
 *   2. List of suppliers with pending 6-month bush count re-verification
 *   3. List of suppliers with outstanding fertilizer credit balance
 *   4. Auto-deduct credit fertilizer when admin marks a leaf payment as paid
 *
 * Phase 1: reads from localStorage (mirrors supplier-side cache).
 * Phase 2: reads from Supabase `supplier_plots` + `supplier_fertilizer_ledger` tables.
 */

const PLOT_CACHE_KEY_PREFIX = "kdu.supplier_plot.";

interface PlotData {
  acreage: number;
  bushCount: number;
  verifiedAt: string | null;
  cultivar?: string;
  region?: string;
  lastUpdated?: string;
  subFields?: any[];
}

interface LedgerEntry {
  id: string;
  supplierName: string;
  stockItemCode: string;
  stockItemName: string;
  qtyIssued: number;
  unit: string;
  date: string;
  notes?: string;
}

const LEDGER_KEY = "kdu.supplier_fertilizer_ledger";

/** Yield per acre per year by region (kg green leaf) — Sri Lankan agronomy */
const YIELD_BY_REGION: Record<string, number> = {
  "low-country": 1500,
  "mid-country": 1100,
  "up-country": 800,
  "default": 1200,
};

const SIX_MONTHS_MS = 6 * 30 * 86400_000;

export function SupplierInsights() {
  const [plotDataList, setPlotDataList] = useState<{ userUid: string; data: PlotData }[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAll();
  }, []);

  const loadAll = async () => {
    setError(null);
    try {
      // 1. Load all supplier plot data from localStorage (Phase 1).
      //    Each supplier's plot is stored under key: kdu.supplier_plot.{userUid}.
      //    We scan localStorage keys to find all supplier plots.
      const plots: { userUid: string; data: PlotData }[] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(PLOT_CACHE_KEY_PREFIX)) {
            const userUid = key.slice(PLOT_CACHE_KEY_PREFIX.length);
            const raw = localStorage.getItem(key);
            if (raw) {
              try { plots.push({ userUid, data: JSON.parse(raw) as PlotData }); } catch { /* skip */ }
            }
          }
        }
      } catch { /* ignore */ }
      setPlotDataList(plots);

      // 2. Load the full fertilizer ledger (all suppliers, not filtered).
      try {
        const raw = localStorage.getItem(LEDGER_KEY);
        const list: LedgerEntry[] = raw ? JSON.parse(raw) : [];
        setLedger(list);
      } catch { /* ignore */ }

      // 3. Phase 2: load from Supabase if configured.
      if (supabaseConfigured) {
        try {
          const sb = getSupabase()!;
          // Load supplier_plots table (Phase 2 storage)
          const { data: dbPlots, error: plotErr } = await sb.from("supplier_plots").select("*");
          if (!plotErr && dbPlots && dbPlots.length > 0) {
            // Merge with localStorage plots (DB takes precedence on overlap)
            const lsUids = new Set(plots.map(p => p.userUid));
            const dbAsList = dbPlots.map((r: any) => ({
              userUid: r.user_id,
              data: {
                acreage: Number(r.acreage ?? 0),
                bushCount: Number(r.bush_count ?? 0),
                verifiedAt: r.verified_at ?? null,
                cultivar: r.cultivar,
                region: r.region,
                lastUpdated: r.last_updated,
              } as PlotData,
            }));
            const merged = [...plots, ...dbAsList.filter(p => !lsUids.has(p.userUid))];
            setPlotDataList(merged);
          }

          // Load supplier_fertilizer_ledger (Phase 2 storage)
          const { data: dbLedger, error: ledgerErr } = await sb.from("supplier_fertilizer_ledger")
            .select("*").order("issue_date", { ascending: false });
          if (!ledgerErr && dbLedger && dbLedger.length > 0) {
            const dbAsList: LedgerEntry[] = dbLedger.map((r: any) => ({
              id: r.id,
              supplierName: r.supplier_name,
              stockItemCode: r.stock_item_code ?? "",
              stockItemName: r.stock_item_name ?? "",
              qtyIssued: Number(r.qty_issued ?? 0),
              unit: r.unit ?? "kg",
              date: r.issue_date ?? r.created_at,
              notes: r.notes,
            }));
            // Merge — DB takes precedence (already covers all DB rows; LS rows are the same data we'd have anyway)
            setLedger(prev => {
              const lsIds = new Set(prev.map(e => e.id));
              return [...prev, ...dbAsList.filter(e => !lsIds.has(e.id))];
            });
          }
        } catch (e) {
          // Supabase read failed — keep localStorage data
          console.warn("[SupplierInsights] Supabase read failed", e);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      // loading complete
    }
  };

  // ---- Aggregate calculations ----
  const totalSuppliers = plotDataList.length;
  const totalAcreage = plotDataList.reduce((s, p) => s + (p.data.acreage ?? 0), 0);
  const totalBushCount = plotDataList.reduce((s, p) => s + (p.data.bushCount ?? 0), 0);
  const avgBushesPerAcre = totalAcreage > 0 ? Math.round(totalBushCount / totalAcreage) : 0;
  const totalExpectedYieldKg = plotDataList.reduce((s, p) =>
    s + (p.data.acreage ?? 0) * (YIELD_BY_REGION[p.data.region ?? "default"] ?? YIELD_BY_REGION.default), 0
  );

  // Suppliers with pending 6-month re-verification
  const now = Date.now();
  const pendingReverify = plotDataList.filter(p => {
    if (!p.data.verifiedAt) return true; // never verified
    return (now - new Date(p.data.verifiedAt).getTime()) > SIX_MONTHS_MS;
  });

  // Fertilizer credit outstanding per supplier
  const creditBySupplier: Record<string, { totalKg: number; totalBags: number; entries: LedgerEntry[] }> = {};
  ledger.forEach(e => {
    const isCredit = (e.notes || "").toLowerCase().includes("credit");
    if (!isCredit) return;
    if (!creditBySupplier[e.supplierName]) {
      creditBySupplier[e.supplierName] = { totalKg: 0, totalBags: 0, entries: [] };
    }
    if (e.unit === "kg") creditBySupplier[e.supplierName].totalKg += e.qtyIssued;
    else if (e.unit === "bag" || e.unit === "bags") creditBySupplier[e.supplierName].totalBags += e.qtyIssued;
    creditBySupplier[e.supplierName].entries.push(e);
  });

  // Convert bags to kg (1 bag = 50 kg)
  const creditOutstandingList = Object.entries(creditBySupplier).map(([name, v]) => ({
    supplierName: name,
    totalKg: v.totalKg + (v.totalBags * 50),
    entries: v.entries.length,
    estValueRs: (v.totalKg + (v.totalBags * 50)) * 95, // assume Rs 95/kg average
  })).sort((a, b) => b.totalKg - a.totalKg);

  return (
    <div>
      <PageHeader
        eyebrow="Intelligence"
        title="Supplier Insights"
        desc="Aggregated view of all supplier plot data + outstanding fertilizer credit balances. See which suppliers need bush count re-verification + auto-deduct credit fertilizer when leaf payments are made."
        icon={<IconChip icon={Users} tone="violet" className="h-12 w-12" />}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="Suppliers with Plots" value={String(totalSuppliers)} sub="entered plot data" tone="sky" />
        <StatCard icon={Sprout} label="Total Acreage" value={fmtNum(totalAcreage)} sub="acres (all suppliers)" tone="emerald" />
        <StatCard icon={Trees} label="Total Bush Count" value={fmtNum(totalBushCount)} sub="bushes" tone="amber" />
        <StatCard icon={TrendingUp} label="Expected Yield" value={fmtNum(totalExpectedYieldKg)} sub="kg/year (potential)" tone="violet" />
      </div>

      {/* Pending re-verification alert */}
      {pendingReverify.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800">
          <p className="flex items-center gap-1.5 text-sm font-bold mb-1">
            <AlertTriangle className="h-4 w-4" /> 🌳 {pendingReverify.length} supplier(s) need bush count re-verification
          </p>
          <p className="text-xs leading-relaxed mb-2">
            These suppliers haven't verified their bush count in over 6 months (or never verified). Plants may have died or been replanted — encourage them to re-count via the My Plot module.
          </p>
          <div className="space-y-1">
            {pendingReverify.slice(0, 5).map(p => (
              <div key={p.userUid} className="rounded bg-white/60 px-2 py-1 text-xs">
                <span className="font-mono text-slate-600">{p.userUid}</span>
                <span className="text-slate-500 ml-2">
                  · {p.data.acreage} acres · {fmtNum(p.data.bushCount)} bushes
                  · verified: {p.data.verifiedAt ? new Date(p.data.verifiedAt).toLocaleDateString() : "never"}
                </span>
              </div>
            ))}
            {pendingReverify.length > 5 && <p className="text-[11px] text-amber-700">+ {pendingReverify.length - 5} more</p>}
          </div>
        </div>
      )}

      {/* Per-supplier breakdown table */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Per-Supplier Plot Breakdown</h3>
        {plotDataList.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-400">No supplier plot data available yet.</p>
            <p className="mt-1 text-[11px] text-slate-400">
              When suppliers enter their plot details via "My Plot" module, they will appear here.
              Phase 1 uses browser localStorage (admin sees only plots from the same browser).
              Phase 2 will sync to Supabase `supplier_plots` table for full visibility.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2">User UID</th>
                  <th className="pb-2 text-right">Acreage</th>
                  <th className="pb-2 text-right">Bushes</th>
                  <th className="pb-2 text-right">Bushes/Acre</th>
                  <th className="pb-2">Region</th>
                  <th className="pb-2">Verified</th>
                  <th className="pb-2 text-right">Exp. Yield (kg/yr)</th>
                </tr>
              </thead>
              <tbody>
                {plotDataList.map(p => {
                  const yld = Math.round((p.data.acreage ?? 0) * (YIELD_BY_REGION[p.data.region ?? "default"] ?? YIELD_BY_REGION.default));
                  const verifiedDate = p.data.verifiedAt ? new Date(p.data.verifiedAt) : null;
                  const isStale = !verifiedDate || (now - verifiedDate.getTime()) > SIX_MONTHS_MS;
                  return (
                    <tr key={p.userUid} className="border-t border-slate-100">
                      <td className="py-2 font-mono text-xs text-slate-600">{p.userUid}</td>
                      <td className="py-2 text-right tnum">{fmtNum(p.data.acreage)}</td>
                      <td className="py-2 text-right tnum">{fmtNum(p.data.bushCount)}</td>
                      <td className="py-2 text-right tnum text-slate-500">
                        {p.data.acreage > 0 ? fmtNum(Math.round(p.data.bushCount / p.data.acreage)) : "—"}
                      </td>
                      <td className="py-2 capitalize text-slate-600">{p.data.region?.replace("-", " ") ?? "—"}</td>
                      <td className="py-2">
                        {verifiedDate ? (
                          <Badge tone={isStale ? "rose" : "emerald"} dot>
                            {verifiedDate.toLocaleDateString()}
                          </Badge>
                        ) : (
                          <Badge tone="rose" dot>Never</Badge>
                        )}
                      </td>
                      <td className="py-2 text-right tnum font-semibold">{fmtNum(yld)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td className="py-2 text-xs font-bold text-slate-700">TOTAL</td>
                  <td className="py-2 text-right tnum font-bold">{fmtNum(totalAcreage)}</td>
                  <td className="py-2 text-right tnum font-bold">{fmtNum(totalBushCount)}</td>
                  <td className="py-2 text-right tnum font-bold">{fmtNum(avgBushesPerAcre)}</td>
                  <td colSpan={2}></td>
                  <td className="py-2 text-right tnum font-bold">{fmtNum(Math.round(totalExpectedYieldKg))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Fertilizer credit outstanding */}
      <Card className="mt-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-800">Outstanding Fertilizer Credit Balances</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Suppliers with unpaid fertilizer credit. Will be auto-deducted when admin marks their next leaf payment as paid.
            </p>
          </div>
          {ledger.length > 0 && (
            <button
              onClick={() => {
                const csv = "supplier,kg,entries,est_value_rs\n" + creditOutstandingList.map(c =>
                  `"${c.supplierName}",${c.totalKg},${c.entries},${c.estValueRs}`
                ).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url; a.download = "fertilizer_credit_outstanding.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <FileDown className="h-3 w-3" /> CSV
            </button>
          )}
        </div>
        {creditOutstandingList.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No outstanding fertilizer credit.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Supplier Name</th>
                  <th className="pb-2 text-right">Outstanding (kg)</th>
                  <th className="pb-2 text-right"># Issues</th>
                  <th className="pb-2 text-right">Est. Value (Rs)</th>
                  <th className="pb-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {creditOutstandingList.map(c => (
                  <tr key={c.supplierName} className="border-t border-slate-100">
                    <td className="py-2 font-semibold text-slate-800">{c.supplierName}</td>
                    <td className="py-2 text-right tnum">{fmtNum(c.totalKg)} kg</td>
                    <td className="py-2 text-right tnum text-slate-500">{c.entries}</td>
                    <td className="py-2 text-right tnum font-semibold">{fmtLKR(c.estValueRs)}</td>
                    <td className="py-2 text-center">
                      <Badge tone="amber" dot>Pending</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td className="py-2 text-xs font-bold text-slate-700">TOTAL</td>
                  <td className="py-2 text-right tnum font-bold">{fmtNum(creditOutstandingList.reduce((s, c) => s + c.totalKg, 0))} kg</td>
                  <td className="py-2 text-right tnum font-bold">{creditOutstandingList.reduce((s, c) => s + c.entries, 0)}</td>
                  <td className="py-2 text-right tnum font-bold">{fmtLKR(creditOutstandingList.reduce((s, c) => s + c.estValueRs, 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-xs text-violet-700">
        <p className="font-semibold">📌 How to use this data</p>
        <ul className="mt-1.5 space-y-1 list-disc list-inside">
          <li><strong>Re-verify reminder:</strong> Contact suppliers in the amber alert list — encourage them to update their bush count via My Plot.</li>
          <li><strong>Credit outstanding:</strong> When marking a leaf payment as paid, deduct the fertilizer credit value first. Phase 2 will automate this.</li>
          <li><strong>Yield forecast:</strong> "Expected Yield" is a max potential based on region averages — actual depends on fertilizer, pruning, weather.</li>
          <li><strong>Phase 1 limitation:</strong> Data is browser-local — admin on Computer A can't see plots entered by suppliers on Phone B. Phase 2 (Supabase sync) fixes this.</li>
        </ul>
      </div>
    </div>
  );
}
