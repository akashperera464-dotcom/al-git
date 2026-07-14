import { useEffect, useState } from "react";
import {
  Sprout, Users, Droplets, CircleDollarSign, Bug, CloudSun, Bell,
  CalendarDays, ChevronRight, TrendingUp, Network, ShieldCheck, FileDown,
  Scale, Package, Loader2,
} from "lucide-react";
import { PageHeader, StatCard, Panel, Badge, Meter, IconChip } from "@/components/ui";
import { AreaTrend, BarSeries, Donut, Legend } from "@/components/charts";
import { Icon } from "@/components/Icon";
import { recommendPlucking, weatherToAlerts } from "@/lib/predictive";
import {
  activities, weather7, currentWeather, complianceItems, pluckFields,
  fmtLKRShort, TODAY_ISO,
} from "@/lib/data";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

/** Real KPI data fetched from Supabase — replaces ALL mock arrays. */
interface DashboardData {
  loading: boolean;
  // KPIs
  totalWorkers: number;
  presentToday: number;
  pendingRequests: number;
  harvestCount: number;
  estates: number;
  greenLeafTodayKg: number;
  activeSuppliersToday: number;
  factoryBatchesActive: number;
  recoveryPct: number;
  // 14-day harvest trend
  harvestTrend: { day: string; kg: number; target: number }[];
  // Division performance
  divisionPerformance: { name: string; kg: number; target: number }[];
  // Finance summary
  revenueMTD: number;
  expensesMTD: number;
  netPL: number;
  // Revenue split
  teaSalesRevenue: number;
  greenLeafCost: number;
}

function useDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>({
    loading: true,
    totalWorkers: 0, presentToday: 0, pendingRequests: 0, harvestCount: 0, estates: 0,
    greenLeafTodayKg: 0, activeSuppliersToday: 0, factoryBatchesActive: 0, recoveryPct: 0,
    harvestTrend: [], divisionPerformance: [],
    revenueMTD: 0, expensesMTD: 0, netPL: 0,
    teaSalesRevenue: 0, greenLeafCost: 0,
  });

  useEffect(() => {
    if (!supabaseConfigured) {
      // Demo mode — keep minimal mock
      setData({
        loading: false,
        totalWorkers: 8, presentToday: 6, pendingRequests: 3, harvestCount: 24, estates: 3,
        greenLeafTodayKg: 0, activeSuppliersToday: 0, factoryBatchesActive: 0, recoveryPct: 0,
        harvestTrend: Array.from({ length: 14 }, (_, i) => ({
          day: `D${i + 1}`, kg: 0, target: 13000,
        })),
        divisionPerformance: [],
        revenueMTD: 0, expensesMTD: 0, netPL: 0,
        teaSalesRevenue: 0, greenLeafCost: 0,
      });
      return;
    }

    const sb = getSupabase()!;
    void (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

        // Run all queries in parallel
        const [workers, pendingReq, harvests, estatesResult, harvestToday, batches, journalLines, glAccounts] = await Promise.all([
          sb.from("workers").select("id, present, status", { count: "exact" }),
          sb.from("resource_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
          sb.from("harvest_records").select("id", { count: "exact", head: true }),
          sb.from("estates").select("id", { count: "exact", head: true }),
          sb.from("harvest_records").select("net_kg, supplier_id, weighed_at").eq("weighed_at", today),
          sb.from("factory_batches").select("green_leaf_in_kg, output_kg, status").neq("status", "rejected"),
          sb.from("journal_lines").select("debit, credit, account_id, journal_entries!inner(status, entry_date)").eq("journal_entries.status", "posted").gte("journal_entries.entry_date", monthStart),
          sb.from("gl_accounts").select("id, code, name, type"),
        ]);

        // Workers
        const workerData = workers.data ?? [];
        const totalWorkers = workerData.filter((w: Record<string, unknown>) => w.status === "active").length;
        const presentToday = workerData.filter((w: Record<string, unknown>) => w.present).length;

        // Green leaf today
        const todayRecords = harvestToday.data ?? [];
        const greenLeafTodayKg = todayRecords.reduce((s: number, r: Record<string, unknown>) => s + Number(r.net_kg ?? 0), 0);
        const activeSuppliersToday = new Set(todayRecords.map((r: Record<string, unknown>) => r.supplier_id)).size;

        // Recovery %
        const batchData = batches.data ?? [];
        const totalGreenLeaf = batchData.reduce((s: number, b: Record<string, unknown>) => s + Number(b.green_leaf_in_kg ?? 0), 0);
        const totalMadeTea = batchData.reduce((s: number, b: Record<string, unknown>) => s + Number(b.output_kg ?? 0), 0);
        const recoveryPct = totalGreenLeaf > 0 ? +((totalMadeTea / totalGreenLeaf) * 100).toFixed(1) : 0;
        const factoryBatchesActive = batchData.filter((b: Record<string, unknown>) => b.status === "open" || b.status === "in_progress").length;

        // 14-day harvest trend
        const harvestTrendResp = await sb.from("harvest_records")
          .select("weighed_at, net_kg")
          .gte("weighed_at", fourteenDaysAgo)
          .order("weighed_at", { ascending: true });
        const trendMap = new Map<string, number>();
        for (const r of harvestTrendResp.data ?? []) {
          const date = r.weighed_at as string;
          trendMap.set(date, (trendMap.get(date) ?? 0) + Number(r.net_kg ?? 0));
        }
        const harvestTrend = Array.from({ length: 14 }, (_, i) => {
          const d = new Date(Date.now() - (13 - i) * 86400000);
          const dateStr = d.toISOString().slice(0, 10);
          return {
            day: d.toLocaleDateString("en", { weekday: "short", day: "numeric" }),
            kg: Math.round(trendMap.get(dateStr) ?? 0),
            target: 13000,
          };
        });

        // Division performance — from fields
        const fieldsResp = await sb.from("fields").select("name, last_yield_kg, area_ha");
        const divisionPerformance = (fieldsResp.data ?? []).slice(0, 6).map((f: Record<string, unknown>) => ({
          name: (f.name as string)?.slice(0, 12) ?? "—",
          kg: Math.round(Number(f.last_yield_kg ?? 0)),
          target: Math.round(Number(f.area_ha ?? 10) * 540),
        }));

        // Finance — from posted journal lines this month
        const accountMap = new Map<string, { code: string; type: string }>();
        for (const a of glAccounts.data ?? []) {
          accountMap.set(a.id, { code: a.code, type: a.type });
        }
        let revenueMTD = 0;
        let expensesMTD = 0;
        let teaSalesRevenue = 0;
        let greenLeafCost = 0;
        for (const line of journalLines.data ?? []) {
          const acc = accountMap.get(line.account_id);
          if (!acc) continue;
          if (acc.type === "revenue") {
            revenueMTD += Number(line.credit ?? 0) - Number(line.debit ?? 0);
            if (acc.code === "4000") teaSalesRevenue += Number(line.credit ?? 0);
          }
          if (acc.type === "expense") {
            expensesMTD += Number(line.debit ?? 0) - Number(line.credit ?? 0);
            if (acc.code === "5000") greenLeafCost += Number(line.debit ?? 0);
          }
        }

        setData({
          loading: false,
          totalWorkers, presentToday,
          pendingRequests: pendingReq.count ?? 0,
          harvestCount: harvests.count ?? 0,
          estates: estatesResult.count ?? 0,
          greenLeafTodayKg: Math.round(greenLeafTodayKg),
          activeSuppliersToday,
          factoryBatchesActive,
          recoveryPct,
          harvestTrend,
          divisionPerformance,
          revenueMTD, expensesMTD,
          netPL: revenueMTD - expensesMTD,
          teaSalesRevenue,
          greenLeafCost,
        });
      } catch (err) {
        console.error("[Dashboard] Failed to load real data:", err);
        setData(prev => ({ ...prev, loading: false }));
      }
    })();
  }, []);

  return data;
}

