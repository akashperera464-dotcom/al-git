import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Sprout, Scissors, Leaf, Package, CalendarDays } from "lucide-react";
import { PageHeader, Card, Badge, IconChip } from "@/components/ui";
import { useApp } from "@/context/AppContext";

const MONTH_NAMES_SI = ["ජනවාරි","පෙබරවාරි","මාර්තු","අප්රේල්","මැයි","ජූනි","ජූලි","අගෝස්තු","සැප්තැම්බර්","ඔක්තෝම්බර්","නොවැම්බර්","දෙසැම්බර්"];
const MONTH_NAMES_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["ඉරු","සඳු","අඟ","බදා","බ්රහ","සිකු","සෙන"];

const ACTIVITY_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  fertilizer: { dot: "bg-emerald-500", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  pruning:    { dot: "bg-amber-500",   bg: "bg-amber-50 border-amber-200",   text: "text-amber-700" },
  plucking:   { dot: "bg-sky-500",     bg: "bg-sky-50 border-sky-200",       text: "text-sky-700" },
  replanting: { dot: "bg-violet-500",  bg: "bg-violet-50 border-violet-200", text: "text-violet-700" },
  self_harvest: { dot: "bg-sky-500",   bg: "bg-sky-50 border-sky-200",       text: "text-sky-700" },
};

const ACTIVITY_ICONS: Record<string, typeof Sprout> = {
  fertilizer: Sprout,
  pruning: Scissors,
  plucking: Leaf,
  replanting: Package,
  self_harvest: Leaf,
};

interface FarmLog {
  id?: string;
  activityType: string;
  loggedDate: string;
  details: Record<string, unknown>;
}

export default function SupplierCalendar() {
  const { userUid } = useApp();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Load farm activity logs from localStorage
  const farmLogs = useMemo<FarmLog[]>(() => {
    try {
      const raw = localStorage.getItem("kdu.farm_activities.cache");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }, [userUid]);

  // Build a map: date string → activity types
  const activityMap = useMemo(() => {
    const map: Record<string, FarmLog[]> = {};
    for (const log of farmLogs) {
      const d = log.loggedDate;
      if (!map[d]) map[d] = [];
      map[d].push(log);
    }
    return map;
  }, [farmLogs]);

  // Calendar grid calculations
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const selectedLogs = selectedDay ? (activityMap[selectedDay] ?? []) : [];

  // Activity type summary for this month
  const monthStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const [date, logs] of Object.entries(activityMap)) {
      const [y, m] = date.split("-").map(Number);
      if (y === viewYear && m - 1 === viewMonth) {
        for (const log of logs) {
          stats[log.activityType] = (stats[log.activityType] ?? 0) + 1;
        }
      }
    }
    return stats;
  }, [activityMap, viewYear, viewMonth]);

  return (
    <div>
      <PageHeader
        eyebrow="VVIP Supplier Portal"
        title="📅 My Calendar"
        desc="ගොවිතැන් ක්රියාකාරකම් දිනයෙන් දිනය · Farm activities day by day"
        icon={<IconChip icon={CalendarDays} tone="emerald" className="h-12 w-12" />}
      />

      {/* Month navigation */}
      <Card className="p-4 mb-3">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div className="text-center">
            <p className="font-display text-base font-bold text-slate-800">
              {MONTH_NAMES_EN[viewMonth]} {viewYear}
            </p>
            <p className="text-xs text-slate-400">{MONTH_NAMES_SI[viewMonth]}</p>
          </div>
          <button
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {/* Empty cells for first week */}
          {Array.from({ length: startDow }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
            const logs = activityMap[dateStr] ?? [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDay;
            const types = [...new Set(logs.map(l => l.activityType))];

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                className={`relative flex flex-col items-center rounded-lg p-1 py-1.5 transition ${
                  isSelected ? "bg-emerald-500 text-white ring-2 ring-emerald-400"
                  : isToday ? "bg-emerald-50 ring-1 ring-emerald-300 font-bold"
                  : logs.length > 0 ? "bg-slate-50 hover:bg-slate-100"
                  : "hover:bg-slate-50"
                }`}
              >
                <span className={`text-xs font-semibold ${
                  isSelected ? "text-white" : isToday ? "text-emerald-700" : "text-slate-700"
                }`}>
                  {day}
                </span>
                {/* Activity dots */}
                {types.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {types.slice(0, 3).map(type => (
                      <span
                        key={type}
                        className={`h-1.5 w-1.5 rounded-full ${
                          isSelected ? "bg-white" : ACTIVITY_COLORS[type]?.dot ?? "bg-slate-400"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(ACTIVITY_COLORS).filter(([k]) => k !== "self_harvest").map(([type, colors]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
            <span className="text-[10px] font-medium text-slate-500 capitalize">{type}</span>
          </div>
        ))}
      </div>

      {/* Month summary */}
      {Object.keys(monthStats).length > 0 && (
        <Card className="p-3.5 mb-3">
          <p className="text-xs font-bold text-slate-700 mb-2">📊 මේ මාසේ · This Month's Activities</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(monthStats).map(([type, count]) => {
              const colors = ACTIVITY_COLORS[type];
              return (
                <div key={type} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 ${colors?.bg ?? "bg-slate-50 border-slate-200"}`}>
                  <span className={`h-2 w-2 rounded-full ${colors?.dot ?? "bg-slate-400"}`} />
                  <span className={`text-xs font-semibold capitalize ${colors?.text ?? "text-slate-600"}`}>{type}: {count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Selected day detail */}
      {selectedDay && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-800">
              📋 {new Date(selectedDay + "T00:00:00").toLocaleDateString("en-LK", { weekday: "long", day: "numeric", month: "long" })}
            </h3>
            <button onClick={() => setSelectedDay(null)} className="text-xs text-slate-400 hover:text-slate-600">Close ×</button>
          </div>
          {selectedLogs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No activities logged on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedLogs.map((log, i) => {
                const Icon = ACTIVITY_ICONS[log.activityType] ?? Leaf;
                const colors = ACTIVITY_COLORS[log.activityType];
                return (
                  <div key={i} className={`flex items-start gap-3 rounded-xl border p-3 ${colors?.bg ?? "bg-slate-50 border-slate-200"}`}>
                    <span className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg ${colors?.dot ?? "bg-slate-400"} text-white`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold capitalize ${colors?.text ?? "text-slate-700"}`}>{log.activityType.replace("_", " ")}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {Object.entries(log.details)
                          .filter(([, v]) => v !== undefined && v !== null && v !== "")
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" · ")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {farmLogs.length === 0 && (
        <Card className="p-6 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">ගොවිතැන් ක්රියාකාරකම් නොමැත · No farm activities logged yet.</p>
          <p className="text-xs text-slate-300 mt-1">Log activities in "My Farm Activities" to see them here.</p>
        </Card>
      )}
    </div>
  );
}
