import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
const login = readFileSync(resolve(process.cwd(), "src/components/Login.tsx"), "utf8");
const shell = readFileSync(resolve(process.cwd(), "src/components/Shell.tsx"), "utf8");
const ui = readFileSync(resolve(process.cwd(), "src/components/ui.tsx"), "utf8");

describe("trilingual typography", () => {
  it("loads a family with real Sinhala and Tamil coverage", () => {
    expect(html).toContain("family=Noto+Sans");
    expect(html).toContain("family=Noto+Sans+Sinhala");
    expect(html).toContain("family=Noto+Sans+Tamil");
  });

  it("never forces wide tracking or a Latin-only mono face on content", () => {
    expect(css).toContain(':lang(si), :lang(ta)');
    expect(css).toContain("font-family: inherit !important");
    expect(css).not.toContain("letter-spacing: 0.24em");
    expect(css).not.toMatch(/--font-sans:\s*"Hanken Grotesk"/);
  });
});

describe("container-safe supplier layout", () => {
  it("never uses viewport 4-column grids inside the ~430px supplier shell", () => {
    const supplierModules = ["Home", "Fertilizer", "Labor", "Loans", "Plot", "Insights", "Estates", "Deliveries"]
      .map((name) => readFileSync(resolve(process.cwd(), `src/modules/Supplier${name}.tsx`), "utf8"));
    for (const source of supplierModules) expect(source).not.toContain("sm:grid-cols-4");
  });

  it("keeps StatCard compact and overflow-safe", () => {
    expect(ui).toContain("export function StatCard");
    expect(ui).toMatch(/StatCard[\s\S]{0,1200}min-w-0 overflow-hidden/);
    expect(ui).toMatch(/break-words text-\[11px\] font-medium leading-snug/);
    expect(ui).not.toMatch(/uppercase tracking-wide text-slate-400">\{label\}/);
  });

  it("renders long help text through the readable AppInfo panel", () => {
    expect(ui).toContain("export function AppInfo");
    const fertilizer = readFileSync(resolve(process.cwd(), "src/modules/SupplierFertilizer.tsx"), "utf8");
    expect(fertilizer).toContain("<AppInfo");
    expect(fertilizer).not.toContain("list-disc list-inside");
  });
});

describe("login stage", () => {
  it("uses a crisp white card on an animated CSS mesh canvas", () => {
    expect(login).toContain("login-mesh");
    expect(login).toContain("login-orb");
    expect(login).toContain("rounded-2xl bg-white");
    expect(css).toContain(".login-mesh");
    expect(css).toContain("@keyframes loginFloat");
    expect(css).toContain("@keyframes loginRise");
  });

  it("keeps the form sharp: no backdrop blur behind inputs", () => {
    expect(login).not.toContain("backdrop-blur-2xl");
    expect(login).not.toContain("lx-card");
  });

  it("keeps one Firebase sign-in call, the portal gate and book-page hooks", () => {
    expect(login.match(/await signInWithEmail\(/g)).toHaveLength(1);
    expect(login).toContain('renderSignInForm("supplier"');
    expect(login).toContain('renderSignInForm("staff"');
    expect(login).toContain("registering ? renderRegistrationForm() : renderSignInForm");
    expect(login).toContain('role="tablist"');
    expect(login).toContain('aria-selected={portal === "supplier"}');
    expect(login).toContain("auth-book__pages");
  });

  it("keeps the reduced-motion fallback and the book-page turn", () => {
    expect(css).toContain(".auth-book__pages.is-flipped");
    expect(css).toContain("rotateY(-180deg)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

describe("shared surfaces", () => {
  it("keeps the supplier shell plain tailwind and leaves admin nav intact", () => {
    expect(shell).toContain("primaryTabsForRole(role)");
    expect(shell).toContain('"border-t border-slate-200 bg-white/95 backdrop-blur-xl"');
    expect(css).toContain(".sp-main .card");
  });

  it("preserves the iOS input-zoom prevention", () => {
    expect(css).toMatch(/font-size:\s*16px/);
    expect(css).not.toContain("user-scalable=no");
  });
});
