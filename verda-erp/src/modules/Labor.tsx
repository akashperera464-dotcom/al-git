import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Users, Plus, Loader2, CalendarDays, CheckCircle2, XCircle, Phone, CreditCard,
  UserPlus, Edit2, Trash2, ArrowRightLeft, Ban, RotateCcw, LogOut, TrendingUp, Clock, Award,
} from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { fmtLKR, fmtLKRShort, type LeaveType, type LeaveStatus, type LeaveRequest, type WorkerFull, type WorkerStatus, type AttendanceStatus, type WorkerTransfer, type TransferType } from "@/lib/data";
import {
  listLeaveRequests, createLeaveRequest, decideLeaveRequest,
  listWorkersFull, createWorkerFull, updateWorkerFull, deleteWorkerFull,
  recordWorkerTransfer, listWorkerTransfers,
  listAttendance, markAttendance, bulkMarkAttendance, attendanceSummary,
} from "@/lib/repo.phase2";
import { useApp } from "@/context/AppContext";

type Tab = "roster" | "attendance" | "leave" | "lifecycle";

const ROLES = ["Plucker", "Factory Hand", "Field Worker", "Kangany", "Sprayer", "Supervisor", "Manager"];
const DIVISIONS = ["Sutton", "Craighead", "Tennant", "Factory", "Nursery"];

