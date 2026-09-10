import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Package, BellRing, Wallet, Leaf, TrendingUp, CalendarCheck, Droplets, Sparkles, Building2, Tag } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { evaluateFertilizerWindow, recommendPlucking, type AdviceLevel } from "@/lib/predictive";
import { supplier, pluckFields, fmtLKR, fmtLKRShort, fmtNum, TODAY_ISO, type WeatherDay } from "@/lib/data";
import { readMyHarvestRecords } from "@/lib/repo";
import { useLiveData } from "@/lib/useLiveData";
import { fetchForecast, getMockForecast } from "@/lib/weather";
import { useApp } from "@/context/AppContext";
import { LocationCheckIn } from "@/components/LocationCheckIn";
import { PruningAdvisory } from "@/components/PruningAdvisory";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import type { SupplyRecord } from "@/lib/data";

/** Daily Tea Prices card — shows today's price per kg per grade. */
function DailyPriceCard() {
  const [prices, setPrices] = useState<{ grade: string; pricePerKg: number }[]>([]);
  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = getSupabase()!;
    void (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data } = await sb.from("daily_tea_prices").select("grade, price_per_kg").eq("price_date", today);
        if (data) setPrices(data.map((r: Record<string, unknown>) => ({ grade: r.grade as string, pricePerKg: Number(r.price_per_kg) })));
      } catch { /* ignore */ }
    })();
  }, []);

  if (prices.length === 0) return null;
  const toneMap: Record<string, "emerald" | "amber" | "rose"> = { Super: "emerald", Standard: "amber", Coarse: "rose" };
  return (
    <div className="mb-4 grid grid-cols-3 gap-2">
      {prices.map(p => (
        <div key={p.grade} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
          <Badge tone={toneMap[p.grade] ?? "slate"}>{p.grade}</Badge>
          <p className="mt-1.5 font-display text-lg font-bold text-slate-800">Rs {p.pricePerKg.toLocaleString()}</p>
          <p className="text-[10px] text-slate-400">per kg · today</p>
        </div>
      ))}
    </div>
  );
}

const LEVEL_COLOR: Record<AdviceLevel, string> = { critical: "#f43f5e", due: "#f59e0b", optimal: "#10b981", hold: "#0ea5e9", info: "#38bdf8" };
const GRADE_TONE: Record<string, "emerald" | "amber" | "rose"> = { Super: "emerald", Standard: "amber", Coarse: "rose" };

/**
 * RULE #2 + #3 boundary: reads are scoped to the caller's uid + estate AND
 * subscribe to real-time postgres_changes so new weigh-ins by the supervisor
 * appear instantly here (no manual refresh).
 */
function useOwnSupply() {
  const { userUid, associatedEntityId } = useApp();
  const filter = `supplier_id=eq.${userUid}`;
  const { data, loading } = useLiveData<SupplyRecord>(
    "harvest_records",
    () => readMyHarvestRecords(userUid, associatedEntityId),
    filter
  );
  return { records: data, loading };
}

/** Banner showing the estate this supplier is scoped to (associatedEntityId). */
function LinkedEstateBanner() {
  const { t } = useTranslation();
  const { associatedEntityId, estates } = useApp();
  const estate = estates.find((e) => e.id === associatedEntityId);
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-xs text-violet-700">
      <Building2 className="h-4 w-4 shrink-0" />
      {t("supplier.scopedTo")} <strong>{estate?.name ?? associatedEntityId}</strong> {t("supplier.scopedDesc")}
    </div>
  );
}

