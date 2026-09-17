/**
 * Verda · Module label translation helpers
 * ------------------------------------------------------------------
 * The RBAC MODULES array (src/lib/rbac.ts) holds the canonical English labels,
 * but navigation must render in the user's selected language. These helpers
 * look up the `modules.{key}.l` (label) and `modules.{key}.s` (short) keys.
 *
 * If a translation is missing, i18next falls back to English, then to the key.
 */
import type { TFunction } from "i18next";

/** Translated full module label (sidebar + page header title). */
export function moduleLabel(t: TFunction, key: string): string {
  return t(`modules.${key}.l`);
}

/** Translated short module label (bottom-nav + "More" sheet). */
export function moduleShort(t: TFunction, key: string): string {
  return t(`modules.${key}.s`);
}

import type { Role } from "@/lib/data";

const ROLE_TITLE_KEY: Record<Role, string> = {
  super_admin: "roles.superAdminTitle",
  admin: "roles.adminTitle",
  extension_officer: "roles.officerTitle",
  supplier: "roles.supplierTitle",
};
const ROLE_DESC_KEY: Record<Role, string> = {
  super_admin: "roles.superAdminDesc",
  admin: "roles.adminDesc",
  extension_officer: "roles.officerDesc",
  supplier: "roles.supplierDesc",
};

/** Translated role title (header + switcher). */
export function roleTitle(t: TFunction, role: Role): string {
  return t(ROLE_TITLE_KEY[role]);
}

/** Translated role description (switcher dropdown). */
export function roleDesc(t: TFunction, role: Role): string {
  return t(ROLE_DESC_KEY[role]);
}
