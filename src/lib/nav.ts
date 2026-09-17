/**
 * Verda ERP · Nav (public re-export)
 * The single source of truth lives in src/lib/rbac.ts.
 * This module re-exports it so existing `@/lib/nav` imports keep working.
 */
export {
  MODULES,
  CATEGORIES,
  modulesForRole,
  primaryTabsForRole,
  canAccess,
  homeModuleFor,
  hasCapability,
  usesAdminShell,
  ROLE_CAPABILITIES,
  type NavItem,
  type Capability,
} from "./rbac";
