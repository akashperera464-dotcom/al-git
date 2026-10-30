import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { OfficeDataFreshness } from "@/lib/officeApi";

interface OfficeDataStatusProps {
  freshness: OfficeDataFreshness | null;
  fetchedAt?: string;
  error?: string;
  refreshing?: boolean;
  cooldownSeconds?: number;
  onRefresh: () => void;
}

export function OfficeDataStatus({ freshness, fetchedAt, error, refreshing = false, cooldownSeconds = 0, onRefresh }: OfficeDataStatusProps) {
  const { t, i18n } = useTranslation();
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const updatedLabel = useMemo(() => {
    if (!fetchedAt) return t("officeData.notUpdated");
    const elapsedMinutes = Math.max(0, Math.floor((clock - new Date(fetchedAt).getTime()) / 60_000));
    if (elapsedMinutes < 1) return t("officeData.justNow");
    if (elapsedMinutes < 60) return t("officeData.minutesAgo", { count: elapsedMinutes });
    return new Date(fetchedAt).toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" });
  }, [clock, fetchedAt, i18n.language, t]);

  const stale = freshness === "stale-cache";
  const available = freshness != null;
  const initialLoading = refreshing && !available;
  return (
    <div className={`mb-4 rounded-xl border p-3 ${initialLoading ? "border-slate-200 bg-slate-50" : stale ? "border-amber-200 bg-amber-50" : available ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}>
      <div className="flex items-center gap-2">
        {initialLoading ? <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-slate-500" /> : stale || !available ? <AlertTriangle className={`h-4 w-4 shrink-0 ${stale ? "text-amber-600" : "text-rose-600"}`} /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-bold ${initialLoading ? "text-slate-700" : stale ? "text-amber-800" : available ? "text-emerald-800" : "text-rose-800"}`}>
            {initialLoading ? t("officeData.refreshing") : stale ? t("officeData.cached") : available ? t("officeData.available") : t("officeData.unavailable")}
          </p>
          <p className="text-[10px] text-slate-600">{t("officeData.lastUpdated", { time: updatedLabel })}</p>
          {stale && <p className="mt-0.5 text-[10px] font-semibold text-amber-700">{t("officeData.cachedWarning")}</p>}
          {!available && error && <p className="mt-0.5 truncate text-[10px] text-rose-700">{error}</p>}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || cooldownSeconds > 0}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-current/20 bg-white/80 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? t("officeData.refreshing") : cooldownSeconds > 0 ? `${cooldownSeconds}s` : t("officeData.refresh")}
        </button>
      </div>
    </div>
  );
}
