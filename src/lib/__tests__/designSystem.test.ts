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

  it("loads the Stitch display/body faces with Sinhala/Tamil fallbacks", () => {
    expect(css).toContain("Wix+Madefor+Display");
    expect(css).toContain("Instrument+Sans");
    expect(css).toContain('--font-display: "Wix Madefor Display", "Instrument Sans", "Noto Sans"');
  });

  it("never forces wide tracking or a Latin-only mono face on content", () => {
    expect(css).toContain(':lang(si), :lang(ta)');
    expect(css).toContain("font-family: inherit !important");
    expect(css).not.toContain("letter-spacing: 0.24em");
    expect(css).not.toMatch(/--font-sans:\s*"Hanken Grotesk"/);
  });
});

describe("container-safe supplier layout", () => {
  it("keeps a light branded canvas around the desktop phone preview", () => {
    expect(shell).toContain("supplier-device-stage");
    expect(css).toContain(".supplier-device-stage");
    expect(css).toContain(".dark .supplier-device-stage");
  });

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
  it("implements the Dalu Plus Stitch split-screen login", () => {
    expect(login).toContain("login-stage");
    expect(login).toContain("lg:grid-cols-12");
    expect(login).toContain("/tea-estate-bg.jpg");
    expect(login).toContain("renderRateChips");
    expect(css).toContain(".login-stage");
    expect(css).toContain("--color-dalu-primary: #0e5e42");
    expect(css).toContain("--color-dalu-surface: #f5f8f5");
  });

  it("keeps the form sharp: no heavy backdrop blur behind inputs", () => {
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
    expect(shell).toContain("border-t border-slate-200 bg-white/95 backdrop-blur-xl");
    expect(css).toContain(".sp-main .card");
  });

  it("preserves the iOS input-zoom prevention", () => {
    expect(css).toMatch(/font-size:\s*16px/);
    expect(css).not.toContain("user-scalable=no");
  });
});

describe("admin branding media (regression guard)", () => {
  it("renders the configured background video OR image on the login page", () => {
    // Rounds 74–75 accidentally dropped this block; the guard keeps it here.
    expect(login).toContain("branding.loginBackgroundUrl");
    expect(login).toContain("isVideoUrl(branding.loginBackgroundUrl)");
    expect(login).toMatch(/<video[\s\S]{0,600}src=\{branding\.loginBackgroundUrl\}/);
    // The image legibility goes through bgSrc (branding image > estate photo).
    expect(login).toContain('const bgSrc = hasBg && !bgIsVideo ? branding.loginBackgroundUrl : "/tea-estate-bg.jpg";');
    expect(login).toContain("hasBg");
  });

  it("keeps the video autoplay-safe and mute-compliant", () => {
    expect(login).toMatch(/<video[\s\S]{0,260}autoPlay/);
    expect(login).toMatch(/<video[\s\S]{0,300}loop/);
    expect(login).toMatch(/<video[\s\S]{0,300}muted/);
    expect(login).toMatch(/<video[\s\S]{0,300}playsInline/);
    expect(login).toContain("onCanPlay");
  });

  it("honours the Super Admin scrim opacity over branding media", () => {
    expect(login).toContain("branding.loginScrimOpacity");
  });

  it("falls back to the estate photograph when no branding media is set", () => {
    // bgSrc = branding image when present, otherwise the bundled estate photo.
    expect(login).toContain('const bgSrc = hasBg && !bgIsVideo ? branding.loginBackgroundUrl : "/tea-estate-bg.jpg";');
    expect(login).toMatch(/bgIsVideo \? \([\s\S]{0,400}src=\{branding\.loginBackgroundUrl\}/);
  });

  it("keeps autofilled credentials visually clean", () => {
    expect(css).toContain(".login-input:-webkit-autofill");
    expect(css).toContain("-webkit-box-shadow: 0 0 0 1000px #ffffff inset");
  });
});

describe("boot safety net (white-screen prevention)", () => {
  it("ships a static boot splash inside #root so the page is never blank", () => {
    expect(html).toContain('id="boot-splash"');
    expect(html).toContain("Loading your workspace");
    expect(html).toContain('id="boot-recover"');
  });

  it("self-heals a stale service-worker app shell exactly once per session", () => {
    expect(html).toContain("kdu.boot.recovery");
    expect(html).toContain("caches.keys()");
    expect(html).toContain("getRegistrations()");
    expect(html).toContain("vite:preloadError");
    expect(html).toContain("setTimeout");
  });

  it("never caches code chunks and purges every stale cache on activate", () => {
    const sw = readFileSync(resolve(process.cwd(), "public/sw.ts"), "utf8");
    // Scripts/styles are network-first so a released shell can never request a
    // chunk hash that no longer exists (the white-screen root cause).
    expect(sw).toContain('["style", "script"].includes(request.destination)');
    expect(sw).toMatch(/NetworkFirst\(\{ cacheName: "verda-code-v3"/);
    expect(sw).not.toMatch(/\["style", "script", "image", "font"\][^\n]*CacheFirst/);
    // Every cache a previous release created is purged on activation.
    expect(sw).toContain('name.startsWith("verda-")');
    expect(sw).toContain("!CURRENT.has(name)");
    expect(sw).toContain('cacheName: "verda-code-v3"');
  });

  it("renders a visible error panel when React cannot mount", () => {
    const main = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf8");
    expect(main).toContain("could not start");
    expect(main).toContain("Reload the latest version");
  });

  it("does not force CORS mode on admin-supplied video hosts", () => {
    expect(login).not.toContain('crossOrigin="anonymous"');
    expect(login).toContain("onCanPlay");
  });
});

describe("deploy-safe lazy modules", () => {
  it("routes every module through the deploy-safe loader and triggers recovery on chunk loss", () => {
    const registry = readFileSync(resolve(process.cwd(), "src/modules/registry.ts"), "utf8");
    expect(registry).toContain('import { lazyModule } from "@/lib/lazyModule"');
    expect(registry).not.toMatch(/\blazy\(\(\) => import\(/);
    const loader = readFileSync(resolve(process.cwd(), "src/lib/lazyModule.ts"), "utf8");
    expect(loader).toContain("kduRecover");
    const main = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf8");
    expect(main).toContain("armChunkLossRecovery");
    expect(main).toMatch(/dynamically imported module/i);
  });
});
