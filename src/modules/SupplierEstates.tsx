import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Clock3, Edit3, Loader2, MapPin, Plus, RefreshCw, Sprout, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, Card, IconChip, PageHeader } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { createEstate, deleteEstate, readMyEstates, replaceEstateBlocks, sizeFromAcreage, updateEstate, type CreateEstateInput, type Estate, type EstateBlock } from "@/lib/estateRepo";
import { readFactories, readRoutes, readUserOperationalProfile, type FactoryOption, type RouteOption } from "@/lib/supplierOperations";

type FormBlock = Omit<EstateBlock, "id" | "estateId">;
interface EstateForm {
  name: string; acreage: number; bushCount: number; cultivar: string; region: string; soilType: string;
  latitude: string; longitude: string; address: string; contactPhone: string; photoUrls: string;
  factoryId: string; routeId: string; notes: string; blocks: FormBlock[];
}

const EMPTY_FORM: EstateForm = { name: "", acreage: 0, bushCount: 0, cultivar: "TRI 2025 (VP)", region: "low-country", soilType: "", latitude: "", longitude: "", address: "", contactPhone: "", photoUrls: "", factoryId: "", routeId: "", notes: "", blocks: [] };
const inputCls = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";
const labelCls = "text-[11px] font-bold uppercase tracking-wide text-slate-400";
const tone = (status: Estate["status"]): "emerald" | "amber" | "rose" => status === "approved" ? "emerald" : status === "pending" ? "amber" : "rose";

function toForm(estate: Estate): EstateForm {
  return {
    name: estate.name, acreage: estate.acreage, bushCount: estate.bushCount, cultivar: estate.cultivar ?? "TRI 2025 (VP)",
    region: estate.region ?? "low-country", soilType: estate.soilType ?? "", latitude: estate.latitude?.toString() ?? "",
    longitude: estate.longitude?.toString() ?? "", address: estate.address ?? "", contactPhone: estate.contactPhone ?? "",
    photoUrls: estate.photoUrls?.join("\n") ?? "", factoryId: estate.factoryId ?? "", routeId: estate.routeId ?? "", notes: estate.notes ?? "",
    blocks: estate.blocks.map(({ id: _id, estateId: _estateId, ...block }) => block),
  };
}

