import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Supplier and staff book-page login", () => {
  it("keeps one authentication function behind both portal pages", () => {
    const login = read("src/components/Login.tsx");
    expect(login).toContain('useState<"supplier" | "staff">("supplier")');
    expect(login).toContain('renderSignInForm("supplier"');
    expect(login).toContain('renderSignInForm("staff"');
    expect(login.match(/await signInWithEmail\(/g)).toHaveLength(1);
  });

  it("keeps supplier registration on the supplier-facing page", () => {
    const login = read("src/components/Login.tsx");
    expect(login).toContain("registering ? renderRegistrationForm() : renderSignInForm");
    expect(login).toContain('t("auth.staffRolesHint")');
  });

  it("provides the page-turn and reduced-motion fallback", () => {
    const styles = read("src/index.css");
    expect(styles).toContain(".auth-book__pages.is-flipped");
    expect(styles).toContain("rotateY(-180deg)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps the new portal labels aligned across all languages", () => {
    for (const locale of ["en", "si", "ta"]) {
      const messages = JSON.parse(read(`src/i18n/locales/${locale}.json`)) as { auth: Record<string, string> };
      expect(messages.auth.supplierPortal).toBeTruthy();
      expect(messages.auth.staffPortal).toBeTruthy();
      expect(messages.auth.secureRoleRouting).toBeTruthy();
    }
  });
});
