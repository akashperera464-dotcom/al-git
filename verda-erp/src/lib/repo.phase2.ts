/**
 * Verda · Phase-2 Repository — Finance / Payroll / Factory / HR / Procurement
 * ------------------------------------------------------------------
 * CRUD for all new tables introduced in supabase_migration.sql.
 * Implements OPTIMISTIC CONCURRENCY: every update sends the client's `version`
 * in the WHERE clause; if 0 rows update, a conflict is detected and the
 * caller can re-fetch + retry or merge.
 *
 * Falls back to in-memory mock arrays in demo mode (no Supabase env) so the
 * UI stays runnable & auditable without a live backend.
 */
import { getSupabase, supabaseConfigured } from "./supabase";
import type {
  FactoryBatch, FactoryStageLog, FactoryStage, BatchStatus,
  GlAccount, JournalEntry, JournalLine, JournalStatus, SupplierInvoice,
  PayrollRun, Payslip, PayrollStatus,
  LeaveRequest, LeaveType, LeaveStatus,
  StockItem, PurchaseOrder, PurchaseOrderLine, GoodsReceipt, StockMovement, StockMoveType, PoStatus,
  OptimisticUpdateResult,
} from "./data";

// ============================================================================
// MOCK STORES (demo-mode fallback)
// ============================================================================
const mockBatches: FactoryBatch[] = [];
const mockStageLogs: FactoryStageLog[] = [];
const mockAccounts: GlAccount[] = [
  { id: "a1", code: "1000", name: "Cash on Hand", type: "asset", isActive: true },
  { id: "a2", code: "1010", name: "Bank - Current", type: "asset", isActive: true },
  { id: "a3", code: "1100", name: "Accounts Receivable", type: "asset", isActive: true },
  { id: "a4", code: "2000", name: "Accounts Payable", type: "liability", isActive: true },
  { id: "a5", code: "2100", name: "EPF Payable", type: "liability", isActive: true },
  { id: "a6", code: "3000", name: "Owner Equity", type: "equity", isActive: true },
  { id: "a7", code: "4000", name: "Tea Sales Revenue", type: "revenue", isActive: true },
  { id: "a8", code: "5000", name: "Green Leaf Cost", type: "expense", isActive: true },
  { id: "a9", code: "5010", name: "Wages & Salaries", type: "expense", isActive: true },
];
const mockJournals: JournalEntry[] = [];
const mockInvoices: SupplierInvoice[] = [];
const mockPayrollRuns: PayrollRun[] = [];
const mockPayslips: Payslip[] = [];
const mockLeaveReqs: LeaveRequest[] = [];
const mockStock: StockItem[] = [
  { id: "s1", code: "FERT-UREA", name: "Urea (46% N)", category: "fertilizer", unit: "kg", qtyOnHand: 1250, reorderLevel: 200, unitCost: 95, version: 1 },
  { id: "s2", code: "FERT-MOP",  name: "MOP (Potash)", category: "fertilizer", unit: "kg", qtyOnHand: 680, reorderLevel: 150, unitCost: 180, version: 1 },
  { id: "s3", code: "FERT-TSP",  name: "TSP (Phosphate)", category: "fertilizer", unit: "kg", qtyOnHand: 420, reorderLevel: 100, unitCost: 175, version: 1 },
  { id: "s4", code: "FUEL-DIE",  name: "Diesel", category: "fuel", unit: "L", qtyOnHand: 850, reorderLevel: 200, unitCost: 320, version: 1 },
];
const mockPOs: PurchaseOrder[] = [];
const mockGRNs: GoodsReceipt[] = [];
const mockMoves: StockMovement[] = [];

// ============================================================================
// HELPERS
// ============================================================================
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();

/** Maps a Postgres snake_case row to camelCase for one of our domain types. */
function rowToBatch(r: Record<string, unknown>): FactoryBatch {
  return {
    id: r.id as string,
    batchCode: r.batch_code as string,
    estateId: r.estate_id as string | undefined,
    divisionId: r.division_id as string | undefined,
    supplierId: r.supplier_id as string | undefined,
    gradeCode: r.grade_code as string,
    gradeName: r.grade_name as string | undefined,
    greenLeafInKg: Number(r.green_leaf_in_kg ?? 0),
    outputKg: Number(r.output_kg ?? 0),
    wasteKg: Number(r.waste_kg ?? 0),
    currentStage: r.current_stage as FactoryStage,
    status: r.status as BatchStatus,
    startedAt: r.started_at as string | undefined,
    completedAt: r.completed_at as string | undefined,
    startedBy: r.started_by as string | undefined,
    notes: r.notes as string | undefined,
    version: Number(r.version ?? 1),
    createdAt: r.created_at as string,
  };
}

function rowToAccount(r: Record<string, unknown>): GlAccount {
  return {
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    type: r.type as GlAccount["type"],
    isActive: Boolean(r.is_active),
    parentId: r.parent_id as string | undefined,
  };
}

function rowToInvoice(r: Record<string, unknown>): SupplierInvoice {
  return {
    id: r.id as string,
    invoiceNo: r.invoice_no as string,
    supplierId: r.supplier_id as string,
    estateId: r.estate_id as string | undefined,
    invoiceDate: r.invoice_date as string,
    dueDate: r.due_date as string | undefined,
    grossAmount: Number(r.gross_amount ?? 0),
    deduction: Number(r.deduction ?? 0),
    netAmount: Number(r.net_amount ?? 0),
    status: r.status as "unpaid" | "partial" | "paid",
    paidAmount: Number(r.paid_amount ?? 0),
    journalId: r.journal_id as string | undefined,
    version: Number(r.version ?? 1),
  };
}

// ============================================================================
// 1 · FACTORY BATCHES  (CRUD + stage progression)
// ============================================================================

export async function listFactoryBatches(estateId?: string): Promise<FactoryBatch[]> {
  if (!supabaseConfigured) {
    return estateId ? mockBatches.filter(b => b.estateId === estateId) : mockBatches;
  }
  const sb = getSupabase()!;
  let q = sb.from("factory_batches").select("*").order("created_at", { ascending: false });
  if (estateId) q = q.eq("estate_id", estateId);
  const { data, error } = await q;
  if (error) throw new Error(`listFactoryBatches: ${error.message}`);
  return (data ?? []).map(rowToBatch);
}

export async function createFactoryBatch(input: {
  batchCode: string;
  estateId?: string;
  gradeCode: string;
  gradeName?: string;
  greenLeafInKg: number;
  startedBy?: string;
  notes?: string;
}): Promise<FactoryBatch> {
  if (!supabaseConfigured) {
    const b: FactoryBatch = {
      id: uid(), batchCode: input.batchCode, estateId: input.estateId,
      gradeCode: input.gradeCode, gradeName: input.gradeName,
      greenLeafInKg: input.greenLeafInKg, outputKg: 0, wasteKg: 0,
      currentStage: "withering", status: "open",
      startedAt: now(), startedBy: input.startedBy, notes: input.notes,
      version: 1, createdAt: now(),
    };
    mockBatches.unshift(b);
    // also log the initial stage
    mockStageLogs.unshift({
      id: uid(), batchId: b.id, stage: "withering",
      operatorUid: input.startedBy, startedAt: now(),
      inputKg: input.greenLeafInKg,
    });
    return b;
  }
  const sb = getSupabase()!;
  const { data, error } = await sb.from("factory_batches").insert({
    batch_code: input.batchCode,
    estate_id: input.estateId,
    grade_code: input.gradeCode,
    grade_name: input.gradeName,
    green_leaf_in_kg: input.greenLeafInKg,
    current_stage: "withering",
    status: "open",
    started_at: now(),
    started_by: input.startedBy,
    notes: input.notes,
  }).select().single();
  if (error) throw new Error(`createFactoryBatch: ${error.message}`);
  const batch = rowToBatch(data);
  // log initial stage
  await sb.from("factory_stage_logs").insert({
    batch_id: batch.id, stage: "withering",
    operator_uid: input.startedBy, started_at: now(),
    input_kg: input.greenLeafInKg,
  });
  return batch;
}

/**
 * Advance a batch to the next stage with stage-log measurements.
 * Uses OPTIMISTIC CONCURRENCY: the WHERE clause includes `version`, so if
 * another officer updated the batch concurrently, 0 rows update and we
 * return a conflict result.
 */
