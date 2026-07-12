import { useState } from "react";
import { Inbox, Users, Wrench, Clock3, CheckCircle2, XCircle, Check, ShieldCheck, Boxes } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, Meter, IconChip, Segmented } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { poolForRequest, fmtNum, type RequestStatus } from "@/lib/data";

type Filter = "ALL" | RequestStatus;

const STATUS_TONE: Record<RequestStatus, "amber" | "emerald" | "rose"> = {
  PENDING: "amber",
  APPROVED: "emerald",
  REJECTED: "rose",
};

/** Factory Admin Portal · Supplier Requests Inbox (desktop dashboard grid). */
export function ResourceRequests() {
  const { resourceRequests, decideRequest } = useApp();
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const all = resourceRequests;
  const pending = all.filter((r) => r.status === "PENDING");
  const approved = all.filter((r) => r.status === "APPROVED");
  const rejected = all.filter((r) => r.status === "REJECTED");
  const view = (filter === "ALL" ? all : all.filter((r) => r.status === filter)).sort((a, b) => b.timestamp - a.timestamp);

  const confirmReject = (id: string) => {
    decideRequest(id, "REJECTED", reason.trim() || "No allocation available at this time.");
    setRejectingId(null);
    setReason("");
  };

  return (
    <div>
      <PageHeader
        eyebrow="Field Operations · Supplier Requests"
        title="Resource Requisitions Inbox"
        desc="Approve & allocate or reject incoming worker / equipment tickets, cross-referenced against live labor & inventory pools."
        icon={<IconChip icon={Inbox} tone="emerald" className="h-12 w-12" />}
        actions={
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: "PENDING", label: `Pending · ${pending.length}` },
              { value: "APPROVED", label: `Approved · ${approved.length}` },
              { value: "REJECTED", label: `Rejected · ${rejected.length}` },
              { value: "ALL", label: "All" },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Clock3} label="Pending Tickets" value={String(pending.length)} sub="Awaiting decision" tone="amber" />
        <StatCard icon={CheckCircle2} label="Approved" value={String(approved.length)} sub="Allocated" tone="emerald" />
        <StatCard icon={XCircle} label="Rejected" value={String(rejected.length)} sub="With reason" tone="rose" />
        <StatCard icon={Users} label="Workers Requested" value={String(pending.filter((r) => r.type === "Workers").reduce((s, r) => s + r.quantity, 0))} sub="Units · pending" tone="sky" />
      </div>

      <Card className="mt-4 p-4 lg:p-5">
        {/* header row (desktop) */}
        <div className="hidden grid-cols-12 gap-3 border-b border-slate-100 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 lg:grid">
          <div className="col-span-3">Supplier / Request</div>
          <div className="col-span-2">Needed</div>
          <div className="col-span-3">Pool availability</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Action</div>
        </div>

        <div className="divide-y divide-slate-50">
          {view.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No requests in this view 🎉</p>}
          {view.map((r) => {
            const pool = poolForRequest(r.type, r.itemDetails);
            const pct = pool ? Math.min(100, (pool.available / Math.max(1, pool.total)) * 100) : 0;
            const exceeds = pool ? r.quantity > pool.available : false;
            const isRejecting = rejectingId === r.id;

            return (
              <div key={r.id} className="py-3.5">
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-center">
                  {/* supplier / request */}
                  <div className="col-span-3 flex items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${r.type === "Equipment" ? "bg-sky-50 text-sky-600" : "bg-amber-50 text-amber-600"}`}>
                      {r.type === "Equipment" ? <Wrench className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {r.quantity}× {r.itemDetails}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">{r.supplierName}</p>
                    </div>
                  </div>

                  {/* needed */}
                  <div className="col-span-2 text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">{r.dateNeeded.replace("T", " · ")}</p>
                    <p>{r.durationDays} day duration</p>
                  </div>

                  {/* pool availability */}
                  <div className="col-span-3">
                    {pool ? (
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Boxes className="h-3 w-3" /> {r.type === "Equipment" ? "Inventory" : "Labor"} pool
                          </span>
                          <span className={`font-bold ${exceeds ? "text-rose-600" : "text-emerald-600"}`}>{fmtNum(pool.available)} avail</span>
                        </div>
                        <Meter value={pct} tone={exceeds ? "rose" : "emerald"} />
                        {exceeds && <p className="mt-0.5 text-[10px] font-semibold text-rose-500">Request exceeds available pool</p>}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                    {r.note && <p className="mt-1 truncate text-[11px] text-slate-400">“{r.note}”</p>}
                  </div>

                  {/* status */}
                  <div className="col-span-2">
                    <Badge tone={STATUS_TONE[r.status]} dot>
                      {r.status}
                    </Badge>
                    {r.adminNotes && <p className="mt-1 text-[11px] text-slate-500">{r.adminNotes}</p>}
                  </div>

                  {/* action */}
                  <div className="col-span-2 flex items-center justify-start gap-2 lg:justify-end">
                    {r.status === "PENDING" && !isRejecting && (
                      <>
                        <button
                          onClick={() => decideRequest(r.id, "APPROVED", "Allocation confirmed from current pool.")}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve &amp; Allocate
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(r.id);
                            setReason("");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </>
                    )}
                    {r.status !== "PENDING" && <span className="text-[11px] text-slate-300">Decided</span>}
                  </div>
                </div>

                {/* inline reject-with-reason */}
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
                      <button onClick={() => confirmReject(r.id)} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white">
                        Confirm reject
                      </button>
                      <button onClick={() => setRejectingId(null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
                        Cancel
                      </button>
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
          Each decision performs a <strong>silent state change</strong> on <code className="rounded bg-white px-1 font-mono">resource_requests/{`{id}`}</code> and
          fires a Cloud Function that dispatches an <strong>FCM push</strong> to that specific supplier's device token — 100% free, no SMS gateway.
        </p>
      </div>
    </div>
  );
}
