import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, FileSpreadsheet, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { addDays, fmtLKR, fmtNum, TODAY_ISO } from "@/lib/data";
import { exportObjectsToCSV } from "@/lib/csvExport";
import { exportTableToExcel } from "@/lib/excelExport";
import { exportTablePDF } from "@/lib/pdfExport";
import { useBranding } from "@/lib/branding";
import {
  getGrnReport,
  getIssueNoteReport,
  getStockMovementReport,
  type GrnReportRow,
  type IssueNoteReportRow,
  type StockMovementReportRow,
} from "@/lib/repo.phase2";

type ReportTab = "issue" | "grn" | "balance";
type ExportColumn = { key: string; header: string };

const issueColumns: ExportColumn[] = [
  { key: "date", header: "Date" }, { key: "issueNoteRef", header: "Issue Note Ref." },
  { key: "supplierNo", header: "Supplier No" }, { key: "route", header: "Route" },
  { key: "item", header: "Item" }, { key: "quantity", header: "QTY" },
  { key: "unitPrice", header: "Unit Price" }, { key: "amount", header: "Amount (Rs)" },
  { key: "status", header: "Status" },
];
const grnColumns: ExportColumn[] = [
  { key: "date", header: "Date" }, { key: "grnNo", header: "GRN No" },
  { key: "supplierName", header: "Supplier Name" }, { key: "item", header: "Item" },
  { key: "freeIssuedLabel", header: "Free Issued GRN" }, { key: "quantity", header: "QTY" },
  { key: "unitPrice", header: "Unit Price" }, { key: "amount", header: "Amount (Rs)" },
  { key: "status", header: "Status" },
];
const balanceColumns: ExportColumn[] = [
  { key: "code", header: "Item Code" }, { key: "name", header: "Description" },
  { key: "openingQty", header: "Opening QTY" }, { key: "openingValue", header: "Opening Amount (Rs)" },
  { key: "receivedQty", header: "GRN QTY" }, { key: "receivedValue", header: "GRN Amount (Rs)" },
  { key: "issuedQty", header: "Issued QTY" }, { key: "issuedValue", header: "Issued Amount (Rs)" },
  { key: "closingQty", header: "Closing QTY" }, { key: "closingValue", header: "Closing Amount (Rs)" },
];

function rowsForExport(tab: ReportTab, issueRows: IssueNoteReportRow[], grnRows: GrnReportRow[], balanceRows: StockMovementReportRow[]) {
  if (tab === "issue") return issueRows as unknown as Record<string, unknown>[];
  if (tab === "grn") return grnRows.map((row) => ({ ...row, freeIssuedLabel: row.freeIssued ? "Yes" : "No" })) as unknown as Record<string, unknown>[];
  return balanceRows as unknown as Record<string, unknown>[];
}

