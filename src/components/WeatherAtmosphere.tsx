import type { WeatherMood } from "@/lib/weatherPresentation";

export function WeatherAtmosphere({ mood }: { mood: WeatherMood }) {
  return (
    <div className={`weather-atmosphere weather-atmosphere--${mood}`} aria-hidden="true">
      <span className="weather-atmosphere__glow" />
      <span className="weather-atmosphere__cloud weather-atmosphere__cloud--one" />
      <span className="weather-atmosphere__cloud weather-atmosphere__cloud--two" />
      {(mood === "rain" || mood === "storm") && <span className="weather-atmosphere__rain" />}
      {mood === "storm" && <span className="weather-atmosphere__lightning" />}
      {mood === "mist" && <span className="weather-atmosphere__mist" />}
    </div>
  );
}
