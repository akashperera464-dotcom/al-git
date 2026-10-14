import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

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
      "/dalu-plus-pwa-512-v2.png",
    ]);
    for (const [path, size] of [
      ["public/apple-touch-icon-v2.png", 180],
      ["public/apple-touch-icon.png", 180],
      ["public/apple-touch-icon-precomposed.png", 180],
      ["public/dalu-plus-pwa-192-v2.png", 192],
      ["public/dalu-plus-pwa-512-v2.png", 512],
    ] as const) {
      const png = readFileSync(resolve(process.cwd(), path));
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
      expect(png[25]).toBe(2); // true-colour RGB: no alpha channel for iOS artwork
    }
  });
});
