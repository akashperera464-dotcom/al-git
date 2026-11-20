import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Coffee,
  FileCheck2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sprout,
  XCircle,
} from "lucide-react";
import { Badge, Card, IconChip, PageHeader, Segmented, StatCard } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import {
  createSupplierServiceRequest,
  fetchServiceRequestEligibility,
  listSupplierServiceRequests,
  subscribeToServiceRequestStatus,
  type EligibilitySnapshot,
  type PaymentMethod,
  type ServiceRequestStatus,
  type ServiceRequestType,
  type SupplierServiceRequest,
} from "@/lib/supplierServiceRequests";

const STATUS_META: Record<ServiceRequestStatus, { tone: "amber" | "emerald" | "rose" | "sky"; icon: typeof Clock3 }> = {
  pending: { tone: "amber", icon: Clock3 },
  approved: { tone: "emerald", icon: CheckCircle2 },
  rejected: { tone: "rose", icon: XCircle },
  fulfilled: { tone: "sky", icon: FileCheck2 },
};

const LKR = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat("en-LK", { maximumFractionDigits: 1 });

function typeIcon(type: ServiceRequestType): ReactNode {
  if (type === "cash_advance") return <Banknote className="h-5 w-5" />;
  if (type === "tea_packet") return <Coffee className="h-5 w-5" />;
  return <Sprout className="h-5 w-5" />;
}

function requestTitle(request: SupplierServiceRequest): string {
  if (request.requestType === "cash_advance") return `${LKR.format(request.requestedAmount)} · ${request.paymentMethod?.replace("_", " ") ?? ""}`;
  return `${request.quantity ?? 0} ${request.unit ?? ""} · ${request.itemLabel ?? request.itemCode ?? ""}`;
}

