import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * useExpoPushToken — automatically registers the device for push notifications
 * and stores the Expo Push Token in the user's Supabase `users` row.
 *
 * Runs on mount and whenever `userId` changes (auth state change).
 * In production with Firestore, you'd write to `users/{uid}.pushToken` instead.
 */
export function useExpoPushToken(userId: string | null) {
  const lastToken = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let mounted = true;

    const register = async () => {
      try {
        // Only real devices can receive push tokens.
        if (!Device.isDevice) {
          console.warn("[push] Push tokens require a physical device.");
          return;
        }

        // Check existing permissions.
        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted") {
          console.warn("[push] Permission not granted.");
          return;
        }

        // Get the Expo Push Token.
        const tokenResponse = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EAS_PROJECT_ID,
        });
        const token = tokenResponse.data;

        if (!mounted || token === lastToken.current) return;
        lastToken.current = token;

        // Android: set notification channel.
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("verda-advisory", {
            name: "Verda Agri Advisory",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#10B981",
          });
        }

        // Persist the token to the user's profile (Supabase users table).
        // In pure-Firestore: db.collection('users').doc(userId).set({ pushToken: token }, { merge: true })
        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
          await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({ push_token: token }),
          });
        }

        console.info("[push] Token registered:", token.slice(0, 30) + "…");
      } catch (e) {
        console.error("[push] Registration failed:", e);
      }
    };

    void register();
    return () => {
      mounted = false;
    };
  }, [userId]);
}
