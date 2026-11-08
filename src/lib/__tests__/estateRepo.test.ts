import { describe, expect, it } from "vitest";
import { isMissingEstateBlockCompatibilityColumn, isMissingEstateBlockMapColumn, sizeFromAcreage } from "../estateRepo";
describe("estate sizing", () => { it("uses the agreed acreage bands", () => { expect(sizeFromAcreage(4.9)).toBe("small"); expect(sizeFromAcreage(5)).toBe("medium"); expect(sizeFromAcreage(51)).toBe("large"); }); });

describe("estate block schema compatibility", () => {
  it("recognizes the legacy nested-select status error returned by PostgREST", () => {
    expect(isMissingEstateBlockCompatibilityColumn({
      code: "42703",
      message: "column estate_blocks_1.status does not exist",
    })).toBe(true);
  });

  it("does not hide unrelated missing-column errors", () => {
    expect(isMissingEstateBlockCompatibilityColumn({
      code: "42703",
      message: "column estates.status does not exist",
    })).toBe(false);
  });

  it("recognizes an unapplied block-map migration without hiding unrelated errors", () => {
    expect(isMissingEstateBlockMapColumn({ code: "42703", message: "column estate_blocks_1.boundary_geojson does not exist" })).toBe(true);
    expect(isMissingEstateBlockMapColumn({ code: "42703", message: "column estates.boundary_geojson does not exist" })).toBe(false);
  });
});
