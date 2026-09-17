/**
 * KDU TEA FACTORY · PDF Export Templates
 * ------------------------------------------------------------------
 * Generates professional PDFs using jsPDF + jspdf-autotable.
 * Templates: Payslip, Trial Balance, Auction Settlement.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND_COLOR: [number, number, number] = [16, 185, 129]; // emerald-600
const DARK: [number, number, number] = [30, 41, 59]; // slate-800

function header(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, 210, 25, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("KDU TEA FACTORY", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(title, 14, 18);
  doc.text(subtitle, 14, 22);
  doc.setTextColor(...DARK);
}

function footer(doc: jsPDF) {
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated ${new Date().toLocaleString()} · KDU TEA FACTORY`, 14, pageHeight - 8);
  doc.text("Page 1", 196, pageHeight - 8, { align: "right" });
}

/** Export a single payslip as PDF */
export function exportPayslipPDF(input: {
  workerName: string; workerId: string; runCode: string;
  period: string; basicSalary: number; overtimePay: number; allowances: number;
  grossPay: number; epfEmployee: number; epfEmployer: number; etfEmployer: number;
  deductions: number; netPay: number; daysWorked: number;
}) {
  const doc = new jsPDF();
  header(doc, "Payslip", `${input.runCode} · ${input.period}`);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(input.workerName, 14, 35);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Worker ID: ${input.workerId}`, 14, 41);
  doc.text(`Period: ${input.period}`, 14, 46);
  doc.text(`Days Worked: ${input.daysWorked}`, 14, 51);

  autoTable(doc, {
    startY: 58,
    head: [["Earnings", "Amount (Rs)", "Deductions", "Amount (Rs)"]],
    body: [
      ["Basic Salary", input.basicSalary.toLocaleString(), "EPF Employee (8%)", input.epfEmployee.toLocaleString()],
      ["Overtime Pay", input.overtimePay.toLocaleString(), "Other Deductions", input.deductions.toLocaleString()],
      ["Allowances", input.allowances.toLocaleString(), "", ""],
      ["", "", "", ""],
      ["Gross Pay", input.grossPay.toLocaleString(), "Total Deductions", (input.epfEmployee + input.deductions).toLocaleString()],
    ],
    foot: [["", "", "NET PAY", `Rs ${input.netPay.toLocaleString()}`]],
    theme: "grid",
    headStyles: { fillColor: BRAND_COLOR, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    footStyles: { fillColor: DARK, fontSize: 11, fontStyle: "bold" },
  });

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("Employer Contributions (not deducted from employee):", 14, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10);
  doc.text(`EPF Employer (12%): Rs ${input.epfEmployer.toLocaleString()}    ETF Employer (3%): Rs ${input.etfEmployer.toLocaleString()}`, 14, (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15);

  footer(doc);
  doc.save(`payslip_${input.workerName}_${input.runCode}.pdf`);
}

/** Export trial balance as PDF */
export function exportTrialBalancePDF(input: {
  items: { code: string; name: string; type: string; debit: number; credit: number }[];
}) {
  const doc = new jsPDF();
  header(doc, "Trial Balance", "Posted entries only");

  autoTable(doc, {
    startY: 30,
    head: [["Code", "Account", "Type", "Debit (Rs)", "Credit (Rs)"]],
    body: input.items.map(i => [
      i.code, i.name, i.type,
      i.debit > 0 ? i.debit.toLocaleString() : "—",
      i.credit > 0 ? i.credit.toLocaleString() : "—",
    ]),
    foot: [[
      "", "", "Total",
      input.items.reduce((s, i) => s + i.debit, 0).toLocaleString(),
      input.items.reduce((s, i) => s + i.credit, 0).toLocaleString(),
    ]],
    theme: "striped",
    headStyles: { fillColor: BRAND_COLOR, fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    footStyles: { fillColor: DARK, fontSize: 9, fontStyle: "bold" },
  });

  footer(doc);
  doc.save("trial_balance.pdf");
}

/** Export auction settlement as PDF */
export function exportAuctionSettlementPDF(input: {
  lotNumber: string; brokerName: string; auctionDate: string;
  grade: string; qtyKg: number; soldPriceKg: number;
  grossSales: number; brokeragePct: number; brokerageAmount: number; netAmount: number;
}) {
  const doc = new jsPDF();
  header(doc, "Auction Settlement", `Lot ${input.lotNumber} · ${input.brokerName}`);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Lot ${input.lotNumber}`, 14, 35);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Broker: ${input.brokerName}`, 14, 42);
  doc.text(`Auction Date: ${input.auctionDate}`, 14, 47);
  doc.text(`Grade: ${input.grade}`, 14, 52);
  doc.text(`Quantity: ${input.qtyKg} kg`, 14, 57);

  autoTable(doc, {
    startY: 65,
    head: [["Description", "Amount (Rs)"]],
    body: [
      [`Sold Price per kg`, `Rs ${input.soldPriceKg.toLocaleString()}`],
      [`Gross Sales (${input.qtyKg} kg × Rs ${input.soldPriceKg})`, `Rs ${input.grossSales.toLocaleString()}`],
      [`Brokerage Commission (${input.brokeragePct}%)`, `− Rs ${input.brokerageAmount.toLocaleString()}`],
    ],
    foot: [["Net Amount to Factory", `Rs ${input.netAmount.toLocaleString()}`]],
    theme: "grid",
    headStyles: { fillColor: BRAND_COLOR, fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    footStyles: { fillColor: DARK, fontSize: 12, fontStyle: "bold" },
  });

  footer(doc);
  doc.save(`auction_settlement_${input.lotNumber}.pdf`);
}
