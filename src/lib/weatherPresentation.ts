import type { WeatherDay } from "./data";

export type WeatherMood = "sunny" | "cloudy" | "rain" | "storm" | "mist";

export interface WeatherPresentation {
  mood: WeatherMood;
  gradient: string;
  pageGradient: string;
  glow: string;
  labelKey: string;
  guidanceKey: string;
}

const PRESENTATIONS: Record<WeatherMood, Omit<WeatherPresentation, "mood">> = {
  sunny: {
    gradient: "linear-gradient(145deg, #0ea5e9 0%, #2563eb 48%, #f59e0b 145%)",
    pageGradient: "linear-gradient(180deg, rgba(224,242,254,.9) 0%, #f8fafc 34%, #f8fafc 100%)",
    glow: "rgba(253, 224, 71, .58)",
    labelKey: "supplierWeather.mood.sunny",
    guidanceKey: "supplierWeather.guidance.sunny",
  },
  cloudy: {
    gradient: "linear-gradient(145deg, #475569 0%, #64748b 48%, #0f766e 120%)",
    pageGradient: "linear-gradient(180deg, rgba(226,232,240,.95) 0%, #f8fafc 38%, #f8fafc 100%)",
    glow: "rgba(226, 232, 240, .48)",
    labelKey: "supplierWeather.mood.cloudy",
    guidanceKey: "supplierWeather.guidance.cloudy",
  },
  rain: {
    gradient: "linear-gradient(145deg, #0f4c81 0%, #0369a1 45%, #0f766e 120%)",
    pageGradient: "linear-gradient(180deg, rgba(186,230,253,.92) 0%, #f1f5f9 40%, #f8fafc 100%)",
    glow: "rgba(125, 211, 252, .42)",
    labelKey: "supplierWeather.mood.rain",
    guidanceKey: "supplierWeather.guidance.rain",
  },
  storm: {
    gradient: "linear-gradient(145deg, #172554 0%, #312e81 48%, #334155 105%)",
    pageGradient: "linear-gradient(180deg, rgba(199,210,254,.86) 0%, #eef2ff 36%, #f8fafc 100%)",
    glow: "rgba(196, 181, 253, .46)",
    labelKey: "supplierWeather.mood.storm",
    guidanceKey: "supplierWeather.guidance.storm",
  },
  mist: {
    gradient: "linear-gradient(145deg, #64748b 0%, #94a3b8 48%, #0f766e 125%)",
    pageGradient: "linear-gradient(180deg, rgba(226,232,240,.94) 0%, #f8fafc 42%, #f8fafc 100%)",
    glow: "rgba(255, 255, 255, .5)",
    labelKey: "supplierWeather.mood.mist",
    guidanceKey: "supplierWeather.guidance.mist",
  },
};

export function weatherMood(day?: WeatherDay): WeatherMood {
  if (!day) return "cloudy";
  const condition = day.condition.toLowerCase();
  // The visual scene describes the representative current condition. Daily
  // max probability, accumulated rain and peak wind remain visible as risk
  // metrics, but must not make the UI look rainy/stormy all day.
  if (condition.includes("thunder") || condition.includes("lightning")) return "storm";
  if (condition.includes("mist") || condition.includes("fog")) return "mist";
  if (condition.includes("rain") || condition.includes("shower") || condition.includes("drizzle")) return "rain";
  if (condition.includes("cloud") || condition.includes("overcast")) return "cloudy";
  return "sunny";
}

export function getWeatherPresentation(day?: WeatherDay): WeatherPresentation {
  const mood = weatherMood(day);
  return { mood, ...PRESENTATIONS[mood] };
}
