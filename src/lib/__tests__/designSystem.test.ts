import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
const login = readFileSync(resolve(process.cwd(), "src/components/Login.tsx"), "utf8");
const shell = readFileSync(resolve(process.cwd(), "src/components/Shell.tsx"), "utf8");

describe("round 72 premium design system", () => {
  it("pairs a distinctive display face with readable body and data faces", () => {
    expect(html).toContain("family=Sora");
    expect(html).toContain("family=Hanken+Grotesk");
    expect(html).toContain("family=JetBrains+Mono");
    expect(css).toContain('"Sora"');
    expect(css).toContain('"Hanken Grotesk"');
    expect(css).toMatch(/--font-mono:\s*"JetBrains Mono"/);
  });

  it("ships the immersive login scene with living feedback", () => {
    expect(css).toContain(".lx-scene");
    expect(css).toContain(".lx-field:focus-within");
    expect(css).toContain(".lx-cta:hover");
    expect(login).toContain("lx-scene");
    expect(login).toContain('role="tablist"');
    expect(login).toContain('aria-selected={portal === "supplier"}');
  });

  it("keeps the book-page turn hooks and reduced-motion guard intact", () => {
    expect(login).toContain("auth-book__pages");
    expect(login).toContain("auth-book__page--front");
    expect(login).toContain("auth-book__page--back");
    expect(css).toMatch(/prefers-reduced-motion[\s\S]{0,400}lx-glow/);
  });

  it("restyled only supplier chrome and left the admin surface untouched", () => {
    expect(shell).toContain("sp-shell");
    expect(shell).toContain("sp-dock");
    expect(shell).toContain("primaryTabsForRole(role)");
    expect(shell).toContain('"border-t border-slate-200 bg-white/95 backdrop-blur-xl"');
  });

  it("preserves the iOS input-zoom prevention in the new typography regime", () => {
    expect(css).toMatch(/font-size:\s*16px/);
    expect(css).not.toContain("user-scalable=no");
  });
});