export async function advanceBatchStage(input: {
  batchId: string;
  expectedVersion: number;
  toStage: FactoryStage;
  operatorUid?: string;
  inputKg?: number;
  outputKg?: number;
  moisturePct?: number;
  temperatureC?: number;
  humidityPct?: number;
  gradeCode?: string;
  gradeName?: string;
  notes?: string;
}): Promise<OptimisticUpdateResult<FactoryBatch>> {
  // First, end the previous stage log
  if (!supabaseConfigured) {
    const idx = mockBatches.findIndex(b => b.id === input.batchId);
    if (idx === -1) return { resolution: "not_found" };
    const b = mockBatches[idx];
    if (b.version !== input.expectedVersion) {
      return { resolution: "conflict", current: b };
    }
    // close previous log
    const prevLog = mockStageLogs.find(l => l.batchId === b.id && !l.endedAt);
    if (prevLog) {
      prevLog.endedAt = now();
      prevLog.outputKg = input.outputKg;
      prevLog.moisturePct = input.moisturePct;
      prevLog.temperatureC = input.temperatureC;
      prevLog.durationMin = Math.round((Date.now() - new Date(prevLog.startedAt).getTime()) / 60000);
    }
    // update batch
    b.currentStage = input.toStage;
    b.version = b.version + 1;
    if (input.outputKg !== undefined) b.outputKg = input.outputKg;
    if (input.toStage === "dispatched") {
      b.status = "completed";
      b.completedAt = now();
      if (b.greenLeafInKg > 0) {
        b.wasteKg = +(b.greenLeafInKg - b.outputKg).toFixed(2);
      }
    } else {
      b.status = "in_progress";
    }
    // start new stage log
    mockStageLogs.unshift({
      id: uid(), batchId: b.id, stage: input.toStage,
      operatorUid: input.operatorUid, startedAt: now(),
      inputKg: input.outputKg ?? input.inputKg,
      notes: input.notes,
    });
    return { resolution: "updated", updated: b };
  }
  const sb = getSupabase()!;
  // optimistic update — only updates if version matches
  const patch: Record<string, unknown> = {
    current_stage: input.toStage,
    status: input.toStage === "dispatched" ? "completed" : "in_progress",
  };
  if (input.outputKg !== undefined) patch.output_kg = input.outputKg;
  if (input.toStage === "dispatched") patch.completed_at = now();
  const { data: updated, error: updErr } = await sb
    .from("factory_batches")
    .update(patch)
    .eq("id", input.batchId)
    .eq("version", input.expectedVersion)
    .select()
    .single();
  if (updErr) throw new Error(`advanceBatchStage: ${updErr.message}`);
  if (!updated) {
    // conflict — fetch current
    const { data: cur } = await sb.from("factory_batches").select("*").eq("id", input.batchId).single();
    return { resolution: "conflict", current: cur ? rowToBatch(cur) : undefined };
  }
  const batch = rowToBatch(updated);
  // compute waste on dispatch
  if (input.toStage === "dispatched" && batch.greenLeafInKg > 0) {
    await sb.from("factory_batches").update({
      waste_kg: +(batch.greenLeafInKg - batch.outputKg).toFixed(2),
    }).eq("id", batch.id);
  }
  // close previous stage log
  await sb.from("factory_stage_logs").update({
    ended_at: now(),
    output_kg: input.outputKg,
    moisture_pct: input.moisturePct,
    temperature_c: input.temperatureC,
    duration_min: Math.round((Date.now() - (batch.startedAt ? new Date(batch.startedAt).getTime() : Date.now())) / 60000),
  }).eq("batch_id", batch.id).is("ended_at", null);
  // start new stage log
  await sb.from("factory_stage_logs").insert({
    batch_id: batch.id, stage: input.toStage,
    operator_uid: input.operatorUid, started_at: now(),
    input_kg: input.outputKg ?? input.inputKg,
    grade_code: input.gradeCode, grade_name: input.gradeName,
    notes: input.notes,
  });
  return { resolution: "updated", updated: batch };
}

export async function listStageLogs(batchId: string): Promise<FactoryStageLog[]> {
  if (!supabaseConfigured) {
    return mockStageLogs.filter(l => l.batchId === batchId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }
  const sb = getSupabase()!;
  const { data, error } = await sb.from("factory_stage_logs")
    .select("*").eq("batch_id", batchId)
    .order("started_at", { ascending: false });
  if (error) throw new Error(`listStageLogs: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    batchId: r.batch_id as string,
    stage: r.stage as FactoryStage,
    operatorUid: r.operator_uid as string | undefined,
    startedAt: r.started_at as string,
    endedAt: r.ended_at as string | undefined,
    durationMin: r.duration_min as number | undefined,
    inputKg: r.input_kg as number | undefined,
    outputKg: r.output_kg as number | undefined,
    moisturePct: r.moisture_pct as number | undefined,
    temperatureC: r.temperature_c as number | undefined,
    humidityPct: r.humidity_pct as number | undefined,
    gradeCode: r.grade_code as string | undefined,
    gradeName: r.grade_name as string | undefined,
    notes: r.notes as string | undefined,
  }));
}

// ============================================================================
// 2 · GL ACCOUNTS + JOURNAL ENTRIES  (double-entry)
// ============================================================================

export async function listGlAccounts(): Promise<GlAccount[]> {
  if (!supabaseConfigured) return mockAccounts;
  const sb = getSupabase()!;
  const { data, error } = await sb.from("gl_accounts").select("*").order("code");
  if (error) throw new Error(`listGlAccounts: ${error.message}`);
  return (data ?? []).map(rowToAccount);
}

export async function listJournalEntries(estateId?: string): Promise<JournalEntry[]> {
  if (!supabaseConfigured) return mockJournals;
  const sb = getSupabase()!;
  let q = sb.from("journal_entries").select("*, lines:journal_lines(*)").order("entry_date", { ascending: false });
  if (estateId) q = q.eq("estate_id", estateId);
  const { data, error } = await q;
  if (error) throw new Error(`listJournalEntries: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    entryNo: r.entry_no as string,
    entryDate: r.entry_date as string,
    description: r.description as string,
    reference: r.reference as string | undefined,
    estateId: r.estate_id as string | undefined,
    status: r.status as JournalStatus,
    postedBy: r.posted_by as string | undefined,
    postedAt: r.posted_at as string | undefined,
    version: Number(r.version ?? 1),
    createdAt: r.created_at as string,
    lines: ((r.lines as Record<string, unknown>[]) ?? []).map((l): JournalLine => ({
      id: l.id as string,
      journalId: l.journal_id as string,
      accountId: l.account_id as string,
      debit: Number(l.debit ?? 0),
      credit: Number(l.credit ?? 0),
      description: l.description as string | undefined,
    })),
  }));
}

