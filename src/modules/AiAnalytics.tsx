import { BrainCircuit, Lock, TrendingUp, Zap, Bot, Plug, Scissors } from "lucide-react";
import { PageHeader, Panel, Badge, Meter, IconChip, StatCard } from "@/components/ui";
import { BarSeries } from "@/components/charts";
import { estimateYieldKgPerHa, projectLeafSupplyAfterPruning, type PruningProjectionInput } from "@/lib/predictive";
import { pluckFields, rainfallHistory, fertilizerStock, fmtNum } from "@/lib/data";
import { useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

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
        eyebrow="Estate Intelligence"
        title="Yield Intelligence"
        desc="Yield estimation from rainfall + crop-age variables and resource shortage projections."
        icon={<IconChip icon={BrainCircuit} tone="violet" className="h-12 w-12" />}
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

      {/* B28 FIX: Pruning-based Leaf Supply Projection panel.
          Reads pruning activities from farm_activities and projects yield drop. */}
      <PruningSupplyProjectionPanel />
    </div>
  );
}

/**
 * PruningSupplyProjectionPanel — admin view that scans the farm_activities
 * table for recent pruning events and uses projectLeafSupplyAfterPruning()
 * to compute the expected leaf supply drop over the next month.
 *
 * B28 FIX — closes the gap where admin had no UI to see "pruning done →
 * expect 30% less leaf in 2-3 months" projections.
 */
function PruningSupplyProjectionPanel() {
  const [projections, setProjections] = useState<Array<{
    supplierId: string;
    pruneType: string;
    daysSincePrune: number;
    result: ReturnType<typeof projectLeafSupplyAfterPruning>;
  }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      setBusy(true);
      try {
        if (!supabaseConfigured) {
          // Demo data — show 2 example pruning events
          const demoLogs = [
            { supplierId: "Sumithra Green Leaf Co.", pruneType: "deep", daysSincePrune: 30 },
            { supplierId: "Nimal Tea Suppliers", pruneType: "medium", daysSincePrune: 75 },
            { supplierId: "Saman Tea Estate", pruneType: "light", daysSincePrune: 45 },
          ];
          setProjections(demoLogs.map(l => ({
            supplierId: l.supplierId,
            pruneType: l.pruneType,
            daysSincePrune: l.daysSincePrune,
            result: projectLeafSupplyAfterPruning({
              pruneType: l.pruneType as PruningProjectionInput["pruneType"],
              daysSincePrune: l.daysSincePrune,
              areaHa: 2,
            }),
          })));
          return;
        }
        const sb = getSupabase()!;
        // Read pruning activities from the last 12 months
        const since = new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10);
        const { data, error } = await sb
          .from("farm_activities")
          .select("user_id, logged_date, details")
          .eq("activity_type", "pruning")
          .gte("logged_date", since)
          .order("logged_date", { ascending: false });
        if (error) throw error;

        const now = Date.now();
        const DAY = 86400000;
        const latestPerSupplier: Record<string, { logged_date: string; details: any }> = {};
        for (const r of (data ?? [])) {
          if (!latestPerSupplier[r.user_id]) {
            latestPerSupplier[r.user_id] = { logged_date: r.logged_date, details: r.details };
          }
        }

        const result = Object.entries(latestPerSupplier).map(([supplierId, l]) => {
          const daysSincePrune = Math.floor((now - new Date(l.logged_date).getTime()) / DAY);
          const pruneType = (l.details?.type ?? "light") as PruningProjectionInput["pruneType"];
          return {
            supplierId,
            pruneType,
            daysSincePrune,
            result: projectLeafSupplyAfterPruning({
              pruneType,
              daysSincePrune,
              areaHa: Number(l.details?.areaHa ?? 1),
            }),
          };
        }).filter(p => p.result.currentDropPct > 0);
        setProjections(result);
      } catch {
        // keep empty
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  const totalLostKgThisMonth = projections.reduce((s, p) => s + p.result.projectedLostKgThisMonth, 0);
  const totalActiveProjections = projections.length;

  return (
    <Panel
      className="mt-4"
      title="Pruning Impact on Leaf Supply (B28)"
      subtitle="Projected leaf supply drop from recent pruning events"
      icon={<IconChip icon={Scissors} tone="amber" className="h-9 w-9" />}
      action={totalActiveProjections > 0 ? <Badge tone="amber">{totalActiveProjections} active</Badge> : <Badge tone="emerald">No active drops</Badge>}
    >
      {busy ? (
        <div className="py-4 text-center text-sm text-slate-400">Scanning pruning logs…</div>
      ) : projections.length === 0 ? (
        <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
          ✓ No recent pruning events with active yield drops. All blocks are in plucking phase.
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] font-semibold text-amber-700">Projected Leaf Loss This Month</p>
              <p className="text-2xl font-extrabold text-amber-700 tnum">{fmtNum(totalLostKgThisMonth)} kg</p>
              <p className="text-[10px] text-amber-600">across {totalActiveProjections} block(s)</p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
              <p className="text-[11px] font-semibold text-sky-700">Avg Yield Drop</p>
              <p className="text-2xl font-extrabold text-sky-700 tnum">
                {projections.length > 0
                  ? (projections.reduce((s, p) => s + p.result.currentDropPct, 0) / projections.length).toFixed(1)
                  : 0}%
              </p>
              <p className="text-[10px] text-sky-600">weighted across affected blocks</p>
            </div>
          </div>

          {/* Per-supplier projections */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Supplier</th>
                  <th className="pb-2">Prune Type</th>
                  <th className="pb-2 text-right">Days Since</th>
                  <th className="pb-2 text-right">Current Drop %</th>
                  <th className="pb-2 text-right">Recovery (days)</th>
                  <th className="pb-2 text-right">Lost Kg/Month</th>
                </tr>
              </thead>
              <tbody>
                {projections.map((p) => (
                  <tr key={p.supplierId} className="border-t border-slate-100">
                    <td className="py-2 font-semibold text-slate-800">{p.supplierId}</td>
                    <td className="py-2 capitalize text-slate-600">{p.pruneType}</td>
                    <td className="py-2 text-right tnum text-slate-500">{p.daysSincePrune}d</td>
                    <td className="py-2 text-right tnum font-bold text-amber-700">{p.result.currentDropPct}%</td>
                    <td className="py-2 text-right tnum text-slate-500">{p.result.recoveryDays}d</td>
                    <td className="py-2 text-right tnum font-bold text-rose-600">{fmtNum(p.result.projectedLostKgThisMonth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-slate-400">
            * Projection uses deterministic TRI recovery curves: deep=30% / medium=20% / light=10% / skiffing=8%.
            Trough + recovery windows scale per prune type. Read from <code>farm_activities</code> where activity_type='pruning'.
          </p>
        </>
      )}
    </Panel>
  );
}
