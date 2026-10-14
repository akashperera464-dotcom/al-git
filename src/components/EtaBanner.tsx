import { Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EtaResult } from "@/lib/etaCalculation";

export function EtaBanner({ eta }: { eta: EtaResult }) {
  const { t } = useTranslation();
  const tone = eta.band === "red" ? "border-rose-200 bg-rose-50 text-rose-700" : eta.band === "amber" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const distance = eta.distanceKm < 1 ? eta.distanceKm.toFixed(2) : eta.distanceKm.toFixed(1);
  return <div className={`flex items-start gap-2 border-b px-3.5 py-2.5 text-xs font-bold ${tone}`}>
    <Truck className="mt-0.5 h-4 w-4 shrink-0" />
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span>{t("lorry.distanceReading", { distance })}</span>
      <span aria-hidden="true" className="hidden opacity-50 sm:inline">|</span>
      <span>{eta.arrived ? t("lorry.approaching") : t("lorry.etaReading", { minutes: eta.etaMinutes })}</span>
    </div>
  </div>;
}
