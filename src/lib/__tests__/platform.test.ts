import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAndroidEmbeddedWebView } from "../platform";

describe("Android application shell detection", () => {
  it("detects the standard Android WebView marker", () => {
    expect(isAndroidEmbeddedWebView(
      "Mozilla/5.0 (Linux; Android 13; Device Build/TQ3A) AppleWebKit/537.36 Version/4.0 Chrome/120.0 Mobile Safari/537.36 wv",
      false,
    )).toBe(true);
  });

  it("does not hide the language selector in normal Android Chrome", () => {
    expect(isAndroidEmbeddedWebView(
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
      false,
    )).toBe(false);
  });

  it("detects an Android native bridge even with a customized user agent", () => {
    expect(isAndroidEmbeddedWebView("KDUApp/1.0 (Android 13)", true)).toBe(true);
  });

  it("never classifies an iPhone browser as an Android WebView", () => {
    expect(isAndroidEmbeddedWebView(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
      true,
    )).toBe(false);
  });

  it("renders the language selector everywhere — never suppressed in the Android shell", () => {
    // Policy change (Nov 2026): the Expo shell dropped its native language
    // overlay, so suppressing the web control left Android users with no way
    // to switch language. Both shell headers and the login page must render
    // the switcher unconditionally; any re-added guard fails this test.
    const shell = readFileSync(resolve(process.cwd(), "src/components/Shell.tsx"), "utf8");
    const login = readFileSync(resolve(process.cwd(), "src/components/Login.tsx"), "utf8");

    expect(shell.match(/<LanguageSwitcher pill \/>/g) ?? []).toHaveLength(2);
    expect(login).toContain("<LanguageSwitcher pill />");
    expect(shell).not.toMatch(/!embeddedAndroidApp\s*&&\s*<LanguageSwitcher/);
    expect(login).not.toMatch(/!embeddedAndroidApp\s*&&\s*<LanguageSwitcher/);
  });
});
