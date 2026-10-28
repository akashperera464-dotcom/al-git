import { useEffect, useState } from "react";
import { UserCog, UserPlus, Users, CheckCircle2, Package, Ban, ShieldCheck, Building2, Crown, Loader2, Mail, KeyRound, Layers, Pencil, X, AlertTriangle, RefreshCw, ScrollText } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip, DataTable } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { type Role, type ManagedUser } from "@/lib/data";
import { provisionUser, updateUserProfile } from "@/lib/auth.hybrid";
import { readUsersForAdmin, readEstateOptions, readDivisionOptions } from "@/lib/repo";
import { useLiveData } from "@/lib/useLiveData";
import { getSupabase, refreshSupabaseFirebaseAuth, supabaseConfigured } from "@/lib/supabase";
import { SupplierLocationHistory } from "@/components/LocationCheckIn";
import { readFactories, readRoutes, readUserEstateAssociation, saveUserEstateAssociation, updateSupplierOperationalFields, type FactoryOption, type RouteOption } from "@/lib/supplierOperations";
import { readAuditLog, setUserDeactivated, type AuditLogEntry } from "@/lib/estateRepo";
import { RouteMultiSelect } from "@/components/RouteMultiSelect";
import { assertMultiRouteSchemaReady, readUserRouteAssignments, replaceUserRoutes } from "@/lib/userRoutes";

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
  supplier: "Supplier",
};

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone: string;
  estateId: string;
  divisionId: string;
  supplierNo: string;
  factoryId: string;
  routeIds: string[];
  officeSupplierId: string;
}
const EMPTY_FORM: UserForm = { name: "", email: "", password: "", role: "extension_officer", phone: "", estateId: "", divisionId: "", supplierNo: "", factoryId: "", routeIds: [], officeSupplierId: "" };

interface EditForm {
  id: string;
  name: string;
  role: Role;
  phone: string;
  estateId: string;
  divisionId: string;
  supplierNo: string;
  factoryId: string;
  routeIds: string[];
  officeSupplierId: string;
  status: "active" | "suspended" | "pending_approval";
}

/**
 * Admin-only User Management (CRUD) with full Email/Password provisioning.
 *
 *  Create → provisionUser() registers Firebase Auth (secondary app) + Supabase row.
 *  Edit   → updateUserProfile() updates the Supabase row (re-scopes on next login).
 *  Deactivate → recoverable soft-delete; the user row and operational history remain.
 */
