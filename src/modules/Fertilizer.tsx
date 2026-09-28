import { useEffect } from "react";
import { Sprout, FileDown, ArrowRight, Calendar } from "lucide-react";
import { PageHeader, Card, Badge, IconChip, StatCard } from "@/components/ui";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { useState } from "react";
import { exportObjectsToCSV } from "@/lib/csvExport";
import { fmtLKR, fmtNum, addDays, TODAY_ISO } from "@/lib/data";

interface FertStockItem {
  id: string;
  code: string;
  name: string;
  qtyOnHand: number;
  reorderLevel: number;
  unitCost: number;
  unit: string;
}

/**
 * Fertilizer module — now reads REAL data from stock_items table (category='fertilizer').
 * Redirects stock management to the Inventory module (PO, GRN, Issue all live there).
 */
export default function Fertilizer() {
  const [items, setItems] = useState<FertStockItem[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!supabaseConfigured) {
      setItems([
        { id: "s1", code: "FERT-UREA", name: "Urea (46% N)", qtyOnHand: 1250, reorderLevel: 200, unitCost: 95, unit: "kg" },
        { id: "s2", code: "FERT-MOP", name: "MOP (Potash)", qtyOnHand: 680, reorderLevel: 150, unitCost: 180, unit: "kg" },
        { id: "s3", code: "FERT-TSP", name: "TSP (Phosphate)", qtyOnHand: 420, reorderLevel: 100, unitCost: 175, unit: "kg" },
        { id: "s4", code: "FERT-DOL", name: "Dolomite", qtyOnHand: 80, reorderLevel: 80, unitCost: 60, unit: "kg" },
      ]);
      return;
    }
    setBusy(true);
    try {
      const sb = getSupabase()!;
      const { data, error } = await sb.from("stock_items").select("*").eq("category", "fertilizer").order("name");
      if (error) throw error;
      setItems((data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string, code: r.code as string, name: r.name as string,
        qtyOnHand: Number(r.qty_on_hand ?? 0), reorderLevel: Number(r.reorder_level ?? 0),
        unitCost: Number(r.unit_cost ?? 0), unit: r.unit as string,
      })));
    } catch { /* keep defaults */ }
    finally { setBusy(false); }
  };

  useEffect(() => { void reload(); }, []);

  const totalValue = items.reduce((s, i) => s + i.qtyOnHand * i.unitCost, 0);
  const lowStock = items.filter(i => i.qtyOnHand <= i.reorderLevel).length;

  return (
    <div>
      <PageHeader
        eyebrow="Inputs"
        title="Fertilizer Stock Overview"
        desc="Real-time fertilizer stock levels from the Inventory module. Manage POs, GRNs, and stock issues in the Inventory module."
        icon={<IconChip icon={Sprout} tone="emerald" className="h-12 w-12" />}
        actions={
          <a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("verda:navigate", { detail: "inventory" })); }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
            Go to Inventory <ArrowRight className="h-4 w-4" />
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={Sprout} label="Fertilizer Types" value={String(items.length)} tone="emerald" />
        <StatCard icon={ArrowRight} label="Stock Value" value={fmtLKR(totalValue)} tone="sky" />
        <StatCard icon={ArrowRight} label="Low Stock Items" value={String(lowStock)} tone="rose" />
      </div>

      <Card className="mt-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-slate-800">Fertilizer Stock Levels (from Inventory)</h3>
          {items.length > 0 && (
            <button onClick={() => exportObjectsToCSV("fertilizer_stock", items.map(i => ({ code: i.code, name: i.name, qty: i.qtyOnHand, unit: i.unit, reorder: i.reorderLevel, unit_cost: i.unitCost, value: i.qtyOnHand * i.unitCost })))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <FileDown className="h-3 w-3" /> Export CSV
            </button>
          )}
        </div>

        {busy ? (
          <div className="flex h-32 items-center justify-center">
            <div className="animate-pulse text-sm text-slate-400">Loading fertilizer stock…</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Code</th>
                  <th className="pb-2">Name</th>
                  <th className="pb-2 text-right">Qty on Hand</th>
                  <th className="pb-2 text-right">Reorder Level</th>
                  <th className="pb-2 text-right">Unit Cost</th>
                  <th className="pb-2 text-right">Value</th>
                  <th className="pb-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map(i => (
                  <tr key={i.id} className="border-t border-slate-100">
                    <td className="py-2 font-mono text-xs">{i.code}</td>
                    <td className="py-2 font-semibold text-slate-800">{i.name}</td>
                    <td className="py-2 text-right tnum">{fmtNum(i.qtyOnHand)} {i.unit}</td>
                    <td className="py-2 text-right tnum text-slate-400">{fmtNum(i.reorderLevel)}</td>
                    <td className="py-2 text-right tnum">{fmtLKR(i.unitCost)}</td>
                    <td className="py-2 text-right tnum font-semibold">{fmtLKR(i.qtyOnHand * i.unitCost)}</td>
                    <td className="py-2 text-center">
                      {i.qtyOnHand <= i.reorderLevel
                        ? <Badge tone="rose" dot>Low</Badge>
                        : <Badge tone="emerald" dot>OK</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-700">
        <p className="font-semibold">📌 Fertilizer management is now integrated with the Inventory module.</p>
        <p className="mt-1">To create Purchase Orders, receive Goods (GRN), or issue fertilizer to fields/suppliers, use the <strong>Inventory</strong> module. This page shows a read-only overview of current fertilizer stock levels.</p>
      </div>

      {/* Division-level Fertilizer Issued Summary — Sir's spec #4 */}
      <Card className="mt-4 p-4">
        <h3 className="mb-2 font-display text-sm font-bold text-slate-800">📊 Fertilizer Issued by Division (last 30 days)</h3>
        <p className="mb-3 text-[11px] text-slate-500">
          Summary of fertilizer quantities issued to each division (e.g., Kiriwallapatana Lower / Upper).
          Source: stock_movements (move_type='out') joined to stock_items (category='fertilizer'),
          notes contain division name.
        </p>
        <DivisionFertilizerSummary />
      </Card>

      {/* B27 FIX: Block-level Fertilizer History from supplier farm_activities.
          Reads farm_activities WHERE activity_type='fertilizer' and groups by
          details->>block. Surfaces what each supplier recorded in their
          Farm Activities → Fertilizer tab. */}
      <Card className="mt-4 p-4">
        <h3 className="mb-2 font-display text-sm font-bold text-slate-800">🧪 Block-level Fertilizer History (Supplier Logs)</h3>
        <p className="mb-3 text-[11px] text-slate-500">
          Every fertilizer application that suppliers log in their "My Farm Activities" module, grouped by block.
          Source: farm_activities (activity_type='fertilizer') — details-&gt;&gt;'block'.
        </p>
        <BlockFertilizerHistory />
      </Card>

      {/* B28 (Round #8) — Stock Movement Report (mirrors the factory's
          "Fertilizer Stock Balance.xlsx" with opening/GRN/issued/closing
          per item over a date range). Replaces the manual Excel workflow. */}
      <StockMovementReportPanel />
    </div>
  );
}

/**
 * BlockFertilizerHistory — reads fertilizer activities from the
 * `farm_activities` Supabase table and groups by `details->>block`.
 * Also surfaces which supplier applied each entry.
 *
 * B27 FIX — admin previously had no UI to view this data even though
 * FarmActivities.tsx captures `details.block` on every fertilizer log.
 */
function BlockFertilizerHistory() {
  const [rows, setRows] = useState<{ block: string; totalKg: number; applicationCount: number; suppliers: string[]; lastApplied: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      setBusy(true);
      try {
        if (!supabaseConfigured) {
          // Demo data
          setRows([
            { block: "Upper Block", totalKg: 220, applicationCount: 4, suppliers: ["Sumithra Green Leaf Co."], lastApplied: "2025-09-15" },
            { block: "Lower Block", totalKg: 180, applicationCount: 3, suppliers: ["Nimal Tea Suppliers"], lastApplied: "2025-09-12" },
            { block: "Nursery", totalKg: 50, applicationCount: 1, suppliers: ["Sumithra Green Leaf Co."], lastApplied: "2025-09-05" },
          ]);
          return;
        }
        const sb = getSupabase()!;
        // Read farm_activities where activity_type='fertilizer' (last 90 days)
        const since = new Date(Date.now() - 90 * 86400_000).toISOString();
        const { data, error } = await sb
          .from("farm_activities")
          .select("user_id, logged_date, details")
          .eq("activity_type", "fertilizer")
          .gte("logged_date", since.slice(0, 10))
          .order("logged_date", { ascending: false });
        if (error) throw error;

        // Group by details.block (default "All blocks")
        const byBlock: Record<string, { kg: number; count: number; suppliers: Set<string>; lastApplied: string }> = {};
        for (const r of (data ?? [])) {
          const d = (r.details ?? {}) as { block?: string; quantityKg?: number };
          const block = d.block || "All blocks";
          if (!byBlock[block]) byBlock[block] = { kg: 0, count: 0, suppliers: new Set(), lastApplied: r.logged_date };
          byBlock[block].kg += Number(d.quantityKg ?? 0);
          byBlock[block].count += 1;
          byBlock[block].suppliers.add(r.user_id);
          if (r.logged_date > byBlock[block].lastApplied) byBlock[block].lastApplied = r.logged_date;
        }

        setRows(Object.entries(byBlock).map(([block, v]) => ({
          block,
          totalKg: v.kg,
          applicationCount: v.count,
          suppliers: Array.from(v.suppliers),
          lastApplied: v.lastApplied,
        })).sort((a, b) => b.totalKg - a.totalKg));
      } catch {
        // keep empty
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  if (busy) return <div className="py-4 text-center text-sm text-slate-400">Loading block-level history…</div>;
  if (rows.length === 0) return <div className="py-4 text-center text-sm text-slate-400">No fertilizer logs from suppliers yet.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="pb-2">Block</th>
            <th className="pb-2 text-right">Total Kg Applied</th>
            <th className="pb-2 text-right">Applications</th>
            <th className="pb-2 text-right">Suppliers</th>
            <th className="pb-2 text-right">Last Applied</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.block} className="border-t border-slate-100">
              <td className="py-2 font-semibold text-slate-800">{r.block}</td>
              <td className="py-2 text-right tnum font-bold text-emerald-700">{fmtNum(r.totalKg)} kg</td>
              <td className="py-2 text-right tnum text-slate-500">{r.applicationCount}</td>
              <td className="py-2 text-right tnum text-slate-500">{r.suppliers.length}</td>
              <td className="py-2 text-right tnum text-slate-500">{r.lastApplied}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-slate-400">
        * Data from suppliers' own farm activity logs (last 90 days). Block name comes from each supplier's selection in their Farm Activities → Fertilizer tab.
      </p>
    </div>
  );
}

/**
 * DivisionFertilizerSummary — reads fertilizer issue movements from Supabase
 * and summarizes by division (parsed from notes). Falls back to localStorage
 * if Supabase isn't configured.
 */
function DivisionFertilizerSummary() {
  const [rows, setRows] = useState<{ division: string; totalQty: number; totalValue: number; lineCount: number }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!supabaseConfigured) {
        // Mock: show example divisions per Sir's spec
        setRows([
          { division: "Kiriwallapatana Lower", totalQty: 220, totalValue: 220 * 95, lineCount: 3 },
          { division: "Kiriwallapatana Upper", totalQty: 480, totalValue: 480 * 95, lineCount: 5 },
          { division: "Sutton",                totalQty: 150, totalValue: 150 * 180, lineCount: 2 },
          { division: "Factory",              totalQty: 0,   totalValue: 0, lineCount: 0 },
        ]);
        return;
      }
      setBusy(true);
      try {
        const sb = getSupabase()!;
        // Last 30 days
        const since = new Date(Date.now() - 30 * 86400_000).toISOString();
        const { data, error } = await sb
          .from("stock_movements")
          .select(`
            qty, notes, performed_at,
            stock_items!inner ( name, unit, unit_cost, category )
          `)
          .eq("move_type", "out")
          .gte("performed_at", since)
          .order("performed_at", { ascending: false });
        if (error) throw error;

        // Filter to fertilizer movements only + group by division (parsed from notes)
        const byDivision: Record<string, { qty: number; value: number; lines: number; unit: string }> = {};
        (data ?? []).forEach((r: any) => {
          if (r.stock_items?.category !== "fertilizer") return;
          // Parse division from structured notes: "division:NAME | ..." (new format)
          // OR fallback to old keyword matching for legacy entries.
          const notes = (r.notes || "");
          let div = "Unspecified";
          const structuredMatch = notes.match(/division:([^|]+)/i);
          if (structuredMatch) {
            div = structuredMatch[1].trim();
          } else {
            // Legacy fallback — keyword matching
            const notesLower = notes.toLowerCase();
            const known = ["kiriwallapatana lower", "kiriwallapatana upper", "sutton", "craighead", "tennant", "factory", "nursery"];
            for (const k of known) {
              if (notesLower.includes(k)) { div = k.replace(/\b\w/g, c => c.toUpperCase()); break; }
            }
          }
          const cost = Number(r.stock_items?.unit_cost ?? 0);
          if (!byDivision[div]) byDivision[div] = { qty: 0, value: 0, lines: 0, unit: r.stock_items?.unit ?? "kg" };
          byDivision[div].qty += Number(r.qty ?? 0);
          byDivision[div].value += Number(r.qty ?? 0) * cost;
          byDivision[div].lines += 1;
        });

        setRows(Object.entries(byDivision).map(([division, v]) => ({
          division,
          totalQty: v.qty,
          totalValue: v.value,
          lineCount: v.lines,
        })).sort((a, b) => b.totalQty - a.totalQty));
      } catch { /* keep empty */ }
      finally { setBusy(false); }
    })();
  }, []);

  if (busy) return <div className="py-4 text-center text-sm text-slate-400">Loading division summary…</div>;
  if (rows.length === 0) return <div className="py-4 text-center text-sm text-slate-400">No fertilizer issues recorded in the last 30 days.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="pb-2">Division</th>
            <th className="pb-2 text-right">Qty Issued</th>
            <th className="pb-2 text-right">Lines</th>
            <th className="pb-2 text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.division} className="border-t border-slate-100">
              <td className="py-2 font-semibold text-slate-800">{r.division}</td>
              <td className="py-2 text-right tnum">{fmtNum(r.totalQty)} kg</td>
              <td className="py-2 text-right tnum text-slate-500">{r.lineCount}</td>
              <td className="py-2 text-right tnum font-semibold">{fmtLKR(r.totalValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-slate-400">
        * Division parsed from movement notes — for accurate attribution, mention the division name in the Issue Stock notes field.
      </p>
    </div>
  );
}

