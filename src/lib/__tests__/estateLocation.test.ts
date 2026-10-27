import { describe, expect, it } from "vitest";
import { formatEstateCoordinate, parseEstateCoordinate } from "../estateLocation";

describe("estate location helpers", () => {
  it("accepts valid Sri Lankan coordinates", () => {
    expect(parseEstateCoordinate("6.705600", "80.384700")).toEqual({ latitude: 6.7056, longitude: 80.3847 });
  });

  it("rejects blank, invalid and out-of-range coordinates", () => {
    expect(parseEstateCoordinate("", "80.4")).toBeNull();
    expect(parseEstateCoordinate("north", "80.4")).toBeNull();
    expect(parseEstateCoordinate("91", "80.4")).toBeNull();
    expect(parseEstateCoordinate("6.7", "181")).toBeNull();
  });

  it("stores map and GPS coordinates at practical precision", () => {
    expect(formatEstateCoordinate(6.70561234)).toBe("6.705612");
  });
});
