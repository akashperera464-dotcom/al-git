import { useEffect, useState } from "react";
import { ShieldCheck, FileCheck, FileText, Download, BookCheck, Plus, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { PageHeader, StatCard, Panel, Badge, Meter, IconChip, Card } from "@/components/ui";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { complianceItems as seedItems, addDays, TODAY_ISO, fmtNum, type ComplianceItem } from "@/lib/data";
import { useApp } from "@/context/AppContext";

type Tab = "overview" | "items" | "audit_log" | "add";

interface ComplianceItemFull extends ComplianceItem {
  certBody?: string;
  lastAudited?: string;
  nextAuditDue?: string;
  notes?: string;
  version: number;
}

interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId?: string;
  action: string;
  performedBy?: string;
  performedAt: string;
  details?: Record<string, unknown>;
}

const VAULT = [
  { standard: "Rainforest Alliance", icon: "🌿", tone: "emerald" as const },
  { standard: "Fairtrade International", icon: "🤝", tone: "amber" as const },
  { standard: "ISO 22000", icon: "⚙️", tone: "sky" as const },
  { standard: "Ethical Tea Partnership", icon: "🫖", tone: "violet" as const },
];

const CHECKLIST = [
  { label: "Pesticide residue logs (12 mo)", done: true },
  { label: "Worker welfare & wages audit", done: true },
  { label: "Water protection buffer zones", done: true },
  { label: "Biodiversity inventory updated", done: false },
  { label: "Traceability (field → factory → ship)", done: true },
  { label: "Grievance mechanism documented", done: false },
];

