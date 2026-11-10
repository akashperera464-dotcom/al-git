import { isValidEstatePoint, type EstateMapPoint } from "./estateMap";

export interface BoundaryGpsSample extends EstateMapPoint {
  accuracyM: number;
  recordedAt: number;
}

export interface BoundaryWalkOptions {
  maxAccuracyM: number;
  minDistanceM: number;
}

export const DEFAULT_BOUNDARY_WALK_OPTIONS: BoundaryWalkOptions = {
  maxAccuracyM: 35,
  minDistanceM: 5,
};

const EARTH_RADIUS_M = 6_371_008.8;

function toRadians(value: number): number {
  return value * Math.PI / 180;
}

/** Haversine distance used only on the device while the user walks. */
export function boundaryDistanceM(from: EstateMapPoint, to: EstateMapPoint): number {
  if (!isValidEstatePoint(from) || !isValidEstatePoint(to)) return 0;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function isUsableBoundarySample(
  sample: BoundaryGpsSample,
  options: BoundaryWalkOptions = DEFAULT_BOUNDARY_WALK_OPTIONS,
): boolean {
  return isValidEstatePoint(sample) && Number.isFinite(sample.accuracyM) && sample.accuracyM >= 0 &&
    sample.accuracyM <= options.maxAccuracyM && Number.isFinite(sample.recordedAt);
}

/** Rejects inaccurate or near-duplicate GPS packets before they enter the polygon draft. */
export function shouldRecordBoundarySample(
  previous: BoundaryGpsSample | undefined,
  next: BoundaryGpsSample,
  options: BoundaryWalkOptions = DEFAULT_BOUNDARY_WALK_OPTIONS,
): boolean {
  if (!isUsableBoundarySample(next, options)) return false;
  return !previous || boundaryDistanceM(previous, next) >= options.minDistanceM;
}

export function boundaryWalkDistanceM(samples: BoundaryGpsSample[]): number {
  return samples.slice(1).reduce(
    (total, sample, index) => total + boundaryDistanceM(samples[index], sample),
    0,
  );
}

export function samplesToEstatePoints(samples: BoundaryGpsSample[]): EstateMapPoint[] {
  return samples.filter((sample) => isValidEstatePoint(sample)).map(({ latitude, longitude }) => ({ latitude, longitude }));
}
