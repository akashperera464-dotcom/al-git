import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, Check, Eye, History, Loader2, Pencil, Plus, RefreshCw, Save, Search, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, Card, IconChip, PageHeader } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { approveEstateAndNotify, rejectEstateAndNotify } from "@/lib/approvalWorkflow";
import { provisionUser } from "@/lib/auth.hybrid";
import { createEstate, deleteEstate, readAuditLog, readEstates, searchSupplierByNo, sizeFromAcreage, updateEstate, type AuditLogEntry, type Estate, type EstateSizeCategory, type EstateStatus, type SupplierSearchResult } from "@/lib/estateRepo";
import { readFactories, readRoutes, updateSupplierOperationalFields, type FactoryOption, type RouteOption } from "@/lib/supplierOperations";
import CollectorAssignmentModule from "./CollectorAssignment";
import { RouteMultiSelect } from "@/components/RouteMultiSelect";
import { assertMultiRouteSchemaReady, readUserRouteAssignments, replaceUserRoutes } from "@/lib/userRoutes";
import PriceManagement from "./PriceManagement";
import FinancialDashboard from "./FinancialDashboard";
import { EstateLocationPicker } from "@/components/EstateLocationPicker";
import { parseEstateCoordinate } from "@/lib/estateLocation";
import FactoryApiMapping from "./FactoryApiMapping";

type Tab = "all" | "create" | "pending" | "assignments" | "prices" | "finance" | "office-api";
interface FormBlock { name: string; areaHa: number; bushCount: number; cultivar: string; soilType: string; }
interface FormState { ownership: "supplier" | "company"; name: string; acreage: number; bushCount: number; cultivar: string; region: string; soilType: string; latitude: string; longitude: string; address: string; contactPhone: string; photoUrls: string; factoryId: string; routeId: string; notes: string; blocks: FormBlock[]; }
const EMPTY_FORM: FormState = { ownership: "supplier", name: "", acreage: 0, bushCount: 0, cultivar: "TRI 2025 (VP)", region: "low-country", soilType: "", latitude: "", longitude: "", address: "", contactPhone: "", photoUrls: "", factoryId: "", routeId: "", notes: "", blocks: [] };
const inputCls = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";
const labelCls = "text-[11px] font-bold uppercase tracking-wide text-slate-400";
const statusTone = (status: EstateStatus): "emerald" | "amber" | "rose" => status === "approved" ? "emerald" : status === "pending" ? "amber" : "rose";
const estateToForm = (estate: Estate): FormState => ({
  ownership: estate.ownerSupplierId ? "supplier" : "company",
  name: estate.name,
  acreage: estate.acreage,
  bushCount: estate.bushCount,
  cultivar: estate.cultivar ?? "",
  region: estate.region ?? "low-country",
  soilType: estate.soilType ?? "",
  latitude: estate.latitude == null ? "" : String(estate.latitude),
  longitude: estate.longitude == null ? "" : String(estate.longitude),
  address: estate.address ?? "",
  contactPhone: estate.contactPhone ?? "",
  photoUrls: (estate.photoUrls ?? []).join("\n"),
  factoryId: estate.factoryId ?? "",
  routeId: estate.routeId ?? "",
  notes: estate.notes ?? "",
  blocks: estate.blocks.map((block) => ({ name: block.name, areaHa: block.areaHa, bushCount: block.bushCount, cultivar: block.cultivar ?? "", soilType: block.soilType ?? "" })),
});

