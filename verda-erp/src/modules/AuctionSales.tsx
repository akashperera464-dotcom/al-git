import { useEffect, useState } from "react";
import { Gavel, Plus, Loader2, TrendingUp, CheckCircle2, DollarSign } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { fmtLKR, fmtLKRShort, fmtNum, type AuctionBatch, type AuctionStatus } from "@/lib/data";
import { listAuctionBatches, createAuctionBatch, recordAuctionSale } from "@/lib/repo.phase2";
import { useApp } from "@/context/AppContext";

export default function AuctionSales() {
  const { userUid } = useApp();
  const [auctions, setAuctions] = useState<AuctionBatch[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    auctionDate: new Date().toISOString().slice(0, 10), lotNumber: "", brokerName: "",
    gradeCode: "BOP", gradeName: "Broken Orange Pekoe", qtyKg: 0, catalogPriceKg: 0,
  });

  // Sale recording
  const [sellingAuction, setSellingAuction] = useState<AuctionBatch | null>(null);
  const [soldPrice, setSoldPrice] = useState(0);

  const reload = async () => {
    setBusy(true);
    try {
      setAuctions(await listAuctionBatches());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const addAuction = async () => {
    setError(null);
    if (!form.lotNumber.trim() || !form.brokerName.trim()) { setError("Lot number + broker name required"); return; }
    if (form.qtyKg <= 0) { setError("Qty must be > 0"); return; }
    setBusy(true);
    try {
      await createAuctionBatch({
        auctionDate: form.auctionDate, lotNumber: form.lotNumber.trim(),
        brokerName: form.brokerName.trim(), gradeCode: form.gradeCode, gradeName: form.gradeName,
        qtyKg: form.qtyKg, catalogPriceKg: form.catalogPriceKg,
      });
      setSuccess(`Auction lot ${form.lotNumber} cataloged for ${form.brokerName}`);
      setForm({ auctionDate: new Date().toISOString().slice(0, 10), lotNumber: "", brokerName: "", gradeCode: "BOP", gradeName: "Broken Orange Pekoe", qtyKg: 0, catalogPriceKg: 0 });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const recordSale = async () => {
    if (!sellingAuction) return;
    setBusy(true);
    try {
      const res = await recordAuctionSale({
        auctionId: sellingAuction.id, soldPriceKg: soldPrice, expectedVersion: sellingAuction.version,
      });
      if (res.resolution === "conflict") {
        setError("Conflict — refresh");
      } else if (res.resolution === "updated") {
        const a = res.updated;
        setSuccess(`Lot ${a.lotNumber} sold at Rs ${a.soldPriceKg}/kg — Gross ${fmtLKRShort(a.grossSales)}, Brokerage (1%) ${fmtLKRShort(a.brokerageAmount)}, Net ${fmtLKRShort(a.netAmount)}`);
      }
      setSellingAuction(null);
      setSoldPrice(0);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const soldAuctions = auctions.filter(a => a.status === "sold" || a.status === "paid");
  const totalGross = soldAuctions.reduce((s, a) => s + a.grossSales, 0);
  const totalBrokerage = soldAuctions.reduce((s, a) => s + a.brokerageAmount, 0);
  const totalNet = soldAuctions.reduce((s, a) => s + a.netAmount, 0);
  const catalogedCount = auctions.filter(a => a.status === "cataloged").length;

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Colombo Tea Auction Sales"
        desc="Track made-tea lots sold at the Colombo Tea Auction via registered brokers. Strict 1% brokerage commission auto-calculated."
        icon={<IconChip icon={Gavel} tone="sky" className="h-12 w-12" />}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Gavel} label="Cataloged" value={String(catalogedCount)} tone="amber" />
        <StatCard icon={DollarSign} label="Gross Sales" value={fmtLKRShort(totalGross)} tone="emerald" />
        <StatCard icon={TrendingUp} label="Brokerage (1%)" value={fmtLKRShort(totalBrokerage)} tone="rose" />
        <StatCard icon={CheckCircle2} label="Net Received" value={fmtLKRShort(totalNet)} tone="emerald" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Catalog New Lot</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400">Auction Date</label>
                <input type="date" value={form.auctionDate} onChange={e => setForm({ ...form, auctionDate: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Lot Number *</label>
                <input value={form.lotNumber} onChange={e => setForm({ ...form, lotNumber: e.target.value })} placeholder="LOT-001" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Broker Name *</label>
              <input value={form.brokerName} onChange={e => setForm({ ...form, brokerName: e.target.value })} placeholder="e.g. John Keells" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={form.gradeCode} onChange={e => setForm({ ...form, gradeCode: e.target.value })} className="rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                {["BOP", "BOPF", "PEKOE", "OP", "FBOP", "DUST", "DUST1", "PF1"].map(g => <option key={g}>{g}</option>)}
              </select>
              <input value={form.gradeName} onChange={e => setForm({ ...form, gradeName: e.target.value })} placeholder="Grade name" className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400">Qty (kg)</label>
                <input type="number" value={form.qtyKg || ""} onChange={e => setForm({ ...form, qtyKg: +e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Catalog Price/kg</label>
                <input type="number" value={form.catalogPriceKg || ""} onChange={e => setForm({ ...form, catalogPriceKg: +e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
              </div>
            </div>
            <button onClick={addAuction} disabled={busy} className="w-full rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Catalog Lot</button>
          </div>
        </Card>

        <Card className="lg:col-span-2 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Auction Lots ({auctions.length})</h3>
          {auctions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No auction lots yet.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {auctions.map(a => (
                <div key={a.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-800">Lot {a.lotNumber}</p>
                        <Badge tone="slate">{a.gradeCode}</Badge>
                        <Badge tone={a.status === "sold" || a.status === "paid" ? "emerald" : a.status === "unsold" ? "rose" : "amber"} dot>{a.status}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {a.brokerName} · {a.auctionDate} · {fmtNum(a.qtyKg)} kg
                      </p>
                      {a.status === "sold" || a.status === "paid" ? (
                        <div className="mt-1 flex flex-wrap gap-3 text-[11px]">
                          <span className="text-slate-500">Sold: Rs {a.soldPriceKg}/kg</span>
                          <span className="text-emerald-600">Gross: {fmtLKR(a.grossSales)}</span>
                          <span className="text-rose-500">Brokerage (1%): {fmtLKR(a.brokerageAmount)}</span>
                          <span className="font-bold text-emerald-700">Net: {fmtLKR(a.netAmount)}</span>
                        </div>
                      ) : (
                        <p className="mt-0.5 text-[11px] text-slate-400">Catalog price: Rs {a.catalogPriceKg}/kg</p>
                      )}
                    </div>
                    {a.status === "cataloged" && (
                      <button onClick={() => { setSellingAuction(a); setSoldPrice(a.catalogPriceKg); }}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
                        Record Sale
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Sale Recording Modal */}
      {sellingAuction && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setSellingAuction(null)}>
          <Card className="w-full max-w-md p-4">
            <div onClick={e => e.stopPropagation()}>
              <h3 className="font-display text-sm font-bold text-slate-800">Record Sale — Lot {sellingAuction.lotNumber}</h3>
              <p className="text-[11px] text-slate-400">{sellingAuction.brokerName} · {fmtNum(sellingAuction.qtyKg)} kg · {sellingAuction.gradeCode}</p>

              <div className="mt-3">
                <label className="text-[11px] text-slate-400">Sold Price per kg (Rs)</label>
                <input type="number" value={soldPrice || ""} onChange={e => setSoldPrice(+e.target.value)}
                  placeholder={`catalog: Rs ${sellingAuction.catalogPriceKg}`} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
              </div>

              {soldPrice > 0 && (
                <div className="mt-3 rounded-lg bg-sky-50 p-3 text-xs text-sky-700">
                  <div className="flex justify-between"><span>Gross Sales ({fmtNum(sellingAuction.qtyKg)} kg × Rs {soldPrice})</span><span className="font-bold">{fmtLKR(sellingAuction.qtyKg * soldPrice)}</span></div>
                  <div className="flex justify-between text-rose-500"><span>Brokerage (strict 1%)</span><span>−{fmtLKR(sellingAuction.qtyKg * soldPrice * 0.01)}</span></div>
                  <div className="mt-1 flex justify-between border-t border-sky-200 pt-1 font-bold text-emerald-700"><span>Net to Factory</span><span>{fmtLKR(sellingAuction.qtyKg * soldPrice * 0.99)}</span></div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button onClick={() => setSellingAuction(null)} className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-500">Cancel</button>
                <button onClick={recordSale} disabled={busy || soldPrice <= 0}
                  className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50">
                  {busy ? "Recording…" : "Confirm Sale"}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