export async function createJournalEntry(input: {
  entryNo: string;
  entryDate: string;
  description: string;
  reference?: string;
  estateId?: string;
  lines: { accountId: string; debit: number; credit: number; description?: string }[];
}): Promise<JournalEntry> {
  // Validate double-entry balance
  const totalDebit = input.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = input.lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal not balanced: debits ${totalDebit} ≠ credits ${totalCredit}`);
  }
  if (input.lines.length < 2) {
    throw new Error("A journal entry needs at least 2 lines");
  }
  if (!supabaseConfigured) {
    const id = uid();
    const je: JournalEntry = {
      id, entryNo: input.entryNo, entryDate: input.entryDate,
      description: input.description, reference: input.reference,
      estateId: input.estateId, status: "draft", version: 1,
      createdAt: now(),
      lines: input.lines.map(l => ({ id: uid(), journalId: id, ...l })),
    };
    mockJournals.unshift(je);
    return je;
  }
  const sb = getSupabase()!;
  const { data: jeRow, error: jeErr } = await sb.from("journal_entries").insert({
    entry_no: input.entryNo, entry_date: input.entryDate,
    description: input.description, reference: input.reference,
    estate_id: input.estateId, status: "draft",
  }).select().single();
  if (jeErr) throw new Error(`createJournalEntry: ${jeErr.message}`);
  const journalId = jeRow.id;
  const linesPayload = input.lines.map(l => ({
    journal_id: journalId, account_id: l.accountId,
    debit: l.debit, credit: l.credit, description: l.description,
  }));
  const { error: lErr } = await sb.from("journal_lines").insert(linesPayload);
  if (lErr) throw new Error(`createJournalEntry lines: ${lErr.message}`);
  // re-fetch
  const { data: full } = await sb.from("journal_entries").select("*, lines:journal_lines(*)").eq("id", journalId).single();
  return {
    id: full!.id as string, entryNo: full!.entry_no as string,
    entryDate: full!.entry_date as string, description: full!.description as string,
    reference: full!.reference as string | undefined,
    estateId: full!.estate_id as string | undefined,
    status: full!.status as JournalStatus,
    postedBy: full!.posted_by as string | undefined,
    postedAt: full!.posted_at as string | undefined,
    version: Number(full!.version ?? 1),
    createdAt: full!.created_at as string,
    lines: ((full!.lines as Record<string, unknown>[]) ?? []).map((l): JournalLine => ({
      id: l.id as string, journalId: l.journal_id as string,
      accountId: l.account_id as string, debit: Number(l.debit ?? 0),
      credit: Number(l.credit ?? 0), description: l.description as string | undefined,
    })),
  };
}

export async function postJournalEntry(journalId: string, expectedVersion: number, postedBy: string): Promise<OptimisticUpdateResult<JournalEntry>> {
  if (!supabaseConfigured) {
    const idx = mockJournals.findIndex(j => j.id === journalId);
    if (idx === -1) return { resolution: "not_found" };
    if (mockJournals[idx].version !== expectedVersion) return { resolution: "conflict", current: mockJournals[idx] };
    mockJournals[idx].status = "posted";
    mockJournals[idx].postedBy = postedBy;
    mockJournals[idx].postedAt = now();
    mockJournals[idx].version += 1;
    return { resolution: "updated", updated: mockJournals[idx] };
  }
  const sb = getSupabase()!;
  const { data, error } = await sb.from("journal_entries")
    .update({ status: "posted", posted_by: postedBy, posted_at: now() })
    .eq("id", journalId).eq("version", expectedVersion)
    .select().single();
  if (error) throw new Error(`postJournalEntry: ${error.message}`);
  if (!data) {
    const { data: cur } = await sb.from("journal_entries").select("*").eq("id", journalId).single();
    return { resolution: "conflict", current: cur as JournalEntry | undefined };
  }
  return { resolution: "updated", updated: data as JournalEntry };
}

/** Trial balance — sum of all debits/credits per account (posted entries only). */
export async function trialBalance(): Promise<{ account: GlAccount; debit: number; credit: number }[]> {
  const accounts = await listGlAccounts();
  if (!supabaseConfigured) {
    return accounts.map(a => ({
      account: a,
      debit: mockJournals.filter(j => j.status === "posted")
        .flatMap(j => j.lines).filter(l => l.accountId === a.id)
        .reduce((s, l) => s + l.debit, 0),
      credit: mockJournals.filter(j => j.status === "posted")
        .flatMap(j => j.lines).filter(l => l.accountId === a.id)
        .reduce((s, l) => s + l.credit, 0),
    }));
  }
  const sb = getSupabase()!;
  const { data, error } = await sb.from("journal_lines")
    .select("account_id, debit, credit, journal_entries!inner(status)")
    .eq("journal_entries.status", "posted");
  if (error) throw new Error(`trialBalance: ${error.message}`);
  const totals = new Map<string, { debit: number; credit: number }>();
  for (const row of data ?? []) {
    const accId = row.account_id as string;
    const t = totals.get(accId) ?? { debit: 0, credit: 0 };
    t.debit += Number(row.debit ?? 0);
    t.credit += Number(row.credit ?? 0);
    totals.set(accId, t);
  }
  return accounts.map(a => ({
    account: a,
    debit: totals.get(a.id)?.debit ?? 0,
    credit: totals.get(a.id)?.credit ?? 0,
  }));
}

// ============================================================================
// 3 · SUPPLIER INVOICES
// ============================================================================
export async function listSupplierInvoices(supplierId?: string): Promise<SupplierInvoice[]> {
  if (!supabaseConfigured) {
    return supplierId ? mockInvoices.filter(i => i.supplierId === supplierId) : mockInvoices;
  }
  const sb = getSupabase()!;
  let q = sb.from("supplier_invoices").select("*").order("invoice_date", { ascending: false });
  if (supplierId) q = q.eq("supplier_id", supplierId);
  const { data, error } = await q;
  if (error) throw new Error(`listSupplierInvoices: ${error.message}`);
  return (data ?? []).map(rowToInvoice);
}

export async function createSupplierInvoice(input: {
  invoiceNo: string;
  supplierId: string;
  estateId?: string;
  invoiceDate: string;
  dueDate?: string;
  grossAmount: number;
  deduction: number;
}): Promise<SupplierInvoice> {
  const netAmount = +(input.grossAmount - input.deduction).toFixed(2);
  if (!supabaseConfigured) {
    const inv: SupplierInvoice = {
      id: uid(), invoiceNo: input.invoiceNo, supplierId: input.supplierId,
      estateId: input.estateId, invoiceDate: input.invoiceDate, dueDate: input.dueDate,
      grossAmount: input.grossAmount, deduction: input.deduction,
      netAmount, status: "unpaid", paidAmount: 0, version: 1,
    };
    mockInvoices.unshift(inv);
    return inv;
  }
  const sb = getSupabase()!;
  const { data, error } = await sb.from("supplier_invoices").insert({
    invoice_no: input.invoiceNo, supplier_id: input.supplierId,
    estate_id: input.estateId, invoice_date: input.invoiceDate,
    due_date: input.dueDate, gross_amount: input.grossAmount,
    deduction: input.deduction, net_amount: netAmount,
    status: "unpaid",
  }).select().single();
  if (error) throw new Error(`createSupplierInvoice: ${error.message}`);
  return rowToInvoice(data);
}

export async function paySupplierInvoice(invoiceId: string, amount: number, expectedVersion: number): Promise<OptimisticUpdateResult<SupplierInvoice>> {
  if (!supabaseConfigured) {
    const idx = mockInvoices.findIndex(i => i.id === invoiceId);
    if (idx === -1) return { resolution: "not_found" };
    if (mockInvoices[idx].version !== expectedVersion) return { resolution: "conflict", current: mockInvoices[idx] };
    const inv = mockInvoices[idx];
    inv.paidAmount += amount;
    inv.status = inv.paidAmount >= inv.netAmount ? "paid" : "partial";
    inv.version += 1;
    return { resolution: "updated", updated: inv };
  }
  const sb = getSupabase()!;
  // First fetch current row to compute new paid_amount + status
  const { data: cur } = await sb.from("supplier_invoices").select("*").eq("id", invoiceId).single();
  if (!cur) return { resolution: "not_found" };
  if (cur.version !== expectedVersion) return { resolution: "conflict", current: rowToInvoice(cur) };
  const newPaid = Number(cur.paid_amount) + amount;
  const newStatus = newPaid >= Number(cur.net_amount) ? "paid" : "partial";
  const { data, error } = await sb.from("supplier_invoices")
    .update({ paid_amount: newPaid, status: newStatus })
    .eq("id", invoiceId).eq("version", expectedVersion)
    .select().single();
  if (error) throw new Error(`paySupplierInvoice: ${error.message}`);
  if (!data) return { resolution: "conflict", current: rowToInvoice(cur) };
  return { resolution: "updated", updated: rowToInvoice(data) };
}

// ============================================================================
// 4 · PAYROLL  (EPF 8% employee / 12% employer, ETF 3% employer — Sri Lankan statutory)
// ============================================================================
const EPF_EMPLOYEE_RATE = 0.08;
const EPF_EMPLOYER_RATE = 0.12;
const ETF_EMPLOYER_RATE = 0.03;

export async function listPayrollRuns(estateId?: string): Promise<PayrollRun[]> {
  if (!supabaseConfigured) {
    return estateId ? mockPayrollRuns.filter(p => p.estateId === estateId) : mockPayrollRuns;
  }
  const sb = getSupabase()!;
  let q = sb.from("payroll_runs").select("*").order("created_at", { ascending: false });
  if (estateId) q = q.eq("estate_id", estateId);
  const { data, error } = await q;
  if (error) throw new Error(`listPayrollRuns: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string, runCode: r.run_code as string,
    estateId: r.estate_id as string | undefined,
    periodMonth: Number(r.period_month), periodYear: Number(r.period_year),
    status: r.status as PayrollStatus,
    totalGross: Number(r.total_gross ?? 0),
    totalEpf: Number(r.total_epf ?? 0),
    totalEtf: Number(r.total_etf ?? 0),
    totalEmployerEpf: Number(r.total_employer_epf ?? 0),
    totalNet: Number(r.total_net ?? 0),
    approvedBy: r.approved_by as string | undefined,
    approvedAt: r.approved_at as string | undefined,
    paidAt: r.paid_at as string | undefined,
    version: Number(r.version ?? 1),
    createdAt: r.created_at as string,
  }));
}

