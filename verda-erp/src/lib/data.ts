/**
 * Verda · Mock domain data + TypeScript models.
 * In production these shapes map 1:1 to Firestore collections (see docs/FIRESTORE_SCHEMA.md).
 * All values are illustrative for a Sri Lankan up-country tea estate.
 */

export type Role = "super_admin" | "admin" | "extension_officer" | "supplier";

/* ----------------------------- formatting ----------------------------- */
export const fmtNum = (n: number, d = 0): string =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const fmtLKR = (n: number): string => `Rs ${fmtNum(Math.round(n))}`;

export const fmtLKRShort = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `Rs ${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `Rs ${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `Rs ${(n / 1_000).toFixed(1)}K`;
  return `Rs ${fmtNum(n)}`;
};

export const fmtPct = (n: number, d = 0): string => `${n.toFixed(d)}%`;

export const TODAY = new Date();
export const TODAY_ISO = TODAY.toISOString().slice(0, 10);

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86400000).toISOString().slice(0, 10);
}

/* ----------------------------- estate hierarchy ----------------------------- */
export interface Block {
  id: string;
  code: string;
  areaHa: number;
}
export interface Field {
  id: string;
  code: string;
  name: string;
  cultivar: string;
  plantingYear: number;
  areaHa: number;
  elevationM: number;
  status: "plucking" | "pruned" | "young" | "nursery";
  lastYieldKg: number;
}
export interface Division {
  id: string;
  name: string;
  manager: string;
  areaHa: number;
  fields: Field[];
}
export interface Estate {
  id: string;
  name: string;
  region: string;
  totalAreaHa: number;
  elevationM: number;
  /** Interactive Google Maps embed (iframe src) link. */
  googleMapsEmbedUrl?: string;
  /** When the tea plants were planted → drives the pruning schedule engine. */
  plantedDate?: string;
  /** Per-estate coordinates → drive localized weather forecasting. */
  latitude?: number;
  longitude?: number;
  divisions: Division[];
}

/** A supplier GPS check-in (mirrors supplier_locations table). */
export interface SupplierLocation {
  id: string;
  userId: string;
  latitude: number;
  longitude: number;
  createdAt: string; // ISO timestamp
  deliveryId?: string | null;
}

/** A logged farm activity — closes the advisory feedback loop. */
export type FarmActivityType = "fertilizer" | "pruning" | "self_harvest";

export interface FarmActivity {
  id: string;
  userId: string;
  activityType: FarmActivityType;
  loggedDate: string; // ISO yyyy-mm-dd
  details: Record<string, unknown>; // dynamic payload (type, quantityKg, areaHa, field, estimatedKg, grade)
  createdAt: string;
}

export const estates: Estate[] = [
  {
    id: "est-glenview",
    name: "Glenview Estate",
    region: "Nuwara Eliya",
    totalAreaHa: 412,
    elevationM: 1890,
    divisions: [
      {
        id: "div-sutton",
        name: "Sutton Division",
        manager: "R. Kumara",
        areaHa: 138,
        fields: [
          { id: "fld-01", code: "S-01", name: "Sutton Upper", cultivar: "TRI 2025 (VP)", plantingYear: 2014, areaHa: 24, elevationM: 1920, status: "plucking", lastYieldKg: 18600 },
          { id: "fld-02", code: "S-02", name: "Sutton Lower", cultivar: "TRI 2023 (VP)", plantingYear: 2011, areaHa: 31, elevationM: 1870, status: "plucking", lastYieldKg: 22400 },
          { id: "fld-03", code: "S-03", name: "Camellia Bank", cultivar: "Seedling", plantingYear: 1996, areaHa: 18, elevationM: 1905, status: "pruned", lastYieldKg: 9800 },
        ],
      },
      {
        id: "div-craighead",
        name: "Craighead Division",
        manager: "M. Fernando",
        areaHa: 154,
        fields: [
          { id: "fld-04", code: "C-01", name: "Craighead East", cultivar: "TRI 2025 (VP)", plantingYear: 2016, areaHa: 42, elevationM: 1850, status: "plucking", lastYieldKg: 31200 },
          { id: "fld-05", code: "C-02", name: "Mist Valley", cultivar: "TRI 4072", plantingYear: 2009, areaHa: 27, elevationM: 1810, status: "plucking", lastYieldKg: 17600 },
          { id: "fld-06", code: "C-03", name: "Oak Ridge", cultivar: "Seedling", plantingYear: 1992, areaHa: 22, elevationM: 1880, status: "young", lastYieldKg: 2100 },
        ],
      },
      {
        id: "div-tennant",
        name: "Tennant Division",
        manager: "S. Perera",
        areaHa: 120,
        fields: [
          { id: "fld-07", code: "T-01", name: "Tennant Peak", cultivar: "TRI 2023 (VP)", plantingYear: 2018, areaHa: 36, elevationM: 1960, status: "plucking", lastYieldKg: 25800 },
          { id: "fld-08", code: "T-02", name: "Cloud Walk", cultivar: "TRI 2025 (VP)", plantingYear: 2013, areaHa: 29, elevationM: 1930, status: "plucking", lastYieldKg: 21400 },
          { id: "fld-09", code: "T-03", name: "Springs Nursery", cultivar: "Nursery", plantingYear: 2024, areaHa: 8, elevationM: 1950, status: "nursery", lastYieldKg: 0 },
        ],
      },
    ],
  },
];

export const allFields: Field[] = estates.flatMap((e) => e.divisions.flatMap((d) => d.fields));

/* ----------------------------- labor ----------------------------- */
export interface Worker {
  id: string;
  name: string;
  nic: string;
  division: string;
  role: "Plucker" | "Factory Hand" | "Field Worker" | "Kangany" | "Sprayer";
  bankAccount: string;
  pointsBalance: number;
  attendance30d: number;
  avgKgPerDay: number;
  present: boolean;
}

export const workers: Worker[] = [
  { id: "w-001", name: "K. Maheshwaran", nic: "199032501234", division: "Sutton", role: "Plucker", bankAccount: "BOA-8842110", pointsBalance: 1240, attendance30d: 27, avgKgPerDay: 22.4, present: true },
  { id: "w-002", name: "P. Saraswathi", nic: "198854103287", division: "Craighead", role: "Plucker", bankAccount: "BOA-1190233", pointsBalance: 2110, attendance30d: 29, avgKgPerDay: 24.8, present: true },
  { id: "w-003", name: "T. Ramesh", nic: "199512098871", division: "Tennant", role: "Field Worker", bankAccount: "COM-5520194", pointsBalance: 640, attendance30d: 24, avgKgPerDay: 0, present: true },
  { id: "w-004", name: "L. Priya", nic: "199722057712", division: "Sutton", role: "Plucker", bankAccount: "BOA-3390120", pointsBalance: 980, attendance30d: 26, avgKgPerDay: 19.6, present: false },
  { id: "w-005", name: "D. Anand", nic: "198971145096", division: "Craighead", role: "Sprayer", bankAccount: "HNB-7782001", pointsBalance: 420, attendance30d: 22, avgKgPerDay: 0, present: true },
  { id: "w-006", name: "S. Kamala", nic: "199339871002", division: "Tennant", role: "Plucker", bankAccount: "BOA-9912847", pointsBalance: 1750, attendance30d: 28, avgKgPerDay: 23.1, present: true },
  { id: "w-007", name: "V. Suresh", nic: "200011849503", division: "Craighead", role: "Factory Hand", bankAccount: "COM-1102938", pointsBalance: 530, attendance30d: 25, avgKgPerDay: 0, present: true },
  { id: "w-008", name: "M. Lakshmi", nic: "198619003425", division: "Sutton", role: "Kangany", bankAccount: "BOA-6620194", pointsBalance: 2380, attendance30d: 30, avgKgPerDay: 0, present: true },
];

