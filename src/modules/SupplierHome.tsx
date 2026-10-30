import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Leaf, Bell, Wallet, Package, ReceiptText, Sprout, ChevronRight, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, StatCard } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { fmtNum, fmtLKRShort } from "@/lib/data";
import { readFarmActivities, readMyHarvestRecords } from "@/lib/repo";
import { useTranslation } from "react-i18next";
import { readDailyTeaPrices, readUserOperationalProfile, type DailyTeaPrice } from "@/lib/supplierOperations";
import { gradeKey } from "@/i18n/databaseValues";
import { readSupplierFinancialSummary } from "@/lib/financialSummary";
import { useEstateWeather, useSupplierWeatherEstate } from "@/lib/useEstateWeather";
import { fetchOfficeBalanceWithMeta, fetchOfficeCropWithMeta, fetchOfficeMonthlyWithMeta, type OfficeDataFreshness } from "@/lib/officeApi";
import type { OfficeBalanceResponse, OfficeLeafResponse } from "@/lib/officeApiContracts";
import { findOfficeDeliveryForDate, getOfficeCropComparison, sumOfficeDeductionsByGroup, yesterdaySriLankaIso } from "@/lib/officeSupplierSummary";
import { OfficeDataStatus } from "@/components/OfficeDataStatus";

const LorryTracking = lazy(() => import("@/modules/LorryTracking"));

