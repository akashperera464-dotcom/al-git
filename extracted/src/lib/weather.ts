/// <reference types="vite/client" />
/**
 * Verda · OpenWeatherMap service (live, per-estate deterministic-alerts input)
 * ------------------------------------------------------------------
 * Fetches the real 5-day / 3-hour forecast for a SPECIFIC estate's coordinates
 * and aggregates it into daily summaries matching `WeatherDay[]`.
 *
 * Now DYNAMIC: callers pass the estate's lat/lon so each estate gets its own
 * localized weather (instead of one shared location). Falls back to mock data
 * on any error so alerts keep working.
 */
import { weather7, currentWeather, type WeatherDay } from "./data";

const OW_KEY = import.meta.env.VITE_OW_API_KEY as string | undefined;
/** Fallback coordinates (Nuwara Eliya) used only when an estate has no lat/lon set. */
const DEFAULT_LAT = Number(import.meta.env.VITE_OW_LAT ?? 6.9679);
const DEFAULT_LON = Number(import.meta.env.VITE_OW_LON ?? 80.7618);

export const weatherConfigured = Boolean(OW_KEY && OW_KEY !== "your_openweathermap_api_key");

// ---- in-memory cache so repeated calls for the same estate don't re-hit the API ----
const cache = new Map<string, { days: WeatherDay[]; ts: number }>();
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

interface OwmListItem {
  dt: number;
  main: { temp: number; temp_max: number; temp_min: number };
  weather: { id: number; description: string }[];
  wind: { speed: number };
  pop?: number;
  rain?: { "3h"?: number };
}

interface OwmForecastResponse {
  list: OwmListItem[];
  city?: { name?: string };
  cod?: string | number;
  message?: string;
}

/**
 * Fetch + aggregate the next 7 days (or as many as OWM returns, up to 5).
 * Returns the mock set on any failure.
 */
export async function fetchForecast(
  lat?: number,
  lon?: number
): Promise<{ days: WeatherDay[]; source: "live" | "mock" }> {
  if (!weatherConfigured) return { days: weather7, source: "mock" };

  const useLat = (typeof lat === "number" && !Number.isNaN(lat)) ? lat : DEFAULT_LAT;
  const useLon = (typeof lon === "number" && !Number.isNaN(lon)) ? lon : DEFAULT_LON;
  const cacheKey = `${useLat.toFixed(3)},${useLon.toFixed(3)}`;

  // Return cached data if fresh (avoids hammering the free API).
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_MS) {
    return { days: cached.days, source: "live" };
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${useLat}&lon=${useLon}&appid=${OW_KEY}&units=metric`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OWM HTTP ${res.status}`);
    const data = (await res.json()) as OwmForecastResponse;
    if (!data?.list?.length) throw new Error("OWM empty list");

    // Group 3-hour items by local date string (yyyy-mm-dd).
    const byDay = new Map<string, OwmListItem[]>();
    for (const item of data.list) {
      const date = new Date(item.dt * 1000).toISOString().slice(0, 10);
      const arr = byDay.get(date) ?? [];
      arr.push(item);
      byDay.set(date, arr);
    }

    const days: WeatherDay[] = [...byDay.entries()].slice(0, 7).map(([date, items]) => {
      const tempMax = Math.max(...items.map((i) => i.main.temp_max));
      const tempMin = Math.min(...items.map((i) => i.main.temp_min));
      const rainMm = Math.round(items.reduce((s, i) => s + (i.rain?.["3h"] ?? 0), 1));
      const rainProb = Math.round(Math.max(...items.map((i) => i.pop ?? 0)) * 100);
      const windKph = Math.round(Math.max(...items.map((i) => i.wind.speed)) * 3.6); // m/s → kph
      // Use the midday-ish item for the representative condition.
      const mid = items[Math.floor(items.length / 2)];
      const code = mid.weather[0]?.id ?? 800;
      const { condition, icon } = describe(code, rainMm);
      const dt = new Date(date);
      return { date, dayName: dayNames[dt.getDay()], tempMax: Math.round(tempMax), tempMin: Math.round(tempMin), rainMm, rainProb, windKph, condition, icon };
    });

    const result = { days: days.length ? days : weather7, source: "live" as const };
    // Cache the fresh result for this location.
    if (result.source === "live") {
      cache.set(cacheKey, { days: result.days, ts: Date.now() });
    }
    return result;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[weather] live fetch failed, using mock:", e);
    return { days: weather7, source: "mock" as const };
  }
}

/** Convenience: returns the mock set synchronously (instant render, then live swap). */
export function getMockForecast(): WeatherDay[] {
  return weather7;
}

export { currentWeather };
