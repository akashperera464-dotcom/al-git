import type { ReactNode } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  RadialBarChart,
  RadialBar,
  Label,
} from "recharts";

const AXIS = { fontSize: 11, fill: "#94a3b8" };

function ChartTip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      {label != null && <p className="mb-1 text-[11px] font-semibold text-slate-400">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-semibold text-slate-800 tnum">
            {Number(p.value).toLocaleString("en-US")}
            {unit ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AreaTrend({
  data,
  xKey,
  yKey,
  targetKey,
  color = "#10b981",
  height = 220,
  unit = "",
}: {
  data: Record<string, any>[];
  xKey: string;
  yKey: string;
  targetKey?: string;
  color?: string;
  height?: number;
  unit?: string;
}) {
  const gid = `area-${yKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.34} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<ChartTip unit={unit} />} />
        {targetKey && (
          <Area type="monotone" dataKey={targetKey} stroke="#cbd5e1" strokeDasharray="5 5" fill="none" strokeWidth={1.5} />
        )}
        <Area type="monotone" dataKey={yKey} stroke={color} strokeWidth={2.5} fill={`url(#${gid})`} activeDot={{ r: 5, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarSeries({
  data,
  xKey,
  bars,
  height = 240,
  unit = "",
}: {
  data: Record<string, any>[];
  xKey: string;
  bars: { key: string; color: string; name?: string; radius?: number }[];
  height?: number;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f5" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={48} />
        <Tooltip cursor={{ fill: "rgba(16,185,129,0.06)" }} content={<ChartTip unit={unit} />} />
        {bars.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.name ?? b.key} fill={b.color} radius={[6, 6, 0, 0]} maxBarSize={42} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Donut({
  data,
  height = 220,
  centerLabel,
  centerValue,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="100%" paddingAngle={2} stroke="none">
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTip />} />
        </PieChart>
      </ResponsiveContainer>
      {(centerValue || centerLabel) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="font-display text-2xl font-bold text-slate-900 tnum">{centerValue}</span>}
          {centerLabel && <span className="text-[11px] font-medium text-slate-400">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}

export function RadialGauge({
  value,
  color = "#10b981",
  height = 180,
  label,
}: {
  value: number;
  color?: string;
  height?: number;
  label?: string;
}) {
  const data = [{ name: "v", value, fill: color }];
  return (
    <div style={{ height }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={220} endAngle={-40}>
          <defs>
            <linearGradient id={`g-${color.replace("#", "")}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={color} stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <RadialBar background={{ fill: "#eef2f5" }} dataKey="value" cornerRadius={20} fill={`url(#g-${color.replace("#", "")})`} />
          <Label position="center" content={() => null} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-2">
        <span className="font-display text-2xl font-bold text-slate-900 tnum">{value}%</span>
        {label && <span className="text-[11px] text-slate-400">{label}</span>}
      </div>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5 text-xs">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
          <span className="text-slate-500">{it.label}</span>
          {it.value && <span className="font-semibold text-slate-700 tnum">{it.value}</span>}
        </div>
      ))}
    </div>
  );
}
