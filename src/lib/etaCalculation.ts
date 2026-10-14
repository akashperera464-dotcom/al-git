export interface GeoPoint { latitude: number; longitude: number }
export interface EtaResult {
  distanceKm: number;
  etaMinutes: number;
  averageSpeedKmh: number;
  band: "green" | "amber" | "red";
  arrived: boolean;
}

const EARTH_RADIUS_KM = 6371.0088;
export const DEFAULT_RURAL_SPEED_KMH = 27.5;
const radians = (degrees: number) => degrees * Math.PI / 180;

export function isValidGeoPoint(point: GeoPoint): boolean {
  return Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90
    && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180;
}

function assertCoordinate(latitude: number, longitude: number, label: string): void {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new RangeError(`${label} latitude must be between -90 and 90 degrees.`);
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError(`${label} longitude must be between -180 and 180 degrees.`);
  }
}

/** Precise great-circle distance in kilometres using the Haversine formula. */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  assertCoordinate(lat1, lon1, "Origin");
  assertCoordinate(lat2, lon2, "Destination");
  const latitudeDelta = radians(lat2 - lat1);
  const longitudeDelta = radians(lon2 - lon1);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(longitudeDelta / 2) ** 2;
  const bounded = Math.min(1, Math.max(0, a));
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}

export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  return calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
}

export function calculateEta(from: GeoPoint, to: GeoPoint, averageSpeedKmh = DEFAULT_RURAL_SPEED_KMH): EtaResult {
  if (!Number.isFinite(averageSpeedKmh) || averageSpeedKmh <= 0) {
    throw new RangeError("Average speed must be a positive number.");
  }
  const distanceKm = haversineKm(from, to);
  return {
    distanceKm,
    etaMinutes: distanceKm === 0 ? 0 : Math.max(1, Math.ceil(distanceKm / averageSpeedKmh * 60)),
    averageSpeedKmh,
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
