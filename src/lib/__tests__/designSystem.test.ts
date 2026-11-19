import { readFileSync, statSync } from "node:fs";
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


describe("round 73 liquid glass layer", () => {
  it("ships a reusable frosted glass surface with real refraction", () => {
    expect(css).toContain(".lg-glass");
    expect(css).toContain("backdrop-filter: blur(36px) saturate(175%)");
    expect(css).toContain("inset 0 1px 0 rgba(255, 255, 255, 0.6)");
  });

  it("uses the generated tea imagery as photographic depth", () => {
    expect(css).toContain('url("/tea-estate-glass-login.jpg")');
    expect(css).toContain('url("/tea-leaf-glass-ambient.jpg")');
    const login = statSync(resolve(process.cwd(), "public/tea-estate-glass-login.jpg"));
    const ambient = statSync(resolve(process.cwd(), "public/tea-leaf-glass-ambient.jpg"));
    expect(login.size).toBeGreaterThan(50_000);
    expect(ambient.size).toBeGreaterThan(30_000);
  });

  it("keeps the photographic scene visible behind the login glass", () => {
    expect(login).not.toContain('className="app-aurora absolute inset-0"');
    expect(login).toContain("lx-scene");
    expect(css).toContain(".lx-scene::before");
  });

  it("renders white liquid-glass CTAs and a floating glass dock", () => {
    expect(css).toMatch(/\.lx-cta\s*\{[^}]*background: linear-gradient\(180deg, #ffffff/);
    expect(css).toContain(".lx-cta--ghost");
    expect(css).toContain(".sp-dockitem--on .sp-dockpill");
    expect(css).toMatch(/@supports|backdrop-filter: blur\(30px\) saturate\(170%\)/);
  });
});
