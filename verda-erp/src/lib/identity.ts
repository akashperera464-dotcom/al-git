import type { Role } from "./data";

/**
 * Verda · Identity & Role Normalization (RBAC boundary layer)
 * ------------------------------------------------------------------
 * The app operates on 3 canonical roles. Firestore may persist the full
 * domain strings from the org model. Everything that resolves a role from
 * Auth/Firestore (users/{uid}.role) MUST pass through `canonicalRole()`.
 *
 * Unknown or missing roles FAIL CLOSED → the least-privileged read-only
 * supplier portal (never admin/finance). This is deliberate defense-in-depth.
 */
export type StoredRole = "SUPER_ADMIN" | "FACTORY_OWNER" | "ADMIN" | "SUPPLIER" | "FIELD_SUPERVISOR";

const ROLE_MAP: Record<string, Role> = {
  SUPER_ADMIN: "super_admin",
  FACTORY_OWNER: "admin",
  ADMIN: "admin",
  EXTENSION_OFFICER: "extension_officer",
  SUPPLIER: "supplier",
  FIELD_SUPERVISOR: "extension_officer", // backward compat
  // also accept canonical app strings
  super_admin: "super_admin",
  admin: "admin",
  supplier: "supplier",
  extension_officer: "extension_officer",
  supervisor: "extension_officer", // backward compat
};

/** Normalize any stored role string → canonical app role. Fail-closed. */
export function canonicalRole(raw?: string | null): Role {
  if (!raw) return "supplier";
  return ROLE_MAP[raw] ?? "supplier";
}

/** Super Admin — highest privilege, can manage other admins. */
export function isSuperAdmin(role: Role): boolean {
  return role === "super_admin";
}

/** Super Admin, Admin and FACTORY_OWNER resolve to the admin capability set. */
export function isEstateAdmin(role: Role): boolean {
  return role === "admin" || role === "super_admin";
}

/** Anyone with administrative authority (shell + user management access). */
export function isAuthority(role: Role): boolean {
  return role === "admin" || role === "super_admin";
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Hard runtime guard for estate-hierarchy mutation.
 * Throws AuthorizationError unless the caller is FACTORY_OWNER or ADMIN.
 * Call this as the FIRST line of every create/update on estates/divisions/fields.
 */
export function requireEstateAdmin(role: Role): void {
  if (!isEstateAdmin(role)) {
    throw new AuthorizationError(
      `Estate hierarchy mutation requires role FACTORY_OWNER or ADMIN (received "${role}").`
    );
  }
}

/** Supplier may only read their own data; admins may read any. */
export function requireOwnerOrAdmin(role: Role, requestedUid: string, callerUid: string): void {
  if (isEstateAdmin(role)) return;
  if (role === "supplier" && requestedUid === callerUid) return;
  throw new AuthorizationError(
    `Supplier may only read their own records (requested "${requestedUid}", caller "${callerUid}").`
  );
}
