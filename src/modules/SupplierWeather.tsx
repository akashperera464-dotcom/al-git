import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CloudSun, Droplets, MapPin, Thermometer, Wind } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { WeatherAtmosphere } from "@/components/WeatherAtmosphere";
import { useApp } from "@/context/AppContext";
import { weatherStatusText } from "@/lib/weather";
import { useEstateWeather, useSupplierWeatherEstate } from "@/lib/useEstateWeather";
import { getWeatherPresentation } from "@/lib/weatherPresentation";

export function SupplierWeather() {
  const { t, i18n } = useTranslation();
  const { userUid, associatedEntityId } = useApp();
  const selection = useSupplierWeatherEstate(userUid, associatedEntityId);
  const weather = useEstateWeather(selection.estate?.latitude, selection.estate?.longitude);
  const days = weather.days;
  const today = days[0];
  const presentation = useMemo(() => getWeatherPresentation(today), [today]);
  const locationLabel = selection.estate?.name ?? t("supplierWeather.title");
  const rainExpectedSoon = weather.status === "live" && days.slice(0, 3).some((day) => day.rainProb >= 60);

  return (
    <div className="supplier-weather-surface -m-4 min-h-full p-4" style={{ background: presentation.pageGradient }}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-sky-600 shadow-lg shadow-sky-900/10 backdrop-blur"><CloudSun className="h-5 w-5" /></span>
          <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-sky-700">{t("supplierWeather.eyebrow")}</p><h1 className="font-display text-2xl font-extrabold text-slate-900">{t("supplierWeather.title")}</h1><p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-600">{t("supplierWeather.desc")}</p></div>
        </div>
        <div className="flex max-w-full flex-col items-end gap-1.5">
          {selection.estates.length > 1 && <select value={selection.selectedEstateId} onChange={(event) => selection.setSelectedEstateId(event.target.value)} className="max-w-48 rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">{selection.estates.map((estate) => <option key={estate.id} value={estate.id}>{estate.name}</option>)}</select>}
          <Badge tone={weather.status === "live" ? "emerald" : "amber"} dot>{weather.loading ? "Loading live weather…" : weatherStatusText(weather.status, days.length)}</Badge>
        </div>
      </div>

      {today && <section className="weather-hero relative overflow-hidden rounded-[2rem] p-5 text-white" style={{ background: presentation.gradient }}>
        <WeatherAtmosphere mood={presentation.mood} />
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-white/70"><MapPin className="h-3.5 w-3.5" />{locationLabel}</p>
            <div className="mt-2 flex items-end gap-2"><span className="font-display text-6xl font-black leading-none tnum">{today.tempMax}°</span><span className="pb-1 text-sm font-bold text-white/70">{t(presentation.labelKey)}</span></div>
            <p className="mt-2 text-sm font-semibold text-white/85">{today.condition} · {t("supplierWeather.todayLabel")}</p>
          </div>
          <div className="weather-glass flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.65rem]"><Icon name={today.icon} className="h-12 w-12 text-white" /></div>
        </div>

        <div className="relative z-10 mt-5 grid grid-cols-3 gap-2">
          <Metric icon={Droplets} value={`${today.rainProb}%`} label="Rain" />
          <Metric icon={Wind} value={`${today.windKph} km/h`} label="Wind" />
          <Metric icon={Thermometer} value={`${today.tempMin}°`} label="Minimum" />
        </div>
        <div className="weather-glass relative z-10 mt-3 rounded-2xl p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-white/60">{t("supplierWeather.fieldGuidance")}</p>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-white/95">{t(presentation.guidanceKey)}</p>
        </div>
      </section>}

      {rainExpectedSoon && <div className="mt-4 rounded-2xl border border-rose-200 bg-white/80 p-4 text-rose-800 shadow-sm backdrop-blur-xl">
        <p className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="h-4 w-4" />{t("supplierWeather.rainAlertTitle")}</p>
        <p className="mt-1 text-xs leading-relaxed text-rose-700">{t("supplierWeather.rainAlertBody")}</p>
      </div>}

      <Card className="mt-4 border-white/80 bg-white/80 p-4 shadow-lg shadow-slate-900/5 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between"><div><p className="font-display text-sm font-bold text-slate-900">{days.length}-Day Forecast</p><p className="text-[10px] text-slate-500">{locationLabel}</p></div><CloudSun className="h-5 w-5 text-sky-500" /></div>
        <div className="space-y-2">
          {days.slice(0, 5).map((day, index) => {
            const dayPresentation = getWeatherPresentation(day);
            return <div key={day.date || index} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/75 p-3 transition hover:border-sky-200">
              <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ background: dayPresentation.gradient }}><Icon name={day.icon} className="h-5 w-5" /></span><div className="min-w-0"><p className="text-sm font-bold text-slate-800">{index === 0 ? t("supplierWeather.todayLabel") : index === 1 ? t("supplierWeather.tomorrow") : new Date(`${day.date}T12:00:00`).toLocaleDateString(i18n.language, { weekday: "long" })}</p><p className="truncate text-[10px] text-slate-500">{day.condition}</p></div></div>
              <div className="shrink-0 text-right"><p className="text-sm font-extrabold text-slate-800 tnum">{day.tempMax}° <span className="font-medium text-slate-400">/ {day.tempMin}°</span></p><p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-sky-600"><Droplets className="h-3 w-3" />{day.rainProb}%</p></div>
            </div>;
          })}
        </div>
      </Card>

      {(selection.estate?.latitude === undefined || selection.estate?.longitude === undefined) && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs font-semibold text-amber-700">⚠ Estate GPS missing — demo weather only. Add the estate location to receive local live weather.</p>}
      <p className="mt-3 px-1 text-[10px] leading-relaxed text-slate-500">Weather data from OpenWeatherMap is cached for 10 minutes. Demo data is display-only and never creates operational warnings.</p>
    </div>
  );
}

function Metric({ icon: MetricIcon, value, label }: { icon: typeof Droplets; value: string; label: string }) {
  return <div className="weather-glass rounded-2xl p-3 text-center"><MetricIcon className="mx-auto h-4 w-4 text-white/80" /><p className="mt-1 text-sm font-extrabold tnum">{value}</p><p className="text-[9px] text-white/60">{label}</p></div>;
}
