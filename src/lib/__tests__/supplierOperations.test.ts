import { describe, expect, it } from "vitest";
import { formatRouteLabel } from "../supplierOperations";

describe("supplier route presentation", () => {
  it("shows the route code prominently", () => expect(formatRouteLabel("Angammana", "GAL-ANG")).toBe("GAL-ANG — Angammana"));
  it("remains compatible before the migration is installed", () => expect(formatRouteLabel("Angammana")).toBe("Angammana"));
});
