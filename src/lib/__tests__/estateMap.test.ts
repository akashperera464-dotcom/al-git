import { describe, expect, it } from "vitest";
import { boundaryToPoints, calculatePolygonAreaHa, pointsToBoundary } from "../estateMap";

describe("estate map geometry", () => {
  const square = [
    { latitude: 6.9, longitude: 80.4 },
    { latitude: 6.9, longitude: 80.401 },
    { latitude: 6.901, longitude: 80.401 },
    { latitude: 6.901, longitude: 80.4 },
  ];

  it("stores a closed GeoJSON polygon in longitude/latitude order", () => {
    const boundary = pointsToBoundary(square);
    expect(boundary?.type).toBe("Polygon");
    expect(boundary?.coordinates[0][0]).toEqual([80.4, 6.9]);
    expect(boundary?.coordinates[0].at(-1)).toEqual([80.4, 6.9]);
    expect(boundaryToPoints(boundary)).toEqual(square);
  });

  it("calculates a realistic positive hectare estimate", () => {
    expect(calculatePolygonAreaHa(square)).toBeGreaterThan(1);
    expect(calculatePolygonAreaHa(square)).toBeLessThan(2);
  });

  it("rejects incomplete boundaries", () => {
    expect(pointsToBoundary(square.slice(0, 2))).toBeUndefined();
    expect(calculatePolygonAreaHa(square.slice(0, 2))).toBe(0);
  });
});
