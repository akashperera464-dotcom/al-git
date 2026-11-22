import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_BRANDING, migrateLegacyBranding } from "../branding";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("iPhone PWA shell", () => {
  it("keeps the mobile admin drawer inside iOS safe areas", () => {
    const shell = read("src/components/Shell.tsx");
    expect(shell).toMatch(/safe-screen[^\"]*absolute left-0 top-0/);
    expect(shell).toMatch(/safe-top-absolute[^\"]*absolute right-3/);
  });

  it("uses the local Dalu Plus artwork for Apple and manifest icons", () => {
    const html = read("index.html");
    const manifest = JSON.parse(read("public/manifest.json"));
    expect(html).toContain('href="/apple-touch-icon-v2.png"');
    expect(html).toContain('href="/apple-touch-icon-precomposed.png"');
    expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual([
      "/dalu-plus-pwa-192-v2.png",
      "/dalu-plus-pwa-512-v2.png",
      "/dalu-plus-pwa-512-maskable.png",
    ]);
    for (const [path, size] of [
      ["public/apple-touch-icon-v2.png", 180],
      ["public/apple-touch-icon.png", 180],
      ["public/apple-touch-icon-precomposed.png", 180],
      ["public/dalu-plus-pwa-192-v2.png", 192],
      ["public/dalu-plus-pwa-512-v2.png", 512],
      ["public/dalu-plus-pwa-512-maskable.png", 512],
    ] as const) {
      const png = readFileSync(resolve(process.cwd(), path));
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
      expect(png[25]).toBe(2); // true-colour RGB: no alpha channel for iOS artwork
    }
    // The default in-app mark keeps its alpha channel (transparent corners so
    // it sits cleanly on any badge surface) — valid PNG, 512x512.
    const mark = readFileSync(resolve(process.cwd(), "public/branding/dalu-plus-mark.png"));
    expect(mark.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(mark.readUInt32BE(16)).toBe(512);
    expect(mark.readUInt32BE(20)).toBe(512);
  });

  it("defaults the branding to the official Dalu Plus identity", () => {
    const manifest = JSON.parse(read("public/manifest.json"));
    expect(manifest.short_name).toBe("Dalu Plus");
    expect(DEFAULT_BRANDING.companyName).toBe("Dalu Plus");
    expect(DEFAULT_BRANDING.companyTagline).toBe("Powered by KDU Group");
    expect(DEFAULT_BRANDING.companyLogoUrl).toBe("/branding/dalu-plus-mark.png");
    expect(DEFAULT_BRANDING.loginLogoUrl).toBe("/branding/dalu-plus-mark.png");
    // Legacy stored values migrate to the new defaults…
    const legacy = migrateLegacyBranding({
      ...DEFAULT_BRANDING,
      companyName: "Estate Pulse",
      companyTagline: "Supplier Management System",
      loginTitle: "Estate Pulse",
      loginSubtitle: "Tea Estate Supplier Management Platform",
      companyLogoUrl: "/dalu-plus-source.png",
      loginLogoUrl: "",
    });
    expect(legacy.companyName).toBe("Dalu Plus");
    expect(legacy.companyTagline).toBe("Powered by KDU Group");
    expect(legacy.loginTitle).toBe("Dalu Plus");
    expect(legacy.loginSubtitle).toBe("Powered by KDU Group");
    expect(legacy.companyLogoUrl).toBe("/branding/dalu-plus-mark.png");
    expect(legacy.loginLogoUrl).toBe("/branding/dalu-plus-mark.png");
    // …while deliberately configured branding is preserved.
    const custom = migrateLegacyBranding({
      ...DEFAULT_BRANDING,
      companyName: "My Estate Co",
      companyLogoUrl: "https://res.cloudinary.com/demo/logo.png",
    });
    expect(custom.companyName).toBe("My Estate Co");
    expect(custom.companyLogoUrl).toBe("https://res.cloudinary.com/demo/logo.png");
  });

  it("migrates the first manual configuration (full lockup JPEG + KDU GROUP) to the official defaults", () => {
    const CLOUDINARY_LOCKUP = "https://res.cloudinary.com/dhd06wdov/image/upload/v1795158484/image_e40f48c1_anlnnz.jpg";
    // "𝐃𝐚𝐥𝐮 𝐏𝐥𝐮𝐬" typed with Mathematical Alphanumeric Symbols (U+1D400 block).
    const BOLD_UNICODE = "\u{1D403}\u{1D41A}\u{1D425}\u{1D42E} \u{1D40F}\u{1D425}\u{1D42E}\u{1D42C}";
    const live = migrateLegacyBranding({
      ...DEFAULT_BRANDING,
      companyName: "KDU GROUP",
      loginTitle: "KDU GROUP",
      companyTagline: BOLD_UNICODE,
      loginSubtitle: BOLD_UNICODE,
      companyLogoUrl: CLOUDINARY_LOCKUP,
      loginLogoUrl: CLOUDINARY_LOCKUP,
      supplierCompanyLogoUrl: CLOUDINARY_LOCKUP,
    });
    expect(live.companyName).toBe("Dalu Plus");
    expect(live.loginTitle).toBe("Dalu Plus");
    expect(live.companyTagline).toBe("Powered by KDU Group");
    expect(live.loginSubtitle).toBe("Powered by KDU Group");
    expect(live.companyLogoUrl).toBe("/branding/dalu-plus-mark.png");
    expect(live.loginLogoUrl).toBe("/branding/dalu-plus-mark.png");
    // supplier logo falls back to blank → inherits the company mark
    expect(live.supplierCompanyLogoUrl).toBe("");
  });

  it("does not let an old service worker hide a newly deployed app shell", () => {
    const main = read("src/main.tsx");
    const worker = read("public/sw.ts");
    expect(main).toContain('{ updateViaCache: "none" }');
    expect(main).toContain("registration.update()");
    expect(worker).toContain("self.skipWaiting()");
    // Versioned cache: a previous release's shell can never hide this one.
    expect(worker).toContain('cacheName: "verda-navigation-v2"');
    expect(worker).toContain('request.mode === "navigate"');
  });
});
