import { useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { TrendingUp, TrendingDown, Search, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";

/* ----------------------------- Card ----------------------------- */
export function Card({
  children,
  className,
  hover,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn("card", hover && "card-hover cursor-pointer", className)}
    >
      {children}
    </div>
  );
}

/* ----------------------------- Panel (titled section) ----------------------------- */
export function Panel({
  title,
  subtitle,
  icon,
  action,
  children,
  className,
  bodyClass,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <div className={cn("card", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            {icon}
            <div className="min-w-0">
              {title && <h3 className="font-display text-[15px] font-semibold text-slate-800 truncate">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClass)}>{children}</div>
    </div>
  );
}

/* ----------------------------- Badge ----------------------------- */
type Tone = "emerald" | "amber" | "rose" | "sky" | "violet" | "slate" | "teal";
const TONES: Record<Tone, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
  rose: "bg-rose-50 text-rose-700 ring-rose-600/20",
  sky: "bg-sky-50 text-sky-700 ring-sky-600/20",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
  slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
  teal: "bg-teal-50 text-teal-700 ring-teal-600/20",
};

export function Badge({
  children,
  tone = "slate",
  className,
  dot,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        TONES[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ----------------------------- Icon chip ----------------------------- */
export function IconChip({
  icon: IconComp,
  tone = "emerald",
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  const bg: Record<Tone, string> = {
    emerald: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/30",
    amber: "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/30",
    rose: "bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-rose-500/30",
    sky: "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sky-500/30",
    violet: "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-violet-500/30",
    slate: "bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-slate-500/30",
    teal: "bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-teal-500/30",
  };
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg",
        bg[tone],
        className
      )}
    >
      <IconComp className="h-5 w-5" />
    </span>
  );
}

/* ----------------------------- Sparkline (tiny inline SVG) ----------------------------- */
export function Sparkline({
  data,
  color = "#10b981",
  width = 88,
  height = 30,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((d, i) => `${i * step},${height - ((d - min) / range) * (height - 4) - 2}`);
  const path = `M ${pts.join(" L ")}`;
  const area = `${path} L ${width},${height} L 0,${height} Z`;
  const id = `sp-${color.replace("#", "")}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ----------------------------- StatCard ----------------------------- */
export function StatCard({
  icon,
  label,
  value,
  sub,
  delta,
  trend,
  tone = "emerald",
  spark,
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  delta?: string;
  trend?: "up" | "down";
  tone?: Tone;
  spark?: number[];
  delay?: number;
}) {
  return (
    <Card hover className="p-5 animate-fade-up" >
      <div style={{ animationDelay: `${delay}ms` }} className="animate-fade-up">
        <div className="flex items-start justify-between">
          <IconChip icon={icon} tone={tone} className="h-11 w-11" />
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                trend === "down" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
              )}
            >
              {trend === "down" ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {delta}
            </span>
          )}
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <p className="font-display text-2xl font-bold tracking-tight text-slate-900 tnum">{value}</p>
          {spark && <Sparkline data={spark} color={tone === "amber" ? "#f59e0b" : tone === "rose" ? "#f43f5e" : tone === "sky" ? "#0ea5e9" : tone === "violet" ? "#8b5cf6" : "#10b981"} />}
        </div>
        {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
      </div>
    </Card>
  );
}

/* ----------------------------- Progress / Meter ----------------------------- */
export function Meter({
  value,
  tone = "emerald",
  className,
  showLabel,
}: {
  value: number;
  tone?: Tone;
  className?: string;
  showLabel?: boolean;
}) {
  const bar: Record<Tone, string> = {
    emerald: "bg-gradient-to-r from-emerald-500 to-teal-500",
    amber: "bg-gradient-to-r from-amber-400 to-orange-500",
    rose: "bg-gradient-to-r from-rose-500 to-pink-600",
    sky: "bg-gradient-to-r from-sky-500 to-blue-500",
    violet: "bg-gradient-to-r from-violet-500 to-fuchsia-500",
    slate: "bg-slate-400",
    teal: "bg-gradient-to-r from-teal-500 to-cyan-500",
  };
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all duration-700", bar[tone])} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      {showLabel && <span className="w-9 text-right text-xs font-semibold text-slate-500 tnum">{Math.round(value)}%</span>}
    </div>
  );
}

/* ----------------------------- DataTable ----------------------------- */
export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  className?: string;
  render?: (row: T) => ReactNode;
}

const PAGE_SIZE = 10;

export function DataTable<T>({
  columns,
  rows,
  keyField = "id",
  compact,
  searchable = true,
  pageSize = PAGE_SIZE,
}: {
  columns: Column<T>[];
  rows: T[];
  keyField?: string;
  compact?: boolean;
  searchable?: boolean;
  pageSize?: number;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Filter rows by search term across all column values.
  const searchLower = search.trim().toLowerCase();
  const filtered = searchable && searchLower
    ? rows.filter((row) =>
        columns.some((c) => {
          const val = c.render
            ? "" // skip render columns (can't text-search JSX)
            : String((row as Record<string, unknown>)[c.key] ?? "").toLowerCase();
          return val.includes(searchLower);
        })
      )
    : rows;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div>
      {/* Search bar */}
      {searchable && rows.length > pageSize && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Filter rows…"
            className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none"
          />
          {search && <button onClick={() => setSearch("")} className="text-slate-300 hover:text-slate-500">✕</button>}
        </div>
      )}

      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap py-3 pr-4 text-[11px] font-semibold uppercase tracking-wide text-slate-400",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.className
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-sm text-slate-400">
                  {search ? `No rows match "${search}"` : "No records found."}
                </td>
              </tr>
            ) : (
              pageRows.map((row, i) => (
                <tr key={String((row as Record<string, unknown>)[keyField] ?? i)} className="border-b border-slate-50 last:border-0 transition-colors hover:bg-emerald-50/40">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "whitespace-nowrap py-3 pr-4 text-slate-700",
                        c.align === "right" && "text-right tnum",
                        c.align === "center" && "text-center",
                        compact && "py-2.5"
                      )}
                    >
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            {filtered.length} records · page {safePage + 1} of {totalPages}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition enabled:hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition enabled:hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Section heading ----------------------------- */
export function SectionHeading({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">{title}</h2>
        {desc && <p className="mt-0.5 text-sm text-slate-400">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

/* ----------------------------- Segmented control ----------------------------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-xl bg-slate-100 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ring-focus",
            value === o.value ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------- Page header (module top) ----------------------------- */
export function PageHeader({
  eyebrow,
  title,
  desc,
  icon,
  actions,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        {icon}
        <div>
          {eyebrow && <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">{eyebrow}</p>}
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
          {desc && <p className="mt-1 max-w-2xl text-sm text-slate-500">{desc}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ----------------------------- Empty / Hint ----------------------------- */
export function Hint({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs", TONES[tone], "ring-0")}>
      {children}
    </div>
  );
}
