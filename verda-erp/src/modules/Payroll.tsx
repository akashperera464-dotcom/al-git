import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Wallet, Plus, Loader2, CheckCircle2, Calendar, Users, FileText, Play, Check, Trophy, FileDown } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { fmtLKR, fmtLKRShort, workers as seedWorkers } from "@/lib/data";
import { exportObjectsToCSV } from "@/lib/csvExport";
import {
  listPayrollRuns, listPayslips, generatePayrollRun, approvePayrollRun,
  generatePayrollRunWithAllowances, approvePayrollRunWithJournal,
  listPayrollAllowances,
  generatePayrollRunWithAttendance, previewAttendanceForPayroll,
  listWorkersFull,
} from "@/lib/repo.phase2";
import { useApp } from "@/context/AppContext";
import type { PayrollRun, Payslip, WorkerFull } from "@/lib/data";

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
  const [workerSalaryOverrides, setWorkerSalaryOverrides] = useState<Record<string, { basic: number; ot: number; allowances: number; deductions: number; days: number; otRate: number }>>({});
  const [rosterWorkers, setRosterWorkers] = useState<WorkerFull[]>([]);
  const [attendancePreview, setAttendancePreview] = useState<Record<string, { days: number | null; otHours: number; otPay: number; kg: number }>>({});
  const [useAttendance, setUseAttendance] = useState(true);

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
      // Load worker roster (for the generate form)
      try {
        const ws = await listWorkersFull();
        setRosterWorkers(ws.filter(w => w.status === "active"));
      } catch {
        // fall back to seedWorkers if workers table not yet populated
      }
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
      const w = rosterWorkers.find(x => x.id === id);
      const basic = w?.basicSalary ?? 45000;
      setWorkerSalaryOverrides({ ...workerSalaryOverrides, [id]: { basic, ot: 0, allowances: 0, deductions: 0, days: 30, otRate: 250 } });
      // Fetch attendance preview for this worker
      if (useAttendance) {
        void previewAttendanceForPayroll({ workerId: id, periodMonth, periodYear, overtimeRatePerHour: 250 })
          .then(preview => {
            setAttendancePreview(prev => ({ ...prev, [id]: { days: preview.daysWorked, otHours: preview.overtimeHours, otPay: preview.overtimePay, kg: preview.kgPlucked } }));
          });
      }
    }
  };

  const refreshAttendancePreview = async () => {
    setBusy(true);
    try {
      const previews: Record<string, { days: number | null; otHours: number; otPay: number; kg: number }> = {};
      for (const id of Array.from(selectedWorkers)) {
        const o = workerSalaryOverrides[id];
        const otRate = o?.otRate ?? 250;
        const preview = await previewAttendanceForPayroll({ workerId: id, periodMonth, periodYear, overtimeRatePerHour: otRate });
        previews[id] = { days: preview.daysWorked, otHours: preview.overtimeHours, otPay: preview.overtimePay, kg: preview.kgPlucked };
      }
      setAttendancePreview(previews);
      setSuccess(`Attendance preview refreshed for ${Object.keys(previews).length} worker(s)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh attendance");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setError(null);
    setSuccess(null);
    if (selectedWorkers.size === 0) { setError("Select at least one worker"); return; }
    setBusy(true);
    try {
      const ws = Array.from(selectedWorkers).map(id => {
        const o = workerSalaryOverrides[id] ?? { basic: 0, ot: 0, allowances: 0, deductions: 0, days: 30, otRate: 250 };
        return {
          workerId: id,
          basicSalary: o.basic,
          overtimePay: o.ot || undefined,      // manual override (if 0, attendance-derived is used)
          deductions: o.deductions,
          daysWorked: o.days === 30 && useAttendance ? undefined : o.days,  // let attendance override if 30 default + useAttendance on
          overtimeRatePerHour: o.otRate,
        };
      });
      if (useAttendance) {
        // Use attendance-wired generator — auto-fetches daysWorked + OT from daily_attendance
        const { run, consumedAllowances, attendanceSourced } = await generatePayrollRunWithAttendance({
          runCode, periodMonth, periodYear, workers: ws,
        });
        await reload();
        setSelectedRun(run);
        setTab("runs");
        const s = await listPayslips(run.id);
        setPayslips(s);
        setSelectedWorkers(new Set());
        setAttendancePreview({});
        const parts: string[] = [];
        if (attendanceSourced > 0) parts.push(`${attendanceSourced} worker(s) days auto-sourced from attendance`);
        if (consumedAllowances > 0) parts.push(`${consumedAllowances} pending allowance(s) auto-consumed`);
        if (parts.length) setSuccess(`Payroll generated — ${parts.join(", ")}`);
        else setSuccess("Payroll generated");
      } else {
        // Use standard enhanced generator (manual daysWorked, no attendance lookup)
        const { run, consumedAllowances } = await generatePayrollRunWithAllowances({
          runCode, periodMonth, periodYear,
          workers: ws.map(w => ({ workerId: w.workerId, basicSalary: w.basicSalary, overtimePay: w.overtimePay, deductions: w.deductions, daysWorked: w.daysWorked })),
        });
        await reload();
        setSelectedRun(run);
        setTab("runs");
        const s = await listPayslips(run.id);
        setPayslips(s);
        setSelectedWorkers(new Set());
        setAttendancePreview({});
        if (consumedAllowances > 0) setSuccess(`Payroll generated — ${consumedAllowances} pending allowance(s) auto-consumed`);
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

                <div className="mt-4 flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-slate-800">Payslips</h3>
                  {payslips.length > 0 && (
                    <button onClick={() => exportObjectsToCSV(`payslips_${selectedRun?.runCode ?? ""}`, payslips.map(p => ({
                      worker_id: p.workerId, basic: p.basicSalary, ot: p.overtimePay,
                      allowances: p.allowances, gross: p.grossPay, epf_emp: p.epfEmployee,
                      epf_er: p.epfEmployer, etf_er: p.etfEmployer, deductions: p.deductions,
                      net: p.netPay, days: p.daysWorked,
                    })))}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                      <FileDown className="h-3 w-3" /> Export CSV
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
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

          {/* Attendance wire toggle */}
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-sky-50 p-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-sky-800">
              <input type="checkbox" checked={useAttendance} onChange={e => setUseAttendance(e.target.checked)} className="accent-sky-600" />
              <Calendar className="h-3.5 w-3.5" />
              Auto-fetch days worked + OT from Attendance module
            </label>
            {useAttendance && selectedWorkers.size > 0 && (
              <button onClick={refreshAttendancePreview} disabled={busy}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-50">
                Refresh Attendance Preview
              </button>
            )}
            {useAttendance && (
              <span className="text-[10px] text-sky-600">
                Days = present + (half_day × 0.5) from {periodYear}-{String(periodMonth).padStart(2, "0")}
              </span>
            )}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-medium text-slate-400">
              Select workers &amp; enter salary components
              {rosterWorkers.length > 0
                ? ` (${rosterWorkers.length} active workers from HR)`
                : ` (showing ${seedWorkers.length} seed workers — run the worker/attendance SQL migration + add workers in Labor module to see real data)`}
            </p>
            <div className="space-y-2">
              {(rosterWorkers.length > 0 ? rosterWorkers : seedWorkers).map(w => {
                const wid = w.id;
                const selected = selectedWorkers.has(wid);
                const o = workerSalaryOverrides[wid] ?? { basic: ("basicSalary" in w ? w.basicSalary : 45000) as number, ot: 0, allowances: 0, deductions: 0, days: 30, otRate: 250 };
                const att = attendancePreview[wid];
                return (
                  <div key={wid} className={`rounded-lg border p-2.5 transition ${selected ? "border-emerald-300 bg-emerald-50/50" : "border-slate-100"}`}>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={selected} onChange={() => toggleWorker(wid)} className="accent-emerald-600" />
                        <span className="text-sm font-semibold text-slate-800">{w.name}</span>
                        <Badge tone="slate">{w.role}</Badge>
                        {("epfNumber" in w && w.epfNumber) && <span className="text-[10px] text-slate-400">EPF: {w.epfNumber}</span>}
                      </label>
                    </div>
                    {selected && (
                      <>
                        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-6">
                          <div>
                            <label className="text-[10px] text-slate-400">Basic</label>
                            <input type="number" value={o.basic} onChange={e => setWorkerSalaryOverrides({ ...workerSalaryOverrides, [wid]: { ...o, basic: +e.target.value } })}
                              className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs tnum" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">OT Pay (override)</label>
                            <input type="number" value={o.ot} onChange={e => setWorkerSalaryOverrides({ ...workerSalaryOverrides, [wid]: { ...o, ot: +e.target.value } })}
                              placeholder={att?.otPay ? `auto: ${att.otPay}` : "0"}
                              className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs tnum" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">OT Rate/hr</label>
                            <input type="number" value={o.otRate} onChange={e => setWorkerSalaryOverrides({ ...workerSalaryOverrides, [wid]: { ...o, otRate: +e.target.value } })}
                              className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs tnum" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">Deductions</label>
                            <input type="number" value={o.deductions} onChange={e => setWorkerSalaryOverrides({ ...workerSalaryOverrides, [wid]: { ...o, deductions: +e.target.value } })}
                              className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs tnum" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">Days (override)</label>
                            <input type="number" value={o.days} onChange={e => setWorkerSalaryOverrides({ ...workerSalaryOverrides, [wid]: { ...o, days: +e.target.value } })}
                              placeholder={att?.days !== null && att?.days !== undefined ? `auto: ${att.days}` : "30"}
                              className="w-full rounded border border-slate-200 px-1.5 py-1 text-xs tnum" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400">Allowances (auto)</label>
                            <input type="number" value={o.allowances} disabled
                              className="w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs tnum text-slate-400" />
                          </div>
                        </div>
                        {/* Attendance preview row */}
                        {useAttendance && att && (
                          <div className="mt-1.5 flex flex-wrap gap-2 rounded bg-sky-50 px-2 py-1 text-[10px] text-sky-700">
                            {att.days !== null ? (
                              <>
                                <span>📊 Attendance: <strong>{att.days} days</strong> worked</span>
                                <span>⏱ OT: <strong>{att.otHours}h</strong> → Rs {att.otPay}</span>
                                {att.kg > 0 && <span>🍃 Plucked: <strong>{att.kg} kg</strong></span>}
                              </>
                            ) : (
                              <span className="text-amber-600">⚠ No attendance records for this period — will default to 30 days</span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={generate} disabled={busy || selectedWorkers.size === 0}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition enabled:hover:brightness-110 disabled:opacity-50">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            Generate Run for {selectedWorkers.size} worker(s){useAttendance && " (with attendance + allowances auto-sourced)"}
          </button>
        </Card>
      )}
    </div>
  );
}
