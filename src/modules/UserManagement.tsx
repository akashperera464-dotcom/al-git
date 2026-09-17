import { useEffect, useState } from "react";
import { UserCog, UserPlus, Users, CheckCircle2, Package, Ban, Trash2, ShieldCheck, Building2, Crown, Loader2, Mail, KeyRound, Layers, Pencil, X, AlertTriangle, RefreshCw } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip, DataTable } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { type Role, type ManagedUser } from "@/lib/data";
import { provisionUser, updateUserProfile, deleteUserProfile } from "@/lib/auth.hybrid";
import { readUsersForAdmin, readEstateOptions, readDivisionOptions } from "@/lib/repo";
import { useLiveData } from "@/lib/useLiveData";
import { supabaseConfigured } from "@/lib/supabase";
import { SupplierLocationHistory } from "@/components/LocationCheckIn";

/** Badge tone per role. */
const ROLE_TONE: Record<Role, "emerald" | "amber" | "violet" | "sky"> = {
  super_admin: "emerald",
  admin: "sky",
  extension_officer: "amber",
  supplier: "violet",
};
const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  extension_officer: "Extension Officer",
  supplier: "VVIP Supplier",
};

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone: string;
  estateId: string;
  divisionId: string;
}
const EMPTY_FORM: UserForm = { name: "", email: "", password: "", role: "extension_officer", phone: "", estateId: "", divisionId: "" };

interface EditForm {
  id: string;
  name: string;
  role: Role;
  phone: string;
  estateId: string;
  divisionId: string;
  status: "active" | "suspended";
}

/**
 * Admin-only User Management (CRUD) with full Email/Password provisioning.
 *
 *  Create → provisionUser() registers Firebase Auth (secondary app) + Supabase row.
 *  Edit   → updateUserProfile() updates the Supabase row (re-scopes on next login).
 *  Delete → deleteUserProfile() removes the Supabase row (de-authorizes the user).
 *           DELETE is restricted to Super Admin only.
 */
