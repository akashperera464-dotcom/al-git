export interface EstateMapPoint {
  latitude: number;
  longitude: number;
}

export interface EstateBlockBoundary {
  type: "Polygon";
  /** GeoJSON order: [longitude, latitude]. */
  coordinates: [number, number][][];
}

export type EstateLandType = "tea" | "nursery" | "forest" | "water" | "road" | "other";

const EARTH_RADIUS_M = 6_371_008.8;

export function isValidEstatePoint(point: EstateMapPoint): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) &&
    point.latitude >= -90 && point.latitude <= 90 && point.longitude >= -180 && point.longitude <= 180;
}

export function pointsToBoundary(points: EstateMapPoint[]): EstateBlockBoundary | undefined {
  const valid = points.filter(isValidEstatePoint);
  if (valid.length < 3) return undefined;
  const ring: [number, number][] = valid.map((point) => [point.longitude, point.latitude]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return { type: "Polygon", coordinates: [ring] };
}

export function boundaryToPoints(value: unknown): EstateMapPoint[] {
  if (!value || typeof value !== "object") return [];
  const boundary = value as Partial<EstateBlockBoundary>;
  const ring = boundary.type === "Polygon" && Array.isArray(boundary.coordinates?.[0])
    ? boundary.coordinates![0]
    : [];
  const points = ring
    .map((coordinate) => ({ latitude: Number(coordinate?.[1]), longitude: Number(coordinate?.[0]) }))
    .filter(isValidEstatePoint);
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first.latitude === last.latitude && first.longitude === last.longitude) points.pop();
  }
  return points.length >= 3 ? points : [];
}

/** Fast client-side operational area estimate. This is not a legal land survey. */
export function calculatePolygonAreaHa(points: EstateMapPoint[]): number {
  const valid = points.filter(isValidEstatePoint);
  if (valid.length < 3) return 0;
  const meanLatitude = valid.reduce((sum, point) => sum + point.latitude, 0) / valid.length;
  const latitudeScale = Math.PI / 180 * EARTH_RADIUS_M;
  const longitudeScale = latitudeScale * Math.cos(meanLatitude * Math.PI / 180);
  let twiceArea = 0;
  for (let index = 0; index < valid.length; index += 1) {
    const current = valid[index];
    const next = valid[(index + 1) % valid.length];
    const x1 = current.longitude * longitudeScale;
    const y1 = current.latitude * latitudeScale;
    const x2 = next.longitude * longitudeScale;
    const y2 = next.latitude * latitudeScale;
    twiceArea += x1 * y2 - x2 * y1;
  }
  return Math.abs(twiceArea) / 2 / 10_000;
}

export function boundaryCenter(boundary: EstateBlockBoundary | undefined): EstateMapPoint | undefined {
  const points = boundaryToPoints(boundary);
  if (!points.length) return undefined;
  return {
    latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
    longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length,
  };
}