export default function UserManagement() {
  const { role: myRole, notify, userUid, authReady, isAuthenticated } = useApp();
  const { data: users, loading, error: loadError, reload } = useLiveData<ManagedUser>("users", readUsersForAdmin);
  const [estateOptions, setEstateOptions] = useState<{ id: string; name: string }[]>([]);
  const [estateOptionsLoading, setEstateOptionsLoading] = useState(true);
  const [estateOptionsError, setEstateOptionsError] = useState<string | null>(null);
  const [divisionOptions, setDivisionOptions] = useState<{ id: string; name: string; estateName: string }[]>([]);
  const [filter, setFilter] = useState<"all" | Role>("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EditForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ManagedUser | null>(null);
  const [view, setView] = useState<"directory" | "audit">("directory");
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditAction, setAuditAction] = useState("");
  const [auditEntity, setAuditEntity] = useState("");
  const [auditAdmin, setAuditAdmin] = useState("");
  const [auditEntityId, setAuditEntityId] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [factories, setFactories] = useState<FactoryOption[]>([]);
  const [formRoutes, setFormRoutes] = useState<RouteOption[]>([]);
  const [editRoutes, setEditRoutes] = useState<RouteOption[]>([]);

  // Firebase restores asynchronously. If this module mounts before that restore
  // completes, the first Supabase request is anonymous and RLS correctly returns
  // an empty list. Refresh once the verified Firebase identity is ready so the
  // directory never remains stuck on that pre-authentication result.
  useEffect(() => {
    if (!authReady || !isAuthenticated || (myRole !== "admin" && myRole !== "super_admin")) return;
    let active = true;
    void refreshSupabaseFirebaseAuth()
      .then((token) => {
        if (active && token) return reload();
        return undefined;
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not refresh database authentication.");
      });
    return () => { active = false; };
  }, [authReady, isAuthenticated, myRole, userUid, reload]);

  // Load dropdown sources independently: one missing/failed optional query must
  // not silently prevent the estate list from being available to User Management.
  useEffect(() => {
    let active = true;
    setEstateOptionsLoading(true);
    void readEstateOptions()
      .then((rows) => { if (active) { setEstateOptions(rows); setEstateOptionsError(null); } })
      .catch((err) => { if (active) setEstateOptionsError(err instanceof Error ? err.message : "Could not load estates."); })
      .finally(() => { if (active) setEstateOptionsLoading(false); });
    void readDivisionOptions().then((rows) => { if (active) setDivisionOptions(rows); }).catch(() => {});
    void readFactories().then((rows) => { if (active) setFactories(rows); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (view !== "audit") return;
    void readAuditLog({ adminId: auditAdmin || undefined, action: auditAction || undefined, entityType: auditEntity || undefined, entityId: auditEntityId || undefined, limit: 500 })
      .then((rows) => setAuditLog(rows.filter((entry) => (!auditFrom || entry.createdAt >= `${auditFrom}T00:00:00`) && (!auditTo || entry.createdAt <= `${auditTo}T23:59:59`))))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load audit log."));
  }, [view, auditAction, auditEntity, auditAdmin, auditEntityId, auditFrom, auditTo]);

  const exportAudit = () => {
    const csv = [["timestamp","admin","action","entity_type","entity_id","details"], ...auditLog.map((entry) => [entry.createdAt,entry.adminId,entry.action,entry.entityType,entry.entityId,JSON.stringify(entry.details)])].map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); anchor.download = "admin-audit-log.csv"; anchor.click(); URL.revokeObjectURL(anchor.href);
  };

  useEffect(() => {
    if (!form.factoryId) { setFormRoutes([]); return; }
    void readRoutes(form.factoryId).then(setFormRoutes).catch(() => setFormRoutes([]));
  }, [form.factoryId]);

  useEffect(() => {
    if (!editing?.factoryId) { setEditRoutes([]); return; }
    void readRoutes(editing.factoryId).then(setEditRoutes).catch(() => setEditRoutes([]));
  }, [editing?.factoryId]);

  useEffect(() => {
    if (!editing?.id) return;
    let active = true;
    void readUserRouteAssignments(editing.id).then((rows) => {
      if (active && rows.length) setEditing((current) => current?.id === editing.id ? { ...current, factoryId: rows[0].factoryId, routeIds: rows.map((route) => route.id) } : current);
    }).catch(() => {});
    return () => { active = false; };
  }, [editing?.id]);

  // Refresh options on opening an editor; expose failures instead of leaving a
  // misleading empty select. This also picks up estates registered recently.
  useEffect(() => {
    if (!editing?.id) return;
    let active = true;
    setEstateOptionsLoading(true);
    setEstateOptionsError(null);
    void readEstateOptions()
      .then((rows) => { if (active) { setEstateOptions(rows); setEstateOptionsError(null); } })
      .catch((err) => { if (active) setEstateOptionsError(err instanceof Error ? err.message : "Could not load estates."); })
      .finally(() => { if (active) setEstateOptionsLoading(false); });
    return () => { active = false; };
  }, [editing?.id]);

  const filtered = users.filter((u) => filter === "all" || u.role === filter);
  const active = users.filter((u) => u.status === "active" && !u.deactivatedAt).length;
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

  const approve = async (u: ManagedUser) => {
    try {
      await updateSupplierOperationalFields(u.id, { status: "active" });
      await getSupabase()?.from("admin_audit_log").insert({ admin_id: userUid, action: "approve", entity_type: "user", entity_id: u.id, details: { registration: true } });
      void reload();
      notify({ title: "Supplier approved ✅", body: `${u.name} can now sign in.`, tone: "emerald", channel: "system" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve supplier.");
    }
  };

  const rejectRegistration = async (u: ManagedUser) => {
    if (!window.confirm(`Reject ${u.name}'s supplier registration?`)) return;
    try {
      await updateSupplierOperationalFields(u.id, { status: "rejected" });
      await getSupabase()?.from("admin_audit_log").insert({ admin_id: userUid, action: "reject", entity_type: "user", entity_id: u.id, details: { registration: true } });
      void reload();
      notify({ title: "Registration rejected", body: "The account will be removed automatically after seven days.", tone: "rose", channel: "system" });
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to reject supplier."); }
  };

  const deactivate = async (u: ManagedUser) => {
    setBusy(true);
    setError(null);
    try {
      await setUserDeactivated(u.id, !u.deactivatedAt, userUid);
      void reload(); // refresh from DB
      notify({ title: u.deactivatedAt ? "User reactivated" : "User deactivated", body: `${u.name}'s profile and history were preserved.`, tone: u.deactivatedAt ? "emerald" : "rose", channel: "system" });
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change account activation.");
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
    if (editing.role === "supplier" && !editing.supplierNo.trim()) {
      setError("Supplier No is required for suppliers.");
      return;
    }
    if ((editing.role === "supplier" || editing.role === "extension_officer") && (!editing.factoryId || !editing.routeIds.length)) {
      setError("Factory and at least one route are required for suppliers and collectors.");
      return;
    }
    // Division is optional for Extension Officers.
    setBusy(true);
    setError(null);
    try {
      if (editing.role === "supplier" || editing.role === "extension_officer") await assertMultiRouteSchemaReady();
      const division = editing.role === "extension_officer" ? allDivisions.find((d) => d.id === editing.divisionId)?.name ?? editing.divisionId : null;
      const association = editing.role === "supplier" ? editing.estateId : null;
      await updateUserProfile(editing.id, {
        name: editing.name.trim(),
        role: editing.role,
        division,
        phone: editing.phone.trim() || null,
        ...(editing.status === "pending_approval" ? {} : { status: editing.status }),
      });
      if (editing.role === "supplier") {
        await updateSupplierOperationalFields(editing.id, {
          supplierNo: editing.supplierNo.trim(),
          officeSupplierId: editing.officeSupplierId.trim() || null,
        });
      }
      if (editing.role === "supplier" || editing.role === "extension_officer") {
        await replaceUserRoutes({ userId: editing.id, factoryId: editing.factoryId, routeIds: editing.routeIds, primaryRouteId: editing.routeIds[0] });
      }
      // Persist the estate link after the route/profile updates, then verify the
      // stored value. This makes the requested association the final write in
      // the save flow and prevents the form closing on a silently missed update.
      const latestEstates = await readEstateOptions();
      setEstateOptions(latestEstates);
      if (association && !latestEstates.some((estate) => estate.id === association)) {
        throw new Error("The selected estate is no longer available. Refresh the estate list and try again.");
      }
      await saveUserEstateAssociation(editing.id, association);
      const savedEstateId = await readUserEstateAssociation(editing.id);
      if ((savedEstateId ?? null) !== association) {
        throw new Error("The selected estate link did not remain on the supplier profile. Please retry and check the database update permissions.");
      }
      await reload();
      setEstateOptions(await readEstateOptions());
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
    if (form.role === "supplier" && !form.supplierNo.trim()) { setError("Supplier No is required for suppliers."); return; }
    if ((form.role === "supplier" || form.role === "extension_officer") && (!form.factoryId || !form.routeIds.length)) { setError("Factory and at least one route are required for suppliers and collectors."); return; }
    // Division is optional for Extension Officers.
    if ((form.role === "admin" || form.role === "super_admin") && !canManageAdmins) { setError("Only a Super Admin can create admin accounts."); return; }
    if (form.password.length < 6) { setError("Temporary password must be at least 6 characters."); return; }

    setBusy(true);
    try {
      if (form.role === "supplier" || form.role === "extension_officer") await assertMultiRouteSchemaReady();
      const association = form.role === "supplier" ? form.estateId : null;
      const division = form.role === "extension_officer" ? allDivisions.find((d) => d.id === form.divisionId)?.name ?? form.divisionId : null;
      const newUserId = await provisionUser(form.email.trim(), form.password, {
        name: form.name.trim(),
        role: form.role,
        associatedEntityId: association,
        division,
        phone: form.phone.trim() || null,
      });
      if (form.role === "supplier") {
        await updateSupplierOperationalFields(newUserId, {
          supplierNo: form.supplierNo.trim(),
          officeSupplierId: form.officeSupplierId.trim() || null,
        });
      }
      if (form.role === "supplier" || form.role === "extension_officer") {
        await replaceUserRoutes({ userId: newUserId, factoryId: form.factoryId, routeIds: form.routeIds, primaryRouteId: form.routeIds[0] });
      }
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

  if (view === "audit") {
    return (
      <div>
        <PageHeader eyebrow="Administration" title="Audit Log" desc="Read-only history of administrator actions on estates and user accounts." icon={<IconChip icon={ScrollText} tone="violet" className="h-12 w-12" />} />
        <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1 text-sm font-bold">
          <button onClick={() => setView("directory")} className="rounded-lg px-4 py-2 text-slate-500">Directory</button>
          <button className="rounded-lg bg-white px-4 py-2 text-violet-700 shadow-sm">Audit Log</button>
        </div>
        {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
        <Card className="p-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <select value={auditAction} onChange={(e) => setAuditAction(e.target.value)} className={inputCls}><option value="">All actions</option><option value="create">Create</option><option value="edit">Edit</option><option value="approve">Approve</option><option value="reject">Reject</option><option value="deactivate">Deactivate</option><option value="reactivate">Reactivate</option></select>
            <select value={auditEntity} onChange={(e) => setAuditEntity(e.target.value)} className={inputCls}><option value="">All entities</option><option value="estate">Estate</option><option value="user">User</option></select>
            <input value={auditAdmin} onChange={(e) => setAuditAdmin(e.target.value)} placeholder="Admin UID" className={inputCls} />
            <input value={auditEntityId} onChange={(e) => setAuditEntityId(e.target.value)} placeholder="Entity ID" className={inputCls} />
            <input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)} className={inputCls} />
            <div className="flex gap-2"><input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)} className={inputCls} /><button onClick={exportAudit} className="mt-1 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white">Export CSV</button></div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs"><thead><tr className="border-b text-slate-400"><th className="px-3 py-2">Timestamp</th><th className="px-3 py-2">Admin</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entity Type</th><th className="px-3 py-2">Entity ID</th><th className="px-3 py-2">Details</th></tr></thead><tbody>{auditLog.map((entry) => <tr key={entry.id} className="border-b border-slate-100"><td className="whitespace-nowrap px-3 py-3">{new Date(entry.createdAt).toLocaleString("en-LK")}</td><td className="px-3 py-3 font-semibold">{entry.adminName ?? entry.adminId}</td><td className="px-3 py-3"><Badge tone={entry.action === "approve" || entry.action === "reactivate" ? "emerald" : entry.action === "reject" || entry.action === "deactivate" ? "rose" : "sky"}>{entry.action}</Badge></td><td className="px-3 py-3">{entry.entityType}</td><td className="px-3 py-3 font-mono text-[10px]">{entry.entityId}</td><td className="max-w-xs truncate px-3 py-3 text-slate-400">{JSON.stringify(entry.details)}</td></tr>)}</tbody></table>
            {auditLog.length === 0 && <p className="py-12 text-center text-sm text-slate-400">No audit entries match these filters.</p>}
          </div>
        </Card>
      </div>
    );
  }

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

      {loadError && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          User directory could not be loaded: {loadError}
        </p>
      )}

      <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1 text-sm font-bold">
        <button className="rounded-lg bg-white px-4 py-2 text-emerald-700 shadow-sm">Directory</button>
        <button onClick={() => setView("audit")} className="rounded-lg px-4 py-2 text-slate-500">Audit Log</button>
      </div>

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
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role, estateId: "", divisionId: "", supplierNo: "", factoryId: "", routeIds: [] })} className={inputCls}>
                <option value="extension_officer">Extension Officer</option>
                <option value="supplier">Supplier</option>
                {canManageAdmins && <option value="admin">Admin</option>}
                {canManageAdmins && <option value="super_admin">Super Admin</option>}
              </select>
            </div>
            <div><label className={labelCls}><Mail className="mr-1 inline h-3 w-3" />Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@kdu.com" className={inputCls} /></div>
            <div><label className={labelCls}><KeyRound className="mr-1 inline h-3 w-3" />Temporary password</label><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 chars" className={inputCls} /></div>
            <div><label className={labelCls}>Phone (optional)</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+94 77 000 0000" className={inputCls} /></div>
            {form.role === "supplier" && (
              <>
              <div><label className={labelCls}>Supplier No (factory number) *</label><input value={form.supplierNo} onChange={e => setForm({ ...form, supplierNo: e.target.value })} placeholder="e.g., 237" className={inputCls} /></div>
              <div><label className={labelCls}>Office Supplier ID / Card ID</label><input value={form.officeSupplierId} onChange={e => setForm({ ...form, officeSupplierId: e.target.value })} placeholder="e.g., 01" className={inputCls} /><p className="mt-1 text-[10px] text-slate-400">Used for official leaf, crop and balance data.</p></div>
              <div><label className={labelCls}><Building2 className="mr-1 inline h-3 w-3" />Link to Estate (optional)</label>
                <select value={form.estateId} onChange={(e) => setForm({ ...form, estateId: e.target.value })} className={inputCls}>
                  <option value="">— no linked estate —</option>
                  {estateOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <p className="mt-1 text-[10px] text-slate-400">If no estate is selected, the supplier can register their own plots after signing in.</p>
              </div>
              </>
            )}
            {(form.role === "supplier" || form.role === "extension_officer") && <>
              <div><label className={labelCls}>Factory *</label><select value={form.factoryId} onChange={e => setForm({ ...form, factoryId: e.target.value, routeIds: [] })} className={inputCls}><option value="">— select factory —</option>{factories.map(factory => <option key={factory.id} value={factory.id}>{factory.name}</option>)}</select></div>
              <div className="sm:col-span-2"><label className={labelCls}>Authorized routes *</label><RouteMultiSelect routes={formRoutes} selected={form.routeIds} onChange={(routeIds) => setForm({ ...form, routeIds })} disabled={!form.factoryId || busy} /></div>
            </>}
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
              <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as Role, estateId: "", divisionId: "", supplierNo: "", factoryId: "", routeIds: [] })} className={inputCls}>
                <option value="extension_officer">Extension Officer</option>
                <option value="supplier">Supplier</option>
                {canManageAdmins && <option value="admin">Admin</option>}
                {canManageAdmins && <option value="super_admin">Super Admin</option>}
              </select>
            </div>
            <div><label className={labelCls}>Phone</label><input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="+94 77 000 0000" className={inputCls} /></div>
            <div>
              <label className={labelCls}>Status</label>
              <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as EditForm["status"] })} className={inputCls}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="pending_approval">Pending approval</option>
              </select>
            </div>
            {editing.role === "supplier" && (
              <>
              <div><label className={labelCls}>Supplier No *</label><input value={editing.supplierNo} onChange={(e) => setEditing({ ...editing, supplierNo: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Office Supplier ID / Card ID</label><input value={editing.officeSupplierId} onChange={(e) => setEditing({ ...editing, officeSupplierId: e.target.value })} placeholder="e.g. 01" className={inputCls} /><p className="mt-1 text-[10px] text-slate-400">Required for official leaf and balance data.</p></div>
              <div><label className={labelCls}><Building2 className="mr-1 inline h-3 w-3" />Link to Estate (optional)</label>
                <select value={editing.estateId} onChange={(e) => { setEditing({ ...editing, estateId: e.target.value }); setError(null); }} disabled={estateOptionsLoading || busy || !!estateOptionsError} className={inputCls}>
                  <option value="">{estateOptionsLoading ? "Loading estates…" : "— no linked estate —"}</option>
                  {estateOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                {estateOptionsError && <p className="mt-1 text-[11px] text-rose-600">{estateOptionsError}</p>}
                {!estateOptionsLoading && !estateOptionsError && estateOptions.length === 0 && <p className="mt-1 text-[11px] text-amber-700">No estates are available to link. Register an estate first.</p>}
                {!estateOptionsLoading && editing.estateId && !estateOptions.some((estate) => estate.id === editing.estateId) && <p className="mt-1 text-[11px] text-amber-700">This supplier has an estate ID that is not in the current estate list. Refresh the list before saving.</p>}
              </div>
              </>
            )}
            {(editing.role === "supplier" || editing.role === "extension_officer") && <>
              <div><label className={labelCls}>Factory *</label><select value={editing.factoryId} onChange={(e) => setEditing({ ...editing, factoryId: e.target.value, routeIds: [] })} className={inputCls}><option value="">— select factory —</option>{factories.map((factory) => <option key={factory.id} value={factory.id}>{factory.name}</option>)}</select></div>
              <div className="sm:col-span-2"><label className={labelCls}>Authorized routes *</label><RouteMultiSelect routes={editRoutes} selected={editing.routeIds} onChange={(routeIds) => setEditing({ ...editing, routeIds })} disabled={!editing.factoryId || busy} /></div>
            </>}
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
              <p className="text-sm font-bold text-slate-800">{confirmDelete.deactivatedAt ? "Reactivate" : "Deactivate"} {confirmDelete.name}?</p>
              <p className="mt-0.5 text-xs text-slate-500">This is recoverable. The user profile, estates and operational history remain stored; a deactivated user cannot access the app.</p>
            </div>
          </div>
          {error && <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setConfirmDelete(null); setError(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">Cancel</button>
            <button onClick={() => deactivate(confirmDelete)} disabled={busy} className={`inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-60 ${confirmDelete.deactivatedAt ? "bg-emerald-600" : "bg-rose-600"}`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} {confirmDelete.deactivatedAt ? "Reactivate user" : "Deactivate user"}
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
        ) : !loadError && filtered.length === 0 ? (
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
                  <div className="text-xs"><p className="font-semibold text-violet-700">#{u.supplierNo ?? "—"} · {u.factoryName ?? "No factory"}</p><p className="text-slate-400">{u.routeName ?? "No route"} · {estateName(u.associatedEntityId)}</p></div>
                ) : u.role === "extension_officer" ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700"><Layers className="h-3 w-3" /> {divisionName(u.division)}</span>
                ) : <span className="text-xs text-slate-400">—</span>,
            },
            { key: "status", header: "Status", align: "center", render: (u) => <Badge tone={u.deactivatedAt ? "rose" : u.status === "active" ? "emerald" : u.status === "pending_approval" ? "amber" : "rose"} dot>{u.deactivatedAt ? "Deactivated" : u.status === "pending_approval" ? "Pending approval" : u.status}</Badge> },
            {
              key: "actions", header: "Actions", align: "right",
              render: (u) => (
                <div className="flex items-center justify-end gap-1.5">
                  {/* Edit — all admins can edit (their own scope) */}
                  <button
                    onClick={() => { setEditing({ id: u.id, name: u.name, role: u.role, phone: u.phone ?? "", estateId: u.associatedEntityId ?? "", divisionId: u.division ?? "", supplierNo: u.supplierNo ?? "", factoryId: u.factoryId ?? "", routeIds: u.routeId ? [u.routeId] : [], officeSupplierId: u.officeSupplierId ?? "", status: u.status }); setAdding(false); setConfirmDelete(null); setError(null); }}
                    title="Edit"
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  {/* Suspend/Reactivate — admins */}
                  {u.deactivatedAt ? null : u.status === "pending_approval" ? (
                    <><button onClick={() => approve(u)} title="Approve supplier" className="rounded-lg px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50">Approve</button><button onClick={() => void rejectRegistration(u)} title="Reject registration" className="rounded-lg px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50">Reject</button></>
                  ) : (
                    <button onClick={() => toggle(u)} title={u.status === "active" ? "Suspend" : "Reactivate"} className={`rounded-lg p-1.5 ${u.status === "active" ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}><Ban className="h-4 w-4" /></button>
                  )}
                  {/* Recoverable soft-deactivation — SUPER ADMIN ONLY */}
                  {canManageAdmins && !isSelf(u) && (
                    <button onClick={() => { setConfirmDelete(u); setError(null); }} title={u.deactivatedAt ? "Reactivate user" : "Deactivate user"} className={`rounded-lg p-1.5 ${u.deactivatedAt ? "text-emerald-600 hover:bg-emerald-50" : "text-rose-500 hover:bg-rose-50"}`}>
                      <Ban className="h-4 w-4" />
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
          <strong>Edit</strong> updates the Supabase profile. <strong>Deactivate</strong> is restricted to <strong>Super Admin</strong> and preserves the profile and history for later reactivation. New users are created via a secondary Firebase Auth instance so you stay logged in.
        </p>
      </div>
    </div>
  );
}
