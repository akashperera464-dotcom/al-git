/**
 * Verda ERP · Centralized Role-Based Access Control (RBAC)
 * ------------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH for "who can see/do what".
 *
 * Two enforcement layers (both must pass):
 *   1) module.roles        — coarse role gating (is this role allowed here?)
 *   2) ROLE_CAPABILITIES   — fine-grained capability check
 *
 * `RouteGuard` (src/components/RouteGuard.tsx) calls `canAccess()` before
 * mounting ANY module. The Shell derives its nav from `modulesForRole()`.
 * The Firestore rules (firestore.rules) mirror these same boundaries server-side.
 */
import {
  LayoutDashboard,
  Network,
  Users,
  Wallet,
  HandCoins,
  Sprout,
  FlaskConical,
  Leaf,
  Scale,
  Factory,
  Boxes,
  Calculator,
  Trophy,
  HeartPulse,
  MapPin,
  CloudSun,
  Truck,
  Smartphone,
  BrainCircuit,
  ShieldCheck,
  Workflow,
  UserCog,
  UserPlus,
  Package,
  PackageOpen,
  Inbox,
  BellRing,
  Palette,
  Newspaper,
  Gavel,
  Sprout,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./data";

/* ----------------------------- Capabilities ----------------------------- */
export type Capability =
  // enterprise / admin
  | "dashboard.view"
  | "estate.master"
  | "crop.view"
  | "gis.view"
  | "labor.view"
  | "harvest.view"
  | "vehicles.manage"
  | "factory.view"
  | "inventory.manage"
  | "fertilizer.manage"
  | "agrochemical.manage"
  | "payroll.manage"
  | "loans.view"
  | "loyalty.manage"
  | "welfare.view"
  | "finance.view"
  | "weather.view"
  | "ai.view"
  | "audit.view"
  | "offline.manage"
  | "users.manage"
  | "platform.view"
  | "requests.manage"
  | "settings.manage"
  | "supplier.loans"
  | "auction.sales"
  | "field.tools"
  // extension officer (field) — register suppliers + log weights
  | "weighing.capture"
  | "supplier.register"
  | "estate.map.view"
  // supplier (VVIP) — own data + resource requisitions
  | "deliveries.own"
  | "alerts.own"
  | "payments.own"
  | "requests.create"
  | "farm.log"
  | "announcements.manage"
  | "announcements.view";

/**
 * The capability matrix. This is the definitive permission boundary.
 * Admin = everything. Supervisor/Supplier = strictly scoped.
 */
const ADMIN_CAPS: Capability[] = [
  "dashboard.view", "estate.master", "crop.view", "gis.view", "labor.view",
  "harvest.view", "vehicles.manage", "factory.view", "inventory.manage",
  "fertilizer.manage", "agrochemical.manage", "payroll.manage", "loans.view",
  "loyalty.manage", "welfare.view", "finance.view", "weather.view", "ai.view",
  "audit.view", "offline.manage", "users.manage", "platform.view", "requests.manage", "announcements.manage",
];

/** Super Admin gets every admin capability PLUS branding/settings control. */
const SUPER_ADMIN_CAPS: Capability[] = [...ADMIN_CAPS, "settings.manage"];

/**
 * The capability matrix. This is the definitive permission boundary.
 * Super Admin = everything (can also manage other admins + branding).
 * Admin = everything except settings. Supervisor/Supplier = strictly scoped.
 */
export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  super_admin: SUPER_ADMIN_CAPS,
  admin: ADMIN_CAPS,
  // Extension Officers: field tools — log weights + register suppliers.
  extension_officer: ["weighing.capture", "supplier.register", "estate.map.view"],
  // Suppliers: their own data + raise resource requisitions — NO rosters, payroll, other suppliers, dashboards.
  supplier: ["deliveries.own", "alerts.own", "payments.own", "requests.create", "farm.log", "announcements.view"],
};

export const hasCapability = (role: Role, cap: Capability): boolean =>
  ROLE_CAPABILITIES[role].includes(cap);

