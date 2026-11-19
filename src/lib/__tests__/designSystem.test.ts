import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
const login = readFileSync(resolve(process.cwd(), "src/components/Login.tsx"), "utf8");
const shell = readFileSync(resolve(process.cwd(), "src/components/Shell.tsx"), "utf8");

describe("round 74 legibility and layout contract", () => {
  it("loads a font family with real Sinhala and Tamil coverage", () => {
    expect(html).toContain("family=Noto+Sans");
    expect(html).toContain("family=Noto+Sans+Sinhala");
    expect(html).toContain("family=Noto+Sans+Tamil");
    expect(css).toContain('"Noto Sans Sinhala"');
    expect(css).toContain('"Noto Sans Tamil"');
  });

  it("no longer ships Latin-only faces that distorted sinhala/tamil text", () => {
    expect(css).not.toMatch(/--font-sans:\s*"Hanken Grotesk"/);
    expect(css).not.toContain('"Sora"');
    expect(css).not.toContain("--font-mono: \"JetBrains Mono\"");
  });

  it("removes the wide-tracking and forced-mono defects", () => {
    expect(css).toContain(':lang(si), :lang(ta)');
    expect(css).toContain("font-family: inherit !important");
    expect(css).not.toContain("letter-spacing: 0.24em");
    expect(css).toContain("display: block;\n  padding: 0;\n  border: 0;");
  });

  it("renders a split-screen login with a crisp light form surface", () => {
    expect(login).toContain('lg:grid-cols-[1.02fr_0.98fr]');
    expect(login).toContain("auth-book__pages");
    expect(login).toContain('aria-selected={portal === "supplier"}');
    expect(login).toContain('role="tablist"');
    expect(login).not.toContain("lx-card");
    expect(login).not.toContain("backdrop-blur-2xl");
  });

  it("keeps one Firebase sign-in call and the registration pipeline", () => {
    expect(login.match(/await signInWithEmail\(/g)).toHaveLength(1);
    expect(login).toContain('renderSignInForm("supplier"');
    expect(login).toContain('renderSignInForm("staff"');
    expect(login).toContain("registering ? renderRegistrationForm() : renderSignInForm");
    expect(login).toContain('t("auth.staffRolesHint")');
  });

  it("keeps the book-page turn and reduced-motion fallback", () => {
    expect(css).toContain(".auth-book__pages.is-flipped");
    expect(css).toContain("rotateY(-180deg)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("uses solid supplier surfaces instead of blurred cards", () => {
    expect(css).toContain(".sp-main .card");
    expect(css).toContain("backdrop-filter: none !important");
    expect(css).toContain("background: #ffffff !important");
    expect(shell).toContain("primaryTabsForRole(role)");
    expect(shell).toContain('"border-t border-slate-200 bg-white/95 backdrop-blur-xl"');
  });

  it("keeps estate photography as brand depth, not behind form text", () => {
    const image = statSync(resolve(process.cwd(), "public/tea-estate-glass-login.jpg"));
    expect(image.size).toBeGreaterThan(50_000);
    expect(login).toContain("/tea-estate-glass-login.jpg");
  });

  it("preserves the iOS input-zoom prevention", () => {
    expect(css).toMatch(/font-size:\s*16px/);
    expect(css).not.toContain("user-scalable=no");
  });
});
