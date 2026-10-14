import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readJson = (name: string) => JSON.parse(readFileSync(resolve(process.cwd(), `src/i18n/locales/${name}.json`), "utf8"));
const flatten = (value: Record<string, unknown>, prefix = ""): string[] => Object.entries(value).flatMap(([key, child]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  return child && typeof child === "object" && !Array.isArray(child)
    ? flatten(child as Record<string, unknown>, path)
    : [path];
});

describe("Round 15 connected operations", () => {
  it("keeps the three language dictionaries structurally identical", () => {
    const en = flatten(readJson("en")).sort();
    expect(flatten(readJson("si")).sort()).toEqual(en);
    expect(flatten(readJson("ta")).sort()).toEqual(en);
  });

  it("ships fertilizer requests and connected supplier workflow labels", () => {
    for (const language of ["en", "si", "ta"]) {
      const locale = readJson(language);
      expect(locale.request.fertilizer).toBeTruthy();
      expect(locale.request.agrochemical).toBeTruthy();
      expect(locale.supplierDelivery.downloadStatement).toBeTruthy();
      expect(locale.supplierProfile.changeSubmitted).toBeTruthy();
      expect(locale.round15.supportTitle).toBeTruthy();
    }
  });
});
