import { BrainCircuit, Sparkles, Lock, TrendingUp, Zap, Bot, Plug } from "lucide-react";
import { PageHeader, Panel, Badge, Meter, IconChip, StatCard } from "@/components/ui";
import { BarSeries } from "@/components/charts";
import { estimateYieldKgPerHa } from "@/lib/predictive";
import { pluckFields, rainfallHistory, fertilizerStock, fmtNum } from "@/lib/data";

const GEMINI_CODE = `// src/lib/ai.ts — THE ONLY external LLM integration point
import { GoogleGenerativeAI } from "@google/generative-ai";
const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export async function narrativeInsight(payload: {
  yieldKgPerHa: number; rainfall: number; adherence: number;
}) {
  const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
  const res = await model.generateContent(
    \`Explain this tea estate forecast in plain language for a
     supervisor: \${JSON.stringify(payload)}. Keep it under 60 words.\`,
  );
  return res.response.text();
}`;

export default function AiAnalytics() {
  const rainAnnual = rainfallHistory.reduce((a, b) => a + b, 0);
  const yieldRows = pluckFields.map((f) => {
    const kgha = estimateYieldKgPerHa({
      cultivar: f.cultivar,
      ageYears: 8,
      rainfallAnnualMm: rainAnnual,
      fertilizerAdherencePct: 84,
      pruningPhase: "plucking",
    });
    return { name: f.name.split(" ")[0], kg: Math.round((kgha * f.areaHa) / 1000) };
  });
  const totalProj = yieldRows.reduce((s, y) => s + y.kg, 0);
  const urea = fertilizerStock[0];
  const demand = 6800;
  const coverage = Math.min(100, (urea.onHandKg / demand) * 100);

  return (
    <div>
      <PageHeader
        eyebrow="AI & Analytics · Premium"
        title="Yield Intelligence"
        desc="Yield estimation from rainfall + crop-age variables and resource shortage projections."
        icon={<IconChip icon={BrainCircuit} tone="violet" className="h-12 w-12" />}
        actions={<Badge tone="violet" className="gap-1"><Sparkles className="h-3 w-3" /> Premium</Badge>}
      />

      <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-indigo-700 p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"><BrainCircuit className="h-7 w-7" /></span>
            <div>
              <p className="font-display text-xl font-bold">Forecast Model — 12 month horizon</p>
              <p className="text-sm text-violet-100">Baseline: deterministic · Overlay: optional LLM narrative</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-bold tnum">{fmtNum(totalProj)}t</p>
            <p className="text-xs text-violet-100">projected made tea (5 fields)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Yield / ha" value="2,640 kg" sub="VP clone average" tone="violet" />
        <StatCard icon={Zap} label="Confidence" value="87%" sub="±6% band" tone="emerald" />
        <StatCard icon={TrendingUp} label="Rainfall Input" value={`${fmtNum(rainAnnual)}mm`} sub="Annual mean" tone="sky" />
        <StatCard icon={Lock} label="N-coverage" value={`${Math.round(coverage)}%`} sub="Urea vs demand" tone="amber" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Projected Output by Field" subtitle="Made-tea estimate (tonnes)" icon={<IconChip icon={TrendingUp} tone="violet" className="h-9 w-9" />}>
          <BarSeries data={yieldRows} xKey="name" bars={[{ key: "kg", color: "#8b5cf6", name: "Tonnes" }]} height={240} unit=" t" />
        </Panel>

        <Panel title="Resource Shortage" subtitle="Nitrogen demand vs stock" icon={<IconChip icon={Zap} tone="amber" className="h-9 w-9" />}>
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">Urea (46% N)</span>
              <Badge tone={coverage < 100 ? "rose" : "emerald"}>{coverage < 100 ? "Shortfall" : "Surplus"}</Badge>
            </div>
            <Meter value={coverage} tone={coverage < 100 ? "rose" : "emerald"} showLabel />
            <p className="mt-2 text-xs text-slate-400">On-hand {fmtNum(urea.onHandKg)} kg vs projected demand {fmtNum(demand)} kg.</p>
            {coverage < 100 && (
              <div className="mt-2 rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
                ⚠ Order {fmtNum(demand - urea.onHandKg)} kg Urea within 14 days to protect yield.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel className="mt-4" title="External LLM Integration (optional overlay)" subtitle="src/lib/ai.ts — Gemini / DeepSeek" icon={<IconChip icon={Bot} tone="violet" className="h-9 w-9" />} action={<Badge tone="slate"><Plug className="mr-1 h-3 w-3" /> Not connected</Badge>}>
        <pre className="overflow-x-auto rounded-xl bg-[#04231a] p-4 text-[11px] leading-relaxed text-violet-200 no-scrollbar"><code>{GEMINI_CODE}</code></pre>
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5" />
          Add <code className="rounded bg-white px-1 py-0.5 font-mono">VITE_GEMINI_API_KEY</code> to <code className="rounded bg-white px-1 py-0.5 font-mono">.env</code> to enable narrative insights. The deterministic model above runs without it.
        </div>
      </Panel>
    </div>
  );
}
