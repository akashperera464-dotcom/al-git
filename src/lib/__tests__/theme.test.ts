import { describe, expect, it } from "vitest";
import { resolveInitialTheme } from "../theme";

describe("theme selection", () => {
  it("always starts in light mode, including when an older dark preference exists", () => {
    expect(resolveInitialTheme("dark", false)).toBe("light");
    expect(resolveInitialTheme("light", true)).toBe("light");
    expect(resolveInitialTheme(null, true)).toBe("light");
    expect(resolveInitialTheme(null, false)).toBe("light");
    expect(resolveInitialTheme("unsupported", true)).toBe("light");
    expect(resolveInitialTheme("unsupported", false)).toBe("light");
  });
});