export function SupplierHome() {
  const { t, i18n } = useTranslation();
  const { user, session, setActiveModule, userUid, associatedEntityId, syncQueue, online } = useApp();
  const weatherEstate = useSupplierWeatherEstate(userUid, associatedEntityId);
  const estate = weatherEstate.estate;
  const weather = useEstateWeather(estate?.latitude, estate?.longitude);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const greeting = getGreeting(currentTime);
  const firstName = (session?.name ?? user?.name ?? "Supplier").split(" ")[0];

  const [emsTotalKg, setEmsTotalKg] = useState(0);
  const [emsTotalEarned, setEmsTotalEarned] = useState(0);
  const [emsMonthExpenses, setEmsMonthExpenses] = useState(0);
  const [emsMonthDeliveries, setEmsMonthDeliveries] = useState(0);
  const [officeCrop, setOfficeCrop] = useState<OfficeLeafResponse | null>(null);
  const [officeMonthly, setOfficeMonthly] = useState<OfficeLeafResponse | null>(null);
  const [officeBalance, setOfficeBalance] = useState<OfficeBalanceResponse | null>(null);
  const [officeFreshness, setOfficeFreshness] = useState<OfficeDataFreshness | null>(null);
  const [officeFetchedAt, setOfficeFetchedAt] = useState("");
  const [officeError, setOfficeError] = useState("");
  const [officeLoading, setOfficeLoading] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [prices, setPrices] = useState<DailyTeaPrice[]>([]);
  const [farmLogs, setFarmLogs] = useState<{ activityType: string; loggedDate: string }[]>([]);

  const pendingSync = syncQueue.filter(q => q.status === "queued").length;

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void readFarmActivities(userUid, 100).then(setFarmLogs).catch(() => setFarmLogs([]));

    // B30 (Round #12) — Load deliveries: kg + grade + amount (restored)
    void readMyHarvestRecords(userUid, associatedEntityId).then(recs => {
      const month = new Date().toISOString().slice(0, 7);
      const monthly = recs.filter((record) => record.date.startsWith(month));
      const kg = monthly.reduce((sum, record) => sum + record.kg, 0);
      setEmsTotalKg(kg);
      setEmsMonthDeliveries(monthly.length);
    });
    void readUserOperationalProfile(userUid)
      .then((profile) => readDailyTeaPrices(undefined, profile?.factoryId))
      .then(setPrices)
      .catch(() => setPrices([]));

    // Round 12: one authoritative finance view; no localStorage calculations.
    void readSupplierFinancialSummary(userUid, new Date().toISOString().slice(0, 7))
      .then((summary) => { setEmsTotalEarned(summary?.grossEarnings ?? 0); setEmsMonthExpenses(summary?.totalDeductions ?? 0); })
      .catch(() => { setEmsTotalEarned(0); setEmsMonthExpenses(0); });
  }, [userUid, associatedEntityId, user?.name]);

  const loadOfficeData = useCallback(async (forceRefresh = false, signal?: AbortSignal) => {
    setOfficeLoading(true);
    const results = await Promise.allSettled([
      fetchOfficeCropWithMeta({ signal, forceRefresh }),
      fetchOfficeBalanceWithMeta({ signal, forceRefresh }),
      fetchOfficeMonthlyWithMeta({ signal, forceRefresh }),
    ]);
    if (signal?.aborted) return;
    const [cropResult, balanceResult, monthlyResult] = results;
    if (cropResult.status === "fulfilled") setOfficeCrop(cropResult.value.data);
    if (balanceResult.status === "fulfilled") setOfficeBalance(balanceResult.value.data);
    if (monthlyResult.status === "fulfilled") setOfficeMonthly(monthlyResult.value.data);

    const fulfilled = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    if (fulfilled.length) {
      const freshness = fulfilled.some((result) => result.freshness === "stale-cache") || fulfilled.length !== results.length
        ? "stale-cache"
        : fulfilled.some((result) => result.freshness === "live") ? "live" : "recent-cache";
      const timestamps = fulfilled.map((result) => new Date(result.fetchedAt).getTime()).filter(Number.isFinite);
      setOfficeFreshness(freshness);
      setOfficeFetchedAt(timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : "");
      setOfficeError(fulfilled.find((result) => result.error)?.error ?? "");
    } else {
      const reason = results.find((result): result is PromiseRejectedResult => result.status === "rejected")?.reason;
      setOfficeFreshness(null);
      setOfficeError(reason instanceof Error ? reason.message : "Office data is temporarily unavailable.");
    }
    setOfficeLoading(false);
  }, [userUid]);

  useEffect(() => {
    const controller = new AbortController();
    setOfficeCrop(null); setOfficeBalance(null); setOfficeMonthly(null); setOfficeFreshness(null); setOfficeError("");
    void loadOfficeData(false, controller.signal);
    return () => controller.abort();
  }, [loadOfficeData, userUid]);

  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const timer = window.setInterval(() => setRefreshCooldown((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [refreshCooldown]);

  const refreshOfficeData = () => {
    if (refreshCooldown > 0 || officeLoading) return;
    setRefreshCooldown(30);
    void loadOfficeData(true);
  };

  const totalKg = officeCrop?.totals.totalQty ?? emsTotalKg;
  const monthDeliveries = officeCrop?.totals.deliveryCount ?? emsMonthDeliveries;
  const totalEarned = officeBalance?.currentMonth.totalGrossPay ?? emsTotalEarned;
  const monthExpenses = officeBalance?.currentMonth.totalDeduction ?? emsMonthExpenses;
  const cropComparison = useMemo(() => officeCrop && officeBalance ? getOfficeCropComparison(officeCrop, officeBalance) : null, [officeBalance, officeCrop]);
  const yesterdayDate = useMemo(() => yesterdaySriLankaIso(currentTime), [currentTime]);
  const yesterdayDelivery = useMemo(() => officeMonthly ? findOfficeDeliveryForDate(officeMonthly, yesterdayDate) : null, [officeMonthly, yesterdayDate]);
  const advanceTotal = officeBalance ? sumOfficeDeductionsByGroup(officeBalance.currentMonth, "advance") : 0;
  const fertilizerTotal = officeBalance ? sumOfficeDeductionsByGroup(officeBalance.currentMonth, "fertilizer") : 0;
  const netPayable = officeBalance?.currentMonth.balance ?? totalEarned - monthExpenses;

  // Smart reminders from farm activities
  const lastFert = farmLogs.filter(a => a.activityType === "fertilizer").sort((a, b) => b.loggedDate.localeCompare(a.loggedDate))[0];
  const lastPrune = farmLogs.filter(a => a.activityType === "pruning").sort((a, b) => b.loggedDate.localeCompare(a.loggedDate))[0];
  const now = Date.now();
  const DAY = 86400000;
  const fertDue = lastFert ? Math.floor((now - new Date(lastFert.loggedDate).getTime()) / DAY) >= 75 : false;
  const pruneDue = lastPrune ? Math.floor((now - new Date(lastPrune.loggedDate).getTime()) / DAY) >= 40 : false;

  const weatherToday = weather.today;

  return (
    <div>
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-pine-800 p-5 text-white mb-4">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/5" />
        <div className="relative">
          <p className="mb-0.5 text-xs font-semibold text-emerald-200">
            {currentTime.toLocaleDateString(i18n.language === "si" ? "si-LK" : i18n.language === "ta" ? "ta-LK" : "en-LK", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Colombo" })}
          </p>
          <h1 className="font-display text-xl font-extrabold tracking-tight">
            {t("supplierHome.greetingWithName", { greeting: t(`supplierHome.greeting.${greeting}`), name: firstName })}
          </h1>
          <p className="text-sm text-emerald-100 mt-0.5 opacity-90">
            {estate ? t("supplierHome.linkedEstate", { estate: estate.name }) : t("supplierHome.interface")}
          </p>
        </div>
        {/* Connectivity badge */}
        <div className="mt-3 flex items-center gap-2">
          {online ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/30 px-2.5 py-1 text-[10px] font-bold text-emerald-100">
              <CheckCircle2 className="h-3 w-3" /> {t("common.online")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/30 px-2.5 py-1 text-[10px] font-bold text-rose-100">
              <AlertCircle className="h-3 w-3" /> {t("common.offline")}
            </span>
          )}
          {pendingSync > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/30 px-2.5 py-1 text-[10px] font-bold text-amber-100">
              ⏳ {t("supplierHome.pendingSync", { count: pendingSync })}
            </span>
          )}
        </div>
      </div>

      {/* Today's weather snap */}
      {weatherToday && (
        <Card className="mb-4 p-3.5 flex items-center gap-3 border-sky-200 bg-sky-50">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-white text-xl">
            {weatherToday.rainProb > 60 ? "🌧" : weatherToday.rainProb > 30 ? "⛅" : "☀️"}
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold text-sky-800">{t("supplierHome.weather")}</p>
            <p className="text-xs text-sky-600">
              {t("supplierHome.weatherDetail", { temperature: weatherToday.tempMax, rain: weatherToday.rainProb, wind: weatherToday.windKph })}
            </p>
            {weather.status !== "live" && <p className="mt-0.5 text-[10px] font-semibold text-amber-600">Demo · live estate weather unavailable</p>}
          </div>
          <button onClick={() => setActiveModule("supplier-weather")} className="text-sky-600">
            <ChevronRight className="h-4 w-4" />
          </button>
        </Card>
      )}

      {prices.length > 0 && (
        <div className="mb-4">
          <div className="grid grid-cols-3 gap-2.5">
            {prices.filter((price) => price.grade !== "Coarse").map((price) => (
              <Card key={price.grade} className="p-3 text-center">
                <p className="text-[10px] font-semibold uppercase text-slate-400">{t(gradeKey(price.grade), { defaultValue: price.grade })}</p>
                <p className="mt-1 text-base font-extrabold text-emerald-700">Rs {price.pricePerKg.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">{t("supplierHome.perKgToday")}</p>
              </Card>
            ))}
          </div>
          <p className="mt-1.5 text-center text-[10px] text-slate-400">{t("supplierHome.priceReference")}</p>
        </div>
      )}

      <OfficeDataStatus
        freshness={officeFreshness}
        fetchedAt={officeFetchedAt}
        error={officeError}
        refreshing={officeLoading}
        cooldownSeconds={refreshCooldown}
        onRefresh={refreshOfficeData}
      />

      {cropComparison && (
        <Card className="mb-4 border-sky-100 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-800">{t("officeSummary.cropComparison")}</h3>
              <p className="mt-0.5 text-[10px] text-slate-500">{t("officeSummary.processingNote")}</p>
            </div>
            <button type="button" onClick={() => setActiveModule("supplier-payments")} className="shrink-0 text-[10px] font-bold text-sky-700">
              {t("officeSummary.detailedStatement")} →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-[10px] font-semibold text-emerald-700">{t("officeSummary.currentCropRecorded")}</p>
              <p className="mt-1 text-xl font-extrabold text-emerald-800">{fmtNum(cropComparison.currentCropKg)} kg</p>
            </div>
            <div className="rounded-xl bg-sky-50 p-3">
              <p className="text-[10px] font-semibold text-sky-700">{t("officeSummary.accountStatementQuantity")}</p>
              <p className="mt-1 text-xl font-extrabold text-sky-800">{fmtNum(cropComparison.statementKg)} kg</p>
            </div>
          </div>
          {cropComparison.differenceKg !== 0 && (
            <p className="mt-2 text-center text-[10px] font-semibold text-slate-500">
              {t("officeSummary.sourceDifference")}: {cropComparison.differenceKg > 0 ? "+" : ""}{fmtNum(cropComparison.differenceKg)} kg
            </p>
          )}
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2.5">
        <Card className="p-3.5">
          <p className="text-[10px] font-semibold uppercase text-slate-400">{t("officeSummary.yesterdayCrop")}</p>
          {officeMonthly ? yesterdayDelivery ? (
            <>
              <p className="mt-1 text-lg font-extrabold text-slate-800">{fmtNum(yesterdayDelivery.totalQty)} kg</p>
              <p className="text-[10px] text-slate-500">{t("officeSummary.normalAndSuper", { normal: fmtNum(yesterdayDelivery.normalLeafQty), super: fmtNum(yesterdayDelivery.superLeafQty) })}</p>
            </>
          ) : <p className="mt-2 text-xs font-semibold text-slate-500">{t("officeSummary.noYesterday")}</p>
          : <p className="mt-2 text-xs font-semibold text-slate-400">{t("officeSummary.yesterdayUnavailable")}</p>}
        </Card>
        <Card className="p-3.5">
          <p className="text-[10px] font-semibold uppercase text-slate-400">{t("officeSummary.currentMonthDeductions")}</p>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs"><span className="text-slate-500">{t("officeSummary.currentMonthAdvances")}</span><strong className="text-amber-700">{fmtLKRShort(advanceTotal)}</strong></div>
            <div className="flex items-center justify-between gap-2 text-xs"><span className="text-slate-500">{t("officeSummary.fertilizerDeductions")}</span><strong className="text-rose-700">{fmtLKRShort(fertilizerTotal)}</strong></div>
          </div>
        </Card>
      </div>

      <Suspense fallback={<div className="mb-4 h-64 animate-pulse rounded-2xl bg-slate-100" />}><LorryTracking userId={userUid} /></Suspense>

      {/* Key stats — operational results first, finance second */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <StatCard icon={Package} label={t("supplierHome.monthSupplied")} value={`${fmtNum(totalKg)} kg`} tone="sky" />
        <StatCard icon={ReceiptText} label={t("supplierHome.monthDeliveries")} value={fmtNum(monthDeliveries)} sub={t("supplierHome.recordedReceipts")} tone="violet" />
        <StatCard icon={Wallet} label={t("supplierHome.monthEarnings")} value={fmtLKRShort(totalEarned)} tone="emerald" />
        <StatCard icon={TrendingUp} label={t("supplierHome.monthExpenses")} value={fmtLKRShort(monthExpenses)} sub={t("supplierHome.laborFertilizer")} tone="rose" />
      </div>
      <p className="-mt-2 mb-4 text-center text-[10px] font-semibold text-slate-400">{officeCrop || officeBalance ? t("officeSummary.officeSource") : t("officeSummary.emsSource")}</p>

      {/* Smart reminders */}
      {(fertDue || pruneDue) && (
        <Card className="mb-4 p-3.5 border-amber-200 bg-amber-50">
          <p className="text-xs font-bold text-amber-700 mb-2">📋 {t("supplierHome.reminders")}</p>
          <div className="space-y-1.5">
            {fertDue && (
              <div className="flex items-center gap-2 text-xs text-amber-700">
                <Sprout className="h-3.5 w-3.5 shrink-0" />
                <span>{t("supplierHome.fertilizerReminder")}</span>
              </div>
            )}
            {pruneDue && (
              <div className="flex items-center gap-2 text-xs text-amber-700">
                <Leaf className="h-3.5 w-3.5 shrink-0" />
                <span>{t("supplierHome.pruningReminder")}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setActiveModule("supplier-alerts")}
            className="mt-2 text-[10px] font-semibold text-amber-600 underline"
          >
            {t("supplierHome.viewAlerts")} →
          </button>
        </Card>
      )}

      {/* Quick actions */}
      <h3 className="font-display text-sm font-bold text-slate-800 mb-2.5">⚡ {t("supplierHome.quickActions")}</h3>
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {([
          { key: "supplier-plot", icon: Leaf, label: t("supplierHome.myPlot"), tone: "amber" },
          { key: "supplier-farm", icon: Sprout, label: t("supplierHome.farmLog"), tone: "emerald" },
          { key: "supplier-deliveries", icon: Package, label: t("supplierHome.deliveries"), tone: "sky" },
          { key: "supplier-requests", icon: Bell, label: t("supplierHome.requests"), tone: "violet" },
        ] as const).map(({ key, icon: Icon, label, tone }) => (
          <button
            key={key}
            onClick={() => setActiveModule(key)}
            className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition hover:brightness-95 ${
              tone === "emerald" ? "border-emerald-200 bg-emerald-50"
              : tone === "sky" ? "border-sky-200 bg-sky-50"
              : tone === "violet" ? "border-violet-200 bg-violet-50"
              : "border-amber-200 bg-amber-50"
            }`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              tone === "emerald" ? "bg-emerald-500 text-white"
              : tone === "sky" ? "bg-sky-500 text-white"
              : tone === "violet" ? "bg-violet-500 text-white"
              : "bg-amber-500 text-white"
            }`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className={`text-xs font-bold ${
              tone === "emerald" ? "text-emerald-800"
              : tone === "sky" ? "text-sky-800"
              : tone === "violet" ? "text-violet-800"
              : "text-amber-800"
            }`}>
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* B30 (Round #12) — Restored Earnings quick-link banner */}
      {(totalEarned > 0 || netPayable !== 0) && (
        <Card className="p-3.5 border-emerald-200 bg-emerald-50 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-700">💰 {t("supplierHome.netPayable")}</p>
              <p className="text-lg font-extrabold text-emerald-800 mt-0.5">{fmtLKRShort(netPayable)}</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">{officeBalance ? t("officeSummary.accountStatementBalance") : `⚠ ${t("supplierHome.financeDisclaimer")}`}</p>
            </div>
            <button onClick={() => setActiveModule("supplier-payments")} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white">
              {t("supplierHome.view")} →
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function getGreeting(date: Date): "morning" | "afternoon" | "evening" | "night" {
  const hourPart = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Asia/Colombo",
  }).formatToParts(date).find((part) => part.type === "hour");
  const h = Number(hourPart?.value ?? date.getHours()) % 24;
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}
