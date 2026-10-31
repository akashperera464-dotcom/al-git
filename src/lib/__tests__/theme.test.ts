import { describe, expect, it } from "vitest";
import { resolveInitialTheme } from "../theme";

describe("theme selection", () => {
  it("restores an explicitly saved theme", () => {
    expect(resolveInitialTheme("dark", false)).toBe("dark");
    expect(resolveInitialTheme("light", true)).toBe("light");
  });

  it("starts in light mode when no valid app preference was saved", () => {
    expect(resolveInitialTheme(null, true)).toBe("light");
    expect(resolveInitialTheme(null, false)).toBe("light");
    expect(resolveInitialTheme("unsupported", true)).toBe("light");
    expect(resolveInitialTheme("unsupported", false)).toBe("light");
  });
});
