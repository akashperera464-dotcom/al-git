import { getSupabase, supabaseConfigured } from "./supabase";

export interface SupplierFinancialSummary {
  supplierId: string;
  periodMonth: string;
  grossEarnings: number;
  fertilizerDeduction: number;
  cashAdvanceInstallment: number;
  otherDeductions: number;
  totalDeductions: number;
  paidAmount: number;
  estimatedNetPayable: number;
  confirmedNetPayable: number | null;
}

const number = (value: unknown) => Number(value ?? 0);
const map = (row: Record<string, unknown>): SupplierFinancialSummary => ({
  supplierId: String(row.supplier_id), periodMonth: String(row.period_month),
  grossEarnings: number(row.gross_earnings), fertilizerDeduction: number(row.fertilizer_deduction),
  cashAdvanceInstallment: number(row.cash_advance_installment), otherDeductions: number(row.other_deductions),
  totalDeductions: number(row.total_deductions), paidAmount: number(row.paid_amount),
  estimatedNetPayable: number(row.estimated_net_payable),
  confirmedNetPayable: row.confirmed_net_payable == null ? null : number(row.confirmed_net_payable),
});

export async function readSupplierFinancialSummary(supplierId: string, periodMonth?: string): Promise<SupplierFinancialSummary | null> {
  if (!supabaseConfigured) return null;
  let query = getSupabase()!.from("supplier_financial_summary").select("*").eq("supplier_id", supplierId);
  if (periodMonth) query = query.eq("period_month", periodMonth.slice(0, 7) + "-01");
  const { data, error } = await query.order("period_month", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`Could not load financial summary: ${error.message}`);
  return data ? map(data as Record<string, unknown>) : null;
}

export async function readFinancialSummaries(filters: { month?: string; supplierId?: string } = {}): Promise<SupplierFinancialSummary[]> {
  if (!supabaseConfigured) return [];
  let query = getSupabase()!.from("supplier_financial_summary").select("*");
  if (filters.month) query = query.eq("period_month", filters.month.slice(0, 7) + "-01");
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  const { data, error } = await query.order("period_month", { ascending: false });
  if (error) throw new Error(`Could not load financial summaries: ${error.message}`);
  return (data ?? []).map((row) => map(row as Record<string, unknown>));
}

export async function confirmMonthEnd(supplierId: string, periodMonth: string): Promise<void> {
  const { error } = await getSupabase()!.rpc("confirm_supplier_month_end", { p_supplier_id: supplierId, p_period_month: periodMonth });
  if (error) throw new Error(`Could not confirm month-end: ${error.message}`);
}
