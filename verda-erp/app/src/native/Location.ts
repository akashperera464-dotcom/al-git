/**
 * Native Location Bridge — estate-boundary geofencing
 * ------------------------------------------------------------------
 * Uses expo-location for foreground GPS + background task for periodic
 * estate-boundary checks (verifies supplier is on-site during deliveries).
 *
 * Install:
 *   npx expo install expo-location
 *
 * In app.config.js:
 *   ["expo-location", {
 *     locationAlwaysAndWhenInUsePermission: "Verda uses your location to verify you are at the estate during deliveries."
 *   }]
 *
 * Background geofence task is registered via BackgroundGeofenceTask below.
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

export interface EstateGeofence {
  estateId: string;
  estateName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;  // typical tea estate: 500m
}

export interface VerifiedLocation {
  latitude: number;
  longitude: number;
  accuracyM: number;
  timestamp: string;
  insideGeofence: boolean;
  distanceToCenter: number;
  estate?: EstateGeofence;
}

const BACKGROUND_LOCATION_TASK = "BACKGROUND_GEOFENCE_TASK";

/**
 * Request foreground + background location permissions.
 * Returns true only if both are granted.
 */
export async function requestLocationPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return false;
  // Background permission requires "Always" on iOS — Android: foreground service
  if (Platform.OS === "ios") {
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === "granted";
  }
  // Android: FOREGROUND_SERVICE permission is auto-granted via manifest
  return true;
}

/**
 * Get the current GPS position with high accuracy.
 * Throws if permission not granted or location services disabled.
 */
export async function getCurrentPosition(): Promise<{
  latitude: number;
  longitude: number;
  accuracyM: number;
  timestamp: string;
}> {
  const perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== "granted") {
    throw new Error("Location permission not granted. Tap 'Verify My Location' and allow access.");
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
    mayShowUserSettingsDialog: true,
  });
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracyM: pos.coords.accuracy ?? 0,
    timestamp: new Date(pos.timestamp).toISOString(),
  };
}

/**
 * Haversine distance between two lat/lng points in meters.
 */
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Verify the device is inside the given estate geofence.
 * Returns distance + inside/outside flag.
 */
export async function verifyEstateGeofence(
  estate: EstateGeofence
): Promise<VerifiedLocation> {
  const pos = await getCurrentPosition();
  const distance = haversineMeters(
    pos.latitude, pos.longitude,
    estate.latitude, estate.longitude
  );
  return {
    latitude: pos.latitude,
    longitude: pos.longitude,
    accuracyM: pos.accuracyM,
    timestamp: pos.timestamp,
    insideGeofence: distance <= estate.radiusMeters,
    distanceToCenter: distance,
    estate,
  };
}

/**
 * Start a background location task that periodically (every ~5 min) checks
 * whether the device is inside any of the registered estate geofences.
 * Used to log attendance + trigger arrival/departure alerts.
 *
 * The task posts results to the WebView via the global bridge.
 */
export async function startBackgroundGeofence(
  estates: EstateGeofence[]
): Promise<boolean> {
  if (Platform.OS === "android") {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== "granted") return false;
  }

  // Define the headless task (idempotent — define only once)
  if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
    TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
      if (error) return false;
      const loc = data as Location.LocationObject;
      // Check each geofence
      for (const estate of estates) {
        const dist = haversineMeters(
          loc.coords.latitude, loc.coords.longitude,
          estate.latitude, estate.longitude
        );
        if (dist <= estate.radiusMeters) {
          // Inside estate — emit event for the bridge
          (globalThis as any).VerdaGeofenceEvent?.({
            estateId: estate.estateId,
            estateName: estate.estateName,
            inside: true,
            distance: dist,
            timestamp: new Date(loc.timestamp).toISOString(),
          });
        }
      }
      return true;
    });
  }

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 300000,   // 5 min
    distanceInterval: 50,   // or every 50m movement
    deferredUpdatesInterval: 600000,
    showsBackgroundNotification: true,
    notificationTitle: "Verda ERP",
    notificationBody: "Verifying your estate location",
  });
  return true;
}

export async function stopBackgroundGeofence(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
