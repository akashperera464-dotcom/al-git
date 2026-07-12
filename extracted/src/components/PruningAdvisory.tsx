import { useEffect, useState } from "react";
import { Scissors, CalendarDays, Save, Loader2, Sprout, Sparkles, Droplets, Info } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { recommendPruning, ageBasedFertilizerTrigger, type PruningAdvice, type WeatherDay } from "@/lib/predictive";
import { updateEstatePlantedDate, readLatestFarmActivity } from "@/lib/repo";
import { TODAY_ISO, type FarmActivity } from "@/lib/data";
import { useApp } from "@/context/AppContext";

/**
 * PruningAdvisory — Smart Agronomic Advisory & Pruning Schedule.
 *
 * - Lets a supplier enter/update the "Planted Date" for their block.
 * - Computes the exact tea-plant age (deterministic).
 * - Renders the pruning cycle recommendation + weather-based fertilizer trigger.
 */
export function PruningAdvisory({ forecast }: { forecast: WeatherDay[] }) {
  const { estates, associatedEntityId, notify, userUid } = useApp();
  const estate = estates.find((e) => e.id === associatedEntityId);

  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(estate?.plantedDate ?? "");
  const [busy, setBusy] = useState(false);

  // Closed-loop: fetch the LATEST logged fertilizer + pruning activities so the
  // advisory recalculates from real feedback (not static dates).
  const [latestFert, setLatestFert] = useState<FarmActivity | null>(null);
  const [latestPrune, setLatestPrune] = useState<FarmActivity | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      const [f, p] = await Promise.all([
        readLatestFarmActivity(userUid, "fertilizer"),
        readLatestFarmActivity(userUid, "pruning"),
      ]);
      if (active) { setLatestFert(f); setLatestPrune(p); }
    })();
    return () => { active = false; };
  }, [userUid]);

  if (!estate) {
    return (
      <Card className="p-4">
        <p className="text-sm text-slate-400">No linked estate. Ask your admin to associate you with an estate.</p>
      </Card>
    );
  }

  const effectiveDate = editing ? date : estate.plantedDate ?? date;
  const advice: PruningAdvice | null = effectiveDate ? recommendPruning(effectiveDate, TODAY_ISO) : null;
  const fertMsg = advice ? ageBasedFertilizerTrigger(advice.age, forecast, TODAY_ISO) : "";

  const save = async () => {
    setBusy(true);
    try {
      await updateEstatePlantedDate(estate.id, date.trim());
      notify({ title: "Planted date saved ✅", body: `Advisory recalculated for ${date}.`, tone: "emerald", channel: "system" });
      setEditing(false);
    } catch (e) {
      notify({ title: "Save failed", body: e instanceof Error ? e.message : "DB error", tone: "rose", channel: "system" });
    } finally {
      setBusy(false);
    }
  };

  const LEVEL_TONE: Record<string, "emerald" | "amber" | "rose" | "sky"> = {
    optimal: "emerald",
    due: "amber",
    critical: "rose",
    info: "sky",
  };

  return (
    <div className="space-y-3">
      {/* Planted date input */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sprout className="h-4 w-4 text-emerald-600" />
            <h3 className="font-display text-sm font-bold text-slate-800">Plantation Date</h3>
          </div>
          {advice && <Badge tone="sky">{advice.age.display} old</Badge>}
        </div>

        {editing ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-slate-400">When were the tea plants planted?</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
              />
            </div>
            <button onClick={save} disabled={busy} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-60">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
            </button>
            <button onClick={() => { setEditing(false); setDate(estate.plantedDate ?? ""); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              <span className={estate.plantedDate ? "font-semibold text-slate-700" : "text-slate-400"}>
                {estate.plantedDate ?? "Not set — add your planted date"}
              </span>
            </div>
            <button onClick={() => { setDate(estate.plantedDate ?? ""); setEditing(true); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50">
              {estate.plantedDate ? "Update" : "Set date"}
            </button>
          </div>
        )}
      </Card>

      {/* Pruning recommendation */}
      {advice && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-emerald-600" />
              <h3 className="font-display text-sm font-bold text-slate-800">Pruning Recommendation</h3>
            </div>
            <Badge tone={LEVEL_TONE[advice.level] ?? "slate"} dot>{advice.currentCycle}</Badge>
          </div>
          <div className="rounded-xl border border-slate-100 p-3">
            <p className="text-sm font-bold text-slate-800">{advice.headline}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{advice.detail}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="amber"><CalendarDays className="mr-1 inline h-3 w-3" /> Next window: {advice.nextDate}</Badge>
              {advice.isPeakYield && (
                <Badge tone="emerald"><Sparkles className="mr-1 inline h-3 w-3" /> Peak Yield Phase</Badge>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Weather-based fertilizer trigger */}
      {advice && (
        <Card className="p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <Droplets className="h-4 w-4 text-sky-600" />
            <h3 className="font-display text-sm font-bold text-slate-800">Weather-Based Fertilizer Trigger</h3>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">{fertMsg}</p>
        </Card>
      )}

      {/* Feedback loop status — shows the last logged activities */}
      <Card className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Info className="h-4 w-4 text-violet-600" />
          <h3 className="font-display text-sm font-bold text-slate-800">Advisory Feedback Loop</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Last Fertilizer</p>
            <p className="text-sm font-bold text-slate-700">
              {latestFert ? latestFert.loggedDate : "—"}
            </p>
            {latestFert && (
              <p className="text-[10px] text-slate-400">
                {(latestFert.details as { type?: string }).type} · {(latestFert.details as { quantityKg?: number }).quantityKg} kg
              </p>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Last Pruning</p>
            <p className="text-sm font-bold text-slate-700">
              {latestPrune ? latestPrune.loggedDate : "—"}
            </p>
            {latestPrune && (
              <p className="text-[10px] capitalize text-slate-400">
                {(latestPrune.details as { type?: string }).type} · {(latestPrune.details as { areaHa?: number }).areaHa} ha
              </p>
            )}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Log new activities in <strong>My Farm Activities</strong> to reset these cycles and refresh your recommendations.
        </p>
      </Card>
    </div>
  );
}