/* ----------------------------- payroll ----------------------------- */
export interface PayrollRow {
  id: string;
  name: string;
  days: number;
  dailyWage: number;
  otHours: number;
  otPay: number;
  kgPlucked: number;
  incentive: number;
  deductions: number;
  netPay: number;
}
export const payrollRows: PayrollRow[] = workers.map((w, i) => {
  const days = w.attendance30d;
  const otHours = [6, 9, 0, 4, 0, 8, 2, 0][i] ?? 0;
  const otPay = otHours * 145;
  const incentive = w.role === "Plucker" ? Math.max(0, (w.avgKgPerDay - 18) * 12 * days) : 0;
  const gross = days * 1700 + otPay + incentive;
  const deductions = Math.round(gross * 0.08 + 1500);
  return {
    id: w.id,
    name: w.name,
    days,
    dailyWage: 1700,
    otHours,
    otPay,
    kgPlucked: Math.round(w.avgKgPerDay * days),
    incentive: Math.round(incentive),
    deductions,
    netPay: gross - deductions,
  };
});

export const payrollTotals = {
  gross: payrollRows.reduce((s, r) => s + r.days * r.dailyWage + r.otPay + r.incentive, 0),
  epfEmployee: 0,
  epfEmployer: 0,
  etfEmployer: 0,
  net: payrollRows.reduce((s, r) => s + r.netPay, 0),
};
payrollTotals.epfEmployee = Math.round(payrollTotals.gross * 0.08);
payrollTotals.epfEmployer = Math.round(payrollTotals.gross * 0.12);
payrollTotals.etfEmployer = Math.round(payrollTotals.gross * 0.03);

/* ----------------------------- loans ----------------------------- */
export interface Loan {
  id: string;
  worker: string;
  type: "Festival Advance" | "Personal" | "Emergency" | "Salary Advance";
  principal: number;
  balance: number;
  monthlyDeduction: number;
  dueDate: string;
  status: "on-track" | "overdue" | "cleared";
}
export const loans: Loan[] = [
  { id: "ln-01", worker: "K. Maheshwaran", type: "Festival Advance", principal: 25000, balance: 8200, monthlyDeduction: 2500, dueDate: addDays(TODAY_ISO, 96), status: "on-track" },
  { id: "ln-02", worker: "P. Saraswathi", type: "Personal", principal: 60000, balance: 41500, monthlyDeduction: 4000, dueDate: addDays(TODAY_ISO, -4), status: "overdue" },
  { id: "ln-03", worker: "T. Ramesh", type: "Emergency", principal: 18000, balance: 18000, monthlyDeduction: 2000, dueDate: addDays(TODAY_ISO, 12), status: "on-track" },
  { id: "ln-04", worker: "L. Priya", type: "Salary Advance", principal: 12000, balance: 3000, monthlyDeduction: 1500, dueDate: addDays(TODAY_ISO, 30), status: "on-track" },
  { id: "ln-05", worker: "S. Kamala", type: "Festival Advance", principal: 30000, balance: 22400, monthlyDeduction: 3000, dueDate: addDays(TODAY_ISO, -9), status: "overdue" },
  { id: "ln-06", worker: "M. Lakshmi", type: "Personal", principal: 45000, balance: 0, monthlyDeduction: 0, dueDate: addDays(TODAY_ISO, -40), status: "cleared" },
];

/* ----------------------------- fertilizer ----------------------------- */
export interface FertStock {
  id: string;
  name: string;
  type: string;
  onHandKg: number;
  reorderKg: number;
  costPerKg: number;
  units: string;
}
export const fertilizerStock: FertStock[] = [
  { id: "ft-urea", name: "Urea (46% N)", type: "Nitrogen", onHandKg: 4200, reorderKg: 3000, costPerKg: 165, units: "kg" },
  { id: "ft-mop", name: "MOP (Potash)", type: "Potassium", onHandKg: 1850, reorderKg: 2500, costPerKg: 290, units: "kg" },
  { id: "ft-tsp", name: "TSP (Phosphate)", type: "Phosphorus", onHandKg: 3100, reorderKg: 2000, costPerKg: 240, units: "kg" },
  { id: "ft-dol", name: "Dolomite", type: "pH Conditioner", onHandKg: 5400, reorderKg: 4000, costPerKg: 55, units: "kg" },
  { id: "ft-org", name: "Organic Compost", type: "Organic", onHandKg: 9800, reorderKg: 6000, costPerKg: 38, units: "kg" },
];

export interface FertLog {
  id: string;
  date: string;
  field: string;
  product: string;
  qtyKg: number;
  costPerHa: number;
  appliedBy: string;
}
export const fertilizerLogs: FertLog[] = [
  { id: "fl-1", date: addDays(TODAY_ISO, -2), field: "Sutton Upper (S-01)", product: "Urea (46% N)", qtyKg: 540, costPerHa: 3712, appliedBy: "D. Anand" },
  { id: "fl-2", date: addDays(TODAY_ISO, -5), field: "Craighead East (C-01)", product: "MOP (Potash)", qtyKg: 320, costPerHa: 2213, appliedBy: "D. Anand" },
  { id: "fl-3", date: addDays(TODAY_ISO, -9), field: "Mist Valley (C-02)", product: "Organic Compost", qtyKg: 1200, costPerHa: 1690, appliedBy: "T. Ramesh" },
  { id: "fl-4", date: addDays(TODAY_ISO, -14), field: "Tennant Peak (T-01)", product: "TSP (Phosphate)", qtyKg: 260, costPerHa: 1733, appliedBy: "D. Anand" },
];