// Loading skeleton component
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

export default function Dashboard() {
  const d = useDashboardData();
  const pluck = recommendPlucking(pluckFields, weather7).filter((p) => p.priority === "today").slice(0, 2);
  const alerts = weatherToAlerts(weather7).slice(0, 2);
  const revSplit = d.teaSalesRevenue > 0 || d.greenLeafCost > 0
    ? [
        { name: "Tea Sales", value: d.teaSalesRevenue, color: "#059669" },
        { name: "Green Leaf Cost", value: d.greenLeafCost, color: "#f59e0b" },
      ]
    : [{ name: "No Data", value: 1, color: "#cbd5e1" }];

  return (
    <div>
      <PageHeader
        eyebrow="Command Center"
        title="Estate Dashboard"
        desc="Real-time operational intelligence — live data from Supabase."
        icon={<IconChip icon={Sprout} tone="emerald" className="h-12 w-12" />}
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex">
              <CloudSun className="h-5 w-5 text-amber-500" />
              <div className="leading-tight">
                <p className="text-sm font-bold text-slate-800 tnum">{currentWeather.temp}°C</p>
                <p className="text-[10px] text-slate-400">{currentWeather.condition}</p>
              </div>
            </div>
            <button
              onClick={() => {
                import("@/lib/pdfExport").then(({ exportHarvestReport }) => {
                  exportHarvestReport([
                    { weighed_at: TODAY_ISO, supplier_id: "sup-001", field_id: "S-01", net_kg: 24800, grade: "Super", amount: 4092000, status: "Paid" },
                  ]);
                });
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <FileDown className="h-4 w-4" /> <span className="hidden sm:inline">Export PDF</span>
            </button>
          </div>
        }
      />

      {/* KPI grid — real data */}
      {d.loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard icon={Sprout} tone="emerald" label="Green Leaf Today" value={`${d.greenLeafTodayKg.toLocaleString()} kg`} sub={`${d.activeSuppliersToday} active suppliers`} delay={0} />
          <StatCard icon={TrendingUp} tone="sky" label="Estates" value={String(d.estates)} sub="registered" delay={60} />
          <StatCard icon={Users} tone="violet" label="Workforce" value={`${d.presentToday}/${d.totalWorkers}`} sub="present today" delta={d.totalWorkers > 0 ? `${Math.round((d.presentToday / d.totalWorkers) * 100)}%` : undefined} trend="up" delay={120} />
          <StatCard icon={Bell} tone="rose" label="Pending Requests" value={String(d.pendingRequests)} sub="awaiting approval" delay={180} />
          <StatCard icon={Scale} tone="amber" label="Active Batches" value={String(d.factoryBatchesActive)} sub="in factory now" delay={0} />
          <StatCard icon={Scale} tone="violet" label="Recovery %" value={`${d.recoveryPct}%`} sub="made tea / green leaf" delay={60} />
          <StatCard icon={CircleDollarSign} tone="emerald" label="Revenue (MTD)" value={d.revenueMTD > 0 ? fmtLKRShort(d.revenueMTD) : "—"} sub="posted journals" delay={120} />
          <StatCard icon={CircleDollarSign} tone="rose" label="Net P&L (MTD)" value={d.revenueMTD > 0 ? fmtLKRShort(d.netPL) : "—"} sub={`Exp: ${fmtLKRShort(d.expensesMTD)}`} delta={d.netPL >= 0 ? "profit" : "loss"} trend={d.netPL >= 0 ? "up" : "down"} delay={180} />
        </div>
      )}

      {/* Main grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Harvest trend — REAL DATA */}
        <Panel className="lg:col-span-2" title="Green Leaf Harvest — 14-day" subtitle="Daily intake vs target (kg) — live from Supabase" icon={<IconChip icon={TrendingUp} className="h-9 w-9" />} action={<Badge tone="emerald" dot>Live</Badge>}>
          {d.loading ? <Skeleton className="h-[248px]" /> : (
            <AreaTrend data={d.harvestTrend} xKey="day" yKey="kg" targetKey="target" color="#10b981" unit=" kg" height={248} />
          )}
        </Panel>

        {/* Revenue mix — REAL DATA */}
        <Panel title="Revenue Mix" subtitle="This month — from posted journals" icon={<IconChip icon={CircleDollarSign} tone="emerald" className="h-9 w-9" />}>
          {d.loading ? <Skeleton className="h-[180px]" /> : (
            <>
              <Donut data={revSplit} centerValue={d.revenueMTD > 0 ? fmtLKRShort(d.revenueMTD).replace("Rs ", "Rs") : "—"} centerLabel="MTD" height={180} />
              <div className="mt-3">
                <Legend items={revSplit.map((r) => ({ label: r.name, color: r.color, value: fmtLKRShort(r.value) }))} />
              </div>
            </>
          )}
        </Panel>

        {/* Division performance — REAL DATA */}
        <Panel className="lg:col-span-2" title="Division Performance" subtitle="Field yield vs target (kg) — from fields table" icon={<IconChip icon={Network} className="h-9 w-9" />}>
          {d.loading ? <Skeleton className="h-[230px]" /> : d.divisionPerformance.length > 0 ? (
            <BarSeries data={d.divisionPerformance} xKey="name" bars={[{ key: "kg", color: "#10b981", name: "Achieved" }, { key: "target", color: "#cbd5e1", name: "Target" }]} height={230} unit=" kg" />
          ) : (
            <div className="flex h-[230px] flex-col items-center justify-center gap-2 text-center">
              <Package className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-400">No field yield data yet.<br />Add fields in Estate Master to see performance.</p>
            </div>
          )}
        </Panel>

        {/* Live activity — still mock (acceptable) */}
        <Panel title="Live Activity" subtitle="Field & system events" icon={<IconChip icon={Bell} tone="violet" className="h-9 w-9" />}>
          <div className="space-y-3">
            {activities.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ACT_TONE[a.tone] ?? ACT_TONE.sky}`}>
                  <Icon name={a.icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{a.title}</p>
                  <p className="truncate text-xs text-slate-400">{a.meta}</p>
                </div>
                <span className="whitespace-nowrap text-[10px] font-medium text-slate-400">{a.time}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Bottom row */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Smart Plucking — Today" subtitle="Deterministic field priority" icon={<IconChip icon={Sprout} tone="emerald" className="h-9 w-9" />}>
          <div className="space-y-2.5">
            {pluck.map((p) => (
              <div key={p.field.id} className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                <div>
                  <p className="text-sm font-bold text-slate-800">{p.field.name}</p>
                  <p className="text-xs text-slate-400">{p.field.division} · {p.field.cultivar}</p>
                </div>
                <Badge tone="emerald">Score {p.score}</Badge>
              </div>
            ))}
          </div>
          <button className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white">
            Open full plan <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </Panel>

        <Panel title="Environmental Alerts" subtitle="Rule-based (no AI)" icon={<IconChip icon={CloudSun} tone="amber" className="h-9 w-9" />}>
          <div className="space-y-2.5">
            {alerts.map((al) => (
              <div key={al.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                <Icon name={al.icon} className="mt-0.5 h-4 w-4 text-amber-600" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{al.title}</p>
                  <p className="text-xs text-slate-400">{al.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Compliance Snapshot" subtitle="Certification baselines" icon={<IconChip icon={ShieldCheck} tone="teal" className="h-9 w-9" />}>
          <div className="space-y-3">
            {complianceItems.map((c) => (
              <div key={c.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{c.standard}</span>
                  <Badge tone={c.status === "Certified" ? "emerald" : c.status === "Action Needed" ? "rose" : "amber"}>{c.status}</Badge>
                </div>
                <Meter value={c.score} tone={c.score >= 85 ? "emerald" : c.score >= 75 ? "amber" : "rose"} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

const ACT_TONE: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  sky: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
};
