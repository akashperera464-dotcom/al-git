import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isRoleAllowedForPortal } from "../loginPortal";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Supplier and staff book-page login", () => {
  it("keeps one authentication function behind both portal pages", () => {
    const login = read("src/components/Login.tsx");
    expect(login).toContain('useState<LoginPortal>("supplier")');
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

  it("keeps the portal labels aligned across all languages", () => {
    for (const locale of ["en", "si", "ta"]) {
      const messages = JSON.parse(read(`src/i18n/locales/${locale}.json`)) as { auth: Record<string, string> };
      expect(messages.auth.supplierPortal).toBeTruthy();
      expect(messages.auth.staffPortal).toBeTruthy();
      expect(messages.auth.secureRoleRouting).toBeTruthy();
      expect(messages.auth.supplierPortalOnly).toBeTruthy();
      expect(messages.auth.staffPortalOnly).toBeTruthy();
    }
  });
});

describe("role-specific login portals", () => {
  it("allows only suppliers through Supplier Login", () => {
    expect(isRoleAllowedForPortal("supplier", "supplier")).toBe(true);
    expect(isRoleAllowedForPortal("supplier", "admin")).toBe(false);
    expect(isRoleAllowedForPortal("supplier", "super_admin")).toBe(false);
    expect(isRoleAllowedForPortal("supplier", "extension_officer")).toBe(false);
  });

  it("allows approved non-supplier accounts through Staff Login", () => {
    expect(isRoleAllowedForPortal("staff", "admin")).toBe(true);
    expect(isRoleAllowedForPortal("staff", "super_admin")).toBe(true);
    expect(isRoleAllowedForPortal("staff", "extension_officer")).toBe(true);
    expect(isRoleAllowedForPortal("staff", "supplier")).toBe(false);
  });
});