/* ----------------------------- agrochemical ----------------------------- */
export interface AgroItem {
  id: string;
  name: string;
  category: "Herbicide" | "Pesticide" | "Fungicide" | "Foliar";
  onHand: string;
  nextSpray: string;
  certified: boolean;
}
export const agroItems: AgroItem[] = [
  { id: "ag-1", name: "Glyphosate 360", category: "Herbicide", onHand: "42 L", nextSpray: addDays(TODAY_ISO, 6), certified: true },
  { id: "ag-2", name: "Mancozeb 75% WP", category: "Fungicide", onHand: "18 kg", nextSpray: addDays(TODAY_ISO, 11), certified: true },
  { id: "ag-3", name: "Sulphur WP", category: "Foliar", onHand: "30 kg", nextSpray: addDays(TODAY_ISO, 3), certified: true },
  { id: "ag-4", name: "Neem-based EC", category: "Pesticide", onHand: "9 L", nextSpray: addDays(TODAY_ISO, 18), certified: true },
  { id: "ag-5", name: "Paraquat (restricted)", category: "Herbicide", onHand: "0 L", nextSpray: "—", certified: false },
];

export interface AgroAudit {
  id: string;
  date: string;
  operator: string;
  product: string;
  field: string;
  dose: string;
  reason: string;
}
export const agroAudit: AgroAudit[] = [
  { id: "au-1", date: addDays(TODAY_ISO, -2), operator: "D. Anand", product: "Mancozeb 75% WP", field: "Camellia Bank (S-03)", dose: "2.5 g/L", reason: "Blister blight prevention" },
  { id: "au-2", date: addDays(TODAY_ISO, -6), operator: "D. Anand", product: "Glyphosate 360", field: "Oak Ridge (C-03)", dose: "1.5 L/ha", reason: "Post-emergent weed control" },
  { id: "au-3", date: addDays(TODAY_ISO, -10), operator: "T. Ramesh", product: "Sulphur WP", field: "Mist Valley (C-02)", dose: "400 g/ha", reason: "Mite suppression (IPM)" },
];

/* ----------------------------- crop management ----------------------------- */
export interface CropTask {
  id: string;
  activity: "Pruning" | "Weeding" | "Tipping" | "Skiffing" | "Plucking";
  field: string;
  due: string;
  status: "done" | "in-progress" | "scheduled";
  cycle: string;
}
export const cropTasks: CropTask[] = [
  { id: "ct-1", activity: "Plucking", field: "Craighead East (C-01)", due: TODAY_ISO, status: "in-progress", cycle: "7-day round" },
  { id: "ct-2", activity: "Pruning", field: "Camellia Bank (S-03)", due: addDays(TODAY_ISO, 4), status: "scheduled", cycle: "4-year cycle" },
  { id: "ct-3", activity: "Weeding", field: "Oak Ridge (C-03)", due: addDays(TODAY_ISO, 1), status: "scheduled", cycle: "Monthly" },
  { id: "ct-4", activity: "Tipping", field: "Springs Nursery (T-03)", due: addDays(TODAY_ISO, -3), status: "done", cycle: "Formative" },
  { id: "ct-5", activity: "Skiffing", field: "Mist Valley (C-02)", due: addDays(TODAY_ISO, 8), status: "scheduled", cycle: "Mid-season" },
];

/* ----------------------------- harvest ----------------------------- */
export interface HarvestRecord {
  id: string;
  time: string;
  center: string;
  worker: string;
  field: string;
  grossKg: number;
  deductionKg: number;
  netKg: number;
  grade: "Super" | "Standard" | "Coarse";
}
export const harvestRecords: HarvestRecord[] = [
  { id: "hr-1", time: "06:42", center: "Sutton CC", worker: "K. Maheshwaran", field: "S-01", grossKg: 24.6, deductionKg: 1.1, netKg: 23.5, grade: "Super" },
  { id: "hr-2", time: "07:05", center: "Craighead CC", worker: "P. Saraswathi", field: "C-01", grossKg: 28.2, deductionKg: 0.8, netKg: 27.4, grade: "Super" },
  { id: "hr-3", time: "07:21", center: "Tennant CC", worker: "S. Kamala", field: "T-01", grossKg: 21.4, deductionKg: 2.3, netKg: 19.1, grade: "Standard" },
  { id: "hr-4", time: "07:48", center: "Sutton CC", worker: "M. Lakshmi", field: "S-02", grossKg: 26.0, deductionKg: 1.4, netKg: 24.6, grade: "Super" },
  { id: "hr-5", time: "08:10", center: "Craighead CC", worker: "L. Priya", field: "C-02", grossKg: 18.9, deductionKg: 2.8, netKg: 16.1, grade: "Coarse" },
  { id: "hr-6", time: "08:33", center: "Tennant CC", worker: "T. Ramesh", field: "T-02", grossKg: 22.7, deductionKg: 1.0, netKg: 21.7, grade: "Standard" },
];

/* ----------------------------- factory ----------------------------- */
export interface TeaGrade {
  code: string;
  name: string;
  kg: number;
  pricePerKg: number;
}
export const teaGrades: TeaGrade[] = [
  { code: "OP", name: "Orange Pekoe", kg: 1840, pricePerKg: 1450 },
  { code: "BOP", name: "Broken Orange Pekoe", kg: 3620, pricePerKg: 1180 },
  { code: "PEK", name: "Pekoe", kg: 920, pricePerKg: 1620 },
  { code: "BOPF", name: "BOP Fannings", kg: 2480, pricePerKg: 980 },
  { code: "DUST", name: "Dust", kg: 1340, pricePerKg: 760 },
];
export const factorySummary = {
  greenLeafInKg: 45300,
  madeTeaKg: teaGrades.reduce((s, g) => s + g.kg, 0),
  wasteKg: 0,
  drierMonthRevenue: 0,
};
factorySummary.wasteKg = Math.round(factorySummary.greenLeafInKg * 0.022);
factorySummary.drierMonthRevenue = teaGrades.reduce((s, g) => s + g.kg * g.pricePerKg, 0);

/* ----------------------------- inventory ----------------------------- */
export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  qty: string;
  location: string;
  qr: string;
}
export const inventoryItems: InventoryItem[] = [
  { id: "iv-1", name: "Plucking Basket (40L)", category: "Field Gear", qty: "320 units", location: "Stores A", qr: "QR-IV-001" },
  { id: "iv-2", name: "Pruning Knife (Siccateur)", category: "Tools", qty: "180 units", location: "Stores A", qr: "QR-IV-002" },
  { id: "iv-3", name: "Rain Coat (Heavy)", category: "Welfare", qty: "540 units", location: "Stores B", qr: "QR-IV-003" },
  { id: "iv-4", name: "Sprayer Knapsack (16L)", category: "Equipment", qty: "48 units", location: "Stores C", qr: "QR-IV-004" },
  { id: "iv-5", name: "Weighing Scale (Digital)", category: "Equipment", qty: "12 units", location: "Collection Centers", qr: "QR-IV-005" },
  { id: "iv-6", name: "Safety Goggles", category: "PPE", qty: "600 units", location: "Stores B", qr: "QR-IV-006" },
];

