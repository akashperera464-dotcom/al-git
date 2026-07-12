import { useEffect, useState } from "react";
import {
  Sprout,
  Users,
  Droplets,
  CircleDollarSign,
  Bug,
  CloudSun,
  Bell,
  CalendarDays,
  ChevronRight,
  TrendingUp,
  Network,
  ShieldCheck,
  FileDown,
} from "lucide-react";
import { PageHeader, StatCard, Panel, Badge, Meter, IconChip } from "@/components/ui";
import { AreaTrend, BarSeries, Donut, Legend } from "@/components/charts";
import { Icon } from "@/components/Icon";
import { recommendPlucking, weatherToAlerts } from "@/lib/predictive";
import {
  dashboardKpis,
  harvestTrend,
  divisionPerformance,
  activities,
  weather7,
  currentWeather,
  complianceItems,
  pluckFields,
  financeSummary,
  fmtLKRShort,
  TODAY_ISO,
} from "@/lib/data";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

/** Fetch real KPI counts from Supabase. Falls back to mock data in demo mode. */
function useRealStats() {
  const [stats, setStats] = useState({
    workers: 0,
    presentToday: 0,
    pendingRequests: 0,
    harvestCount: 0,
    estates: 0,
  });

  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = getSupabase()!;
    void (async () => {
      try {
        const [w, pr, h, e] = await Promise.all([
          sb.from("workers").select("id, present", { count: "exact", head: false }),
          sb.from("resource_requests").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
          sb.from("harvest_records").select("id", { count: "exact", head: true }),
          sb.from("estates").select("id", { count: "exact", head: true }),
        ]);
        setStats({
          workers: w.data?.length ?? 0,
          presentToday: w.data?.filter((x: { present?: boolean }) => x.present).length ?? 0,
          pendingRequests: pr.count ?? 0,
          harvestCount: h.count ?? 0,
          estates: e.count ?? 0,
        });
      } catch { /* keep defaults */ }
    })();
  }, []);

  return stats;
}

// Static class map (Tailwind JIT only sees literal class names).
const ACT_TONE: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  rose: "bg-rose-50 text-rose-600",
  sky: "bg-sky-50 text-sky-600",
  violet: "bg-violet-50 text-violet-600",
};

export default function Dashboard() {
  const real = useRealStats();
  const pluck = recommendPlucking(pluckFields, weather7)
    .filter((p) => p.priority === "today")
    .slice(0, 2);
  const alerts = weatherToAlerts(weather7).slice(0, 2);
  const revSplit = [
    { name: "Made Tea", value: financeSummary.revenue - 18420000, color: "#059669" },
    { name: "Green Leaf", value: 18420000, color: "#f59e0b" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Command Center · Glenview Estate"
        title="Estate Dashboard"
        desc="Real-time operational intelligence across harvest, workforce, inputs and finance."
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
                    { weighed_at: TODAY_ISO, supplier_id: "sup-002", field_id: "C-01", net_kg: 18200, grade: "Standard", amount: 3003000, status: "Pending" },
                  ]);
                });
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <FileDown className="h-4 w-4" /> <span className="hidden sm:inline">Export PDF</span>
            </button>
            <button className="relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-110">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Broadcast Alert</span>
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold ring-2 ring-white">3</span>
            </button>
          </div>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={Sprout} tone="emerald" label="Harvest Records" value={String(real.harvestCount)} sub="total weigh-ins" delay={0} />
        <StatCard icon={TrendingUp} tone="sky" label="Estates" value={String(real.estates)} sub="registered" delay={60} />
        <StatCard icon={Users} tone="violet" label="Active Workforce" value={`${real.presentToday}/${real.workers}`} sub="present today" delta={real.workers > 0 ? `${Math.round((real.presentToday / real.workers) * 100)}%` : undefined} trend="up" delay={120} />
        <StatCard icon={Bell} tone="rose" label="Pending Requests" value={String(real.pendingRequests)} sub="awaiting approval" delay={180} />
        <StatCard icon={Droplets} tone="amber" label="Fertilizer Stock" value={fmtLKRShort(dashboardKpis.fertilizerStockValue)} sub="1 SKU below reorder" delay={0} />
        <StatCard icon={CircleDollarSign} tone="emerald" label="Revenue (MTD)" value={fmtLKRShort(dashboardKpis.revenueMTD)} delta="+9.8%" trend="up" delay={60} />
        <StatCard icon={Bug} tone="rose" label="Pest Alerts" value={String(dashboardKpis.pestAlerts)} sub="Blister blight · S-03" delay={120} />
        <StatCard icon={CalendarDays} tone="teal" label="Plucking Due" value={`${pluck.length + 1} fields`} sub="Optimal window today" delay={180} />
      </div>

      {/* Main grid */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Green Leaf Harvest — 14-day" subtitle="Daily intake vs target (kg)" icon={<IconChip icon={TrendingUp} className="h-9 w-9" />} action={<Badge tone="emerald" dot>Live</Badge>}>
          <AreaTrend data={harvestTrend} xKey="day" yKey="kg" targetKey="target" color="#10b981" unit=" kg" height={248} />
        </Panel>

        <Panel title="Revenue Mix" subtitle="This month" icon={<IconChip icon={CircleDollarSign} tone="emerald" className="h-9 w-9" />}>
          <Donut data={revSplit} centerValue={fmtLKRShort(financeSummary.revenue).replace("Rs ", "Rs")} centerLabel="MTD" height={180} />
          <div className="mt-3">
            <Legend items={revSplit.map((r) => ({ label: r.name, color: r.color, value: fmtLKRShort(r.value) }))} />
          </div>
        </Panel>

        <Panel className="lg:col-span-2" title="Division Performance" subtitle="Achieved vs target yield (kg)" icon={<IconChip icon={Network} className="h-9 w-9" />}>
          <BarSeries
            data={divisionPerformance}
            xKey="name"
            bars={[
              { key: "kg", color: "#10b981", name: "Achieved" },
              { key: "target", color: "#cbd5e1", name: "Target" },
            ]}
            height={230}
            unit=" kg"
          />
        </Panel>

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