export default function UserManagement() {
  const { role: myRole, notify, userUid } = useApp();
  const { data: users, loading, reload } = useLiveData<ManagedUser>("users", readUsersForAdmin);
  const [estateOptions, setEstateOptions] = useState<{ id: string; name: string }[]>([]);
  const [divisionOptions, setDivisionOptions] = useState<{ id: string; name: string; estateName: string }[]>([]);
  const [filter, setFilter] = useState<"all" | Role>("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ManagedUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);

  // Load estate + division dropdown options once (rarely change).
  useEffect(() => {
    void (async () => {
      try {
        const [e, d] = await Promise.all([readEstateOptions(), readDivisionOptions()]);
        setEstateOptions(e);
        setDivisionOptions(d);
      } catch { /* ignore */ }
    })();
  }, []);

  const filtered = users.filter((u) => filter === "all" || u.role === filter);
  const active = users.filter((u) => u.status === "active").length;
  const estateName = (id?: string) => estateOptions.find((e) => e.id === id)?.name ?? "—";
  const allDivisions = divisionOptions;
  const divisionName = (id?: string) => divisionOptions.find((d) => d.id === id || d.name === id)?.name ?? (typeof id === "string" && id ? id : "—");

  const canManageAdmins = myRole === "super_admin"; // only super_admin may delete + create admins
  const isSelf = (u: ManagedUser) => u.id === userUid;

  const toggle = async (u: ManagedUser) => {
    const next = u.status === "active" ? "suspended" : "active";
    try {
      await updateUserProfile(u.id, { status: next });
      void reload(); // refresh from DB (real-time subscription also fires)
      notify({ title: `${next === "active" ? "Reactivated" : "Suspended"} ${u.name}`, body: `Status set to ${next}.`, tone: next === "active" ? "emerald" : "amber", channel: "system" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  const remove = async (u: ManagedUser) => {
    setBusy(true);
    setError(null);
    try {
      await deleteUserProfile(u.id);
      void reload(); // refresh from DB
      notify({ title: "User deleted", body: `${u.name}'s profile was removed. They can no longer log in.`, tone: "rose", channel: "system" });
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError("Name is required.");
      return;
    }
    if (editing.role === "supplier" && !editing.estateId) {
      setError("Suppliers must be linked to an estate.");
      return;
    }
    // Division is optional for Extension Officers.
    setBusy(true);
    setError(null);
    try {
      const division = editing.role === "extension_officer" ? allDivisions.find((d) => d.id === editing.divisionId)?.name ?? editing.divisionId : null;
      const association = editing.role === "supplier" ? editing.estateId : null;
      await updateUserProfile(editing.id, {
        name: editing.name.trim(),
        role: editing.role,
        associatedEntityId: association,
        division,
        phone: editing.phone.trim() || null,
        status: editing.status,
      });
      void reload(); // refresh from DB
      notify({ title: "User updated", body: `${editing.name}'s profile saved.`, tone: "emerald", channel: "system" });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user.");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    setError(null);
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setError("Name, email and a temporary password are required.");
      return;
    }
    if (form.role === "supplier" && !form.estateId) { setError("Suppliers must be linked to an estate."); return; }
    // Division is optional for Extension Officers.
    if ((form.role === "admin" || form.role === "super_admin") && !canManageAdmins) { setError("Only a Super Admin can create admin accounts."); return; }
    if (form.password.length < 6) { setError("Temporary password must be at least 6 characters."); return; }

    setBusy(true);
    try {
      const association = form.role === "supplier" ? form.estateId : null;
      const division = form.role === "extension_officer" ? allDivisions.find((d) => d.id === form.divisionId)?.name ?? form.divisionId : null;
      await provisionUser(form.email.trim(), form.password, {
        name: form.name.trim(),
        role: form.role,
        associatedEntityId: association,
        division,
        phone: form.phone.trim() || null,
      });
      void reload(); // refresh from DB — new user appears instantly across all screens
      notify({ title: "Account created ✅", body: `${form.name.trim()} (${ROLE_LABEL[form.role]}) can now log in.`, tone: "emerald", channel: "system" });
      setForm(EMPTY_FORM);
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm";
  const labelCls = "text-[11px] font-medium text-slate-400";

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="User Management"
        desc="Provision Email/Password accounts for Admins, Extension Officers & Suppliers. Create, edit, suspend & delete."
        icon={<IconChip icon={UserCog} tone="emerald" className="h-12 w-12" />}
        actions={
          <div className="flex items-center gap-2">
            {supabaseConfigured && <Badge tone="emerald" dot>Live · Supabase</Badge>}
            <button onClick={() => void reload()} title="Reload" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => { setAdding((a) => !a); setError(null); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-110">
              <UserPlus className="h-4 w-4" />
              {adding ? "Close" : "Add user"}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Users" value={String(users.length)} tone="emerald" />
        <StatCard icon={CheckCircle2} label="Active" value={String(active)} tone="sky" />
        <StatCard icon={UserCog} label="Admins" value={String(users.filter((u) => u.role === "admin" || u.role === "super_admin").length)} tone="amber" />
        <StatCard icon={Package} label="Suppliers" value={String(users.filter((u) => u.role === "supplier").length)} tone="violet" />
      </div>

      {/* CREATE FORM */}
      {adding && (
        <Card className="mt-4 p-4">
          <h3 className="mb-1 font-display text-sm font-bold text-slate-800">Create a new account</h3>
          <p className="mb-3 text-xs text-slate-400">Registers in Firebase Auth, then writes the profile to Supabase. The user can log in immediately with the temporary password.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className={labelCls}>Full name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Nimal Perera" className={inputCls} /></div>
            <div>
              <label className={labelCls}>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role, estateId: "", divisionId: "" })} className={inputCls}>
                <option value="extension_officer">Extension Officer</option>
                <option value="supplier">VVIP Supplier</option>
                {canManageAdmins && <option value="admin">Admin</option>}
                {canManageAdmins && <option value="super_admin">Super Admin</option>}
              </select>
            </div>
            <div><label className={labelCls}><Mail className="mr-1 inline h-3 w-3" />Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@kdu.com" className={inputCls} /></div>
            <div><label className={labelCls}><KeyRound className="mr-1 inline h-3 w-3" />Temporary password</label><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 chars" className={inputCls} /></div>
            <div><label className={labelCls}>Phone (optional)</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+94 77 000 0000" className={inputCls} /></div>
            {form.role === "supplier" && (
              <div><label className={labelCls}><Building2 className="mr-1 inline h-3 w-3" />Link to Estate</label>
                <select value={form.estateId} onChange={(e) => setForm({ ...form, estateId: e.target.value })} className={inputCls}>
                  <option value="">— select estate —</option>
                  {estateOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            )}
            {form.role === "extension_officer" && (
              <div><label className={labelCls}><Layers className="mr-1 inline h-3 w-3" />Assigned Division (optional)</label>
                <select value={form.divisionId} onChange={(e) => setForm({ ...form, divisionId: e.target.value })} className={inputCls}>
                  <option value="">— none —</option>
                  {allDivisions.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.estateName}</option>)}
                </select>
              </div>
            )}
            {(form.role === "admin" || form.role === "super_admin") && (
              <div className="flex items-end"><div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700"><Crown className="h-3.5 w-3.5" /> Full access — no estate scope needed.</div></div>
            )}
          </div>
          {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          <div className="mt-3 flex justify-end">
            <button onClick={add} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {busy ? "Provisioning…" : "Create & provision"}
            </button>
          </div>
        </Card>
      )}

      {/* EDIT FORM */}
      {editing && (
        <Card className="mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-800">Edit · {editing.name}</h3>
            <button onClick={() => { setEditing(null); setError(null); }} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className={labelCls}>Full name</label><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Role {canManageAdmins ? "" : "(admins only super_admin can change)"}</label>
              <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as Role, estateId: "", divisionId: "" })} className={inputCls}>
                <option value="extension_officer">Extension Officer</option>
                <option value="supplier">VVIP Supplier</option>
                {canManageAdmins && <option value="admin">Admin</option>}
                {canManageAdmins && <option value="super_admin">Super Admin</option>}
              </select>
            </div>
            <div><label className={labelCls}>Phone</label><input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="+94 77 000 0000" className={inputCls} /></div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as "active" | "suspended" })} className={inputCls}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            {editing.role === "supplier" && (
              <div><label className={labelCls}><Building2 className="mr-1 inline h-3 w-3" />Link to Estate</label>
                <select value={editing.estateId} onChange={(e) => setEditing({ ...editing, estateId: e.target.value })} className={inputCls}>
                  <option value="">— select estate —</option>
                  {estateOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            )}
            {editing.role === "extension_officer" && (
              <div><label className={labelCls}><Layers className="mr-1 inline h-3 w-3" />Assigned Division (optional)</label>
                <select value={editing.divisionId} onChange={(e) => setEditing({ ...editing, divisionId: e.target.value })} className={inputCls}>
                  <option value="">— none —</option>
                  {allDivisions.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.estateName}</option>)}
                </select>
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">Email & password are not editable here (the user changes their own password). Role/association changes apply on the user's next login.</p>

          {/* Supplier check-in history (GPS verification) */}
          {editing.role === "supplier" && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Verified Location Check-ins</p>
              <SupplierLocationHistory
                userId={editing.id}
                estateName={estateOptions.find((e) => e.id === editing.estateId)?.name}
              />
            </div>
          )}
          {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setEditing(null); setError(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">Cancel</button>
            <button onClick={saveEdit} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save changes
            </button>
          </div>
        </Card>
      )}

      {/* DELETE CONFIRM */}
      {confirmDelete && (
        <Card className="mt-4 border-rose-200 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600"><AlertTriangle className="h-5 w-5" /></span>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800">Delete {confirmDelete.name}?</p>
              <p className="mt-0.5 text-xs text-slate-500">This removes their Supabase profile — they will no longer be able to log in. Their Firebase Auth account remains (delete it in the Firebase Console for full removal).</p>
            </div>
          </div>
          {error && <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setConfirmDelete(null); setError(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">Cancel</button>
            <button onClick={() => remove(confirmDelete)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete permanently
            </button>
          </div>
        </Card>
      )}

      {/* DIRECTORY */}
      <Card className="mt-4 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-sm font-bold text-slate-800">Directory</h3>
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            {(["all", "super_admin", "admin", "extension_officer", "supplier"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-2.5 py-1.5 transition ${filter === f ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                {f === "all" ? "All" : ROLE_LABEL[f]}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading users from Supabase…
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No users found. Create one with the “Add user” button.</p>
        ) : (
        <DataTable<ManagedUser>
          rows={filtered}
          columns={[
            {
              key: "name", header: "User",
              render: (u) => (
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${
                    u.role === "super_admin" ? "bg-gradient-to-br from-emerald-600 to-teal-700" :
                    u.role === "admin" ? "bg-gradient-to-br from-sky-500 to-blue-600" :
                    u.role === "extension_officer" ? "bg-gradient-to-br from-amber-400 to-orange-500" :
                    "bg-gradient-to-br from-violet-500 to-fuchsia-600"}`}>
                    {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">{u.name} {isSelf(u) && <span className="ml-1 text-[10px] font-bold text-emerald-600">(you)</span>}</p>
                    <p className="text-[11px] text-slate-400">{u.email ?? "—"}</p>
                  </div>
                </div>
              ),
            },
            { key: "role", header: "Role", render: (u) => <Badge tone={ROLE_TONE[u.role]} dot>{ROLE_LABEL[u.role]}</Badge> },
            { key: "phone", header: "Phone", render: (u) => <span className="text-slate-500">{u.phone ?? "—"}</span> },
            {
              key: "scope", header: "Scope / Link",
              render: (u) =>
                u.role === "supplier" ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700"><Building2 className="h-3 w-3" /> {estateName(u.associatedEntityId)}</span>
                ) : u.role === "extension_officer" ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"><Layers className="h-3 w-3" /> {divisionName(u.division)}</span>
                ) : <span className="text-xs text-slate-400">—</span>,
            },
            { key: "status", header: "Status", align: "center", render: (u) => <Badge tone={u.status === "active" ? "emerald" : "rose"} dot>{u.status}</Badge> },
            {
              key: "actions", header: "Actions", align: "right",
              render: (u) => (
                <div className="flex items-center justify-end gap-1.5">
                  {/* Edit — all admins can edit (their own scope) */}
                  <button
                    onClick={() => { setEditing({ id: u.id, name: u.name, role: u.role, phone: u.phone ?? "", estateId: u.associatedEntityId ?? "", divisionId: u.division ?? "", status: u.status }); setAdding(false); setConfirmDelete(null); setError(null); }}
                    title="Edit"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {/* Suspend/Reactivate — admins */}
                  <button onClick={() => toggle(u)} title={u.status === "active" ? "Suspend" : "Reactivate"} className={`rounded-lg p-1.5 ${u.status === "active" ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}>
                    <Ban className="h-4 w-4" />
                  </button>
                  {/* Delete — SUPER ADMIN ONLY */}
                  {canManageAdmins && !isSelf(u) && (
                    <button onClick={() => { setConfirmDelete(u); setError(null); }} title="Delete (Super Admin)" className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
        )}
      </Card>

      <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <p className="text-xs text-emerald-700">
          <strong>Edit</strong> updates the Supabase profile (re-scopes on next login). <strong>Delete</strong> is restricted to <strong>Super Admin</strong> only and permanently removes the Supabase row (de-authorizing the user). New users are created via a secondary Firebase Auth instance so you stay logged in.
        </p>
      </div>
    </div>
  );
}
