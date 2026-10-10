import { useEffect, useState } from "react";
import { Leaf, Bell, Wallet, Package, Sprout, ChevronRight, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, StatCard } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { fmtNum, fmtLKRShort } from "@/lib/data";
import { readMyHarvestRecords } from "@/lib/repo";
import { fetchForecast, getMockForecast } from "@/lib/weather";
import type { WeatherDay } from "@/lib/data";
import { useTranslation } from "react-i18next";
import { LorryLocationCard } from "@/components/LorryLocationCard";
import { readDailyTeaPrices, type DailyTeaPrice } from "@/lib/supplierOperations";
import { gradeKey } from "@/i18n/databaseValues";

export function SupplierHome() {
  const { t, i18n } = useTranslation();
  const { user, session, setActiveModule, userUid, associatedEntityId, estates, syncQueue, online } = useApp();
  const estate = estates.find(e => e.id === associatedEntityId);
  const greeting = getGreeting();
  const firstName = (session?.name ?? user?.name ?? "Supplier").split(" ")[0];

  const [forecast, setForecast] = useState<WeatherDay[]>(getMockForecast());
  const [totalKg, setTotalKg] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [superPct, setSuperPct] = useState(0);
  const [prices, setPrices] = useState<DailyTeaPrice[]>([]);

  const pendingSync = syncQueue.filter(q => q.status === "queued").length;

  useEffect(() => {
    // Load weather
    const plotRaw = localStorage.getItem(`kdu.supplier_plot.${userUid}`);
    const plot = plotRaw ? JSON.parse(plotRaw) : null;
    const lat = plot?.latitude ?? estate?.latitude;
    const lon = plot?.longitude ?? estate?.longitude;
    void fetchForecast(lat, lon).then(res => setForecast(res.days));

    // B30 (Round #12) — Load deliveries: kg + grade + amount (restored)
    void readMyHarvestRecords(userUid, associatedEntityId).then(recs => {
      const month = new Date().toISOString().slice(0, 7);
      const monthly = recs.filter((record) => record.date.startsWith(month));
      const kg = monthly.reduce((sum, record) => sum + record.kg, 0);
      const earned = monthly.reduce((sum, record) => sum + record.amount, 0);
      const superKg = monthly.filter((record) => record.grade === "Super" || record.grade === "PV Super").reduce((sum, record) => sum + record.kg, 0);
      const sup = kg ? Math.round((superKg / kg) * 100) : 0;
      setTotalKg(kg);
      setTotalEarned(earned);
      setSuperPct(sup);
    });
    void readDailyTeaPrices().then(setPrices).catch(() => setPrices([]));

    // B35 — Load monthly expenses (labor cost + fertilizer credit estimate)
    void (async () => {
      let expenses = 0;
      // Labor cost from localStorage (SupplierLabor module writes this)
      try {
        const laborRaw = localStorage.getItem(`kdu.supplier_labor.month_total.${userUid}`);
        expenses += Number(laborRaw || 0);
      } catch { /* ignore */ }
      // Fertilizer credit estimate (kg × Rs 95/kg)
      try {
        const ledgerRaw = localStorage.getItem("kdu.supplier_fertilizer_ledger");
        if (ledgerRaw) {
          const all: { supplierName: string; qtyIssued: number; unit: string; notes?: string }[] = JSON.parse(ledgerRaw);
          const mine = (user?.name ?? "")
            ? all.filter(e => e.supplierName?.toLowerCase() === (user?.name ?? "").toLowerCase() && (e.notes || "").toLowerCase().includes("credit"))
            : [];
          const kg = mine.filter(e => e.unit === "kg").reduce((s, e) => s + e.qtyIssued, 0);
          const bags = mine.filter(e => e.unit === "bag" || e.unit === "bags").reduce((s, e) => s + e.qtyIssued, 0);
          expenses += (kg + bags * 50) * 95;
        }
      } catch { /* ignore */ }
      setMonthExpenses(expenses);
    })();
  }, [userUid, associatedEntityId, estate?.latitude, estate?.longitude, user?.name]);

  // Smart reminders from farm activities
  const farmRaw = localStorage.getItem("kdu.farm_activities.cache");
  const farmLogs: { activityType: string; loggedDate: string }[] = farmRaw ? JSON.parse(farmRaw) : [];
  const lastFert = farmLogs.filter(a => a.activityType === "fertilizer").sort((a, b) => b.loggedDate.localeCompare(a.loggedDate))[0];
  const lastPrune = farmLogs.filter(a => a.activityType === "pruning").sort((a, b) => b.loggedDate.localeCompare(a.loggedDate))[0];
  const now = Date.now();
  const DAY = 86400000;
  const fertDue = lastFert ? Math.floor((now - new Date(lastFert.loggedDate).getTime()) / DAY) >= 75 : false;
  const pruneDue = lastPrune ? Math.floor((now - new Date(lastPrune.loggedDate).getTime()) / DAY) >= 40 : false;

  const today = new Date();
  const weatherToday = forecast[0];

  return (
    <div>
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-pine-800 p-5 text-white mb-4">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/5" />
        <div className="relative">
          <p className="text-xs font-semibold text-emerald-200 mb-0.5">
            {t(`supplierHome.greeting.${greeting}`)} · {today.toLocaleDateString(i18n.language === "si" ? "si-LK" : i18n.language === "ta" ? "ta-LK" : "en-LK", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="font-display text-xl font-extrabold tracking-tight">
            {t("supplierHome.welcome", { name: firstName })}
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
          </div>
          <button onClick={() => setActiveModule("supplier-weather")} className="text-sky-600">
            <ChevronRight className="h-4 w-4" />
          </button>
        </Card>
      )}

      {prices.length > 0 && <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">{prices.map((price) => <Card key={price.grade} className="p-3 text-center"><p className="text-[10px] font-semibold uppercase text-slate-400">{t(gradeKey(price.grade), { defaultValue: price.grade })}</p><p className="mt-1 text-base font-extrabold text-emerald-700">Rs {price.pricePerKg.toLocaleString()}</p><p className="text-[10px] text-slate-400">{t("supplierHome.perKgToday")}</p></Card>)}</div>}

      <LorryLocationCard userId={userUid} />

      {/* Key stats — Earnings + Expenses + Total Supplied + Pending Sync */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <StatCard icon={Wallet} label={t("supplierHome.monthEarnings")} value={fmtLKRShort(totalEarned)} tone="emerald" />
        <StatCard icon={TrendingUp} label={t("supplierHome.monthExpenses")} value={fmtLKRShort(monthExpenses)} sub={t("supplierHome.laborFertilizer")} tone="rose" />
        <StatCard icon={Package} label={t("supplierHome.monthSupplied")} value={`${fmtNum(totalKg)} kg`} tone="sky" />
        <StatCard icon={Leaf} label={t("supplierHome.superQuality")} value={`${superPct}%`} sub={t("supplierHome.byWeight")} tone="violet" />
      </div>

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

      {totalKg > 0 && superPct < 35 && <Card className="mb-4 border-amber-200 bg-amber-50 p-3.5"><p className="text-xs font-bold text-amber-800">{t("supplierHome.qualityTipTitle")}</p><p className="mt-1 text-xs text-amber-700">{t("supplierHome.qualityTipBody", { percent: superPct })}</p></Card>}

      {/* B30 (Round #12) — Restored Earnings quick-link banner */}
      {totalEarned > 0 && (
        <Card className="p-3.5 border-emerald-200 bg-emerald-50 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-700">💰 {t("supplierHome.netPayable")}</p>
              <p className="text-lg font-extrabold text-emerald-800 mt-0.5">{fmtLKRShort(totalEarned)}</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">⚠ {t("supplierHome.financeDisclaimer")}</p>
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

function getGreeting(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
