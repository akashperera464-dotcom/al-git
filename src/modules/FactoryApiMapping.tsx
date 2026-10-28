import { useEffect, useState } from "react";
import { Cable, Loader2, Save } from "lucide-react";
import { Card } from "@/components/ui";
import { readFactoryOfficeMappings, readRouteOfficeMappings, saveFactoryOfficeCode, saveRouteOfficeCode, type FactoryOfficeMapping, type RouteOfficeMapping } from "@/lib/officeMapping";

export default function FactoryApiMapping() {
  const [factories, setFactories] = useState<FactoryOfficeMapping[]>([]);
  const [factoryId, setFactoryId] = useState("");
  const [routes, setRoutes] = useState<RouteOfficeMapping[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => { void readFactoryOfficeMappings().then((rows) => { setFactories(rows); setFactoryId((current) => current || rows[0]?.id || ""); }).catch((e) => setError(e instanceof Error ? e.message : "Could not load mappings.")); }, []);
  useEffect(() => { if (!factoryId) { setRoutes([]); return; } void readRouteOfficeMappings(factoryId).then(setRoutes).catch((e) => setError(e instanceof Error ? e.message : "Could not load routes.")); }, [factoryId]);

  const save = async () => {
    const factory = factories.find((item) => item.id === factoryId); if (!factory) return;
    setBusy(true); setError(""); setSaved("");
    try {
      await saveFactoryOfficeCode(factory.id, factory.officeFactoryCode);
      await Promise.all(routes.map((route) => saveRouteOfficeCode(route.id, route.officeRouteCode)));
      setSaved("Office API codes saved. Supplier IDs are configured in User Management.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save mappings."); }
    finally { setBusy(false); }
  };

  return <Card className="p-5">
    <div className="mb-4 flex items-start gap-3"><span className="rounded-xl bg-sky-100 p-2.5 text-sky-700"><Cable className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-800">Office API code mapping</h2><p className="text-xs text-slate-500">Connect EMS UUIDs to the factory system codes. These are codes only—API secrets stay in Vercel.</p></div></div>
    {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    {saved && <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">{saved}</p>}
    <label className="text-[11px] font-bold uppercase text-slate-400">Factory</label>
    <select value={factoryId} onChange={(e) => setFactoryId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{factories.map((factory) => <option key={factory.id} value={factory.id}>{factory.name}</option>)}</select>
    {factories.filter((item) => item.id === factoryId).map((factory) => <div key={factory.id} className="mt-4"><label className="text-[11px] font-bold uppercase text-slate-400">Office factory code</label><input value={factory.officeFactoryCode} onChange={(e) => setFactories((rows) => rows.map((row) => row.id === factory.id ? { ...row, officeFactoryCode: e.target.value } : row))} placeholder="e.g. 01" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /></div>)}
    <div className="mt-5 overflow-hidden rounded-xl border border-slate-200"><div className="grid grid-cols-[1fr_9rem] bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase text-slate-400"><span>EMS route</span><span>Office route code</span></div>{routes.map((route) => <div key={route.id} className="grid grid-cols-[1fr_9rem] items-center gap-3 border-t px-3 py-2"><span className="text-sm text-slate-700">{route.routeCode ? `${route.routeCode} — ` : ""}{route.name}</span><input value={route.officeRouteCode} onChange={(e) => setRoutes((rows) => rows.map((row) => row.id === route.id ? { ...row, officeRouteCode: e.target.value } : row))} placeholder="e.g. 10" className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" /></div>)}</div>
    <div className="mt-4 flex justify-end"><button onClick={() => void save()} disabled={busy || !factoryId} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save mappings</button></div>
  </Card>;
}
