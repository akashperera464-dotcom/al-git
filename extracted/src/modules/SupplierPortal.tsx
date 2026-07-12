import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Package, BellRing, Wallet, Leaf, TrendingUp, CalendarCheck, Droplets, Sparkles, Building2 } from "lucide-react";
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
import type { SupplyRecord } from "@/lib/data";

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
  const { associatedEntityId, estates } = useApp();
  const estate = estates.find((e) => e.id === associatedEntityId);
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-xs text-violet-700">
      <Building2 className="h-4 w-4 shrink-0" />
      Scoped to estate <strong>{estate?.name ?? associatedEntityId}</strong> — you only see deliveries, payments & alerts tied to this association.
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
        eyebrow="VVIP Supplier Portal"
        title={t("supplier.deliveries")}
        desc="Your daily net green-leaf weight and quality grade recorded at collection centers."
        icon={<IconChip icon={Package} tone="emerald" className="h-12 w-12" />}
      />
      <LinkedEstateBanner />
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard icon={Package} label="Net Supplied" value={fmtNum(totalNet)} sub="kg net" tone="emerald" />
        <StatCard icon={Leaf} label="Deliveries" value={String(records.length)} tone="sky" />
        <StatCard icon={TrendingUp} label="Super Grade" value={`${superPct}%`} tone="violet" />
      </div>
      <div className="mt-4 space-y-2.5">
        {loading && <p className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 text-center text-xs text-slate-500">🔄 Syncing live deliveries…</p>}
        {!loading && records.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">No deliveries on record yet.</p>}
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
        <LocationCheckIn estateName={estates.find((e) => e.id === associatedEntityId)?.name ?? "your estate"} />
      </div>
    </div>
  );
}

/** 2 · Smart Alerts Panel — FCM fertilizer & plucking schedules (deterministic). */
export function SupplierAlerts() {
  const { t } = useTranslation();
  const { estates, associatedEntityId } = useApp();
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
        eyebrow="VVIP Supplier Portal"
        title={t("supplier.alerts")}
        desc="FCM fertilizer cycle & plucking schedules generated by deterministic rules."
        icon={<IconChip icon={BellRing} tone="violet" className="h-12 w-12" />}
      />
      <div className="space-y-3">
        <div className="overflow-hidden rounded-2xl p-4 text-white" style={{ background: `linear-gradient(135deg, ${LEVEL_COLOR[advice.level]}, #1e293b)` }}>
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Fertilizer Schedule</p>
          </div>
          <p className="mt-1 font-display text-lg font-bold">{advice.title}</p>
          <p className="text-sm opacity-90">{advice.message}</p>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <CalendarCheck className="h-4 w-4" />
            <span className="font-bold">Apply by {advice.recommendedDate}</span>
          </div>
        </div>

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Leaf className="h-4 w-4 text-emerald-600" />
            <h3 className="font-display text-sm font-bold text-slate-800">Plucking Schedule</h3>
          </div>
          <div className="space-y-2">
            {pluck.map((p) => (
              <div key={p.field.id} className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">{p.field.name}</p>
                  <p className="truncate text-[11px] text-slate-400">{p.reasons[0]}</p>
                </div>
                <Badge tone="emerald">Today</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Smart Agronomic Advisory & Pruning Schedule (plant-age based) */}
        <PruningAdvisory forecast={forecast} />

        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <h3 className="font-display text-sm font-bold text-slate-800">Push Notifications</h3>
            <Badge tone="violet">FCM</Badge>
          </div>
          <div className="space-y-2">
            {[
              { t: "Payment settled", d: "Rs 211,200 credited for your last delivery.", i: "Wallet" },
              { t: "Rain wash-in window", d: `Apply fertilizer by ${advice.recommendedDate} before Day +3 rainfall.`, i: "Droplets" },
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
        eyebrow="VVIP Supplier Portal"
        title={t("supplier.payments")}
        desc="Earnings and payment history for your green-leaf supply."
        icon={<IconChip icon={Wallet} tone="emerald" className="h-12 w-12" />}
      />
      <LinkedEstateBanner />
      <div className="grid grid-cols-3 gap-2.5">
        <StatCard icon={Wallet} label="Total Earned" value={fmtLKRShort(earned)} tone="emerald" />
        <StatCard icon={CalendarCheck} label="Pending" value={fmtLKRShort(supplier.outstandingPayable)} tone="amber" />
        <StatCard icon={TrendingUp} label="Rate / kg" value={fmtLKR(supplier.pricePerKg)} tone="sky" />
      </div>
      <Card className="mt-4 p-4">
        <h3 className="mb-1 font-display text-sm font-bold text-slate-800">Payment History</h3>
        <div>
          {loading && <p className="py-3 text-center text-xs text-slate-500">🔄 Syncing…</p>}
          {!loading && records.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No payments yet.</p>}
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
