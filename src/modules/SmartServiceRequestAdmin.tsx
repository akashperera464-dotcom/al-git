import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Check,
  CheckCircle2,
  Clock3,
  Coffee,
  Download,
  FileCheck2,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Sprout,
  XCircle,
} from "lucide-react";
import { Badge, Card, IconChip, PageHeader, Segmented, StatCard } from "@/components/ui";
import { exportObjectsToCSV } from "@/lib/csvExport";
import {
  decideSupplierServiceRequest,
  fetchServiceRequestPolicy,
  listSupplierServiceRequests,
  subscribeToServiceRequestStatus,
  updateServiceRequestPolicy,
  type ServiceRequestPolicy,
  type ServiceRequestStatus,
  type ServiceRequestType,
  type SupplierServiceRequest,
} from "@/lib/supplierServiceRequests";

type StatusFilter = "all" | ServiceRequestStatus;
const LKR = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat("en-LK", { maximumFractionDigits: 1 });

const STATUS_TONE: Record<ServiceRequestStatus, "amber" | "emerald" | "rose" | "sky"> = {
  pending: "amber",
  approved: "emerald",
  rejected: "rose",
  fulfilled: "sky",
};

function requestLabel(request: SupplierServiceRequest): string {
  if (request.requestType === "cash_advance") return `${LKR.format(request.requestedAmount)} · ${request.paymentMethod?.replace("_", " ")}`;
  return `${request.quantity} ${request.unit} · ${request.itemLabel ?? request.itemCode}`;
}

function RequestTypeIcon({ type }: { type: ServiceRequestType }) {
  if (type === "cash_advance") return <Banknote className="h-5 w-5" />;
  if (type === "tea_packet") return <Coffee className="h-5 w-5" />;
  return <Sprout className="h-5 w-5" />;
}