export async function listPayslips(runId: string): Promise<Payslip[]> {
  if (!supabaseConfigured) return mockPayslips.filter(p => p.payrollRunId === runId);
  const sb = getSupabase()!;
  const { data, error } = await sb.from("payslips").select("*").eq("payroll_run_id", runId);
  if (error) throw new Error(`listPayslips: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string, payrollRunId: r.payroll_run_id as string,
    workerId: r.worker_id as string,
    basicSalary: Number(r.basic_salary ?? 0),
    overtimePay: Number(r.overtime_pay ?? 0),
    allowances: Number(r.allowances ?? 0),
    grossPay: Number(r.gross_pay ?? 0),
    epfEmployee: Number(r.epf_employee ?? 0),
    epfEmployer: Number(r.epf_employer ?? 0),
    etfEmployer: Number(r.etf_employer ?? 0),
    deductions: Number(r.deductions ?? 0),
    netPay: Number(r.net_pay ?? 0),
    daysWorked: Number(r.days_worked ?? 0),
  }));
}

/**
 * Generate payslips for a list of workers for a given month/year.
 * Returns the new PayrollRun + computed payslips. EPF/ETF computed at statutory rates.
 */
export async function generatePayrollRun(input: {
  runCode: string;
  estateId?: string;
  periodMonth: number;
  periodYear: number;
  workers: { workerId: string; basicSalary: number; overtimePay?: number; allowances?: number; deductions?: number; daysWorked?: number }[];
}): Promise<{ run: PayrollRun; payslips: Payslip[] }> {
  const computed = input.workers.map(w => {
    const gross = w.basicSalary + (w.overtimePay ?? 0) + (w.allowances ?? 0);
    const epfEmp = +(gross * EPF_EMPLOYEE_RATE).toFixed(2);
    const epfEr = +(gross * EPF_EMPLOYER_RATE).toFixed(2);
    const etfEr = +(gross * ETF_EMPLOYER_RATE).toFixed(2);
    const net = +(gross - epfEmp - (w.deductions ?? 0)).toFixed(2);
    return {
      workerId: w.workerId, basicSalary: w.basicSalary,
      overtimePay: w.overtimePay ?? 0, allowances: w.allowances ?? 0,
      grossPay: gross, epfEmployee: epfEmp, epfEmployer: epfEr, etfEmployer: etfEr,
      deductions: w.deductions ?? 0, netPay: net, daysWorked: w.daysWorked ?? 30,
    };
  });
  const totals = computed.reduce((acc, p) => ({
    gross: acc.gross + p.grossPay,
    epf: acc.epf + p.epfEmployee,
    epfEr: acc.epfEr + p.epfEmployer,
    etf: acc.etf + p.etfEmployer,
    net: acc.net + p.netPay,
  }), { gross: 0, epf: 0, epfEr: 0, etf: 0, net: 0 });

  if (!supabaseConfigured) {
    const run: PayrollRun = {
      id: uid(), runCode: input.runCode, estateId: input.estateId,
      periodMonth: input.periodMonth, periodYear: input.periodYear,
      status: "draft",
      totalGross: +totals.gross.toFixed(2),
      totalEpf: +totals.epf.toFixed(2),
      totalEtf: +totals.etf.toFixed(2),
      totalEmployerEpf: +totals.epfEr.toFixed(2),
      totalNet: +totals.net.toFixed(2),
      version: 1, createdAt: now(),
    };
    mockPayrollRuns.unshift(run);
    const slips: Payslip[] = computed.map(c => ({
      id: uid(), payrollRunId: run.id, ...c,
    }));
    mockPayslips.push(...slips);
    return { run, payslips: slips };
  }
  const sb = getSupabase()!;
  const { data: runRow, error: rErr } = await sb.from("payroll_runs").insert({
    run_code: input.runCode, estate_id: input.estateId,
    period_month: input.periodMonth, period_year: input.periodYear,
    status: "draft",
    total_gross: +totals.gross.toFixed(2),
    total_epf: +totals.epf.toFixed(2),
    total_etf: +totals.etf.toFixed(2),
    total_employer_epf: +totals.epfEr.toFixed(2),
    total_net: +totals.net.toFixed(2),
  }).select().single();
  if (rErr) throw new Error(`generatePayrollRun: ${rErr.message}`);
  const run: PayrollRun = {
    id: runRow.id, runCode: runRow.run_code, estateId: runRow.estate_id,
    periodMonth: runRow.period_month, periodYear: runRow.period_year,
    status: runRow.status, totalGross: Number(runRow.total_gross),
    totalEpf: Number(runRow.total_epf), totalEtf: Number(runRow.total_etf),
    totalEmployerEpf: Number(runRow.total_employer_epf),
    totalNet: Number(runRow.total_net), version: 1,
    createdAt: runRow.created_at,
  };
  const slipsPayload = computed.map(c => ({
    payroll_run_id: run.id, worker_id: c.workerId,
    basic_salary: c.basicSalary, overtime_pay: c.overtimePay,
    allowances: c.allowances, gross_pay: c.grossPay,
    epf_employee: c.epfEmployee, epf_employer: c.epfEmployer,
    etf_employer: c.etfEmployer, deductions: c.deductions,
    net_pay: c.netPay, days_worked: c.daysWorked,
  }));
  const { data: slipRows, error: sErr } = await sb.from("payslips").insert(slipsPayload).select();
  if (sErr) throw new Error(`generatePayrollRun slips: ${sErr.message}`);
  const slips: Payslip[] = (slipRows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string, payrollRunId: r.payroll_run_id as string,
    workerId: r.worker_id as string,
    basicSalary: Number(r.basic_salary), overtimePay: Number(r.overtime_pay),
    allowances: Number(r.allowances), grossPay: Number(r.gross_pay),
    epfEmployee: Number(r.epf_employee), epfEmployer: Number(r.epf_employer),
    etfEmployer: Number(r.etf_employer), deductions: Number(r.deductions),
    netPay: Number(r.net_pay), daysWorked: Number(r.days_worked),
  }));
  return { run, payslips: slips };
}

export async function approvePayrollRun(runId: string, expectedVersion: number, approvedBy: string): Promise<OptimisticUpdateResult<PayrollRun>> {
  if (!supabaseConfigured) {
    const idx = mockPayrollRuns.findIndex(r => r.id === runId);
    if (idx === -1) return { resolution: "not_found" };
    if (mockPayrollRuns[idx].version !== expectedVersion) return { resolution: "conflict", current: mockPayrollRuns[idx] };
    mockPayrollRuns[idx].status = "approved";
    mockPayrollRuns[idx].approvedBy = approvedBy;
    mockPayrollRuns[idx].approvedAt = now();
    mockPayrollRuns[idx].version += 1;
    return { resolution: "updated", updated: mockPayrollRuns[idx] };
  }
  const sb = getSupabase()!;
  const { data, error } = await sb.from("payroll_runs")
    .update({ status: "approved", approved_by: approvedBy, approved_at: now() })
    .eq("id", runId).eq("version", expectedVersion)
    .select().single();
  if (error) throw new Error(`approvePayrollRun: ${error.message}`);
  if (!data) {
    const { data: cur } = await sb.from("payroll_runs").select("*").eq("id", runId).single();
    return { resolution: "conflict", current: cur as PayrollRun | undefined };
  }
  return { resolution: "updated", updated: data as PayrollRun };
}

// ============================================================================
// 5 · LEAVE REQUESTS  (HR)
// ============================================================================
export async function listLeaveRequests(workerId?: string): Promise<LeaveRequest[]> {
  if (!supabaseConfigured) {
    return workerId ? mockLeaveReqs.filter(l => l.workerId === workerId) : mockLeaveReqs;
  }
  const sb = getSupabase()!;
  let q = sb.from("leave_requests").select("*").order("created_at", { ascending: false });
  if (workerId) q = q.eq("worker_id", workerId);
  const { data, error } = await q;
  if (error) throw new Error(`listLeaveRequests: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string, workerId: r.worker_id as string,
    leaveType: r.leave_type as LeaveType,
    startDate: r.start_date as string, endDate: r.end_date as string,
    days: Number(r.days), reason: r.reason as string | undefined,
    status: r.status as LeaveStatus,
    approvedBy: r.approved_by as string | undefined,
    approvedAt: r.approved_at as string | undefined,
    version: Number(r.version ?? 1),
    createdAt: r.created_at as string,
  }));
}

export async function createLeaveRequest(input: {
  workerId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason?: string;
}): Promise<LeaveRequest> {
  const days = Math.max(1, Math.ceil((new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) / 86400000) + 1);
  if (!supabaseConfigured) {
    const lr: LeaveRequest = {
      id: uid(), workerId: input.workerId, leaveType: input.leaveType,
      startDate: input.startDate, endDate: input.endDate, days, reason: input.reason,
      status: "PENDING", version: 1, createdAt: now(),
    };
    mockLeaveReqs.unshift(lr);
    return lr;
  }
  const sb = getSupabase()!;
  const { data, error } = await sb.from("leave_requests").insert({
    worker_id: input.workerId, leave_type: input.leaveType,
    start_date: input.startDate, end_date: input.endDate, days,
    reason: input.reason, status: "PENDING",
  }).select().single();
  if (error) throw new Error(`createLeaveRequest: ${error.message}`);
  return {
    id: data.id, workerId: data.worker_id, leaveType: data.leave_type,
    startDate: data.start_date, endDate: data.end_date,
    days: Number(data.days), reason: data.reason, status: data.status,
    approvedBy: data.approved_by, approvedAt: data.approved_at,
    version: Number(data.version ?? 1), createdAt: data.created_at,
  };
}