export default function Labor() {
  const { t } = useTranslation();
  const { userUid } = useApp();
  const [tab, setTab] = useState<Tab>("roster");
  const [workers, setWorkers] = useState<WorkerFull[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<LeaveRequest[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [transfers, setTransfers] = useState<WorkerTransfer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selected, setSelected] = useState<WorkerFull | null>(null);
  const [editing, setEditing] = useState<WorkerFull | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
  const [attDivision, setAttDivision] = useState("");

  // Forms
  const blankForm = {
    name: "", fullName: "", nic: "", division: DIVISIONS[0], role: ROLES[0],
    phone: "", dateOfBirth: "", gender: "male", address: "", emergencyContact: "",
    hireDate: new Date().toISOString().slice(0, 10), epfNumber: "", etfNumber: "",
    bankName: "", bankBranch: "", bankAccount: "", basicSalary: 30000,
  };
  const [form, setForm] = useState(blankForm);

  // Transfer form
  const [transferForm, setTransferForm] = useState<{ workerId: string; type: TransferType; toDivision: string; toRole: string; reason: string }>({
    workerId: "", type: "transfer", toDivision: DIVISIONS[0], toRole: ROLES[0], reason: "",
  });

  const reload = async () => {
    setBusy(true);
    try {
      const [ws, lrs, atts, trs] = await Promise.all([
        listWorkersFull(), listLeaveRequests(), listAttendance({ date: attDate }), listWorkerTransfers(),
      ]);
      setWorkers(ws);
      setLeaveReqs(lrs);
      setTransfers(trs);
      const attMap: Record<string, AttendanceStatus> = {};
      for (const a of atts) attMap[a.workerId] = a.status;
      setAttendance(attMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reload(); }, [attDate]);

  // ---- Worker CRUD ----
  const addWorker = async () => {
    setError(null);
    if (!form.name.trim()) { setError("Name required"); return; }
    setBusy(true);
    try {
      await createWorkerFull({
        name: form.name.trim(), fullName: form.fullName.trim() || undefined,
        nic: form.nic.trim() || undefined, division: form.division, role: form.role,
        phone: form.phone.trim() || undefined, dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender, address: form.address.trim() || undefined,
        emergencyContact: form.emergencyContact.trim() || undefined,
        hireDate: form.hireDate, epfNumber: form.epfNumber.trim() || undefined,
        etfNumber: form.etfNumber.trim() || undefined,
        bankName: form.bankName.trim() || undefined, bankBranch: form.bankBranch.trim() || undefined,
        bankAccount: form.bankAccount.trim() || undefined, basicSalary: form.basicSalary,
      });
      setSuccess(`Worker "${form.name}" added`);
      setForm(blankForm);
      setShowAddForm(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add worker");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setError(null);
    setBusy(true);
    try {
      const res = await updateWorkerFull({
        workerId: editing.id, expectedVersion: editing.version,
        updates: {
          name: editing.name, fullName: editing.fullName, nic: editing.nic,
          division: editing.division, role: editing.role, phone: editing.phone,
          dateOfBirth: editing.dateOfBirth, gender: editing.gender, address: editing.address,
          emergencyContact: editing.emergencyContact, hireDate: editing.hireDate,
          epfNumber: editing.epfNumber, etfNumber: editing.etfNumber,
          bankName: editing.bankName, bankBranch: editing.bankBranch,
          bankAccount: editing.bankAccount, basicSalary: editing.basicSalary,
        },
      });
      if (res.resolution === "conflict") {
        setError("Conflict — another user modified this worker. Refreshed.");
      } else {
        setSuccess("Worker updated");
        setEditing(null);
        await reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  };

  const removeWorker = async (w: WorkerFull) => {
    if (!confirm(`Delete ${w.name}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await deleteWorkerFull(w.id);
      if (!res.ok) setError(res.error ?? "Failed to delete");
      else { setSuccess(`${w.name} deleted`); await reload(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  // ---- Lifecycle ----
  const doTransfer = async () => {
    setError(null);
    if (!transferForm.workerId) { setError("Select a worker"); return; }
    const w = workers.find(x => x.id === transferForm.workerId);
    if (!w) return;
    setBusy(true);
    try {
      const res = await recordWorkerTransfer({
        workerId: w.id, workerName: w.name,
        transferType: transferForm.type,
        fromDivision: w.division, toDivision: transferForm.toDivision,
        fromRole: w.role, toRole: transferForm.toRole,
        reason: transferForm.reason, authorizedBy: userUid,
        expectedWorkerVersion: w.version,
      });
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        setSuccess(`${w.name}: ${transferForm.type} recorded`);
        setTransferForm({ workerId: "", type: "transfer", toDivision: DIVISIONS[0], toRole: ROLES[0], reason: "" });
        await reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  // ---- Attendance ----
  const setAtt = async (workerId: string, status: AttendanceStatus) => {
    setBusy(true);
    try {
      const w = workers.find(x => x.id === workerId);
      await markAttendance({
        workerId, workerName: w?.name, division: w?.division,
        date: attDate, status, markedBy: userUid,
      });
      setAttendance({ ...attendance, [workerId]: status });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const bulkMark = async (status: AttendanceStatus) => {
    setBusy(true);
    try {
      const ws = workers.filter(w => !attDivision || w.division === attDivision);
      const res = await bulkMarkAttendance({
        workers: ws.map(w => ({ workerId: w.id, workerName: w.name, division: w.division })),
        date: attDate, status, markedBy: userUid,
      });
      setSuccess(`Marked ${res.marked} workers as ${status}`);
      if (res.errors.length) setError(`Errors: ${res.errors.join(", ")}`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  // ---- Leave ----
  const [leaveWorkerId, setLeaveWorkerId] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [leaveStart, setLeaveStart] = useState(new Date().toISOString().slice(0, 10));
  const [leaveEnd, setLeaveEnd] = useState(new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState("");

  const submitLeave = async () => {
    setError(null);
    if (!leaveWorkerId) { setError("Select a worker"); return; }
    setBusy(true);
    try {
      await createLeaveRequest({
        workerId: leaveWorkerId, leaveType, startDate: leaveStart, endDate: leaveEnd,
        reason: leaveReason.trim() || undefined,
      });
      setSuccess("Leave request submitted");
      setLeaveReason("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (lr: LeaveRequest, decision: "APPROVED" | "REJECTED") => {
    setBusy(true);
    try {
      const res = await decideLeaveRequest(lr.id, decision, lr.version, userUid);
      if (res.resolution === "conflict") setError("Conflict — refresh");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const activeWorkers = workers.filter(w => w.status === "active");
  const suspendedCount = workers.filter(w => w.status === "suspended").length;
  const presentToday = Object.values(attendance).filter(s => s === "present" || s === "half_day").length;
  const pendingLeave = leaveReqs.filter(l => l.status === "PENDING").length;

  return (
    <div>
      <PageHeader
        eyebrow="Workforce"
        title="Labor & HR Management"
        desc="Worker master with full HR fields, daily attendance, leave management, and lifecycle tracking (hire → transfer → retire)."
        icon={<IconChip icon={Users} tone="emerald" className="h-12 w-12" />}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Users} label="Total Workers" value={String(workers.length)} tone="sky" />
        <StatCard icon={CheckCircle2} label="Present Today" value={String(presentToday)} tone="emerald" />
        <StatCard icon={Ban} label="Suspended" value={String(suspendedCount)} tone="amber" />
        <StatCard icon={CalendarDays} label="Pending Leave" value={String(pendingLeave)} tone="rose" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {([
          { id: "roster", label: "Worker Roster", icon: Users },
          { id: "attendance", label: "Daily Attendance", icon: CheckCircle2 },
          { id: "leave", label: `Leave Requests${pendingLeave > 0 ? ` (${pendingLeave})` : ""}`, icon: CalendarDays },
          { id: "lifecycle", label: "Lifecycle / Transfers", icon: ArrowRightLeft },
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

      {/* ============== Tab: Roster ============== */}
      {tab === "roster" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-800">{editing ? "Edit Worker" : "Add New Worker"}</h3>
              {editing && <button onClick={() => setEditing(null)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>}
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              <input value={editing ? editing.name : form.name} onChange={e => editing ? setEditing({ ...editing, name: e.target.value }) : setForm({ ...form, name: e.target.value })} placeholder="Name *" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <input value={editing ? (editing.fullName ?? "") : form.fullName} onChange={e => editing ? setEditing({ ...editing, fullName: e.target.value }) : setForm({ ...form, fullName: e.target.value })} placeholder="Full name" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <input value={editing ? editing.nic : form.nic} onChange={e => editing ? setEditing({ ...editing, nic: e.target.value }) : setForm({ ...form, nic: e.target.value })} placeholder="NIC" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={editing ? editing.division : form.division} onChange={e => editing ? setEditing({ ...editing, division: e.target.value }) : setForm({ ...form, division: e.target.value })} className="rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                  {DIVISIONS.map(d => <option key={d}>{d}</option>)}
                </select>
                <select value={editing ? editing.role : form.role} onChange={e => editing ? setEditing({ ...editing, role: e.target.value }) : setForm({ ...form, role: e.target.value })} className="rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <input value={editing ? (editing.phone ?? "") : form.phone} onChange={e => editing ? setEditing({ ...editing, phone: e.target.value }) : setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={editing ? (editing.dateOfBirth ?? "") : form.dateOfBirth} onChange={e => editing ? setEditing({ ...editing, dateOfBirth: e.target.value }) : setForm({ ...form, dateOfBirth: e.target.value })} className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
                <select value={editing ? (editing.gender ?? "male") : form.gender} onChange={e => editing ? setEditing({ ...editing, gender: e.target.value }) : setForm({ ...form, gender: e.target.value })} className="rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <input value={editing ? (editing.address ?? "") : form.address} onChange={e => editing ? setEditing({ ...editing, address: e.target.value }) : setForm({ ...form, address: e.target.value })} placeholder="Address" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <input value={editing ? (editing.emergencyContact ?? "") : form.emergencyContact} onChange={e => editing ? setEditing({ ...editing, emergencyContact: e.target.value }) : setForm({ ...form, emergencyContact: e.target.value })} placeholder="Emergency contact" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <input type="date" value={editing ? (editing.hireDate ?? "") : form.hireDate} onChange={e => editing ? setEditing({ ...editing, hireDate: e.target.value }) : setForm({ ...form, hireDate: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input value={editing ? (editing.epfNumber ?? "") : form.epfNumber} onChange={e => editing ? setEditing({ ...editing, epfNumber: e.target.value }) : setForm({ ...form, epfNumber: e.target.value })} placeholder="EPF Number" className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
                <input value={editing ? (editing.etfNumber ?? "") : form.etfNumber} onChange={e => editing ? setEditing({ ...editing, etfNumber: e.target.value }) : setForm({ ...form, etfNumber: e.target.value })} placeholder="ETF Number" className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={editing ? (editing.bankName ?? "") : form.bankName} onChange={e => editing ? setEditing({ ...editing, bankName: e.target.value }) : setForm({ ...form, bankName: e.target.value })} placeholder="Bank name" className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
                <input value={editing ? (editing.bankBranch ?? "") : form.bankBranch} onChange={e => editing ? setEditing({ ...editing, bankBranch: e.target.value }) : setForm({ ...form, bankBranch: e.target.value })} placeholder="Branch" className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              <input value={editing ? (editing.bankAccount ?? "") : form.bankAccount} onChange={e => editing ? setEditing({ ...editing, bankAccount: e.target.value }) : setForm({ ...form, bankAccount: e.target.value })} placeholder="Bank account" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <input type="number" value={editing ? editing.basicSalary : form.basicSalary} onChange={e => editing ? setEditing({ ...editing, basicSalary: +e.target.value }) : setForm({ ...form, basicSalary: +e.target.value })} placeholder="Basic salary" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
              <button onClick={editing ? saveEdit : addWorker} disabled={busy}
                className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
                {editing ? "Save Changes" : "Add Worker"}
              </button>
            </div>
          </Card>

          <Card className="lg:col-span-2 p-3">
            <h3 className="mb-2 px-1 font-display text-sm font-bold text-slate-800">Roster ({workers.length})</h3>
            <div className="space-y-1.5 max-h-[650px] overflow-y-auto">
              {workers.map(w => (
                <div key={w.id} className={`rounded-lg border p-2.5 transition ${selected?.id === w.id ? "border-emerald-300 bg-emerald-50" : "border-slate-100 hover:bg-slate-50"} ${w.status !== "active" ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button onClick={() => setSelected(w)} className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800">{w.name}</p>
                        <Badge tone={w.status === "active" ? "emerald" : w.status === "suspended" ? "amber" : "slate"} dot>{w.status}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-400">{w.role} · {w.division} · {w.epfNumber ? `EPF ${w.epfNumber}` : "no EPF"}</p>
                      <p className="text-[11px] text-slate-400">{fmtLKRShort(w.basicSalary)}/mo · {w.attendance30d}/30d · {w.pointsBalance}pts</p>
                    </button>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(w); setSelected(null); }} disabled={busy} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-600">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => removeWorker(w)} disabled={busy} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ============== Tab: Attendance ============== */}
      {tab === "attendance" && (
        <Card className="mt-4 p-4">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[11px] text-slate-400">Date</label>
              <input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} className="mt-1 rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Filter by Division</label>
              <select value={attDivision} onChange={e => setAttDivision(e.target.value)} className="mt-1 rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option value="">All divisions</option>
                {DIVISIONS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex gap-1">
              <button onClick={() => bulkMark("present")} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:brightness-110">Mark All Present</button>
              <button onClick={() => bulkMark("absent")} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:brightness-110">Mark All Absent</button>
            </div>
          </div>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
            {workers.filter(w => !attDivision || w.division === attDivision).map(w => {
              const status = attendance[w.id] ?? "absent";
              return (
                <div key={w.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{w.name}</p>
                    <p className="text-[11px] text-slate-400">{w.role} · {w.division}</p>
                  </div>
                  <div className="flex gap-1">
                    {([
                      { s: "present" as const, label: "P", tone: "emerald" as const },
                      { s: "half_day" as const, label: "½", tone: "amber" as const },
                      { s: "absent" as const, label: "A", tone: "rose" as const },
                      { s: "leave" as const, label: "L", tone: "sky" as const },
                    ]).map(opt => (
                      <button key={opt.s} onClick={() => setAtt(w.id, opt.s)} disabled={busy}
                        className={`h-8 w-8 rounded-lg text-xs font-bold transition ${status === opt.s ? `bg-${opt.tone}-600 text-white` : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                        {opt.label}
                      </button>
                    ))}
                    <Badge tone={status === "present" ? "emerald" : status === "absent" ? "rose" : status === "half_day" ? "amber" : "sky"}>{status}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ============== Tab: Leave ============== */}
      {tab === "leave" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Submit Leave Request</h3>
            <div className="space-y-2">
              <select value={leaveWorkerId} onChange={e => setLeaveWorkerId(e.target.value)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option value="">— select worker —</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <select value={leaveType} onChange={e => setLeaveType(e.target.value as LeaveType)} className="w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="casual">Casual</option>
                <option value="maternity">Maternity</option>
                <option value="nopay">Nopay</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
                <input type="date" value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              <textarea value={leaveReason} onChange={e => setLeaveReason(e.target.value)} rows={2} placeholder="Reason" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <button onClick={submitLeave} disabled={busy || !leaveWorkerId} className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Submit</button>
            </div>
          </Card>

          <Card className="lg:col-span-2 p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Leave Requests ({leaveReqs.length})</h3>
            {leaveReqs.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No leave requests yet.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {leaveReqs.map(l => {
                  const w = workers.find(x => x.id === l.workerId);
                  return (
                    <div key={l.id} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{w?.name ?? l.workerId}</p>
                          <p className="text-[11px] text-slate-400">{l.startDate} → {l.endDate} · {l.days}d</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge tone="slate">{l.leaveType}</Badge>
                          <Badge tone={l.status === "APPROVED" ? "emerald" : l.status === "REJECTED" ? "rose" : "amber"} dot>{l.status}</Badge>
                        </div>
                      </div>
                      {l.reason && <p className="mt-1 text-xs text-slate-500">"{l.reason}"</p>}
                      {l.status === "PENDING" && (
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => decide(l, "APPROVED")} disabled={busy} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-110">Approve</button>
                          <button onClick={() => decide(l, "REJECTED")} disabled={busy} className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-110">Reject</button>
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

      {/* ============== Tab: Lifecycle ============== */}
      {tab === "lifecycle" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Record Lifecycle Event</h3>
            <div className="space-y-2">
              <select value={transferForm.workerId} onChange={e => setTransferForm({ ...transferForm, workerId: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option value="">— select worker —</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.status})</option>)}
              </select>
              <select value={transferForm.type} onChange={e => setTransferForm({ ...transferForm, type: e.target.value as TransferType })} className="w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option value="transfer">Transfer (division change)</option>
                <option value="promote">Promote (role change)</option>
                <option value="suspend">Suspend</option>
                <option value="reinstate">Reinstate</option>
                <option value="retire">Retire</option>
                <option value="terminate">Terminate</option>
              </select>
              {(transferForm.type === "transfer" || transferForm.type === "promote") && (
                <div className="grid grid-cols-2 gap-2">
                  <select value={transferForm.toDivision} onChange={e => setTransferForm({ ...transferForm, toDivision: e.target.value })} className="rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                    {DIVISIONS.map(d => <option key={d}>{d}</option>)}
                  </select>
                  <select value={transferForm.toRole} onChange={e => setTransferForm({ ...transferForm, toRole: e.target.value })} className="rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              )}
              <textarea value={transferForm.reason} onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })} rows={2} placeholder="Reason" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <button onClick={doTransfer} disabled={busy || !transferForm.workerId} className="w-full rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Record Event</button>
            </div>
          </Card>

          <Card className="lg:col-span-2 p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Lifecycle History ({transfers.length})</h3>
            {transfers.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No lifecycle events yet.</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {transfers.map(tr => (
                  <div key={tr.id} className="rounded-lg border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge tone={
                          tr.transferType === "hire" ? "emerald" :
                          tr.transferType === "retire" || tr.transferType === "terminate" ? "rose" :
                          tr.transferType === "suspend" ? "amber" :
                          tr.transferType === "reinstate" ? "sky" : "violet"
                        }>{tr.transferType}</Badge>
                        <p className="text-sm font-semibold text-slate-800">{tr.workerName ?? tr.workerId}</p>
                      </div>
                      <span className="text-[10px] text-slate-400">{tr.effectiveDate}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {tr.fromDivision && `${tr.fromDivision} → ${tr.toDivision}`}
                      {tr.fromRole && ` · ${tr.fromRole} → ${tr.toRole}`}
                      {!tr.fromDivision && !tr.fromRole && tr.toDivision && `→ ${tr.toDivision}`}
                    </p>
                    {tr.reason && <p className="mt-0.5 text-[11px] text-slate-500">"{tr.reason}"</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
