import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw } from "lucide-react";
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

/**
 * Office sync banner — Dalu Plus Stitch style.
 * Unavailable  → error-container (rose tint) with white refresh button.
 * Stale cache  → warning-container (amber tint).
 * Available    → success-container (green tint).
 */
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
  }, [clock, fetchedAt, i18n, t]);

  const stale = freshness === "stale-cache";
  const available = freshness != null;
  const initialLoading = refreshing && !available;

  const tone = initialLoading
    ? { box: "border-dalu-outline-variant bg-white", icon: <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-dalu-on-surface-variant" />, iconChip: "bg-dalu-surface-container text-dalu-on-surface-variant", title: "text-dalu-on-surface", sub: "text-dalu-on-surface-variant", btn: "border-dalu-outline-variant bg-white text-dalu-on-surface-variant" }
    : !available
      ? { box: "border-dalu-error/25 bg-dalu-error-container", icon: <CloudOff className="h-4 w-4 shrink-0 text-dalu-on-error-container" />, iconChip: "bg-white/70 text-dalu-on-error-container", title: "text-dalu-on-error-container", sub: "text-dalu-on-error-container/80", btn: "border-dalu-error/25 bg-white text-dalu-on-error-container" }
      : stale
        ? { box: "border-dalu-warning/25 bg-dalu-warning-container", icon: <AlertTriangle className="h-4 w-4 shrink-0 text-dalu-on-warning-container" />, iconChip: "bg-white/70 text-dalu-on-warning-container", title: "text-dalu-on-warning-container", sub: "text-dalu-on-warning-container/80", btn: "border-dalu-warning/25 bg-white text-dalu-on-warning-container" }
        : { box: "border-dalu-success/25 bg-dalu-success-container", icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-dalu-on-success-container" />, iconChip: "bg-white/70 text-dalu-on-success-container", title: "text-dalu-on-success-container", sub: "text-dalu-on-success-container/80", btn: "border-dalu-success/25 bg-white text-dalu-on-success-container" };

  return (
    <div className={`mb-4 flex items-center gap-2.5 rounded-2xl border p-3 ${tone.box}`} role="status">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.iconChip}`}>{tone.icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-bold ${tone.title}`}>
          {initialLoading ? t("officeData.refreshing") : stale ? t("officeData.cached") : available ? t("officeData.available") : t("officeData.unavailable")}
        </p>
        <p className={`truncate text-[10px] ${tone.sub}`}>{t("officeData.lastUpdated", { time: updatedLabel })}</p>
        {stale && <p className="mt-0.5 text-[10px] font-semibold text-dalu-on-warning-container">{t("officeData.cachedWarning")}</p>}
        {!available && error && <p className="mt-0.5 truncate text-[10px] text-dalu-on-error-container">{error}</p>}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing || cooldownSeconds > 0}
        className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${tone.btn}`}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? t("officeData.refreshing") : cooldownSeconds > 0 ? `${cooldownSeconds}s` : t("officeData.refresh")}
      </button>
    </div>
  );
}
