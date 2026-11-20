import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Leaf, Bell, Wallet, Package, ReceiptText, Sprout, ChevronRight, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Droplets, Wind, Sun, CloudRain, Calendar, Award } from "lucide-react";
import { Card } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { fmtNum, fmtLKRShort } from "@/lib/data";
import { readFarmActivities, readMyHarvestRecords } from "@/lib/repo";
import { useTranslation } from "react-i18next";
import { readDailyTeaPrices, readUserOperationalProfile, type DailyTeaPrice } from "@/lib/supplierOperations";
import { gradeKey } from "@/i18n/databaseValues";
import { readSupplierFinancialSummary } from "@/lib/financialSummary";
import { useEstateWeather, useSupplierWeatherEstate } from "@/lib/useEstateWeather";
import { fetchOfficeBalanceWithMeta, fetchOfficeCropWithMeta, fetchOfficeMonthlyWithMeta, OFFICE_DATA_REFRESH_COOLDOWN_SECONDS, type OfficeDataFreshness } from "@/lib/officeApi";
import type { OfficeBalanceResponse, OfficeLeafResponse } from "@/lib/officeApiContracts";
import { findOfficeDeliveryForDate, getOfficeCropComparison, sumOfficeDeductionsByGroup, yesterdaySriLankaIso } from "@/lib/officeSupplierSummary";
import { OfficeDataStatus } from "@/components/OfficeDataStatus";
import { Icon } from "@/components/Icon";
import { WeatherAtmosphere } from "@/components/WeatherAtmosphere";
import { getWeatherPresentation } from "@/lib/weatherPresentation";

const LorryTracking = lazy(() => import("@/modules/LorryTracking"));