export async function decideLeaveRequest(requestId: string, decision: "APPROVED" | "REJECTED", expectedVersion: number, approvedBy: string): Promise<OptimisticUpdateResult<LeaveRequest>> {
  if (!supabaseConfigured) {
    const idx = mockLeaveReqs.findIndex(l => l.id === requestId);
    if (idx === -1) return { resolution: "not_found" };
    if (mockLeaveReqs[idx].version !== expectedVersion) return { resolution: "conflict", current: mockLeaveReqs[idx] };
    mockLeaveReqs[idx].status = decision;
    mockLeaveReqs[idx].approvedBy = approvedBy;
    mockLeaveReqs[idx].approvedAt = now();
    mockLeaveReqs[idx].version += 1;
    return { resolution: "updated", updated: mockLeaveReqs[idx] };
  }
  const sb = getSupabase()!;
  const { data, error } = await sb.from("leave_requests")
    .update({ status: decision, approved_by: approvedBy, approved_at: now() })
    .eq("id", requestId).eq("version", expectedVersion)
    .select().single();
  if (error) throw new Error(`decideLeaveRequest: ${error.message}`);
  if (!data) {
    const { data: cur } = await sb.from("leave_requests").select("*").eq("id", requestId).single();
    return { resolution: "conflict", current: cur as LeaveRequest | undefined };
  }
  return { resolution: "updated", updated: data as LeaveRequest };
}

// ============================================================================
// 6 · STOCK ITEMS + PURCHASE ORDERS + GRNs + MOVEMENTS  (Procurement)
// ============================================================================
export async function listStockItems(estateId?: string): Promise<StockItem[]> {
  if (!supabaseConfigured) {
    return estateId ? mockStock.filter(s => s.estateId === estateId) : mockStock;
  }
  const sb = getSupabase()!;
  let q = sb.from("stock_items").select("*").order("name");
  if (estateId) q = q.eq("estate_id", estateId);
  const { data, error } = await q;
  if (error) throw new Error(`listStockItems: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string, code: r.code as string, name: r.name as string,
    category: r.category as string, unit: r.unit as string,
    qtyOnHand: Number(r.qty_on_hand ?? 0),
    reorderLevel: Number(r.reorder_level ?? 0),
    unitCost: Number(r.unit_cost ?? 0),
    estateId: r.estate_id as string | undefined,
    version: Number(r.version ?? 1),
  }));
}

export async function createStockItem(input: {
  code: string; name: string; category: string; unit: string;
  reorderLevel?: number; unitCost?: number; estateId?: string;
}): Promise<StockItem> {
  if (!supabaseConfigured) {
    const s: StockItem = {
      id: uid(), code: input.code, name: input.name, category: input.category,
      unit: input.unit, qtyOnHand: 0,
      reorderLevel: input.reorderLevel ?? 0, unitCost: input.unitCost ?? 0,
      estateId: input.estateId, version: 1,
    };
    mockStock.push(s);
    return s;
  }
  const sb = getSupabase()!;
  const { data, error } = await sb.from("stock_items").insert({
    code: input.code, name: input.name, category: input.category, unit: input.unit,
    reorder_level: input.reorderLevel ?? 0, unit_cost: input.unitCost ?? 0,
    estate_id: input.estateId,
  }).select().single();
  if (error) throw new Error(`createStockItem: ${error.message}`);
  return {
    id: data.id, code: data.code, name: data.name, category: data.category,
    unit: data.unit, qtyOnHand: Number(data.qty_on_hand),
    reorderLevel: Number(data.reorder_level), unitCost: Number(data.unit_cost),
    estateId: data.estate_id, version: 1,
  };
}

export async function listPurchaseOrders(estateId?: string): Promise<PurchaseOrder[]> {
  if (!supabaseConfigured) return estateId ? mockPOs.filter(p => p.estateId === estateId) : mockPOs;
  const sb = getSupabase()!;
  let q = sb.from("purchase_orders").select("*, lines:purchase_order_lines(*)").order("order_date", { ascending: false });
  if (estateId) q = q.eq("estate_id", estateId);
  const { data, error } = await q;
  if (error) throw new Error(`listPurchaseOrders: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string, poCode: r.po_code as string,
    supplierName: r.supplier_name as string,
    estateId: r.estate_id as string | undefined,
    orderDate: r.order_date as string,
    expectedDate: r.expected_date as string | undefined,
    status: r.status as PoStatus,
    totalAmount: Number(r.total_amount ?? 0),
    notes: r.notes as string | undefined,
    version: Number(r.version ?? 1),
    lines: ((r.lines as Record<string, unknown>[]) ?? []).map((l): PurchaseOrderLine => ({
      id: l.id as string, poId: l.po_id as string,
      stockItemId: l.stock_item_id as string,
      qtyOrdered: Number(l.qty_ordered ?? 0),
      qtyReceived: Number(l.qty_received ?? 0),
      unitCost: Number(l.unit_cost ?? 0),
      lineTotal: Number(l.line_total ?? 0),
    })),
  }));
}

export async function createPurchaseOrder(input: {
  poCode: string; supplierName: string; estateId?: string;
  orderDate: string; expectedDate?: string; notes?: string;
  lines: { stockItemId: string; qtyOrdered: number; unitCost: number }[];
}): Promise<PurchaseOrder> {
  const total = input.lines.reduce((s, l) => s + l.qtyOrdered * l.unitCost, 0);
  if (!supabaseConfigured) {
    const id = uid();
    const po: PurchaseOrder = {
      id, poCode: input.poCode, supplierName: input.supplierName,
      estateId: input.estateId, orderDate: input.orderDate,
      expectedDate: input.expectedDate, status: "draft",
      totalAmount: +total.toFixed(2), notes: input.notes, version: 1,
      lines: input.lines.map(l => ({
        id: uid(), poId: id, stockItemId: l.stockItemId,
        qtyOrdered: l.qtyOrdered, qtyReceived: 0,
        unitCost: l.unitCost,
        lineTotal: +(l.qtyOrdered * l.unitCost).toFixed(2),
      })),
    };
    mockPOs.unshift(po);
    return po;
  }
  const sb = getSupabase()!;
  const { data: poRow, error: poErr } = await sb.from("purchase_orders").insert({
    po_code: input.poCode, supplier_name: input.supplierName,
    estate_id: input.estateId, order_date: input.orderDate,
    expected_date: input.expectedDate, status: "draft",
    total_amount: +total.toFixed(2), notes: input.notes,
  }).select().single();
  if (poErr) throw new Error(`createPurchaseOrder: ${poErr.message}`);
  const poId = poRow.id;
  const linesPayload = input.lines.map(l => ({
    po_id: poId, stock_item_id: l.stockItemId,
    qty_ordered: l.qtyOrdered, unit_cost: l.unitCost,
    line_total: +(l.qtyOrdered * l.unitCost).toFixed(2),
  }));
  const { error: lErr } = await sb.from("purchase_order_lines").insert(linesPayload);
  if (lErr) throw new Error(`createPurchaseOrder lines: ${lErr.message}`);
  const { data: full } = await sb.from("purchase_orders").select("*, lines:purchase_order_lines(*)").eq("id", poId).single();
  return {
    id: full!.id, poCode: full!.po_code, supplierName: full!.supplier_name,
    estateId: full!.estate_id, orderDate: full!.order_date,
    expectedDate: full!.expected_date, status: full!.status,
    totalAmount: Number(full!.total_amount), notes: full!.notes,
    version: Number(full!.version ?? 1),
    lines: ((full!.lines as Record<string, unknown>[]) ?? []).map((l): PurchaseOrderLine => ({
      id: l.id, poId: l.po_id, stockItemId: l.stock_item_id,
      qtyOrdered: Number(l.qty_ordered), qtyReceived: Number(l.qty_received),
      unitCost: Number(l.unit_cost), lineTotal: Number(l.line_total),
    })),
  };
}

