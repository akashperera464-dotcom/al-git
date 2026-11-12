/// <reference types="vite/client" />
/**
 * Verda · OpenWeatherMap service (live, per-estate deterministic-alerts input)
 * ------------------------------------------------------------------
 * Fetches the real 5-day / 3-hour forecast for a SPECIFIC estate's coordinates
 * and aggregates it into daily summaries matching `WeatherDay[]`.
 *
 * Now DYNAMIC: callers pass the estate's lat/lon so each estate gets its own
 * localized weather (instead of one shared location). Falls back to clearly
 * labelled display-only mock data; decision-making callers require `live`.
 */
import { weather7, type WeatherDay } from "./data";

const OW_KEY = import.meta.env.VITE_OW_API_KEY as string | undefined;
export const weatherConfigured = Boolean(OW_KEY && OW_KEY !== "your_openweathermap_api_key");
export type WeatherStatus = "live" | "missing-coordinates" | "not-configured" | "request-failed";
export interface ForecastResult {
  days: WeatherDay[];
  source: "live" | "mock";
  status: WeatherStatus;
}

// ---- in-memory cache so repeated calls for the same estate don't re-hit the API ----
const cache = new Map<string, { days: WeatherDay[]; ts: number }>();
const inFlight = new Map<string, Promise<ForecastResult>>();
const CACHE_MS = 10 * 60 * 1000; // 10 minutes

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Map an OWM weather code → app condition + lucide icon name. */
function describe(code: number, rainMm: number): { condition: string; icon: string } {
  if (code >= 200 && code < 300) return { condition: "Thunderstorm", icon: "CloudLightning" };
  if (code >= 300 && code < 500) return { condition: "Light Rain", icon: "CloudDrizzle" };
  if (code >= 500 && code < 600) return rainMm >= 20 ? { condition: "Heavy Rain", icon: "CloudRain" } : { condition: "Showers", icon: "CloudRain" };
  if (code >= 600 && code < 700) return { condition: "Snow", icon: "Snowflake" };
  if (code >= 700 && code < 800) return { condition: "Misty", icon: "CloudFog" };
  if (code === 800) return { condition: "Sunny", icon: "Sun" };
  if (code === 801 || code === 802) return { condition: "Partly Cloudy", icon: "CloudSun" };
  return { condition: "Cloudy", icon: "Cloud" };
}

export interface OwmListItem {
  dt: number;
  main: { temp: number; temp_max: number; temp_min: number };
  weather: { id: number; description: string }[];
  wind: { speed: number };
  pop?: number;
  rain?: { "3h"?: number };
}

interface OwmForecastResponse {
  list: OwmListItem[];
  city?: { name?: string; timezone?: number };
  cod?: string | number;
  message?: string;
}

