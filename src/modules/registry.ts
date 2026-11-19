import type { ComponentType } from "react";
import { lazyModule } from "@/lib/lazyModule";
const Dashboard = lazyModule(() => import("./Dashboard"));
const EstateMaster = lazyModule(() => import("./EstateMaster"));
const Labor = lazyModule(() => import("./Labor"));
const Payroll = lazyModule(() => import("./Payroll"));
const Loans = lazyModule(() => import("./Loans"));
const Fertilizer = lazyModule(() => import("./Fertilizer"));
const Agrochemical = lazyModule(() => import("./Agrochemical"));
const Equipment = lazyModule(() => import("./Equipment"));
const EquipmentRequests = lazyModule(() => import("./EquipmentRequests"));
const Crop = lazyModule(() => import("./Crop"));
const Harvest = lazyModule(() => import("./Harvest"));
const Factory = lazyModule(() => import("./Factory"));
const Inventory = lazyModule(() => import("./Inventory"));
const Finance = lazyModule(() => import("./Finance"));
const Loyalty = lazyModule(() => import("./Loyalty"));
const Welfare = lazyModule(() => import("./Welfare"));
const GisMap = lazyModule(() => import("./GisMap"));
const Weather = lazyModule(() => import("./Weather"));
const Vehicles = lazyModule(() => import("./Vehicles"));
const MobileOffline = lazyModule(() => import("./MobileOffline"));
const AiAnalytics = lazyModule(() => import("./AiAnalytics"));
const AuditCompliance = lazyModule(() => import("./AuditCompliance"));
const Architecture = lazyModule(() => import("./Architecture"));
const UserManagement = lazyModule(() => import("./UserManagement"));
const Settings = lazyModule(() => import("./Settings"));
const SupplierLoans = lazyModule(() => import("./SupplierLoans"));
const AuctionSales = lazyModule(() => import("./AuctionSales"));
const FieldTools = lazyModule(() => import("./FieldTools"));
const EoRegisterSupplier = lazyModule(() => import("./ExtensionOfficer").then((module) => ({ default: module.EoRegisterSupplier })));
const EoWeighing = lazyModule(() => import("./ExtensionOfficer").then((module) => ({ default: module.EoWeighing })));
const SupplierAlerts = lazyModule(() => import("./SupplierPortal").then((module) => ({ default: module.SupplierAlerts })));
const SupplierPayments = lazyModule(() => import("./SupplierPortal").then((module) => ({ default: module.SupplierPayments })));
const SupplierDeliveries = lazyModule(() => import("./SupplierDeliveries"));
const FarmActivities = lazyModule(() => import("./FarmActivities").then((module) => ({ default: module.FarmActivities })));
const Announcements = lazyModule(() => import("./Announcements"));
const SupplierAnnouncements = lazyModule(() => import("./SupplierAnnouncements").then((module) => ({ default: module.SupplierAnnouncements })));
const SupplierRequestForm = lazyModule(() => import("./SupplierRequest").then((module) => ({ default: module.SupplierRequestForm })));
const ResourceRequests = lazyModule(() => import("./ResourceRequests").then((module) => ({ default: module.ResourceRequests })));
const SupplierEstates = lazyModule(() => import("./SupplierEstates"));
const SupplierWeather = lazyModule(() => import("./SupplierWeather").then((module) => ({ default: module.SupplierWeather })));
const SupplierTips = lazyModule(() => import("./SupplierTips").then((module) => ({ default: module.SupplierTips })));
const SupplierFertilizer = lazyModule(() => import("./SupplierFertilizer").then((module) => ({ default: module.SupplierFertilizer })));
const SupplierInsights = lazyModule(() => import("./SupplierInsights").then((module) => ({ default: module.SupplierInsights })));
const SupplierProfile = lazyModule(() => import("./SupplierProfile").then((module) => ({ default: module.SupplierProfile })));
const SupplierHome = lazyModule(() => import("./SupplierHome").then((module) => ({ default: module.SupplierHome })));
const SupplierCalendar = lazyModule(() => import("./SupplierCalendar"));
const SupplierLabor = lazyModule(() => import("./SupplierLabor").then((module) => ({ default: module.SupplierLabor })));
const OperationsCenter = lazyModule(() => import("./OperationsCenter"));
const SupplierSupport = lazyModule(() => import("./SupplierSupport"));

export const REGISTRY: Record<string, ComponentType> = {
  // Admin — executive dashboards, core ERP & administration
  dashboard: Dashboard,
  "estate-master": EstateMaster,
  labor: Labor,
  payroll: Payroll,
  loans: Loans,
  fertilizer: Fertilizer,
  agrochemical: Agrochemical,
  equipment: Equipment,
  "equipment-requests": EquipmentRequests,
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
  "operations-center": OperationsCenter,

  // Tea Industry — supplier loans + auction sales
  "supplier-loans": SupplierLoans,
  "auction-sales": AuctionSales,
  "field-tools": FieldTools,

  // Extension Officer — register suppliers + log weights
  "eo-register": EoRegisterSupplier,
  "eo-weighing": EoWeighing,

  // Supplier / VVIP — portal modules + resource requisitions
  "supplier-home": SupplierHome,
  "supplier-deliveries": SupplierDeliveries,
  "supplier-alerts": SupplierAlerts,
  "supplier-payments": SupplierPayments,
  "supplier-farm": FarmActivities,
  "supplier-announcements": SupplierAnnouncements,
  "supplier-requests": SupplierRequestForm,
  "supplier-plot": SupplierEstates,
  "supplier-weather": SupplierWeather,
  "supplier-tips": SupplierTips,
  "supplier-fertilizer": SupplierFertilizer,
  "supplier-insights": SupplierInsights,
  "supplier-profile": SupplierProfile,
  "supplier-calendar": SupplierCalendar,
  "supplier-labor": SupplierLabor,
  "supplier-support": SupplierSupport,

  // Admin — supplier resource requisition inbox (ticket management)
  "resource-requests": ResourceRequests,

  // Super Admin — branding & white-label settings
  settings: Settings,
};