export default function InventoryReports() {
  const { branding } = useBranding();
  const [tab, setTab] = useState<ReportTab>("issue");
  const [startDate, setStartDate] = useState(addDays(TODAY_ISO, -30));
  const [endDate, setEndDate] = useState(TODAY_ISO);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issueRows, setIssueRows] = useState<IssueNoteReportRow[]>([]);
  const [grnRows, setGrnRows] = useState<GrnReportRow[]>([]);
  const [balanceRows, setBalanceRows] = useState<StockMovementReportRow[]>([]);

  const load = useCallback(async () => {
    if (startDate > endDate) { setError("Start date must be on or before end date"); return; }
    setBusy(true); setError(null);
    try {
      const [issues, grns, balances] = await Promise.all([
        getIssueNoteReport(startDate, endDate),
        getGrnReport(startDate, endDate),
        getStockMovementReport(startDate, endDate),
      ]);
      setIssueRows(issues); setGrnRows(grns); setBalanceRows(balances.filter((row) => row.category === "fertilizer"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load inventory reports");
    } finally { setBusy(false); }
  }, [startDate, endDate]);

  useEffect(() => { void load(); }, [load]);

  const filteredIssueRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return !term ? issueRows : issueRows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(term)));
  }, [issueRows, search]);
  const filteredGrnRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return !term ? grnRows : grnRows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(term)));
  }, [grnRows, search]);
  const filteredBalanceRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return !term ? balanceRows : balanceRows.filter((row) => `${row.code} ${row.name} ${row.category}`.toLowerCase().includes(term));
  }, [balanceRows, search]);

  const activeRows = rowsForExport(tab, filteredIssueRows, filteredGrnRows, filteredBalanceRows);
  const columns = tab === "issue" ? issueColumns : tab === "grn" ? grnColumns : balanceColumns;
  const title = tab === "issue" ? "Issue Note Report" : tab === "grn" ? "GRN Report" : "Fertilizer Stock Balance";
  const filename = `${title.toLowerCase().replace(/\s+/g, "_")}_${startDate}_${endDate}`;
  const excelRows = activeRows.map((row) => columns.map((column) => row[column.key] as string | number | boolean | null | undefined));

  const exportCsv = () => exportObjectsToCSV(filename, activeRows, columns);
  const exportExcel = () => exportTableToExcel(filename, title, columns.map((column) => column.header), excelRows);
  const exportPdf = () => exportTablePDF({
    title, subtitle: `${startDate} to ${endDate}`,
    companyName: branding.companyName || "Estate Pulse",
    columns, rows: activeRows, orientation: "l",
  });

  const totalQty = tab === "issue"
    ? filteredIssueRows.filter((row) => row.status === "active").reduce((sum, row) => sum + row.quantity, 0)
    : tab === "grn"
      ? filteredGrnRows.filter((row) => row.status === "active").reduce((sum, row) => sum + row.quantity, 0)
      : filteredBalanceRows.reduce((sum, row) => sum + row.closingQty, 0);
  const totalAmount = tab === "issue"
    ? filteredIssueRows.filter((row) => row.status === "active").reduce((sum, row) => sum + row.amount, 0)
    : tab === "grn"
      ? filteredGrnRows.filter((row) => row.status === "active").reduce((sum, row) => sum + row.amount, 0)
      : filteredBalanceRows.reduce((sum, row) => sum + row.closingValue, 0);

  return (
    <div className="mt-4 space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-slate-800"><FileSpreadsheet className="h-5 w-5 text-emerald-600" />Official Inventory Reports</h3>
            <p className="mt-1 text-xs text-slate-500">Live reports from the existing inventory ledger. No duplicate report data is stored.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCsv} disabled={!activeRows.length} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40">CSV</button>
            <button onClick={exportExcel} disabled={!activeRows.length} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-40">Excel</button>
            <button onClick={exportPdf} disabled={!activeRows.length} className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><FileDown className="h-3.5 w-3.5" />PDF</button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[11px] text-slate-500">From<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" /></label>
          <label className="text-[11px] text-slate-500">To<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" /></label>
          <label className="text-[11px] text-slate-500">Search<div className="relative mt-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ref, supplier, route, item…" className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-sm" /></div></label>
          <button onClick={() => void load()} disabled={busy} className="mt-auto inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />Refresh</button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {([['issue', 'Issue Note Report'], ['grn', 'GRN Report'], ['balance', 'Stock Balance']] as [ReportTab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setSearch(""); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${tab === id ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{label}</button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Displayed quantity</p><p className="mt-1 text-xl font-extrabold text-slate-800">{fmtNum(totalQty)}</p></Card>
        <Card className="p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Displayed amount</p><p className="mt-1 text-xl font-extrabold text-slate-800">{fmtLKR(totalAmount)}</p></Card>
      </div>

      <Card className="overflow-hidden p-0">
        {busy ? <p className="p-8 text-center text-sm text-slate-400">Loading report…</p> : activeRows.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">No matching records for this period.</p> : (
          <div className="overflow-x-auto">
            {tab === "issue" && <IssueTable rows={filteredIssueRows} />}
            {tab === "grn" && <GrnTable rows={filteredGrnRows} />}
            {tab === "balance" && <BalanceTable rows={filteredBalanceRows} />}
          </div>
        )}
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Free-issued GRNs increase physical quantity at Rs 0. Voids remain in the audit trail as compensating entries; original records are never deleted.</span>
      </div>
    </div>
  );
}

