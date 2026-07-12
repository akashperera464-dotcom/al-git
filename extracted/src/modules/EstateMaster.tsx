import { useMemo, useState } from "react";
import { Network, MapPin, ChevronDown, Layers, Mountain, Sprout, Plus, Building2, Check, Save, Loader2, MapPinned } from "lucide-react";
import { PageHeader, StatCard, Panel, Badge, Meter, IconChip, DataTable, Segmented } from "@/components/ui";
import { Donut, Legend } from "@/components/charts";
import { useApp } from "@/context/AppContext";
import { isEstateAdmin } from "@/lib/identity";
import { fmtNum, type Field, type Estate } from "@/lib/data";
import { EstateMap } from "@/components/EstateMap";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

const STATUS_TONE: Record<Field["status"], "emerald" | "amber" | "sky" | "teal"> = {
  plucking: "emerald",
  pruned: "amber",
  young: "sky",
  nursery: "teal",
};
const CULTIVARS = ["TRI 2025 (VP)", "TRI 2023 (VP)", "TRI 4072", "Seedling", "Nursery"];
const STATUSES: Field["status"][] = ["plucking", "pruned", "young", "nursery"];

type CreateType = "estate" | "division" | "field";

function FieldTable({ fields }: { fields: Field[] }) {
  return (
    <DataTable<Field>
      rows={fields}
      columns={[
        { key: "code", header: "Block", render: (f) => <span className="font-semibold text-slate-800">{f.code}</span> },
        { key: "name", header: "Field" },
        { key: "cultivar", header: "Cultivar", render: (f) => <span className="text-slate-500">{f.cultivar}</span> },
        { key: "plantingYear", header: "Planted", align: "center" },
        { key: "areaHa", header: "Area (ha)", align: "right", render: (f) => fmtNum(f.areaHa) },
        { key: "status", header: "Status", align: "center", render: (f) => <Badge tone={STATUS_TONE[f.status]} dot>{f.status}</Badge> },
      ]}
    />
  );
}

