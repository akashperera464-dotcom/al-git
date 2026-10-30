import type { OfficeBalanceResponse, OfficeLeafResponse, OfficeMonthBalance } from "./officeApiContracts";

export interface OfficeCropComparison {
  currentCropKg: number;
  statementKg: number;
  differenceKg: number;
}

export interface OfficeDeductionLine {
  key: string;
  labelKey: string;
  amount: number;
  group: "fertilizer" | "advance" | "loan" | "other";
}

export interface OfficeMonthMetricComparison {
  current: number;
  previous: number;
  difference: number;
  percentChange: number | null;
}

export interface OfficeMonthComparison {
  suppliedKg: OfficeMonthMetricComparison;
  grossEarnings: OfficeMonthMetricComparison;
  totalDeductions: OfficeMonthMetricComparison;
  accountBalance: OfficeMonthMetricComparison;
}

const DEDUCTION_DEFINITIONS: Array<Omit<OfficeDeductionLine, "amount">> = [
  { key: "fertilizerLMB", labelKey: "officeFinance.fertilizerPreviousBalance", group: "fertilizer" },
  { key: "fertilizerThisMonthInstalment", labelKey: "officeFinance.fertilizerInstallment", group: "fertilizer" },
  { key: "advanceATM", labelKey: "officeFinance.advanceAtm", group: "advance" },
  { key: "advancePOS", labelKey: "officeFinance.advancePos", group: "advance" },
  { key: "advanceRoute", labelKey: "officeFinance.advanceRoute", group: "advance" },
  { key: "advanceOffice", labelKey: "officeFinance.advanceOffice", group: "advance" },
  { key: "loanInterest", labelKey: "officeFinance.loanInterest", group: "loan" },
  { key: "loanInstallment", labelKey: "officeFinance.loanInstallment", group: "loan" },
  { key: "bankLoan", labelKey: "officeFinance.bankLoan", group: "loan" },
  { key: "tea", labelKey: "officeFinance.teaDeduction", group: "other" },
  { key: "transport", labelKey: "officeFinance.transport", group: "other" },
  { key: "otherDeduction", labelKey: "officeFinance.otherDeduction", group: "other" },
  { key: "lmDebt", labelKey: "officeFinance.previousDebt", group: "other" },
];

export function getOfficeCropComparison(crop: OfficeLeafResponse, balance: OfficeBalanceResponse): OfficeCropComparison {
  const statementKg = balance.currentMonth.normalLeafQty + balance.currentMonth.superLeafQty;
  return {
    currentCropKg: crop.totals.totalQty,
    statementKg,
    differenceKg: crop.totals.totalQty - statementKg,
  };
}

export function getOfficeDeductionLines(month: OfficeMonthBalance): OfficeDeductionLine[] {
  return DEDUCTION_DEFINITIONS.map((definition) => ({
    ...definition,
    amount: Number(month.deductions[definition.key] ?? 0),
  })).filter((line) => Number.isFinite(line.amount) && line.amount !== 0);
}

export function sumOfficeDeductionsByGroup(month: OfficeMonthBalance, group: OfficeDeductionLine["group"]): number {
  return getOfficeDeductionLines(month)
    .filter((line) => line.group === group)
    .reduce((sum, line) => sum + line.amount, 0);
}

function compareMetric(current: number, previous: number): OfficeMonthMetricComparison {
  const difference = current - previous;
  return {
    current,
    previous,
    difference,
    percentChange: previous === 0 ? (current === 0 ? 0 : null) : (difference / Math.abs(previous)) * 100,
  };
}

export function compareOfficeMonths(current: OfficeMonthBalance, previous: OfficeMonthBalance): OfficeMonthComparison {
  return {
    suppliedKg: compareMetric(current.normalLeafQty + current.superLeafQty, previous.normalLeafQty + previous.superLeafQty),
    grossEarnings: compareMetric(current.totalGrossPay, previous.totalGrossPay),
    totalDeductions: compareMetric(current.totalDeduction, previous.totalDeduction),
    accountBalance: compareMetric(current.balance, previous.balance),
  };
}

export function sriLankaDateIso(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Colombo",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function yesterdaySriLankaIso(now = new Date()): string {
  const today = sriLankaDateIso(now);
  const midnightColombo = new Date(`${today}T00:00:00+05:30`);
  return sriLankaDateIso(new Date(midnightColombo.getTime() - 86_400_000));
}

export function findOfficeDeliveryForDate(monthly: OfficeLeafResponse, dateIso: string) {
  return monthly.deliveries.find((delivery) => delivery.date === dateIso) ?? null;
}