function IssueTable({ rows }: { rows: IssueNoteReportRow[] }) {
  return <table className="min-w-[900px] w-full text-xs"><thead><tr className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><th className="p-3">Date</th><th>Issue Note Ref.</th><th>Supplier No</th><th>Route</th><th>Item</th><th className="text-right">QTY</th><th className="text-right">Unit Price</th><th className="pr-3 text-right">Amount (Rs)</th></tr></thead><tbody>{rows.map((row) => <tr key={row.movementId} className={`border-t border-slate-100 ${row.status === "voided" ? "bg-rose-50 text-slate-400 line-through" : ""}`}><td className="p-3">{row.date}</td><td className="font-semibold">{row.issueNoteRef} {row.status === "voided" && <Badge tone="rose">VOID</Badge>}</td><td>{row.supplierNo}</td><td>{row.route}</td><td>{row.item}</td><td className="text-right tnum">{fmtNum(row.quantity)}</td><td className="text-right tnum">{fmtLKR(row.unitPrice)}</td><td className="pr-3 text-right font-semibold tnum">{fmtLKR(row.amount)}</td></tr>)}</tbody></table>;
}

function GrnTable({ rows }: { rows: GrnReportRow[] }) {
  return <table className="min-w-[900px] w-full text-xs"><thead><tr className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><th className="p-3">Date</th><th>GRN No</th><th>Supplier Name</th><th>Item</th><th>Free Issued</th><th className="text-right">QTY</th><th className="text-right">Unit Price</th><th className="pr-3 text-right">Amount (Rs)</th></tr></thead><tbody>{rows.map((row) => <tr key={row.movementId} className={`border-t border-slate-100 ${row.status === "voided" ? "bg-rose-50 text-slate-400 line-through" : ""}`}><td className="p-3">{row.date}</td><td className="font-semibold">{row.grnNo} {row.status === "voided" && <Badge tone="rose">VOID</Badge>}</td><td>{row.supplierName}</td><td>{row.item}</td><td>{row.freeIssued ? <Badge tone="amber">Yes · Rs 0</Badge> : "No"}</td><td className="text-right tnum">{fmtNum(row.quantity)}</td><td className="text-right tnum">{fmtLKR(row.unitPrice)}</td><td className="pr-3 text-right font-semibold tnum">{fmtLKR(row.amount)}</td></tr>)}</tbody></table>;
}

function BalanceTable({ rows }: { rows: StockMovementReportRow[] }) {
  return <table className="min-w-[1180px] w-full text-xs"><thead><tr className="bg-slate-50 text-left uppercase tracking-wide text-slate-500"><th rowSpan={2} className="p-3">Item Code</th><th rowSpan={2}>Description</th><th colSpan={2} className="text-center">Opening Balance</th><th colSpan={2} className="text-center">GRN</th><th colSpan={2} className="text-center">Issued</th><th colSpan={2} className="pr-3 text-center">Closing Balance</th></tr><tr className="border-t border-slate-200 bg-slate-50 text-slate-500"><th className="text-right">QTY</th><th className="text-right">Amount</th><th className="text-right">QTY</th><th className="text-right">Amount</th><th className="text-right">QTY</th><th className="text-right">Amount</th><th className="text-right">QTY</th><th className="pr-3 text-right">Amount</th></tr></thead><tbody>{rows.map((row) => <tr key={row.stockItemId} className="border-t border-slate-100"><td className="p-3 font-mono">{row.code}</td><td className="font-semibold">{row.name}</td><td className="text-right tnum">{fmtNum(row.openingQty)}</td><td className="text-right tnum">{fmtLKR(row.openingValue)}</td><td className="text-right tnum text-emerald-700">{fmtNum(row.receivedQty)}</td><td className="text-right tnum text-emerald-700">{fmtLKR(row.receivedValue)}</td><td className="text-right tnum text-rose-700">{fmtNum(row.issuedQty)}</td><td className="text-right tnum text-rose-700">{fmtLKR(row.issuedValue)}</td><td className="text-right font-bold tnum">{fmtNum(row.closingQty)}</td><td className="pr-3 text-right font-bold tnum">{fmtLKR(row.closingValue)}</td></tr>)}</tbody></table>;
}
