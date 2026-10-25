import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sprout, Lightbulb, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, Card, IconChip, Badge } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { predictYieldFromFertilizer } from "@/lib/predictive";
import { readMyEstates } from "@/lib/estateRepo";
import { readFarmActivities } from "@/lib/repo";

/**
 * SupplierTips — "Tips & Guidance" module (supplier side)
 * ------------------------------------------------------------------
 * Per Phase 1 approved requirement #3:
 *   Motivational Tips & Dynamic Alerts: අක්කර ප්‍රමාණය අනුව ලබාගත හැකි උපරිම අස්වැන්න සහ පොහොර භාවිතය
 *   පිඅබඳ මගපෙන්වන Automated Tips පෙන්වීම.
 *
 * B18 FIX: now fully bilingual via react-i18next.
 * B25 FIX: Added "Expected Yield from Your Fertilizer" card that uses the
 * predictYieldFromFertilizer() function from predictive.ts.
 */

const MOTIVATIONAL_TIPS = [
  {
    titleKey: "supplierTips.tip1Title", bodyKey: "supplierTips.tip1Body",
    tone: "emerald",
  },
  {
    titleKey: "supplierTips.tip2Title", bodyKey: "supplierTips.tip2Body",
    tone: "amber",
  },
  {
    titleKey: "supplierTips.tip3Title", bodyKey: "supplierTips.tip3Body",
    tone: "sky",
  },
  {
    titleKey: "supplierTips.tip4Title", bodyKey: "supplierTips.tip4Body",
    tone: "violet",
  },
  {
    titleKey: "supplierTips.tip5Title", bodyKey: "supplierTips.tip5Body",
    tone: "rose",
  },
];

const YIELD_BY_REGION: Record<string, number> = {
  "low-country": 1500,
  "mid-country": 1100,
  "up-country": 800,
  "default": 1200,
};

/**
 * computeFertilizerGuidance — per-acre fertilizer quantities per approved requirement.
 * Sri Lankan TRI recommendation:
 *   • Urea (46% N):  50 kg/acre/year — split into 4 applications (every 3 months)
 *   • TSP (P):       25 kg/acre/year — split into 2 applications (every 6 months)
 *   • MOP (K):       25 kg/acre/year — split into 2 applications (every 6 months)
 * Returns quantities scaled to the supplier's specific acreage.
 */
function computeFertilizerGuidance(acreage: number): {
  fertilizer: string;
  perAcreKg: number;
  totalKg: number;
  applications: number;
  perApplicationKg: number;
  schedule: string;
}[] {
  const cfg = [
    { fertilizer: "Urea (46% N)", perAcreKg: 50, applications: 4, schedule: "Every 3 months" },
    { fertilizer: "TSP (Phosphate)", perAcreKg: 25, applications: 2, schedule: "Every 6 months" },
    { fertilizer: "MOP (Potash)", perAcreKg: 25, applications: 2, schedule: "Every 6 months" },
  ];
  return cfg.map(c => {
    const total = c.perAcreKg * acreage;
    return {
      fertilizer: c.fertilizer,
      perAcreKg: c.perAcreKg,
      totalKg: Math.round(total),
      applications: c.applications,
      perApplicationKg: Math.round(total / c.applications),
      schedule: c.schedule,
    };
  });
}

function toneClass(tone: string) {
  switch (tone) {
    case "emerald": return "bg-emerald-50 border-emerald-200 text-emerald-700";
    case "amber":   return "bg-amber-50 border-amber-200 text-amber-700";
    case "rose":    return "bg-rose-50 border-rose-200 text-rose-700";
    case "violet":  return "bg-violet-50 border-violet-200 text-violet-700";
    default:        return "bg-sky-50 border-sky-200 text-sky-700";
  }
}

