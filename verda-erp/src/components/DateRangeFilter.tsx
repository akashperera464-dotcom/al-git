/**
 * Reusable Date Range Picker — filters Supabase queries by date range.
 * Usage: <DateRangeFilter onChange={(start, end) => ...} />
 */
import { useState } from "react";
import { Calendar } from "lucide-react";

export function DateRangeFilter({
  onChange,
  defaultDays = 30,
  label = "Filter by date",
}: {
  onChange: (startDate: string, endDate: string) => void;
  defaultDays?: number;
  label?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultStart = new Date(Date.now() - defaultDays * 86400000).toISOString().slice(0, 10);
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(today);
  const [active, setActive] = useState(false);

  const apply = (s: string, e: string) => {
    setStart(s); setEnd(e); setActive(true);
    onChange(s, e);
  };

  const presets = [
    { label: "Today", days: 0 },
    { label: "7 days", days: 7 },
    { label: "30 days", days: 30 },
    { label: "90 days", days: 90 },
    { label: "This year", days: 365 },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5">
        <Calendar className="h-3.5 w-3.5 text-slate-400" />
        <input type="date" value={start} onChange={e => apply(e.target.value, end)}
          className="text-xs text-slate-600 outline-none" />
        <span className="text-xs text-slate-400">→</span>
        <input type="date" value={end} onChange={e => apply(start, e.target.value)}
          className="text-xs text-slate-600 outline-none" />
      </div>
      <div className="flex gap-1">
        {presets.map(p => (
          <button key={p.label} onClick={() => {
            const e = today;
            const s = new Date(Date.now() - p.days * 86400000).toISOString().slice(0, 10);
            apply(s, e);
          }} className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${active && start === new Date(Date.now() - p.days * 86400000).toISOString().slice(0, 10) ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {p.label}
          </button>
        ))}
      </div>
      {active && (
        <button onClick={() => { setActive(false); onChange("", ""); setStart(defaultStart); setEnd(today); }}
          className="text-[10px] text-rose-500 hover:underline">Clear</button>
      )}
    </div>
  );
}
