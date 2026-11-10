import { describe, expect, it } from "vitest";
import {
  boundaryDistanceM,
  boundaryWalkDistanceM,
  shouldRecordBoundarySample,
  type BoundaryGpsSample,
} from "../estateBoundaryWalk";

const sample = (latitude: number, longitude: number, accuracyM = 8, recordedAt = Date.now()): BoundaryGpsSample => ({
  latitude,
  longitude,
  accuracyM,
  recordedAt,
});

describe("walk-the-boundary GPS filtering", () => {
  it("calculates realistic walking distance", () => {
    const distance = boundaryDistanceM(sample(6.9, 80.4), sample(6.9001, 80.4));
    expect(distance).toBeGreaterThan(10);
    expect(distance).toBeLessThan(12);
  });

  it("rejects poor accuracy and near-duplicate packets", () => {
    const first = sample(6.9, 80.4);
    expect(shouldRecordBoundarySample(undefined, first)).toBe(true);
    expect(shouldRecordBoundarySample(first, sample(6.9, 80.4, 50))).toBe(false);
    expect(shouldRecordBoundarySample(first, sample(6.90001, 80.4))).toBe(false);
    expect(shouldRecordBoundarySample(first, sample(6.9001, 80.4))).toBe(true);
  });

  it("sums the accepted path", () => {
    const samples = [sample(6.9, 80.4), sample(6.9001, 80.4), sample(6.9002, 80.4)];
    expect(boundaryWalkDistanceM(samples)).toBeGreaterThan(21);
    expect(boundaryWalkDistanceM(samples)).toBeLessThan(23);
  });
});
