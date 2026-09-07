import { useEffect, useState } from "react";
import { Sprout, Lightbulb, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, Card, IconChip, Badge } from "@/components/ui";
import { useApp } from "@/context/AppContext";

/**
 * SupplierTips — "Tips & Guidance" module (supplier side)
 * ------------------------------------------------------------------
 * Per Sir's Phase 1 spec #3:
 *   Motivational Tips & Dynamic Alerts: අක්කර ප්‍රමාණය අනුව ලබාගත හැකි උපරිම අස්වැන්න සහ පොහොර භාවිතය
 *   පිඅබඳ මගපෙන්වන Automated Tips පෙන්වීම.
 *
 * Shows 5 rotating agronomy tips (changes daily) + personalized tip based on
 * supplier's plot acreage (if they entered it via My Plot module).
 *
 * Tips are bilingual (English + Sinhala) for accessibility.
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
  const { userUid } = useApp();

  // Load supplier's plot (for personalized yield estimate)
  const [plot, setPlot] = useState<{ acreage: number; region?: string } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(userUid));
      if (raw) setPlot(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [userUid]);

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
        eyebrow="VVIP Supplier Portal"
        title="Tips & Guidance"
        desc="Daily agronomy tips to maximize your tea plot's yield. Bilingual (English + Sinhala). Personalized to your plot acreage if you've entered it in 'My Plot'."
        icon={<IconChip icon={Lightbulb} tone="amber" className="h-12 w-12" />}
      />

      {/* Personalized banner (only if supplier has entered their plot) */}
      {expectedYield !== null && (
        <Card className="mt-4 p-4 border-emerald-200 bg-emerald-50">
          <p className="text-sm font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
            <Sprout className="h-4 w-4" /> 🌱 Your Plot's Potential
          </p>
          <p className="text-xs text-emerald-700 leading-relaxed">
            For your <strong>{plot!.acreage} acres</strong> plot ({{ "low-country": "low-country", "mid-country": "mid-country", "up-country": "up-country" }[plot!.region ?? "default"] || "default"} region),
            you could harvest up to <strong>{expectedYield.toLocaleString()} kg</strong> green leaf per year (~{(expectedYield / 12).toFixed(0)} kg/month).
            Follow the tips below to reach this potential.
          </p>
        </Card>
      )}

      {/* Today's tip — big highlight */}
      <Card className={`mt-4 p-5 border-2 ${toneClass(tip.tone)}`}>
        <div className="flex items-center justify-between mb-3">
          <Badge tone={tip.tone as any} dot>Today's Tip</Badge>
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
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">All Tips</h3>
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