/* ----------------------------- Module access table ----------------------------- */
export interface NavItem {
  key: string;
  label: string;
  short: string;
  icon: LucideIcon;
  category: string;
  roles: Role[];
  capability: Capability;
  premium?: boolean;
}

export const CATEGORIES: { id: string; label: string }[] = [
  { id: "overview", label: "Command" },
  { id: "estate", label: "Estate & Land" },
  { id: "operations", label: "Field Operations" },
  { id: "factory", label: "Manufacturing" },
  { id: "inputs", label: "Inputs" },
  { id: "people", label: "People & Pay" },
  { id: "finance", label: "Finance" },
  { id: "intelligence", label: "Intelligence" },
  { id: "administration", label: "Administration" },
  { id: "more", label: "More / Future" },
];

export const MODULES: NavItem[] = [
  /* ---- Admin: executive dashboards & core ERP ---- */
  { key: "dashboard", label: "Estate Dashboard", short: "Home", icon: LayoutDashboard, category: "overview", roles: ["admin"], capability: "dashboard.view" },
  { key: "estate-master", label: "Estate Master", short: "Master", icon: Network, category: "estate", roles: ["admin"], capability: "estate.master" },
  { key: "crop", label: "Crop Management", short: "Crop", icon: Leaf, category: "estate", roles: ["admin"], capability: "crop.view" },
  { key: "gis", label: "GPS & GIS Mapping", short: "Map", icon: MapPin, category: "more", roles: ["admin"], capability: "gis.view" },
  { key: "labor", label: "Labor Management", short: "Labor", icon: Users, category: "operations", roles: ["admin"], capability: "labor.view" },
  { key: "harvest", label: "Harvest Management", short: "Weigh", icon: Scale, category: "operations", roles: ["admin"], capability: "harvest.view" },
  { key: "vehicles", label: "Vehicle & Fuel", short: "Fleet", icon: Truck, category: "more", roles: ["admin"], capability: "vehicles.manage" },
  { key: "resource-requests", label: "Resource Requisitions", short: "Inbox", icon: Inbox, category: "operations", roles: ["admin"], capability: "requests.manage" },
  { key: "factory", label: "Factory Integration", short: "Factory", icon: Factory, category: "more", roles: ["admin"], capability: "factory.view" },
  { key: "inventory", label: "Inventory", short: "Stores", icon: Boxes, category: "factory", roles: ["admin"], capability: "inventory.manage" },
  { key: "fertilizer", label: "Fertilizer", short: "Fertilizer", icon: Sprout, category: "inputs", roles: ["admin"], capability: "fertilizer.manage" },
  { key: "agrochemical", label: "Agrochemical", short: "Spray", icon: FlaskConical, category: "inputs", roles: ["admin"], capability: "agrochemical.manage" },
  { key: "payroll", label: "Payroll System", short: "Payroll", icon: Wallet, category: "people", roles: ["admin"], capability: "payroll.manage" },
  { key: "loans", label: "Loans & Advances", short: "Loans", icon: HandCoins, category: "people", roles: ["admin"], capability: "loans.view" },
  { key: "loyalty", label: "Loyalty Program", short: "Rewards", icon: Trophy, category: "people", roles: ["admin"], capability: "loyalty.manage" },
  { key: "welfare", label: "Welfare Management", short: "Welfare", icon: HeartPulse, category: "more", roles: ["admin"], capability: "welfare.view" },
  { key: "finance", label: "Finance & Accounting", short: "Finance", icon: Calculator, category: "finance", roles: ["admin"], capability: "finance.view" },
  { key: "weather", label: "Weather & Environment", short: "Weather", icon: CloudSun, category: "intelligence", roles: ["admin"], capability: "weather.view" },
  { key: "ai", label: "AI & Analytics", short: "AI", icon: BrainCircuit, category: "more", roles: ["admin"], capability: "ai.view", premium: true },
  { key: "audit", label: "Audit & Compliance", short: "Compliance", icon: ShieldCheck, category: "more", roles: ["admin"], capability: "audit.view" },
  { key: "mobile", label: "Mobile & Offline", short: "Offline", icon: Smartphone, category: "more", roles: ["admin"], capability: "offline.manage" },
  { key: "architecture", label: "Architecture & Docs", short: "Blueprint", icon: Workflow, category: "more", roles: ["admin"], capability: "platform.view" },
  { key: "user-management", label: "User Management", short: "Users", icon: UserCog, category: "administration", roles: ["admin"], capability: "users.manage" },
  { key: "announcements", label: "Announcements", short: "Posts", icon: Newspaper, category: "administration", roles: ["admin"], capability: "announcements.manage" },
  { key: "supplier-loans", label: "Supplier Loans", short: "S Loans", icon: Sprout, category: "finance", roles: ["admin"], capability: "supplier.loans" },
  { key: "auction-sales", label: "Auction Sales", short: "Auction", icon: Gavel, category: "finance", roles: ["admin"], capability: "auction.sales" },
  { key: "field-tools", label: "Field Tools", short: "Tools", icon: FlaskConical, category: "operations", roles: ["admin"], capability: "field.tools" },
  { key: "settings", label: "Branding & Settings", short: "Settings", icon: Palette, category: "administration", roles: ["super_admin"], capability: "settings.manage" },

  /* ---- Extension Officer (mobile): register suppliers + log weights ---- */
  { key: "eo-register", label: "Register New Supplier", short: "Register", icon: UserPlus, category: "field", roles: ["extension_officer"], capability: "supplier.register" },
  { key: "eo-weighing", label: "Leaf Weighing Entry", short: "Weigh", icon: Scale, category: "field", roles: ["extension_officer"], capability: "weighing.capture" },

  /* ---- Supplier / VVIP (mobile): own portal + resource requisitions ---- */
  { key: "supplier-deliveries", label: "My Leaf Deliveries", short: "Deliveries", icon: Package, category: "supplier", roles: ["supplier"], capability: "deliveries.own" },
  { key: "supplier-alerts", label: "Smart Alerts Panel", short: "Alerts", icon: BellRing, category: "supplier", roles: ["supplier"], capability: "alerts.own" },
  { key: "supplier-payments", label: "Payment Tracker", short: "Payments", icon: Wallet, category: "supplier", roles: ["supplier"], capability: "payments.own" },
  { key: "supplier-farm", label: "My Farm Activities", short: "Farm", icon: Sprout, category: "supplier", roles: ["supplier"], capability: "farm.log" },
  { key: "supplier-announcements", label: "Estate Updates", short: "Updates", icon: Newspaper, category: "supplier", roles: ["supplier"], capability: "announcements.view" },
  { key: "supplier-requests", label: "Request Resources", short: "Request", icon: PackageOpen, category: "supplier", roles: ["supplier"], capability: "requests.create" },
];

/* ----------------------------- Selectors / guards ----------------------------- */
/** super_admin inherits every module that admin can access. */
export const modulesForRole = (r: Role): NavItem[] =>
  MODULES.filter((m) => m.roles.includes(r) || (r === "super_admin" && m.roles.includes("admin")));

/** The central guard used by <RouteGuard>. */
export const canAccess = (role: Role, moduleKey: string): boolean => {
  const m = MODULES.find((x) => x.key === moduleKey);
  if (!m) return false; // unknown module → deny by default
  const allowed = m.roles.includes(role) || (role === "super_admin" && m.roles.includes("admin"));
  return allowed && hasCapability(role, m.capability);
};

/** True for roles that use the desktop Admin Shell (super_admin + admin). */
export const usesAdminShell = (r: Role): boolean => r === "admin" || r === "super_admin";

/** Landing module per role (set after auth resolves). */
export const homeModuleFor = (r: Role): string =>
  usesAdminShell(r) ? "dashboard" : r === "extension_officer" ? "eo-register" : "supplier-deliveries";

/** Tabs for the mobile bottom-nav (supervisor / supplier only). */
export const primaryTabsForRole = (r: Role): NavItem[] => modulesForRole(r);