export function hasWeatherCoordinates(lat?: number, lon?: number): lat is number {
  return typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lon === "number" && Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

export function totalRainfallMm(items: Array<{ rain?: { "3h"?: number } }>): number {
  return Math.round(items.reduce((sum, item) => sum + (item.rain?.["3h"] ?? 0), 0));
}

function localDateKey(unixSeconds: number, timezoneOffsetSeconds: number): string {
  return new Date((unixSeconds + timezoneOffsetSeconds) * 1000).toISOString().slice(0, 10);
}

function localHour(unixSeconds: number, timezoneOffsetSeconds: number): number {
  return new Date((unixSeconds + timezoneOffsetSeconds) * 1000).getUTCHours();
}

/**
 * Convert OpenWeather's 3-hour intervals into daily cards without confusing
 * a later daily rain risk with the condition shown right now.
 *
 * Daily rain probability/amount remain conservative daily summaries. The
 * condition and icon for today use the nearest forecast interval; future days
 * use the interval nearest local noon.
 */
export function aggregateForecastItems(items: OwmListItem[], timezoneOffsetSeconds = 19_800): WeatherDay[] {
  const byDay = new Map<string, OwmListItem[]>();
  for (const item of items) {
    const date = localDateKey(item.dt, timezoneOffsetSeconds);
    const rows = byDay.get(date) ?? [];
    rows.push(item);
    byDay.set(date, rows);
  }

  return [...byDay.entries()].slice(0, 7).map(([date, dayItems], dayIndex) => {
    const tempMax = Math.max(...dayItems.map((item) => item.main.temp_max));
    const tempMin = Math.min(...dayItems.map((item) => item.main.temp_min));
    const rainMm = totalRainfallMm(dayItems);
    const rainProb = Math.round(Math.max(...dayItems.map((item) => item.pop ?? 0)) * 100);
    const windKph = Math.round(Math.max(...dayItems.map((item) => item.wind.speed)) * 3.6);
    const representative = dayIndex === 0
      ? dayItems[0]
      : dayItems.reduce((best, item) => (
          Math.abs(localHour(item.dt, timezoneOffsetSeconds) - 12) < Math.abs(localHour(best.dt, timezoneOffsetSeconds) - 12)
            ? item
            : best
        ));
    const code = representative.weather[0]?.id ?? 800;
    const representativeRainMm = representative.rain?.["3h"] ?? 0;
    const { condition, icon } = describe(code, representativeRainMm);
    const dayDate = new Date(`${date}T00:00:00Z`);
    return {
      date,
      dayName: dayNames[dayDate.getUTCDay()],
      tempMax: Math.round(tempMax),
      tempMin: Math.round(tempMin),
      rainMm,
      rainProb,
      windKph,
      condition,
      icon,
    };
  });
}

export function weatherStatusText(status: WeatherStatus, dayCount: number): string {
  if (status === "live") return `Live · OpenWeatherMap · ${dayCount}-day forecast`;
  if (status === "missing-coordinates") return "Estate GPS missing · demo data";
  if (status === "not-configured") return "Weather API not configured · demo data";
  return "Live weather unavailable · demo data";
}

export function collectorWeatherAdvisory(day?: WeatherDay): { tone: "emerald" | "amber" | "rose"; title: string; detail: string } {
  if (!day) return { tone: "amber", title: "Route weather unavailable", detail: "Check conditions manually before starting collection." };
  if (day.rainProb >= 75 || day.rainMm >= 20 || day.windKph >= 35) {
    return { tone: "rose", title: "Severe route-weather caution", detail: `Rain ${day.rainProb}% · ${day.rainMm} mm · wind ${day.windKph} km/h. Expect slippery estate roads and allow extra collection time.` };
  }
  if (day.rainProb >= 45 || day.rainMm >= 8 || day.windKph >= 25) {
    return { tone: "amber", title: "Route-weather caution", detail: `Rain ${day.rainProb}% · ${day.rainMm} mm · wind ${day.windKph} km/h. Drive carefully and protect collected leaf from rain.` };
  }
  return { tone: "emerald", title: "Weather suitable for collection", detail: `Rain ${day.rainProb}% · wind ${day.windKph} km/h. Continue to monitor conditions along the route.` };
}

/**
 * Fetch + aggregate the next 7 days (or as many as OWM returns, up to 5).
 * Returns the mock set on any failure.
 */
export async function fetchForecast(
  lat?: number,
  lon?: number
): Promise<ForecastResult> {
  // Actionable agronomy must never use weather from an unrelated default
  // location. Screens still receive clearly-labelled demo data until GPS is set.
  if (!hasWeatherCoordinates(lat, lon)) return { days: weather7, source: "mock", status: "missing-coordinates" };
  if (!weatherConfigured) return { days: weather7, source: "mock", status: "not-configured" };

  const useLat = lat as number;
  const useLon = lon as number;
  const cacheKey = `${useLat.toFixed(3)},${useLon.toFixed(3)}`;

  // Return cached data if fresh (avoids hammering the free API).
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return { days: cached.days, source: "live", status: "live" };
  }
  const pending = inFlight.get(cacheKey);
  if (pending) return pending;

  const request = (async (): Promise<ForecastResult> => {
    try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${useLat}&lon=${useLon}&appid=${OW_KEY}&units=metric`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OWM HTTP ${res.status}`);
    const data = (await res.json()) as OwmForecastResponse;
    if (!data?.list?.length) throw new Error("OWM empty list");

    const days = aggregateForecastItems(data.list, data.city?.timezone ?? 19_800);

    const result: ForecastResult = { days: days.length ? days : weather7, source: "live", status: "live" };
    // Cache the fresh result for this location.
    if (result.source === "live") {
      cache.set(cacheKey, { days: result.days, ts: Date.now() });
    }
      return result;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[weather] live fetch failed, using mock:", e);
      return { days: weather7, source: "mock", status: "request-failed" };
    } finally {
      inFlight.delete(cacheKey);
    }
  })();
  inFlight.set(cacheKey, request);
  return request;
}

/** Convenience: returns the mock set synchronously (instant render, then live swap). */
export function getMockForecast(): WeatherDay[] {
  return weather7;
}
