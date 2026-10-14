import { describe, expect, it } from "vitest";
import { highestSchemaVersion, schemaMeetsMinimum } from "../schemaVersion";

describe("schema version detection", () => {
  it("selects the numerically highest round regardless of row order", () => {
    expect(highestSchemaVersion(["round_14", "round_9", "round_13"])).toBe("round_14");
  });

  it("ignores malformed migration labels", () => {
    expect(highestSchemaVersion([null, "legacy", "round_12"])).toBe("round_12");
    expect(highestSchemaVersion([undefined, "legacy"])).toBeNull();
  });

  it("requires Round 15 for connected operations", () => {
    expect(schemaMeetsMinimum("round_15")).toBe(true);
    expect(schemaMeetsMinimum("round_14")).toBe(false);
  });
});
