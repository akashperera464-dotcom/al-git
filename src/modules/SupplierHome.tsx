import { useEffect, useState } from "react";
import { Home, Leaf, CloudSun, Bell, Wallet, Package, Sprout, ChevronRight, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { PageHeader, Card, Badge, IconChip, StatCard } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { fmtLKRShort, fmtNum, TODAY_ISO } from "@/lib/data";
import { readMyHarvestRecords } from "@/lib/repo";
import { fetchForecast, getMockForecast } from "@/lib/weather";
import { readAlerts } from "@/lib/notifications";
import type { WeatherDay } from "@/lib/data";

export function SupplierHome() {
  const { user, session, setActiveModule, userUid, associatedEntityId, estates, syncQueue, online } = useApp();
  const estate = estates.find(e => e.id === associatedEntityId);
  const greeting = getGreeting();
  const firstName = (session?.name ?? user?.name ?? "Supplier").split(" ")[0];

  const [forecast, setForecast] = useState<WeatherDay[]>(getMockForecast());
  const [totalEarned, setTotalEarned] = useState(0);
  const [totalKg, setTotalKg] = useState(0);
  const [pendingKg, setPendingKg] = useState(0);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [superPct, setSuperPct] = useState(0);

  const pendingSync = syncQueue.filter(q => q.status === "queued").length;

  useEffect(() => {
    // Load weather
    const plotRaw = localStorage.getItem(`kdu.supplier_plot.${userUid}`);
    const plot = plotRaw ? JSON.parse(plotRaw) : null;
    const lat = plot?.latitude ?? estate?.latitude;
    const lon = plot?.longitude ?? estate?.longitude;
    void fetchForecast(lat, lon).then(res => setForecast(res.days));

    // Load deliveries
    void readMyHarvestRecords(userUid, associatedEntityId).then(recs => {
      const earned = recs.reduce((s, r) => s + r.amount, 0);
      const kg = recs.reduce((s, r) => s + r.kg, 0);
      const pending = recs.filter(r => r.status === "Pending").reduce((s, r) => s + r.amount, 0);
      const sup = recs.length ? Math.round((recs.filter(r => r.grade === "Super").length / recs.length) * 100) : 0;
      setTotalEarned(earned);
      setTotalKg(kg);
      setPendingKg(pending);
      setSuperPct(sup);
    });

    // Load unread alerts
    void readAlerts(userUid, 30).then(alerts => {
      setUnreadAlerts(alerts.filter(a => !a.read).length);
    });
  }, [userUid, associatedEntityId, estate?.latitude, estate?.longitude]);

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
            {greeting} · {today.toLocaleDateString("en-LK", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="font-display text-xl font-extrabold tracking-tight">
            ආයුබෝවන්, {firstName}!
          </h1>
          <p className="text-sm text-emerald-100 mt-0.5 opacity-90">
            {estate ? `${estate.name} · Linked Estate` : "VVIP Supplier Portal"}
          </p>
        </div>
        {/* Connectivity badge */}
        <div className="mt-3 flex items-center gap-2">
          {online ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/30 px-2.5 py-1 text-[10px] font-bold text-emerald-100">
              <CheckCircle2 className="h-3 w-3" /> Online
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/30 px-2.5 py-1 text-[10px] font-bold text-rose-100">
              <AlertCircle className="h-3 w-3" /> Offline
            </span>
          )}
          {pendingSync > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/30 px-2.5 py-1 text-[10px] font-bold text-amber-100">
              ⏳ {pendingSync} pending sync
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
            <p className="text-sm font-bold text-sky-800">කාලගුණය · Today's Weather</p>
            <p className="text-xs text-sky-600">
              {weatherToday.tempHi}°C high · Rain {weatherToday.rainProb}% · Wind {weatherToday.windKph} km/h
            </p>
          </div>
          <button onClick={() => setActiveModule("supplier-weather")} className="text-sky-600">
            <ChevronRight className="h-4 w-4" />
          </button>
        </Card>
      )}

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <StatCard icon={Package} label="මුළු කොළ · Total Supplied" value={`${fmtNum(totalKg)} kg`} tone="emerald" />
        <StatCard icon={Wallet} label="ඉපයීම් · Earnings" value={fmtLKRShort(totalEarned)} tone="sky" />
        <StatCard icon={TrendingUp} label="Super ශ්රේණිය · Quality" value={`${superPct}%`} tone="violet" />
        <StatCard icon={Bell} label="නොකියවූ · Unread Alerts" value={String(unreadAlerts)} tone={unreadAlerts > 0 ? "rose" : "slate"} />
      </div>

      {/* Smart reminders */}
      {(fertDue || pruneDue) && (
        <Card className="mb-4 p-3.5 border-amber-200 bg-amber-50">
          <p className="text-xs font-bold text-amber-700 mb-2">📋 ගොවිතැන් කාර්ය · Reminders</p>
          <div className="space-y-1.5">
            {fertDue && (
              <div className="flex items-center gap-2 text-xs text-amber-700">
                <Sprout className="h-3.5 w-3.5 shrink-0" />
                <span>පොහොර දැමීමේ කාලය · Fertilizer cycle approaching</span>
              </div>
            )}
            {pruneDue && (
              <div className="flex items-center gap-2 text-xs text-amber-700">
                <Leaf className="h-3.5 w-3.5 shrink-0" />
                <span>කප්පාදු සිහිකැඳවීම · Pruning reminder due</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setActiveModule("supplier-alerts")}
            className="mt-2 text-[10px] font-semibold text-amber-600 underline"
          >
            සියලු දැනුම්දීම් බලන්න · View All Alerts →
          </button>
        </Card>
      )}

      {/* Quick actions */}
      <h3 className="font-display text-sm font-bold text-slate-800 mb-2.5">⚡ ඉක්මන් ක්රියා · Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {([
          { key: "supplier-farm", icon: Sprout, label: "ගොවිතැන් · Farm Log", tone: "emerald" },
          { key: "supplier-deliveries", icon: Package, label: "බෙදාහැරීම් · Deliveries", tone: "sky" },
          { key: "supplier-requests", icon: Bell, label: "ඉල්ලීම් · Requests", tone: "violet" },
          { key: "supplier-plot", icon: Leaf, label: "මගේ වත්ත · My Plot", tone: "amber" },
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

      {/* Pending payment notice */}
      {pendingKg > 0 && (
        <Card className="p-3.5 border-rose-200 bg-rose-50 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-rose-700">⏳ ගෙවීම් එලඹෙමින් · Payment Pending</p>
              <p className="text-lg font-extrabold text-rose-800 mt-0.5">Rs {pendingKg.toLocaleString()}</p>
            </div>
            <button onClick={() => setActiveModule("supplier-payments")} className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white">
              View →
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "සුබ උදෑසනක් · Good Morning";
  if (h < 17) return "සුබ දහවලක් · Good Afternoon";
  return "සුබ සන්ධ්යාවක් · Good Evening";
}
