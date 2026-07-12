import { useState, type ReactNode } from "react";
import { Plus, Pencil, Trash2, Loader2, Check, X, AlertTriangle, RefreshCw } from "lucide-react";
import { PageHeader, Card, IconChip, DataTable, type Column } from "@/components/ui";
import { useLiveData } from "@/lib/useLiveData";
import { useApp } from "@/context/AppContext";
import { crudRead, crudCreate, crudUpdate, crudDelete } from "@/lib/repo";

/**
 * CrudPanel — a reusable full-CRUD module for any admin table.
 *
 * Usage:
 *   <CrudPanel table="payroll_runs" title="Payroll" fields={[...]} columns={[...]} icon={...} tone="emerald" />
 *
 * This single component powers Payroll, Loans, Loyalty, Welfare, Finance,
 * Fertilizer, Agrochemical, Inventory, Vehicles, Factory, and Crop Tasks.
 */
interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "boolean" | "textarea";
  options?: string[];
  default?: unknown;
  step?: string;
}

export function CrudPanel<T extends { id: string }>({
  table,
  title,
  eyebrow,
  desc,
  icon,
  tone = "emerald",
  fields,
  columns,
  toDb,
  fromDb,
}: {
  table: string;
  title: string;
  eyebrow?: string;
  desc?: string;
  icon: ReactNode;
  tone?: "emerald" | "amber" | "rose" | "sky" | "violet";
  fields: FieldDef[];
  columns: Column<T>[];
  /** Map form values → DB column names (camelCase → snake_case). */
  toDb: (form: Record<string, unknown>) => Record<string, unknown>;
  /** Map DB row → display type (snake_case → camelCase). */
  fromDb: (row: Record<string, unknown>) => T;
}) {
  const { notify } = useApp();
  const { data: rawRows, loading, reload } = useLiveData<Record<string, unknown>>(table, () => crudRead(table));
  const rows = rawRows.map(fromDb);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; form: Record<string, unknown> } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emptyForm = () => {
    const f: Record<string, unknown> = {};
    fields.forEach((fd) => (f[fd.key] = fd.default ?? (fd.type === "number" ? 0 : fd.type === "boolean" ? false : "")));
    return f;
  };
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);

  const inputCls = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm";
  const labelCls = "text-[11px] font-medium text-slate-400";

  const add = async () => {
    setError(null);
    const required = fields.filter((f) => !f.default && f.type !== "boolean");
    for (const f of required) {
      if (!String(form[f.key] ?? "").trim()) { setError(`${f.label} is required.`); return; }
    }
    setBusy(true);
    try {
      await crudCreate(table, toDb(form));
      void reload();
      notify({ title: `${title} entry added ✅`, body: `Saved to database.`, tone: "emerald", channel: "system" });
      setForm(emptyForm());
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await crudUpdate(table, editing.id, toDb(editing.form));
      void reload();
      notify({ title: `${title} updated ✅`, body: `Changes saved.`, tone: "emerald", channel: "system" });
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await crudDelete(table, id);
      void reload();
      notify({ title: `${title} entry deleted`, body: `Removed from database.`, tone: "rose", channel: "system" });
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  };

  const renderField = (fd: FieldDef, value: unknown, onChange: (v: unknown) => void) => {
    if (fd.type === "select") {
      return (
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={inputCls}>
          {fd.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (fd.type === "boolean") {
      return (
        <select value={value ? "yes" : "no"} onChange={(e) => onChange(e.target.value === "yes")} className={inputCls}>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      );
    }
    if (fd.type === "textarea") {
      return (
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          placeholder="Type or paste your article content here…"
          className={`${inputCls} min-h-[200px] resize-y leading-relaxed`}
        />
      );
    }
    return (
      <input
        type={fd.type === "number" ? "number" : fd.type === "date" ? "date" : "text"}
        step={fd.step}
        value={String(value ?? "")}
        onChange={(e) => onChange(fd.type === "number" ? +e.target.value : e.target.value)}
        className={`${inputCls} ${fd.type === "number" ? "tnum" : ""}`}
      />
    );
  };

  // Form grid (used for both create + edit)
  const FormGrid = ({ data, setData }: { data: Record<string, unknown>; setData: (k: string, v: unknown) => void }) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {fields.map((fd) => (
        <div key={fd.key} className={fd.type === "textarea" ? "sm:col-span-2 lg:col-span-4" : ""}>
          <label className={labelCls}>{fd.label}</label>
          {renderField(fd, data[fd.key], (v) => setData(fd.key, v))}
        </div>
      ))}
    </div>
  );

  // Add action + delete columns
  const allColumns: Column<T>[] = [
    ...columns,
    {
      key: "_actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => {
              const editForm: Record<string, unknown> = {};
              fields.forEach((fd) => {
                const val = (row as Record<string, unknown>)[fd.key];
                editForm[fd.key] = val ?? fd.default ?? "";
              });
              setEditing({ id: row.id, form: editForm });
              setAdding(false);
              setConfirmDelete(null);
              setError(null);
            }}
            title="Edit"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setConfirmDelete(row); setError(null); }}
            title="Delete"
            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={eyebrow ?? title}
        title={title}
        desc={desc ?? `Full CRUD — create, edit, delete ${title.toLowerCase()} entries.`}
        icon={icon}
        actions={
          <button onClick={() => { setAdding((a) => !a); setError(null); }} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110" style={{ background: tone === "violet" ? "#7c3aed" : tone === "amber" ? "#d97706" : tone === "rose" ? "#e11d48" : tone === "sky" ? "#0284c7" : "#059669" }}>
            <Plus className="h-4 w-4" /> {adding ? "Close" : `Add`}
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <IconChip icon={RefreshCw} tone={tone} className="h-11 w-11" />
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-400">Total Records</p>
          <p className="font-display text-2xl font-bold tracking-tight text-slate-900 tnum">{rows.length}</p>
        </Card>
      </div>

      {/* Create Form */}
      {adding && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Add New Entry</h3>
          <FormGrid data={form} setData={(k, v) => setForm((f) => ({ ...f, [k]: v }))} />
          {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setAdding(false); setError(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">Cancel</button>
            <button onClick={add} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white enabled:hover:brightness-110 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
            </button>
          </div>
        </Card>
      )}

      {/* Edit Form */}
      {editing && (
        <Card className="mt-4 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-slate-800">Edit Entry</h3>
            <button onClick={() => { setEditing(null); setError(null); }} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
          </div>
          <FormGrid data={editing.form} setData={(k, v) => setEditing((e) => e ? { ...e, form: { ...e.form, [k]: v } } : e)} />
          {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setEditing(null); setError(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">Cancel</button>
            <button onClick={saveEdit} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white enabled:hover:brightness-110 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save changes
            </button>
          </div>
        </Card>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <Card className="mt-4 border-rose-200 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600"><AlertTriangle className="h-5 w-5" /></span>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800">Delete this entry?</p>
              <p className="mt-0.5 text-xs text-slate-500">This permanently removes it from the database.</p>
            </div>
          </div>
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setConfirmDelete(null); setError(null); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500">Cancel</button>
            <button onClick={() => remove(confirmDelete.id)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete permanently
            </button>
          </div>
        </Card>
      )}

      {/* Data Table */}
      <Card className="mt-4 p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No records yet. Click "Add" to create one.</p>
        ) : (
          <DataTable<T> rows={rows} columns={allColumns} />
        )}
      </Card>
    </div>
  );
}
