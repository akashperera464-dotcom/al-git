import { describe, expect, it } from "vitest";
import { canAccess, MODULES, ROLE_CAPABILITIES } from "./rbac";
import type { Role } from "./data";

describe("navigation permissions", () => {
  it("enables Field Tools for both administrative roles", () => {
    expect(canAccess("admin", "field-tools")).toBe(true);
    expect(canAccess("super_admin", "field-tools")).toBe(true);
  });
  it("enables supplier profiles without exposing administrative modules", () => {
    expect(canAccess("supplier", "supplier-profile")).toBe(true);
    for (const key of ["user-management", "field-tools", "settings", "payroll"]) {
      expect(canAccess("supplier", key)).toBe(false);
    }
  });
  it("keeps every visible navigation item accessible to its intended role", () => {
    for (const role of Object.keys(ROLE_CAPABILITIES) as Role[]) {
      for (const item of MODULES.filter(m => m.roles.includes(role))) {
        expect(canAccess(role, item.key), `${role}: ${item.key}`).toBe(true);
      }
    }
    expect(canAccess("admin", "unregistered-module")).toBe(false);
  });
});