/* ----------------------------- finance ----------------------------- */
export interface LedgerRow {
  account: string;
  type: "Revenue" | "Expense" | "Asset" | "Liability";
  debit: number;
  credit: number;
}
export const ledgerRows: LedgerRow[] = [
  { account: "Green Leaf Sales", type: "Revenue", debit: 0, credit: 18420000 },
  { account: "Made Tea Revenue", type: "Revenue", debit: 0, credit: 31480000 },
  { account: "Wages & EPF/ETF", type: "Expense", debit: 9120000, credit: 0 },
  { account: "Fertilizer & Agrochem", type: "Expense", debit: 2840000, credit: 0 },
  { account: "Fuel & Transport", type: "Expense", debit: 1180000, credit: 0 },
  { account: "Factory Utilities", type: "Expense", debit: 1960000, credit: 0 },
  { account: "Accounts Receivable", type: "Asset", debit: 6240000, credit: 0 },
  { account: "Supplier Payable", type: "Liability", debit: 0, credit: 3820000 },
];

export const financeSummary = {
  revenue: ledgerRows.filter((r) => r.type === "Revenue").reduce((s, r) => s + r.credit, 0),
  opex: ledgerRows.filter((r) => r.type === "Expense").reduce((s, r) => s + r.debit, 0),
  receivable: ledgerRows.find((r) => r.account === "Accounts Receivable")?.debit ?? 0,
  payable: ledgerRows.find((r) => r.account === "Supplier Payable")?.credit ?? 0,
};

/* ----------------------------- loyalty ----------------------------- */
export interface LoyaltyMember {
  rank: number;
  name: string;
  points: number;
  tier: "Bronze" | "Silver" | "Gold" | "Platinum";
  streakDays: number;
  badge: string;
}
export const loyaltyMembers: LoyaltyMember[] = [
  { rank: 1, name: "M. Lakshmi", points: 2380, tier: "Platinum", streakDays: 30, badge: "Iron Plucker" },
  { rank: 2, name: "P. Saraswathi", points: 2110, tier: "Gold", streakDays: 29, badge: "Top Flush" },
  { rank: 3, name: "S. Kamala", points: 1750, tier: "Gold", streakDays: 28, badge: "Steady Hand" },
  { rank: 4, name: "K. Maheshwaran", points: 1240, tier: "Silver", streakDays: 27, badge: "Early Bird" },
  { rank: 5, name: "L. Priya", points: 980, tier: "Silver", streakDays: 26, badge: "Quality Keeper" },
  { rank: 6, name: "V. Suresh", points: 530, tier: "Bronze", streakDays: 25, badge: "Rookie" },
];

/* ----------------------------- welfare ----------------------------- */
export interface WelfareUnit {
  id: string;
  block: string;
  families: number;
  condition: "Good" | "Needs Repair" | "Priority";
}
export const welfareUnits: WelfareUnit[] = [
  { id: "wu-1", block: "Line Room Block A", families: 24, condition: "Good" },
  { id: "wu-2", block: "Line Room Block B", families: 30, condition: "Needs Repair" },
  { id: "wu-3", block: "Family Quarters C", families: 18, condition: "Good" },
  { id: "wu-4", block: "Line Room Block D", families: 26, condition: "Priority" },
];
export interface WelfareCase {
  id: string;
  type: "Clinic Visit" | "Scholarship" | "Maternity";
  person: string;
  detail: string;
  date: string;
  status: "open" | "settled";
}
export const welfareCases: WelfareCase[] = [
  { id: "wc-1", type: "Clinic Visit", person: "Child of w-002", detail: "Routine immunisation", date: addDays(TODAY_ISO, -1), status: "settled" },
  { id: "wc-2", type: "Scholarship", person: " Daughter of w-008", detail: "Grade 5 scholarship — Rs 25,000", date: addDays(TODAY_ISO, 7), status: "open" },
  { id: "wc-3", type: "Maternity", person: "w-004", detail: "Maternity leave entitlement processed", date: addDays(TODAY_ISO, -12), status: "open" },
];

/* ----------------------------- vehicles ----------------------------- */
export interface Vehicle {
  id: string;
  reg: string;
  type: string;
  driver: string;
  km: number;
  fuelL: number;
  lastService: string;
  status: "active" | "idle" | "service";
}
export const vehicles: Vehicle[] = [
  { id: "v-1", reg: "NB-4587", type: "Lorry (Green Leaf)", driver: "N. Bandara", km: 184200, fuelL: 28, lastService: addDays(TODAY_ISO, -22), status: "active" },
  { id: "v-2", reg: "NB-3190", type: "Tractor (Massey)", driver: "H. Silva", km: 96400, fuelL: 14, lastService: addDays(TODAY_ISO, -8), status: "active" },
  { id: "v-3", reg: "NB-7721", type: "Lorry (Made Tea)", driver: "C. Jayasuriya", km: 211800, fuelL: 0, lastService: addDays(TODAY_ISO, -3), status: "service" },
  { id: "v-4", reg: "NB-9001", type: "Pickup (Supervisor)", driver: "R. Kumara", km: 64200, fuelL: 22, lastService: addDays(TODAY_ISO, -40), status: "idle" },
];
export interface FuelLog {
  id: string;
  date: string;
  vehicle: string;
  litres: number;
  cost: number;
  slip: string;
}
export const fuelLogs: FuelLog[] = [
  { id: "fl-1", date: addDays(TODAY_ISO, -1), vehicle: "NB-4587", litres: 80, cost: 17600, slip: "CEYPETCO-5521" },
  { id: "fl-2", date: addDays(TODAY_ISO, -2), vehicle: "NB-3190", litres: 45, cost: 9900, slip: "CEYPETCO-5520" },
  { id: "fl-3", date: addDays(TODAY_ISO, -3), vehicle: "NB-9001", litres: 38, cost: 8360, slip: "LANKA-3390" },
];

/* ----------------------------- weather ----------------------------- */
export interface WeatherDay {
  date: string;
  dayName: string;
  tempMax: number;
  tempMin: number;
  rainMm: number;
  rainProb: number;
  windKph: number;
  condition: string;
  icon: string;
}
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const weather7: WeatherDay[] = Array.from({ length: 7 }).map((_, i) => {
  const d = addDays(TODAY_ISO, i);
  const dt = new Date(d);
  const rain = [4, 14, 22, 58, 31, 6, 2][i];
  const cond =
    rain >= 50 ? "Heavy Rain" : rain >= 20 ? "Showers" : rain >= 8 ? "Light Rain" : rain >= 3 ? "Cloudy" : "Sunny";
  return {
    date: d,
    dayName: dayNames[dt.getDay()],
    tempMax: [22, 21, 19, 18, 20, 23, 24][i],
    tempMin: [12, 12, 11, 10, 11, 12, 13][i],
    rainMm: rain,
    rainProb: [25, 55, 70, 92, 78, 30, 10][i],
    windKph: [14, 22, 28, 38, 31, 18, 12][i],
    condition: cond,
    icon: rain >= 50 ? "CloudRain" : rain >= 8 ? "CloudDrizzle" : rain >= 3 ? "Cloud" : "Sun",
  };
});

export const currentWeather = {
  temp: 21,
  feels: 20,
  humidity: 78,
  wind: 14,
  condition: "Partly Cloudy",
  icon: "CloudSun",
  rainTodayMm: 4,
};

