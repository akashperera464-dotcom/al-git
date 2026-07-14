import type { ComponentType } from "react";
import Dashboard from "./Dashboard";
import EstateMaster from "./EstateMaster";
import Labor from "./Labor";
import Payroll from "./Payroll";
import Loans from "./Loans";
import Fertilizer from "./Fertilizer";
import Agrochemical from "./Agrochemical";
import Crop from "./Crop";
import Harvest from "./Harvest";
import Factory from "./Factory";
import Inventory from "./Inventory";
import Finance from "./Finance";
import Loyalty from "./Loyalty";
import Welfare from "./Welfare";
import GisMap from "./GisMap";
import Weather from "./Weather";
import Vehicles from "./Vehicles";
import MobileOffline from "./MobileOffline";
import AiAnalytics from "./AiAnalytics";
import AuditCompliance from "./AuditCompliance";
import Architecture from "./Architecture";
import UserManagement from "./UserManagement";
import Settings from "./Settings";
import SupplierLoans from "./SupplierLoans";
import AuctionSales from "./AuctionSales";
import { EoRegisterSupplier, EoWeighing } from "./ExtensionOfficer";
import { SupplierDeliveries, SupplierAlerts, SupplierPayments } from "./SupplierPortal";
import { FarmActivities } from "./FarmActivities";
import Announcements from "./Announcements";
import { SupplierAnnouncements } from "./SupplierAnnouncements";
import { SupplierRequestForm } from "./SupplierRequest";
import { ResourceRequests } from "./ResourceRequests";

export const REGISTRY: Record<string, ComponentType> = {
  // Admin — executive dashboards, core ERP & administration
  dashboard: Dashboard,
  "estate-master": EstateMaster,
  labor: Labor,
  payroll: Payroll,
  loans: Loans,
  fertilizer: Fertilizer,
  agrochemical: Agrochemical,
  crop: Crop,
  harvest: Harvest,
  factory: Factory,
  inventory: Inventory,
  finance: Finance,
  loyalty: Loyalty,
  welfare: Welfare,
  gis: GisMap,
  weather: Weather,
  vehicles: Vehicles,
  mobile: MobileOffline,
  ai: AiAnalytics,
  audit: AuditCompliance,
  architecture: Architecture,
  "user-management": UserManagement,
  announcements: Announcements,

  // Tea Industry — supplier loans + auction sales
  "supplier-loans": SupplierLoans,
  "auction-sales": AuctionSales,

  // Extension Officer — register suppliers + log weights
  "eo-register": EoRegisterSupplier,
  "eo-weighing": EoWeighing,

  // Supplier / VVIP — portal modules + resource requisitions
  "supplier-deliveries": SupplierDeliveries,
  "supplier-alerts": SupplierAlerts,
  "supplier-payments": SupplierPayments,
  "supplier-farm": FarmActivities,
  "supplier-announcements": SupplierAnnouncements,
  "supplier-requests": SupplierRequestForm,

  // Admin — supplier resource requisition inbox (ticket management)
  "resource-requests": ResourceRequests,

  // Super Admin — branding & white-label settings
  settings: Settings,
};
