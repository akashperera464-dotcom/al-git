import { useEffect, useState } from "react";
import { CloudSun, Droplets, Wind, Thermometer, AlertTriangle } from "lucide-react";
import { PageHeader, Panel, Badge, IconChip } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { AreaTrend } from "@/components/charts";
import { weatherToAlerts } from "@/lib/predictive";
import { rainfallHistory, type WeatherDay } from "@/lib/data";
import { fetchForecast, getMockForecast, weatherConfigured } from "@/lib/weather";
import { useApp } from "@/context/AppContext";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SEV_TONE: Record<string, "rose" | "amber" | "sky" | "emerald"> = {
  critical: "rose",
  warning: "amber",
  info: "sky",
  success: "emerald",
};

export default function Weather() {
  const { estates } = useApp();
  const [selectedEstateId, setSelectedEstateId] = useState<string>("");
  const [days, setDays] = useState<WeatherDay[]>(getMockForecast());
  const [source, setSource] = useState<"live" | "mock">("mock");

  // Default to the first estate (or "all").
  const selectedEstate = estates.find((e) => e.id === selectedEstateId) ?? estates[0];

  // Load live OpenWeatherMap forecast for the SELECTED estate's coordinates.
  useEffect(() => {
    if (!selectedEstate) return;
    let active = true;
    setSource("mock");
    void fetchForecast(selectedEstate.latitude, selectedEstate.longitude).then((res) => {
      if (!active) return;
      setDays(res.days);
      setSource(res.source);
    });
    return () => {
      active = false;
    };
  }, [selectedEstate?.id, selectedEstate?.latitude, selectedEstate?.longitude]);

  const alerts = weatherToAlerts(days);
  const today = days[0] ?? getMockForecast()[0];
  const rainfall = months.map((m, i) => ({ day: m, kg: rainfallHistory[i] }));

  return (
    <div>
      <PageHeader
        eyebrow="Weather & Environmental Monitoring"
        title={`Forecast & Alerts${selectedEstate ? ` · ${selectedEstate.name}` : ""}`}
        desc="Per-estate live weather. Rainfall projections drive deterministic agronomic alerts (no AI)."
        icon={<IconChip icon={CloudSun} tone="sky" className="h-12 w-12" />}
        actions={
          <div className="flex flex-col items-end gap-1.5">
            {estates.length > 1 && (
              <select
                value={selectedEstateId}
                onChange={(e) => setSelectedEstateId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
              >
                <option value="">All / Default</option>
                {estates.map((est) => <option key={est.id} value={est.id}>{est.name}</option>)}
              </select>
            )}
            <Badge tone={source === "live" ? "emerald" : "amber"} dot>
              {weatherConfigured ? (source === "live" ? "Live · OpenWeatherMap" : "Loading live…") : "Demo data"}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Current hero — derived from LIVE per-estate forecast */}
        <Panel className="lg:col-span-1" bodyClass="bg-gradient-to-br from-sky-500 to-blue-700 -m-0 rounded-2xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-sky-100">{selectedEstate?.name ?? "Default"} · {selectedEstate?.region ?? "Nuwara Eliya"}</p>
              <p className="font-display text-5xl font-bold tnum">{today.tempMax}°</p>
              <p className="text-sky-100">{today.condition}</p>
            </div>
            <Icon name={today.icon} className="h-16 w-16 text-white/90" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white/15 p-2"><Droplets className="mx-auto h-4 w-4" /><p className="mt-1 text-sm font-bold tnum">{today.rainProb}%</p><p className="text-[10px] text-sky-100">Rain Prob</p></div>
            <div className="rounded-lg bg-white/15 p-2"><Wind className="mx-auto h-4 w-4" /><p className="mt-1 text-sm font-bold tnum">{today.windKph} kph</p><p className="text-[10px] text-sky-100">Wind</p></div>
            <div className="rounded-lg bg-white/15 p-2"><Thermometer className="mx-auto h-4 w-4" /><p className="mt-1 text-sm font-bold tnum">{today.tempMin}°</p><p className="text-[10px] text-sky-100">Min Temp</p></div>
          </div>
          <div className="mt-3 rounded-lg bg-white/15 p-2 text-center"><p className="text-sm font-bold">{today.rainMm}mm rain today</p></div>
        </Panel>

        {/* 7 day */}
        <Panel className="lg:col-span-2" title="7-Day Forecast" subtitle="Temperature · rainfall · wind" icon={<IconChip icon={CloudSun} tone="sky" className="h-9 w-9" />}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {days.map((d, i) => (
              <div key={d.date} className={`rounded-xl border p-3 text-center ${i === 0 ? "border-emerald-300 bg-emerald-50/40" : "border-slate-100"}`}>
                <p className="text-xs font-bold text-slate-600">{i === 0 ? "Today" : d.dayName}</p>
                <Icon name={d.icon} className={`mx-auto my-2 h-7 w-7 ${d.rainMm >= 20 ? "text-sky-500" : d.rainMm >= 8 ? "text-sky-400" : "text-amber-500"}`} />
                <p className="text-[11px] font-semibold text-slate-700 tnum">{d.tempMax}°/{d.tempMin}°</p>
                <p className="mt-0.5 flex items-center justify-center gap-0.5 text-[10px] text-sky-600"><Droplets className="h-2.5 w-2.5" />{d.rainMm}mm</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Rainfall — Annual Trend" subtitle="Monthly precipitation (mm)" icon={<IconChip icon={Droplets} tone="sky" className="h-9 w-9" />}>
          <AreaTrend data={rainfall} xKey="day" yKey="kg" color="#0ea5e9" height={210} unit=" mm" />
        </Panel>

        <Panel title="Actionable Alerts" subtitle="Deterministic rules engine" icon={<IconChip icon={AlertTriangle} tone="amber" className="h-9 w-9" />}>
          <div className="space-y-2.5">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                <Icon name={a.icon} className="mt-0.5 h-4 w-4 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                    <Badge tone={SEV_TONE[a.severity]}>{a.severity}</Badge>
                  </div>
                  <p className="text-xs text-slate-400">{a.detail}</p>
                  <p className="mt-1 text-[11px] font-semibold text-emerald-600">→ {a.action}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
