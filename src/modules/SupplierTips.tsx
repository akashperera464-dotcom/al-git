import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sprout, Lightbulb, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, Card, IconChip, Badge } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { predictYieldFromFertilizer } from "@/lib/predictive";

/**
 * SupplierTips — "Tips & Guidance" module (supplier side)
 * ------------------------------------------------------------------
 * Per Sir's Phase 1 spec #3:
 *   Motivational Tips & Dynamic Alerts: අක්කර ප්‍රමාණය අනුව ලබාගත හැකි උපරිම අස්වැන්න සහ පොහොර භාවිතය
 *   පිඅබඳ මගපෙන්වන Automated Tips පෙන්වීම.
 *
 * B18 FIX: now fully bilingual via react-i18next.
 * B25 FIX: Added "Expected Yield from Your Fertilizer" card that uses the
 * predictYieldFromFertilizer() function from predictive.ts.
 */

const STORAGE_KEY = (uid: string) => `kdu.supplier_plot.${uid}`;

const MOTIVATIONAL_TIPS = [
  {
    title: "අක්කරයකට උපරිම අස්වැන්න · Max yield per acre",
    body: "සාමාන්‍යයෙන් පහතරට තේ අක්කරයකින් දලු කිලෝ 1500ක් කඩාගත හැක. ඒ සඳහා නිවැරදි පොහොර භාවිතය සහ දලු රවුම් පවත්වාගන්න. (Low-country: up to ~1500 kg green leaf per acre per year.)",
    tone: "emerald",
  },
  {
    title: "පොහොර වර්ග · Fertilizer mix",
    body: "තේ වත්තක නිසි වර්ධනයට වර්ෂයකට අක්කරයකට Urea 50kg + TSP 25kg + MOP 25kg යෙදීම නිර්දේශිතයි. Apply Urea 50kg + TSP 25kg + MOP 25kg per acre per year for healthy bushes.",
    tone: "amber",
  },
  {
    title: "කප්පාදු චක්‍රය · Pruning cycle",
    body: "තේ පැළ වසර 3-4 කට සැරයක් කප්පාදු කළ යුතුය. නිසි කප්පාදුව අස්වැන්න 20%කින් වැඩි කරයි. Prune every 3-4 years; correct pruning boosts yield by ~20%.",
    tone: "sky",
  },
  {
    title: "දලු රවුම් · Plucking rounds",
    body: "දලු රවුම් 7-10 දිනකට සැරයක් පවත්වාගෙන යාම මගින් අස්වැන්න ස්ථාවරව පවතියි. Maintain 7-10 day plucking rounds for consistent yield quality.",
    tone: "violet",
  },
  {
    title: "පැළ ගණන නැවත පරීක්ෂා කිරීම · Re-verify bush count",
    body: "මස 6කට සැරයක් ඔබේ වත්තේ ගස් ගණන නැවත පරීක්ෂා කරන්න. පැළ මැරීම හෝ අලුතින් සිටුවීම නිසා ගස් ගණන වෙනස් වී ඇත්නම් යාවත්කාලීන කරන්න. Re-verify bush count every 6 months — update if bushes died or were replanted.",
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
 * computeFertilizerGuidance — per-acre fertilizer quantities per Sir's spec.
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

  // Load supplier's plot (for personalized yield estimate)
  // B15 FIX: Check both localStorage (approved plot) AND registration requests (pending/approved)
  const [plot, setPlot] = useState<{ acreage: number; region?: string; fromPending?: boolean } | null>(null);
  useEffect(() => {
    // 1. Check approved plot data in localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY(userUid));
      if (raw) {
        const data = JSON.parse(raw);
        if (data.acreage > 0) { setPlot(data); return; }
      }
    } catch { /* ignore */ }

    // 2. Check registration requests (APPROVED or PENDING — B15 FIX)
    try {
      const regRaw = localStorage.getItem("kdu.estate_registration_requests");
      if (regRaw) {
        const allReqs = JSON.parse(regRaw);
        // Prefer APPROVED first, fall back to PENDING
        const myReq = allReqs.find((r: any) =>
          r.supplierId === userUid && (r.status === "APPROVED" || r.status === "PENDING")
        );
        if (myReq && myReq.acreage > 0) {
          setPlot({ acreage: myReq.acreage, region: myReq.region, fromPending: myReq.status === "PENDING" });
          return;
        }
      }
    } catch { /* ignore */ }
  }, [userUid]);

  // B25 FIX: Read fertilizer usage from farm_activities cache to compute
  // yield projection via predictYieldFromFertilizer().
  const [fertUsage, setFertUsage] = useState<{ ureaKg: number; tspKg: number; mopKg: number; dolomiteKg: number; compostKg: number }>({ ureaKg: 0, tspKg: 0, mopKg: 0, dolomiteKg: 0, compostKg: 0 });
  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem("kdu.farm_activities.cache");
        if (!raw) return;
        const logs: { activityType: string; details: { type?: string; quantityKg?: number } }[] = JSON.parse(raw);
        const usage = { ureaKg: 0, tspKg: 0, mopKg: 0, dolomiteKg: 0, compostKg: 0 };
        for (const log of logs) {
          if (log.activityType !== "fertilizer") continue;
          const type = log.details?.type ?? "";
          const qty = Number(log.details?.quantityKg ?? 0);
          if (/urea/i.test(type)) usage.ureaKg += qty;
          else if (/tsp|phosphate/i.test(type)) usage.tspKg += qty;
          else if (/mop|potash/i.test(type)) usage.mopKg += qty;
          else if (/dolomite/i.test(type)) usage.dolomiteKg += qty;
          else if (/compost|organic/i.test(type)) usage.compostKg += qty;
        }
        setFertUsage(usage);
      } catch { /* ignore */ }
    };
    refresh();
    window.addEventListener("verda:farm-cache-updated", refresh);
    return () => window.removeEventListener("verda:farm-cache-updated", refresh);
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

      {/* NEW (Sir's spec): Per-acre fertilizer-specific guidance — computed from plot */}
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
              * ඔබේ ලියාපදිංචිය තවම අනුමත කර නොමැත. ⏳ Tips pending-registration acreage ඇසුරෙන් ගනු ලැබේ.
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
        <p className="text-base font-bold mb-2">🌱 {tip.title}</p>
        <p className="text-sm leading-relaxed">{tip.body}</p>
        <p className="mt-3 text-[10px] text-slate-500">
          Tip {tipIndex + 1} of {MOTIVATIONAL_TIPS.length} · Tap arrows to browse all tips.
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
              <p className="text-sm font-bold mb-1">{tip.title}</p>
              <p className="text-xs leading-relaxed text-slate-700">{tip.body}</p>
            </div>
          ))}
        </div>
      </Card>

      <p className="mt-3 text-[10px] text-slate-400 px-1">
        * Tips sourced from Sri Lankan tea agronomy best practices (TRI — Tea Research Institute guidelines).
      </p>
    </div>
  );
}
