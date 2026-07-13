import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Wallet, Plus, Loader2, CheckCircle2, Calendar, Users, FileText, Play, Check, Trophy } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { fmtLKR, fmtLKRShort, workers as seedWorkers } from "@/lib/data";
import {
  listPayrollRuns, listPayslips, generatePayrollRun, approvePayrollRun,
  generatePayrollRunWithAllowances, approvePayrollRunWithJournal,
  listPayrollAllowances,
} from "@/lib/repo.phase2";
import { useApp } from "@/context/AppContext";
import type { PayrollRun, Payslip, Worker } from "@/lib/data";

/**
 * Payroll System — Sri Lankan statutory EPF/ETF.
 *   EPF Employee: 8% deduction from gross
 *   EPF Employer: 12% contribution
 *   ETF Employer: 3% contribution
 * Workflow: draft → approved → paid.
 */
export default function Payroll() {
  const { t } = useTranslation();
  const { userUid } = useApp();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tab, setTab] = useState<"runs" | "generate">("runs");
  const [pendingAllowances, setPendingAllowances] = useState(0);

  // Generate-form state
  const now = new Date();
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [runCode, setRunCode] = useState(`PR-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());
  const [workerSalaryOverrides, setWorkerSalaryOverrides] = useState<Record<string, { basic: number; ot: number; allowances: number; deductions: number; days: number }>>({});

  const reload = async () => {
    setBusy(true);
    try {
      const r = await listPayrollRuns();
      setRuns(r);
      if (r.length > 0 && !selectedRun) {
        setSelectedRun(r[0]);
        const slips = await listPayslips(r[0].id);
        setPayslips(slips);
      }
      // Load pending (unconsumed) allowances — these will auto-flow into next payroll
      const allowances = await listPayrollAllowances(undefined, true);
      setPendingAllowances(allowances.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payroll");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const selectRun = async (r: PayrollRun) => {
    setSelectedRun(r);
    setBusy(true);
    try {
      const s = await listPayslips(r.id);
      setPayslips(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load payslips");
    } finally {
      setBusy(false);
    }
  };

  const toggleWorker = (id: string) => {
    const next = new Set(selectedWorkers);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedWorkers(next);
    if (!workerSalaryOverrides[id]) {
      const w = seedWorkers.find(x => x.id === id);
      setWorkerSalaryOverrides({ ...workerSalaryOverrides, [id]: { basic: w ? 45000 : 0, ot: 0, allowances: 0, deductions: 0, days: 30 } });
    }
  };

  const generate = async () => {
    setError(null);
    if (selectedWorkers.size === 0) { setError("Select at least one worker"); return; }
    setBusy(true);
    try {
      const ws = Array.from(selectedWorkers).map(id => {
        const o = workerSalaryOverrides[id] ?? { basic: 0, ot: 0, allowances: 0, deductions: 0, days: 30 };
        return { workerId: id, basicSalary: o.basic, overtimePay: o.ot, deductions: o.deductions, daysWorked: o.days };
      });
      // Use enhanced generator — auto-consumes pending allowances (loyalty cash bonuses etc.)
      const { run, consumedAllowances } = await generatePayrollRunWithAllowances({
        runCode, periodMonth, periodYear, workers: ws,
      });
      await reload();
      setSelectedRun(run);
      setTab("runs");
      const s = await listPayslips(run.id);
      setPayslips(s);
      setSelectedWorkers(new Set());
      if (consumedAllowances > 0) {
        setSuccess(`Payroll generated — ${consumedAllowances} pending allowance(s) auto-consumed`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate payroll");
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!selectedRun) return;
    setBusy(true);
    try {
      // Use enhanced approver — auto-posts journal entry to Finance
      const res = await approvePayrollRunWithJournal({
        runId: selectedRun.id,
        expectedVersion: selectedRun.version,
        approvedBy: userUid,
      });
      if (!res.ok) {
        setError(res.error ?? "Failed to approve run");
        await reload();
      } else {
        setSuccess(`Payroll approved — journal entry auto-posted to Finance (Wages/EPF/ETF/Cash)`);
        await reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve run");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Finance & Accounting"
        title="Payroll System"
        desc="Sri Lankan statutory payroll — EPF (8% employee / 12% employer) + ETF (3% employer). Generate, approve, pay."
        icon={<IconChip icon={Wallet} tone="emerald" className="h-12 w-12" />}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div>}
      {pendingAllowances > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
          <Trophy className="h-3.5 w-3.5" />
          <span><strong>{pendingAllowances}</strong> pending allowance(s) (loyalty cash bonuses / manual) will auto-flow into the next payroll run.</span>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-4 flex gap-2">
        {([
          { id: "runs", label: "Payroll Runs", icon: Calendar },
          { id: "generate", label: "Generate New", icon: Play },
        ] as const).map(t2 => {
          const Icon = t2.icon;
          const active = tab === t2.id;
          return (
            <button key={t2.id} onClick={() => setTab(t2.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${active ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              <Icon className="h-3.5 w-3.5" /> {t2.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Runs */}
      {tab === "runs" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1 p-3">
            <h3 className="mb-2 px-1 font-display text-sm font-bold text-slate-800">Runs</h3>
            {runs.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No payroll runs yet.</p>
            ) : (
              <div className="space-y-1.5">
                {runs.map(r => (
                  <button key={r.id} onClick={() => selectRun(r)}
                    className={`w-full rounded-lg border p-2.5 text-left transition ${selectedRun?.id === r.id ? "border-emerald-300 bg-emerald-50" : "border-slate-100 hover:bg-slate-50"}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-800">{r.runCode}</p>
                      <Badge tone={r.status === "paid" ? "emerald" : r.status === "approved" ? "sky" : "amber"} dot>{r.status}</Badge>
                    </div>
                    <p className="text-[11px] text-slate-400">{r.periodYear}-{String(r.periodMonth).padStart(2, "0")} · Net {fmtLKRShort(r.totalNet)}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card className="lg:col-span-2 p-4">
            {selectedRun ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold text-slate-800">{selectedRun.runCode}</h3>
                    <p className="text-[11px] text-slate-400">Period: {selectedRun.periodYear}-{String(selectedRun.periodMonth).padStart(2, "0")} · v{selectedRun.version}</p>
                  </div>
                  {selectedRun.status === "draft" && (
                    <button onClick={approve} disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-50">
                      <Check className="h-3.5 w-3.5" /> Approve Run
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatCard icon={Users} label="Payslips" value={String(payslips.length)} tone="sky" />
                  <StatCard icon={Wallet} label="Gross" value={fmtLKRShort(selectedRun.totalGross)} tone="emerald" />
                  <StatCard icon={Wallet} label="EPF (Emp 8%)" value={fmtLKRShort(selectedRun.totalEpf)} tone="rose" />
                  <StatCard icon={Wallet} label="Net Pay" value={fmtLKRShort(selectedRun.totalNet)} tone="emerald" />
                  <StatCard icon={Wallet} label="EPF (Er 12%)" value={fmtLKRShort(selectedRun.totalEmployerEpf)} tone="amber" />
                  <StatCard icon={Wallet} label="ETF (Er 3%)" value={fmtLKRShort(selectedRun.totalEtf)} tone="amber" />
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="pb-2">Worker ID</th>
                        <th className="pb-2 text-right">Basic</th>
                        <th className="pb-2 text-right">Gross</th>
                        <th className="pb-2 text-right">EPF 8%</th>
                        <th className="pb-2 text-right">Dedns</th>
                        <th className="pb-2 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payslips.map(p => (
                        <tr key={p.id} className="border-t border-slate-100">
                          <td className="py-2 font-mono text-xs text-slate-600">{p.workerId.slice(0, 8)}…</td>
                          <td className="py-2 text-right tnum">{fmtLKR(p.basicSalary)}</td>
                          <td className="py-2 text-right tnum font-semibold">{fmtLKR(p.grossPay)}</td>
                          <td className="py-2 text-right tnum text-rose-600">{fmtLKR(p.epfEmployee)}</td>
                          <td className="py-2 text-right tnum">{fmtLKR(p.deductions)}</td>
                          <td className="py-2 text-right tnum font-bold text-emerald-700">{fmtLKR(p.netPay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="py-12 text-center text-sm text-slate-400">Select a payroll run to view payslips.</p>
            )}
          </Card>
        </div>
      )}

      {/* Tab: Generate */}
      {tab === "generate" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Generate New Payroll Run</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[11px] font-medium text-slate-400">Run Code</label>
              <input value={runCode} onChange={e => setRunCode(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400">Month</label>
              <select value={periodMonth} onChange={e => setPeriodMonth(+e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm">
                {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400">Year</label>
              <input type="number" value={periodYear} onChange={e => setPeriodYear(+e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-medium text-slate-400">Select workers &amp; enter salary components</p>
            <div className="space-y-2">
              {seedWorkers.map(w => {
                const selected = selectedWorkers.has(w.id);
                const o = workerSalaryOverrides[w.id] ?? { basic: 45000, ot: 0, allowances: 0, deductions: 0, days: 30 };
                return (
                  <div key={w.id} className={`rounded-lg border p-2.5 transition ${selected ? "border-emerald-300 bg-emerald-50/50" : "border-slate-100"}`}>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={selected} onChange={() => toggleWorker(w.id)} className="accent-emerald-600" />
                        <span className="text-sm font-semibold text-slate-800">{w.name}</span>
                        <Badge tone="slate">{w.role}</Badge>
                      </label>
                    </div>
                    {selected && (
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <div>
                          <label className="text-[10px] text-slate-400">Basic</label>
                          <input type="number" value={o.basic} onChange={e => setWorkerSalaryOverrides({ ...workerSalaryOverrides, [w.id]: { ...o, basic: +e.target.value } })}
                            className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs tnum" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">OT</label>
                          <input type="number" value={o.ot} onChange={e => setWorkerSalaryOverrides({ ...workerSalaryOverrides, [w.id]: { ...o, ot: +e.target.value } })}
                            className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs tnum" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Allowances</label>
                          <input type="number" value={o.allowances} onChange={e => setWorkerSalaryOverrides({ ...workerSalaryOverrides, [w.id]: { ...o, allowances: +e.target.value } })}
                            className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs tnum" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Deductions</label>
                          <input type="number" value={o.deductions} onChange={e => setWorkerSalaryOverrides({ ...workerSalaryOverrides, [w.id]: { ...o, deductions: +e.target.value } })}
                            className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs tnum" />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Days</label>
                          <input type="number" value={o.days} onChange={e => setWorkerSalaryOverrides({ ...workerSalaryOverrides, [w.id]: { ...o, days: +e.target.value } })}
                            className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs tnum" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={generate} disabled={busy || selectedWorkers.size === 0}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition enabled:hover:brightness-110 disabled:opacity-50">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            Generate Run for {selectedWorkers.size} worker(s)
          </button>
        </Card>
      )}
    </div>
  );
}
