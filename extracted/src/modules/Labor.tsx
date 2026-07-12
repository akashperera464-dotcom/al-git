import { useState } from "react";
import { Users, UserCheck, Scale, Crown, QrCode, UserPlus, Pencil, Trash2, Loader2, Check, X, AlertTriangle } from "lucide-react";
import { PageHeader, StatCard, Panel, Badge, Meter, IconChip, DataTable } from "@/components/ui";
import { CaptureButton } from "@/components/CaptureButton";
import { QR } from "@/components/QR";
import { type Worker } from "@/lib/data";
import { readWorkers, createWorker, updateWorker, deleteWorker } from "@/lib/repo";
import { useLiveData } from "@/lib/useLiveData";
import { useApp } from "@/context/AppContext";

const ROLE_TONE: Record<Worker["role"], "emerald" | "amber" | "sky" | "violet" | "rose"> = {
  Plucker: "emerald",
  "Field Worker": "sky",
  "Factory Hand": "amber",
  Kangany: "violet",
  Sprayer: "rose",
};
const ROLES: Worker["role"][] = ["Plucker", "Field Worker", "Factory Hand", "Kangany", "Sprayer"];

interface WorkerForm {
  name: string;
  nic: string;
  division: string;
  role: Worker["role"];
  bankAccount: string;
  pointsBalance: number;
  attendance30d: number;
  avgKgPerDay: number;
  present: boolean;
}
const EMPTY_FORM: WorkerForm = { name: "", nic: "", division: "—", role: "Plucker", bankAccount: "", pointsBalance: 0, attendance30d: 0, avgKgPerDay: 0, present: true };

interface EditForm extends WorkerForm { id: string; }