export default function AuditCompliance() {
  const { userUid } = useApp();
  const [tab, setTab] = useState<Tab>("overview");
  const [items, setItems] = useState<ComplianceItemFull[]>(seedItems.map(c => ({ ...c, version: 1 })));
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState({
    standard: "", status: "In Audit", score: 80, expiryDate: "", certBody: "", notes: "",
  });

  const reload = async () => {
    if (!supabaseConfigured) return;
    setBusy(true);
    try {
      const sb = getSupabase()!;
      const [ci, al] = await Promise.all([
        sb.from("compliance_items").select("*").order("standard"),
        sb.from("audit_log_entries").select("*").order("performed_at", { ascending: false }).limit(50),
      ]);
      if (ci.data) setItems(ci.data.map((r: Record<string, unknown>) => ({
        id: r.id as string, standard: r.standard as string,
        status: r.status as ComplianceItem["status"], score: Number(r.score ?? 0),
        expiry: (r.expiry_date ?? r.expiry ?? "") as string,
        certBody: r.cert_body as string | undefined,
        lastAudited: r.last_audited as string | undefined,
        nextAuditDue: r.next_audit_due as string | undefined,
        notes: r.notes as string | undefined,
        version: Number(r.version ?? 1),
      })));
      if (al.data) setAuditLog(al.data.map((r: Record<string, unknown>) => ({
        id: r.id as string, entityType: r.entity_type as string,
        entityId: r.entity_id as string | undefined, action: r.action as string,
        performedBy: r.performed_by as string | undefined,
        performedAt: r.performed_at as string,
        details: r.details as Record<string, unknown> | undefined,
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const addItem = async () => {
    setError(null);
    if (!form.standard.trim()) { setError("Standard name required"); return; }
    setBusy(true);
    try {
      if (!supabaseConfigured) {
        setItems([...items, { id: `cp-${Date.now()}`, standard: form.standard, status: form.status as ComplianceItem["status"], score: form.score, expiry: form.expiryDate || addDays(TODAY_ISO, 365), certBody: form.certBody, notes: form.notes, version: 1 }]);
      } else {
        const sb = getSupabase()!;
        const { error: err } = await sb.from("compliance_items").insert({
          standard: form.standard, status: form.status, score: form.score,
          expiry_date: form.expiryDate || addDays(TODAY_ISO, 365), cert_body: form.certBody,
          notes: form.notes, last_audited: TODAY_ISO, next_audit_due: form.expiryDate || addDays(TODAY_ISO, 365),
        });
        if (err) throw err;
        // Log to audit trail
        await sb.from("audit_log_entries").insert({
          entity_type: "compliance_item", action: "created",
          performed_by: userUid, details: { standard: form.standard, status: form.status },
        });
      }
      setSuccess(`Compliance item "${form.standard}" added`);
      setForm({ standard: "", status: "In Audit", score: 80, expiryDate: "", certBody: "", notes: "" });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (item: ComplianceItemFull, newStatus: string) => {
    setBusy(true);
    try {
      if (!supabaseConfigured) {
        setItems(items.map(i => i.id === item.id ? { ...i, status: newStatus as ComplianceItem["status"] } : i));
      } else {
        const sb = getSupabase()!;
        await sb.from("compliance_items").update({ status: newStatus }).eq("id", item.id);
        await sb.from("audit_log_entries").insert({
          entity_type: "compliance_item", entity_id: item.id,
          action: "updated", performed_by: userUid,
          details: { standard: item.standard, oldStatus: item.status, newStatus },
        });
      }
      setSuccess(`${item.standard} → ${newStatus}`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const certified = items.filter(c => c.status === "Certified").length;
  const actionNeeded = items.filter(c => c.status === "Action Needed").length;
  const avgScore = items.length > 0 ? Math.round(items.reduce((s, c) => s + c.score, 0) / items.length) : 0;
  const nextExpiry = items.length > 0
    ? Math.round((new Date(items.reduce((m, c) => new Date(c.expiry) < new Date(m) ? c.expiry : m, items[0].expiry)).getTime() - new Date(TODAY_ISO).getTime()) / 86400000)
    : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Audit & Compliance"
        title="Certification Vault & Audit Trail"
        desc="Compliance standards (Rainforest Alliance, Fairtrade, ISO 22000, ETP), audit scores, expiry tracking, and full audit log."
        icon={<IconChip icon={ShieldCheck} tone="emerald" className="h-12 w-12" />}
        actions={<button onClick={() => void reload()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Refresh</button>}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={ShieldCheck} label="Certified" value={`${certified}/${items.length}`} sub="Active standards" tone="emerald" />
        <StatCard icon={BookCheck} label="Avg Score" value={`${avgScore}%`} sub="Across all audits" tone="sky" />
        <StatCard icon={AlertTriangle} label="Action Needed" value={String(actionNeeded)} sub="Requires attention" tone="rose" />
        <StatCard icon={FileCheck} label="Next Expiry" value={`${fmtNum(nextExpiry)}d`} sub="Days remaining" tone="amber" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {([
          { id: "overview", label: "Overview", icon: ShieldCheck },
          { id: "items", label: `Compliance Items (${items.length})`, icon: FileCheck },
          { id: "audit_log", label: `Audit Log (${auditLog.length})`, icon: BookCheck },
          { id: "add", label: "Add Standard", icon: Plus },
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

      {/* Overview */}
      {tab === "overview" && (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Compliance Posture" subtitle="Audit score by standard" icon={<IconChip icon={ShieldCheck} tone="emerald" className="h-9 w-9" />}>
            <div className="space-y-3">
              {items.map(c => {
                const days = Math.round((new Date(c.expiry).getTime() - new Date(TODAY_ISO).getTime()) / 86400000);
                return (
                  <div key={c.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">{c.standard}</span>
                      <Badge tone={c.status === "Certified" ? "emerald" : c.status === "Action Needed" ? "rose" : c.status === "Expired" ? "rose" : "amber"} dot>{c.status}</Badge>
                    </div>
                    <Meter value={c.score} tone={c.score >= 85 ? "emerald" : c.score >= 75 ? "amber" : "rose"} showLabel />
                    <p className="mt-1 text-[11px] text-slate-400">Expiry {c.expiry} · {days} days · score {c.score}{c.certBody ? ` · ${c.certBody}` : ""}</p>
                  </div>
                );
              })}
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel title="Documentation Vault" subtitle="Template repositories" icon={<IconChip icon={FileText} tone="violet" className="h-9 w-9" />}>
              <div className="grid grid-cols-2 gap-2.5">
                {VAULT.map(v => {
                  const count = items.filter(i => i.standard.includes(v.standard.split(" ")[0])).length;
                  return (
                    <div key={v.standard} className="rounded-xl border border-slate-100 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{v.icon}</span>
                        <Badge tone={v.tone}>{count} items</Badge>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-700">{v.standard}</p>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel title="Audit Checklist" subtitle="Ethical Tea Partnership renewal" icon={<IconChip icon={BookCheck} tone="sky" className="h-9 w-9" />}>
              <div className="space-y-2">
                {CHECKLIST.map(c => (
                  <div key={c.label} className="flex items-center gap-2.5 text-sm">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full ${c.done ? "bg-emerald-500 text-white" : "border-2 border-slate-300"}`}>
                      {c.done && <FileCheck className="h-3 w-3" />}
                    </span>
                    <span className={c.done ? "text-slate-600" : "text-slate-800 font-medium"}>{c.label}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      )}

      {/* Compliance Items CRUD */}
      {tab === "items" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Compliance Items ({items.length})</h3>
          <div className="space-y-2">
            {items.map(c => {
              const days = Math.round((new Date(c.expiry).getTime() - new Date(TODAY_ISO).getTime()) / 86400000);
              return (
                <div key={c.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{c.standard}</p>
                      <p className="text-[11px] text-slate-400">
                        Score: {c.score}% · Expiry: {c.expiry} ({days}d){c.certBody ? ` · ${c.certBody}` : ""}
                      </p>
                      {c.notes && <p className="text-[11px] text-slate-500 mt-0.5">"{c.notes}"</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={c.status === "Certified" ? "emerald" : c.status === "Action Needed" || c.status === "Expired" ? "rose" : "amber"} dot>{c.status}</Badge>
                      <select value={c.status} onChange={e => updateStatus(c, e.target.value)} disabled={busy}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px]">
                        <option>Certified</option>
                        <option>In Audit</option>
                        <option>Action Needed</option>
                        <option>Expired</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Audit Log */}
      {tab === "audit_log" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Audit Log ({auditLog.length})</h3>
          {auditLog.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No audit log entries yet. Actions on compliance items will appear here.</p>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {auditLog.map(a => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5 text-xs">
                  <Badge tone={a.action === "created" ? "emerald" : a.action === "updated" ? "sky" : a.action === "deleted" ? "rose" : "amber"}>{a.action}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">{a.entityType}{a.entityId ? ` · ${a.entityId.slice(0, 8)}…` : ""}</p>
                    {a.details && <p className="text-[11px] text-slate-400">{JSON.stringify(a.details)}</p>}
                  </div>
                  <span className="text-[10px] text-slate-400">{new Date(a.performedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Add Standard */}
      {tab === "add" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Add Compliance Standard</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] text-slate-400">Standard Name *</label>
              <input value={form.standard} onChange={e => setForm({ ...form, standard: e.target.value })} placeholder="e.g. Organic Certification" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option>Certified</option>
                <option>In Audit</option>
                <option>Action Needed</option>
                <option>Expired</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Score (%)</label>
              <input type="number" min="0" max="100" value={form.score} onChange={e => setForm({ ...form, score: +e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Expiry Date</label>
              <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Certification Body</label>
              <input value={form.certBody} onChange={e => setForm({ ...form, certBody: e.target.value })} placeholder="e.g. SGS, FLOCERT" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] text-slate-400">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
          </div>
          <button onClick={addItem} disabled={busy} className="mt-4 w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Add Standard</button>
        </Card>
      )}
    </div>
  );
}
