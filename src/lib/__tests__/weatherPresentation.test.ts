import { describe, expect, it } from "vitest";
import type { WeatherDay } from "../data";
import { getWeatherPresentation, weatherMood } from "../weatherPresentation";

const day = (condition: string, rainProb = 0, rainMm = 0, windKph = 8): WeatherDay => ({
  date: "2026-11-11", dayName: "Wed", tempMax: 25, tempMin: 18,
  rainMm, rainProb, windKph, condition, icon: "CloudSun",
});

describe("supplier weather presentation", () => {
  it("maps live conditions to the correct visual mood", () => {
    expect(weatherMood(day("Sunny"))).toBe("sunny");
    expect(weatherMood(day("Partly Cloudy"))).toBe("cloudy");
    expect(weatherMood(day("Light Rain", 70, 12))).toBe("rain");
    expect(weatherMood(day("Thunderstorm", 80, 25, 40))).toBe("storm");
    expect(weatherMood(day("Misty"))).toBe("mist");
  });

  it("does not turn a dry current condition into rain because of later daily risk", () => {
    expect(weatherMood(day("Sunny", 90, 30, 38))).toBe("sunny");
    expect(weatherMood(day("Partly Cloudy", 80, 22))).toBe("cloudy");
  });

  it("returns a complete visual palette", () => {
    const presentation = getWeatherPresentation(day("Showers", 75, 15));
    expect(presentation.mood).toBe("rain");
    expect(presentation.gradient).toContain("linear-gradient");
    expect(presentation.guidanceKey).toContain("supplierWeather.guidance");
  });
});