export const rainfallHistory = [186, 142, 98, 76, 64, 122, 214, 268, 241, 198, 176, 152];

/* ----------------------------- compliance ----------------------------- */
export interface ComplianceItem {
  id: string;
  standard: string;
  status: "Certified" | "In Audit" | "Action Needed";
  score: number;
  expiry: string;
}
export const complianceItems: ComplianceItem[] = [
  { id: "cp-1", standard: "Rainforest Alliance", status: "Certified", score: 94, expiry: addDays(TODAY_ISO, 220) },
  { id: "cp-2", standard: "Fairtrade International", status: "Certified", score: 91, expiry: addDays(TODAY_ISO, 168) },
  { id: "cp-3", standard: "ISO 22000 (Food Safety)", status: "In Audit", score: 86, expiry: addDays(TODAY_ISO, 45) },
  { id: "cp-4", standard: "Ethical Tea Partnership", status: "Action Needed", score: 72, expiry: addDays(TODAY_ISO, 18) },
];

/* ----------------------------- supplier (VVIP) ----------------------------- */
export interface SupplierProfile {
  id: string;
  name: string;
  phone: string;
  village: string;
  totalSuppliedKg: number;
  lastSupplyKg: number;
  lastSupplyDate: string;
  lastFertilizerDate: string;
  cropStage: "nursery" | "young" | "plucking" | "pruned";
  cultivar: string;
  soilMoisturePct: number;
  tier: "VVIP Gold" | "VVIP Platinum";
  pricePerKg: number;
  outstandingPayable: number;
}
export const supplier: SupplierProfile = {
  id: "sup-001",
  name: "Sumithra Green Leaf Co.",
  phone: "+94 77 412 8890",
  village: "Ragala, Walapane",
  totalSuppliedKg: 6420,
  lastSupplyKg: 1280,
  lastSupplyDate: addDays(TODAY_ISO, -96),
  lastFertilizerDate: addDays(TODAY_ISO, -118),
  cropStage: "plucking",
  cultivar: "TRI 2025 (VP)",
  soilMoisturePct: 54,
  tier: "VVIP Platinum",
  pricePerKg: 165,
  outstandingPayable: 211200,
};

export interface SupplyRecord {
  id: string;
  supplierId: string; // OWNERSHIP KEY — reads must always filter on this
  estateId: string; // ASSOCIATION KEY — scopes the record to a specific estate
  date: string;
  kg: number;
  grade: string;
  amount: number;
  status: "Paid" | "Pending";
}
export const supplyHistory: SupplyRecord[] = [
  // ── sup-001 · Sumithra Green Leaf Co. (the signed-in demo supplier) · Glenview ──
  { id: "sh-1", supplierId: "sup-001", estateId: "est-glenview", date: addDays(TODAY_ISO, -96), kg: 1280, grade: "Super", amount: 211200, status: "Paid" },
  { id: "sh-2", supplierId: "sup-001", estateId: "est-glenview", date: addDays(TODAY_ISO, -127), kg: 980, grade: "Standard", amount: 147000, status: "Paid" },
  { id: "sh-3", supplierId: "sup-001", estateId: "est-glenview", date: addDays(TODAY_ISO, -158), kg: 1340, grade: "Super", amount: 221100, status: "Paid" },
  { id: "sh-4", supplierId: "sup-001", estateId: "est-glenview", date: addDays(TODAY_ISO, -14), kg: 1620, grade: "Super", amount: 267300, status: "Pending" },
  // ── sup-002 · Hillcrest Leaf Suppliers (MUST NEVER be visible to sup-001) ──
  { id: "sh-5", supplierId: "sup-002", estateId: "est-glenview", date: addDays(TODAY_ISO, -8), kg: 940, grade: "Standard", amount: 141000, status: "Paid" },
  { id: "sh-6", supplierId: "sup-002", estateId: "est-glenview", date: addDays(TODAY_ISO, -41), kg: 1110, grade: "Super", amount: 183150, status: "Pending" },
];

/* ----------------------------- plucking fields (engine input) ----------------------------- */
import type { PluckField } from "./predictive";
export const pluckFields: PluckField[] = [
  { id: "fld-04", name: "Craighead East", division: "Craighead", cultivar: "TRI 2025 (VP)", areaHa: 42, daysSinceLastPluck: 8, cycleDays: 7, avgShootLengthCm: 9.2, qualityGrade: "BOP/OP" },
  { id: "fld-02", name: "Sutton Lower", division: "Sutton", cultivar: "TRI 2023 (VP)", areaHa: 31, daysSinceLastPluck: 7, cycleDays: 7, avgShootLengthCm: 8.4, qualityGrade: "BOP" },
  { id: "fld-07", name: "Tennant Peak", division: "Tennant", cultivar: "TRI 2023 (VP)", areaHa: 36, daysSinceLastPluck: 9, cycleDays: 7, avgShootLengthCm: 8.8, qualityGrade: "OP" },
  { id: "fld-01", name: "Sutton Upper", division: "Sutton", cultivar: "TRI 2025 (VP)", areaHa: 24, daysSinceLastPluck: 5, cycleDays: 7, avgShootLengthCm: 6.1, qualityGrade: "BOP" },
  { id: "fld-05", name: "Mist Valley", division: "Craighead", cultivar: "TRI 4072", areaHa: 27, daysSinceLastPluck: 6, cycleDays: 8, avgShootLengthCm: 7.0, qualityGrade: "PEK" },
];

/* ----------------------------- activity / alerts ----------------------------- */
export interface ActivityItem {
  id: string;
  icon: string;
  title: string;
  meta: string;
  time: string;
  tone: "emerald" | "amber" | "rose" | "sky" | "violet";
}
export const activities: ActivityItem[] = [
  { id: "a1", icon: "Scale", title: "Weigh-in logged · Craighead CC", meta: "P. Saraswathi · 27.4 kg net · Super", time: "2m ago", tone: "emerald" },
  { id: "a2", icon: "Truck", title: "Green leaf dispatched to factory", meta: "NB-4587 · 4,820 kg · 06:55", time: "12m ago", tone: "sky" },
  { id: "a3", icon: "AlertTriangle", title: "Loan overdue flag raised", meta: "P. Saraswathi · Personal · 4 days", time: "38m ago", tone: "rose" },
  { id: "a4", icon: "Droplets", title: "Fertilizer applied · Sutton Upper", meta: "Urea 540 kg · Rs 3,712/ha", time: "1h ago", tone: "amber" },
  { id: "a5", icon: "Trophy", title: "Loyalty tier upgrade", meta: "S. Kamala → Gold · +1,750 pts", time: "3h ago", tone: "violet" },
];

