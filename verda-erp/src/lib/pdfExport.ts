/// <reference types="vite/client" />
/**
 * Verda · PDF Report Export Utility (Web Admin Panel)
 * ------------------------------------------------------------------
 * Uses jspdf + jspdf-autotable to generate formatted PDF reports from
 * any array of data objects (harvest logs, finance tables, payrolls, etc.).
 *
 * Usage:
 *   import { exportTablePDF } from "@/lib/pdfExport";
 *   exportTablePDF({ title: "Harvest Report", columns: [...], rows: [...] });
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface PDFColumn {
  header: string;
  key: string;
  width?: number; // relative column width
}

export interface PDFExportOptions {
  title: string;
  subtitle?: string;
  columns: PDFColumn[];
  rows: Record<string, unknown>[];
  /** Branding — read from Supabase settings if available. */
  companyName?: string;
  accentColor?: [number, number, number]; // RGB tuple
  /** Landscape or portrait. */
  orientation?: "p" | "l";
}

/**
 * Generate and download a formatted PDF report.
 */
export function exportTablePDF(opts: PDFExportOptions) {
  const {
    title,
    subtitle,
    columns,
    rows,
    companyName = "Verda ERP",
    accentColor = [16, 185, 129], // emerald
    orientation = "l",
  } = opts;

  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // ── Header band ──
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 0, pageWidth, 22, "F");

  // Company name (left).
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(companyName, margin, 10);

  // Title (left, below company name).
  doc.setFontSize(16);
  doc.text(title, margin, 18);

  // Timestamp (right).
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const timestamp = new Date().toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  doc.text(`Generated: ${timestamp}`, pageWidth - margin - 50, 10);

  // Subtitle (optional).
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, margin, 28);
  }

  // ── Auto Table ──
  const tableRows = rows.map((row) =>
    columns.map((col) => {
      const val = row[col.key];
      if (val === null || val === undefined) return "—";
      if (typeof val === "number") return val.toLocaleString("en-US");
      return String(val);
    })
  );

  autoTable(doc, {
    head: [columns.map((c) => c.header)],
    body: tableRows,
    startY: subtitle ? 32 : 28,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
      textColor: [51, 65, 85],
    },
    headStyles: {
      fillColor: accentColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],
    },
    columnStyles: columns.reduce((acc, col, i) => {
      if (col.width) {
        acc[i] = { cellWidth: col.width };
      }
      return acc;
    }, {} as Record<number, { cellWidth: number }>),
    didDrawPage: (data) => {
      // ── Footer (page number + total count) ──
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageCount = doc.getNumberOfPages();
      const currentPage = data.pageNumber;

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `${companyName} · Page ${currentPage} of ${pageCount}`,
        margin,
        pageHeight - 6
      );
      doc.text(
        `${rows.length} records`,
        pageWidth - margin - 30,
        pageHeight - 6
      );
    },
  });

  // ── Download ──
  const fileName = `${title.replace(/\s+/g, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

/**
 * Convenience: export the Estate Dashboard's harvest data as PDF.
 */
export function exportHarvestReport(rows: Record<string, unknown>[]) {
  exportTablePDF({
    title: "Green Leaf Harvest Report",
    subtitle: "Daily weigh-in records by collection center",
    columns: [
      { header: "Date", key: "weighed_at" },
      { header: "Supplier", key: "supplier_id" },
      { header: "Field", key: "field_id" },
      { header: "Net (kg)", key: "net_kg" },
      { header: "Grade", key: "grade" },
      { header: "Amount (Rs)", key: "amount" },
      { header: "Status", key: "status" },
    ],
    rows,
  });
}

/**
 * Convenience: export the Finance ledger as PDF.
 */
export function exportFinanceReport(rows: Record<string, unknown>[]) {
  exportTablePDF({
    title: "Finance & Accounting Ledger",
    subtitle: "General ledger entries — P&L summary",
    columns: [
      { header: "Account", key: "account" },
      { header: "Type", key: "entry_type" },
      { header: "Debit (Rs)", key: "debit" },
      { header: "Credit (Rs)", key: "credit" },
    ],
    rows,
  });
}

/**
 * Convenience: export the Payroll run as PDF.
 */
export function exportPayrollReport(rows: Record<string, unknown>[]) {
  exportTablePDF({
    title: "Payroll Run Report",
    subtitle: "Wage calculation with EPF/ETF deductions",
    columns: [
      { header: "Worker", key: "worker_name" },
      { header: "Days", key: "days" },
      { header: "Daily Wage", key: "daily_wage" },
      { header: "OT Pay", key: "ot_pay" },
      { header: "Incentive", key: "incentive" },
      { header: "Deductions", key: "deductions" },
      { header: "Net Pay", key: "net_pay" },
    ],
    rows,
  });
}
