import { useEffect, useState } from "react";
import { Sprout, Plus, Loader2, TrendingDown, CheckCircle2 } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { fmtLKR, fmtLKRShort, fmtNum, type SupplierFertilizerLoan, type SupplierLoanType } from "@/lib/data";
import { listSupplierLoans, createSupplierLoan, applyLoanDeductionsToInvoice } from "@/lib/repo.phase2";
import { useApp } from "@/context/AppContext";

export default function SupplierLoans() {
  const { userUid } = useApp();
  const [loans, setLoans] = useState<SupplierFertilizerLoan[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    supplierId: "", supplierName: "", loanType: "fertilizer" as SupplierLoanType,
    itemName: "", quantity: 0, unit: "kg", unitCost: 0,
    monthlyInstallment: 0, totalInstallments: 6,
  });

  const reload = async () => {
    setBusy(true);
    try {
      setLoans(await listSupplierLoans());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const addLoan = async () => {
    setError(null);
    if (!form.supplierId.trim()) { setError("Supplier ID required"); return; }
    if (form.quantity <= 0 || form.unitCost <= 0) { setError("Quantity and unit cost must be > 0"); return; }
    if (form.monthlyInstallment <= 0) { setError("Monthly installment must be > 0"); return; }
    setBusy(true);
    try {
      await createSupplierLoan({
        supplierId: form.supplierId, supplierName: form.supplierName || undefined,
        loanType: form.loanType, itemName: form.itemName || undefined,
        quantity: form.quantity, unit: form.unit, unitCost: form.unitCost,
        monthlyInstallment: form.monthlyInstallment, totalInstallments: form.totalInstallments,
      });
      const principal = (form.quantity * form.unitCost).toFixed(2);
      setSuccess(`Loan created: ${form.itemName || form.loanType} — Rs ${fmtLKRShort(+principal)} for ${form.supplierName || form.supplierId}`);
      setForm({ supplierId: "", supplierName: "", loanType: "fertilizer", itemName: "", quantity: 0, unit: "kg", unitCost: 0, monthlyInstallment: 0, totalInstallments: 6 });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const applyDeductions = async (supplierId: string) => {
    setBusy(true);
    try {
      const result = await applyLoanDeductionsToInvoice({ supplierId, invoiceId: `manual-${Date.now()}` });
      setSuccess(`Applied Rs ${fmtLKRShort(result.totalDeducted)} in loan deductions for supplier. ${result.deductions.length} loan(s) updated.`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const activeLoans = loans.filter(l => l.status === "active");
  const totalBalance = activeLoans.reduce((s, l) => s + l.balance, 0);
  const totalMonthly = activeLoans.reduce((s, l) => s + l.monthlyInstallment, 0);
  const clearedLoans = loans.filter(l => l.status === "cleared").length;

  const principal = form.quantity * form.unitCost;

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Supplier Fertilizer & Chemical Loans"
        desc="Track fertilizer, agrochemical, tea packet, and cash advances given to suppliers. Monthly installments auto-deduct from supplier payouts."
        icon={<IconChip icon={Sprout} tone="amber" className="h-12 w-12" />}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Sprout} label="Active Loans" value={String(activeLoans.length)} tone="amber" />
        <StatCard icon={TrendingDown} label="Total Balance" value={fmtLKRShort(totalBalance)} tone="rose" />
        <StatCard icon={TrendingDown} label="Monthly Deductions" value={fmtLKRShort(totalMonthly)} tone="amber" />
        <StatCard icon={CheckCircle2} label="Cleared" value={String(clearedLoans)} tone="emerald" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Issue New Loan</h3>
          <div className="space-y-2">
            <input value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })} placeholder="Supplier ID *" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            <input value={form.supplierName} onChange={e => setForm({ ...form, supplierName: e.target.value })} placeholder="Supplier Name" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            <select value={form.loanType} onChange={e => setForm({ ...form, loanType: e.target.value as SupplierLoanType })} className="w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
              <option value="fertilizer">Fertilizer</option>
              <option value="agrochemical">Agrochemical</option>
              <option value="tea_packet">Tea Packets</option>
              <option value="cash_advance">Cash Advance</option>
            </select>
            <input value={form.itemName} onChange={e => setForm({ ...form, itemName: e.target.value })} placeholder="Item name (e.g. Urea 50kg)" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            <div className="grid grid-cols-3 gap-2">
              <input type="number" value={form.quantity || ""} onChange={e => setForm({ ...form, quantity: +e.target.value })} placeholder="Qty" className="rounded-lg border border-slate-200 px-2 py-2 text-sm tnum" />
              <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="Unit" className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
              <input type="number" value={form.unitCost || ""} onChange={e => setForm({ ...form, unitCost: +e.target.value })} placeholder="Cost/unit" className="rounded-lg border border-slate-200 px-2 py-2 text-sm tnum" />
            </div>
            <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
              Principal: <strong>{fmtLKR(principal)}</strong>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" value={form.monthlyInstallment || ""} onChange={e => setForm({ ...form, monthlyInstallment: +e.target.value })} placeholder="Monthly installment" className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
              <input type="number" value={form.totalInstallments} onChange={e => setForm({ ...form, totalInstallments: +e.target.value })} placeholder="Total installments" className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
            </div>
            <button onClick={addLoan} disabled={busy} className="w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Issue Loan</button>
          </div>
        </Card>

        <Card className="lg:col-span-2 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Active Loans ({activeLoans.length})</h3>
          {loans.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No supplier loans yet.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {loans.map(l => (
                <div key={l.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{l.supplierName ?? l.supplierId}</p>
                      <p className="text-[11px] text-slate-400">
                        {l.loanType} · {l.itemName ? `${l.itemName} · ` : ""}Issued {l.issuedDate}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-500">
                        <span>Principal: {fmtLKR(l.principalAmount)}</span>
                        <span>Monthly: {fmtLKR(l.monthlyInstallment)}</span>
                        <span>Balance: <strong className="text-rose-600">{fmtLKR(l.balance)}</strong></span>
                        <span>Paid: {l.installmentsPaid}/{l.totalInstallments}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone={l.status === "active" ? "amber" : l.status === "cleared" ? "emerald" : "rose"} dot>{l.status}</Badge>
                      {l.status === "active" && (
                        <button onClick={() => applyDeductions(l.supplierId)} disabled={busy}
                          className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-110">
                          Apply Deduction
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