/* ----------------------------- dashboard KPI roll-up ----------------------------- */
export const dashboardKpis = {
  harvestTodayKg: harvestRecords.reduce((s, r) => s + r.netKg, 0) * 210,
  monthTargetKg: 410000,
  monthAchievedPct: 87,
  activeWorkers: 1284,
  workforceTotal: 1412,
  outstandingLoans: loans.reduce((s, l) => s + l.balance, 0),
  fertilizerStockValue: fertilizerStock.reduce((s, f) => s + f.onHandKg * f.costPerKg, 0),
  revenueMTD: financeSummary.revenue / 12,
  pestAlerts: 1,
};

export const harvestTrend = Array.from({ length: 14 }).map((_, i) => ({
  day: `D${i + 1}`,
  kg: Math.round(11800 + Math.sin(i / 2) * 2400 + i * 180 + (i % 3 === 0 ? 900 : 0)),
  target: 13200,
}));

export const divisionPerformance = estates[0].divisions.map((d) => ({
  name: d.name.replace(" Division", ""),
  kg: d.fields.reduce((s, f) => s + f.lastYieldKg, 0),
  target: d.areaHa * 540,
}));

/* ----------------------------- user management (admin CRUD) ----------------------------- */
export interface ManagedUser {
  id: string;
  name: string;
  email?: string;
  role: Role;
  phone?: string;
  division?: string;
  village?: string;
  tier?: string;
  /** Estate this user is scoped to (suppliers → their linked estate id). */
  associatedEntityId?: string;
  status: "active" | "suspended";
  lastActive: string;
}
export const managedUsers: ManagedUser[] = [
  { id: "uid-superadmin-001", name: "Akash Perera", email: "akashperera@kdu.com", role: "super_admin", status: "active", lastActive: "online" },
  { id: "u-1", name: "Ruwan Kumara", email: "ruwan.kumara@kdu.com", role: "extension_officer", phone: "+94 77 220 1180", division: "Sutton", status: "active", lastActive: "2m ago" },
  { id: "u-2", name: "Menuka Fernando", email: "menuka.fernando@kdu.com", role: "extension_officer", phone: "+94 71 552 0098", division: "Craighead", status: "active", lastActive: "14m ago" },
  { id: "u-3", name: "Saman Perera", email: "saman.perera@kdu.com", role: "extension_officer", phone: "+94 76 889 4412", division: "Tennant", status: "suspended", lastActive: "3d ago" },
  // Suppliers use their Auth uid (matches suppliers/{uid}); each is linked to an estate.
  { id: "sup-001", name: "Sumithra Green Leaf Co.", email: "sumithra@kdu.com", role: "supplier", phone: "+94 77 412 8890", village: "Ragala, Walapane", tier: "VVIP Platinum", associatedEntityId: "est-glenview", status: "active", lastActive: "1h ago" },
  { id: "sup-002", name: "Hillcrest Leaf Suppliers", email: "hillcrest@kdu.com", role: "supplier", phone: "+94 75 661 7733", village: "Hatton", tier: "VVIP Gold", associatedEntityId: "est-glenview", status: "active", lastActive: "5h ago" },
  { id: "sup-003", name: "Nuwara Cultivators", role: "supplier", phone: "+94 78 330 5521", village: "Nuwara Eliya", tier: "VVIP Gold", associatedEntityId: "est-glenview", status: "suspended", lastActive: "8d ago" },
];

/**
 * Demo: maps the signed-in supplier's uid → the estate they are associated with.
 * In production this is read from users/{uid}.associatedEntityId after auth.
 * Used by AppContext to scope the supplier's portal reads.
 */
export const SUPPLIER_ENTITY_MAP: Record<string, string> = {
  sup_001: "est-glenview",
  "sup-001": "est-glenview",
  "sup-002": "est-glenview",
  "sup-003": "est-glenview",
};

/* ----------------------------- daily work allocation (supervisor) ----------------------------- */
export interface WorkAllocation {
  id: string;
  field: string;
  division: string;
  task: string;
  crewSize: number;
  targetKg: number;
  status: "assigned" | "open" | "in-progress";
}
export const workAllocations: WorkAllocation[] = [
  { id: "wa-1", field: "Sutton Upper (S-01)", division: "Sutton", task: "Plucking — 7-day round", crewSize: 14, targetKg: 310, status: "in-progress" },
  { id: "wa-2", field: "Sutton Lower (S-02)", division: "Sutton", task: "Plucking — 7-day round", crewSize: 18, targetKg: 420, status: "assigned" },
  { id: "wa-3", field: "Camellia Bank (S-03)", division: "Sutton", task: "Weeding", crewSize: 0, targetKg: 0, status: "open" },
  { id: "wa-4", field: "Oak Ridge (C-03)", division: "Craighead", task: "Skiffing", crewSize: 0, targetKg: 0, status: "open" },
  { id: "wa-5", field: "Springs Nursery (T-03)", division: "Tennant", task: "Tipping", crewSize: 4, targetKg: 0, status: "assigned" },
];

/* ----------------------------- resource requisitions ----------------------------- */
export type RequestType = "Workers" | "Equipment";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * Maps 1:1 to the Firestore `resource_requests/{id}` document.
 * Created by Suppliers, decided by Admins.
 */
export interface ResourceRequest {
  id: string;
  supplierId: string;
  supplierName: string;
  type: RequestType;
  itemDetails: string;
  quantity: number;
  dateNeeded: string; // ISO yyyy-mm-ddThh:mm
  durationDays: number;
  note: string;
  status: RequestStatus;
  adminNotes: string;
  timestamp: number;
}

/** Equipment available for requisition (cross-referenced from inventory_items). */
export const equipmentCatalog: { id: string; name: string; category: string; pool: number }[] = [
  { id: "eq-sprayer", name: "Knapsack Sprayer (16L)", category: "Spraying", pool: 48 },
  { id: "eq-basket", name: "Plucking Basket (40L)", category: "Harvesting", pool: 320 },
  { id: "eq-shears", name: "Pruning Shears (Siccateur)", category: "Pruning", pool: 180 },
  { id: "eq-cutter", name: "Power Cutter (Panna Machine)", category: "Pruning", pool: 14 },
  { id: "eq-scale", name: "Digital Weighing Scale", category: "Harvesting", pool: 12 },
  { id: "eq-tractor", name: "Tractor (Massey Ferguson)", category: "Transport", pool: 3 },
  { id: "eq-lorry", name: "Green Leaf Lorry", category: "Transport", pool: 2 },
  { id: "eq-pickup", name: "Supervisor Pickup", category: "Transport", pool: 1 },
  { id: "eq-trolley", name: "Leaf Collection Trolley", category: "Harvesting", pool: 26 },
  { id: "eq-pump", name: "High-pressure Water Pump", category: "Irrigation", pool: 6 },
  { id: "eq-hose", name: "Irrigation Hose (50m)", category: "Irrigation", pool: 22 },
  { id: "eq-spreader", name: "Fertilizer Broadcast Spreader", category: "Fertilizing", pool: 18 },
  { id: "eq-goggles", name: "Safety Goggles", category: "PPE", pool: 600 },
  { id: "eq-boots", name: "Safety Gum Boots", category: "PPE", pool: 240 },
  { id: "eq-raincoat", name: "Heavy Rain Coat", category: "PPE", pool: 540 },
  { id: "eq-gloves", name: "Work Gloves (pair)", category: "PPE", pool: 420 },
];

