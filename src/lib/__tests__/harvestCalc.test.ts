import { describe, expect, it } from "vitest";
import { calculateHarvest } from "../harvestCalc";
describe("harvest calculation", () => { it("calculates net weight and saved historical amount", () => { expect(calculateHarvest(100, 4, 186)).toEqual({ netKg: 96, amount: 17856 }); }); it("clamps invalid deduction", () => { expect(calculateHarvest(10, 120, 176).netKg).toBe(0); }); });
