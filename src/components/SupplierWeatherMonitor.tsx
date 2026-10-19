import { useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { createAlert, readAlerts } from "@/lib/notifications";
import { sendSmartAlert } from "@/lib/fcm";
import { useEstateWeather, useSupplierWeatherEstate } from "@/lib/useEstateWeather";

/**
 * Free-tier daily weather monitor.
 *
 * It runs once the supplier opens the app, evaluates only verified live weather,
 * stores one alert per estate/day, and dispatches the existing FCM function on a
 * best-effort basis. It intentionally makes no claim that a closed PWA can wake
 * itself without a separately configured server scheduler.
 */
export function SupplierWeatherMonitor() {
  const { userUid, associatedEntityId } = useApp();
  const selection = useSupplierWeatherEstate(userUid, associatedEntityId);
  const weather = useEstateWeather(selection.estate?.latitude, selection.estate?.longitude);

  useEffect(() => {
    const estate = selection.estate;
    if (!estate || weather.status !== "live") return;
    const risky = weather.days.slice(0, 2).find((day) => day.rainProb >= 70 || day.rainMm >= 20 || day.windKph >= 35);
    if (!risky) return;

    let active = true;
    void (async () => {
      const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());
      const title = `Weather alert · ${estate.name}`;
      const existing = await readAlerts(userUid, 100);
      if (!active || existing.some((row) => row.title === title && new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date(row.created_at)) === dayKey)) return;
      const body = `වැසි ${risky.rainProb}% · ${risky.rainMm} mm · සුළඟ ${risky.windKph} km/h. පොහොර, දලු නෙළීම සහ ප්‍රවාහනය සැලසුම් කිරීමේදී සැලකිලිමත් වන්න.`;
      await createAlert({ targetUserId: userUid, title, body, type: "weather" });
      if (active) void sendSmartAlert({ targetUserId: userUid, title, body, type: "weather-daily", alertType: "weather" });
    })().catch(() => { /* best-effort monitor must never block the app */ });
    return () => { active = false; };
  }, [selection.estate, userUid, weather.days, weather.status]);

  return null;
}