/* ----------------------------- Creation form (Step 1) ----------------------------- */
function CreationPanel() {
  const { estates, addEstate, addDivision, addField } = useApp();
  const [type, setType] = useState<CreateType>("estate");
  const [saved, setSaved] = useState<string | null>(null);

  // estate fields
  const [eName, setEName] = useState("");
  const [eRegion, setERegion] = useState("");
  const [eArea, setEArea] = useState(0);
  const [eElev, setEElev] = useState(0);
  const [eMap, setEMap] = useState("");
  const [ePlanted, setEPlanted] = useState("");
  const [eLat, setELat] = useState("");
  const [eLon, setELon] = useState("");
  // division fields
  const [dEstate, setDEstate] = useState("");
  const [dName, setDName] = useState("");
  const [dManager, setDManager] = useState("");
  const [dArea, setDArea] = useState(0);
  // field fields
  const [fEstate, setFEstate] = useState("");
  const [fDiv, setFDiv] = useState("");
  const [fCode, setFCode] = useState("");
  const [fName, setFName] = useState("");
  const [fCultivar, setFCultivar] = useState(CULTIVARS[0]);
  const [fYear, setFYear] = useState(new Date().getFullYear());
  const [fArea, setFArea] = useState(0);
  const [fElev, setFElev] = useState(0);
  const [fStatus, setFStatus] = useState<Field["status"]>("plucking");

  const divisionsForEstate = (estateId: string) => estates.find((e) => e.id === estateId)?.divisions ?? [];

  const submit = async () => {
    if (type === "estate") {
      if (!eName.trim()) return;
      const latNum = eLat.trim() ? parseFloat(eLat.trim()) : undefined;
      const lonNum = eLon.trim() ? parseFloat(eLon.trim()) : undefined;
      const e = await addEstate({ name: eName.trim(), region: eRegion.trim() || "—", totalAreaHa: eArea || 0, elevationM: eElev || 0, googleMapsEmbedUrl: eMap.trim(), plantedDate: ePlanted || undefined, latitude: latNum, longitude: lonNum });
      setSaved(`Estate “${e.name}” created (${e.id})`);
      setEName(""); setERegion(""); setEArea(0); setEElev(0); setEMap(""); setEPlanted(""); setELat(""); setELon("");
    } else if (type === "division") {
      if (!dEstate || !dName.trim()) return;
      const d = await addDivision(dEstate, { name: dName.trim(), manager: dManager.trim() || "—", areaHa: dArea || 0 });
      setSaved(`Division “${d.name}” added`);
      setDName(""); setDManager(""); setDArea(0);
    } else {
      if (!fEstate || !fDiv || !fName.trim()) return;
      const f = await addField(fEstate, fDiv, {
        code: fCode.trim() || "—", name: fName.trim(), cultivar: fCultivar, plantingYear: fYear || new Date().getFullYear(),
        areaHa: fArea || 0, elevationM: fElev || 0, status: fStatus, lastYieldKg: 0,
      });
      setSaved(`Field “${f.name}” added (${f.code})`);
      setFCode(""); setFName(""); setFArea(0); setFElev(0);
    }
    window.setTimeout(() => setSaved(null), 2500);
  };

  const inputCls = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm";
  const labelCls = "text-[11px] font-medium text-slate-400";

  return (
    <Panel
      title="Create Hierarchy Node"
      subtitle="Admin-only · calls createEstate / createDivision / createField"
      icon={<IconChip icon={Plus} tone="emerald" className="h-9 w-9" />}
      action={<Badge tone="emerald" dot>ADMIN</Badge>}
    >
      <Segmented
        value={type}
        onChange={(v) => { setType(v); setSaved(null); }}
        className="mb-4"
        options={[
          { value: "estate", label: "Estate", icon: <Building2 className="h-3.5 w-3.5" /> },
          { value: "division", label: "Division", icon: <Layers className="h-3.5 w-3.5" /> },
          { value: "field", label: "Field", icon: <Sprout className="h-3.5 w-3.5" /> },
        ]}
      />

      {type === "estate" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className={labelCls}>Estate name</label><input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="e.g. Highland Estate" className={inputCls} /></div>
          <div><label className={labelCls}>Region</label><input value={eRegion} onChange={(e) => setERegion(e.target.value)} placeholder="e.g. Hatton" className={inputCls} /></div>
          <div><label className={labelCls}>Total area (ha)</label><input type="number" value={eArea || ""} onChange={(e) => setEArea(+e.target.value)} className={`${inputCls} tnum`} /></div>
          <div className="col-span-2"><label className={labelCls}>Avg elevation (m)</label><input type="number" value={eElev || ""} onChange={(e) => setEElev(+e.target.value)} className={`${inputCls} tnum`} /></div>
          <div className="col-span-2"><label className={labelCls}>Google Maps Embed URL (optional)</label><input value={eMap} onChange={(e) => setEMap(e.target.value)} placeholder="https://www.google.com/maps/embed?pb=…" className={inputCls} /><p className="mt-1 text-[10px] text-slate-400">Maps → Share → "Embed a map" → copy the src URL.</p></div>
          <div className="col-span-2"><label className={labelCls}>Planted Date (optional)</label><input type="date" value={ePlanted} onChange={(e) => setEPlanted(e.target.value)} className={inputCls} /><p className="mt-1 text-[10px] text-slate-400">When the tea plants were planted → drives the pruning schedule.</p></div>
          <div><label className={labelCls}>Latitude</label><input type="number" step="any" value={eLat} onChange={(e) => setELat(e.target.value)} placeholder="6.9679" className={`${inputCls} tnum`} /></div>
          <div><label className={labelCls}>Longitude</label><input type="number" step="any" value={eLon} onChange={(e) => setELon(e.target.value)} placeholder="80.7618" className={`${inputCls} tnum`} /></div>
          <div className="col-span-2"><p className="text-[10px] text-slate-400">📍 Tip: open Google Maps, right-click the estate location, copy the lat,lon (first number = latitude, second = longitude). These drive per-estate weather forecasts.</p></div>
        </div>
      )}

      {type === "division" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Parent estate</label>
            <select value={dEstate} onChange={(e) => setDEstate(e.target.value)} className={inputCls}>
              <option value="">— select estate —</option>
              {estates.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
            </select>
          </div>
          <div className="col-span-2"><label className={labelCls}>Division name</label><input value={dName} onChange={(e) => setDName(e.target.value)} placeholder="e.g. Highland North" className={inputCls} /></div>
          <div><label className={labelCls}>Manager</label><input value={dManager} onChange={(e) => setDManager(e.target.value)} placeholder="e.g. N. Silva" className={inputCls} /></div>
          <div><label className={labelCls}>Area (ha)</label><input type="number" value={dArea || ""} onChange={(e) => setDArea(+e.target.value)} className={`${inputCls} tnum`} /></div>
        </div>
      )}

      {type === "field" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Parent estate</label>
            <select value={fEstate} onChange={(e) => { setFEstate(e.target.value); setFDiv(""); }} className={inputCls}>
              <option value="">— select estate —</option>
              {estates.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Parent division</label>
            <select value={fDiv} onChange={(e) => setFDiv(e.target.value)} disabled={!fEstate} className={inputCls}>
              <option value="">{fEstate ? "— select division —" : "select estate first"}</option>
              {divisionsForEstate(fEstate).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Field code</label><input value={fCode} onChange={(e) => setFCode(e.target.value)} placeholder="e.g. A1" className={inputCls} /></div>
          <div><label className={labelCls}>Field name</label><input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="e.g. Highland Block A1" className={inputCls} /></div>
          <div><label className={labelCls}>Cultivar</label><select value={fCultivar} onChange={(e) => setFCultivar(e.target.value)} className={inputCls}>{CULTIVARS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className={labelCls}>Status</label><select value={fStatus} onChange={(e) => setFStatus(e.target.value as Field["status"])} className={inputCls}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className={labelCls}>Planting year</label><input type="number" value={fYear} onChange={(e) => setFYear(+e.target.value)} className={`${inputCls} tnum`} /></div>
          <div><label className={labelCls}>Area (ha)</label><input type="number" value={fArea || ""} onChange={(e) => setFArea(+e.target.value)} className={`${inputCls} tnum`} /></div>
          <div className="col-span-2"><label className={labelCls}>Elevation (m)</label><input type="number" value={fElev || ""} onChange={(e) => setFElev(+e.target.value)} className={`${inputCls} tnum`} /></div>
        </div>
      )}

      <button onClick={submit} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-110">
        {saved ? <><Check className="h-4 w-4" /> Saved</> : <><Plus className="h-4 w-4" /> Create {type}</>}
      </button>
      {saved && <p className="mt-2 text-center text-xs font-semibold text-emerald-600">{saved}</p>}
    </Panel>
  );
}

export default function EstateMaster() {
  const { estates, role } = useApp();
  const [selectedId, setSelectedId] = useState<string>(estates[0]?.id ?? "");
  const [open, setOpen] = useState<Record<string, boolean>>({ "div-sutton": true });
  // Local override so a freshly-saved map URL reflects instantly without
  // needing to refetch the whole hierarchy from Supabase.
  const [mapOverride, setMapOverride] = useState<Record<string, string>>({});

  // keep selection valid as estates are created/removed
  const selected: Estate | undefined = estates.find((e) => e.id === selectedId) ?? estates[0];
  const selectedMapUrl = selected ? mapOverride[selected.id] ?? selected.googleMapsEmbedUrl : undefined;
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const allFields = useMemo(() => estates.flatMap((e) => e.divisions.flatMap((d) => d.fields)), [estates]);

  const cultivarCount: Record<string, number> = {};
  allFields.forEach((f) => {
    const key = /VP/.test(f.cultivar) ? "VP Clones" : /Seedling/.test(f.cultivar) ? "Seedling" : /Nursery/.test(f.cultivar) ? "Nursery" : "Other Clones";
    cultivarCount[key] = (cultivarCount[key] ?? 0) + 1;
  });
  const colors = ["#059669", "#10b981", "#f59e0b", "#94a3b8"];
  const donut = Object.entries(cultivarCount).map(([name, value], i) => ({ name, value, color: colors[i] ?? "#cbd5e1" }));

  const totalArea = estates.reduce((s, e) => s + e.totalAreaHa, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Estate Master Management"
        title="Hierarchy & Land Registry"
        desc="Estates → Divisions → Fields. Admins can create new nodes; suppliers/supervisors see this read-only."
        icon={<IconChip icon={Network} tone="emerald" className="h-12 w-12" />}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={Building2} label="Estates" value={String(estates.length)} sub="Registered" tone="emerald" />
        <StatCard icon={Layers} label="Divisions" value={String(estates.reduce((s, e) => s + e.divisions.length, 0))} sub="Managed units" tone="sky" />
        <StatCard icon={Sprout} label="Fields" value={String(allFields.length)} sub="Across all estates" tone="amber" />
        <StatCard icon={Mountain} label="Total Area" value={`${fmtNum(totalArea)} ha`} sub="Aggregate" tone="violet" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {/* Estate selector */}
          <div className="flex flex-wrap items-center gap-2">
            {estates.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${selected?.id === e.id ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:border-emerald-200"}`}
              >
                <Building2 className="h-4 w-4" /> {e.name}
              </button>
            ))}
          </div>

          {selected ? (
            <>
              <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-700 to-teal-800 p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200">Estate · {selected.id}</p>
                    <h3 className="font-display text-2xl font-bold">{selected.name}</h3>
                    <p className="text-sm text-emerald-100">{selected.region} · {fmtNum(selected.totalAreaHa)} ha · {fmtNum(selected.elevationM)} m</p>
                    <p className="mt-1 text-xs text-emerald-200/70">
                      📍 {selected.latitude ?? "—"}, {selected.longitude ?? "—"}
                      {!selected.latitude && " (no coordinates set — weather uses default)"}
                    </p>
                  </div>
                  <MapPin className="h-9 w-9 text-emerald-200" />
                </div>
              </div>

              {/* Coordinates editor */}
              <CoordEditor estate={selected} onSaved={() => window.location.reload()} />

              {/* Interactive Google Maps embed (admin can paste/edit the link) */}
              <EstateMap
                estateId={selected.id}
                estateName={selected.name}
                embedUrl={selectedMapUrl}
                onSaved={(newUrl) => setMapOverride((m) => ({ ...m, [selected.id]: newUrl }))}
              />

              {selected.divisions.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                  No divisions yet. {isEstateAdmin(role) && "Add a division using the creation panel →"}
                </div>
              )}

              {selected.divisions.map((d) => {
                const isOpen = !!open[d.id];
                const fieldsArea = d.fields.reduce((s, f) => s + f.areaHa, 0);
                return (
                  <div key={d.id} className="card overflow-hidden">
                    <button onClick={() => toggle(d.id)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><Layers className="h-4 w-4" /></span>
                        <div>
                          <p className="font-display text-sm font-bold text-slate-800">{d.name}</p>
                          <p className="text-xs text-slate-400">Manager {d.manager} · {fmtNum(fieldsArea)} ha · {d.fields.length} fields</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge tone="emerald">{d.fields.length} fields</Badge>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-100 px-5 py-4 animate-fade-in">
                        {d.fields.length ? <FieldTable fields={d.fields} /> : <p className="py-3 text-center text-xs text-slate-400">No fields — add one from the creation panel.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">No estates yet.</div>
          )}
        </div>

        <div className="space-y-4">
          {/* Admin-only creation form (Step 1) — super_admin OR admin */}
          {isEstateAdmin(role) && <CreationPanel />}

          <Panel title="Cultivar Mix" subtitle="Clone & seedling distribution" icon={<IconChip icon={Sprout} tone="emerald" className="h-9 w-9" />}>
            <Donut data={donut} centerValue={String(allFields.length)} centerLabel="Fields" height={190} />
            <div className="mt-3">
              <Legend items={donut.map((d) => ({ label: d.name, color: d.color, value: `${d.value}` }))} />
            </div>
          </Panel>
          <Panel title="Field Utilisation" subtitle="By status" icon={<IconChip icon={Layers} tone="sky" className="h-9 w-9" />}>
            <div className="space-y-3">
              {STATUSES.map((st) => {
                const count = allFields.filter((f) => f.status === st).length;
                return (
                  <div key={st}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="capitalize font-semibold text-slate-700">{st}</span>
                      <span className="text-slate-400">{count} fields</span>
                    </div>
                    <Meter value={allFields.length ? (count / allFields.length) * 100 : 0} tone={STATUS_TONE[st]} />
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** Inline editor for estate GPS coordinates (updates Supabase directly). */
function CoordEditor({ estate, onSaved }: { estate: Estate; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [lat, setLat] = useState(String(estate.latitude ?? ""));
  const [lon, setLon] = useState(String(estate.longitude ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!supabaseConfigured) { setEditing(false); return; }
      const sb = getSupabase()!;
      const latNum = lat.trim() ? parseFloat(lat.trim()) : null;
      const lonNum = lon.trim() ? parseFloat(lon.trim()) : null;
      const { error: err } = await sb.from("estates").update({ latitude: latNum, longitude: lonNum }).eq("id", estate.id);
      if (err) throw new Error(err.message);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save coordinates.");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-slate-700">GPS Coordinates for Weather</span>
        </div>
        <button onClick={() => { setLat(String(estate.latitude ?? "")); setLon(String(estate.longitude ?? "")); setEditing(true); }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
          {estate.latitude ? "Edit" : "Set Coordinates"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <MapPinned className="h-4 w-4 text-emerald-600" />
        <h4 className="text-sm font-bold text-slate-800">GPS Coordinates for {estate.name}</h4>
      </div>
      <p className="mb-3 text-[11px] text-slate-400">📍 Google Maps → right-click the estate → copy the numbers (first = lat, second = lon). These drive per-estate weather.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-medium text-slate-400">Latitude</label>
          <input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="6.9679" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
        </div>
        <div>
          <label className="text-[11px] font-medium text-slate-400">Longitude</label>
          <input type="number" step="any" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="80.7618" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white enabled:hover:brightness-110 disabled:opacity-60">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save coordinates
        </button>
        <button onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500">Cancel</button>
      </div>
    </div>
  );
}
