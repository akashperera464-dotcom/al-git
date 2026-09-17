import { useEffect, useState } from "react";
import { Users, Sprout, TrendingUp, AlertTriangle, Trees, FileDown, CheckCircle2, XCircle, MapPin, FileText, Clock } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { fmtNum, fmtLKR } from "@/lib/data";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { useApp } from "@/context/AppContext";
import {
  readAllRegistrationRequests,
  updateRegistrationStatus,
  promoteApprovedToMyPlot,
  type EstateRegistrationRequest,
} from "@/lib/estateRegistration";

/**
 * SupplierInsights — Admin-side module (NEW)
 * ------------------------------------------------------------------
 * Aggregates supplier plot data + fertilizer credit ledger + estate registration
 * approval workflow so admin can see:
 *   1. Total supplier acreage + bush count + average yield/acre (across all suppliers)
 *   2. List of suppliers with pending 6-month bush count re-verification
 *   3. List of suppliers with outstanding fertilizer credit balance
 *   4. Estate Registration approval/reject workflow (NEW — Sir's spec round #5)
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
  const { userUid: adminUid, notify } = useApp();
  const [plotDataList, setPlotDataList] = useState<{ userUid: string; data: PlotData }[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [regRequests, setRegRequests] = useState<EstateRegistrationRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"insights" | "registrations">("insights");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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

    // Load registration requests (NEW — Sir's spec)
    setRegRequests(readAllRegistrationRequests());
  };

  // ---- NEW (Sir's spec): Approve / Reject estate registration ----
  const approveReg = (reqId: string) => {
    const updated = updateRegistrationStatus(reqId, "APPROVED", "Approved by admin", adminUid);
    if (updated) {
      // Auto-populate supplier's My Plot cache
      promoteApprovedToMyPlot(updated);
      setRegRequests(readAllRegistrationRequests());
      notify({
        title: "✅ Registration Approved",
        body: `"${updated.plotName}" (${updated.supplierName}) approved. Supplier's My Plot module auto-populated.`,
        tone: "emerald",
        channel: "system",
      });
    }
  };

  const confirmReject = (reqId: string) => {
    if (!rejectReason.trim()) {
      notify({ title: "Reason required", body: "Please enter a rejection reason.", tone: "rose", channel: "system" });
      return;
    }
    const updated = updateRegistrationStatus(reqId, "REJECTED", rejectReason.trim(), adminUid);
    if (updated) {
      setRegRequests(readAllRegistrationRequests());
      notify({
        title: "❌ Registration Rejected",
        body: `"${updated.plotName}" (${updated.supplierName}) rejected. Supplier can edit and resubmit.`,
        tone: "rose",
        channel: "system",
      });
    }
    setRejectingId(null);
    setRejectReason("");
  };

  const pendingRegs = regRequests.filter(r => r.status === "PENDING");
  const approvedRegs = regRequests.filter(r => r.status === "APPROVED");
  const rejectedRegs = regRequests.filter(r => r.status === "REJECTED");

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
        desc="Aggregated view of supplier plot data + estate registration approval workflow + outstanding fertilizer credit balances."
        icon={<IconChip icon={Users} tone="violet" className="h-12 w-12" />}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

      {/* Tab switcher: Insights vs Registration Approvals */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("insights")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${activeTab === "insights" ? "bg-violet-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          <Users className="h-3.5 w-3.5" /> Insights
        </button>
        <button
          onClick={() => setActiveTab("registrations")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${activeTab === "registrations" ? "bg-violet-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          <FileText className="h-3.5 w-3.5" /> Estate Registrations
          {pendingRegs.length > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingRegs.length}</span>
          )}
        </button>
      </div>

      {/* ===== REGISTRATION APPROVALS TAB ===== */}
      {activeTab === "registrations" && (
        <div>
          {pendingRegs.length > 0 && (
            <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800">
              <p className="flex items-center gap-1.5 text-sm font-bold mb-1">
                <Clock className="h-4 w-4" /> {pendingRegs.length} estate registration(s) pending approval
              </p>
              <p className="text-xs">Review each request below — check GPS coordinates, photos, and plot details before approving.</p>
            </div>
          )}

          {/* Pending requests */}
          {pendingRegs.length === 0 && approvedRegs.length === 0 && rejectedRegs.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm text-slate-400">No estate registration requests yet.</p>
              <p className="mt-1 text-[11px] text-slate-400">When suppliers register their plots via "My Plot" module, requests will appear here for approval.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingRegs.map(req => (
                <Card key={req.id} className="p-4 border-amber-200">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{req.plotName}</p>
                      <p className="text-[11px] text-slate-500">
                        by {req.supplierName} · submitted {new Date(req.submittedAt).toLocaleDateString()}
                        {req.editCount > 0 && ` · resubmitted (${req.editCount}×)`}
                      </p>
                    </div>
                    <Badge tone="amber" dot>PENDING</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div><span className="text-slate-400">Acreage:</span> <strong>{req.acreage} acres</strong></div>
                    <div><span className="text-slate-400">Bushes:</span> <strong>{fmtNum(req.bushCount)}</strong></div>
                    <div><span className="text-slate-400">Cultivar:</span> <strong>{req.cultivar}</strong></div>
                    <div><span className="text-slate-400">Region:</span> <strong className="capitalize">{req.region.replace("-", " ")}</strong></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      <a href={`https://www.openstreetmap.org/?mlat=${req.latitude}&mlon=${req.longitude}&zoom=15`} target="_blank" rel="noopener noreferrer" className="text-sky-600 underline">
                        {req.latitude.toFixed(4)}, {req.longitude.toFixed(4)} 🗺️
                      </a>
                    </div>
                    <div><span className="text-slate-400">Phone:</span> {req.contactPhone || "—"}</div>
                  </div>
                  {req.address && <p className="text-[11px] text-slate-500 mb-1">📍 {req.address}</p>}
                  {req.notes && <p className="text-[11px] text-slate-500 italic mb-1">Notes: "{req.notes}"</p>}
                  {req.photoUrls.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] text-slate-400 font-semibold mb-0.5">📷 Photos:</p>
                      <div className="flex gap-2">
                        {req.photoUrls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-sky-600 underline">Photo {i + 1}</a>
                        ))}
                      </div>
                    </div>
                  )}
                  {req.landDocumentUrl && (
                    <a href={req.landDocumentUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-violet-600 underline inline-flex items-center gap-1 mb-2">
                      <FileText className="h-3 w-3" /> View land document
                    </a>
                  )}
                  {/* Approve / Reject buttons */}
                  {rejectingId === req.id ? (
                    <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2">
                      <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason (required)..." className="w-full rounded border border-rose-200 px-2 py-1.5 text-xs" />
                      <div className="mt-1.5 flex gap-2">
                        <button onClick={() => confirmReject(req.id)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700">Confirm Reject</button>
                        <button onClick={() => { setRejectingId(null); setRejectReason(""); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => approveReg(req.id)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </button>
                      <button onClick={() => setRejectingId(req.id)} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 inline-flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </button>
                    </div>
                  )}
                </Card>
              ))}

              {/* Approved (collapsed) */}
              {approvedRegs.length > 0 && (
                <Card className="p-3 border-emerald-200 bg-emerald-50">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">✅ Approved ({approvedRegs.length})</p>
                  <div className="space-y-0.5">
                    {approvedRegs.slice(0, 5).map(r => (
                      <p key={r.id} className="text-[11px] text-emerald-600">
                        {r.plotName} — {r.supplierName} — approved {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : "—"}
                      </p>
                    ))}
                  </div>
                </Card>
              )}

              {/* Rejected (collapsed) */}
              {rejectedRegs.length > 0 && (
                <Card className="p-3 border-rose-200 bg-rose-50">
                  <p className="text-xs font-semibold text-rose-700 mb-1">❌ Rejected ({rejectedRegs.length})</p>
                  <div className="space-y-0.5">
                    {rejectedRegs.slice(0, 5).map(r => (
                      <p key={r.id} className="text-[11px] text-rose-600">
                        {r.plotName} — {r.supplierName} — rejected {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : "—"}: "{r.adminNotes}"
                      </p>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===== INSIGHTS TAB (original content) ===== */}
      {activeTab === "insights" && (
      <>
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
      {/* ===== END INSIGHTS TAB ===== */}
      </>
      )}
    </div>
  );
}