export default function Labor() {
  const { notify } = useApp();
  const { data: workers, loading, reload } = useLiveData<Worker>("workers", readWorkers);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Worker | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<WorkerForm>(EMPTY_FORM);

  const present = workers.filter((w) => w.present).length;
  const pluckers = workers.filter((w) => w.role === "Plucker");
  const avgKg = pluckers.length ? pluckers.reduce((s, w) => s + w.avgKgPerDay, 0) / pluckers.length : 0;
  const kangany = workers.filter((w) => w.role === "Kangany").length;

  const inputCls = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm";
  const labelCls = "text-[11px] font-medium text-slate-400";

  // ---- Create ----
  const add = async () => {
    setError(null);
    if (!form.name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    try {
      await createWorker({ ...form, name: form.name.trim() });
      void reload();
      notify({ title: "Worker added ✅", body: `${form.name.trim()} added to the roster.`, tone: "emerald", channel: "system" });
      setForm(EMPTY_FORM);
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add worker.");
    } finally {
      setBusy(false);
    }
  };

  // ---- Update ----
  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    setError(null);
    try {
      await updateWorker(editing.id, { ...editing, name: editing.name.trim() });
      void reload();
      notify({ title: "Worker updated ✅", body: `${editing.name.trim()}'s profile saved.`, tone: "emerald", channel: "system" });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update.");
    } finally {
      setBusy(false);
    }
  };

  // ---- Delete ----
  const remove = async (w: Worker) => {
    setBusy(true);
    setError(null);
    try {
      await deleteWorker(w.id);
      void reload();
      notify({ title: "Worker deleted", body: `${w.name} removed from the roster.`, tone: "rose", channel: "system" });
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete.");
    } finally {
      setBusy(false);
    }
  };

  // ---- Toggle Present ----
  const togglePresent = async (w: Worker) => {
    try {
      await updateWorker(w.id, { present: !w.present });
      void reload();
    } catch { /* ignore — real-time will sync */ }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Labor Management System"
        title="Workforce & Attendance"
        desc="Full CRUD worker management — create, edit, delete workers. QR attendance + productivity tracking."
        icon={<IconChip icon={Users} tone="violet" className="h-12 w-12" />}
        actions={
          <button onClick={() => { setAdding((a) => !a); setError(null); }} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:brightness-110">
            <UserPlus className="h-4 w-4" /> {adding ? "Close" : "Add worker"}
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={UserCheck} label="Present Today" value={`${present}/${workers.length || 1}`} sub={`${workers.length ? Math.round((present / workers.length) * 100) : 0}% attendance`} tone="emerald" />
        <StatCard icon={Scale} label="Avg Plucker Yield" value={`${avgKg.toFixed(1)} kg`} sub="Net green leaf / day" tone="amber" />
        <StatCard icon={Crown} label="Kangany Led" value={String(kangany)} sub="Crew supervisors" tone="violet" />
        <StatCard icon={Users} label="Total Roster" value={String(workers.length)} sub="Registered" tone="sky" />
      </div>

      {/* CREATE FORM */}
      {adding && (
        <Panel className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Add New Worker</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className={labelCls}>Full name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Nimal Perera" className={inputCls} /></div>
            <div><label className={labelCls}>NIC</label><input value={form.nic} onChange={(e) => setForm({ ...form, nic: e.target.value })} placeholder="199012345678" className={inputCls} /></div>
            <div>
              <label className={labelCls}>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Worker["role"] })} className={inputCls}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Division</label><input value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} placeholder="Sutton" className={inputCls} /></div>
            <div><label className={labelCls}>Bank Account</label><input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} placeholder="BOA-1234567" className={inputCls} /></div>
            <div><label className={labelCls}>Avg kg/day</label><input type="number" step="0.1" value={form.avgKgPerDay} onChange={(e) => setForm({ ...form, avgKgPerDay: +e.target.value })} className={`${inputCls} tnum`} /></div>
            <div><label className={labelCls}>Points</label><input type="number" value={form.pointsBalance} onChange={(e) => setForm({ ...form, pointsBalance: +e.target.value })} className={`${inputCls} tnum`} /></div>
            <div><label className={labelCls}>Present today?</label>
              <select value={form.present ? "yes" : "no"} onChange={(e) => setForm({ ...form, present: e.target.value === "yes" })} className={inputCls}>
                <option value="yes">Present</option>
                <option value="no">Absent</option>
              </select>
            </div>
          </div>
          {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setAdding(false); setError(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">Cancel</button>
            <button onClick={add} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add worker
            </button>
          </div>
        </Panel>
      )}

      {/* EDIT FORM */}
      {editing && (
        <Panel className="mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-800">Edit · {editing.name}</h3>
            <button onClick={() => { setEditing(null); setError(null); }} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className={labelCls}>Full name</label><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>NIC</label><input value={editing.nic} onChange={(e) => setEditing({ ...editing, nic: e.target.value })} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Role</label>
              <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as Worker["role"] })} className={inputCls}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Division</label><input value={editing.division} onChange={(e) => setEditing({ ...editing, division: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Bank Account</label><input value={editing.bankAccount} onChange={(e) => setEditing({ ...editing, bankAccount: e.target.value })} className={inputCls} /></div>
            <div><label className={labelCls}>Avg kg/day</label><input type="number" step="0.1" value={editing.avgKgPerDay} onChange={(e) => setEditing({ ...editing, avgKgPerDay: +e.target.value })} className={`${inputCls} tnum`} /></div>
            <div><label className={labelCls}>Attendance 30d</label><input type="number" value={editing.attendance30d} onChange={(e) => setEditing({ ...editing, attendance30d: +e.target.value })} className={`${inputCls} tnum`} /></div>
            <div><label className={labelCls}>Points</label><input type="number" value={editing.pointsBalance} onChange={(e) => setEditing({ ...editing, pointsBalance: +e.target.value })} className={`${inputCls} tnum`} /></div>
            <div><label className={labelCls}>Present?</label>
              <select value={editing.present ? "yes" : "no"} onChange={(e) => setEditing({ ...editing, present: e.target.value === "yes" })} className={inputCls}>
                <option value="yes">Present</option>
                <option value="no">Absent</option>
              </select>
            </div>
          </div>
          {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setEditing(null); setError(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">Cancel</button>
            <button onClick={saveEdit} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save changes
            </button>
          </div>
        </Panel>
      )}

      {/* DELETE CONFIRM */}
      {confirmDelete && (
        <Panel className="mt-4 border-rose-200 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600"><AlertTriangle className="h-5 w-5" /></span>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800">Delete {confirmDelete.name}?</p>
              <p className="mt-0.5 text-xs text-slate-500">This permanently removes them from the worker roster.</p>
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setConfirmDelete(null); setError(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">Cancel</button>
            <button onClick={() => remove(confirmDelete)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete permanently
            </button>
          </div>
        </Panel>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Worker Roster" subtitle="Real-time · CRUD enabled" icon={<IconChip icon={Users} tone="violet" className="h-9 w-9" />}>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading workers…</div>
            ) : (
              <DataTable<Worker>
                rows={workers}
                columns={[
                  {
                    key: "name",
                    header: "Worker",
                    render: (w) => (
                      <div className="flex items-center gap-3">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white ${w.present ? "bg-emerald-500" : "bg-slate-300"}`}>
                          {w.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-800">{w.name}</p>
                          <p className="text-[11px] text-slate-400">NIC {w.nic || "—"}</p>
                        </div>
                      </div>
                    ),
                  },
                  { key: "division", header: "Division" },
                  { key: "role", header: "Role", render: (w) => <Badge tone={ROLE_TONE[w.role]}>{w.role}</Badge> },
                  {
                    key: "prod",
                    header: "Daily Output",
                    align: "right",
                    render: (w) =>
                      w.role === "Plucker" ? (
                        <div className="w-28">
                          <div className="mb-0.5 text-right text-xs font-semibold text-slate-700">{w.avgKgPerDay.toFixed(1)} kg</div>
                          <Meter value={(w.avgKgPerDay / 25) * 100} tone="emerald" />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      ),
                  },
                  { key: "present", header: "Status", align: "center", render: (w) => <button onClick={() => togglePresent(w)} title="Toggle"><Badge tone={w.present ? "emerald" : "slate"} dot>{w.present ? "In" : "Out"}</Badge></button> },
                  {
                    key: "actions",
                    header: "Actions",
                    align: "right",
                    render: (w) => (
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => { setEditing({ ...w }); setAdding(false); setConfirmDelete(null); setError(null); }} title="Edit" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => { setConfirmDelete(w); setError(null); }} title="Delete" className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="QR Attendance" subtitle="Scan worker badge to clock-in" icon={<IconChip icon={QrCode} tone="emerald" className="h-9 w-9" />}>
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-3">
                <QR value="VERDA-ATT-SUTTON-2025" className="h-28 w-28 rounded-lg" />
              </div>
              <p className="text-center text-xs text-slate-400">Extension Officer badge · Sutton Division</p>
              <CaptureButton label="Register attendance" tone="emerald" icon={QrCode} />
            </div>
          </Panel>
          <Panel title="Attendance — 30 days" subtitle="By worker" icon={<IconChip icon={UserCheck} tone="sky" className="h-9 w-9" />}>
            <div className="space-y-2.5">
              {workers.slice(0, 6).map((w) => (
                <div key={w.id} className="flex items-center gap-3">
                  <span className="w-24 truncate text-xs font-medium text-slate-600">{w.name}</span>
                  <Meter value={(w.attendance30d / 30) * 100} tone={w.attendance30d >= 27 ? "emerald" : "amber"} className="flex-1" />
                  <span className="w-8 text-right text-xs font-semibold text-slate-500 tnum">{w.attendance30d}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