export function SmartSupplierRequestForm() {
  const { t } = useTranslation();
  const { userUid, notify } = useApp();
  const [type, setType] = useState<ServiceRequestType>("cash_advance");
  const [eligibility, setEligibility] = useState<EligibilitySnapshot | null>(null);
  const [requests, setRequests] = useState<SupplierServiceRequest[]>([]);
  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    const rows = await listSupplierServiceRequests();
    setRequests(rows);
  }, []);

  const loadEligibility = useCallback(async (forceRefresh = false) => {
    const snapshot = await fetchServiceRequestEligibility(forceRefresh);
    setEligibility(snapshot);
    return snapshot;
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchServiceRequestEligibility(false), listSupplierServiceRequests()])
      .then(([snapshot, rows]) => {
        if (!active) return;
        setEligibility(snapshot);
        setRequests(rows);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Request details are unavailable."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  useEffect(() => subscribeToServiceRequestStatus(userUid || null, () => {
    void loadRequests().catch(() => undefined);
  }), [loadRequests, userUid]);

  const catalog = type === "tea_packet" ? eligibility?.policy.teaPackets ?? []
    : type === "fertilizer" ? eligibility?.policy.fertilizers ?? [] : [];
  const selectedItem = catalog.find((entry) => entry.code === itemCode) ?? catalog[0];

  useEffect(() => {
    if (type === "cash_advance" || !catalog.length) return;
    if (!catalog.some((entry) => entry.code === itemCode)) setItemCode(catalog[0].code);
  }, [catalog, itemCode, type]);

  const stats = useMemo(() => ({
    pending: requests.filter((request) => request.status === "pending").length,
    approved: requests.filter((request) => request.status === "approved" || request.status === "fulfilled").length,
    rejected: requests.filter((request) => request.status === "rejected").length,
  }), [requests]);

  const refresh = async () => {
    setRefreshing(true); setError("");
    try { await Promise.all([loadEligibility(true), loadRequests()]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Office data could not be refreshed."); }
    finally { setRefreshing(false); }
  };

  const submit = async () => {
    setSubmitting(true); setError("");
    try {
      const created = type === "cash_advance"
        ? await createSupplierServiceRequest({
            requestType: type,
            amount,
            paymentMethod,
            bankDetails: paymentMethod === "bank_transfer" ? { bankName, branch: bankBranch, accountName, accountNumber } : undefined,
            note,
          })
        : await createSupplierServiceRequest({ requestType: type, itemCode: selectedItem?.code ?? "", quantity, note });
      setRequests((current) => [created, ...current]);
      setAmount(0); setQuantity(1); setNote("");
      await loadEligibility(false);
      notify({
        title: t("smartRequests.submitted", { defaultValue: "Request sent to the office" }),
        body: t("smartRequests.pendingReview", { defaultValue: "It is now waiting for review." }),
        tone: "emerald",
        channel: "system",
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Request could not be submitted.");
    } finally { setSubmitting(false); }
  };

  const categoryOptions: { value: ServiceRequestType; label: string; icon: ReactNode }[] = [
    { value: "cash_advance", label: t("smartRequests.cash", { defaultValue: "Advance" }), icon: <Banknote className="h-4 w-4" /> },
    { value: "tea_packet", label: t("smartRequests.tea", { defaultValue: "Tea" }), icon: <Coffee className="h-4 w-4" /> },
    { value: "fertilizer", label: t("smartRequests.fertilizer", { defaultValue: "Fertilizer" }), icon: <Sprout className="h-4 w-4" /> },
  ];

  const cashInvalid = type === "cash_advance" && (!eligibility || amount <= 0 || amount > eligibility.eligibleAmount);
  const bankInvalid = type === "cash_advance" && paymentMethod === "bank_transfer" && (!bankName.trim() || !accountName.trim() || !accountNumber.trim());
  const itemInvalid = type !== "cash_advance" && (!selectedItem || quantity <= 0 || quantity > selectedItem.maxQuantity);
  const canSubmit = Boolean(eligibility?.policy.enabled && eligibility.monthlyKg > 0 && !cashInvalid && !bankInvalid && !itemInvalid && !submitting);

  return (
    <div>
      <PageHeader
        eyebrow={t("smartRequests.eyebrow", { defaultValue: "SMART OFFICE REQUESTS" })}
        title={t("smartRequests.title", { defaultValue: "Request what you need" })}
        desc={t("smartRequests.desc", { defaultValue: "Your current leaf supply is checked securely before the request reaches the office." })}
        icon={<IconChip icon={ShieldCheck} tone="emerald" className="h-12 w-12" />}
      />

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard icon={Clock3} label={t("smartRequests.pending", { defaultValue: "Pending" })} value={String(stats.pending)} tone="amber" />
        <StatCard icon={CheckCircle2} label={t("smartRequests.approved", { defaultValue: "Approved" })} value={String(stats.approved)} tone="emerald" />
        <StatCard icon={XCircle} label={t("smartRequests.rejected", { defaultValue: "Rejected" })} value={String(stats.rejected)} tone="rose" />
      </div>

      <Card className="mt-4 overflow-hidden border-0 bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-0 text-white shadow-lg shadow-emerald-950/15">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">{t("smartRequests.eligible", { defaultValue: "Eligible now" })}</p>
              <p className="mt-1 font-display text-3xl font-black tracking-tight">{loading ? "…" : LKR.format(eligibility?.eligibleAmount ?? 0)}</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-100/80">
                {eligibility ? `${NUMBER.format(eligibility.monthlyKg)} kg × ${LKR.format(eligibility.baseRatePerKg)} × ${Math.round(eligibility.advancePercentage * 100)}%` : t("smartRequests.waitingOffice", { defaultValue: "Waiting for office data" })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-60"
              aria-label={t("common.refresh", { defaultValue: "Refresh" })}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2.5">
              <p className="text-[11px] text-emerald-100/70">{t("smartRequests.deductions", { defaultValue: "Office deductions" })}</p>
              <p className="mt-0.5 text-sm font-bold">{LKR.format(eligibility?.officeDeductions ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2.5">
              <p className="text-[11px] text-emerald-100/70">{t("smartRequests.committed", { defaultValue: "Pending / approved" })}</p>
              <p className="mt-0.5 text-sm font-bold">{LKR.format(eligibility?.committedAdvances ?? 0)}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 bg-black/10 px-4 py-2.5 text-[11px] text-emerald-100/75">
          {t("smartRequests.snapshotNote", { defaultValue: "Checked from the Factory Office record. Final eligibility is checked again when you submit." })}
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <h3 className="font-display text-base font-bold text-slate-800 dark:text-slate-100">{t("smartRequests.newRequest", { defaultValue: "New request" })}</h3>
        <div className="mt-3">
          <Segmented
            value={type}
            onChange={(value) => { setType(value); setError(""); }}
            className="w-full overflow-hidden [&>button]:flex-1 [&>button]:justify-center [&>button]:gap-1.5 [&>button]:px-2 [&>button]:text-xs"
            options={categoryOptions}
          />
        </div>

        {type === "cash_advance" ? (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t("smartRequests.amount", { defaultValue: "Amount (Rs.)" })}</span>
              <input
                type="number"
                min={0}
                max={eligibility?.eligibleAmount ?? 0}
                step={100}
                inputMode="decimal"
                value={amount || ""}
                onChange={(event) => setAmount(Math.max(0, Number(event.target.value)))}
                placeholder="0"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base font-bold text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t("smartRequests.receiveBy", { defaultValue: "Receive by" })}</span>
              <span className="relative mt-1.5 block">
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-3 pr-10 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cash">Cash from office</option>
                  <option value="lorry">Through collection lorry</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </span>
            </label>
            {paymentMethod === "bank_transfer" && (
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 sm:grid-cols-2">
                <label className="block min-w-0">
                  <span className="text-xs font-semibold text-slate-600">Bank name</span>
                  <input value={bankName} maxLength={80} onChange={(event) => setBankName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" />
                </label>
                <label className="block min-w-0">
                  <span className="text-xs font-semibold text-slate-600">Branch (optional)</span>
                  <input value={bankBranch} maxLength={80} onChange={(event) => setBankBranch(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" />
                </label>
                <label className="block min-w-0">
                  <span className="text-xs font-semibold text-slate-600">Account holder</span>
                  <input value={accountName} maxLength={120} onChange={(event) => setAccountName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" />
                </label>
                <label className="block min-w-0">
                  <span className="text-xs font-semibold text-slate-600">Account number</span>
                  <input value={accountNumber} maxLength={40} inputMode="numeric" autoComplete="off" onChange={(event) => setAccountNumber(event.target.value.replace(/[^0-9A-Za-z-]/g, ""))} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" />
                </label>
              </div>
            )}
            {amount > (eligibility?.eligibleAmount ?? 0) && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{t("smartRequests.overLimit", { defaultValue: "Amount is above your current eligible limit." })}</p>}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{type === "tea_packet" ? t("smartRequests.packetType", { defaultValue: "Packet type" }) : t("smartRequests.fertilizerType", { defaultValue: "Fertilizer type" })}</span>
              <span className="relative mt-1.5 block">
                <select value={selectedItem?.code ?? ""} onChange={(event) => setItemCode(event.target.value)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-3 pr-10 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                  {catalog.map((entry) => <option key={entry.code} value={entry.code}>{entry.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </span>
            </label>
            <label className="block min-w-0">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t("smartRequests.quantity", { defaultValue: "Quantity" })}</span>
              <input type="number" min={1} max={selectedItem?.maxQuantity ?? 1} inputMode="numeric" value={quantity} onChange={(event) => setQuantity(Math.max(0, Math.floor(Number(event.target.value))))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
              {selectedItem && <span className="mt-1 block text-[11px] text-slate-400">Maximum {selectedItem.maxQuantity} {selectedItem.unit}</span>}
            </label>
          </div>
        )}

        <label className="mt-3 block">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t("smartRequests.note", { defaultValue: "Note (optional)" })}</span>
          <textarea value={note} maxLength={500} rows={2} onChange={(event) => setNote(event.target.value)} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </label>

        {error && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-700">{error}</p>}
        <button type="button" onClick={() => void submit()} disabled={!canSubmit} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">
          <Send className="h-4 w-4" /> {submitting ? t("common.saving", { defaultValue: "Checking & sending…" }) : t("smartRequests.submit", { defaultValue: "Check limit & send request" })}
        </button>
      </Card>

      <div className="mt-5">
        <h3 className="mb-2 px-1 font-display text-base font-bold text-slate-800 dark:text-slate-100">{t("smartRequests.history", { defaultValue: "My request history" })}</h3>
        {!loading && requests.length === 0 && <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">{t("smartRequests.empty", { defaultValue: "No requests yet." })}</p>}
        <div className="space-y-2.5">
          {requests.map((request) => {
            const meta = STATUS_META[request.status];
            const StatusIcon = meta.icon;
            return (
              <Card key={request.id} className="p-3.5">
                <div className="flex items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${request.requestType === "cash_advance" ? "bg-amber-50 text-amber-600" : request.requestType === "tea_packet" ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600"}`}>{typeIcon(request.requestType)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-sm font-bold text-slate-800 dark:text-slate-100">{requestTitle(request)}</p>
                      <Badge tone={meta.tone}><StatusIcon className="mr-1 h-3 w-3" />{request.status}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{new Date(request.requestedAt).toLocaleString()} · {NUMBER.format(request.monthlyKgSnapshot)} kg snapshot</p>
                    {request.note && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{request.note}</p>}
                    {request.adminNote && <p className={`mt-2 rounded-lg px-2.5 py-2 text-xs ${request.status === "rejected" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}><strong>Office:</strong> {request.adminNote}</p>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