/** Receive stock against a PO + update on-hand quantities via stock_movements. */
export async function receiveGoods(input: {
  grnCode: string;
  poId?: string;
  receivedBy: string;
  supplierInvoiceNo?: string;
  notes?: string;
  receipts: { stockItemId: string; poLineId?: string; qtyReceived: number; unitCost: number }[];
}): Promise<{ grn: GoodsReceipt; updatedStock: StockItem[] }> {
  if (!supabaseConfigured) {
    const grn: GoodsReceipt = {
      id: uid(), grnCode: input.grnCode, poId: input.poId,
      receivedDate: now().slice(0, 10), receivedBy: input.receivedBy,
      supplierInvoiceNo: input.supplierInvoiceNo, notes: input.notes,
      version: 1,
    };
    mockGRNs.unshift(grn);
    const updated: StockItem[] = [];
    for (const r of input.receipts) {
      const idx = mockStock.findIndex(s => s.id === r.stockItemId);
      if (idx !== -1) {
        // moving-average cost
        const s = mockStock[idx];
        const newQty = s.qtyOnHand + r.qtyReceived;
        s.unitCost = +((s.unitCost * s.qtyOnHand + r.unitCost * r.qtyReceived) / Math.max(1, newQty)).toFixed(2);
        s.qtyOnHand = newQty;
        s.version += 1;
        updated.push(s);
      }
      mockMoves.unshift({
        id: uid(), stockItemId: r.stockItemId, moveType: "in",
        qty: r.qtyReceived, unitCost: r.unitCost,
        referenceType: "grn", referenceId: grn.id,
        performedBy: input.receivedBy, performedAt: now(),
      });
    }
    return { grn, updatedStock: updated };
  }
  const sb = getSupabase()!;
  const { data: grnRow, error: gErr } = await sb.from("goods_receipts").insert({
    grn_code: input.grnCode, po_id: input.poId,
    received_date: now().slice(0, 10), received_by: input.receivedBy,
    supplier_invoice_no: input.supplierInvoiceNo, notes: input.notes,
  }).select().single();
  if (gErr) throw new Error(`receiveGoods: ${gErr.message}`);
  const grn: GoodsReceipt = {
    id: grnRow.id, grnCode: grnRow.grn_code, poId: grnRow.po_id,
    receivedDate: grnRow.received_date, receivedBy: grnRow.received_by,
    supplierInvoiceNo: grnRow.supplier_invoice_no, notes: grnRow.notes,
    version: 1,
  };
  // Insert GRN lines + stock movements + update on-hand (moving average)
  const grnLinesPayload = input.receipts.map(r => ({
    grn_id: grn.id, stock_item_id: r.stockItemId,
    po_line_id: r.poLineId, qty_received: r.qtyReceived,
    unit_cost: r.unitCost,
    line_total: +(r.qtyReceived * r.unitCost).toFixed(2),
  }));
  const { error: glErr } = await sb.from("goods_receipt_lines").insert(grnLinesPayload);
  if (glErr) throw new Error(`receiveGoods lines: ${glErr.message}`);
  const movesPayload = input.receipts.map(r => ({
    stock_item_id: r.stockItemId, move_type: "in",
    qty: r.qtyReceived, unit_cost: r.unitCost,
    reference_type: "grn", reference_id: grn.id,
    performed_by: input.receivedBy, performed_at: now(),
  }));
  const { error: mErr } = await sb.from("stock_movements").insert(movesPayload);
  if (mErr) throw new Error(`receiveGoods movements: ${mErr.message}`);
  // Update each stock item (moving average cost) — atomic per-item
  const updated: StockItem[] = [];
  for (const r of input.receipts) {
    const { data: cur } = await sb.from("stock_items").select("*").eq("id", r.stockItemId).single();
    if (cur) {
      const newQty = Number(cur.qty_on_hand) + r.qtyReceived;
      const newCost = +((Number(cur.unit_cost) * Number(cur.qty_on_hand) + r.unitCost * r.qtyReceived) / Math.max(1, newQty)).toFixed(2);
      await sb.from("stock_items").update({
        qty_on_hand: newQty, unit_cost: newCost,
      }).eq("id", r.stockItemId);
      updated.push({
        id: cur.id, code: cur.code, name: cur.name,
        category: cur.category, unit: cur.unit,
        qtyOnHand: newQty, reorderLevel: Number(cur.reorder_level),
        unitCost: newCost, estateId: cur.estate_id, version: Number(cur.version) + 1,
      });
    }
  }
  return { grn, updatedStock: updated };
}

/** Issue stock out (e.g. fertilizer applied to a field). Reduces on-hand. */
export async function issueStock(input: {
  stockItemId: string;
  qty: number;
  performedBy: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
}): Promise<StockItem | null> {
  if (!supabaseConfigured) {
    const idx = mockStock.findIndex(s => s.id === input.stockItemId);
    if (idx === -1) return null;
    const s = mockStock[idx];
    s.qtyOnHand = Math.max(0, s.qtyOnHand - input.qty);
    s.version += 1;
    mockMoves.unshift({
      id: uid(), stockItemId: input.stockItemId, moveType: "out",
      qty: input.qty, unitCost: s.unitCost,
      referenceType: input.referenceType, referenceId: input.referenceId,
      performedBy: input.performedBy, performedAt: now(),
      notes: input.notes,
    });
    return s;
  }
  const sb = getSupabase()!;
  const { data: cur } = await sb.from("stock_items").select("*").eq("id", input.stockItemId).single();
  if (!cur) return null;
  const newQty = Math.max(0, Number(cur.qty_on_hand) - input.qty);
  await sb.from("stock_items").update({ qty_on_hand: newQty })
    .eq("id", input.stockItemId);
  await sb.from("stock_movements").insert({
    stock_item_id: input.stockItemId, move_type: "out",
    qty: input.qty, unit_cost: Number(cur.unit_cost),
    reference_type: input.referenceType, reference_id: input.referenceId,
    performed_by: input.performedBy, performed_at: now(),
    notes: input.notes,
  });
  return {
    id: cur.id, code: cur.code, name: cur.name, category: cur.category,
    unit: cur.unit, qtyOnHand: newQty, reorderLevel: Number(cur.reorder_level),
    unitCost: Number(cur.unit_cost), estateId: cur.estate_id,
    version: Number(cur.version) + 1,
  };
}

