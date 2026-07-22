import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PackageOpen, Send, Users, Wrench, Clock, CalendarDays, FileText, CheckCircle2, XCircle, Clock3, Sprout, FlaskConical, Package } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip, Segmented } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import {
  workerRoleOptions,
  CURRENT_SUPPLIER,
  fmtNum,
  addDays,
  TODAY_ISO,
  type RequestType,
  type ResourceRequest,
  type RealAvailability,
} from "@/lib/data";
import { getRealWorkerAvailability, getRealStockAvailability } from "@/lib/repo.phase2";

const STATUS_META: Record<ResourceRequest["status"], { tone: "amber" | "emerald" | "rose"; icon: typeof Clock3; labelKey: string }> = {
  PENDING: { tone: "amber", icon: Clock3, labelKey: "request.pendingReview" },
  APPROVED: { tone: "emerald", icon: CheckCircle2, labelKey: "request.approved" },
  REJECTED: { tone: "rose", icon: XCircle, labelKey: "request.rejected" },
};

function timeAgo(ts: number, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return t("request.agoM", { m });
  const h = Math.round(m / 60);
  if (h < 24) return t("request.agoH", { h });
  return t("request.agoD", { d: Math.round(h / 24) });
}

/** Supplier Portal · "Request Resources" tab (mobile-first). */
export function SupplierRequestForm() {
  const { t } = useTranslation();
  const { resourceRequests, submitRequest, notify } = useApp();
  const [type, setType] = useState<RequestType>("Workers");
  const [item, setItem] = useState(workerRoleOptions[0]);
  const [quantity, setQuantity] = useState(4);
  const [dateNeeded, setDateNeeded] = useState(`${addDays(TODAY_ISO, 1)}T06:00`);
  const [duration, setDuration] = useState(1);
  const [note, setNote] = useState("");

  // Real availability from DB
  const [availabilities, setAvailabilities] = useState<RealAvailability[]>([]);
  const [selectedStockItemId, setSelectedStockItemId] = useState<string | undefined>();

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

  const onTypeChange = (newType: RequestType) => {
    setType(newType);
    const items = availabilities.filter(a => a.type === newType);
    if (items.length > 0) {
      setItem(items[0].itemName);
      setSelectedStockItemId(items[0].stockItemId);
    } else {
      setItem(workerRoleOptions[0]);
      setSelectedStockItemId(undefined);
    }
  };

  const currentAvail = availabilities.find(a => a.type === type && a.itemName === item);
  const available = currentAvail?.available ?? 0;

  const submit = () => {
    if (quantity <= 0) return;
    submitRequest({ type, itemDetails: item, quantity, dateNeeded, durationDays: duration, note: note.trim() });
    notify({
      title: t("request.submitted"),
      body: t("request.submittedBody", { qty: String(quantity), item }),
      tone: "sky",
      channel: "system",
    });
    setNote("");
    setQuantity(4);
  };

  const mine = resourceRequests.filter((r) => r.supplierId === CURRENT_SUPPLIER.id);
  const pending = mine.filter((r) => r.status === "PENDING").length;
  const approved = mine.filter((r) => r.status === "APPROVED").length;
  const rejected = mine.filter((r) => r.status === "REJECTED").length;

  const typeOptions = availabilities.length > 0
    ? [
        { value: "Workers", label: t("request.workers"), icon: <Users className="h-3.5 w-3.5" /> },
        { value: "Equipment", label: t("request.equipment"), icon: <Wrench className="h-3.5 w-3.5" /> },
        { value: "Fertilizer", label: "Fertilizer", icon: <Sprout className="h-3.5 w-3.5" /> },
        { value: "Agrochemical", label: "Agrochemical", icon: <FlaskConical className="h-3.5 w-3.5" /> },
      ]
    : [
        { value: "Workers", label: t("request.workers"), icon: <Users className="h-3.5 w-3.5" /> },
        { value: "Equipment", label: t("request.equipment"), icon: <Wrench className="h-3.5 w-3.5" /> },
      ];

  const itemsForType = availabilities.filter(a => a.type === type);
  const iconForType = type === "Equipment" ? <Wrench className="h-5 w-5" />
    : type === "Fertilizer" ? <Sprout className="h-5 w-5" />
    : type === "Agrochemical" ? <FlaskConical className="h-5 w-5" />
    : <Users className="h-5 w-5" />;
  const bgForType = type === "Equipment" ? "bg-sky-50 text-sky-600"
    : type === "Fertilizer" ? "bg-emerald-50 text-emerald-600"
    : type === "Agrochemical" ? "bg-violet-50 text-violet-600"
    : "bg-amber-50 text-amber-600";

  return (
    <div>
      <PageHeader
        eyebrow={t("request.eyebrow")}
        title={t("request.title")}
        desc={t("request.desc")}
        icon={<IconChip icon={PackageOpen} tone="violet" className="h-12 w-12" />}
      />

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard icon={Clock3} label={t("request.pending")} value={String(pending)} tone="amber" />
        <StatCard icon={CheckCircle2} label={t("request.approved")} value={String(approved)} tone="emerald" />
        <StatCard icon={XCircle} label={t("request.rejected")} value={String(rejected)} tone="rose" />
      </div>

      {/* Request form */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">{t("request.newRequisition")}</h3>

        <div className="mb-3">
          <label className="text-[11px] font-medium text-slate-400">{t("request.requestType")}</label>
          <div className="mt-1.5">
            <Segmented
              value={type}
              onChange={onTypeChange}
              className="w-full"
              options={typeOptions}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-[11px] font-medium text-slate-400">
              {type === "Equipment" ? t("request.equipmentLabel")
                : type === "Fertilizer" ? "Fertilizer Type"
                : type === "Agrochemical" ? "Chemical Type"
                : t("request.workerRole")}
            </label>
            <select value={item} onChange={(e) => {
              setItem(e.target.value);
              const found = availabilities.find(a => a.type === type && a.itemName === e.target.value);
              setSelectedStockItemId(found?.stockItemId);
            }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm">
              {itemsForType.length > 0
                ? itemsForType.map((a) => (
                    <option key={a.itemName} value={a.itemName}>
                      {a.itemName} ({fmtNum(a.available)} {a.unit} {t("request.avail")})
                    </option>
                  ))
                : type === "Workers"
                  ? workerRoleOptions.map((w) => <option key={w} value={w}>{w}</option>)
                  : <option value="">— loading —</option>
              }
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400">{t("request.quantityNeeded")}</label>
            <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(0, +e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm tnum" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400">{t("request.dateTimeNeeded")}</label>
            <input type="datetime-local" value={dateNeeded} onChange={(e) => setDateNeeded(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-400">{t("request.durationDays")}</label>
            <input type="number" min={1} value={duration} onChange={(e) => setDuration(Math.max(1, +e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm tnum" />
          </div>
        </div>

        <div className="mt-2.5">
          <label className="text-[11px] font-medium text-slate-400">{t("request.noteOptional")}</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t("request.notePh")} className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
        </div>

        {/* live availability cross-reference — REAL DATA */}
        {available > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 text-slate-500">
              <FileText className="h-3.5 w-3.5" /> {t("request.currentPool")}
            </span>
            <span className={`font-bold ${quantity > available ? "text-rose-600" : "text-emerald-600"}`}>
              {fmtNum(available)} {currentAvail?.unit ?? t("request.available")} {quantity > available && t("request.exceedsPool")}
            </span>
          </div>
        )}

        <button
          onClick={submit}
          disabled={quantity <= 0}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> {t("request.submit")}
        </button>
      </Card>

      {/* Status tracking — supplier's own requests */}
      <div className="mt-4">
        <h3 className="mb-2 px-1 font-display text-sm font-bold text-slate-800">{t("request.myRequests")}</h3>
        {mine.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">{t("request.noRequests")}</p>}
        <div className="space-y-2.5">
          {mine.map((r) => {
            const meta = STATUS_META[r.status];
            const reqIcon = r.type === "Equipment" ? <Wrench className="h-5 w-5" />
              : r.type === "Fertilizer" ? <Sprout className="h-5 w-5" />
              : r.type === "Agrochemical" ? <FlaskConical className="h-5 w-5" />
              : <Users className="h-5 w-5" />;
            const reqBg = r.type === "Equipment" ? "bg-sky-50 text-sky-600"
              : r.type === "Fertilizer" ? "bg-emerald-50 text-emerald-600"
              : r.type === "Agrochemical" ? "bg-violet-50 text-violet-600"
              : "bg-amber-50 text-amber-600";
            return (
              <Card key={r.id} className="p-3.5">
                <div className="flex items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${reqBg}`}>
                    {reqIcon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-slate-800">
                        {r.quantity}× {r.itemDetails}
                      </p>
                      <Badge tone={meta.tone} dot>
                        {t(meta.labelKey)}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" /> {r.dateNeeded.replace("T", " · ")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {t("request.durationShort", { d: r.durationDays })}
                      </span>
                      <span>{timeAgo(r.timestamp, t)}</span>
                    </div>
                    {r.note && <p className="mt-1 text-xs text-slate-500">"{r.note}"</p>}
                    {r.adminNotes && (
                      <div className={`mt-1.5 rounded-lg px-2.5 py-1.5 text-[11px] ${r.status === "REJECTED" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                        <span className="font-semibold">{t("request.adminLabel")}</span> {r.adminNotes}
                      </div>
                    )}
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
