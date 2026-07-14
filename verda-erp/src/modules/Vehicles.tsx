import { useEffect, useState } from "react";
import { Truck, Plus, Loader2, Fuel, Wrench, Calendar, TrendingUp } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";
import { vehicles as seedVehicles, fuelLogs as seedFuelLogs, fmtNum, fmtLKR, fmtLKRShort, TODAY_ISO, addDays, type Vehicle, type FuelLog } from "@/lib/data";
import { useApp } from "@/context/AppContext";

type Tab = "fleet" | "fuel" | "add";

export default function Vehicles() {
  const { userUid } = useApp();
  const [tab, setTab] = useState<Tab>("fleet");
  const [fleet, setFleet] = useState<Vehicle[]>(seedVehicles);
  const [logs, setLogs] = useState<FuelLog[]>(seedFuelLogs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Forms
  const [vehicleForm, setVehicleForm] = useState({ reg: "", type: "Lorry (Green Leaf)", driver: "", status: "active" });
  const [fuelForm, setFuelForm] = useState({ vehicleReg: "", litres: 0, costPerLitre: 320, odometer: 0, station: "", slip: "" });

  const reload = async () => {
    if (!supabaseConfigured) return;
    setBusy(true);
    try {
      const sb = getSupabase()!;
      const [v, f] = await Promise.all([
        sb.from("vehicles").select("*").order("reg"),
        sb.from("fuel_logs").select("*").order("log_date", { ascending: false }),
      ]);
      if (v.data) setFleet(v.data.map((r: Record<string, unknown>) => ({
        id: r.id as string, reg: r.reg as string, type: (r.vehicle_type ?? r.type) as string,
        driver: (r.driver ?? "") as string, km: Number(r.km ?? 0), fuelL: Number(r.fuel_l ?? 0),
        lastService: (r.last_service ?? "") as string, status: (r.status ?? "active") as Vehicle["status"],
      })));
      if (f.data) setLogs(f.data.map((r: Record<string, unknown>) => ({
        id: r.id as string, date: (r.log_date ?? "") as string,
        vehicle: (r.vehicle_reg ?? "") as string, litres: Number(r.litres ?? 0),
        cost: Number(r.total_cost ?? 0), slip: (r.slip_ref ?? "") as string,
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const addVehicle = async () => {
    setError(null);
    if (!vehicleForm.reg.trim()) { setError("Registration required"); return; }
    setBusy(true);
    try {
      if (!supabaseConfigured) {
        setFleet([...fleet, { id: `v-${Date.now()}`, reg: vehicleForm.reg, type: vehicleForm.type, driver: vehicleForm.driver, km: 0, fuelL: 0, lastService: TODAY_ISO, status: vehicleForm.status as Vehicle["status"] }]);
      } else {
        const sb = getSupabase()!;
        const { error: err } = await sb.from("vehicles").insert({
          reg: vehicleForm.reg, vehicle_type: vehicleForm.type, driver: vehicleForm.driver, status: vehicleForm.status,
        });
        if (err) throw err;
      }
      setSuccess(`Vehicle ${vehicleForm.reg} added`);
      setVehicleForm({ reg: "", type: "Lorry (Green Leaf)", driver: "", status: "active" });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const logFuel = async () => {
    setError(null);
    if (!fuelForm.vehicleReg) { setError("Select a vehicle"); return; }
    if (fuelForm.litres <= 0) { setError("Litres must be > 0"); return; }
    setBusy(true);
    try {
      const total = +(fuelForm.litres * fuelForm.costPerLitre).toFixed(2);
      if (!supabaseConfigured) {
        setLogs([{ id: `fl-${Date.now()}`, date: TODAY_ISO, vehicle: fuelForm.vehicleReg, litres: fuelForm.litres, cost: total, slip: fuelForm.slip }, ...logs]);
      } else {
        const sb = getSupabase()!;
        const vehicle = fleet.find(v => v.reg === fuelForm.vehicleReg);
        const { error: err } = await sb.from("fuel_logs").insert({
          vehicle_reg: fuelForm.vehicleReg, vehicle_id: vehicle?.id,
          log_date: TODAY_ISO, litres: fuelForm.litres, cost_per_litre: fuelForm.costPerLitre,
          total_cost: total, odometer_km: fuelForm.odometer || null,
          fuel_station: fuelForm.station, slip_ref: fuelForm.slip, logged_by: userUid,
        });
        if (err) throw err;
        // Update vehicle km + fuel_l
        if (vehicle && fuelForm.odometer > 0) {
          await sb.from("vehicles").update({ km: fuelForm.odometer, fuel_l: fuelForm.litres }).eq("id", vehicle.id);
        }
      }
      setSuccess(`Fuel logged: ${fuelForm.litres}L × Rs ${fuelForm.costPerLitre} = ${fmtLKR(total)} for ${fuelForm.vehicleReg}`);
      setFuelForm({ vehicleReg: "", litres: 0, costPerLitre: 320, odometer: 0, station: "", slip: "" });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const totalFuelCost = logs.reduce((s, l) => s + l.cost, 0);
  const activeVehicles = fleet.filter(v => v.status === "active").length;
  const serviceDue = fleet.filter(v => v.status === "service").length;

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Vehicle & Fuel Management"
        desc="Fleet roster (tractors, lorries), fuel logging with cost tracking, mileage updates, and service status."
        icon={<IconChip icon={Truck} tone="amber" className="h-12 w-12" />}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Truck} label="Fleet Size" value={String(fleet.length)} tone="amber" />
        <StatCard icon={TrendingUp} label="Active" value={String(activeVehicles)} tone="emerald" />
        <StatCard icon={Wrench} label="In Service" value={String(serviceDue)} tone="rose" />
        <StatCard icon={Fuel} label="Fuel Cost (MTD)" value={fmtLKRShort(totalFuelCost)} tone="sky" />
      </div>

      <div className="mt-4 flex gap-2">
        {([
          { id: "fleet", label: "Fleet Roster", icon: Truck },
          { id: "fuel", label: "Fuel Logs", icon: Fuel },
          { id: "add", label: "Add Vehicle", icon: Plus },
        ] as const).map(t2 => {
          const Icon = t2.icon;
          const active = tab === t2.id;
          return (
            <button key={t2.id} onClick={() => setTab(t2.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${active ? "bg-amber-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              <Icon className="h-3.5 w-3.5" /> {t2.label}
            </button>
          );
        })}
      </div>

      {/* Fleet Roster */}
      {tab === "fleet" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Fleet ({fleet.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="pb-2">Reg No</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Driver</th>
                  <th className="pb-2 text-right">Mileage</th>
                  <th className="pb-2 text-right">Fuel</th>
                  <th className="pb-2">Last Service</th>
                  <th className="pb-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {fleet.map(v => (
                  <tr key={v.id} className="border-t border-slate-100">
                    <td className="py-2 font-bold text-slate-800">{v.reg}</td>
                    <td className="py-2 text-slate-600">{v.type}</td>
                    <td className="py-2 text-slate-600">{v.driver}</td>
                    <td className="py-2 text-right tnum">{fmtNum(v.km)} km</td>
                    <td className="py-2 text-right tnum">{v.fuelL} L</td>
                    <td className="py-2 text-slate-400">{v.lastService}</td>
                    <td className="py-2 text-center">
                      <Badge tone={v.status === "active" ? "emerald" : v.status === "service" ? "rose" : "amber"} dot>{v.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Fuel Logs */}
      {tab === "fuel" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Log Fuel</h3>
            <div className="space-y-2">
              <select value={fuelForm.vehicleReg} onChange={e => setFuelForm({ ...fuelForm, vehicleReg: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option value="">— select vehicle —</option>
                {fleet.map(v => <option key={v.id} value={v.reg}>{v.reg} ({v.type})</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400">Litres</label>
                  <input type="number" step="0.1" value={fuelForm.litres || ""} onChange={e => setFuelForm({ ...fuelForm, litres: +e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Cost / L (Rs)</label>
                  <input type="number" value={fuelForm.costPerLitre} onChange={e => setFuelForm({ ...fuelForm, costPerLitre: +e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400">Odometer (km)</label>
                  <input type="number" value={fuelForm.odometer || ""} onChange={e => setFuelForm({ ...fuelForm, odometer: +e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm tnum" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Station</label>
                  <input value={fuelForm.station} onChange={e => setFuelForm({ ...fuelForm, station: e.target.value })} placeholder="CEYPETCO" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Slip Ref</label>
                <input value={fuelForm.slip} onChange={e => setFuelForm({ ...fuelForm, slip: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              </div>
              {fuelForm.litres > 0 && (
                <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                  Total: <strong>{fmtLKR(fuelForm.litres * fuelForm.costPerLitre)}</strong>
                </div>
              )}
              <button onClick={logFuel} disabled={busy} className="w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Log Fuel</button>
            </div>
          </Card>

          <Card className="lg:col-span-2 p-4">
            <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Fuel History ({logs.length})</h3>
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {logs.map(l => (
                <div key={l.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2.5 text-xs">
                  <div>
                    <p className="font-semibold text-slate-800">{l.vehicle}</p>
                    <p className="text-[11px] text-slate-400">{l.date} · {l.slip}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-700">{l.litres} L</p>
                    <p className="text-[11px] text-slate-400">{fmtLKR(l.cost)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Add Vehicle */}
      {tab === "add" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Add New Vehicle</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] text-slate-400">Registration No *</label>
              <input value={vehicleForm.reg} onChange={e => setVehicleForm({ ...vehicleForm, reg: e.target.value })} placeholder="NB-1234" className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Vehicle Type</label>
              <select value={vehicleForm.type} onChange={e => setVehicleForm({ ...vehicleForm, type: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option>Lorry (Green Leaf)</option>
                <option>Lorry (Made Tea)</option>
                <option>Tractor (Massey Ferguson)</option>
                <option>Pickup (Supervisor)</option>
                <option>Motorcycle (Field Officer)</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Driver</label>
              <input value={vehicleForm.driver} onChange={e => setVehicleForm({ ...vehicleForm, driver: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">Status</label>
              <select value={vehicleForm.status} onChange={e => setVehicleForm({ ...vehicleForm, status: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2.5 text-sm">
                <option value="active">Active</option>
                <option value="idle">Idle</option>
                <option value="service">In Service</option>
              </select>
            </div>
          </div>
          <button onClick={addVehicle} disabled={busy} className="mt-4 w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">Add Vehicle</button>
        </Card>
      )}
    </div>
  );
}
