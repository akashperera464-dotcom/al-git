import { useTranslation } from "react-i18next";
import { Sprout, CalendarDays, TrendingDown, Package, AlertTriangle } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { useLiveData } from "@/lib/useLiveData";
import { fmtNum } from "@/lib/data";
import { readSupplierLedger, readSupplierActivities } from "@/lib/supplierData";

export function SupplierFertilizer() {
  const { t } = useTranslation();
  const { userUid } = useApp();
  const { data: ledger, error: ledgerError } = useLiveData(
    "supplier_fertilizer_ledger", () => readSupplierLedger(userUid), `supplier_id=eq.${userUid}`);
  const { data: activities, error: activityError } = useLiveData(
    "farm_activities", () => readSupplierActivities(userUid), `user_id=eq.${userUid}`);
  const usedKg = activities.filter(a => a.activityType === "fertilizer")
    .reduce((sum, a) => sum + Number(a.details.quantityKg ?? 0), 0);

  // Aggregate stats
  const totalReceivedKg = ledger
    .filter(e => e.unit === "kg")
    .reduce((sum, e) => sum + e.qtyIssued, 0);
  const totalReceivedBags = ledger
    .filter(e => e.unit === "bag" || e.unit === "bags")
    .reduce((sum, e) => sum + e.qtyIssued, 0);
  const creditEntries = ledger.filter(e =>
    e.paymentMode === "credit" && !e.settled
  );
  const totalCreditKg = creditEntries
    .filter(e => e.unit === "kg")
    .reduce((sum, e) => sum + e.qtyIssued, 0);

  // Remaining balance (rough estimate — assumes 1 bag = 50 kg)
  const usedKgEquiv = usedKg;
  const remainingKg = Math.max(0, totalReceivedKg + (totalReceivedBags * 50) - usedKgEquiv);

  return (
    <div>
      {(ledgerError || activityError) && <p role="alert" className="mb-4 text-sm text-rose-700">{ledgerError || activityError}</p>}
      <PageHeader
        eyebrow={t("supplierFert.eyebrow")}
        title={t("supplierFert.title")}
        desc={t("supplierFert.desc")}
        icon={<IconChip icon={Sprout} tone="emerald" className="h-12 w-12" />}
      />

      {/* Stats overview */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={Package}
          label={t("supplierFert.totalReceived")}
          value={fmtNum(totalReceivedKg)}
          sub={`${ledger.length} ${t("supplierFert.issues")}`}
          tone="emerald"
        />
        <StatCard
          icon={TrendingDown}
          label={t("supplierFert.used")}
          value={fmtNum(usedKg)}
          sub={t("supplierFert.fromFarm")}
          tone="sky"
        />
        {usedKg === 0 && (
          <p className="col-span-2 sm:col-span-4 mt-1 text-[10px] text-slate-400 text-center leading-relaxed">
            💡 {t("supplierFert.noLogs")}<br />
            {t("supplierFert.logHint")}
          </p>
        )}
        <StatCard
          icon={CalendarDays}
          label={t("supplierFert.remaining")}
          value={fmtNum(remainingKg)}
          sub={t("supplierFert.estimated")}
          tone={remainingKg < 50 ? "rose" : "amber"}
        />
        <StatCard
          icon={AlertTriangle}
          label={t("supplierFert.creditOutstanding")}
          value={fmtNum(totalCreditKg)}
          sub={t("supplierFert.deductedFromLeaf")}
          tone="rose"
        />
      </div>

      {/* History */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">{t("supplierFert.historyTitle")}</h3>
        {ledger.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-400">{t("supplierFert.emptyMsg")}</p>
            <p className="mt-1 text-[11px] text-slate-400">
              {t("supplierFert.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {ledger.map(e => {
              const isCredit = e.paymentMode === "credit";
              const division = (e.notes || "").match(/division:([^|]+)/i)?.[1]?.trim();
              return (
                <div key={e.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {fmtNum(e.qtyIssued)} {e.unit} · {e.stockItemName}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {e.stockItemCode} · {new Date(e.date).toLocaleDateString()}
                        {division && ` · ${division}`}
                      </p>
                    </div>
                    <Badge tone={isCredit ? "amber" : "emerald"} dot>
                      {isCredit ? t("supplierFert.credit") : t("supplierFert.cash")}
                    </Badge>
                  </div>
                  {e.notes && (
                    <p className="mt-1.5 text-[10px] text-slate-500 italic">
                      {e.notes.split("|").slice(-1)[0].trim()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Note about how this works */}
      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-700">
        <p className="font-semibold">{t("supplierFert.howTitle")}</p>
        <ul className="mt-1.5 space-y-1 list-disc list-inside">
          <li>{t("supplierFert.how1")}</li>
          <li>{t("supplierFert.how2")}</li>
          <li>{t("supplierFert.how3")}</li>
          <li>{t("supplierFert.how4")}</li>
          <li>{t("supplierFert.how5")}</li>
        </ul>
        <p className="mt-2 text-[10px] text-sky-600">
          {t("supplierFert.syncNote")}
        </p>
      </div>
    </div>
  );
}
