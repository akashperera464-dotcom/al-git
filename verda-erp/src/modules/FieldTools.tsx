import { useEffect, useState } from "react";
import { FlaskConical, Bug, MapPin, Plus, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { useApp } from "@/context/AppContext";
import { exportObjectsToCSV } from "@/lib/csvExport";
import { FileDown } from "lucide-react";

type Tab = "soil" | "disease" | "visits";

export default function FieldTools() {
  const { userUid } = useApp();
  const [tab, setTab] = useState<Tab>("soil");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Soil tests
  const [soilTests, setSoilTests] = useState<Record<string, unknown>[]>([]);
  const [soilForm, setSoilForm] = useState({ fieldId: "", testDate: new Date().toISOString().slice(0, 10), ph: 0, nitrogen: 0, phosphorus: 0, potassium: 0, organicMatter: 0, notes: "" });

  // Disease reports
  const [diseases, setDiseases] = useState<Record<string, unknown>[]>([]);
  const [diseaseForm, setDiseaseForm] = useState({ fieldId: "", diseaseType: "blister_blight", severity: "low", notes: "" });

  // Site visits
  const [visits, setVisits] = useState<Record<string, unknown>[]>([]);
  const [visitForm, setVisitForm] = useState({ supplierId: "", visitDate: new Date().toISOString().slice(0, 10), latitude: 0, longitude: 0, notes: "", followUpDate: "" });

  const reload = async () => {
    if (!supabaseConfigured) return;
    setBusy(true);
    try {
      const sb = getSupabase()!;
      const [st, dr, sv] = await Promise.all([
        sb.from("soil_tests").select("*").order("test_date", { ascending: false }).limit(50),
        sb.from("disease_reports").select("*").order("reported_at", { ascending: false }).limit(50),
        sb.from("site_visits").select("*").order("visit_date", { ascending: false }).limit(50),
      ]);
      setSoilTests(st.data ?? []);
      setDiseases(dr.data ?? []);
      setVisits(sv.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const addSoilTest = async () => {
    setError(null);
    if (soilForm.ph <= 0) { setError("pH required"); return; }
    setBusy(true);
    try {
      if (supabaseConfigured) {
        const sb = getSupabase()!;
        await sb.from("soil_tests").insert({
          field_id: soilForm.fieldId || null, test_date: soilForm.testDate,
          ph: soilForm.ph, nitrogen_ppm: soilForm.nitrogen, phosphorus_ppm: soilForm.phosphorus,
          potassium_ppm: soilForm.potassium, organic_matter_pct: soilForm.organicMatter,
          tested_by: userUid, notes: soilForm.notes,
        });
      }
      const isAcidic = soilForm.ph < 4.5;
      setSuccess(`Soil test logged. pH ${soilForm.ph}${isAcidic ? " ⚠ ACIDIC — apply dolomite!" : ""}`);
      setSoilForm({ fieldId: "", testDate: new Date().toISOString().slice(0, 10), ph: 0, nitrogen: 0, phosphorus: 0, potassium: 0, organicMatter: 0, notes: "" });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const addDisease = async () => {
    setError(null);
    setBusy(true);
    try {
      if (supabaseConfigured) {
        const sb = getSupabase()!;
        await sb.from("disease_reports").insert({
          field_id: diseaseForm.fieldId || null, disease_type: diseaseForm.diseaseType,
          severity: diseaseForm.severity, reported_by: userUid, treatment_notes: diseaseForm.notes,
        });
      }
      setSuccess(`Disease report filed: ${diseaseForm.diseaseType} (${diseaseForm.severity})`);
      setDiseaseForm({ fieldId: "", diseaseType: "blister_blight", severity: "low", notes: "" });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const addVisit = async () => {
    setError(null);
    if (!visitForm.notes.trim()) { setError("Notes required"); return; }
    setBusy(true);
    try {
      // Try to get GPS
      let lat = visitForm.latitude, lng = visitForm.longitude;
      if (!lat && "geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 }));
          lat = +pos.coords.latitude.toFixed(7);
          lng = +pos.coords.longitude.toFixed(7);
        } catch { /* user can enter manually */ }
      }
      if (supabaseConfigured) {
        const sb = getSupabase()!;
        await sb.from("site_visits").insert({
          officer_uid: userUid, supplier_id: visitForm.supplierId || null,
          visit_date: visitForm.visitDate, latitude: lat || null, longitude: lng || null,
          notes: visitForm.notes, follow_up_date: visitForm.followUpDate || null,
        });
      }
      setSuccess(`Site visit logged${lat ? ` at ${lat}, ${lng}` : ""}`);
      setVisitForm({ supplierId: "", visitDate: new Date().toISOString().slice(0, 10), latitude: 0, longitude: 0, notes: "", followUpDate: "" });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const openDiseases = diseases.filter((d) => d.status === "open").length;
  const acidicSoils = soilTests.filter((s) => Number(s.ph) < 4.5).length;
  const recentVisits = visits.length;

  return (
    <div>
      <PageHeader
        eyebrow="Field Operations"
        title="Field Tools — Soil, Disease & Site Visits"
        desc="Soil testing with pH alerts, leaf disease reporting with severity tracking, and GPS-tagged site visits."
        icon={<IconChip icon={FlaskConical} tone="emerald" className="h-12 w-12" />}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div>}

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={FlaskConical} label="Soil Tests" value={String(soilTests.length)} tone="emerald" />
        <StatCard icon={Bug} label="Open Diseases" value={String(openDiseases)} tone="rose" />
        <StatCard icon={MapPin} label="Site Visits" value={String(recentVisits)} tone="sky" />
      </div>

      <div className="mt-4 flex gap-2">
        {([
          { id: "soil", label: "Soil Tests", icon: FlaskConical },
          { id: "disease", label: "Disease Reports", icon: Bug },
          { id: "visits", label: "Site Visits", icon: MapPin },
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

      {/* Soil Tests */}
      {tab === "soil" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Log Soil Test</h3>
            <div className="space-y-2">
              <input value={soilForm.fieldId} onChange={e => setSoilForm({ ...soilForm, fieldId: e.target.value })} placeholder="Field ID (optional)" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <div className="grid grid-cols-5 gap-1.5">
                <div><label className="text-[10px] text-slate-400">pH *</label><input type="number" step="0.1" value={soilForm.ph || ""} onChange={e => setSoilForm({ ...soilForm, ph: +e.target.value })} className="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1.5 text-xs tnum" /></div>
                <div><label className="text-[10px] text-slate-400">N (ppm)</label><input type="number" value={soilForm.nitrogen || ""} onChange={e => setSoilForm({ ...soilForm, nitrogen: +e.target.value })} className="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1.5 text-xs tnum" /></div>
                <div><label className="text-[10px] text-slate-400">P (ppm)</label><input type="number" value={soilForm.phosphorus || ""} onChange={e => setSoilForm({ ...soilForm, phosphorus: +e.target.value })} className="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1.5 text-xs tnum" /></div>
                <div><label className="text-[10px] text-slate-400">K (ppm)</label><input type="number" value={soilForm.potassium || ""} onChange={e => setSoilForm({ ...soilForm, potassium: +e.target.value })} className="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1.5 text-xs tnum" /></div>
                <div><label className="text-[10px] text-slate-400">OM %</label><input type="number" step="0.1" value={soilForm.organicMatter || ""} onChange={e => setSoilForm({ ...soilForm, organicMatter: +e.target.value })} className="mt-0.5 w-full rounded border border-slate-200 px-1.5 py-1.5 text-xs tnum" /></div>
              </div>
              {soilForm.ph > 0 && soilForm.ph < 4.5 && <p className="text-[11px] font-semibold text-rose-600">⚠ pH {soilForm.ph} is acidic — apply dolomite!</p>}
              <textarea value={soilForm.notes} onChange={e => setSoilForm({ ...soilForm, notes: e.target.value })} rows={1} placeholder="Notes" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <button onClick={addSoilTest} disabled={busy} className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Log Test</button>
            </div>
          </Card>
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-800">Soil Test History ({soilTests.length})</h3>
              <button onClick={() => exportObjectsToCSV("soil_tests", soilTests)} className="text-xs text-emerald-600 hover:underline"><FileDown className="inline h-3 w-3" /> CSV</button>
            </div>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {soilTests.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No soil tests yet.</p> : soilTests.map((s) => (
                <div key={s.id as string} className="rounded-lg border border-slate-100 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">pH {String(s.ph)}</span>
                    {Number(s.ph) < 4.5 ? <Badge tone="rose" dot>Acidic</Badge> : <Badge tone="emerald">Normal</Badge>}
                  </div>
                  <p className="text-[11px] text-slate-400">{String(s.test_date)} · N:{String(s.nitrogen_ppm)} P:{String(s.phosphorus_ppm)} K:{String(s.potassium_ppm)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Disease Reports */}
      {tab === "disease" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Report Disease</h3>
            <div className="space-y-2">
              <input value={diseaseForm.fieldId} onChange={e => setDiseaseForm({ ...diseaseForm, fieldId: e.target.value })} placeholder="Field ID (optional)" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <select value={diseaseForm.diseaseType} onChange={e => setDiseaseForm({ ...diseaseForm, diseaseType: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option value="blister_blight">Blister Blight</option>
                <option value="red_rust">Red Rust</option>
                <option value="helopeltis">Helopeltis</option>
                <option value="shot_hole">Shot Hole</option>
                <option value="others">Others</option>
              </select>
              <select value={diseaseForm.severity} onChange={e => setDiseaseForm({ ...diseaseForm, severity: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <textarea value={diseaseForm.notes} onChange={e => setDiseaseForm({ ...diseaseForm, notes: e.target.value })} rows={2} placeholder="Treatment notes" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <button onClick={addDisease} disabled={busy} className="w-full rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">File Report</button>
            </div>
          </Card>
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-800">Disease Reports ({diseases.length})</h3>
              <button onClick={() => exportObjectsToCSV("disease_reports", diseases)} className="text-xs text-emerald-600 hover:underline"><FileDown className="inline h-3 w-3" /> CSV</button>
            </div>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {diseases.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No disease reports.</p> : diseases.map((d) => (
                <div key={d.id as string} className="rounded-lg border border-slate-100 p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{String(d.disease_type).replace(/_/g, " ")}</span>
                    <Badge tone={d.severity === "critical" ? "rose" : d.severity === "high" ? "amber" : "slate"}>{String(d.severity)}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-400">{String(d.reported_at ?? "").slice(0, 10)} · {String(d.status)}</p>
                  {d.treatment_notes && <p className="text-[11px] text-slate-500">"{String(d.treatment_notes)}"</p>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Site Visits */}
      {tab === "visits" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Log Site Visit</h3>
            <div className="space-y-2">
              <input value={visitForm.supplierId} onChange={e => setVisitForm({ ...visitForm, supplierId: e.target.value })} placeholder="Supplier ID (optional)" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <input type="date" value={visitForm.visitDate} onChange={e => setVisitForm({ ...visitForm, visitDate: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.0000001" value={visitForm.latitude || ""} onChange={e => setVisitForm({ ...visitForm, latitude: +e.target.value })} placeholder="Lat (auto-detect)" className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
                <input type="number" step="0.0000001" value={visitForm.longitude || ""} onChange={e => setVisitForm({ ...visitForm, longitude: +e.target.value })} placeholder="Lng (auto-detect)" className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
              </div>
              <textarea value={visitForm.notes} onChange={e => setVisitForm({ ...visitForm, notes: e.target.value })} rows={2} placeholder="Visit notes *" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <input type="date" value={visitForm.followUpDate} onChange={e => setVisitForm({ ...visitForm, followUpDate: e.target.value })} placeholder="Follow-up date" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <button onClick={addVisit} disabled={busy} className="w-full rounded-lg bg-sky-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Log Visit (GPS auto-detect)</button>
            </div>
          </Card>
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-800">Visit History ({visits.length})</h3>
              <button onClick={() => exportObjectsToCSV("site_visits", visits)} className="text-xs text-emerald-600 hover:underline"><FileDown className="inline h-3 w-3" /> CSV</button>
            </div>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {visits.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No site visits yet.</p> : visits.map((v) => (
                <div key={v.id as string} className="rounded-lg border border-slate-100 p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{String(v.visit_date)}</span>
                    {v.latitude && <a href={`https://www.google.com/maps?q=${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-600 hover:underline">📍 Map</a>}
                  </div>
                  <p className="text-[11px] text-slate-500">{String(v.notes)}</p>
                  {v.follow_up_date && <p className="text-[10px] text-amber-600">Follow-up: {String(v.follow_up_date)}</p>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