export default function UnifiedEstateMaster() {
  const { t } = useTranslation();
  const { userUid, notify } = useApp();
  const requestedTab = sessionStorage.getItem("verda.estateMaster.tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(requestedTab && ["all", "create", "pending", "assignments", "prices", "finance", "office-api"].includes(requestedTab) ? requestedTab : "all");
  const [estates, setEstates] = useState<Estate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EstateStatus>("all");
  const [sizeFilter, setSizeFilter] = useState<"all" | EstateSizeCategory>("all");
  const [selected, setSelected] = useState<Estate | null>(null);
  const [editing, setEditing] = useState<Estate | null>(null);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [factories, setFactories] = useState<FactoryOption[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierResults, setSupplierResults] = useState<SupplierSearchResult[]>([]);
  const [supplier, setSupplier] = useState<SupplierSearchResult | null>(null);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", supplierNo: "", phone: "", email: "", password: "", factoryId: "", routeIds: [] as string[] });
  const [newSupplierRoutes, setNewSupplierRoutes] = useState<RouteOption[]>([]);

  const load = async () => { setLoading(true); setError(null); try { setEstates(await readEstates()); } catch (e) { setError(e instanceof Error ? e.message : "Could not load estates."); } finally { setLoading(false); } };
  useEffect(() => { sessionStorage.removeItem("verda.estateMaster.tab"); void load(); void readFactories().then(setFactories).catch(() => {}); }, []);
  useEffect(() => {
    if (!form.factoryId) { setRoutes([]); return; }
    const request = supplier ? readUserRouteAssignments(supplier.id) : readRoutes(form.factoryId);
    void request.then(setRoutes).catch(() => setRoutes([]));
  }, [form.factoryId, supplier]);
  useEffect(() => { if (!newSupplier.factoryId) { setNewSupplierRoutes([]); return; } void readRoutes(newSupplier.factoryId).then(setNewSupplierRoutes).catch(() => setNewSupplierRoutes([])); }, [newSupplier.factoryId]);
  useEffect(() => {
    if (!supplierQuery.trim() || supplier) { setSupplierResults([]); return; }
    const timer = window.setTimeout(() => void searchSupplierByNo(supplierQuery).then(setSupplierResults).catch((e) => setError(e instanceof Error ? e.message : "Supplier search failed.")), 250);
    return () => window.clearTimeout(timer);
  }, [supplierQuery, supplier]);

  const pending = estates.filter((estate) => estate.status === "pending" && !estate.createdByAdmin);
  const filtered = useMemo(() => { const q = query.trim().toLowerCase(); return estates.filter((estate) => (statusFilter === "all" || estate.status === statusFilter) && (sizeFilter === "all" || estate.sizeCategory === sizeFilter) && (!q || estate.name.toLowerCase().includes(q) || estate.owner?.name.toLowerCase().includes(q) || estate.owner?.supplierNo?.toLowerCase().includes(q))); }, [estates, query, statusFilter, sizeFilter]);

  const pickSupplier = (value: SupplierSearchResult) => {
    setSupplier(value); setSupplierQuery(value.supplierNo ? `${value.supplierNo} — ${value.name}` : value.name); setSupplierResults([]);
    setForm((current) => ({ ...current, contactPhone: current.contactPhone || value.phone || "", factoryId: value.factoryId || current.factoryId, routeId: value.routeId || current.routeId }));
  };
  const createInlineSupplier = async () => {
    if (!newSupplier.name.trim() || !newSupplier.supplierNo.trim() || !newSupplier.email.trim() || newSupplier.password.length < 6 || !newSupplier.factoryId || !newSupplier.routeIds.length) { setError("Name, supplier number, email, 6+ character temporary password, factory and at least one route are required."); return; }
    setBusy(true); setError(null);
    try {
      await assertMultiRouteSchemaReady();
      const id = await provisionUser(newSupplier.email.trim(), newSupplier.password, { name: newSupplier.name.trim(), role: "supplier", phone: newSupplier.phone.trim() || null, associatedEntityId: null });
      await updateSupplierOperationalFields(id, { supplierNo: newSupplier.supplierNo.trim(), status: "active" });
      await replaceUserRoutes({ userId: id, factoryId: newSupplier.factoryId, routeIds: newSupplier.routeIds, primaryRouteId: newSupplier.routeIds[0] });
      pickSupplier({ id, supplierNo: newSupplier.supplierNo.trim(), name: newSupplier.name.trim(), phone: newSupplier.phone.trim() || null, email: newSupplier.email.trim(), factoryId: newSupplier.factoryId, routeId: newSupplier.routeIds[0], factoryName: factories.find((f) => f.id === newSupplier.factoryId)?.name, routeName: newSupplierRoutes.find((r) => r.id === newSupplier.routeIds[0])?.name, status: "active" });
      setShowNewSupplier(false); notify({ title: "Supplier created", body: `${newSupplier.name} can sign in with the temporary password.`, tone: "emerald", channel: "system" });
    } catch (e) { setError(e instanceof Error ? e.message : "Supplier could not be created."); } finally { setBusy(false); }
  };
  const create = async () => {
    if (form.ownership === "supplier" && !supplier) { setError("Select an existing supplier or create one first."); return; }
    if (form.ownership === "supplier" && (!form.factoryId || !form.routeId)) { setError("Select an authorized factory route for the supplier estate."); return; }
    if (form.ownership === "supplier" && supplier?.factoryId && form.factoryId !== supplier.factoryId) { setError("A supplier estate must use the supplier's assigned factory."); return; }
    if (form.ownership === "supplier" && form.routeId && !routes.some((route) => route.id === form.routeId)) { setError("Select one of the supplier's authorized routes for this estate."); return; }
    if (!form.name.trim() || form.acreage <= 0) { setError("Estate name and acreage are required."); return; }
    const coordinatesEntered = Boolean(form.latitude.trim() || form.longitude.trim());
    const coordinates = parseEstateCoordinate(form.latitude, form.longitude);
    if (coordinatesEntered && !coordinates) { setError("Enter both a valid latitude (-90 to 90) and longitude (-180 to 180), or select the point on the map."); return; }
    setBusy(true); setError(null);
    try {
      const result = await createEstate({ ownerSupplierId: form.ownership === "supplier" ? supplier!.id : null, name: form.name, sizeCategory: sizeFromAcreage(form.acreage), acreage: form.acreage, bushCount: form.bushCount, cultivar: form.cultivar, region: form.region, soilType: form.soilType, latitude: coordinates?.latitude, longitude: coordinates?.longitude, address: form.address, contactPhone: form.contactPhone, photoUrls: form.photoUrls.split(/\r?\n|,/).map((url) => url.trim()).filter(Boolean), factoryId: form.factoryId, routeId: form.routeId, blocks: form.blocks.map((block) => ({ ...block, status: "plucking" })), notes: form.notes, createdByAdmin: true, actorId: userUid });
      if (!result.success) throw new Error(result.error ?? "Estate could not be created.");
      notify({ title: "Estate created and auto-approved", body: `${form.name} is visible to admin${supplier ? ` and ${supplier.name}` : ""}.`, tone: "emerald", channel: "system" });
      setForm(EMPTY_FORM); setSupplier(null); setSupplierQuery(""); setTab("all"); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Estate could not be created."); } finally { setBusy(false); }
  };
  const approve = async (estate: Estate) => { setBusy(true); const result = await approveEstateAndNotify(estate.id, userUid, "Approved from Estate Master"); if (result.success) { notify({ title: "Estate approved", body: `${estate.name} is now active for both admin and supplier.`, tone: "emerald", channel: "system" }); await load(); } else setError(result.error ?? "Approval failed."); setBusy(false); };
  const reject = async (estate: Estate) => { const reason = window.prompt(`Reason for rejecting “${estate.name}”:`); if (!reason?.trim()) return; setBusy(true); const result = await rejectEstateAndNotify(estate.id, userUid, reason.trim()); if (result.success) { notify({ title: "Estate rejected", body: "The supplier received the reason and may resubmit.", tone: "rose", channel: "system" }); await load(); } else setError(result.error ?? "Rejection failed."); setBusy(false); };
  const remove = async (estate: Estate) => { if (!window.confirm(`Delete “${estate.name}” and all its blocks?`)) return; setBusy(true); try { await deleteEstate(estate.id); await load(); setSelected(null); } catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); } finally { setBusy(false); } };
  const view = async (estate: Estate) => { setSelected(estate); setAudit(await readAuditLog({ entityType: "estate", entityId: estate.id }).catch(() => [])); };

  return <div>
    <PageHeader eyebrow="Estate Administration" title="Unified Estate Master" desc="Supplier-owned and company estates share one approval, ownership and audit workflow." icon={<IconChip icon={Building2} tone="emerald" className="h-12 w-12" />} actions={<button onClick={() => void load()} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>} />
    <div className="mb-4 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">{([['all', t('estateMaster.allEstates')], ['create', t('estateMaster.createNew')], ['pending', `${t('estateMaster.pendingApprovals')} (${pending.length})`], ['assignments', 'Collector Routes'], ['prices', 'Price Management'], ['finance', 'Finance'], ['office-api', 'Office API']] as const).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold ${tab === key ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}>{label}</button>)}</div>
    {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

    {tab === "all" && <Card className="p-4"><div className="mb-4 grid gap-3 sm:grid-cols-3"><div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className={`${inputCls} mt-0 pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Supplier No, estate or owner" /></div><select className={`${inputCls} mt-0`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><select className={`${inputCls} mt-0`} value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value as typeof sizeFilter)}><option value="all">All sizes</option><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></div>{loading ? <Loading /> : <EstateTable rows={filtered} busy={busy} onView={view} onEdit={setEditing} onApprove={approve} onReject={reject} onDelete={remove} />}</Card>}

    {tab === "create" && <Card className="p-5"><h2 className="font-bold text-slate-800">{t("estateMaster.createNew")}</h2><p className="text-xs text-slate-400">Admin-created estates are approved immediately and linked to the selected supplier.</p><div className="mt-4"><label className={labelCls}>{t("estateMaster.ownershipType")}</label><div className="mt-1 inline-flex rounded-xl bg-slate-100 p-1"><Choice active={form.ownership === "supplier"} onClick={() => setForm({ ...form, ownership: "supplier" })}>{t("estateMaster.supplierEstate")}</Choice><Choice active={form.ownership === "company"} onClick={() => { setForm({ ...form, ownership: "company" }); setSupplier(null); }}>{t("estateMaster.companyEstate")}</Choice></div></div>
      {form.ownership === "supplier" && <div className="relative mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"><Field label={t("estateMaster.searchSupplierNo")}><input className={inputCls} value={supplierQuery} onChange={(e) => { setSupplierQuery(e.target.value); setSupplier(null); }} placeholder="e.g. 237 or Sunil" /></Field>{supplierResults.length > 0 && <div className="absolute left-4 right-4 top-[78px] z-20 max-h-64 overflow-auto rounded-xl border bg-white p-1 shadow-xl">{supplierResults.map((result) => <button key={result.id} onClick={() => pickSupplier(result)} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-50"><b>{result.supplierNo ?? "—"} — {result.name}</b><span className="block text-xs text-slate-400">{result.phone ?? "—"} · {result.factoryName ?? "No factory"}/{result.routeName ?? "No route"}</span></button>)}</div>}{supplier && <div className="mt-3 grid gap-2 rounded-lg bg-white p-3 text-xs sm:grid-cols-3"><p><b>Name:</b> {supplier.name}</p><p><b>Phone:</b> {supplier.phone ?? "—"}</p><p><b>Email:</b> {supplier.email ?? "—"}</p><p><b>Factory:</b> {supplier.factoryName ?? "—"}</p><p><b>Route:</b> {supplier.routeName ?? "—"}</p><Badge tone={supplier.status === "active" ? "emerald" : "amber"}>{supplier.status}</Badge></div>}<button onClick={() => setShowNewSupplier(!showNewSupplier)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><UserPlus className="h-4 w-4" />{t("estateMaster.createNewSupplier")}</button>{showNewSupplier && <InlineSupplier value={newSupplier} setValue={setNewSupplier} factories={factories} routes={newSupplierRoutes} busy={busy} onCreate={createInlineSupplier} />}</div>}
      <EstateFormFields form={form} setForm={setForm} factories={factories} routes={routes} />
      <div className="mt-4 rounded-xl border bg-slate-50 p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Blocks ({form.blocks.length})</h3><button onClick={() => setForm({ ...form, blocks: [...form.blocks, { name: `Block ${form.blocks.length + 1}`, areaHa: 0, bushCount: 0, cultivar: form.cultivar, soilType: form.soilType }] })} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-700"><Plus className="mr-1 inline h-3 w-3" />Add block</button></div>{form.blocks.map((block, index) => <BlockRow key={index} block={block} onChange={(next) => setForm({ ...form, blocks: form.blocks.map((b, i) => i === index ? next : b) })} onDelete={() => setForm({ ...form, blocks: form.blocks.filter((_, i) => i !== index) })} />)}</div><div className="mt-4 flex justify-end"><button onClick={() => void create()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Create & auto-approve</button></div>
    </Card>}

    {tab === "pending" && <Card className="p-4">{loading ? <Loading /> : pending.length === 0 ? <Empty text="No supplier estate registrations are awaiting review." /> : <div className="space-y-3">{pending.map((estate) => <div key={estate.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4"><div className="min-w-0 flex-1"><p className="font-bold text-slate-800">{estate.name}</p><p className="text-xs text-slate-500">#{estate.owner?.supplierNo ?? "—"} · {estate.owner?.name ?? "Supplier"} · {estate.acreage.toFixed(2)} acres · {new Date(estate.submittedAt).toLocaleDateString("en-LK")}</p></div><button onClick={() => void view(estate)} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-sky-700">View</button><button onClick={() => void approve(estate)} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Approve</button><button onClick={() => void reject(estate)} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white">Reject</button></div>)}</div>}</Card>}
    {tab === "assignments" && <CollectorAssignmentModule />}
    {tab === "prices" && <PriceManagement />}
    {tab === "finance" && <FinancialDashboard />}
    {tab === "office-api" && <FactoryApiMapping />}
    {selected && <DetailModal estate={selected} audit={audit} onClose={() => setSelected(null)} />}
    {editing && <EditEstateModal estate={editing} factories={factories} actorId={userUid} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); notify({ title: "Estate updated", body: "Estate details and GPS location were saved.", tone: "emerald", channel: "system" }); }} />}
  </div>;
}

function EstateTable({ rows, busy, onView, onEdit, onApprove, onReject, onDelete }: { rows: Estate[]; busy: boolean; onView: (e: Estate) => void; onEdit: (e: Estate) => void; onApprove: (e: Estate) => void; onReject: (e: Estate) => void; onDelete: (e: Estate) => void; }) {
  if (!rows.length) return <Empty text="No estates match these filters." />;
  return <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead><tr className="border-b text-slate-400">{["Estate", "Owner", "Size / Land", "Factory / Route", "GPS", "Status", "Created by", "Actions"].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}</tr></thead><tbody>{rows.map((estate) => <tr key={estate.id} className="border-b border-slate-100"><td className="px-3 py-3 font-bold text-slate-800">{estate.name}</td><td className="px-3 py-3"><b>{estate.owner?.supplierNo ? `#${estate.owner.supplierNo} · ` : ""}{estate.owner?.name ?? "Company estate"}</b><span className="block text-slate-400">{estate.owner?.phone ?? "—"}</span></td><td className="px-3 py-3">{estate.sizeCategory}<span className="block text-slate-400">{estate.acreage.toFixed(2)} ac · {estate.bushCount.toLocaleString()} bushes</span></td><td className="px-3 py-3">{estate.factoryName ?? "—"}<span className="block text-slate-400">{estate.routeName ?? "—"}</span></td><td className="px-3 py-3">{estate.latitude != null && estate.longitude != null ? <span className="text-emerald-700">{estate.latitude.toFixed(5)}<br />{estate.longitude.toFixed(5)}</span> : <span className="text-amber-600">Not set</span>}</td><td className="px-3 py-3"><Badge tone={statusTone(estate.status)} dot>{estate.status}</Badge></td><td className="px-3 py-3">{estate.createdByAdmin ? "🛡️ Admin" : "👤 Supplier"}</td><td className="px-3 py-3"><div className="flex gap-1"><button title="View estate" onClick={() => onView(estate)} className="rounded-lg p-2 text-sky-600"><Eye className="h-4 w-4" /></button><button title="Edit estate" onClick={() => onEdit(estate)} className="rounded-lg p-2 text-amber-600"><Pencil className="h-4 w-4" /></button>{estate.status === "pending" && <><button onClick={() => onApprove(estate)} disabled={busy} className="rounded-lg p-2 text-emerald-600"><Check className="h-4 w-4" /></button><button onClick={() => onReject(estate)} disabled={busy} className="rounded-lg p-2 text-rose-600"><X className="h-4 w-4" /></button></>}{estate.status === "approved" && <button onClick={() => onDelete(estate)} disabled={busy} className="rounded-lg p-2 text-rose-500"><Trash2 className="h-4 w-4" /></button>}</div></td></tr>)}</tbody></table></div>;
}

function EstateFormFields({ form, setForm, factories, routes }: { form: FormState; setForm: (f: FormState) => void; factories: FactoryOption[]; routes: RouteOption[] }) {
  return <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <Field label="Estate name *"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
    <Field label="Acreage *"><input type="number" className={inputCls} value={form.acreage || ""} onChange={(e) => setForm({ ...form, acreage: Number(e.target.value) })} /><small className="text-slate-400">Suggested: {sizeFromAcreage(form.acreage)}</small></Field>
    <Field label="Bush count"><input type="number" className={inputCls} value={form.bushCount || ""} onChange={(e) => setForm({ ...form, bushCount: Number(e.target.value) })} /></Field>
    <Field label="Cultivar"><input className={inputCls} value={form.cultivar} onChange={(e) => setForm({ ...form, cultivar: e.target.value })} /></Field>
    <Field label="Region"><select className={inputCls} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}><option value="low-country">Low country</option><option value="mid-country">Mid country</option><option value="up-country">Up country</option></select></Field>
    <Field label="Soil type"><input className={inputCls} value={form.soilType} onChange={(e) => setForm({ ...form, soilType: e.target.value })} /></Field>
    <Field label="Factory"><select className={inputCls} value={form.factoryId} onChange={(e) => setForm({ ...form, factoryId: e.target.value, routeId: "" })}><option value="">— select —</option>{factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
    <Field label="Route"><select className={inputCls} value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })}><option value="">— select —</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.label || `${r.code ? `${r.code} — ` : ""}${r.name}`}</option>)}</select></Field>
    <Field label="Latitude"><input type="number" step="any" inputMode="decimal" className={inputCls} value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></Field>
    <Field label="Longitude"><input type="number" step="any" inputMode="decimal" className={inputCls} value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></Field>
    <div className="sm:col-span-2 lg:col-span-4"><EstateLocationPicker latitude={form.latitude} longitude={form.longitude} onChange={(latitude, longitude) => setForm({ ...form, latitude, longitude })} /></div>
    <div className="sm:col-span-2"><Field label="Address"><input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field></div>
    <Field label="Phone"><input className={inputCls} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></Field>
    <div className="sm:col-span-2"><Field label="Photo URLs"><textarea className={inputCls} value={form.photoUrls} onChange={(e) => setForm({ ...form, photoUrls: e.target.value })} /></Field></div>
    <div className="sm:col-span-2 lg:col-span-4"><Field label="Notes"><textarea className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
  </div>;
}

