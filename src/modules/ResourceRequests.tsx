import { useEffect, useState } from "react";
import { Inbox, Users, Wrench, Clock3, CheckCircle2, XCircle, Check, ShieldCheck, Boxes, Sprout, FlaskConical, Loader2, Package } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, Meter, IconChip, Segmented } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { fmtNum, type RequestStatus, type RealAvailability } from "@/lib/data";
import { getRealWorkerAvailability, getRealStockAvailability, fulfillResourceRequest, completeResourceRequest } from "@/lib/repo.phase2";

type Filter = "ALL" | RequestStatus;

const STATUS_TONE: Record<RequestStatus, "amber" | "emerald" | "rose"> = {
  PENDING: "amber",
  APPROVED: "emerald",
  REJECTED: "rose",
};

/** Factory Admin Portal · Supplier Requests Inbox (desktop dashboard grid). */
export function ResourceRequests() {
  const { resourceRequests, decideRequest, userUid } = useApp();
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availabilities, setAvailabilities] = useState<RealAvailability[]>([]);

  // Fetch real availability
  useEffect(() => {
    void (async () => {
      try {
        const [workers, equip, fert, agro] = await Promise.all([
          getRealWorkerAvailability(),
          getRealStockAvailability("equipment"),
          getRealStockAvailability("fertilizer"),
          getRealStockAvailability("agrochemical"),
        ]);
        setAvailabilities([...workers, ...equip, ...fert, ...agro]);
      } catch { /* keep defaults */ }
    })();
  }, []);

  const all = resourceRequests;
  const pending = all.filter((r) => r.status === "PENDING");
  const approvedList = all.filter((r) => r.status === "APPROVED");
  const rejected = all.filter((r) => r.status === "REJECTED");
  const view = (filter === "ALL" ? all : all.filter((r) => r.status === filter)).sort((a, b) => b.timestamp - a.timestamp);

  const confirmReject = (id: string) => {
    decideRequest(id, "REJECTED", reason.trim() || "No allocation available at this time.");
    setRejectingId(null);
    setReason("");
  };

  // Fulfill a request — issue stock or assign workers
  const fulfill = async (r: typeof all[0]) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      // First approve the request
      decideRequest(r.id, "APPROVED", "Allocation confirmed — fulfilling now.");

      // Find the stock item or worker availability
      const avail = availabilities.find(a => a.type === r.type && a.itemName === r.itemDetails);

      const result = await fulfillResourceRequest({
        requestId: r.id,
        requestType: r.type as "Workers" | "Equipment" | "Fertilizer" | "Agrochemical",
        itemName: r.itemDetails,
        quantity: r.quantity,
        stockItemId: avail?.stockItemId,
        supplierId: r.supplierId,
        supplierName: r.supplierName,
        onCredit: r.type === "Fertilizer" || r.type === "Agrochemical",
        fulfilledBy: userUid,
      });

      if (!result.ok) {
        setError(`Failed to fulfill: ${result.error}`);
      } else {
        const parts: string[] = [];
        if (result.stockIssued) parts.push("stock issued from Inventory");
        if (result.assignments && result.assignments.length > 0) parts.push(`${result.assignments.length} worker(s) assigned`);
        setSuccess(`Request fulfilled — ${parts.join(", ") || "approved"}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  // Complete a request (return equipment/workers)
  const complete = async (r: typeof all[0]) => {
    setBusy(true);
    setError(null);
    try {
      const result = await completeResourceRequest({
        requestId: r.id,
        completedBy: userUid,
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to complete");
      } else {
        setSuccess(`Request completed — equipment/workers returned`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const getAvail = (type: string, item: string) => availabilities.find(a => a.type === type && a.itemName === item);

  return (
    <div>
      <PageHeader
        eyebrow="Field Operations · Supplier Requests"
        title="Resource Requisitions Inbox"
        desc="Approve, fulfill (issue stock + assign workers), and complete (return) incoming requests — with real-time inventory & labor availability."
        icon={<IconChip icon={Inbox} tone="emerald" className="h-12 w-12" />}
        actions={
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "PENDING", label: `Pending · ${pending.length}` },
              { value: "APPROVED", label: `Approved · ${approvedList.length}` },
              { value: "REJECTED", label: `Rejected · ${rejected.length}` },
              { value: "ALL", label: "All" },
            ]}
          />
        }
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Clock3} label="Pending Tickets" value={String(pending.length)} sub="Awaiting decision" tone="amber" />
        <StatCard icon={CheckCircle2} label="Approved" value={String(approvedList.length)} sub="Allocated" tone="emerald" />
        <StatCard icon={XCircle} label="Rejected" value={String(rejected.length)} sub="With reason" tone="rose" />
        <StatCard icon={Package} label="Fertilizer Requests" value={String(pending.filter((r) => r.type === "Fertilizer" || r.type === "Agrochemical").length)} sub="Pending" tone="violet" />
      </div>

      <Card className="mt-4 p-4 lg:p-5">
        <div className="hidden grid-cols-12 gap-3 border-b border-slate-100 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 lg:grid">
          <div className="col-span-3">Supplier / Request</div>
          <div className="col-span-2">Needed</div>
          <div className="col-span-3">Real Availability</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        <div className="divide-y divide-slate-50">
          {view.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No requests in this view</p>}
          {view.map((r) => {
            const avail = getAvail(r.type, r.itemDetails);
            const available = avail?.available ?? 0;
            const total = avail?.total ?? 0;
            const pct = total > 0 ? Math.min(100, (available / total) * 100) : 0;
            const exceeds = available > 0 && r.quantity > available;
            const isRejecting = rejectingId === r.id;

            const reqIcon = r.type === "Equipment" ? <Wrench className="h-5 w-5" />
              : r.type === "Fertilizer" ? <Sprout className="h-5 w-5" />
              : r.type === "Agrochemical" ? <FlaskConical className="h-5 w-5" />
              : <Users className="h-5 w-5" />;
            const reqBg = r.type === "Equipment" ? "bg-sky-50 text-sky-600"
              : r.type === "Fertilizer" ? "bg-emerald-50 text-emerald-600"
              : r.type === "Agrochemical" ? "bg-violet-50 text-violet-600"
              : "bg-amber-50 text-amber-600";

            return (
              <div key={r.id} className="py-3.5">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-center">
                  <div className="col-span-3 flex items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${reqBg}`}>
                      {reqIcon}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{r.quantity}× {r.itemDetails}</p>
                      <p className="truncate text-[11px] text-slate-400">{r.supplierName}</p>
                    </div>
                  </div>

                  <div className="col-span-2 text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">{r.dateNeeded.replace("T", " · ")}</p>
                    <p>{r.durationDays} day duration</p>
                  </div>

                  <div className="col-span-3">
                    {avail ? (
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Boxes className="h-3 w-3" /> {r.type} pool
                          </span>
                          <span className={`font-bold ${exceeds ? "text-rose-600" : "text-emerald-600"}`}>{fmtNum(available)} {avail.unit} avail</span>
                        </div>
                        <Meter value={pct} tone={exceeds ? "rose" : "emerald"} />
                        {exceeds && <p className="mt-0.5 text-[10px] font-semibold text-rose-500">Request exceeds available pool</p>}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">— (no live data)</span>
                    )}
                    {r.note && <p className="mt-1 truncate text-[11px] text-slate-400">"{r.note}"</p>}
                  </div>

                  <div className="col-span-2">
                    <Badge tone={STATUS_TONE[r.status]} dot>{r.status}</Badge>
                    {r.adminNotes && <p className="mt-1 text-[11px] text-slate-500">{r.adminNotes}</p>}
                  </div>

                  <div className="col-span-2 flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                    {r.status === "PENDING" && !isRejecting && (
                      <>
                        <button
                          onClick={() => fulfill(r)}
                          disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Approve & Fulfill
                        </button>
                        <button
                          onClick={() => { setRejectingId(r.id); setReason(""); }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </>
                    )}
                    {r.status === "APPROVED" && (
                      <button
                        onClick={() => complete(r)}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                      >
                        <Package className="h-3.5 w-3.5" /> Mark Returned
                      </button>
                    )}
                    {r.status === "REJECTED" && <span className="text-[11px] text-slate-300">Closed</span>}
                  </div>
                </div>

                {isRejecting && (
                  <div className="mt-3 flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50/50 p-3 sm:flex-row sm:items-center">
                    <input
                      autoFocus
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason for rejection (sent to supplier via FCM)…"
                      className="w-full flex-1 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => confirmReject(r.id)} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white">Confirm reject</button>
                      <button onClick={() => setRejectingId(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <p className="text-xs text-emerald-700">
          <strong>Fulfillment workflow:</strong> PENDING → <strong>Approve & Fulfill</strong> (auto-issues stock from Inventory + assigns workers + creates loan if on credit) → <strong>Mark Returned</strong> (returns equipment to stock + marks workers as returned) → Completed.
          Availability numbers are fetched <strong>live from the database</strong> (workers table + stock_items table), not hardcoded.
        </p>
      </div>
    </div>
  );
}