/** Available worker pool (cross-referenced from the workers collection). */
export const workerRoleOptions = ["Pluckers", "Field Workers", "Sprayers", "Factory Hands"];
export const workerPool: { role: string; available: number; total: number }[] = [
  { role: "Pluckers", available: 86, total: 540 },
  { role: "Field Workers", available: 54, total: 320 },
  { role: "Sprayers", available: 8, total: 24 },
  { role: "Factory Hands", available: 22, total: 180 },
];

/** Pool-size lookup so the admin can cross-reference a request vs live availability. */
export function poolForRequest(type: RequestType, item: string): { available: number; total: number } | null {
  if (type === "Equipment") {
    const e = equipmentCatalog.find((x) => x.name === item);
    return e ? { available: e.pool, total: e.pool } : null;
  }
  const w = workerPool.find((x) => x.role === item);
  return w ? { available: w.available, total: w.total } : null;
}

const ts = (minsAgo: number) => Date.now() - minsAgo * 60000;

/** Seed data mirrored to the `resource_requests` Firestore collection. */
export const seedResourceRequests: ResourceRequest[] = [
  { id: "rr-1", supplierId: "sup-001", supplierName: "Sumithra Green Leaf Co.", type: "Workers", itemDetails: "Pluckers", quantity: 12, dateNeeded: `${addDays(TODAY_ISO, 2)}T06:00`, durationDays: 3, note: "Peak flush round — extra hands needed for the upper block.", status: "PENDING", adminNotes: "", timestamp: ts(18) },
  { id: "rr-2", supplierId: "sup-001", supplierName: "Sumithra Green Leaf Co.", type: "Equipment", itemDetails: "Knapsack Sprayer (16L)", quantity: 4, dateNeeded: `${addDays(TODAY_ISO, 1)}T07:00`, durationDays: 1, note: "Foliar application scheduled before rainfall.", status: "PENDING", adminNotes: "", timestamp: ts(95) },
  { id: "rr-3", supplierId: "sup-002", supplierName: "Hillcrest Leaf Suppliers", type: "Equipment", itemDetails: "Green Leaf Lorry", quantity: 1, dateNeeded: `${addDays(TODAY_ISO, 1)}T15:00`, durationDays: 1, note: "Transport bulk leaf to the collection center.", status: "PENDING", adminNotes: "", timestamp: ts(240) },
  { id: "rr-4", supplierId: "sup-001", supplierName: "Sumithra Green Leaf Co.", type: "Workers", itemDetails: "Field Workers", quantity: 6, dateNeeded: `${addDays(TODAY_ISO, -3)}T07:00`, durationDays: 2, note: "Weeding support around the nursery.", status: "APPROVED", adminNotes: "Allocated from Sutton division — report by 06:30.", timestamp: ts(3000) },
  { id: "rr-5", supplierId: "sup-003", supplierName: "Nuwara Cultivators", type: "Equipment", itemDetails: "Tractor (Massey Ferguson)", quantity: 2, dateNeeded: `${addDays(TODAY_ISO, -1)}T08:00`, durationDays: 5, note: "Land preparation for the new clearing.", status: "REJECTED", adminNotes: "Only 1 tractor free this week — reduce quantity and resubmit.", timestamp: ts(1500) },
];

/** The signed-in supplier (resolved from Auth). */
export const CURRENT_SUPPLIER = { id: "sup-001", name: "Sumithra Green Leaf Co." };

// ============================================================================
// PHASE-2 DOMAIN TYPES — Finance / Payroll / Factory / HR / Procurement
// ============================================================================

// ---- Factory Floor ----
export type FactoryStage = "withering" | "rolling" | "fermentation" | "drying" | "sorting" | "packing" | "dispatched";
export type BatchStatus = "open" | "in_progress" | "completed" | "rejected";

export interface FactoryBatch {
  id: string;
  batchCode: string;
  estateId?: string;
  divisionId?: string;
  supplierId?: string;
  gradeCode: string;
  gradeName?: string;
  greenLeafInKg: number;
  outputKg: number;
  wasteKg: number;
  currentStage: FactoryStage;
  status: BatchStatus;
  startedAt?: string;
  completedAt?: string;
  startedBy?: string;
  notes?: string;
  version: number;
  createdAt: string;
}

export interface FactoryStageLog {
  id: string;
  batchId: string;
  stage: FactoryStage;
  operatorUid?: string;
  startedAt: string;
  endedAt?: string;
  durationMin?: number;
  inputKg?: number;
  outputKg?: number;
  moisturePct?: number;
  temperatureC?: number;
  humidityPct?: number;
  gradeCode?: string;
  gradeName?: string;
  notes?: string;
}

// ---- Finance ----
export type GlAccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type JournalStatus = "draft" | "posted" | "reversed";

export interface GlAccount {
  id: string;
  code: string;
  name: string;
  type: GlAccountType;
  isActive: boolean;
  parentId?: string;
}

export interface JournalLine {
  id: string;
  journalId: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalEntry {
  id: string;
  entryNo: string;
  entryDate: string;
  description: string;
  reference?: string;
  estateId?: string;
  status: JournalStatus;
  postedBy?: string;
  postedAt?: string;
  version: number;
  lines: JournalLine[];
  createdAt: string;
}

export interface SupplierInvoice {
  id: string;
  invoiceNo: string;
  supplierId: string;
  estateId?: string;
  invoiceDate: string;
  dueDate?: string;
  grossAmount: number;
  deduction: number;
  netAmount: number;
  status: "unpaid" | "partial" | "paid";
  paidAmount: number;
  journalId?: string;
  version: number;
}

// ---- Payroll ----
export type PayrollStatus = "draft" | "approved" | "paid";

export interface PayrollRun {
  id: string;
  runCode: string;
  estateId?: string;
  periodMonth: number;  // 1..12
  periodYear: number;
  status: PayrollStatus;
  totalGross: number;
  totalEpf: number;       // employee 8%
  totalEtf: number;       // employer 3%
  totalEmployerEpf: number; // employer 12%
  totalNet: number;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  version: number;
  createdAt: string;
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  workerId: string;
  workerName?: string;
  basicSalary: number;
  overtimePay: number;
  allowances: number;
  grossPay: number;
  epfEmployee: number;  // 8%
  epfEmployer: number;  // 12%
  etfEmployer: number;  // 3%
  deductions: number;
  netPay: number;
  daysWorked: number;
}

// ---- HR / Leave ----
export type LeaveType = "annual" | "sick" | "casual" | "maternity" | "nopay";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface WorkerHrFields {
  fullName?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  emergencyContact?: string;
  hireDate?: string;
  terminationDate?: string;
  epfNumber?: string;
  etfNumber?: string;
  bankName?: string;
  bankBranch?: string;
  basicSalary: number;
  skillMatrix: Record<string, number>; // skill → 1..5
  leaveBalance: { annual: number; sick: number; casual: number };
  version: number;
}

export interface LeaveRequest {
  id: string;
  workerId: string;
  workerName?: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: LeaveStatus;
  approvedBy?: string;
  approvedAt?: string;
  version: number;
  createdAt: string;
}

// ---- Procurement ----
export type PoStatus = "draft" | "sent" | "partially_received" | "received" | "cancelled";
export type StockMoveType = "in" | "out" | "adjust" | "transfer";

export interface StockItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  qtyOnHand: number;
  reorderLevel: number;
  unitCost: number;
  estateId?: string;
  version: number;
}

