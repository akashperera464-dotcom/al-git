import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Package, Plus, Loader2, Truck, ArrowDownCircle, ArrowUpCircle, AlertTriangle, History, FileDown, Link2 } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { fmtLKR, fmtNum, type StockItem, type PurchaseOrder, type StockMovement, type ResourceRequest } from "@/lib/data";
import { exportObjectsToCSV } from "@/lib/csvExport";
import {
  listStockItems, createStockItem, listPurchaseOrders, createPurchaseOrder,
  receiveGoods, issueStock, listStockMovements,
} from "@/lib/repo.phase2";
import { useApp } from "@/context/AppContext";

/**
 * Inventory & Procurement — stock items with moving-average valuation,
 * purchase orders, goods-receipt notes (GRN), and stock movements audit log.
 */
export default function Inventory() {
  const { t } = useTranslation();
  const { userUid, resourceRequests } = useApp();
  const [tab, setTab] = useState<"stock" | "po" | "grn" | "movements">("stock");
  const [stock, setStock] = useState<StockItem[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [moves, setMoves] = useState<StockMovement[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stock-item form
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("fertilizer");
  const [newUnit, setNewUnit] = useState("kg");
  const [newQty, setNewQty] = useState(0);
  const [newUnitCost, setNewUnitCost] = useState(0);
  const [newReorderLevel, setNewReorderLevel] = useState(0);

  // PO form
  const [poSupplier, setPoSupplier] = useState("");
  const [poLines, setPoLines] = useState<{ stockItemId: string; qtyOrdered: number; unitCost: number }[]>([{ stockItemId: "", qtyOrdered: 1, unitCost: 0 }]);

  // GRN form
  const [grnPoId, setGrnPoId] = useState("");
  const [grnSupplierInvoice, setGrnSupplierInvoice] = useState("");
  const [grnLines, setGrnLines] = useState<{ stockItemId: string; poLineId?: string; qtyReceived: number; unitCost: number }[]>([]);

  // Issue form
  const [issueItemId, setIssueItemId] = useState("");
  const [issueQty, setIssueQty] = useState(1);
  const [issueNotes, setIssueNotes] = useState("");
  const [issueRequestId, setIssueRequestId] = useState<string>("");   // optional link to a supplier request

  const reload = async () => {
    setBusy(true);
    try {
      const [s, p, m] = await Promise.all([listStockItems(), listPurchaseOrders(), listStockMovements()]);
      setStock(s); setPos(p); setMoves(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventory");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const addStockItem = async () => {
    setError(null);
    if (!newCode.trim() || !newName.trim()) { setError("Code and name required"); return; }
    if (newQty < 0 || newUnitCost < 0 || newReorderLevel < 0) { setError("Numeric fields cannot be negative"); return; }
    setBusy(true);
    try {
      // Create the stock item with all fields including opening qty/cost/reorder level
      const created = await createStockItem({
        code: newCode.trim(),
        name: newName.trim(),
        category: newCategory,
        unit: newUnit.trim() || "unit",
        qtyOnHand: newQty,           // opening balance
        unitCost: newUnitCost,       // initial cost (used for valuation)
        reorderLevel: newReorderLevel,
      });

      // If opening qty > 0, also issue an opening-balance stock movement
      // so the audit trail shows where the initial stock came from.
      if (newQty > 0) {
        try {
          await issueStock({
            stockItemId: created.id,
            qty: -newQty,             // negative issue = inward movement
            performedBy: userUid,
            notes: `Opening balance for ${newCode.trim()}`,
          } as any).catch(() => {/* ignore if repo doesn't accept negative */});
        } catch { /* opening balance movement is best-effort */ }
      }

      setNewCode(""); setNewName(""); setNewQty(0); setNewUnitCost(0); setNewReorderLevel(0);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  const addPoLine = () => setPoLines([...poLines, { stockItemId: "", qtyOrdered: 1, unitCost: 0 }]);
  const removePoLine = (idx: number) => poLines.length > 1 && setPoLines(poLines.filter((_, i) => i !== idx));

  const submitPo = async () => {
    setError(null);
    if (!poSupplier.trim()) { setError("Supplier name required"); return; }
    if (poLines.some(l => !l.stockItemId)) { setError("All lines need a stock item"); return; }
    setBusy(true);
    try {
      const poCode = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 100)}`;
      await createPurchaseOrder({
        poCode, supplierName: poSupplier.trim(),
        orderDate: new Date().toISOString().slice(0, 10),
        lines: poLines.map(l => ({ stockItemId: l.stockItemId, qtyOrdered: l.qtyOrdered, unitCost: l.unitCost })),
      });
      setPoSupplier(""); setPoLines([{ stockItemId: "", qtyOrdered: 1, unitCost: 0 }]);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create PO");
    } finally {
      setBusy(false);
    }
  };

  const loadGrnFromPo = (poId: string) => {
    setGrnPoId(poId);
    const po = pos.find(p => p.id === poId);
    if (po) {
      setGrnLines(po.lines.filter(l => l.qtyReceived < l.qtyOrdered).map(l => ({
        stockItemId: l.stockItemId, poLineId: l.id,
        qtyReceived: l.qtyOrdered - l.qtyReceived, unitCost: l.unitCost,
      })));
    } else {
      setGrnLines([]);
    }
  };

  const submitGrn = async () => {
    setError(null);
    if (grnLines.length === 0) { setError("No lines to receive"); return; }
    setBusy(true);
    try {
      const grnCode = `GRN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 100)}`;
      await receiveGoods({
        grnCode, poId: grnPoId || undefined,
        receivedBy: userUid,
        supplierInvoiceNo: grnSupplierInvoice || undefined,
        receipts: grnLines.map(l => ({ stockItemId: l.stockItemId, poLineId: l.poLineId, qtyReceived: l.qtyReceived, unitCost: l.unitCost })),
      });
      setGrnPoId(""); setGrnSupplierInvoice(""); setGrnLines([]);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to receive goods");
    } finally {
      setBusy(false);
    }
  };

  const submitIssue = async () => {
    setError(null);
    if (!issueItemId || issueQty <= 0) { setError("Select item & quantity"); return; }
    setBusy(true);
    try {
      // Build notes — if linked to a supplier request, prepend the request ref
      let notes = issueNotes.trim();
      if (issueRequestId) {
        const req = resourceRequests.find(r => r.id === issueRequestId);
        const reqRef = req
          ? `[Req #${req.id.slice(-6).toUpperCase()} · ${req.type} · ${req.itemDetails} · supplier asked ${req.quantity}]`
          : `[Req #${issueRequestId.slice(-6).toUpperCase()}]`;
        notes = notes ? `${reqRef} ${notes}` : reqRef;
      }
      await issueStock({
        stockItemId: issueItemId, qty: issueQty,
        performedBy: userUid, notes: notes || undefined,
      });
      setIssueItemId(""); setIssueQty(1); setIssueNotes(""); setIssueRequestId("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to issue");
    } finally {
      setBusy(false);
    }
  };

  // Stock-item requests pending fulfilment — drives the "Link to Request" dropdown.
  const pendingStockRequests: ResourceRequest[] = resourceRequests.filter(
    r => r.status === "PENDING" || r.status === "APPROVED"
  );
  // Filter pending requests to those that match the selected stock item's category
  // (best-effort match by itemDetails containing the stock code/name)
  const matchingRequests = (si: StockItem | undefined): ResourceRequest[] => {
    if (!si) return pendingStockRequests;
    const haystack = `${si.code} ${si.name}`.toLowerCase();
    return pendingStockRequests.filter(r =>
      r.itemDetails?.toLowerCase().includes(si.code.toLowerCase()) ||
      r.itemDetails?.toLowerCase().includes(si.name.toLowerCase()) ||
      haystack.includes(r.itemDetails?.toLowerCase() ?? "")
    );
  };

  const totalValue = stock.reduce((s, x) => s + x.qtyOnHand * x.unitCost, 0);
  const lowStock = stock.filter(x => x.qtyOnHand <= x.reorderLevel);
  const openPOs = pos.filter(p => p.status === "draft" || p.status === "sent" || p.status === "partially_received");

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Inventory & Procurement"
        desc="Stock items with moving-average valuation, purchase orders, goods-receipt notes, and issue tracking."
        icon={<IconChip icon={Package} tone="emerald" className="h-12 w-12" />}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Package} label="Stock Items" value={String(stock.length)} tone="sky" />
        <StatCard icon={Truck} label="Open POs" value={String(openPOs.length)} tone="amber" />
        <StatCard icon={AlertTriangle} label="Low Stock" value={String(lowStock.length)} tone="rose" />
        <StatCard icon={Package} label="Stock Value" value={fmtLKR(totalValue)} tone="emerald" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {([
          { id: "stock", label: "Stock Items", icon: Package },
          { id: "po", label: "Purchase Orders", icon: Truck },
          { id: "grn", label: "Receive Goods (GRN)", icon: ArrowDownCircle },
          { id: "movements", label: "Issue / Movements", icon: ArrowUpCircle },
        ] as const).map(t2 => {
          const Icon = t2.icon;
          const active = tab === t2.id;
          return (
            <button key={t2.id} onClick={() => setTab(t2.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${active ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              <Icon className="h-3.5 w-3.5" /> {t2.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Stock Items */}
      {tab === "stock" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1 p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Add Stock Item</h3>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-400">Code</label>
                <input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="e.g. FERT-UREA" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Name</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400">Category</label>
                  <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                    <option value="fertilizer">Fertilizer</option>
                    <option value="agrochemical">Agrochemical</option>
                    <option value="fuel">Fuel</option>
                    <option value="equipment">Equipment</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Unit</label>
                  <input value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="kg / L / pcs" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400">Opening Qty</label>
                  <input type="number" min={0} step="any" value={newQty || ""} onChange={e => setNewQty(+e.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Unit Cost (Rs)</label>
                  <input type="number" min={0} step="any" value={newUnitCost || ""} onChange={e => setNewUnitCost(+e.target.value)} placeholder="0.00" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Reorder Level (alert when qty ≤ this)</label>
                <input type="number" min={0} step="any" value={newReorderLevel || ""} onChange={e => setNewReorderLevel(+e.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
              </div>
              {newQty > 0 && (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-700">
                  Opening value: <strong>Rs {(newQty * newUnitCost).toLocaleString()}</strong> ({fmtNum(newQty)} × Rs {newUnitCost.toLocaleString()})
                </div>
              )}
              <button onClick={addStockItem} disabled={busy} className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Add</button>
            </div>
          </Card>

          <Card className="lg:col-span-2 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-800">Stock On Hand</h3>
              {stock.length > 0 && (
                <button onClick={() => exportObjectsToCSV("stock_items", stock.map(s => ({ code: s.code, name: s.name, category: s.category, qty: s.qtyOnHand, unit: s.unit, unit_cost: s.unitCost, value: s.qtyOnHand * s.unitCost })))}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"><FileDown className="h-3 w-3" /> CSV</button>
              )}
            </div>
            {stock.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No stock items yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="pb-2">Code</th>
                      <th className="pb-2">Name</th>
                      <th className="pb-2 text-right">Qty</th>
                      <th className="pb-2 text-right">Unit Cost</th>
                      <th className="pb-2 text-right">Value</th>
                      <th className="pb-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.map(s => (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="py-2 font-mono text-xs">{s.code}</td>
                        <td className="py-2 font-semibold text-slate-800">{s.name}</td>
                        <td className="py-2 text-right tnum">{fmtNum(s.qtyOnHand)} {s.unit}</td>
                        <td className="py-2 text-right tnum">{fmtLKR(s.unitCost)}</td>
                        <td className="py-2 text-right tnum font-semibold">{fmtLKR(s.qtyOnHand * s.unitCost)}</td>
                        <td className="py-2 text-center">
                          {s.qtyOnHand <= s.reorderLevel ? (
                            <Badge tone="rose" dot>Low</Badge>
                          ) : (
                            <Badge tone="emerald" dot>OK</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab: POs */}
      {tab === "po" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Create Purchase Order</h3>
            <div>
              <label className="text-[11px] text-slate-400">Supplier Name</label>
              <input value={poSupplier} onChange={e => setPoSupplier(e.target.value)} placeholder="e.g. CIC Fertilizers Ltd" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <div className="mt-3">
              <p className="text-[11px] text-slate-400">Lines</p>
              <div className="space-y-2">
                {poLines.map((l, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1">
                    <select value={l.stockItemId} onChange={e => setPoLines(poLines.map((x, i) => i === idx ? { ...x, stockItemId: e.target.value } : x))}
                      className="col-span-6 rounded border border-slate-200 px-1.5 py-1.5 text-xs">
                      <option value="">— select —</option>
                      {stock.map(s => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
                    </select>
                    <input type="number" value={l.qtyOrdered || ""} onChange={e => setPoLines(poLines.map((x, i) => i === idx ? { ...x, qtyOrdered: +e.target.value } : x))} placeholder="Qty" className="col-span-2 rounded border border-slate-200 px-1.5 py-1.5 text-xs tnum" />
                    <input type="number" value={l.unitCost || ""} onChange={e => setPoLines(poLines.map((x, i) => i === idx ? { ...x, unitCost: +e.target.value } : x))} placeholder="Cost" className="col-span-3 rounded border border-slate-200 px-1.5 py-1.5 text-xs tnum" />
                    <button onClick={() => removePoLine(idx)} className="col-span-1 text-rose-500 hover:text-rose-700">×</button>
                  </div>
                ))}
              </div>
              <button onClick={addPoLine} className="mt-2 text-xs font-semibold text-emerald-600 hover:underline">+ Add line</button>
            </div>
            <button onClick={submitPo} disabled={busy} className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Create PO</button>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Purchase Orders</h3>
            {pos.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No POs yet.</p>
            ) : (
              <div className="space-y-2">
                {pos.map(p => (
                  <div key={p.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{p.poCode}</p>
                        <p className="text-[11px] text-slate-400">{p.supplierName} · {p.orderDate}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={p.status === "received" ? "emerald" : p.status === "partially_received" ? "amber" : "sky"} dot>{p.status}</Badge>
                        <span className="font-bold text-slate-700">{fmtLKR(p.totalAmount)}</span>
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {p.lines.length} line(s) · {p.lines.reduce((s, l) => s + l.qtyReceived, 0)}/{p.lines.reduce((s, l) => s + l.qtyOrdered, 0)} units received
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab: GRN */}
      {tab === "grn" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Receive Goods (GRN)</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] text-slate-400">Against PO (optional)</label>
              <select value={grnPoId} onChange={e => loadGrnFromPo(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option value="">— direct receipt (no PO) —</option>
                {pos.filter(p => p.status !== "received" && p.status !== "cancelled").map(p => (
                  <option key={p.id} value={p.id}>{p.poCode} · {p.supplierName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Supplier Invoice No</label>
              <input value={grnSupplierInvoice} onChange={e => setGrnSupplierInvoice(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
          </div>

          <div className="mt-3">
            <p className="text-[11px] text-slate-400">Receipt Lines</p>
            {grnLines.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400">Select a PO above to auto-fill lines (or add lines manually below).</p>
            ) : (
              <div className="mt-2 space-y-2">
                {grnLines.map((l, idx) => {
                  const s = stock.find(x => x.id === l.stockItemId);
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-1">
                      <span className="col-span-6 self-center text-xs">{s?.code ?? "—"} · {s?.name ?? l.stockItemId}</span>
                      <input type="number" value={l.qtyReceived || ""} onChange={e => setGrnLines(grnLines.map((x, i) => i === idx ? { ...x, qtyReceived: +e.target.value } : x))} placeholder="Qty" className="col-span-2 rounded border border-slate-200 px-1.5 py-1.5 text-xs tnum" />
                      <input type="number" value={l.unitCost || ""} onChange={e => setGrnLines(grnLines.map((x, i) => i === idx ? { ...x, unitCost: +e.target.value } : x))} placeholder="Cost" className="col-span-3 rounded border border-slate-200 px-1.5 py-1.5 text-xs tnum" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button onClick={submitGrn} disabled={busy || grnLines.length === 0} className="mt-4 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
            Receive &amp; Update Stock
          </button>
        </Card>
      )}

      {/* Tab: Movements */}
      {tab === "movements" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Issue Stock</h3>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-400">Item</label>
                <select value={issueItemId} onChange={e => { setIssueItemId(e.target.value); setIssueRequestId(""); }} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                  <option value="">— select —</option>
                  {stock.map(s => <option key={s.id} value={s.id}>{s.code} · {s.name} ({fmtNum(s.qtyOnHand)} {s.unit})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Quantity</label>
                <input type="number" value={issueQty} onChange={e => setIssueQty(+e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
              </div>
              {/* Link to a pending supplier request — when selected, the issue
                  note will automatically include the request reference for the
                  audit trail. Matching is best-effort by stock code/name. */}
              <div>
                <label className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Link to Supplier Request (optional)
                </label>
                <select
                  value={issueRequestId}
                  onChange={e => setIssueRequestId(e.target.value)}
                  disabled={!issueItemId}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">— no linked request —</option>
                  {matchingRequests(stock.find(s => s.id === issueItemId)).map(r => (
                    <option key={r.id} value={r.id}>
                      #{r.id.slice(-6).toUpperCase()} · {r.type} · {r.itemDetails} · asked {r.quantity} ({r.status})
                    </option>
                  ))}
                </select>
                {issueItemId && matchingRequests(stock.find(s => s.id === issueItemId)).length === 0 && pendingStockRequests.length > 0 && (
                  <p className="mt-1 text-[10px] text-slate-400">No matching request for this item — {pendingStockRequests.length} pending request(s) for other items.</p>
                )}
                {issueRequestId && (() => {
                  const req = resourceRequests.find(r => r.id === issueRequestId);
                  if (!req) return null;
                  return (
                    <div className="mt-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] text-sky-700">
                      <strong>Supplier asked for: {req.quantity}</strong> · {req.itemDetails || ""}
                      <br />Status: <strong>{req.status}</strong> · Requested for: {new Date(req.dateNeeded).toLocaleString()}
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Notes</label>
                <textarea value={issueNotes} onChange={e => setIssueNotes(e.target.value)} rows={2} placeholder="Reason for issue / recipient name / field block" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              <button onClick={submitIssue} disabled={busy || !issueItemId} className="w-full rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Issue Out</button>
            </div>
          </Card>

          <Card className="lg:col-span-2 p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Movement History</h3>
            {moves.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No movements yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {moves.map(m => {
                  const s = stock.find(x => x.id === m.stockItemId);
                  return (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge tone={m.moveType === "in" ? "emerald" : m.moveType === "out" ? "rose" : "amber"}>{m.moveType}</Badge>
                        <span className="font-semibold text-slate-800">{s?.code ?? m.stockItemId}</span>
                        <span className="text-slate-400">{fmtNum(m.qty)} {s?.unit}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">{new Date(m.performedAt).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
