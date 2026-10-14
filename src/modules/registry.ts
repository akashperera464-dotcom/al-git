import { lazy, type ComponentType } from "react";
const Dashboard = lazy(() => import("./Dashboard"));
const EstateMaster = lazy(() => import("./EstateMaster"));
const Labor = lazy(() => import("./Labor"));
const Payroll = lazy(() => import("./Payroll"));
const Loans = lazy(() => import("./Loans"));
const Fertilizer = lazy(() => import("./Fertilizer"));
const Agrochemical = lazy(() => import("./Agrochemical"));
const Equipment = lazy(() => import("./Equipment"));
const EquipmentRequests = lazy(() => import("./EquipmentRequests"));
const Crop = lazy(() => import("./Crop"));
const Harvest = lazy(() => import("./Harvest"));
const Factory = lazy(() => import("./Factory"));
const Inventory = lazy(() => import("./Inventory"));
const Finance = lazy(() => import("./Finance"));
const Loyalty = lazy(() => import("./Loyalty"));
const Welfare = lazy(() => import("./Welfare"));
const GisMap = lazy(() => import("./GisMap"));
const Weather = lazy(() => import("./Weather"));
const Vehicles = lazy(() => import("./Vehicles"));
const MobileOffline = lazy(() => import("./MobileOffline"));
const AiAnalytics = lazy(() => import("./AiAnalytics"));
const AuditCompliance = lazy(() => import("./AuditCompliance"));
const Architecture = lazy(() => import("./Architecture"));
const UserManagement = lazy(() => import("./UserManagement"));
const Settings = lazy(() => import("./Settings"));
const SupplierLoans = lazy(() => import("./SupplierLoans"));
const AuctionSales = lazy(() => import("./AuctionSales"));
const FieldTools = lazy(() => import("./FieldTools"));
const EoRegisterSupplier = lazy(() => import("./ExtensionOfficer").then((module) => ({ default: module.EoRegisterSupplier })));
const EoWeighing = lazy(() => import("./ExtensionOfficer").then((module) => ({ default: module.EoWeighing })));
const SupplierAlerts = lazy(() => import("./SupplierPortal").then((module) => ({ default: module.SupplierAlerts })));
const SupplierPayments = lazy(() => import("./SupplierPortal").then((module) => ({ default: module.SupplierPayments })));
const SupplierDeliveries = lazy(() => import("./SupplierDeliveries"));
const FarmActivities = lazy(() => import("./FarmActivities").then((module) => ({ default: module.FarmActivities })));
const Announcements = lazy(() => import("./Announcements"));
const SupplierAnnouncements = lazy(() => import("./SupplierAnnouncements").then((module) => ({ default: module.SupplierAnnouncements })));
const SupplierRequestForm = lazy(() => import("./SupplierRequest").then((module) => ({ default: module.SupplierRequestForm })));
const ResourceRequests = lazy(() => import("./ResourceRequests").then((module) => ({ default: module.ResourceRequests })));
const SupplierEstates = lazy(() => import("./SupplierEstates"));
const SupplierWeather = lazy(() => import("./SupplierWeather").then((module) => ({ default: module.SupplierWeather })));
const SupplierTips = lazy(() => import("./SupplierTips").then((module) => ({ default: module.SupplierTips })));
const SupplierFertilizer = lazy(() => import("./SupplierFertilizer").then((module) => ({ default: module.SupplierFertilizer })));
const SupplierInsights = lazy(() => import("./SupplierInsights").then((module) => ({ default: module.SupplierInsights })));
const SupplierProfile = lazy(() => import("./SupplierProfile").then((module) => ({ default: module.SupplierProfile })));
const SupplierHome = lazy(() => import("./SupplierHome").then((module) => ({ default: module.SupplierHome })));
const SupplierCalendar = lazy(() => import("./SupplierCalendar"));
const SupplierLabor = lazy(() => import("./SupplierLabor").then((module) => ({ default: module.SupplierLabor })));
const OperationsCenter = lazy(() => import("./OperationsCenter"));
const SupplierSupport = lazy(() => import("./SupplierSupport"));

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
