import { useEffect, useMemo, useState } from "react";
import { Leaf, Package, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, Card, IconChip, PageHeader, StatCard } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { statusKey } from "@/i18n/databaseValues";
import { fmtLKR, fmtNum, type SupplyRecord } from "@/lib/data";
import { readMyHarvestRecords } from "@/lib/repo";
import { readDailyTeaPrices } from "@/lib/supplierOperations";
import { useLiveData } from "@/lib/useLiveData";

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
  const { data: records, loading } = useLiveData<SupplyRecord>(
    "harvest_records",
    // Round 11 multi-estate: supplier ownership, not one legacy primary estate,
    // scopes the feed. Records from every owned estate remain visible.
    () => readMyHarvestRecords(userUid),
    `supplier_id=eq.${userUid}`,
  );

  useEffect(() => {
    void readDailyTeaPrices()
      .then((rows) => setPrices(Object.fromEntries(rows.map((row) => [row.grade, row.pricePerKg]))))
      .catch(() => setPrices({}));
  }, []);

  const monthRecords = useMemo(
    () => records.filter((record) => record.date.startsWith(sriLankaMonth())),
    [records],
  );

  const amountFor = (record: SupplyRecord) => record.amount || record.kg * (prices[record.grade] ?? 0);
  const breakdown = useMemo(() => {
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

  const dailyRows = useMemo(() => {
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

  const totalKg = breakdown.normal.kg + breakdown.super.kg;
  const totalAmount = breakdown.normal.amount + breakdown.super.amount;
  const superPercentage = totalKg ? Math.round((breakdown.super.kg / totalKg) * 100) : 0;

  return (
    <div>
      <PageHeader
        eyebrow={t("supplier.eyebrow")}
        title={t("supplier.deliveries")}
        desc={t("supplier.deliveriesDesc")}
        icon={<IconChip icon={Package} tone="emerald" className="h-12 w-12" />}
      />

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
              </div>
              <Badge tone={record.status === "Paid" ? "emerald" : "amber"}>{t(statusKey(record.status), { defaultValue: record.status })}</Badge>
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
