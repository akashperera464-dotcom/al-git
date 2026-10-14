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
    expect(html).toContain('href="/dalu-plus-icon-180.png"');
    expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual([
      "/dalu-plus-icon-192.png",
      "/dalu-plus-icon-512.png",
      "/dalu-plus-icon-512.png",
    ]);
  });
});
