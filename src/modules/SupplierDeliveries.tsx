import { useEffect, useMemo, useState } from "react";
import { Download, Leaf, MessageSquareWarning, Package, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, Card, IconChip, PageHeader, StatCard } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { statusKey } from "@/i18n/databaseValues";
import { fmtLKR, fmtNum, type SupplyRecord } from "@/lib/data";
import { readMyHarvestRecords } from "@/lib/repo";
import { readDailyTeaPrices, readUserOperationalProfile } from "@/lib/supplierOperations";
import { useLiveData } from "@/lib/useLiveData";
import { readSupplierFinancialSummary, type SupplierFinancialSummary } from "@/lib/financialSummary";
import { createWorkflowRequest, readUserNames } from "@/lib/connectedOperations";
import { readMyEstates } from "@/lib/estateRepo";
import { fetchOfficeBalance, fetchOfficeMonthly } from "@/lib/officeApi";
import type { OfficeBalanceResponse, OfficeLeafResponse } from "@/lib/officeApiContracts";

type LeafGroup = "normal" | "super";

// DB values remain stable while the supplier sees the professional labels
// "Normal Leaf" and "Super Leaf" in the selected application language.
const SUPER_LEAF_VALUES = new Set(["super", "pv super", "super leaf", "pv_super", "super_leaf"]);

function leafGroup(grade: string): LeafGroup {
  return SUPER_LEAF_VALUES.has(grade.trim().toLowerCase()) ? "super" : "normal";
}