/** 1 · My Leaf Deliveries — daily net weight & quality grade (own records only). */
export function SupplierDeliveries() {
  const { t } = useTranslation();
  const { estates, associatedEntityId } = useApp();
  const { records, loading } = useOwnSupply();
  const totalNet = records.reduce((s, r) => s + r.kg, 0);
  const superPct = records.length ? Math.round((records.filter((r) => r.grade === "Super").length / records.length) * 100) : 0;

  return (
    <div>
      <PageHeader
        eyebrow={t("supplier.eyebrow")}
        title={t("supplier.deliveries")}
        desc={t("supplier.deliveriesDesc")}
        icon={<IconChip icon={Package} tone="emerald" className="h-12 w-12" />}
      />
      <LinkedEstateBanner />
      <DailyPriceCard />
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard icon={Package} label={t("supplier.netSupplied")} value={fmtNum(totalNet)} sub={t("supplier.kgNet")} tone="emerald" />
        <StatCard icon={Leaf} label={t("supplier.deliveriesCount")} value={String(records.length)} tone="sky" />
        <StatCard icon={TrendingUp} label={t("supplier.superGrade")} value={`${superPct}%`} tone="violet" />
      </div>
      <div className="mt-4 space-y-2.5">
        {loading && <p className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-center text-xs text-slate-500">{t("supplier.syncingDeliveries")}</p>}
        {!loading && records.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">{t("supplier.noDeliveries")}</p>}
        {records.map((r) => (
          <Card key={r.id} className="flex items-center gap-3 p-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Leaf className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-800">{fmtNum(r.kg)} kg net</p>
                <Badge tone={GRADE_TONE[r.grade]}>{r.grade}</Badge>
              </div>
              <p className="text-[11px] text-slate-400">{r.date} · {fmtLKR(r.amount)}</p>
            </div>
            <Badge tone={r.status === "Paid" ? "emerald" : "amber"} dot>{r.status}</Badge>
          </Card>
        ))}
      </div>

      {/* Live location verification at the estate */}
      <div className="mt-5">
        <LocationCheckIn estateName={estates.find((e) => e.id === associatedEntityId)?.name ?? t("supplier.yourEstate")} />
      </div>
    </div>
  );
}

/** 2 · Smart Alerts Panel — FCM fertilizer & plucking schedules (deterministic). */
export function SupplierAlerts() {
  const { t } = useTranslation();
  const { estates, associatedEntityId, userUid } = useApp();
  const estate = estates.find((e) => e.id === associatedEntityId);
  const [forecast, setForecast] = useState<WeatherDay[]>(getMockForecast());
  useEffect(() => {
    let active = true;
    // Fetch weather for the SUPPLIER'S specific estate coordinates.
    void fetchForecast(estate?.latitude, estate?.longitude).then((res) => active && setForecast(res.days));
    return () => {
      active = false;
    };
  }, [estate?.latitude, estate?.longitude]);

  const advice = evaluateFertilizerWindow(
    { lastApplicationDate: supplier.lastFertilizerDate, cropStage: supplier.cropStage, cultivar: supplier.cultivar, soilMoisturePct: supplier.soilMoisturePct, temperatureC: 21, forecast, region: supplier.village },
    TODAY_ISO
  );
  const pluck = recommendPlucking(pluckFields, forecast).filter((p) => p.priority === "today").slice(0, 2);

  return (
    <div>
      <PageHeader
        eyebrow={t("supplier.eyebrow")}
        title={t("supplier.alerts")}
        desc={t("supplier.alertsDesc")}
        icon={<IconChip icon={BellRing} tone="violet" className="h-12 w-12" />}
      />
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl p-4 text-white" style={{ background: `linear-gradient(135deg, ${LEVEL_COLOR[advice.level]}, #1e293b)` }}>
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">{t("supplier.fertilizerSchedule")}</p>
          </div>
          <p className="mt-1 font-display text-lg font-bold">{advice.title}</p>
          <p className="text-sm opacity-90">{advice.message}</p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <CalendarCheck className="h-4 w-4" />
            <span className="font-bold">{t("supplier.applyBy")} {advice.recommendedDate}</span>
          </div>
        </div>

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Leaf className="h-4 w-4 text-emerald-600" />
            <h3 className="font-display text-sm font-bold text-slate-800">{t("supplier.pluckingSchedule")}</h3>
          </div>
          <div className="space-y-2">
            {pluck.map((p) => (
              <div key={p.field.id} className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">{p.field.name}</p>
                  <p className="truncate text-[11px] text-slate-400">{p.reasons[0]}</p>
                </div>
                <Badge tone="emerald">{t("common.today")}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Smart Agronomic Advisory & Pruning Schedule (plant-age based) */}
        <PruningAdvisory forecast={forecast} />

        {/* NEW (Sir's spec Phase 2): Smart Automated Alerts */}
        <SmartAutomatedAlerts userUid={userUid} forecast={forecast} />

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <h3 className="font-display text-sm font-bold text-slate-800">{t("supplier.pushNotifications")}</h3>
            <Badge tone="violet">FCM</Badge>
          </div>
          <div className="space-y-2">
            {[
              { t: t("supplier.pushPaymentTitle"), d: t("supplier.pushPaymentBody"), i: "Wallet" },
              { t: t("supplier.pushRainTitle"), d: t("supplier.pushRainBody", { date: advice.recommendedDate }), i: "Droplets" },
            ].map((n, idx) => (
              <div key={idx} className="flex items-start gap-3 rounded-xl border border-slate-100 p-2.5">
                <Icon name={n.i} className="mt-0.5 h-4 w-4 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{n.t}</p>
                  <p className="text-xs text-slate-400">{n.d}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/** 3 · Payment Tracker — earnings & payment history (own records only). */
export function SupplierPayments() {
  const { t } = useTranslation();
  const { records, loading } = useOwnSupply();
  const earned = records.reduce((s, r) => s + r.amount, 0);
  return (
    <div>
      <PageHeader
        eyebrow={t("supplier.eyebrow")}
        title={t("supplier.payments")}
        desc={t("supplier.paymentsDesc")}
        icon={<IconChip icon={Wallet} tone="emerald" className="h-12 w-12" />}
      />
      <LinkedEstateBanner />
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard icon={Wallet} label={t("supplier.totalEarned")} value={fmtLKRShort(earned)} tone="emerald" />
        <StatCard icon={CalendarCheck} label={t("supplier.pendingPayment")} value={fmtLKRShort(supplier.outstandingPayable)} tone="amber" />
        <StatCard icon={TrendingUp} label={t("supplier.ratePerKg")} value={fmtLKR(supplier.pricePerKg)} tone="sky" />
      </div>
      <Card className="mt-4 p-4">
        <h3 className="mb-1 font-display text-sm font-bold text-slate-800">{t("supplier.paymentHistory")}</h3>
        <div>
          {loading && <p className="py-3 text-center text-xs text-slate-500">{t("supplier.syncing")}</p>}
          {!loading && records.length === 0 && <p className="py-6 text-center text-sm text-slate-400">{t("supplier.noPayments")}</p>}
          {records.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-slate-50 py-2.5 last:border-0">
              <div>
                <p className="text-sm font-semibold text-slate-800">{r.date}</p>
                <p className="text-[11px] text-slate-400">{fmtNum(r.kg)} kg · {r.grade}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">{fmtLKR(r.amount)}</p>
                <Badge tone={r.status === "Paid" ? "emerald" : "amber"}>{r.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * SmartAutomatedAlerts — Sir's spec Phase 2
 * ------------------------------------------------------------------
 * Computes automated alerts from the supplier's farm activity history:
 *   1. Next fertilizer cycle: 3+ months since last fertilizer → alert
 *   2. Pruning mixture reminder: 45+ days since last pruning → alert
 *   3. Replanting water/shade reminder: within 90 days of replanting → weekly reminder
 *   4. Weather guard: if rain >= 60% in next 1-2 days AND fertilizer logged recently → alert
 * --------------------------------------------------------------------------- */
function SmartAutomatedAlerts({ userUid, forecast }: { userUid: string; forecast: WeatherDay[] }) {
  const [alerts, setAlerts] = useState<{ type: string; title: string; body: string; tone: "amber" | "sky" | "emerald" | "rose" }[]>([]);

  useEffect(() => {
    void (async () => {
      const computed: { type: string; title: string; body: string; tone: "amber" | "sky" | "emerald" | "rose" }[] = [];

      try {
        // Read farm activities from localStorage cache (Phase 1) or Supabase
        const farmRaw = localStorage.getItem("kdu.farm_activities.cache");
        const farmLogs: { activityType: string; loggedDate: string; details: Record<string, unknown> }[] = farmRaw ? JSON.parse(farmRaw) : [];

        const now = Date.now();
        const DAY_MS = 86400_000;

        // 1. Next Fertilizer Cycle Alert (3 months = 90 days)
        const lastFert = farmLogs
          .filter(a => a.activityType === "fertilizer")
          .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate))[0];
        if (lastFert) {
          const daysSince = Math.floor((now - new Date(lastFert.loggedDate).getTime()) / DAY_MS);
          if (daysSince >= 90) {
            const fertType = (lastFert.details as any)?.type ?? "fertilizer";
            const block = (lastFert.details as any)?.block ?? "all blocks";
            computed.push({
              type: "fert-cycle",
              title: "🔄 ඊළඟ පොහොර වටය · Next Fertilizer Cycle Due",
              body: `පොහොර දැමූයේ ${daysSince} දිනකට පෙර (${new Date(lastFert.loggedDate).toLocaleDateString()}). මාස 3කට පසු ඊළඟ වටය යෙදීමට කාලය පැමිණ ඇත. අවසන් වරට ${fertType} භාවිතා කරන ලද ${block} සඳහා.`,
              tone: "amber",
            });
          } else if (daysSince >= 75) {
            computed.push({
              type: "fert-soon",
              title: "⏰ පොහොර වටය ඉක්මීමට ආසන් · Fertilizer Cycle Approaching",
              body: `දින ${90 - daysSince}කින් ඊළඟ පොහොර වටය යෙදීමට කාලය පැමිණේ. පොහොර සූදානම් කරගන්න.`,
              tone: "sky",
            });
          }
        }

        // 2. Pruning Mixture Reminder (45 days after pruning)
        const lastPrune = farmLogs
          .filter(a => a.activityType === "pruning")
          .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate))[0];
        if (lastPrune) {
          const daysSince = Math.floor((now - new Date(lastPrune.loggedDate).getTime()) / DAY_MS);
          if (daysSince >= 40 && daysSince <= 50) {
            computed.push({
              type: "prune-mixture",
              title: "✂️ කප්පාදු පොහොර · Pruning Mixture Reminder",
              body: `කප්පාදු කර දින ${daysSince}ක් ගත වී ඇත. දින 45කින් අලුත් කුරුල්ලන්/දලු මතුවනු ඇත. කප්පාදු පොහොර (Pruning Mixture) යෙදීමට සූදානම් වන්න.`,
              tone: "emerald",
            });
          } else if (daysSince > 50) {
            const pruneType = (lastPrune.details as any)?.type ?? "pruning";
            const block = (lastPrune.details as any)?.block ?? "all blocks";
            computed.push({
              type: "prune-overdue",
              title: "🌱 අලුත් දලු · New Flush Emerging",
              body: `කප්පාදු කර දින ${daysSince}ක් වේ. අලුත් දලු මතුව ඇත (${pruneType}, ${block}). කප්පාදු පොහොර යෙදීමට කාලය පැමිණ ඇත.`,
              tone: "emerald",
            });
          }
        }

        // 3. Replanting Water/Shade Reminder (within 90 days)
        const lastReplant = farmLogs
          .filter(a => a.activityType === "replanting")
          .sort((a, b) => b.loggedDate.localeCompare(a.loggedDate))[0];
        if (lastReplant) {
          const daysSince = Math.floor((now - new Date(lastReplant.loggedDate).getTime()) / DAY_MS);
          const newPlants = (lastReplant.details as any)?.bushCount ?? 0;
          if (daysSince <= 90 && newPlants > 0) {
            const weekNum = Math.ceil(daysSince / 7);
            computed.push({
              type: "replant-care",
              title: "🌿 අලුත් පැළ රැකබලා ගැනීම · New Plant Care",
              body: `අලුතින් සිටුවූ පැළ ${newPlants}ක් — සති ${weekNum}ක් ගත වී ඇත. ජලය/සෙවන සැපයීමට පියවර ගන්න. Water/shade for new plants.`,
              tone: "sky",
            });
          }
        }

        // 4. Weather Guard Alert (if rain expected in next 1-2 days AND fertilizer logged in last 7 days)
        if (forecast.length >= 3) {
          const rainTomorrow = forecast[1]?.rainProb ?? 0;
          const rainDayAfter = forecast[2]?.rainProb ?? 0;
          if (rainTomorrow >= 60 || rainDayAfter >= 60) {
            // Check if fertilizer was logged in last 7 days
            const recentFert = farmLogs.some(a => {
              if (a.activityType !== "fertilizer") return false;
              const d = (now - new Date(a.loggedDate).getTime()) / DAY_MS;
              return d <= 7;
            });
            if (recentFert) {
              computed.push({
                type: "weather-guard",
                title: "⚠️ පොහොර සෝදා යාමේ අවදානම · Fertilizer Wash-Out Risk",
                body: `අදින කිහිපය තුළ පොහොර යොදා ඇත. හෙට වැසි ${rainTomorrow}%, අනිද්ද ${rainDayAfter}%. තද වැසි හේතුවෙන් පොහොර සෝදා යාමේ අවදානමක් ඇත.`,
                tone: "rose",
              });
            }
          }
        }
      } catch { /* ignore errors */ }

      setAlerts(computed);
    })();
  }, [userUid, forecast]);

  if (alerts.length === 0) return null;

  return (
    <Card className="p-4 border-violet-200">
      <div className="mb-2 flex items-center gap-2">
        <BellRing className="h-4 w-4 text-violet-600" />
        <h3 className="font-display text-sm font-bold text-slate-800">🤖 ස්වයංක්‍රීය දැනුම්දීම් · Smart Automated Alerts</h3>
      </div>
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 text-sm ${
              a.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800"
              : a.tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-800"
              : a.tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-sky-200 bg-sky-50 text-sky-800"
            }`}
          >
            <p className="font-semibold text-xs">{a.title}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed">{a.body}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
