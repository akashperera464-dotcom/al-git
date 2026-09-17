import { useEffect } from "react";
import { FlaskConical, FileDown, ArrowRight } from "lucide-react";
import { PageHeader, Card, Badge, IconChip, StatCard } from "@/components/ui";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { useState } from "react";
import { exportObjectsToCSV } from "@/lib/csvExport";
import { fmtLKR, fmtNum } from "@/lib/data";

interface AgroStockItem {
  id: string;
  code: string;
  name: string;
  qtyOnHand: number;
  reorderLevel: number;
  unitCost: number;
  unit: string;
}

/**
 * Agrochemical module — reads REAL data from stock_items table (category='agrochemical').
 * Redirects stock management to the Inventory module (PO, GRN, Issue all live there).
 *
 * NOTE: Previously this module used a separate `agrochemical_stock` table with
 * certification + next-spray-date fields. That implementation is now deprecated
 * in favour of the unified stock_items table, so agrochemical stock is managed
 * in one place alongside fertilizer/equipment/fuel.
 */
export default function Agrochemical() {
  const [items, setItems] = useState<AgroStockItem[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!supabaseConfigured) {
      setItems([
        { id: "a1", code: "AGRO-GLY", name: "Glyphosate 360 SL", qtyOnHand: 45, reorderLevel: 10, unitCost: 1850, unit: "L" },
        { id: "a2", code: "AGRO-MAN", name: "Mancozeb 80 WP", qtyOnHand: 18, reorderLevel: 8, unitCost: 2200, unit: "kg" },
        { id: "a3", code: "AGRO-CHL", name: "Chlorpyrifos 40 EC", qtyOnHand: 6, reorderLevel: 12, unitCost: 1450, unit: "L" },
        { id: "a4", code: "AGRO-UREA-SPRAY", name: "Foliar Urea Spray", qtyOnHand: 30, reorderLevel: 5, unitCost: 320, unit: "L" },
      ]);
      return;
    }
    setBusy(true);
    try {
      const sb = getSupabase()!;
      const { data, error } = await sb.from("stock_items").select("*").eq("category", "agrochemical").order("name");
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
        title="Agrochemical Stock Overview"
        desc="Real-time agrochemical stock levels from the Inventory module. Manage POs, GRNs, and stock issues in the Inventory module."
        icon={<IconChip icon={FlaskConical} tone="amber" className="h-12 w-12" />}
        actions={
          <a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("verda:navigate", { detail: "inventory" })); }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
            Go to Inventory <ArrowRight className="h-4 w-4" />
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon={FlaskConical} label="Agrochemical Types" value={String(items.length)} tone="amber" />
        <StatCard icon={ArrowRight} label="Stock Value" value={fmtLKR(totalValue)} tone="sky" />
        <StatCard icon={ArrowRight} label="Low Stock Items" value={String(lowStock)} tone="rose" />
      </div>

      <Card className="mt-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-slate-800">Agrochemical Stock Levels (from Inventory)</h3>
          {items.length > 0 && (
            <button onClick={() => exportObjectsToCSV("agrochemical_stock", items.map(i => ({ code: i.code, name: i.name, qty: i.qtyOnHand, unit: i.unit, reorder: i.reorderLevel, unit_cost: i.unitCost, value: i.qtyOnHand * i.unitCost })))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <FileDown className="h-3 w-3" /> Export CSV
            </button>
          )}
        </div>

        {busy ? (
          <div className="flex h-32 items-center justify-center">
            <div className="animate-pulse text-sm text-slate-400">Loading agrochemical stock…</div>
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

      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">
        <p className="font-semibold">📌 Agrochemical management is now integrated with the Inventory module.</p>
        <p className="mt-1">To create Purchase Orders, receive Goods (GRN), or issue agrochemicals to fields/suppliers, use the <strong>Inventory</strong> module. This page shows a read-only overview of current agrochemical stock levels.</p>
        <p className="mt-1.5 text-[11px] text-amber-600">⚠ Handle with care: agrochemicals may require PPE, certification, and application-record compliance per the Tea Research Institute guidelines.</p>
      </div>
    </div>
  );
}
