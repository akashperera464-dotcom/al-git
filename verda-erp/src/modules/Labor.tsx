import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, Plus, Loader2, CalendarDays, CheckCircle2, XCircle, Phone, MapPin, CreditCard, Award, Briefcase } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { workers as seedWorkers, fmtLKR, type Worker, type LeaveType, type LeaveStatus, type LeaveRequest } from "@/lib/data";
import {
  listLeaveRequests, createLeaveRequest, decideLeaveRequest,
} from "@/lib/repo.phase2";
import { useApp } from "@/context/AppContext";

/**
 * Labor Management enhanced with HR fields — worker master + leave requests.
 * Worker master fields (epf_number, hire_date, basic_salary, bank details) are
 * stored on the `workers` table (added via SQL migration). Leave requests are
 * stored on the new `leave_requests` table with optimistic concurrency.
 */
export default function Labor() {
  const { t } = useTranslation();
  const { userUid } = useApp();
  const [tab, setTab] = useState<"roster" | "leave">("roster");
  const [selected, setSelected] = useState<Worker | null>(null);
  const [leaveReqs, setLeaveReqs] = useState<LeaveRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Leave request form
  const [leaveWorkerId, setLeaveWorkerId] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [leaveStart, setLeaveStart] = useState(new Date().toISOString().slice(0, 10));
  const [leaveEnd, setLeaveEnd] = useState(new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState("");

  const reloadLeave = async () => {
    setBusy(true);
    try {
      setLeaveReqs(await listLeaveRequests());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leave requests");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reloadLeave(); }, []);

  const submitLeave = async () => {
    setError(null);
    if (!leaveWorkerId) { setError("Select a worker"); return; }
    if (new Date(leaveEnd) < new Date(leaveStart)) { setError("End date must be on or after start date"); return; }
    setBusy(true);
    try {
      await createLeaveRequest({
        workerId: leaveWorkerId, leaveType,
        startDate: leaveStart, endDate: leaveEnd, reason: leaveReason.trim() || undefined,
      });
      setLeaveReason("");
      await reloadLeave();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit leave request");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (lr: LeaveRequest, decision: "APPROVED" | "REJECTED") => {
    setBusy(true);
    try {
      const res = await decideLeaveRequest(lr.id, decision, lr.version, userUid);
      if (res.resolution === "conflict") {
        setError("Conflict — another admin already acted. Refreshed.");
      }
      await reloadLeave();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to decide");
    } finally {
      setBusy(false);
    }
  };

  const present = seedWorkers.filter(w => w.present).length;
  const onLeave = leaveReqs.filter(l => l.status === "APPROVED" && new Date(l.startDate) <= new Date() && new Date(l.endDate) >= new Date()).length;
  const pendingLeave = leaveReqs.filter(l => l.status === "PENDING").length;

  return (
    <div>
      <PageHeader
        eyebrow="Workforce"
        title="Labor & HR Management"
        desc="Worker roster with EPF/ETF master data, leave management, skill matrix, and lifecycle tracking."
        icon={<IconChip icon={Users} tone="emerald" className="h-12 w-12" />}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="Total Workers" value={String(seedWorkers.length)} tone="sky" />
        <StatCard icon={CheckCircle2} label="Present Today" value={String(present)} tone="emerald" />
        <StatCard icon={CalendarDays} label="On Leave" value={String(onLeave)} tone="amber" />
        <StatCard icon={Briefcase} label="Pending Approvals" value={String(pendingLeave)} tone="rose" />
      </div>

      <div className="mt-4 flex gap-2">
        {([
          { id: "roster", label: "Worker Roster", icon: Users },
          { id: "leave", label: "Leave Requests", icon: CalendarDays },
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

      {/* Tab: Roster */}
      {tab === "roster" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1 p-3">
            <h3 className="mb-2 px-1 font-display text-sm font-bold text-slate-800">Roster</h3>
            <div className="space-y-1.5">
              {seedWorkers.map(w => (
                <button key={w.id} onClick={() => setSelected(w)}
                  className={`w-full rounded-lg border p-2.5 text-left transition ${selected?.id === w.id ? "border-emerald-300 bg-emerald-50" : "border-slate-100 hover:bg-slate-50"}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">{w.name}</p>
                    <Badge tone={w.present ? "emerald" : "amber"} dot>{w.present ? "Present" : "Absent"}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-400">{w.role} · {w.division}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card className="lg:col-span-2 p-4">
            {selected ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900">{selected.name}</h3>
                    <p className="text-[11px] text-slate-400">NIC: {selected.nic}</p>
                  </div>
                  <Badge tone="sky">{selected.role}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Division</p>
                    <p className="font-semibold text-slate-700">{selected.division}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Attendance (30d)</p>
                    <p className="font-semibold text-slate-700">{selected.attendance30d}/30 days</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Avg kg/day</p>
                    <p className="font-semibold text-slate-700">{fmtNum(selected.avgKgPerDay)} kg</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Loyalty Points</p>
                    <p className="font-semibold text-slate-700">{selected.pointsBalance}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Bank Account</p>
                    <p className="flex items-center gap-1 font-mono text-xs text-slate-700">
                      <CreditCard className="h-3 w-3" /> {selected.bankAccount}
                    </p>
                  </div>
                </div>

                {/* HR fields prompt (these live in the new SQL columns) */}
                <div className="mt-4 rounded-lg bg-amber-50 p-3 text-[11px] text-amber-800">
                  <p className="font-semibold">HR Master Fields</p>
                  <p className="mt-0.5">EPF/ETF number, hire date, basic salary, emergency contact, and skill matrix are editable via the SQL migration's new `workers` columns. Run the migration to enable these fields in this UI.</p>
                </div>

                <div className="mt-4">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">This Worker's Leave Requests</p>
                  <div className="mt-2 space-y-2">
                    {leaveReqs.filter(l => l.workerId === selected.id).length === 0 ? (
                      <p className="text-xs text-slate-400">No leave requests on record.</p>
                    ) : (
                      leaveReqs.filter(l => l.workerId === selected.id).map(l => (
                        <div key={l.id} className="rounded-lg border border-slate-100 p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <Badge tone={l.leaveType === "annual" ? "emerald" : l.leaveType === "sick" ? "amber" : "slate"}>{l.leaveType}</Badge>
                            <Badge tone={l.status === "APPROVED" ? "emerald" : l.status === "REJECTED" ? "rose" : "amber"} dot>{l.status}</Badge>
                          </div>
                          <p className="mt-1 text-slate-600">{l.startDate} → {l.endDate} ({l.days} day{l.days > 1 ? "s" : ""})</p>
                          {l.reason && <p className="text-[11px] text-slate-400">"{l.reason}"</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="py-12 text-center text-sm text-slate-400">Select a worker to view details.</p>
            )}
          </Card>
        </div>
      )}

      {/* Tab: Leave */}
      {tab === "leave" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1 p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Submit Leave Request</h3>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-400">Worker</label>
                <select value={leaveWorkerId} onChange={e => setLeaveWorkerId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm">
                  <option value="">— select —</option>
                  {seedWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Leave Type</label>
                <select value={leaveType} onChange={e => setLeaveType(e.target.value as LeaveType)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm">
                  <option value="annual">Annual</option>
                  <option value="sick">Sick</option>
                  <option value="casual">Casual</option>
                  <option value="maternity">Maternity</option>
                  <option value="nopay">Nopay</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400">Start</label>
                  <input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">End</label>
                  <input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Reason</label>
                <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
              </div>
              <button onClick={submitLeave} disabled={busy || !leaveWorkerId}
                className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-50">
                Submit Request
              </button>
            </div>
          </Card>

          <Card className="lg:col-span-2 p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Leave Requests</h3>
            {leaveReqs.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No leave requests yet.</p>
            ) : (
              <div className="space-y-2">
                {leaveReqs.map(l => {
                  const w = seedWorkers.find(x => x.id === l.workerId);
                  return (
                    <div key={l.id} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{w?.name ?? l.workerId}</p>
                          <p className="text-[11px] text-slate-400">{l.startDate} → {l.endDate} · {l.days} day{l.days > 1 ? "s" : ""}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone="slate">{l.leaveType}</Badge>
                          <Badge tone={l.status === "APPROVED" ? "emerald" : l.status === "REJECTED" ? "rose" : "amber"} dot>{l.status}</Badge>
                          <span className="text-[10px] text-slate-400">v{l.version}</span>
                        </div>
                      </div>
                      {l.reason && <p className="mt-1 text-xs text-slate-500">"{l.reason}"</p>}
                      {l.status === "PENDING" && (
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => decide(l, "APPROVED")} disabled={busy}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-110">
                            <CheckCircle2 className="h-3 w-3" /> Approve
                          </button>
                          <button onClick={() => decide(l, "REJECTED")} disabled={busy}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-110">
                            <XCircle className="h-3 w-3" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-LK", { maximumFractionDigits: 1 });
}
