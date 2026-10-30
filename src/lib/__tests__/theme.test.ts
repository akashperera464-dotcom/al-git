import { describe, expect, it } from "vitest";
import { resolveInitialTheme } from "../theme";

describe("theme selection", () => {
  it("restores an explicitly saved theme", () => {
    expect(resolveInitialTheme("dark", false)).toBe("dark");
    expect(resolveInitialTheme("light", true)).toBe("light");
  });

  it("uses the device preference only when no valid theme was saved", () => {
    expect(resolveInitialTheme(null, true)).toBe("dark");
    expect(resolveInitialTheme("unsupported", false)).toBe("light");
  });
});