/** Section header — Stitch title row with a muted right-side caption. */
function SectionHead({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="min-w-0 truncate font-display text-[15px] font-bold tracking-tight text-dalu-on-surface">{title}</h2>
      {caption && <span className="shrink-0 text-[11px] font-semibold text-dalu-on-surface-variant">{caption}</span>}
    </div>
  );
}

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
    setRefreshCooldown(OFFICE_DATA_REFRESH_COOLDOWN_SECONDS);
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
  const weatherVisual = useMemo(() => getWeatherPresentation(weatherToday), [weatherToday]);
  const rateCards = useMemo(() => prices.filter((price) => price.grade !== "Coarse").slice(0, 3), [prices]);

  // ── Slide cards (ad-style carousel) ──────────────────────────────────────
  // Auto-rotating banner with tips/announcements relevant to the supplier.
  // Gradients stay inside the Dalu tea palette (deep greens / teal / amber).
  const slides = useMemo(() => {
    const items: Array<{ icon: typeof Sun; title: string; body: string; gradient: string; cta?: string; module?: string }> = [];
    if (fertDue) {
      items.push({
        icon: Sprout, title: t("supplierHome.fertDueTitle"),
        body: t("supplierHome.fertDueBody"),
        gradient: "linear-gradient(135deg, #0e5e42, #0f8a5f)",
        cta: t("supplierHome.fertDueCta"), module: "supplier-fertilizer",
      });
    }
    if (pruneDue) {
      items.push({
        icon: Leaf, title: t("supplierHome.pruneDueTitle"),
        body: t("supplierHome.pruneDueBody"),
        gradient: "linear-gradient(135deg, #0d5c75, #0369a1)",
        cta: t("supplierHome.pruneDueCta"), module: "supplier-farm",
      });
    }
    if (weatherToday && weatherToday.rainProb > 60) {
      items.push({
        icon: CloudRain, title: t("supplierHome.rainAlertTitle"),
        body: t("supplierHome.rainAlertBody", { prob: weatherToday.rainProb }),
        gradient: "linear-gradient(135deg, #073444, #0d5c75)",
      });
    }
    if (weatherToday && weatherToday.tempMax > 30) {
      items.push({
        icon: Sun, title: t("supplierHome.heatAlertTitle"),
        body: t("supplierHome.heatAlertBody"),
        gradient: "linear-gradient(135deg, #b45309, #d97706)",
      });
    }
    // Always-on tip slides so the carousel is never empty
    items.push({
      icon: Award, title: t("supplierHome.qualityTipTitle"),
      body: t("supplierHome.qualityTipBody"),
      gradient: "linear-gradient(135deg, #3f5c50, #0e5e42)",
      cta: t("supplierHome.qualityTipCta"), module: "supplier-deliveries",
    });
    /* Calendar tip removed — it duplicated the "Plucking schedule" strip right
       above the carousel (two identical green banners stacked). The strip and
       its "Open calendar" action already cover it. */
    return items;
  }, [t, fertDue, pruneDue, weatherToday]);

  const [slideIdx, setSlideIdx] = useState(0);
  const slideTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (slides.length <= 1) return;
    slideTimer.current = window.setInterval(() => {
      setSlideIdx(i => (i + 1) % slides.length);
    }, 5000);
    return () => { if (slideTimer.current) window.clearInterval(slideTimer.current); };
  }, [slides.length]);
  const currentSlide = slides[slideIdx] ?? slides[0];

  return (
    <div className="supplier-weather-surface -m-4 min-h-full bg-dalu-surface p-4 pb-6">
      {/* ═══ Desktop (lg+): Stitch 12-col dashboard row — weather hero (7 cols) +
          right rail (5 cols: plucking strip, tip carousel, leaf rates, office
          sync). Mobile below lg keeps the original stacked order. ═══ */}
      {/* lg:mb-4 — the rail cards drop their mobile mb-4 on desktop (grid gap-4
         handles spacing between rows), so without this the first section BELOW
         the grid (crop comparison / yesterday's crop) sits flush against the
         hero's bottom edge = "cards touching" complaint. */}
      <div className="lg:mb-4 lg:grid lg:grid-cols-12 lg:items-stretch lg:gap-4">
      {/* ═══ Weather & greeting hero — Stitch: tea photo + mood gradient ═══ */}
      <div className="weather-hero relative mb-4 overflow-hidden rounded-3xl p-5 text-white lg:col-span-7 lg:row-span-4 lg:mb-0 lg:flex lg:flex-col lg:p-7" style={{ background: weatherVisual.gradient }}>
        {/* Tea estate photo. The mood tint above it renders at reduced opacity so
            the scenery stays visible behind the glass chips (was opacity .92 →
            the photo was completely invisible = "plain blue card" complaint). */}
        <img src="/tea-estate-bg.jpg" alt="" aria-hidden="true" className="absolute inset-0 z-0 h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        {/* Weather-mood gradient tint over the photo (dynamic by real weather) */}
        <div className="absolute inset-0 z-0" style={{ background: weatherVisual.gradient, opacity: 0.72 }} aria-hidden="true" />
        {/* Legibility scrim — darker at the very top and bottom of the photo */}
        <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/45 via-black/5 to-black/30" aria-hidden="true" />
        <WeatherAtmosphere mood={weatherVisual.mood} />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-semibold text-white/75">
              {currentTime.toLocaleDateString(i18n.language === "si" ? "si-LK" : i18n.language === "ta" ? "ta-LK" : "en-LK", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Colombo" })}
            </p>
            <h1 className="font-display text-[24px] font-bold leading-tight tracking-tight sm:text-[26px] lg:text-[30px]">
              {t("supplierHome.greetingWithName", { greeting: t(`supplierHome.greeting.${greeting}`), name: firstName })}
            </h1>
            <p className="mt-1 truncate text-xs font-medium text-white/80">
              {estate ? t("supplierHome.linkedEstate", { estate: estate.name }) : t("supplierHome.interface")}
            </p>
          </div>
          <button type="button" onClick={() => setActiveModule("supplier-weather")} className="weather-glass flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-white/20">
            {weatherToday && <Icon name={weatherToday.icon} className="h-7 w-7 text-white" />}
            <span><b className="tnum block font-display text-lg leading-none">{weatherToday ? `${weatherToday.tempMax}°` : "—°"}</b><span className="mt-1 block max-w-[72px] truncate text-[9px] font-semibold text-white/75">{t(weatherVisual.labelKey)}</span></span>
          </button>
        </div>

        {/* Three glass stat chips — Rain / Wind / Forecast */}
        <div className="relative z-10 mt-4 grid grid-cols-3 gap-2 lg:gap-2.5">
          <div className="weather-glass min-w-0 rounded-lg p-2.5 lg:p-3"><Droplets className="h-3.5 w-3.5 text-sky-100" /><p className="tnum mt-1 text-sm font-bold">{weatherToday?.rainProb ?? "—"}%</p><p className="truncate text-[9px] text-white/65">Rain</p></div>
          <div className="weather-glass min-w-0 rounded-lg p-2.5 lg:p-3"><Wind className="h-3.5 w-3.5 text-sky-100" /><p className="tnum mt-1 text-sm font-bold">{weatherToday?.windKph ?? "—"} km/h</p><p className="truncate text-[9px] text-white/65">Wind</p></div>
          <button type="button" onClick={() => setActiveModule("supplier-weather")} className="weather-glass min-w-0 rounded-lg p-2.5 text-left lg:p-3"><span className="block truncate text-[11px] font-bold">{weatherToday?.condition ?? "Weather"}</span><span className="mt-1 flex items-center text-[9px] text-white/70">Forecast <ChevronRight className="ml-0.5 h-3 w-3" /></span></button>
        </div>

        {/* Advisory strip */}
        <button type="button" onClick={() => setActiveModule("supplier-weather")} className="weather-glass relative z-10 mt-3 flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-left">
          <span className="text-[11px] font-medium leading-relaxed text-white/90">{t(weatherVisual.guidanceKey)}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/75" />
        </button>

        {/* Connectivity badge row — lg: pinned to the hero's bottom edge so the
            stretched hero distributes spare space above it */}
        <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2 lg:mt-auto">
          {online ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-dalu-success-container px-2.5 py-1 text-[10px] font-bold text-dalu-on-success-container">
              <CheckCircle2 className="h-3 w-3" /> {t("common.online")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-dalu-error-container px-2.5 py-1 text-[10px] font-bold text-dalu-on-error-container">
              <AlertCircle className="h-3 w-3" /> {t("common.offline")}
            </span>
          )}
          {pendingSync > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-dalu-warning-container px-2.5 py-1 text-[10px] font-bold text-dalu-on-warning-container">
              ⏳ {t("supplierHome.pendingSync", { count: pendingSync })}
            </span>
          )}
          <span className="ml-auto text-[9px] font-semibold text-white/60">{weather.status === "live" ? "Live estate weather" : "Demo weather"}</span>
        </div>
      </div>

      {/* ═══ Plucking schedule strip — Stitch primary-container card (rail row 1) ═══ */}
      <button
        type="button"
        onClick={() => setActiveModule("supplier-calendar")}
        className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-dalu-primary/20 bg-dalu-primary-container p-3.5 text-left shadow-sm transition hover:border-dalu-primary lg:col-span-5 lg:mb-0"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-dalu-primary text-white shadow-sm">
            <Calendar className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-sm font-bold text-dalu-on-primary-container">{t("supplierHome.pluckingSchedule")}</span>
            <span className="block truncate text-[11px] text-dalu-on-primary-container/80">{t("supplierHome.pluckingScheduleSub")}</span>
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-dalu-on-primary-container" />
      </button>

      {/* ── Slide cards (ad-style auto-rotating carousel) — rail row 2 ────────── */}
      {currentSlide && (
        <div className="mb-4 lg:col-span-5 lg:mb-0">
          <button
            type="button"
            onClick={() => currentSlide.module ? setActiveModule(currentSlide.module) : undefined}
            className="block w-full overflow-hidden rounded-2xl text-left shadow-sm transition active:scale-[0.99]"
            style={{ background: currentSlide.gradient }}
          >
            <div className="flex items-center gap-3 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <currentSlide.icon className="h-5 w-5 text-white" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-bold text-white">{currentSlide.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/85">{currentSlide.body}</p>
                {currentSlide.cta && (
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                    {currentSlide.cta} <ChevronRight className="h-3 w-3" />
                  </span>
                )}
              </div>
            </div>
          </button>
          {/* Dot indicators */}
          {slides.length > 1 && (
            <div className="mt-2 flex justify-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSlideIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${i === slideIdx ? "w-6 bg-dalu-primary" : "w-1.5 bg-dalu-outline-variant"}`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Today's leaf rates — Stitch: 2 white + 1 primary card (rail row 3) ═══ */}
      {rateCards.length > 0 && (
        <div className="mb-4 lg:col-span-5 lg:mb-0">
          <SectionHead title={t("supplierHome.todayRates")} caption={t("supplierHome.perKgFactory")} />
          <div className="grid grid-cols-3 gap-2.5">
            {rateCards.map((price, index) => {
              const primary = index === rateCards.length - 1;
              return (
                <Card key={price.grade} className={primary ? "card-tint-primary h-full p-3 text-center" : "h-full p-3 text-center"}>
                  <p className={`truncate text-[10px] font-bold uppercase leading-none ${primary ? "text-dalu-primary-container" : "text-dalu-primary"}`}>
                    {t(gradeKey(price.grade), { defaultValue: price.grade })}
                  </p>
                  <p className={`tnum mt-1.5 font-display text-[17px] font-bold leading-none ${primary ? "text-white" : "text-dalu-on-surface"}`}>
                    Rs {price.pricePerKg.toLocaleString()}
                  </p>
                  <p className={`mt-1 truncate text-[10px] ${primary ? "text-white/75" : "text-dalu-on-surface-variant"}`}>
                    {t("supplierHome.latestRate")}
                  </p>
                </Card>
              );
            })}
          </div>
          <p className="mt-1.5 text-center text-[10px] text-dalu-on-surface-variant">{t("supplierHome.priceReference")}</p>
        </div>
      )}

      {/* ═══ Office sync status — Stitch error-container alert (rail row 4) ═══ */}
      <OfficeDataStatus
        className="lg:col-span-5 lg:mb-0"
        freshness={officeFreshness}
        fetchedAt={officeFetchedAt}
        error={officeError}
        refreshing={officeLoading}
        cooldownSeconds={refreshCooldown}
        onRefresh={refreshOfficeData}
      />
      </div>{/* ← close lg:grid-cols-12 dashboard row */}

      {/* ═══ Crop comparison (office vs statement) ═══ */}
      {cropComparison && (
        <Card className="mb-4 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-sm font-bold text-dalu-on-surface">{t("officeSummary.cropComparison")}</h3>
              <p className="mt-0.5 text-[10px] text-dalu-on-surface-variant">{t("officeSummary.processingNote")}</p>
            </div>
            <button type="button" onClick={() => setActiveModule("supplier-payments")} className="shrink-0 text-[11px] font-bold text-dalu-tertiary">
              {t("officeSummary.detailedStatement")} →
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="min-w-0 rounded-xl bg-dalu-success-container p-3">
              <p className="text-[10px] font-bold text-dalu-on-success-container">{t("officeSummary.currentCropRecorded")}</p>
              <p className="tnum mt-1 font-display text-lg font-bold text-dalu-on-success-container">{fmtNum(cropComparison.currentCropKg)} kg</p>
            </div>
            <div className="min-w-0 rounded-xl bg-dalu-info-container p-3">
              <p className="text-[10px] font-bold text-dalu-on-info-container">{t("officeSummary.accountStatementQuantity")}</p>
              <p className="tnum mt-1 font-display text-lg font-bold text-dalu-on-info-container">{fmtNum(cropComparison.statementKg)} kg</p>
            </div>
          </div>
          {cropComparison.differenceKg !== 0 && (
            <p className="mt-2 text-center text-[10px] font-semibold text-dalu-on-surface-variant">
              {t("officeSummary.sourceDifference")}: {cropComparison.differenceKg > 0 ? "+" : ""}{fmtNum(cropComparison.differenceKg)} kg
            </p>
          )}
        </Card>
      )}

      {/* ═══ Yesterday's crop & month deductions — Stitch 2-col white cards ═══ */}
      <div className="mb-4 grid grid-cols-2 gap-2.5">
        <Card className="min-w-0 p-3.5">
          <p className="text-[10px] font-bold uppercase leading-none text-dalu-primary">{t("officeSummary.yesterdayCrop")}</p>
          {officeMonthly ? yesterdayDelivery ? (
            <>
              <p className="tnum mt-2 font-display text-lg font-bold text-dalu-on-surface">{fmtNum(yesterdayDelivery.totalQty)} kg</p>
              <p className="mt-0.5 text-[10px] leading-snug text-dalu-on-surface-variant">{t("officeSummary.normalAndSuper", { normal: fmtNum(yesterdayDelivery.normalLeafQty), super: fmtNum(yesterdayDelivery.superLeafQty) })}</p>
            </>
          ) : <p className="mt-2 text-xs font-semibold leading-snug text-dalu-on-surface-variant">{t("officeSummary.noYesterday")}</p>
          : <p className="mt-2 text-xs font-semibold leading-snug text-dalu-on-surface-variant">{t("officeSummary.yesterdayUnavailable")}</p>}
        </Card>
        <Card className="min-w-0 p-3.5">
          <p className="text-[10px] font-bold uppercase leading-none text-dalu-primary">{t("officeSummary.currentMonthDeductions")}</p>
          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px]"><span className="truncate text-dalu-on-surface-variant">{t("officeSummary.currentMonthAdvances")}</span><strong className="tnum shrink-0 text-dalu-on-warning-container">{fmtLKRShort(advanceTotal)}</strong></div>
            <div className="flex items-center justify-between gap-2 text-[11px]"><span className="truncate text-dalu-on-surface-variant">{t("officeSummary.fertilizerDeductions")}</span><strong className="tnum shrink-0 text-dalu-error">{fmtLKRShort(fertilizerTotal)}</strong></div>
          </div>
        </Card>
      </div>

      {/* ═══ Lorry location (on-demand map) ═══ */}
      <Suspense fallback={<div className="mb-4 h-64 animate-pulse rounded-2xl bg-dalu-surface-container" />}><LorryTracking userId={userUid} /></Suspense>

      {/* ═══ Monthly summary — Stitch 2x2 KPI cards with tinted icon chips ═══ */}
      <div className="mb-4">
        <SectionHead
          title={t("supplierHome.monthlySummary")}
          caption={officeCrop || officeBalance ? t("officeSummary.officeSource") : t("officeSummary.emsSource")}
        />
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <Card className="flex h-full min-w-0 flex-col justify-between gap-2 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-dalu-info-container text-dalu-on-info-container"><Package className="h-4 w-4" /></span>
              <span className="text-[10px] font-semibold text-dalu-on-surface-variant">{currentTime.toLocaleDateString(i18n.language === "si" ? "si-LK" : i18n.language === "ta" ? "ta-LK" : "en-LK", { month: "short", year: "numeric", timeZone: "Asia/Colombo" })}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-dalu-on-surface-variant">{t("supplierHome.monthSupplied")}</p>
              <p className="tnum font-display text-[20px] font-bold leading-tight text-dalu-on-surface">{fmtNum(totalKg)} kg</p>
            </div>
          </Card>
          <Card className="flex h-full min-w-0 flex-col justify-between gap-2 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-dalu-secondary-container text-dalu-on-secondary-container"><ReceiptText className="h-4 w-4" /></span>
              <span className="text-[10px] font-semibold text-dalu-on-surface-variant">{t("supplierHome.recordedReceipts")}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-dalu-on-surface-variant">{t("supplierHome.monthDeliveries")}</p>
              <p className="tnum font-display text-[20px] font-bold leading-tight text-dalu-on-surface">{fmtNum(monthDeliveries)}</p>
            </div>
          </Card>
          <Card className="flex h-full min-w-0 flex-col justify-between gap-2 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-dalu-success-container text-dalu-on-success-container"><Wallet className="h-4 w-4" /></span>
              <span className="text-[10px] font-semibold text-dalu-on-surface-variant">Gross</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-dalu-on-surface-variant">{t("supplierHome.monthEarnings")}</p>
              <p className="tnum font-display text-[20px] font-bold leading-tight text-dalu-on-surface">{fmtLKRShort(totalEarned)}</p>
            </div>
          </Card>
          <Card className="flex h-full min-w-0 flex-col justify-between gap-2 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-dalu-error-container text-dalu-on-error-container"><TrendingDown className="h-4 w-4" /></span>
              <span className="text-[10px] font-semibold text-dalu-on-surface-variant">{t("supplierHome.monthExpenses")}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] text-dalu-on-surface-variant">{t("supplierHome.laborFertilizer")}</p>
              <p className="tnum font-display text-[20px] font-bold leading-tight text-dalu-on-surface">{fmtLKRShort(monthExpenses)}</p>
            </div>
          </Card>
        </div>
      </div>

      {/* ═══ Smart reminders — Stitch warning-container ═══ */}
      {(fertDue || pruneDue) && (
        <Card className="card-tint-warning mb-4 p-3.5">
          <p className="mb-2 text-xs font-bold text-dalu-on-warning-container">📋 {t("supplierHome.reminders")}</p>
          <div className="space-y-1.5">
            {fertDue && (
              <div className="flex items-center gap-2 text-xs text-dalu-on-warning-container">
                <Sprout className="h-3.5 w-3.5 shrink-0" />
                <span>{t("supplierHome.fertilizerReminder")}</span>
              </div>
            )}
            {pruneDue && (
              <div className="flex items-center gap-2 text-xs text-dalu-on-warning-container">
                <Leaf className="h-3.5 w-3.5 shrink-0" />
                <span>{t("supplierHome.pruningReminder")}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setActiveModule("supplier-alerts")}
            className="mt-2 text-[11px] font-bold text-dalu-on-warning-container underline"
          >
            {t("supplierHome.viewAlerts")} →
          </button>
        </Card>
      )}

      {/* ═══ Quick actions — Stitch 2x2 white cards, tinted icon chips ═══ */}
      <div className="mb-4">
        <SectionHead title={t("supplierHome.quickActions")} />
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {([
            { key: "supplier-plot", icon: Leaf, label: t("supplierHome.myPlot"), chip: "bg-dalu-warning-container text-dalu-on-warning-container" },
            { key: "supplier-farm", icon: Sprout, label: t("supplierHome.farmLog"), chip: "bg-dalu-primary-container text-dalu-on-primary-container" },
            { key: "supplier-deliveries", icon: Package, label: t("supplierHome.deliveries"), chip: "bg-dalu-info-container text-dalu-on-info-container" },
            { key: "supplier-requests", icon: Bell, label: t("supplierHome.requests"), chip: "bg-dalu-secondary-container text-dalu-on-secondary-container" },
          ] as const).map(({ key, icon: ActionIcon, label, chip }) => (
            <button
              key={key}
              onClick={() => setActiveModule(key)}
              className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-dalu-outline-variant bg-white p-3 text-left shadow-sm transition hover:border-dalu-primary"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${chip}`}>
                <ActionIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 truncate text-xs font-bold text-dalu-on-surface">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Net payable — Stitch success-container banner ═══ */}
      {(totalEarned > 0 || netPayable !== 0) && (
        <Card className="card-tint-success mb-2 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-dalu-on-success-container">💰 {t("supplierHome.netPayable")}</p>
              <p className="tnum mt-0.5 font-display text-lg font-bold text-dalu-on-success-container">{fmtLKRShort(netPayable)}</p>
              <p className="mt-0.5 text-[10px] text-dalu-on-success-container/80">{officeBalance ? t("officeSummary.accountStatementBalance") : `⚠ ${t("supplierHome.financeDisclaimer")}`}</p>
            </div>
            <button onClick={() => setActiveModule("supplier-payments")} className="shrink-0 rounded-xl bg-dalu-primary px-3.5 py-2 text-xs font-bold text-white transition hover:bg-dalu-accent">
              {t("supplierHome.view")} →
            </button>
          </div>
        </Card>
      )}
      <p className="mt-1 text-center text-[10px] font-semibold text-dalu-outline"><TrendingUp className="mr-1 inline h-3 w-3" />{officeCrop || officeBalance ? t("officeSummary.officeSource") : t("officeSummary.emsSource")}</p>
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
