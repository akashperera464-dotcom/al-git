import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui";
import {
  readDailyTeaPrices,
  readFactories,
  type FactoryOption,
} from "@/lib/supplierOperations";
import { useApp } from "@/context/AppContext";

const GRADES = ["Standard", "Super", "PV Super", "Coarse"] as const;

function sriLankaDateISO(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Colombo",
  }).formatToParts(new Date());
  const value = (type: "day" | "month" | "year") => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function DailyTeaPriceManager() {
  const { setActiveModule } = useApp();
  const [factories, setFactories] = useState<FactoryOption[]>([]);
  const [factoryId, setFactoryId] = useState("");
  const [priceDate, setPriceDate] = useState(sriLankaDateISO);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void readFactories()
      .then((rows) => {
        if (!active) return;
        setFactories(rows);
        setFactoryId((current) => current || rows[0]?.id || "");
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Could not load factories."));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setMessage("");
    setError("");
    if (!factoryId) {
      setPrices({});
      setLoading(false);
      return;
    }
    setLoading(true);
    void readDailyTeaPrices(priceDate, factoryId)
      .then((rows) => {
        if (active) setPrices(Object.fromEntries(rows.map((row) => [row.grade, row.pricePerKg])));
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Could not load daily prices."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [factoryId, priceDate]);

  const save = async () => {
    setSaving(true); sessionStorage.setItem("verda.estateMaster.tab", "prices"); setActiveModule("estate-master"); setSaving(false);
  };

  return (
    <Card className="mt-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-bold text-slate-800">Supplier green-leaf prices</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">Set the daily rate used for grade-wise supplier earnings. Each factory keeps its own rates.</p>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">Estimate only · Finance confirms month-end</span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">
          Factory
          <select value={factoryId} onChange={(event) => setFactoryId(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
            <option value="">— select factory —</option>
            {factories.map((factory) => <option key={factory.id} value={factory.id}>{factory.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Effective date
          <input type="date" value={priceDate} onChange={(event) => setPriceDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {GRADES.map((grade) => (
          <label key={grade} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-semibold text-slate-600">
            {grade === "Standard" ? "Normal Leaf" : grade}
            <span className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
              <span className="text-slate-400">Rs</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={prices[grade] ?? ""}
                onChange={(event) => setPrices((current) => ({ ...current, [grade]: Number(event.target.value) }))}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none"
              />
            </span>
          </label>
        ))}
      </div>

      {loading && <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading effective rates…</p>}
      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      {message && <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />{message}</p>}

      <div className="mt-4 flex justify-end">
        <button onClick={save} disabled={saving || loading || !factoryId} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{saving ? "Opening…" : "Open audited price workflow"}
        </button>
      </div>
    </Card>
  );
}

