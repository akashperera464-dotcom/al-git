import { describe, expect, it } from "vitest";
import { sizeFromAcreage } from "../estateRepo";
describe("estate sizing", () => { it("uses the agreed acreage bands", () => { expect(sizeFromAcreage(4.9)).toBe("small"); expect(sizeFromAcreage(5)).toBe("medium"); expect(sizeFromAcreage(51)).toBe("large"); }); });
