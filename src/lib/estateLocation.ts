export interface EstateCoordinate {
  latitude: number;
  longitude: number;
}

export function parseEstateCoordinate(latitude: string, longitude: string): EstateCoordinate | null {
  if (!latitude.trim() || !longitude.trim()) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

export function formatEstateCoordinate(value: number): string {
  return value.toFixed(6);
}

export function geolocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) return "Location permission was denied. Allow location access in the browser settings and try again.";
  if (error.code === error.POSITION_UNAVAILABLE) return "The device could not determine its current location. Move to an open area and try again.";
  if (error.code === error.TIMEOUT) return "Location detection timed out. Check GPS/mobile data and try again.";
  return "The current location could not be detected.";
}
