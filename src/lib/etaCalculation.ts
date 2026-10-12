export interface GeoPoint { latitude: number; longitude: number }
export interface EtaResult { distanceKm: number; etaMinutes: number; band: "green" | "amber" | "red"; arrived: boolean }

const EARTH_RADIUS_KM = 6371;
const radians = (degrees: number) => degrees * Math.PI / 180;

export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateEta(from: GeoPoint, to: GeoPoint, averageSpeedKmh = 30): EtaResult {
  const distanceKm = haversineKm(from, to);
  return {
    distanceKm,
    etaMinutes: Math.max(1, Math.ceil(distanceKm / Math.max(1, averageSpeedKmh) * 60)),
    band: distanceKm < 0.5 ? "red" : distanceKm <= 2 ? "amber" : "green",
    arrived: distanceKm < 0.5,
  };
}

export function shouldSendGeofenceNotification(distanceKm: number, lastNotificationAt?: string, now = new Date()): boolean {
  if (distanceKm >= 1) return false;
  if (!lastNotificationAt) return true;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date(lastNotificationAt))
    !== new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(now);
}