/**
 * StockMovementReportPanel — B28 (Round #8) — mirrors the factory's
 * "Fertilizer Stock Balance.xlsx" report structure:
 *   - Per-item table with Opening / Received (GRN) / Issued / Closing
 *   - Date range filter
 *   - CSV export
 *
 * Reads from the new getStockMovementReport() function in repo.phase2.ts.
 * Replaces the manual Excel workflow with a live, real-time version.
 */
function StockMovementReportPanel() {
  // Default: last 30 days
  const [startDate, setStartDate] = useState(addDays(TODAY_ISO, -30));
  const [endDate, setEndDate] = useState(TODAY_ISO);
  const [rows, setRows] = useState<import("@/lib/repo.phase2").StockMovementReportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "fertilizer" | "agrochemical" | "equipment">("fertilizer");

  const load = async () => {
    setBusy(true);
    try {
      const { getStockMovementReport } = await import("@/lib/repo.phase2");
      const data = await getStockMovementReport(startDate, endDate);
      setRows(filter === "all" ? data : data.filter(r => r.category === filter));
    } catch {
      setRows([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, filter]);

  const totalOpening = rows.reduce((s, r) => s + r.openingValue, 0);
  const totalReceived = rows.reduce((s, r) => s + r.receivedValue, 0);
  const totalIssued = rows.reduce((s, r) => s + r.issuedValue, 0);
  const totalClosing = rows.reduce((s, r) => s + r.closingValue, 0);

  return (
    <Card className="mt-4 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-violet-600" />
            📊 Stock Movement Report (B28)
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Per-item Opening / Received (GRN) / Issued / Closing balance over a date range.
            Mirrors the factory's "Fertilizer Stock Balance.xlsx" report — now live + real-time.
          </p>
        </div>
        {rows.length > 0 && (
          <button
            onClick={() => exportObjectsToCSV("stock_movement_report", rows.map(r => ({
              code: r.code, name: r.name, category: r.category, unit: r.unit,
              opening_qty: r.openingQty, opening_value_rs: r.openingValue,
              received_qty: r.receivedQty, received_value_rs: r.receivedValue,
              issued_qty: r.issuedQty, issued_value_rs: r.issuedValue,
              closing_qty: r.closingQty, closing_value_rs: r.closingValue,
            })))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <FileDown className="h-3 w-3" /> Export CSV
          </button>
        )}
      </div>

      {/* Date range + category filter */}
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <label className="text-[11px] text-slate-400">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-400">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] text-slate-400">Category</label>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as "all" | "fertilizer" | "agrochemical" | "equipment")}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
          >
            <option value="fertilizer">Fertilizer only</option>
            <option value="agrochemical">Agrochemical only</option>
            <option value="equipment">Equipment only</option>
            <option value="all">All categories</option>
          </select>
        </div>
      </div>

      {busy ? (
        <div className="py-4 text-center text-sm text-slate-400">Loading stock movement report…</div>
      ) : rows.length === 0 ? (
        <div className="py-4 text-center text-sm text-slate-400">
          No stock movements in this period. Use the Inventory module to receive goods (GRN) or issue stock.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="pb-2">Code</th>
                <th className="pb-2">Name</th>
                <th className="pb-2 text-right">Opening (qty)</th>
                <th className="pb-2 text-right">Received (qty)</th>
                <th className="pb-2 text-right">Issued (qty)</th>
                <th className="pb-2 text-right">Closing (qty)</th>
                <th className="pb-2 text-right">Closing Value (Rs)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.stockItemId} className="border-t border-slate-100">
                  <td className="py-2 font-mono text-xs">{r.code}</td>
                  <td className="py-2 font-semibold text-slate-800">{r.name}</td>
                  <td className="py-2 text-right tnum text-slate-500">{fmtNum(r.openingQty)} {r.unit}</td>
                  <td className="py-2 text-right tnum text-emerald-600">+{fmtNum(r.receivedQty)}</td>
                  <td className="py-2 text-right tnum text-rose-600">-{fmtNum(r.issuedQty)}</td>
                  <td className="py-2 text-right tnum font-bold text-slate-800">{fmtNum(r.closingQty)} {r.unit}</td>
                  <td className="py-2 text-right tnum font-semibold">{fmtLKR(r.closingValue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200">
                <td colSpan={2} className="py-2 text-xs font-bold text-slate-700">TOTAL VALUE (Rs)</td>
                <td className="py-2 text-right tnum font-bold text-slate-600">{fmtLKR(totalOpening)}</td>
                <td className="py-2 text-right tnum font-bold text-emerald-700">+{fmtLKR(totalReceived)}</td>
                <td className="py-2 text-right tnum font-bold text-rose-700">-{fmtLKR(totalIssued)}</td>
                <td className="py-2"></td>
                <td className="py-2 text-right tnum font-extrabold text-slate-800">{fmtLKR(totalClosing)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-400">
        * Opening = sum of all movements before start date. Received = move_type='in' (GRN, excluding free issues). Issued = move_type='out'. Closing = opening + received − issued. Values use moving-average unit cost.
      </p>
    </Card>
  );
}
