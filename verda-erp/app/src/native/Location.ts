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
 * NOTE: Background geofence task (which used expo-task-manager) was removed
 * because expo-task-manager had a Gradle incompatibility with RN 0.74.
 * Foreground location verification still works fully.
 */
import * as Location from "expo-location";
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
 * NOTE: Background geofence tracking was disabled (expo-task-manager
 * had a Gradle incompatibility with RN 0.74). Returns false to indicate
 * background tracking is unavailable. The PWA can use the Geolocation
 * API in the foreground instead.
 *
 * To re-enable later: install expo-task-manager + expo-background-fetch
 * with versions known compatible with RN 0.74, then restore the
 * TaskManager.defineTask + Location.startLocationUpdatesAsync code.
 */
export async function startBackgroundGeofence(
  _estates: EstateGeofence[]
): Promise<boolean> {
  // Background geofence tracking disabled — see file header.
  return false;
}

export async function stopBackgroundGeofence(): Promise<void> {
  // No-op — background tracking disabled.
}
