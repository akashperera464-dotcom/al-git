import { Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EtaResult } from "@/lib/etaCalculation";

export function EtaBanner({ eta }: { eta: EtaResult }) {
  const { t } = useTranslation();
  const tone = eta.band === "red" ? "border-rose-200 bg-rose-50 text-rose-700" : eta.band === "amber" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <div className={`flex items-center gap-2 border-b px-3.5 py-2 text-xs font-bold ${tone}`}><Truck className="h-4 w-4" />{eta.arrived ? t("lorry.approaching") : `${t("lorry.distance")}: ${eta.distanceKm.toFixed(1)} km · ${t("lorry.eta")}: ${eta.etaMinutes} min`}</div>;
}