export function SupplierTips() {
  const { t } = useTranslation();
  const { userUid } = useApp();

  // Supabase estates are authoritative across devices.
  const [plot, setPlot] = useState<{ acreage: number; region?: string; fromPending?: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    void readMyEstates(userUid).then((rows) => {
      if (!active) return;
      const estate = rows.find((row) => row.status === "approved") ?? rows.find((row) => row.status === "pending");
      setPlot(estate ? { acreage: estate.acreage, region: estate.region, fromPending: estate.status === "pending" } : null);
    }).catch(() => active && setPlot(null));
    return () => { active = false; };
  }, [userUid]);

  // Farm activities are authoritative in Supabase; localStorage is only the
  // offline transport used by the queue, never the calculation source.
  const [fertUsage, setFertUsage] = useState<{ ureaKg: number; tspKg: number; mopKg: number; dolomiteKg: number; compostKg: number }>({ ureaKg: 0, tspKg: 0, mopKg: 0, dolomiteKg: 0, compostKg: 0 });
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void readFarmActivities(userUid, 200).then((logs) => {
        if (!active) return;
        const usage = { ureaKg: 0, tspKg: 0, mopKg: 0, dolomiteKg: 0, compostKg: 0 };
        for (const log of logs) {
          if (log.activityType !== "fertilizer") continue;
          const type = String(log.details?.type ?? "");
          const qty = Number(log.details?.quantityKg ?? 0);
          if (/urea/i.test(type)) usage.ureaKg += qty;
          else if (/tsp|phosphate/i.test(type)) usage.tspKg += qty;
          else if (/mop|potash/i.test(type)) usage.mopKg += qty;
          else if (/dolomite/i.test(type)) usage.dolomiteKg += qty;
          else if (/compost|organic/i.test(type)) usage.compostKg += qty;
        }
        setFertUsage(usage);
      }).catch(() => active && setFertUsage({ ureaKg: 0, tspKg: 0, mopKg: 0, dolomiteKg: 0, compostKg: 0 }));
    };
    refresh();
    window.addEventListener("verda:farm-cache-updated", refresh);
    return () => { active = false; window.removeEventListener("verda:farm-cache-updated", refresh); };
  }, [userUid]);

  const fertProjection = (plot && plot.acreage > 0 && (fertUsage.ureaKg + fertUsage.tspKg + fertUsage.mopKg > 0))
    ? predictYieldFromFertilizer({
        acreage: plot.acreage,
        ureaKg: fertUsage.ureaKg,
        tspKg: fertUsage.tspKg,
        mopKg: fertUsage.mopKg,
        dolomiteKg: fertUsage.dolomiteKg,
        compostKg: fertUsage.compostKg,
        region: plot.region as any,
        horizonDays: 30,
      })
    : null;

  // Today's tip (rotates daily)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const [tipIndex, setTipIndex] = useState(dayOfYear % MOTIVATIONAL_TIPS.length);

  const tip = MOTIVATIONAL_TIPS[tipIndex];

  const nextTip = () => setTipIndex((i) => (i + 1) % MOTIVATIONAL_TIPS.length);
  const prevTip = () => setTipIndex((i) => (i - 1 + MOTIVATIONAL_TIPS.length) % MOTIVATIONAL_TIPS.length);

  // Personalized yield estimate (only if supplier has entered plot)
  const expectedYield = plot && plot.acreage > 0
    ? Math.round(plot.acreage * (YIELD_BY_REGION[plot.region ?? "default"] ?? YIELD_BY_REGION.default))
    : null;

  return (
    <div>
      <PageHeader
        eyebrow={t("supplierTips.eyebrow")}
        title={t("supplierTips.title")}
        desc={t("supplierTips.desc")}
        icon={<IconChip icon={Lightbulb} tone="amber" className="h-12 w-12" />}
      />

      {/* B25 FIX: Expected yield from fertilizer applied so far */}
      {fertProjection && (
        <Card className="mt-4 p-4 border-violet-200 bg-violet-50">
          <p className="text-sm font-bold text-violet-700 mb-2 flex items-center gap-1.5">
            <Sprout className="h-4 w-4" /> {t("supplierTips.yieldFromFertTitle")}
          </p>
          <p className="text-xs text-violet-700 leading-relaxed mb-2">
            {t("supplierTips.yieldFromFertBody", { kg: fertProjection.expectedKg.toLocaleString() })}
          </p>
          <div className="space-y-1">
            {fertProjection.breakdown.map((b, i) => (
              <div key={i} className="flex items-center justify-between rounded bg-white border border-violet-200 px-2.5 py-1.5 text-xs">
                <span className="font-medium text-slate-700">{b.source}</span>
                <span className="font-bold text-violet-700 tnum">+{b.kg} kg</span>
              </div>
            ))}
          </div>
          {fertProjection.cappedByAcreage && (
            <p className="mt-2 text-[10px] text-violet-600 italic">
              * Capped by your plot's acreage × regional max yield. Apply more fertilizer only if you've increased your plucking round frequency.
            </p>
          )}
          <p className="mt-2 text-[10px] text-violet-600 leading-relaxed">
            {t("supplierTips.yieldFromFertDetail")}
          </p>
        </Card>
      )}

      {/* Personalized banner (only if supplier has entered their plot) */}
      {expectedYield !== null && (
        <Card className="mt-4 p-4 border-emerald-200 bg-emerald-50">
          <p className="text-sm font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
            <Sprout className="h-4 w-4" /> {t("supplierTips.potentialTitle")}
          </p>
          <p className="text-xs text-emerald-700 leading-relaxed">
            {t("supplierTips.potentialBody", {
              acreage: plot!.acreage,
              region: plot!.region ?? "default",
              kg: expectedYield.toLocaleString(),
              monthly: (expectedYield / 12).toFixed(0),
            })}
          </p>
        </Card>
      )}

      {/* NEW (approved requirement): Per-acre fertilizer-specific guidance — computed from plot */}
      {plot && plot.acreage > 0 && (
        <Card className="mt-4 p-4 border-amber-200 bg-amber-50">
          <p className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-1.5">
            {t("supplierTips.fertGuidanceTitle", { acreage: plot.acreage })}
          </p>
          <p className="text-[11px] text-amber-700 mb-3">
            {t("supplierTips.fertGuidanceHint", { acreage: plot.acreage })}
          </p>
          <div className="space-y-1.5">
            {computeFertilizerGuidance(plot.acreage).map((g, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-white border border-amber-200 px-3 py-2 text-xs">
                <div>
                  <p className="font-semibold text-slate-800">{g.fertilizer}</p>
                  <p className="text-[10px] text-slate-500">{g.schedule}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-amber-700 tnum">{g.totalKg} kg/year</p>
                  <p className="text-[10px] text-slate-500">{g.perApplicationKg} kg × {g.applications}/yr</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-amber-600 italic">
            * Based on Sri Lankan Tea Research Institute (TRI) recommendations: Urea 50kg/acre/year (split into 4 applications),
            TSP 25kg/acre/year (split into 2), MOP 25kg/acre/year (split into 2). Adjust based on soil tests.
          </p>
          {plot?.fromPending && (
            <p className="mt-2 text-[10px] text-slate-400 italic">
              * {t("supplierTips.pendingHint")}
            </p>
          )}
        </Card>
      )}

      {/* Today's tip — big highlight */}
      <Card className={`mt-4 p-5 border-2 ${toneClass(tip.tone)}`}>
        <div className="flex items-center justify-between mb-3">
          <Badge tone={tip.tone as any} dot>{t("supplierTips.tipOfDay")}</Badge>
          <div className="flex gap-1">
            <button onClick={prevTip} className="rounded-full border border-slate-200 bg-white p-1.5 hover:bg-slate-50">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button onClick={nextTip} className="rounded-full border border-slate-200 bg-white p-1.5 hover:bg-slate-50">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className="text-base font-bold mb-2">🌱 {t(tip.titleKey)}</p>
        <p className="text-sm leading-relaxed">{t(tip.bodyKey)}</p>
        <p className="mt-3 text-[10px] text-slate-500">
          {t("supplierTips.tipCounter", { current: tipIndex + 1, total: MOTIVATIONAL_TIPS.length })}
        </p>
      </Card>

      {/* All tips list */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">{t("supplierTips.allTips")}</h3>
        <div className="space-y-2">
          {MOTIVATIONAL_TIPS.map((tip, i) => (
            <div
              key={i}
              className={`rounded-lg border p-3 ${i === tipIndex ? toneClass(tip.tone) + " ring-2 ring-offset-1" : "border-slate-200 bg-slate-50"}`}
            >
              <p className="text-sm font-bold mb-1">{t(tip.titleKey)}</p>
              <p className="text-xs leading-relaxed text-slate-700">{t(tip.bodyKey)}</p>
            </div>
          ))}
        </div>
      </Card>

      <p className="mt-3 text-[10px] text-slate-400 px-1">
        * {t("supplierTips.source")}
      </p>
    </div>
  );
}