export interface PurchaseOrderLine {
  id: string;
  poId: string;
  stockItemId: string;
  stockItemCode?: string;
  stockItemName?: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  poCode: string;
  supplierName: string;
  estateId?: string;
  orderDate: string;
  expectedDate?: string;
  status: PoStatus;
  totalAmount: number;
  notes?: string;
  lines: PurchaseOrderLine[];
  version: number;
}

export interface GoodsReceipt {
  id: string;
  grnCode: string;
  poId?: string;
  poCode?: string;
  receivedDate: string;
  receivedBy?: string;
  supplierInvoiceNo?: string;
  notes?: string;
  version: number;
}

export interface StockMovement {
  id: string;
  stockItemId: string;
  moveType: StockMoveType;
  qty: number;
  unitCost: number;
  referenceType?: string;
  referenceId?: string;
  fromEstateId?: string;
  toEstateId?: string;
  performedBy?: string;
  performedAt: string;
  notes?: string;
}

// ---- Conflict resolution result ----
export type ConflictResolution = "updated" | "conflict" | "not_found";
export interface OptimisticUpdateResult<T> {
  resolution: ConflictResolution;
  current?: T;  // server's current row (on conflict)
  updated?: T;  // newly updated row (on success)
}

// ============================================================================
// LOYALTY PROGRAM — members, points ledger, rewards, redemptions
// ============================================================================

export type LoyaltyTier = "Bronze" | "Silver" | "Gold" | "Platinum";
export type LoyaltyTxnType = "earn" | "burn" | "adjust" | "bonus";
export type RewardCategory = "merchandise" | "cash" | "voucher" | "experience";
export type RedemptionStatus = "pending" | "approved" | "rejected" | "fulfilled" | "cancelled";

export interface LoyaltyMemberFull {
  id: string;
  workerId?: string;
  workerName: string;
  points: number;
  tier: LoyaltyTier;
  streakDays: number;
  badge: string;
  totalEarned: number;
  totalBurned: number;
  lastAwardedAt?: string;
  lastAwardedReason?: string;
  status: "active" | "suspended";
  version: number;
  createdAt: string;
}

export interface LoyaltyPointsEntry {
  id: string;
  memberId: string;
  workerName?: string;
  points: number;              // + earn, - burn
  transactionType: LoyaltyTxnType;
  reason: string;
  referenceType?: string;      // harvest | attendance | payroll | redemption | manual
  referenceId?: string;
  awardedBy?: string;
  awardedAt: string;
}

export interface LoyaltyReward {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: RewardCategory;
  pointsCost: number;
  cashValue: number;
  stockQty: number;            // -1 = unlimited
  imageUrl?: string;
  isActive: boolean;
  estateId?: string;
  version: number;
}

export interface LoyaltyRedemption {
  id: string;
  redemptionCode: string;
  memberId: string;
  workerName?: string;
  rewardId: string;
  rewardName?: string;
  pointsCost: number;
  cashValue: number;
  status: RedemptionStatus;
  redeemedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  fulfilledAt?: string;
  notes?: string;
  version: number;
}

// Tier thresholds — points needed to reach each tier
export const TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  Bronze: 0,
  Silver: 800,
  Gold: 1500,
  Platinum: 2000,
};

export function tierForPoints(points: number): LoyaltyTier {
  if (points >= TIER_THRESHOLDS.Platinum) return "Platinum";
  if (points >= TIER_THRESHOLDS.Gold) return "Gold";
  if (points >= TIER_THRESHOLDS.Silver) return "Silver";
  return "Bronze";
}

export function badgeForPoints(points: number): string {
  if (points >= 2000) return "Iron Plucker";
  if (points >= 1500) return "Top Flush";
  if (points >= 1000) return "Steady Hand";
  if (points >= 500) return "Early Bird";
  return "Rookie";
}

export function nextTierFrom(points: number): { next: LoyaltyTier; pointsNeeded: number } | null {
  if (points < TIER_THRESHOLDS.Silver) return { next: "Silver", pointsNeeded: TIER_THRESHOLDS.Silver - points };
  if (points < TIER_THRESHOLDS.Gold) return { next: "Gold", pointsNeeded: TIER_THRESHOLDS.Gold - points };
  if (points < TIER_THRESHOLDS.Platinum) return { next: "Platinum", pointsNeeded: TIER_THRESHOLDS.Platinum - points };
  return null; // already at top tier
}

// ============================================================================
// INTEGRATION TYPES — Sales Invoices + Payroll Allowances (auto-post wires)
// ============================================================================

export interface SalesInvoice {
  id: string;
  invoiceNo: string;
  batchId?: string;
  buyerName: string;
  invoiceDate: string;
  dueDate?: string;
  gradeCode?: string;
  gradeName?: string;
  qtyKg: number;
  pricePerKg: number;
  grossAmount: number;
  commissionPct: number;
  commissionAmt: number;
  netAmount: number;
  status: "unpaid" | "partial" | "paid";
  paidAmount: number;
  journalId?: string;
  version: number;
  createdAt: string;
}

export type AllowanceSource = "loyalty_redemption" | "manual" | "bonus";

export interface PayrollAllowance {
  id: string;
  workerId: string;
  workerName?: string;
  sourceType: AllowanceSource;
  sourceId?: string;
  description: string;
  amount: number;
  periodMonth?: number;
  periodYear?: number;
  consumedByRun?: string;
  consumedAt?: string;
  createdAt: string;
}

// GL account code constants (must match supabase_migration_fix3.sql seed)
export const GL_CODES = {
  CASH: "1000",
  BANK: "1010",
  AR: "1100",
  INVENTORY_RAW: "1200",
  INVENTORY_FINISHED: "1210",
  AP: "2000",
  EPF_PAYABLE: "2100",
  ETF_PAYABLE: "2110",
  SUPPLIER_ADVANCES: "2200",
  TEA_SALES: "4000",
  BYPRODUCT_SALES: "4010",
  GREEN_LEAF_COST: "5000",
  WAGES: "5010",
  EPF_EXPENSE: "5020",
  ETF_EXPENSE: "5030",
  FACTORY_FUEL: "5040",
  FERTILIZER_CHEMICALS: "5050",
  REPAIRS: "5060",
  TRANSPORT: "5070",
} as const;
