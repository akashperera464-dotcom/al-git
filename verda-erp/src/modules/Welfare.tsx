import { useEffect, useState } from "react";
import { HeartPulse, Plus, Loader2, Home, Briefcase, Baby, Stethoscope, GraduationCap } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { welfareCases as seedCases, welfareUnits as seedUnits, fmtLKR, fmtLKRShort, TODAY_ISO, type WelfareCase, type WelfareUnit } from "@/lib/data";
import { useApp } from "@/context/AppContext";

type Tab = "cases" | "housing" | "add";

export default function Welfare() {
  const { userUid } = useApp();
  const [tab, setTab] = useState<Tab>("cases");
  const [cases, setCases] = useState<WelfareCase[]>(seedCases);
  const [units, setUnits] = useState<WelfareUnit[]>(seedUnits);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Forms
  const [caseForm, setCaseForm] = useState({ type: "Clinic Visit", person: "", detail: "", priority: "normal", cost: 0 });
  const [unitForm, setUnitForm] = useState({ blockName: "", unitType: "line_room", families: 0, occupants: 0, condition: "Good" });

  const reload = async () => {
    if (!supabaseConfigured) return;
    setBusy(true);
    try {
      const sb = getSupabase()!;
      const [c, u] = await Promise.all([
        sb.from("welfare_cases").select("*").order("date", { ascending: false }),
        sb.from("welfare_units").select("*").order("block_name"),
      ]);
      if (c.data) setCases(c.data.map((r: Record<string, unknown>) => ({
        id: r.id as string, type: (r.case_type ?? "Clinic Visit") as WelfareCase["type"],
        person: (r.person_name ?? "") as string, detail: (r.detail ?? "") as string,
        date: (r.date ?? TODAY_ISO) as string, status: (r.status ?? "open") as WelfareCase["status"],
      })));
      if (u.data) setUnits(u.data.map((r: Record<string, unknown>) => ({
        id: r.id as string, block: (r.block_name ?? "") as string,
        families: Number(r.families ?? 0), condition: (r.condition ?? "Good") as WelfareUnit["condition"],
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const addCase = async () => {
    setError(null);
    if (!caseForm.person.trim()) { setError("Person name required"); return; }
    setBusy(true);
    try {
      if (!supabaseConfigured) {
        setCases([{ id: `wc-${Date.now()}`, type: caseForm.type as WelfareCase["type"], person: caseForm.person, detail: caseForm.detail, date: TODAY_ISO, status: "open" }, ...cases]);
      } else {
        const sb = getSupabase()!;
        const { error: err } = await sb.from("welfare_cases").insert({
          case_type: caseForm.type, person_name: caseForm.person, detail: caseForm.detail,
          date: TODAY_ISO, status: "open", priority: caseForm.priority, cost: caseForm.cost,
        });
        if (err) throw err;
      }
      setSuccess(`Welfare case added for ${caseForm.person}`);
      setCaseForm({ type: "Clinic Visit", person: "", detail: "", priority: "normal", cost: 0 });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const resolveCase = async (c: WelfareCase) => {
    setBusy(true);
    try {
      if (!supabaseConfigured) {
        setCases(cases.map(x => x.id === c.id ? { ...x, status: "settled" as const } : x));
      } else {
        const sb = getSupabase()!;
        await sb.from("welfare_cases").update({ status: "settled" }).eq("id", c.id);
      }
      setSuccess(`Case for ${c.person} resolved`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const addUnit = async () => {
    setError(null);
    if (!unitForm.blockName.trim()) { setError("Block name required"); return; }
    setBusy(true);
    try {
      if (!supabaseConfigured) {
        setUnits([...units, { id: `wu-${Date.now()}`, block: unitForm.blockName, families: unitForm.families, condition: unitForm.condition as WelfareUnit["condition"] }]);
      } else {
        const sb = getSupabase()!;
        const { error: err } = await sb.from("welfare_units").insert({
          block_name: unitForm.blockName, unit_type: unitForm.unitType,
          families: unitForm.families, occupants: unitForm.occupants, condition: unitForm.condition,
        });
        if (err) throw err;
      }
      setSuccess(`Housing unit "${unitForm.blockName}" added`);
      setUnitForm({ blockName: "", unitType: "line_room", families: 0, occupants: 0, condition: "Good" });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const openCases = cases.filter(c => c.status === "open").length;
  const priorityCases = cases.filter(c => c.status === "open").length;
  const totalFamilies = units.reduce((s, u) => s + u.families, 0);
  const needsRepair = units.filter(u => u.condition !== "Good").length;

  return (
    <div>
      <PageHeader
        eyebrow="People & Pay"
        title="Welfare Management"
        desc="Worker welfare — housing conditions, clinic visits, scholarships, maternity cases. Track open cases and housing repair priorities."
        icon={<IconChip icon={HeartPulse} tone="rose" className="h-12 w-12" />}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={HeartPulse} label="Open Cases" value={String(openCases)} tone="rose" />
        <StatCard icon={Home} label="Housing Units" value={String(units.length)} tone="amber" />
        <StatCard icon={Home} label="Total Families" value={String(totalFamilies)} tone="sky" />
        <StatCard icon={Briefcase} label="Needs Repair" value={String(needsRepair)} tone="amber" />
      </div>

      <div className="mt-4 flex gap-2">
        {([
          { id: "cases", label: `Welfare Cases${openCases > 0 ? ` (${openCases})` : ""}`, icon: HeartPulse },
          { id: "housing", label: "Housing Units", icon: Home },
          { id: "add", label: "Add Case / Unit", icon: Plus },
        ] as const).map(t2 => {
          const Icon = t2.icon;
          const active = tab === t2.id;
          return (
            <button key={t2.id} onClick={() => setTab(t2.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${active ? "bg-rose-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              <Icon className="h-3.5 w-3.5" /> {t2.label}
            </button>
          );
        })}
      </div>

      {/* Welfare Cases */}
      {tab === "cases" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Welfare Cases ({cases.length})</h3>
          {cases.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No welfare cases yet.</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {cases.map(c => (
                <div key={c.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {c.type === "Clinic Visit" && <Stethoscope className="h-4 w-4 text-sky-500" />}
                      {c.type === "Scholarship" && <GraduationCap className="h-4 w-4 text-violet-500" />}
                      {c.type === "Maternity" && <Baby className="h-4 w-4 text-rose-500" />}
                      <p className="text-sm font-semibold text-slate-800">{c.person}</p>
                      <Badge tone="violet">{c.type}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={c.status === "open" ? "amber" : "emerald"} dot>{c.status}</Badge>
                      {c.status === "open" && (
                        <button onClick={() => resolveCase(c)} disabled={busy}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:brightness-110">
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                  {c.detail && <p className="mt-1 text-xs text-slate-500">{c.detail}</p>}
                  <p className="mt-0.5 text-[10px] text-slate-400">{c.date}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Housing Units */}
      {tab === "housing" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Housing Units ({units.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Block Name</th>
                  <th className="pb-2 text-right">Families</th>
                  <th className="pb-2 text-center">Condition</th>
                </tr>
              </thead>
              <tbody>
                {units.map(u => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="py-2 font-semibold text-slate-800">{u.block}</td>
                    <td className="py-2 text-right tnum">{u.families}</td>
                    <td className="py-2 text-center">
                      <Badge tone={u.condition === "Good" ? "emerald" : u.condition === "Needs Repair" ? "amber" : "rose"} dot>{u.condition}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Case / Unit */}
      {tab === "add" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Add Welfare Case</h3>
            <div className="space-y-2">
              <select value={caseForm.type} onChange={e => setCaseForm({ ...caseForm, type: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option>Clinic Visit</option>
                <option>Scholarship</option>
                <option>Maternity</option>
                <option>Housing Repair</option>
              </select>
              <input value={caseForm.person} onChange={e => setCaseForm({ ...caseForm, person: e.target.value })} placeholder="Person name *" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <textarea value={caseForm.detail} onChange={e => setCaseForm({ ...caseForm, detail: e.target.value })} rows={2} placeholder="Details" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={caseForm.priority} onChange={e => setCaseForm({ ...caseForm, priority: e.target.value })} className="rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                  <option value="low">Low Priority</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <input type="number" value={caseForm.cost || ""} onChange={e => setCaseForm({ ...caseForm, cost: +e.target.value })} placeholder="Cost (Rs)" className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
              </div>
              <button onClick={addCase} disabled={busy} className="w-full rounded-lg bg-rose-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Add Case</button>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Add Housing Unit</h3>
            <div className="space-y-2">
              <input value={unitForm.blockName} onChange={e => setUnitForm({ ...unitForm, blockName: e.target.value })} placeholder="Block name *" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <select value={unitForm.unitType} onChange={e => setUnitForm({ ...unitForm, unitType: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option value="line_room">Line Room</option>
                <option value="family_quarter">Family Quarter</option>
                <option value="dormitory">Dormitory</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={unitForm.families || ""} onChange={e => setUnitForm({ ...unitForm, families: +e.target.value })} placeholder="Families" className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
                <input type="number" value={unitForm.occupants || ""} onChange={e => setUnitForm({ ...unitForm, occupants: +e.target.value })} placeholder="Occupants" className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
              </div>
              <select value={unitForm.condition} onChange={e => setUnitForm({ ...unitForm, condition: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option>Good</option>
                <option>Needs Repair</option>
                <option>Priority</option>
              </select>
              <button onClick={addUnit} disabled={busy} className="w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Add Unit</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