function sriLankaMonth(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Asia/Colombo",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

export function SupplierDeliveries() {
  const { t } = useTranslation();
  const { userUid } = useApp();
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [financial, setFinancial] = useState<SupplierFinancialSummary | null>(null);
  const [collectorNames, setCollectorNames] = useState<Record<string, string>>({});
  const [estateNames, setEstateNames] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [officeLeaf, setOfficeLeaf] = useState<OfficeLeafResponse | null>(null);
  const [officeBalance, setOfficeBalance] = useState<OfficeBalanceResponse | null>(null);
  const { data: records, loading } = useLiveData<SupplyRecord>(
    "harvest_records",
    // Round 11 multi-estate: supplier ownership, not one legacy primary estate,
    // scopes the feed. Records from every owned estate remain visible.
    () => readMyHarvestRecords(userUid),
    `supplier_id=eq.${userUid}`,
  );

  useEffect(() => {
    void readSupplierFinancialSummary(userUid, sriLankaMonth()).then(setFinancial).catch(() => setFinancial(null));
    void readUserOperationalProfile(userUid)
      .then((profile) => readDailyTeaPrices(undefined, profile?.factoryId))
      .then((rows) => setPrices(Object.fromEntries(rows.map((row) => [row.grade, row.pricePerKg]))))
      .catch(() => setPrices({}));
  }, [userUid]);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([fetchOfficeMonthly(controller.signal), fetchOfficeBalance(controller.signal)])
      .then(([leaf, balance]) => { setOfficeLeaf(leaf); setOfficeBalance(balance); })
      .catch(() => { setOfficeLeaf(null); setOfficeBalance(null); });
    return () => controller.abort();
  }, [userUid]);

  useEffect(() => {
    void readUserNames(records.map((record) => record.collectorId ?? "")).then(setCollectorNames);
    void readMyEstates(userUid).then((rows) => setEstateNames(Object.fromEntries(rows.map((row) => [row.id, row.name])))).catch(() => setEstateNames({}));
  }, [records, userUid]);

  const monthRecords = useMemo(
    () => records.filter((record) => record.recordStatus !== "void" && record.date.startsWith(sriLankaMonth())),
    [records],
  );

  const amountFor = (record: SupplyRecord) => record.amount || record.kg * (prices[record.grade] ?? 0);
  const emsBreakdown = useMemo(() => {
    const result: Record<LeafGroup, { kg: number; amount: number }> = {
      normal: { kg: 0, amount: 0 },
      super: { kg: 0, amount: 0 },
    };
    for (const record of monthRecords) {
      const group = leafGroup(record.grade);
      result[group].kg += record.kg;
      result[group].amount += amountFor(record);
    }
    return result;
  }, [monthRecords, prices]);

  const emsDailyRows = useMemo(() => {
    const grouped = new Map<string, Record<LeafGroup, { kg: number; amount: number }>>();
    for (const record of monthRecords) {
      const date = record.date.slice(0, 10);
      const row = grouped.get(date) ?? {
        normal: { kg: 0, amount: 0 },
        super: { kg: 0, amount: 0 },
      };
      const group = leafGroup(record.grade);
      row[group].kg += record.kg;
      row[group].amount += amountFor(record);
      grouped.set(date, row);
    }
    return [...grouped.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [monthRecords, prices]);

  const breakdown = useMemo(() => officeLeaf ? {
    normal: { kg: officeLeaf.totals.normalLeafQty, amount: officeLeaf.totals.normalLeafQty * (officeBalance?.currentMonth.normalLeafRate ?? 0) },
    super: { kg: officeLeaf.totals.superLeafQty, amount: officeLeaf.totals.superLeafQty * (officeBalance?.currentMonth.superLeafRate ?? 0) },
  } : emsBreakdown, [emsBreakdown, officeBalance, officeLeaf]);
  const dailyRows = useMemo(() => officeLeaf ? officeLeaf.deliveries.map((row) => [row.date, {
    normal: { kg: row.normalLeafQty, amount: row.normalLeafQty * (officeBalance?.currentMonth.normalLeafRate ?? 0) },
    super: { kg: row.superLeafQty, amount: row.superLeafQty * (officeBalance?.currentMonth.superLeafRate ?? 0) },
  }] as const).sort(([a], [b]) => b.localeCompare(a)) : emsDailyRows, [emsDailyRows, officeBalance, officeLeaf]);
  const totalKg = breakdown.normal.kg + breakdown.super.kg;
  const totalAmount = officeBalance?.currentMonth.totalGrossPay ?? financial?.grossEarnings ?? 0;
  const superPercentage = totalKg ? Math.round((breakdown.super.kg / totalKg) * 100) : 0;

  const downloadStatement = async () => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFontSize(16); pdf.text("Estate Pulse · Monthly Supplier Statement", 14, 18);
    pdf.setFontSize(10); pdf.text(`Month: ${sriLankaMonth()}   Supplier: ${userUid}`, 14, 27);
    pdf.text(`Total leaf: ${fmtNum(totalKg)} kg   Gross earnings: ${fmtLKR(totalAmount)}`, 14, 34);
    let y = 45;
    for (const record of monthRecords) {
      pdf.text(`${record.receiptNo ?? record.id.slice(0,8)} | ${record.date.slice(0,10)} | ${record.grade} | ${fmtNum(record.kg)} kg | ${fmtLKR(amountFor(record))}`, 14, y);
      y += 7; if (y > 280) { pdf.addPage(); y = 18; }
    }
    pdf.save(`estate-pulse-statement-${sriLankaMonth()}.pdf`);
  };

  const dispute = async (record: SupplyRecord) => {
    const reason = window.prompt(t("supplierDelivery.disputeReason", { defaultValue: "Explain what is wrong with this delivery" }));
    if (!reason?.trim()) return;
    try { await createWorkflowRequest({ requestType: "weight_dispute", requestedBy: userUid, relatedEntityType: "harvest_record", relatedEntityId: record.id, subject: `Delivery dispute · ${record.receiptNo ?? record.id}`, details: { reason: reason.trim(), receiptNo: record.receiptNo, kg: record.kg, grade: record.grade } }); setMessage(t("supplierDelivery.disputeSubmitted", { defaultValue: "Dispute submitted for administrator review." })); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Dispute could not be submitted."); }
  };

  return (
    <div>
      <PageHeader
        eyebrow={t("supplier.eyebrow")}
        title={t("supplier.deliveries")}
        desc={t("supplier.deliveriesDesc")}
        icon={<IconChip icon={Package} tone="emerald" className="h-12 w-12" />}
        actions={<button onClick={() => void downloadStatement()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"><Download className="h-4 w-4" />{t("supplierDelivery.downloadStatement", { defaultValue: "Download statement" })}</button>}
      />

      {message && <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">{message}</p>}
      <p className="mb-3 text-center text-[10px] font-semibold text-slate-400">{officeLeaf ? `Live source: Factory office system · ${officeLeaf.monthName}` : "Source: EMS records"}</p>

      <Card className="mb-4 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-800">{t("supplierDelivery.gradeBreakdown")}</h2>
            <p className="text-[11px] text-slate-400">{t("supplierDelivery.currentMonth")}</p>
          </div>
          <strong className="text-sm text-emerald-700">{fmtLKR(totalAmount)}</strong>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <GradeCard
            label={t("supplierDelivery.normalLeaf")}
            kg={breakdown.normal.kg}
            amount={breakdown.normal.amount}
            tone="amber"
          />
          <GradeCard
            label={t("supplierDelivery.superLeaf")}
            kg={breakdown.super.kg}
            amount={breakdown.super.amount}
            tone="emerald"
          />
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <StatCard icon={Package} label={t("supplier.netSupplied")} value={`${fmtNum(totalKg)} kg`} tone="sky" />
        <StatCard icon={Leaf} label={t("supplierDelivery.superLeaf")} value={`${fmtNum(breakdown.super.kg)} kg`} tone="emerald" />
        <StatCard icon={TrendingUp} label={t("supplier.superGrade")} value={`${superPercentage}%`} tone="violet" />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-800">{t("supplierDelivery.dailyBreakdown")}</h3>
        </div>
        {loading && <p className="p-5 text-center text-xs text-slate-400">{t("supplier.syncingDeliveries")}</p>}
        {!loading && dailyRows.length === 0 && <p className="p-6 text-center text-sm text-slate-400">{t("supplier.noDeliveries")}</p>}
        <div className="divide-y divide-slate-100">
          {dailyRows.map(([date, row]) => (
            <div key={date} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <strong className="text-xs text-slate-700">{date}</strong>
                <Badge tone="slate">{fmtLKR(row.normal.amount + row.super.amount)}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-amber-800">
                  {t("supplierDelivery.normalLeaf")}<br /><strong>{fmtNum(row.normal.kg)} kg · {fmtLKR(row.normal.amount)}</strong>
                </p>
                <p className="rounded-lg bg-emerald-50 px-2.5 py-2 text-emerald-800">
                  {t("supplierDelivery.superLeaf")}<br /><strong>{fmtNum(row.super.kg)} kg · {fmtLKR(row.super.amount)}</strong>
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {records.length > 0 && (
        <div className="mt-4 space-y-2">
          {records.slice(0, 10).map((record) => (
            <Card key={record.id} className="flex items-center gap-3 p-3">
              <Leaf className="h-4 w-4 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800">{record.date.slice(0, 10)} · {fmtNum(record.kg)} kg</p>
                <p className="text-[11px] text-slate-400">{leafGroup(record.grade) === "super" ? t("supplierDelivery.superLeaf") : t("supplierDelivery.normalLeaf")} · {fmtLKR(amountFor(record))}</p>
                <p className="text-[10px] text-slate-400">{record.receiptNo ?? t("supplierDelivery.receiptPending", { defaultValue: "Receipt pending" })} · {(estateNames[record.estateId] ?? record.estateId) || "—"} · {record.collectorId ? collectorNames[record.collectorId] ?? record.collectorId : "—"}{record.lorryPlate ? ` · ${record.lorryPlate}` : ""}</p>
              </div>
              <div className="flex flex-col items-end gap-1"><Badge tone={record.status === "Paid" ? "emerald" : "amber"}>{t(statusKey(record.status), { defaultValue: record.status })}</Badge><button onClick={() => void dispute(record)} className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600"><MessageSquareWarning className="h-3 w-3" />{t("supplierDelivery.dispute", { defaultValue: "Dispute" })}</button></div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function GradeCard({ label, kg, amount, tone }: { label: string; kg: number; amount: number; tone: "amber" | "emerald" }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === "emerald" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <p className={`text-xs font-bold ${tone === "emerald" ? "text-emerald-800" : "text-amber-800"}`}>{label}</p>
      <p className="mt-1 text-lg font-extrabold text-slate-800">{fmtNum(kg)} kg</p>
      <p className="text-xs font-semibold text-slate-600">{fmtLKR(amount)}</p>
    </div>
  );
}

export default SupplierDeliveries;
