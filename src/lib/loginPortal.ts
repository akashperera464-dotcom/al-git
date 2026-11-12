import type { Role } from "./data";

export type LoginPortal = "supplier" | "staff";

export const LOGIN_PORTAL_INTENT_KEY = "verda.auth.portalIntent";
export const LOGIN_PORTAL_BLOCKED_UID_KEY = "verda.auth.portalBlockedUid";

export function isRoleAllowedForPortal(portal: LoginPortal, role: Role): boolean {
  return portal === "supplier" ? role === "supplier" : role !== "supplier";
}

export function readLoginPortalIntent(): LoginPortal | null {
  try {
    const value = sessionStorage.getItem(LOGIN_PORTAL_INTENT_KEY);
    return value === "supplier" || value === "staff" ? value : null;
  } catch {
    return null;
  }
}

export function portalMismatchMessage(portal: LoginPortal): string {
  return portal === "supplier"
    ? "This account must use Staff Login."
    : "This account must use Supplier Login.";
}
