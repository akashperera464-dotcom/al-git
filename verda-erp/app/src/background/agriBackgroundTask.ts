import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const OW_KEY = process.env.EXPO_PUBLIC_OW_API_KEY;

export const TASK_NAME = "BACKGROUND_AGRI_ADVISORY";

// Track which alerts we've already fired to avoid spamming.
const notifiedKey = "verda:last_advisory_alert";
const MS_90_DAYS = 90 * 24 * 60 * 60 * 1000;

/**
 * The headless background task definition.
 * Runs every ~15 minutes (OS-permitted minimum) in the background.
 *
 * Flow:
 * 1. Fetch all supplier users who have an estate link.
 * 2. For each: get estate coords → fetch weather → get latest farm_activity.
 * 3. Apply deterministic rules (90-day fertilizer + rain window).
 * 4. If rules match → schedule a local notification.
 */
TaskManager.defineTask(TASK_NAME, async () => {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 1) Get all suppliers with estate associations.
    const usersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?role=eq.supplier&select=id,associated_entity_id`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const users = await usersRes.json();
    if (!users?.length) return BackgroundFetch.BackgroundFetchResult.NoData;

    for (const user of users) {
      if (!user.associated_entity_id) continue;

      // 2) Get estate coordinates.
      const estateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/estates?id=eq.${user.associated_entity_id}&select=latitude,longitude,name`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const estates = await estateRes.json();
      const estate = estates?.[0];
      if (!estate?.latitude || !estate?.longitude) continue;

      // 3) Get latest fertilizer activity.
      const activityRes = await fetch(
        `${SUPABASE_URL}/rest/v1/farm_activities?user_id=eq.${user.id}&activity_type=eq.fertilizer&order=logged_date.desc&limit=1&select=logged_date,details`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const activities = await activityRes.json();
      const lastFert = activities?.[0];

      // 4) Fetch 3-day weather forecast.
      const weatherRes = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${estate.latitude}&lon=${estate.longitude}&appid=${OW_KEY}&units=metric&cnt=24`
      );
      const weatherData = await weatherRes.json();
      const rainTotal = (weatherData?.list ?? [])
        .slice(0, 24)
        .reduce((sum: number, item: any) => sum + (item.rain?.["3h"] ?? 0), 0);

      // 5) Apply rules.
      // Rule A: 90-day fertilizer window.
      let ruleAPass = false;
      let daysSince = 0;
      if (lastFert?.logged_date) {
        daysSince = Math.floor((Date.now() - new Date(lastFert.logged_date).getTime()) / (24 * 60 * 60 * 1000));
        ruleAPass = daysSince >= 90;
      } else {
        ruleAPass = true; // never fertilized → due
      }

      // Rule B: Weather window.
      let weatherStatus = "NEUTRAL";
      if (rainTotal >= 2 && rainTotal <= 15) weatherStatus = "FAVORABLE";
      else if (rainTotal > 25) weatherStatus = "HOLD_HEAVY_RAIN";

      // 6) Trigger notification if BOTH rules indicate action needed.
      const shouldNotify =
        ruleAPass &&
        (weatherStatus === "FAVORABLE" || weatherStatus === "NEUTRAL");

      if (shouldNotify) {
        const title = weatherStatus === "FAVORABLE"
          ? "🌱 Fertilizer Window Open"
          : "⚠️ Fertilizer Cycle Overdue";

        const body = weatherStatus === "FAVORABLE"
          ? `${daysSince} days since last application. Light rain (${rainTotal.toFixed(0)}mm) expected — ideal for nutrient uptake.`
          : `${daysSince} days since last application. Apply now with light irrigation.`;

        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            data: { type: "fertilizer_advisory", estateId: user.associated_entity_id, userId: user.id },
            sound: true,
          },
          trigger: null, // immediate
        });

        console.info(`[background-advisory] Notified user ${user.id}: ${title}`);
      }
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    console.error("[background-advisory] Task failed:", e);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background task. Call this once in the root layout (App.tsx).
 */
export async function registerBackgroundAdvisory() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
  if (isRegistered) {
    console.info("[background-advisory] Already registered.");
    return;
  }

  await BackgroundFetch.registerTaskAsync(TASK_NAME, {
    minimumInterval: 60 * 15, // 15 minutes (OS minimum)
    stopOnTerminate: false, // keep running when app is killed
    startOnBoot: true, // restart after device reboot
  });

  console.info("[background-advisory] Registered successfully.");
}

/** Unregister (for cleanup / testing). */
export async function unregisterBackgroundAdvisory() {
  await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
  console.info("[background-advisory] Unregistered.");
}