export async function listStockMovements(stockItemId?: string): Promise<StockMovement[]> {
  if (!supabaseConfigured) {
    return stockItemId ? mockMoves.filter(m => m.stockItemId === stockItemId) : mockMoves;
  }
  const sb = getSupabase()!;
  let q = sb.from("stock_movements").select("*").order("performed_at", { ascending: false });
  if (stockItemId) q = q.eq("stock_item_id", stockItemId);
  const { data, error } = await q;
  if (error) throw new Error(`listStockMovements: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    stockItemId: r.stock_item_id as string,
    moveType: r.move_type as StockMoveType,
    qty: Number(r.qty), unitCost: Number(r.unit_cost),
    referenceType: r.reference_type as string | undefined,
    referenceId: r.reference_id as string | undefined,
    fromEstateId: r.from_estate_id as string | undefined,
    toEstateId: r.to_estate_id as string | undefined,
    performedBy: r.performed_by as string | undefined,
    performedAt: r.performed_at as string,
    notes: r.notes as string | undefined,
  }));
}

// ============================================================================
// 7 · LOYALTY PROGRAM — members + points ledger + rewards + redemptions
// ============================================================================
import type {
  LoyaltyMemberFull, LoyaltyPointsEntry, LoyaltyReward, LoyaltyRedemption,
  LoyaltyTier, LoyaltyTxnType, RedemptionStatus,
  tierForPoints, badgeForPoints,
} from "./data";
import { tierForPoints as _tierForPoints, badgeForPoints as _badgeForPoints } from "./data";

const mockMembers: LoyaltyMemberFull[] = [];
const mockLedger: LoyaltyPointsEntry[] = [];
const mockRewards: LoyaltyReward[] = [
  { id: "rw1", code: "RWD-TSHIRT",   name: "Branded T-Shirt",         description: "Verda-branded cotton t-shirt",          category: "merchandise", pointsCost: 500,  cashValue: 0,    stockQty: 50, isActive: true, version: 1 },
  { id: "rw2", code: "RWD-CAP",      name: "Cap",                     description: "Verda-branded cap",                     category: "merchandise", pointsCost: 300,  cashValue: 0,    stockQty: 50, isActive: true, version: 1 },
  { id: "rw3", code: "RWD-FLASK",    name: "Steel Flask",             description: "500ml insulated steel flask",           category: "merchandise", pointsCost: 800,  cashValue: 0,    stockQty: 30, isActive: true, version: 1 },
  { id: "rw4", code: "RWD-CASH-500", name: "Rs 500 Cash Bonus",       description: "Cash bonus added to next payroll",      category: "cash",        pointsCost: 1000, cashValue: 500,  stockQty: -1, isActive: true, version: 1 },
  { id: "rw5", code: "RWD-CASH-1K",  name: "Rs 1,000 Cash Bonus",     description: "Cash bonus added to next payroll",      category: "cash",        pointsCost: 2000, cashValue: 1000, stockQty: -1, isActive: true, version: 1 },
  { id: "rw6", code: "RWD-Voucher",  name: "Co-op Voucher Rs 750",    description: "Redeemable at estate cooperative shop", category: "voucher",     pointsCost: 1500, cashValue: 750,  stockQty: -1, isActive: true, version: 1 },
  { id: "rw7", code: "RWD-DAYOFF",   name: "Paid Day Off",            description: "One paid day off — redeem with manager",category: "experience",  pointsCost: 1800, cashValue: 0,    stockQty: -1, isActive: true, version: 1 },
  { id: "rw8", code: "RWD-LUNCH",    name: "Family Lunch at Factory", description: "Lunch for 4 at factory canteen",        category: "experience",  pointsCost: 1200, cashValue: 0,    stockQty: 20, isActive: true, version: 1 },
];
const mockRedemptions: LoyaltyRedemption[] = [];

function rowToMember(r: Record<string, unknown>): LoyaltyMemberFull {
  return {
    id: r.id as string,
    workerId: r.worker_id as string | undefined,
    workerName: r.worker_name as string,
    points: Number(r.points ?? 0),
    tier: r.tier as LoyaltyTier,
    streakDays: Number(r.streak_days ?? 0),
    badge: r.badge as string,
    totalEarned: Number(r.total_earned ?? 0),
    totalBurned: Number(r.total_burned ?? 0),
    lastAwardedAt: r.last_awarded_at as string | undefined,
    lastAwardedReason: r.last_awarded_reason as string | undefined,
    status: r.status as "active" | "suspended",
    version: Number(r.version ?? 1),
    createdAt: r.created_at as string,
  };
}

function rowToReward(r: Record<string, unknown>): LoyaltyReward {
  return {
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    description: r.description as string | undefined,
    category: r.category as LoyaltyReward["category"],
    pointsCost: Number(r.points_cost ?? 0),
    cashValue: Number(r.cash_value ?? 0),
    stockQty: Number(r.stock_qty ?? -1),
    imageUrl: r.image_url as string | undefined,
    isActive: Boolean(r.is_active),
    estateId: r.estate_id as string | undefined,
    version: Number(r.version ?? 1),
  };
}

function rowToRedemption(r: Record<string, unknown>): LoyaltyRedemption {
  return {
    id: r.id as string,
    redemptionCode: r.redemption_code as string,
    memberId: r.member_id as string,
    workerName: r.worker_name as string | undefined,
    rewardId: r.reward_id as string,
    rewardName: r.reward_name as string | undefined,
    pointsCost: Number(r.points_cost ?? 0),
    cashValue: Number(r.cash_value ?? 0),
    status: r.status as RedemptionStatus,
    redeemedAt: r.redeemed_at as string,
    approvedBy: r.approved_by as string | undefined,
    approvedAt: r.approved_at as string | undefined,
    fulfilledAt: r.fulfilled_at as string | undefined,
    notes: r.notes as string | undefined,
    version: Number(r.version ?? 1),
  };
}

// ----- Members -----

export async function listLoyaltyMembers(): Promise<LoyaltyMemberFull[]> {
  if (!supabaseConfigured) {
    return [...mockMembers].sort((a, b) => b.points - a.points);
  }
  const sb = getSupabase()!;
  const { data, error } = await sb.from("loyalty_members").select("*").order("points", { ascending: false });
  if (error) throw new Error(`listLoyaltyMembers: ${error.message}`);
  return (data ?? []).map(rowToMember);
}

export async function createLoyaltyMember(input: {
  workerName: string;
  workerId?: string;
  estateId?: string;
  initialPoints?: number;
}): Promise<LoyaltyMemberFull> {
  const initialPoints = input.initialPoints ?? 0;
  const tier = _tierForPoints(initialPoints);
  const badge = _badgeForPoints(initialPoints);
  if (!supabaseConfigured) {
    const m: LoyaltyMemberFull = {
      id: uid(), workerId: input.workerId, workerName: input.workerName,
      points: initialPoints, tier, streakDays: 0, badge,
      totalEarned: initialPoints, totalBurned: 0,
      status: "active", version: 1, createdAt: now(),
    };
    mockMembers.unshift(m);
    if (initialPoints > 0) {
      mockLedger.unshift({
        id: uid(), memberId: m.id, workerName: m.workerName,
        points: initialPoints, transactionType: "bonus",
        reason: "Initial signup bonus", referenceType: "manual",
        awardedAt: now(),
      });
    }
    return m;
  }
  const sb = getSupabase()!;
  const { data, error } = await sb.from("loyalty_members").insert({
    worker_name: input.workerName, worker_id: input.workerId, estate_id: input.estateId,
    points: initialPoints, tier, badge, total_earned: initialPoints,
    status: "active",
  }).select().single();
  if (error) throw new Error(`createLoyaltyMember: ${error.message}`);
  const member = rowToMember(data);
  if (initialPoints > 0) {
    await sb.from("loyalty_points_ledger").insert({
      member_id: member.id, worker_name: member.workerName,
      points: initialPoints, transaction_type: "bonus",
      reason: "Initial signup bonus", reference_type: "manual",
      awarded_at: now(),
    });
  }
  return member;
}

/**
 * Award (or deduct) points to a member.
 * - Positive `points` = earn
 * - Negative `points` = burn / deduction
 * Updates member.points + total_earned/total_burned + tier + badge + last_awarded_*
 * Logs to loyalty_points_ledger.
 * Uses optimistic concurrency on member.version.
 */
export async function awardPoints(input: {
  memberId: string;
  points: number;             // + earn, - burn
  reason: string;
  transactionType?: LoyaltyTxnType;
  referenceType?: string;
  referenceId?: string;
  awardedBy?: string;
  expectedVersion: number;
}): Promise<OptimisticUpdateResult<LoyaltyMemberFull>> {
  const txnType = input.transactionType ?? (input.points >= 0 ? "earn" : "burn");

  if (!supabaseConfigured) {
    const idx = mockMembers.findIndex(m => m.id === input.memberId);
    if (idx === -1) return { resolution: "not_found" };
    const m = mockMembers[idx];
    if (m.version !== input.expectedVersion) return { resolution: "conflict", current: m };

    const newPoints = Math.max(0, m.points + input.points);
    if (input.points > 0) m.totalEarned += input.points;
    else m.totalBurned += Math.abs(input.points);
    m.points = newPoints;
    m.tier = _tierForPoints(newPoints);
    m.badge = _badgeForPoints(newPoints);
    m.lastAwardedAt = now();
    m.lastAwardedReason = input.reason;
    m.version += 1;

    mockLedger.unshift({
      id: uid(), memberId: m.id, workerName: m.workerName,
      points: input.points, transactionType: txnType,
      reason: input.reason, referenceType: input.referenceType,
      referenceId: input.referenceId, awardedBy: input.awardedBy,
      awardedAt: now(),
    });
    return { resolution: "updated", updated: m };
  }

  const sb = getSupabase()!;
  // 1) Fetch current
  const { data: cur } = await sb.from("loyalty_members").select("*").eq("id", input.memberId).single();
  if (!cur) return { resolution: "not_found" };
  if (Number(cur.version) !== input.expectedVersion) return { resolution: "conflict", current: rowToMember(cur) };

  const newPoints = Math.max(0, Number(cur.points) + input.points);
  const newTier = _tierForPoints(newPoints);
  const newBadge = _badgeForPoints(newPoints);
  const newEarned = Number(cur.total_earned) + (input.points > 0 ? input.points : 0);
  const newBurned = Number(cur.total_burned) + (input.points < 0 ? Math.abs(input.points) : 0);

  // 2) Update member (optimistic — WHERE version = expected)
  const { data: updated, error } = await sb.from("loyalty_members").update({
    points: newPoints, tier: newTier, badge: newBadge,
    total_earned: newEarned, total_burned: newBurned,
    last_awarded_at: now(), last_awarded_reason: input.reason,
  }).eq("id", input.memberId).eq("version", input.expectedVersion).select().single();
  if (error) throw new Error(`awardPoints: ${error.message}`);
  if (!updated) return { resolution: "conflict", current: rowToMember(cur) };

  // 3) Insert ledger entry
  await sb.from("loyalty_points_ledger").insert({
    member_id: input.memberId, worker_name: cur.worker_name,
    points: input.points, transaction_type: txnType,
    reason: input.reason, reference_type: input.referenceType,
    reference_id: input.referenceId, awarded_by: input.awardedBy,
    awarded_at: now(),
  });

  return { resolution: "updated", updated: rowToMember(updated) };
}

// ----- Points Ledger -----

export async function listPointsLedger(memberId?: string): Promise<LoyaltyPointsEntry[]> {
  if (!supabaseConfigured) {
    return memberId ? mockLedger.filter(l => l.memberId === memberId) : mockLedger;
  }
  const sb = getSupabase()!;
  let q = sb.from("loyalty_points_ledger").select("*").order("awarded_at", { ascending: false });
  if (memberId) q = q.eq("member_id", memberId);
  const { data, error } = await q;
  if (error) throw new Error(`listPointsLedger: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string, memberId: r.member_id as string,
    workerName: r.worker_name as string | undefined,
    points: Number(r.points), transactionType: r.transaction_type as LoyaltyTxnType,
    reason: r.reason as string, referenceType: r.reference_type as string | undefined,
    referenceId: r.reference_id as string | undefined,
    awardedBy: r.awarded_by as string | undefined,
    awardedAt: r.awarded_at as string,
  }));
}

// ----- Rewards Catalog -----