export function SmartServiceRequestAdmin() {
  const [requests, setRequests] = useState<SupplierServiceRequest[]>([]);
  const [policy, setPolicy] = useState<ServiceRequestPolicy | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadRequests = useCallback(async () => {
    setRequests(await listSupplierServiceRequests());
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([listSupplierServiceRequests(), fetchServiceRequestPolicy()])
      .then(([rows, currentPolicy]) => {
        if (!active) return;
        setRequests(rows);
        setPolicy(currentPolicy);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Smart requests are unavailable."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => subscribeToServiceRequestStatus(null, () => {
    void loadRequests().catch(() => undefined);
  }), [loadRequests]);

  const counts = useMemo(() => ({
    pending: requests.filter((request) => request.status === "pending").length,
    approved: requests.filter((request) => request.status === "approved").length,
    fulfilled: requests.filter((request) => request.status === "fulfilled").length,
    rejected: requests.filter((request) => request.status === "rejected").length,
  }), [requests]);
  const visible = filter === "all" ? requests : requests.filter((request) => request.status === filter);

  const decide = async (request: SupplierServiceRequest, status: "approved" | "rejected" | "fulfilled") => {
    setBusyId(request.id); setError(""); setSuccess("");
    try {
      const updated = await decideSupplierServiceRequest(request.id, status, notes[request.id] ?? "");
      setRequests((current) => current.map((row) => row.id === updated.id ? updated : row));
      setSuccess(`${request.supplierName}: request marked ${status}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Status could not be updated.");
    } finally { setBusyId(""); }
  };

  const savePolicy = async () => {
    if (!policy) return;
    setSavingPolicy(true); setError(""); setSuccess("");
    try {
      const saved = await updateServiceRequestPolicy(policy);
      setPolicy(saved);
      setSuccess("Smart request policy saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Policy could not be saved.");
    } finally { setSavingPolicy(false); }
  };

  const exportApproved = () => {
    const rows = requests.filter((request) => request.status === "approved" || request.status === "fulfilled");
    exportObjectsToCSV(`supplier_requests_${new Date().toISOString().slice(0, 10)}`, rows.map((request) => ({
      request_id: request.id,
      requested_at: request.requestedAt,
      supplier_number: request.supplierNo ?? "",
      supplier_name: request.supplierName,
      request_type: request.requestType,
      item: request.itemLabel ?? "",
      quantity: request.quantity ?? "",
      unit: request.unit ?? "",
      amount_lkr: request.requestedAmount,
      payment_method: request.paymentMethod ?? "",
      bank_name: request.bankName ?? "",
      bank_branch: request.bankBranch ?? "",
      account_holder: request.accountName ?? "",
      account_number: request.accountNumber ?? "",
      monthly_leaf_kg_snapshot: request.monthlyKgSnapshot,
      office_deductions_snapshot: request.officeDeductionSnapshot,
      eligible_limit_snapshot: request.eligibleLimitSnapshot,
      status: request.status,
      office_note: request.adminNote,
      reviewed_at: request.reviewedAt ?? "",
      fulfilled_at: request.fulfilledAt ?? "",
    })));
  };

  return (
    <section>
      <PageHeader
        eyebrow="Supplier Services · Smart Limit"
        title="Advance, Tea & Fertilizer Requests"
        desc="Review the supplier's saved Office leaf snapshot without calling the Factory API again."
        icon={<IconChip icon={ShieldCheck} tone="emerald" className="h-12 w-12" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowPolicy((value) => !value)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50">
              <Settings2 className="h-4 w-4" /> Policy
            </button>
            <button type="button" onClick={exportApproved} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700">
              <Download className="h-4 w-4" /> Export approved CSV
            </button>
          </div>
        }
      />

      {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</div>}
      {success && <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{success}</div>}

      {showPolicy && policy && (
        <Card className="mb-4 border-emerald-200 p-4 lg:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-800">Eligibility policy</h3>
              <p className="mt-1 text-xs text-slate-500">Changes apply to new calculations only; every request keeps its original snapshot.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" checked={policy.enabled} onChange={(event) => setPolicy({ ...policy, enabled: event.target.checked })} className="h-4 w-4 accent-emerald-600" /> Requests enabled
            </label>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600">Base rate per kg (Rs.)
              <input type="number" min={1} value={policy.baseRatePerKg} onChange={(event) => setPolicy({ ...policy, baseRatePerKg: Number(event.target.value) })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-600">Advance percentage
              <input type="number" min={1} max={100} value={Math.round(policy.advancePercentage * 100)} onChange={(event) => setPolicy({ ...policy, advancePercentage: Number(event.target.value) / 100 })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            </label>
            <label className="text-xs font-semibold text-slate-600">Maximum advance (Rs.)
              <input type="number" min={1} value={policy.maxAdvanceAmount} onChange={(event) => setPolicy({ ...policy, maxAdvanceAmount: Number(event.target.value) })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            </label>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <CatalogLimits title="Tea packet limits" items={policy.teaPackets} onChange={(teaPackets) => setPolicy({ ...policy, teaPackets })} />
            <CatalogLimits title="Fertilizer limits" items={policy.fertilizers} onChange={(fertilizers) => setPolicy({ ...policy, fertilizers })} />
          </div>
          <button type="button" onClick={() => void savePolicy()} disabled={savingPolicy} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            <Save className="h-4 w-4" /> {savingPolicy ? "Saving…" : "Save policy"}
          </button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Clock3} label="Pending" value={String(counts.pending)} sub="Awaiting review" tone="amber" />
        <StatCard icon={CheckCircle2} label="Approved" value={String(counts.approved)} sub="Ready to process" tone="emerald" />
        <StatCard icon={FileCheck2} label="Fulfilled" value={String(counts.fulfilled)} sub="Completed by office" tone="sky" />
        <StatCard icon={XCircle} label="Rejected" value={String(counts.rejected)} sub="Closed with reason" tone="rose" />
      </div>

      <Card className="mt-4 p-4 lg:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Segmented value={filter} onChange={setFilter} options={[
            { value: "pending", label: `Pending · ${counts.pending}` },
            { value: "approved", label: `Approved · ${counts.approved}` },
            { value: "fulfilled", label: "Fulfilled" },
            { value: "all", label: "All" },
          ]} />
          <button type="button" onClick={() => void loadRequests()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><RefreshCw className="h-4 w-4" /> Refresh list</button>
        </div>

        {loading && <p className="py-8 text-center text-sm text-slate-400">Loading smart requests…</p>}
        {!loading && visible.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No requests in this view.</p>}
        <div className="space-y-3">
          {visible.map((request) => (
            <article key={request.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr_1fr_auto] xl:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${request.requestType === "cash_advance" ? "bg-amber-50 text-amber-600" : request.requestType === "tea_packet" ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600"}`}><RequestTypeIcon type={request.requestType} /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800">{requestLabel(request)}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{request.supplierName} · {request.supplierNo || "No supplier no."}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{new Date(request.requestedAt).toLocaleString()}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs">
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Monthly leaf</span><strong>{NUMBER.format(request.monthlyKgSnapshot)} kg</strong></div>
                  <div className="mt-1 flex justify-between gap-3"><span className="text-slate-500">Office deductions</span><strong>{LKR.format(request.officeDeductionSnapshot)}</strong></div>
                  <div className="mt-1 flex justify-between gap-3"><span className="text-slate-500">Eligible at request</span><strong className="text-emerald-700">{LKR.format(request.eligibleLimitSnapshot)}</strong></div>
                </div>

                <div>
                  <Badge tone={STATUS_TONE[request.status]} dot>{request.status}</Badge>
                  {request.note && <p className="mt-2 text-xs text-slate-500">{request.note}</p>}
                  {request.paymentMethod === "bank_transfer" && request.accountNumber && (
                    <p className="mt-2 rounded-lg bg-sky-50 px-2.5 py-2 text-xs text-sky-800">
                      <strong>{request.bankName}</strong>{request.bankBranch ? ` · ${request.bankBranch}` : ""}<br />
                      {request.accountName} · {request.accountNumber}
                    </p>
                  )}
                  <input value={notes[request.id] ?? request.adminNote} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} placeholder="Office note / rejection reason" className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs" />
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {request.status === "pending" && (
                    <>
                      <button type="button" disabled={busyId === request.id} onClick={() => void decide(request, "approved")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"><Check className="h-3.5 w-3.5" /> Approve</button>
                      <button type="button" disabled={busyId === request.id} onClick={() => void decide(request, "rejected")} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-60"><XCircle className="h-3.5 w-3.5" /> Reject</button>
                    </>
                  )}
                  {request.status === "approved" && <button type="button" disabled={busyId === request.id} onClick={() => void decide(request, "fulfilled")} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"><FileCheck2 className="h-3.5 w-3.5" /> Mark fulfilled</button>}
                </div>
              </div>
            </article>
          ))}
        </div>
      </Card>
    </section>
  );
}

function CatalogLimits({ title, items, onChange }: { title: string; items: ServiceRequestPolicy["teaPackets"]; onChange: (items: ServiceRequestPolicy["teaPackets"]) => void }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-700">{title}</p>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <label key={item.code} className="flex items-center justify-between gap-3 text-xs text-slate-600">
            <span>{item.label}</span>
            <span className="flex items-center gap-2">Max
              <input type="number" min={1} value={item.maxQuantity} onChange={(event) => onChange(items.map((row, rowIndex) => rowIndex === index ? { ...row, maxQuantity: Number(event.target.value) } : row))} className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right" />
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
