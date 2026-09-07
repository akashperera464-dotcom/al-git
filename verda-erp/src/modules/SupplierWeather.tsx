import { useEffect, useState } from "react";
import { CloudSun, Droplets, Wind, Thermometer, AlertTriangle } from "lucide-react";
import { PageHeader, Card, Badge, IconChip } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useApp } from "@/context/AppContext";
import { fetchForecast, getMockForecast, weatherConfigured } from "@/lib/weather";
import type { WeatherDay } from "@/lib/data";

/**
 * SupplierWeather — "My Weather" module (supplier side)
 * ------------------------------------------------------------------
 * Per Sir's Phase 1 spec #5:
 *   Location-based Weather: Supplier ගේ වත්තේ Location එකට අදාළ Weather Updates පෙන්වීම.
 *
 * Uses the supplier's LINKED estate coordinates (from associatedEntityId).
 * If the linked estate has no coordinates, falls back to Nuwara Eliya defaults.
 *
 * Shows 3-day forecast + an alert if rain is expected (so supplier doesn't
 * apply fertilizer that gets washed away).
 */
export function SupplierWeather() {
  const { estates, associatedEntityId } = useApp();
  const estate = estates.find((e) => e.id === associatedEntityId);

  const [days, setDays] = useState<WeatherDay[]>(getMockForecast());
  const [source, setSource] = useState<"live" | "mock">("mock");

  useEffect(() => {
    let active = true;
    setSource("mock");
    void fetchForecast(estate?.latitude, estate?.longitude).then((res) => {
      if (!active) return;
      setDays(res.days);
      setSource(res.source);
    });
    return () => { active = false; };
  }, [estate?.latitude, estate?.longitude]);

  const today = days[0];
  const rainExpectedSoon = days.slice(0, 3).some(d => d.rainProb >= 60);

  return (
    <div>
      <PageHeader
        eyebrow="VVIP Supplier Portal"
        title="My Weather"
        desc="Live weather forecast for your plot's location. Plan fertilizer application around rain forecasts — rain within 3 days can wash away fertilizer."
        icon={<IconChip icon={CloudSun} tone="sky" className="h-12 w-12" />}
        actions={
          <div className="flex flex-col items-end gap-1.5">
            <Badge tone={source === "live" ? "emerald" : "amber"} dot>
              {weatherConfigured ? (source === "live" ? "Live · OpenWeatherMap" : "Loading live…") : "Demo data"}
            </Badge>
            {estate?.latitude !== undefined && estate?.longitude !== undefined && (
              <span className="text-[10px] text-slate-500">
                📍 {estate.latitude.toFixed(4)}, {estate.longitude.toFixed(4)} · {estate.name}
              </span>
            )}
            {(!estate?.latitude || !estate?.longitude) && (
              <span className="text-[10px] text-amber-500">⚠ No coordinates for your estate — using default (Nuwara Eliya)</span>
            )}
          </div>
        }
      />

      {/* Rain alert banner */}
      {rainExpectedSoon && today && (
        <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-800">
          <p className="flex items-center gap-1.5 text-sm font-bold mb-1">
            <AlertTriangle className="h-4 w-4" /> 🌧️ Rain expected within 3 days
          </p>
          <p className="text-xs leading-relaxed">
            ⚠ Avoid applying fertilizer now — rainfall can wash it away before plants absorb it.
            Wait for a dry window (rain probability &lt; 30%).
          </p>
        </div>
      )}

      {/* Today's hero */}
      {today && (
        <Card className="mt-4 p-5 bg-gradient-to-br from-sky-500 to-blue-700 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-sky-100">{estate?.name ?? "Your Plot"} · Today</p>
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
        </Card>
      )}

      {/* 5-day forecast */}
      <Card className="mt-4 p-4">
        <h3 className="mb-3 font-display text-sm font-bold text-slate-800">5-Day Forecast</h3>
        <div className="space-y-2">
          {days.slice(0, 5).map((d, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5">
              <div className="flex items-center gap-2">
                <Icon name={d.icon} className="h-7 w-7 text-sky-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(Date.now() + i * 86400_000).toLocaleDateString(undefined, { weekday: "short" })}
                  </p>
                  <p className="text-[11px] text-slate-500">{d.condition}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-0.5 text-sky-600"><Droplets className="h-3 w-3" /> {d.rainProb}%</span>
                <span className="tnum font-bold text-slate-700">{d.tempMax}° / {d.tempMin}°</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <p className="mt-3 text-[10px] text-slate-400 px-1">
        * Weather data from OpenWeatherMap API (cached 10 minutes). Falls back to demo data if API key not configured or estate has no coordinates.
      </p>
    </div>
  );
}