export default function SupplierEstates() {
  const { t } = useTranslation();
  const { userUid, notify } = useApp();
  const [estates, setEstates] = useState<Estate[]>([]);
  const [selectedEstateId, setSelectedEstateId] = useState<string | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [editingEstateId, setEditingEstateId] = useState<string | null>(null);
  const [form, setForm] = useState<EstateForm>(EMPTY_FORM);
  const [factories, setFactories] = useState<FactoryOption[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const rows = await readMyEstates(userUid);
      setEstates(rows);
      setSelectedEstateId((id) => id && rows.some((e) => e.id === id) ? id : rows[0]?.id ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load your estates."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [userUid]);
  useEffect(() => {
    void Promise.all([readFactories(), readUserOperationalProfile(userUid)]).then(([factoryRows, profile]) => {
      setFactories(factoryRows);
      if (profile) setForm((value) => ({ ...value, factoryId: value.factoryId || profile.factoryId || "", routeId: value.routeId || profile.routeId || "" }));
    }).catch(() => {});
  }, [userUid]);
  useEffect(() => { if (!form.factoryId) { setRoutes([]); return; } void readRoutes(form.factoryId).then(setRoutes).catch(() => setRoutes([])); }, [form.factoryId]);

  const selected = estates.find((estate) => estate.id === selectedEstateId) ?? null;
  const approvedCount = estates.filter((estate) => estate.status === "approved").length;

  const startNew = () => {
    setEditingEstateId(null);
    setForm({ ...EMPTY_FORM, factoryId: form.factoryId, routeId: form.routeId });
    setShowRegisterForm(true); setError(null);
  };
  const startEdit = (estate: Estate) => { setEditingEstateId(estate.id); setForm(toForm(estate)); setShowRegisterForm(true); setError(null); };
  const addBlock = () => setForm((value) => ({ ...value, blocks: [...value.blocks, { name: `Block ${value.blocks.length + 1}`, areaHa: 0, bushCount: 0, cultivar: value.cultivar, soilType: value.soilType, status: "plucking", plantingYear: new Date().getFullYear() }] }));
  const updateBlock = (index: number, patch: Partial<FormBlock>) => setForm((value) => ({ ...value, blocks: value.blocks.map((block, i) => i === index ? { ...block, ...patch } : block) }));
  const useCurrentLocation = () => navigator.geolocation?.getCurrentPosition(
    (p) => setForm((value) => ({ ...value, latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6) })),
    () => setError("Location permission was denied. Enter GPS coordinates manually."), { enableHighAccuracy: true, timeout: 10000 },
  );

  const submit = async () => {
    if (!form.name.trim() || form.acreage <= 0) { setError("Estate name and acreage are required."); return; }
    if (form.blocks.some((block) => !block.name.trim() || block.areaHa < 0 || block.bushCount < 0)) { setError("Complete every block using valid positive values."); return; }
    setSaving(true); setError(null);
    try {
      const latitude = form.latitude.trim() ? Number(form.latitude) : undefined;
      const longitude = form.longitude.trim() ? Number(form.longitude) : undefined;
      if ((latitude !== undefined && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) || (longitude !== undefined && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) throw new Error("GPS coordinates are invalid.");
      const photoUrls = form.photoUrls.split(/\r?\n|,/).map((url) => url.trim()).filter(Boolean);
      const blocks: CreateEstateInput["blocks"] = form.blocks.map((block) => ({ ...block }));
      if (editingEstateId) {
        const previous = estates.find((estate) => estate.id === editingEstateId);
        await updateEstate(editingEstateId, { name: form.name, acreage: form.acreage, bushCount: form.bushCount, sizeCategory: sizeFromAcreage(form.acreage), cultivar: form.cultivar, region: form.region, soilType: form.soilType, latitude, longitude, address: form.address, contactPhone: form.contactPhone, photoUrls, factoryId: form.factoryId, routeId: form.routeId, notes: form.notes, status: "pending", rejectionReason: "", editCount: (previous?.editCount ?? 0) + 1 });
        await replaceEstateBlocks(editingEstateId, blocks);
        notify({ title: "Estate update submitted", body: `“${form.name}” is pending administrator review.`, tone: "amber", channel: "system" });
      } else {
        const result = await createEstate({ ownerSupplierId: userUid, name: form.name, sizeCategory: sizeFromAcreage(form.acreage), acreage: form.acreage, bushCount: form.bushCount, cultivar: form.cultivar, region: form.region, soilType: form.soilType, latitude, longitude, address: form.address, contactPhone: form.contactPhone, photoUrls, factoryId: form.factoryId, routeId: form.routeId, blocks, notes: form.notes, createdByAdmin: false, actorId: userUid });
        if (!result.success) throw new Error(result.error ?? "Estate registration failed.");
        notify({ title: "Registration submitted!", body: approvedCount ? `Your existing ${approvedCount} estate(s) are still active.` : "Your estate is awaiting administrator approval.", tone: "emerald", channel: "system" });
      }
      setShowRegisterForm(false); setEditingEstateId(null); setForm(EMPTY_FORM); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Estate could not be saved."); }
    finally { setSaving(false); }
  };

  const remove = async (estate: Estate) => {
    if (!window.confirm(`Delete “${estate.name}”? This also removes its blocks.`)) return;
    try { await deleteEstate(estate.id); notify({ title: "Estate removed", body: estate.name, tone: "rose", channel: "system" }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Estate could not be removed."); }
  };

  return <div>
    <PageHeader eyebrow="Supplier Portal" title={t("supplier.myEstates")} desc="All your tea estates, approval status, blocks and production details in one place." icon={<IconChip icon={Building2} tone="emerald" className="h-12 w-12" />} actions={<button onClick={startNew} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20"><Plus className="h-4 w-4" />{t("supplier.registerNewEstate")}</button>} />
    {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    {loading ? <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin" />Loading estates…</div> : estates.length === 0 && !showRegisterForm ? <Card className="p-10 text-center"><span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Sprout className="h-10 w-10" /></span><h2 className="mt-5 text-xl font-bold text-slate-800">{t("supplier.registerFirstEstate")}</h2><p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">{t("supplier.noEstatesYet")} Register your first tea estate to start tracking deliveries, blocks and yield.</p><button onClick={startNew} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white"><Plus className="h-4 w-4" />{t("supplier.registerNewEstate")}</button></Card> : <Card className="p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-slate-800">{t("supplier.myEstates")}</h2><button onClick={() => void load()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><RefreshCw className="h-4 w-4" /></button></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{estates.map((estate) => <button key={estate.id} onClick={() => { setSelectedEstateId(estate.id); setShowRegisterForm(false); }} className={`rounded-xl border p-4 text-left transition ${selectedEstateId === estate.id ? "border-emerald-400 bg-emerald-50/60 ring-2 ring-emerald-100" : "border-slate-200 hover:border-emerald-200"}`}><div className="flex items-start justify-between gap-2"><p className="font-bold text-slate-800">{estate.name}</p><Badge tone={tone(estate.status)} dot>{estate.status}</Badge></div><p className="mt-2 text-xs text-slate-500">{estate.acreage.toFixed(2)} acres · {estate.bushCount.toLocaleString()} bushes</p><p className="mt-1 text-[11px] text-slate-400">{estate.blocks.length} block(s) · {estate.createdByAdmin ? t("estateMaster.createdByAdmin") : t("estateMaster.createdBySupplier")}</p></button>)}</div></Card>}

    {showRegisterForm && <Card className="mt-4 p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold text-slate-800">{editingEstateId ? "Update & resubmit estate" : t("supplier.registerNewEstate")}</h2><p className="text-xs text-slate-400">Supplier submissions remain pending until an administrator reviews them.</p></div><button onClick={() => setShowRegisterForm(false)} className="rounded-lg p-2 text-slate-400"><X className="h-5 w-5" /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Estate name *"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Acreage *"><input type="number" min="0" step="0.01" className={inputCls} value={form.acreage || ""} onChange={(e) => setForm({ ...form, acreage: Number(e.target.value) })} /><p className="mt-1 text-[10px] text-slate-400">{sizeFromAcreage(form.acreage)} estate</p></Field>
      <Field label="Bush count"><input type="number" min="0" className={inputCls} value={form.bushCount || ""} onChange={(e) => setForm({ ...form, bushCount: Number(e.target.value) })} /></Field>
      <Field label="Cultivar"><select className={inputCls} value={form.cultivar} onChange={(e) => setForm({ ...form, cultivar: e.target.value })}><option>TRI 2025 (VP)</option><option>TRI 4042</option><option>TRI 4053</option><option>Seedling tea</option></select></Field>
      <Field label="Region"><select className={inputCls} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}><option value="low-country">Low country</option><option value="mid-country">Mid country</option><option value="up-country">Up country</option></select></Field>
      <Field label="Soil type"><input className={inputCls} value={form.soilType} onChange={(e) => setForm({ ...form, soilType: e.target.value })} /></Field>
      <Field label="Contact phone"><input className={inputCls} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></Field>
      <Field label="Factory"><select className={inputCls} value={form.factoryId} onChange={(e) => setForm({ ...form, factoryId: e.target.value, routeId: "" })}><option value="">— select —</option>{factories.map((factory) => <option key={factory.id} value={factory.id}>{factory.name}</option>)}</select></Field>
      <Field label="Route"><select className={inputCls} disabled={!form.factoryId} value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })}><option value="">— select —</option>{routes.map((route) => <option key={route.id} value={route.id}>{route.label}</option>)}</select></Field>
      <Field label="Latitude"><input className={inputCls} value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} /></Field><Field label="Longitude"><input className={inputCls} value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} /></Field>
      <div className="flex items-end"><button onClick={useCurrentLocation} type="button" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm font-bold text-sky-700"><MapPin className="h-4 w-4" />Use current GPS</button></div>
      <div className="sm:col-span-2"><Field label="Address"><input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field></div><div className="sm:col-span-2"><Field label="Photo URLs (one per line)"><textarea className={inputCls} rows={2} value={form.photoUrls} onChange={(e) => setForm({ ...form, photoUrls: e.target.value })} /></Field></div><div className="sm:col-span-2 lg:col-span-4"><Field label="Notes"><textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
    </div><div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-700">Estate blocks</h3><button onClick={addBlock} type="button" className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-700 shadow-sm"><Plus className="h-3.5 w-3.5" />Add block</button></div><div className="mt-3 space-y-3">{form.blocks.map((block, index) => <div key={index} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-6"><input aria-label="Block name" className={inputCls} value={block.name} onChange={(e) => updateBlock(index, { name: e.target.value })} placeholder="Block name" /><input aria-label="Area ha" type="number" className={inputCls} value={block.areaHa || ""} onChange={(e) => updateBlock(index, { areaHa: Number(e.target.value) })} placeholder="Area ha" /><input aria-label="Bush count" type="number" className={inputCls} value={block.bushCount || ""} onChange={(e) => updateBlock(index, { bushCount: Number(e.target.value) })} placeholder="Bushes" /><input aria-label="Cultivar" className={inputCls} value={block.cultivar ?? ""} onChange={(e) => updateBlock(index, { cultivar: e.target.value })} placeholder="Cultivar" /><select aria-label="Status" className={inputCls} value={block.status} onChange={(e) => updateBlock(index, { status: e.target.value as FormBlock["status"] })}><option value="plucking">Plucking</option><option value="pruned">Pruned</option><option value="young">Young</option><option value="nursery">Nursery</option></select><button onClick={() => setForm((value) => ({ ...value, blocks: value.blocks.filter((_, i) => i !== index) }))} className="mt-1 inline-flex items-center justify-center rounded-lg text-rose-500"><Trash2 className="h-4 w-4" /></button></div>)}</div></div><div className="mt-4 flex justify-end gap-2"><button onClick={() => setShowRegisterForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500">Cancel</button><button onClick={() => void submit()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{editingEstateId ? "Submit for review" : "Submit registration"}</button></div></Card>}

    {selected && !showRegisterForm && <Card className="mt-4 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-lg font-bold text-slate-800">{selected.name}</h2><Badge tone={tone(selected.status)} dot>{selected.status}</Badge></div><p className="mt-1 text-xs text-slate-400">Submitted {new Date(selected.submittedAt).toLocaleDateString("en-LK")} · {selected.sizeCategory} estate</p></div><div className="flex gap-2"><button onClick={() => startEdit(selected)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><Edit3 className="h-3.5 w-3.5" />Edit & resubmit</button>{selected.status === "approved" && <button onClick={() => void remove(selected)} className="rounded-lg border border-rose-200 p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>}</div></div>
      {selected.status === "pending" && <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-amber-50 p-4 text-center text-xs"><div className="font-bold text-emerald-700"><CheckCircle2 className="mx-auto mb-1 h-5 w-5" />Submitted</div><div className="font-bold text-amber-700"><Clock3 className="mx-auto mb-1 h-5 w-5 animate-pulse" />Under Review</div><div className="text-slate-400"><CheckCircle2 className="mx-auto mb-1 h-5 w-5" />Approved</div><button onClick={startNew} className="col-span-3 mt-2 rounded-lg bg-white px-3 py-2 font-bold text-emerald-700">You can register another estate while waiting</button></div>}
      {selected.status === "rejected" && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><p className="font-bold">Registration needs changes</p><p className="mt-1">{selected.rejectionReason ?? "Contact the administrator for details."}</p></div>}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric label="Acreage" value={selected.acreage.toFixed(2)} /><Metric label="Bushes" value={selected.bushCount.toLocaleString()} /><Metric label="Cultivar" value={selected.cultivar ?? "—"} /><Metric label="Expected yield / year" value={`${Math.round(selected.acreage * (selected.region === "up-country" ? 1200 : selected.region === "mid-country" ? 1450 : 1650)).toLocaleString()} kg`} accent /></div>
      <div className="mt-4"><h3 className="text-sm font-bold text-slate-700">Blocks ({selected.blocks.length})</h3>{selected.blocks.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2">{selected.blocks.map((block) => <div key={block.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between"><p className="font-bold text-slate-700">{block.name}</p><span className="text-[10px] font-bold uppercase text-emerald-600">{block.status}</span></div><p className="mt-1 text-xs text-slate-400">{block.areaHa} ha · {block.bushCount.toLocaleString()} bushes · {block.cultivar ?? "—"}</p></div>)}</div> : <p className="mt-2 text-sm text-slate-400">No blocks registered.</p>}</div>
    </Card>}
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className={labelCls}>{label}</label>{children}</div>; }
function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] uppercase text-slate-400">{label}</p><p className={`font-bold ${accent ? "text-emerald-700" : "text-slate-800"}`}>{value}</p></div>; }
export { SupplierEstates };
