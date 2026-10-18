import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

describe("application startup", () => {
  it("does not render the removed Estate Pulse session splash", () => {
    expect(appSource).not.toContain("AuthSplash");
    expect(appSource).not.toContain("Restoring your session");
  });

  it("does not register a second Firebase session observer", () => {
    expect(appSource).not.toContain("watchHybridSession");
  });
});