function EditEstateModal({ estate, factories, actorId, onClose, onSaved }: { estate: Estate; factories: FactoryOption[]; actorId: string; onClose: () => void; onSaved: () => Promise<void>; }) {
  const [form, setForm] = useState<FormState>(() => estateToForm(estate));
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!form.factoryId) { setRoutes([]); return; }
    void readRoutes(form.factoryId).then(setRoutes).catch(() => setRoutes([]));
  }, [form.factoryId]);

  const save = async () => {
    if (!form.name.trim() || form.acreage <= 0) { setError("Estate name and acreage are required."); return; }
    const coordinatesEntered = Boolean(form.latitude.trim() || form.longitude.trim());
    const coordinates = parseEstateCoordinate(form.latitude, form.longitude);
    if (coordinatesEntered && !coordinates) { setError("Enter both a valid latitude and longitude, use Current location, or select a point on the map."); return; }
    if (form.routeId && !routes.some((route) => route.id === form.routeId)) { setError("Select a route that belongs to the selected factory."); return; }
    setBusy(true); setError(null);
    try {
      await updateEstate(estate.id, {
        name: form.name,
        sizeCategory: sizeFromAcreage(form.acreage),
        acreage: form.acreage,
        bushCount: form.bushCount,
        cultivar: form.cultivar,
        region: form.region,
        soilType: form.soilType,
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
        address: form.address,
        contactPhone: form.contactPhone,
        photoUrls: form.photoUrls.split(/\r?\n|,/).map((url) => url.trim()).filter(Boolean),
        factoryId: form.factoryId,
        routeId: form.routeId,
        notes: form.notes,
        editCount: estate.editCount + 1,
      }, actorId);
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Estate could not be updated.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3" onClick={onClose}>
    <div className="w-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
      <Card className="max-h-[94vh] overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-bold text-slate-900">Edit estate · {estate.name}</h2><p className="text-xs text-slate-500">Update the estate details or GPS point. The existing owner and estate blocks are preserved.</p></div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600"><b>Owner:</b> {estate.owner?.supplierNo ? `#${estate.owner.supplierNo} · ` : ""}{estate.owner?.name ?? "Company estate"} · <b>Blocks:</b> {estate.blocks.length}</div>
        {error && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        <EstateFormFields form={form} setForm={setForm} factories={factories} routes={routes} />
        <div className="mt-5 flex flex-wrap justify-end gap-2"><button onClick={onClose} disabled={busy} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600">Cancel</button><button onClick={() => void save()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save changes</button></div>
      </Card>
    </div>
  </div>;
}

function InlineSupplier({ value, setValue, factories, routes, busy, onCreate }: { value: { name: string; supplierNo: string; phone: string; email: string; password: string; factoryId: string; routeIds: string[] }; setValue: (v: typeof value) => void; factories: FactoryOption[]; routes: RouteOption[]; busy: boolean; onCreate: () => void; }) {
  return <div className="mt-3 grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Name *"><input className={inputCls} value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} /></Field><Field label="Supplier No *"><input className={inputCls} value={value.supplierNo} onChange={(e) => setValue({ ...value, supplierNo: e.target.value })} /></Field><Field label="Phone"><input className={inputCls} value={value.phone} onChange={(e) => setValue({ ...value, phone: e.target.value })} /></Field><Field label="Email *"><input className={inputCls} value={value.email} onChange={(e) => setValue({ ...value, email: e.target.value })} /></Field><Field label="Temporary password *"><input className={inputCls} value={value.password} onChange={(e) => setValue({ ...value, password: e.target.value })} /></Field><Field label="Factory *"><select className={inputCls} value={value.factoryId} onChange={(e) => setValue({ ...value, factoryId: e.target.value, routeIds: [] })}><option value="">— select —</option>{factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field><div className="sm:col-span-2"><Field label="Authorized routes *"><RouteMultiSelect routes={routes} selected={value.routeIds} onChange={(routeIds) => setValue({ ...value, routeIds })} disabled={!value.factoryId || busy} /></Field></div><div className="flex items-end"><button onClick={onCreate} disabled={busy} className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Create supplier</button></div></div>;
}

function BlockRow({ block, onChange, onDelete }: { block: FormBlock; onChange: (b: FormBlock) => void; onDelete: () => void }) { return <div className="mt-2 grid gap-2 rounded-lg border bg-white p-2 sm:grid-cols-6"><input className={inputCls} value={block.name} onChange={(e) => onChange({ ...block, name: e.target.value })} placeholder="Name" /><input type="number" className={inputCls} value={block.areaHa || ""} onChange={(e) => onChange({ ...block, areaHa: Number(e.target.value) })} placeholder="Area ha" /><input type="number" className={inputCls} value={block.bushCount || ""} onChange={(e) => onChange({ ...block, bushCount: Number(e.target.value) })} placeholder="Bushes" /><input className={inputCls} value={block.cultivar} onChange={(e) => onChange({ ...block, cultivar: e.target.value })} placeholder="Cultivar" /><input className={inputCls} value={block.soilType} onChange={(e) => onChange({ ...block, soilType: e.target.value })} placeholder="Soil" /><button onClick={onDelete} className="text-rose-500"><Trash2 className="mx-auto h-4 w-4" /></button></div>; }
function DetailModal({ estate, audit, onClose }: { estate: Estate; audit: AuditLogEntry[]; onClose: () => void }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}><div className="w-full max-w-2xl" onClick={(event) => event.stopPropagation()}><Card className="max-h-[88vh] overflow-auto p-5"><div className="flex justify-between"><div><h2 className="text-lg font-bold">{estate.name}</h2><p className="text-xs text-slate-400">Owner: #{estate.owner?.supplierNo ?? "—"} · {estate.owner?.name ?? "Company"}</p></div><button onClick={onClose}><X className="h-5 w-5" /></button></div><div className="mt-4 grid grid-cols-4 gap-2"><Metric label="Status" value={estate.status} /><Metric label="Acreage" value={estate.acreage.toFixed(2)} /><Metric label="Bushes" value={estate.bushCount.toLocaleString()} /><Metric label="Blocks" value={String(estate.blocks.length)} /></div><h3 className="mt-5 text-sm font-bold">Estate blocks</h3>{estate.blocks.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2">{estate.blocks.map((block) => <div key={block.id} className="rounded-lg border border-slate-200 p-3 text-xs"><b>{block.name}</b><p className="text-slate-400">{block.areaHa} ha · {block.bushCount.toLocaleString()} bushes · {block.status}</p></div>)}</div> : <p className="mt-2 text-xs text-slate-400">No blocks recorded.</p>}<h3 className="mt-5 flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4" />Audit history</h3>{audit.length ? audit.map((entry) => <div key={entry.id} className="mt-2 rounded-lg bg-slate-50 p-3 text-xs"><b>{entry.action.toUpperCase()} · {entry.adminId}</b><p className="text-slate-400">{new Date(entry.createdAt).toLocaleString("en-LK")} · {JSON.stringify(entry.details)}</p></div>) : <p className="mt-2 text-xs text-slate-400">No audit entries yet.</p>}</Card></div></div>; }
function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-bold ${active ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}>{children}</button>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div><label className={labelCls}>{label}</label>{children}</div>; }
function Loading() { return <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>; }
function Empty({ text }: { text: string }) { return <div className="py-16 text-center text-sm text-slate-400">{text}</div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] uppercase text-slate-400">{label}</p><p className="font-bold">{value}</p></div>; }
