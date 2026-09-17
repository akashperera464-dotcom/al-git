import { useEffect, useState, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const OW_KEY = process.env.EXPO_PUBLIC_OW_API_KEY;

export type AdvisoryStatus =
  | "OVERDUE"        // 90+ days, no favorable weather
  | "FAVORABLE"      // 90+ days AND rain 2-15mm
  | "HOLD_HEAVY_RAIN" // rain > 25mm
  | "NOT_DUE"        // under 90 days
  | "LOADING"
  | "ERROR";

export interface AdvisoryResult {
  status: AdvisoryStatus;
  daysSinceLastFertilizer: number;
  forecastRainMm: number;
  message: string;
  shouldNotify: boolean;
}

/**
 * useSmartAdvisory — the active-session advisory engine.
 *
 * Flow:
 * 1. Read Firebase Auth current user → get uid.
 * 2. Fetch estate_id from users table → fetch lat/lon from estates.
 * 3. Fetch LATEST farm_activities doc (type=fertilizer, sorted desc, limit 1).
 * 4. Hit OpenWeather 3-day forecast using estate coordinates.
 * 5. Apply Rule A (90-day window) + Rule B (rain 2-15mm favorable / >25mm hold).
 * 6. If BOTH pass → schedule immediate local notification (if not already sent).
 */
export function useSmartAdvisory(userId: string | null) {
  const [result, setResult] = useState<AdvisoryResult>({
    status: "LOADING",
    daysSinceLastFertilizer: 0,
    forecastRainMm: 0,
    message: "Loading advisory…",
    shouldNotify: false,
  });
  const [lastNotifiedDate, setLastNotifiedDate] = useState<string | null>(null);

  const evaluate = useCallback(async () => {
    if (!userId || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setResult({ status: "ERROR", daysSinceLastFertilizer: 0, forecastRainMm: 0, message: "Not configured.", shouldNotify: false });
      return;
    }

    try {
      // 1) Get user's estate_id.
      const userRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=associated_entity_id`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const users = await userRes.json();
      const estateId = users?.[0]?.associated_entity_id;
      if (!estateId) {
        setResult({ status: "ERROR", daysSinceLastFertilizer: 0, forecastRainMm: 0, message: "No estate linked.", shouldNotify: false });
        return;
      }

      // 2) Get estate coordinates.
      const estateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/estates?id=eq.${estateId}&select=latitude,longitude,name`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const estates = await estateRes.json();
      const estate = estates?.[0];
      if (!estate?.latitude || !estate?.longitude) {
        setResult({ status: "ERROR", daysSinceLastFertilizer: 0, forecastRainMm: 0, message: "Estate has no coordinates.", shouldNotify: false });
        return;
      }

      // 3) Fetch LATEST fertilizer activity (sorted desc, limit 1).
      const activityRes = await fetch(
        `${SUPABASE_URL}/rest/v1/farm_activities?user_id=eq.${userId}&activity_type=eq.fertilizer&order=logged_date.desc&limit=1&select=logged_date,details`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const activities = await activityRes.json();
      const lastFert = activities?.[0];

      // Calculate days since last application.
      let daysSince = 0;
      if (lastFert?.logged_date) {
        daysSince = Math.floor((Date.now() - new Date(lastFert.logged_date).getTime()) / (24 * 60 * 60 * 1000));
      } else {
        daysSince = 999; // never fertilized
      }

      // 4) Fetch 3-day weather forecast (cnt=24 = 24 intervals × 3h = 3 days).
      const weatherRes = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${estate.latitude}&lon=${estate.longitude}&appid=${OW_KEY}&units=metric&cnt=24`
      );
      const weatherData = await weatherRes.json();
      const rainTotal = (weatherData?.list ?? [])
        .slice(0, 24)
        .reduce((sum: number, item: any) => sum + (item.rain?.["3h"] ?? 0), 0);

      // 5) Apply rules.
      // Rule A: Time Window — 90+ days since last fertilizer.
      const ruleAPass = daysSince >= 90;

      // Rule B: Weather Window.
      let status: AdvisoryStatus = "NOT_DUE";
      let message = "";
      let shouldNotify = false;

      if (rainTotal > 25) {
        status = "HOLD_HEAVY_RAIN";
        message = `⚠️ Heavy rain (${rainTotal.toFixed(0)}mm) expected in 3 days. Hold fertilizer to prevent leaching.`;
      } else if (ruleAPass && rainTotal >= 2 && rainTotal <= 15) {
        status = "FAVORABLE";
        message = `🌱 Ideal window! ${daysSince} days since last application. Light rain (${rainTotal.toFixed(0)}mm) will activate nutrients.`;
        shouldNotify = true;
      } else if (ruleAPass) {
        status = "OVERDUE";
        message = `⚠️ ${daysSince} days since last fertilizer. Apply now — weather is neutral (${rainTotal.toFixed(0)}mm rain).`;
        shouldNotify = true;
      } else {
        status = "NOT_DUE";
        message = `Next fertilizer in ${90 - daysSince} days (${daysSince}/90 day cycle).`;
      }

      setResult({
        status,
        daysSinceLastFertilizer: daysSince,
        forecastRainMm: rainTotal,
        message,
        shouldNotify,
      });

      // 6) Trigger local notification if BOTH rules pass (and not already notified today).
      if (shouldNotify && Platform.OS !== "web") {
        const today = new Date().toISOString().slice(0, 10);
        if (today !== lastNotifiedDate) {
          setLastNotifiedDate(today);
          const title = status === "FAVORABLE" ? "🌱 Fertilizer Window Open" : "⚠️ Fertilizer Cycle Overdue";
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body: message,
              data: { type: "fertilizer_advisory", userId },
              sound: true,
            },
            trigger: null, // immediate
          });
          console.info(`[smart-advisory] Notification fired: ${title}`);
        }
      }
    } catch (e) {
      console.error("[smart-advisory] Error:", e);
      setResult({ status: "ERROR", daysSinceLastFertilizer: 0, forecastRainMm: 0, message: "Could not load advisory.", shouldNotify: false });
    }
  }, [userId, lastNotifiedDate]);

  useEffect(() => {
    void evaluate();
    // Re-evaluate every 30 minutes while app is open.
    const interval = setInterval(() => void evaluate(), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [evaluate]);

  return { ...result, refresh: evaluate };
}