export async function listLoyaltyRewards(activeOnly = false): Promise<LoyaltyReward[]> {
  if (!supabaseConfigured) {
    return activeOnly ? mockRewards.filter(r => r.isActive) : mockRewards;
  }
  const sb = getSupabase()!;
  let q = sb.from("loyalty_rewards").select("*").order("points_cost", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(`listLoyaltyRewards: ${error.message}`);
  return (data ?? []).map(rowToReward);
}

export async function createLoyaltyReward(input: {
  code: string; name: string; description?: string;
  category: LoyaltyReward["category"]; pointsCost: number;
  cashValue?: number; stockQty?: number; imageUrl?: string;
}): Promise<LoyaltyReward> {
  if (!supabaseConfigured) {
    const r: LoyaltyReward = {
      id: uid(), code: input.code, name: input.name, description: input.description,
      category: input.category, pointsCost: input.pointsCost,
      cashValue: input.cashValue ?? 0, stockQty: input.stockQty ?? -1,
      imageUrl: input.imageUrl, isActive: true, version: 1,
    };
    mockRewards.push(r);
    return r;
  }
  const sb = getSupabase()!;
  const { data, error } = await sb.from("loyalty_rewards").insert({
    code: input.code, name: input.name, description: input.description,
    category: input.category, points_cost: input.pointsCost,
    cash_value: input.cashValue ?? 0, stock_qty: input.stockQty ?? -1,
    image_url: input.imageUrl, is_active: true,
  }).select().single();
  if (error) throw new Error(`createLoyaltyReward: ${error.message}`);
  return rowToReward(data);
}

export async function toggleRewardActive(rewardId: string, isActive: boolean, expectedVersion: number): Promise<OptimisticUpdateResult<LoyaltyReward>> {
  if (!supabaseConfigured) {
    const idx = mockRewards.findIndex(r => r.id === rewardId);
    if (idx === -1) return { resolution: "not_found" };
    if (mockRewards[idx].version !== expectedVersion) return { resolution: "conflict", current: mockRewards[idx] };
    mockRewards[idx].isActive = isActive;
    mockRewards[idx].version += 1;
    return { resolution: "updated", updated: mockRewards[idx] };
  }
  const sb = getSupabase()!;
  const { data, error } = await sb.from("loyalty_rewards")
    .update({ is_active: isActive }).eq("id", rewardId).eq("version", expectedVersion).select().single();
  if (error) throw new Error(`toggleRewardActive: ${error.message}`);
  if (!data) {
    const { data: cur } = await sb.from("loyalty_rewards").select("*").eq("id", rewardId).single();
    return { resolution: "conflict", current: cur ? rowToReward(cur) : undefined };
  }
  return { resolution: "updated", updated: rowToReward(data) };
}

// ----- Redemptions -----

export async function listRedemptions(status?: RedemptionStatus): Promise<LoyaltyRedemption[]> {
  if (!supabaseConfigured) {
    return status ? mockRedemptions.filter(r => r.status === status) : mockRedemptions;
  }
  const sb = getSupabase()!;
  let q = sb.from("loyalty_redemptions").select("*").order("redeemed_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(`listRedemptions: ${error.message}`);
  return (data ?? []).map(rowToRedemption);
}

/**
 * Member redeems a reward.
 * 1. Validates member has enough points
 * 2. Validates reward is active + in stock
 * 3. Burns points from member (calls awardPoints with negative)
 * 4. Creates redemption record with status='pending'
 * 5. (Optionally) decrements reward stock
 */
export async function redeemReward(input: {
  memberId: string;
  rewardId: string;
  notes?: string;
  expectedMemberVersion: number;
  expectedRewardVersion: number;
}): Promise<{ ok: boolean; redemption?: LoyaltyRedemption; error?: string }> {
  // 1) Fetch member + reward
  const members = await listLoyaltyMembers();
  const member = members.find(m => m.id === input.memberId);
  if (!member) return { ok: false, error: "Member not found" };

  const rewards = await listLoyaltyRewards();
  const reward = rewards.find(r => r.id === input.rewardId);
  if (!reward) return { ok: false, error: "Reward not found" };
  if (!reward.isActive) return { ok: false, error: "Reward is not active" };
  if (member.points < reward.pointsCost) return { ok: false, error: `Insufficient points (need ${reward.pointsCost}, have ${member.points})` };
  if (reward.stockQty !== -1 && reward.stockQty <= 0) return { ok: false, error: "Reward out of stock" };

  // 2) Burn points from member (optimistic)
  const burnResult = await awardPoints({
    memberId: input.memberId,
    points: -reward.pointsCost,
    reason: `Redeemed: ${reward.name}`,
    transactionType: "burn",
    referenceType: "redemption",
    awardedBy: member.workerId, // self-service
    expectedVersion: input.expectedMemberVersion,
  });
  if (burnResult.resolution !== "updated") {
    return { ok: false, error: burnResult.resolution === "conflict" ? "Member record was modified by another user. Please refresh." : "Member not found." };
  }

  // 3) Create redemption record
  const redemptionCode = `RDM-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
  if (!supabaseConfigured) {
    const r: LoyaltyRedemption = {
      id: uid(), redemptionCode, memberId: input.memberId,
      workerName: member.workerName, rewardId: input.rewardId,
      rewardName: reward.name, pointsCost: reward.pointsCost,
      cashValue: reward.cashValue, status: "pending",
      redeemedAt: now(), notes: input.notes, version: 1,
    };
    mockRedemptions.unshift(r);
    // Decrement stock
    if (reward.stockQty !== -1) {
      const idx = mockRewards.findIndex(x => x.id === input.rewardId);
      if (idx !== -1) mockRewards[idx].stockQty -= 1;
    }
    return { ok: true, redemption: r };
  }
  const sb = getSupabase()!;
  const { data, error } = await sb.from("loyalty_redemptions").insert({
    redemption_code: redemptionCode, member_id: input.memberId,
    worker_name: member.workerName, reward_id: input.rewardId,
    reward_name: reward.name, points_cost: reward.pointsCost,
    cash_value: reward.cashValue, status: "pending",
    redeemed_at: now(), notes: input.notes,
  }).select().single();
  if (error) {
    // Refund the points if redemption record creation failed
    await awardPoints({
      memberId: input.memberId, points: reward.pointsCost,
      reason: `Refund: redemption failed — ${reward.name}`,
      transactionType: "adjust", referenceType: "redemption_refund",
      expectedVersion: burnResult.updated!.version,
    });
    return { ok: false, error: `redeemReward: ${error.message}` };
  }
  // Decrement stock (if finite)
  if (reward.stockQty !== -1) {
    await sb.from("loyalty_rewards").update({ stock_qty: reward.stockQty - 1 })
      .eq("id", input.rewardId).eq("version", input.expectedRewardVersion);
  }
  return { ok: true, redemption: rowToRedemption(data) };
}

/**
 * Admin approves / rejects / fulfills a redemption.
 * Uses optimistic concurrency.
 */
export async function decideRedemption(input: {
  redemptionId: string;
  decision: "approved" | "rejected" | "fulfilled" | "cancelled";
  approverUid: string;
  notes?: string;
  expectedVersion: number;
}): Promise<OptimisticUpdateResult<LoyaltyRedemption>> {
  if (!supabaseConfigured) {
    const idx = mockRedemptions.findIndex(r => r.id === input.redemptionId);
    if (idx === -1) return { resolution: "not_found" };
    if (mockRedemptions[idx].version !== input.expectedVersion) return { resolution: "conflict", current: mockRedemptions[idx] };
    const r = mockRedemptions[idx];
    r.status = input.decision;
    if (input.decision === "approved") r.approvedAt = now();
    if (input.decision === "fulfilled") r.fulfilledAt = now();
    if (input.notes) r.notes = input.notes;
    r.approvedBy = input.approverUid;
    r.version += 1;

    // If rejected/cancelled → refund points
    if (input.decision === "rejected" || input.decision === "cancelled") {
      const member = mockMembers.find(m => m.id === r.memberId);
      if (member) {
        await awardPoints({
          memberId: member.id, points: r.pointsCost,
          reason: `Refund: redemption ${r.redemptionCode} ${input.decision}`,
          transactionType: "adjust", referenceType: "redemption_refund",
          awardedBy: input.approverUid, expectedVersion: member.version,
        });
      }
    }
    return { resolution: "updated", updated: r };
  }
  const sb = getSupabase()!;
  const patch: Record<string, unknown> = { status: input.decision, approved_by: input.approverUid };
  if (input.decision === "approved") patch.approved_at = now();
  if (input.decision === "fulfilled") patch.fulfilled_at = now();
  if (input.notes) patch.notes = input.notes;
  const { data, error } = await sb.from("loyalty_redemptions")
    .update(patch).eq("id", input.redemptionId).eq("version", input.expectedVersion).select().single();
  if (error) throw new Error(`decideRedemption: ${error.message}`);
  if (!data) {
    const { data: cur } = await sb.from("loyalty_redemptions").select("*").eq("id", input.redemptionId).single();
    return { resolution: "conflict", current: cur ? rowToRedemption(cur) : undefined };
  }
  const redemption = rowToRedemption(data);

  // Refund points if rejected/cancelled
  if (input.decision === "rejected" || input.decision === "cancelled") {
    const { data: m } = await sb.from("loyalty_members").select("*").eq("id", redemption.memberId).single();
    if (m) {
      await awardPoints({
        memberId: redemption.memberId, points: redemption.pointsCost,
        reason: `Refund: redemption ${redemption.redemptionCode} ${input.decision}`,
        transactionType: "adjust", referenceType: "redemption_refund",
        awardedBy: input.approverUid, expectedVersion: Number(m.version),
      });
    }
  }
  return { resolution: "updated", updated: redemption };
}
