import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Factory as FactoryIcon, Plus, Loader2, ArrowRight, Thermometer, Droplets, Package, Scale, Clock, History } from "lucide-react";
import { PageHeader, StatCard, Card, Badge, IconChip } from "@/components/ui";
import { fmtNum } from "@/lib/data";
import {
  listFactoryBatches, createFactoryBatch, advanceBatchStage, listStageLogs,
} from "@/lib/repo.phase2";
import { useApp } from "@/context/AppContext";
import type { FactoryBatch, FactoryStageLog, FactoryStage, BatchStatus } from "@/lib/data";

const STAGE_ORDER: FactoryStage[] = ["withering", "rolling", "fermentation", "drying", "sorting", "packing", "dispatched"];
const STAGE_LABEL: Record<FactoryStage, string> = {
  withering: "Withering",
  rolling: "Rolling",
  fermentation: "Fermentation",
  drying: "Drying",
  sorting: "Sorting & Grading",
  packing: "Packing",
  dispatched: "Dispatched",
};

/**
 * Factory Floor — batch tracking through every manufacturing stage.
 * Records input/output weights, moisture, temperature, humidity per stage.
 * Computes recovery % (output / green-leaf input).
 */
export default function Factory() {
  const { t } = useTranslation();
  const { userUid } = useApp();
  const [batches, setBatches] = useState<FactoryBatch[]>([]);
  const [logs, setLogs] = useState<Record<string, FactoryStageLog[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "create">("active");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Create-form state
  const [batchCode, setBatchCode] = useState(`BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 100)}`);
  const [gradeCode, setGradeCode] = useState("BOP");
  const [gradeName, setGradeName] = useState("Broken Orange Pekoe");
  const [greenLeafKg, setGreenLeafKg] = useState(500);

  // Stage-advance modal state
  const [advancingBatch, setAdvancingBatch] = useState<FactoryBatch | null>(null);
  const [advanceForm, setAdvanceForm] = useState({ toStage: "rolling" as FactoryStage, outputKg: 0, moisturePct: 0, temperatureC: 0, humidityPct: 0, gradeCode: "", gradeName: "", notes: "" });

  const reload = async () => {
    setBusy(true);
    try {
      const bs = await listFactoryBatches();
      setBatches(bs);
      // fetch logs for the first 5 batches
      const logMap: Record<string, FactoryStageLog[]> = {};
      for (const b of bs.slice(0, 8)) {
        logMap[b.id] = await listStageLogs(b.id);
      }
      setLogs(logMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load batches");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const create = async () => {
    setError(null);
    if (!batchCode.trim() || !gradeCode.trim() || greenLeafKg <= 0) {
      setError("Batch code, grade code, and green-leaf input are required");
      return;
    }
    setBusy(true);
    try {
      await createFactoryBatch({
        batchCode: batchCode.trim(), gradeCode: gradeCode.trim(),
        gradeName: gradeName.trim() || undefined, greenLeafInKg: greenLeafKg,
        startedBy: userUid,
      });
      setBatchCode(`BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 100)}`);
      setTab("active");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create batch");
    } finally {
      setBusy(false);
    }
  };

  const openAdvance = (b: FactoryBatch) => {
    const currentIdx = STAGE_ORDER.indexOf(b.currentStage);
    const nextStage = STAGE_ORDER[Math.min(currentIdx + 1, STAGE_ORDER.length - 1)];
    setAdvancingBatch(b);
    setAdvanceForm({
      toStage: nextStage, outputKg: 0, moisturePct: 0, temperatureC: 0, humidityPct: 0,
      gradeCode: b.gradeCode, gradeName: b.gradeName ?? "", notes: "",
    });
  };

  const confirmAdvance = async () => {
    if (!advancingBatch) return;
    setBusy(true);
    try {
      const res = await advanceBatchStage({
        batchId: advancingBatch.id,
        expectedVersion: advancingBatch.version,
        toStage: advanceForm.toStage,
        operatorUid: userUid,
        outputKg: advanceForm.outputKg || undefined,
        moisturePct: advanceForm.moisturePct || undefined,
        temperatureC: advanceForm.temperatureC || undefined,
        humidityPct: advanceForm.humidityPct || undefined,
        gradeCode: advanceForm.gradeCode || undefined,
        gradeName: advanceForm.gradeName || undefined,
        notes: advanceForm.notes || undefined,
      });
      if (res.resolution === "conflict") {
        setError("Conflict — another user modified this batch. Refreshed.");
      } else if (res.resolution === "not_found") {
        setError("Batch no longer exists.");
      }
      setAdvancingBatch(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to advance stage");
    } finally {
      setBusy(false);
    }
  };

  // Stats
  const activeBatches = batches.filter(b => b.status === "open" || b.status === "in_progress");
  const completedToday = batches.filter(b => b.status === "completed");
  const totalGreenLeaf = batches.reduce((s, b) => s + b.greenLeafInKg, 0);
  const totalMadeTea = batches.reduce((s, b) => s + b.outputKg, 0);
  const recoveryPct = totalGreenLeaf > 0 ? (totalMadeTea / totalGreenLeaf) * 100 : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Factory Operations"
        title="Factory Floor & Batch Tracking"
        desc="Track green-leaf batches through withering → rolling → fermentation → drying → sorting → packing → dispatch. Recovery % computed automatically."
        icon={<IconChip icon={FactoryIcon} tone="emerald" className="h-12 w-12" />}
      />

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={FactoryIcon} label="Active Batches" value={String(activeBatches.length)} tone="amber" />
        <StatCard icon={Package} label="Completed" value={String(completedToday.length)} tone="emerald" />
        <StatCard icon={Scale} label="Green Leaf In" value={`${fmtNum(totalGreenLeaf)} kg`} tone="sky" />
        <StatCard icon={Scale} label="Recovery %" value={`${recoveryPct.toFixed(1)}%`} tone="violet" />
      </div>

      <div className="mt-4 flex gap-2">
        {([
          { id: "active", label: "Active Batches", icon: Factory },
          { id: "create", label: "New Batch", icon: Plus },
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

      {/* Tab: Active Batches */}
      {tab === "active" && (
        <div className="mt-4 space-y-3">
          {batches.length === 0 ? (
            <Card className="p-8 text-center text-sm text-slate-400">No batches yet. Create one in the New Batch tab.</Card>
          ) : (
            batches.map(b => {
              const recovery = b.greenLeafInKg > 0 ? (b.outputKg / b.greenLeafInKg) * 100 : 0;
              const stageIdx = STAGE_ORDER.indexOf(b.currentStage);
              const isExpanded = expanded === b.id;
              const nextStage = STAGE_ORDER[Math.min(stageIdx + 1, STAGE_ORDER.length - 1)];
              const canAdvance = b.status !== "completed" && b.status !== "rejected";
              return (
                <Card key={b.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-display text-sm font-bold text-slate-800">{b.batchCode}</p>
                        <Badge tone={b.status === "completed" ? "emerald" : b.status === "in_progress" ? "amber" : b.status === "rejected" ? "rose" : "sky"} dot>{b.status}</Badge>
                        <span className="text-[10px] text-slate-400">v{b.version}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Grade: {b.gradeCode} {b.gradeName && `· ${b.gradeName}`} · Green Leaf In: {fmtNum(b.greenLeafInKg)} kg
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {b.status === "completed" && <Badge tone="emerald">Recovery {recovery.toFixed(1)}%</Badge>}
                      {canAdvance && (
                        <button onClick={() => openAdvance(b)} disabled={busy}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-50">
                          Advance to {STAGE_LABEL[nextStage]} <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                      <button onClick={() => setExpanded(isExpanded ? null : b.id)}
                        className="text-xs text-emerald-600 hover:underline">
                        {isExpanded ? "Hide" : "Show"} log
                      </button>
                    </div>
                  </div>

                  {/* Stage progress bar */}
                  <div className="mt-3 flex items-center gap-1">
                    {STAGE_ORDER.map((s, idx) => {
                      const done = idx < stageIdx;
                      const current = idx === stageIdx;
                      return (
                        <div key={s} className="flex items-center">
                          <div className={`h-2 w-10 rounded-full ${done ? "bg-emerald-500" : current ? "bg-amber-400" : "bg-slate-200"}`} />
                          {idx < STAGE_ORDER.length - 1 && <ArrowRight className="mx-0.5 h-3 w-3 text-slate-300" />}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] text-slate-400">
                    {STAGE_ORDER.map(s => <span key={s} className="w-10 text-center">{STAGE_LABEL[s].slice(0, 5)}</span>)}
                  </div>

                  {b.status === "completed" && (
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-emerald-50 p-2">
                        <p className="text-[10px] text-slate-400">Green Leaf In</p>
                        <p className="font-bold text-slate-800">{fmtNum(b.greenLeafInKg)} kg</p>
                      </div>
                      <div className="rounded-lg bg-sky-50 p-2">
                        <p className="text-[10px] text-slate-400">Made Tea Out</p>
                        <p className="font-bold text-slate-800">{fmtNum(b.outputKg)} kg</p>
                      </div>
                      <div className="rounded-lg bg-rose-50 p-2">
                        <p className="text-[10px] text-slate-400">Waste</p>
                        <p className="font-bold text-slate-800">{fmtNum(b.wasteKg)} kg</p>
                      </div>
                    </div>
                  )}

                  {/* Stage logs */}
                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                        <History className="h-3 w-3" /> Stage Log
                      </p>
                      {(logs[b.id] ?? []).length === 0 ? (
                        <p className="text-[11px] text-slate-400">No stage logs yet.</p>
                      ) : (
                        (logs[b.id] ?? []).map(l => (
                          <div key={l.id} className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-[11px]">
                            <Badge tone="slate">{STAGE_LABEL[l.stage]}</Badge>
                            <div className="flex-1">
                              <p className="text-slate-600">
                                Started: {new Date(l.startedAt).toLocaleString()}
                                {l.endedAt && ` · Ended: ${new Date(l.endedAt).toLocaleString()}`}
                                {l.durationMin !== undefined && ` · ${l.durationMin} min`}
                              </p>
                              <div className="flex flex-wrap gap-3 text-slate-500">
                                {l.inputKg !== undefined && <span>In: {fmtNum(l.inputKg)} kg</span>}
                                {l.outputKg !== undefined && <span>Out: {fmtNum(l.outputKg)} kg</span>}
                                {l.moisturePct !== undefined && <span>💧 {l.moisturePct}%</span>}
                                {l.temperatureC !== undefined && <span>🌡 {l.temperatureC}°C</span>}
                                {l.humidityPct !== undefined && <span>{l.humidityPct}% RH</span>}
                                {l.gradeCode && <span>{l.gradeCode}</span>}
                              </div>
                              {l.notes && <p className="mt-0.5 text-slate-400">"{l.notes}"</p>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Create Batch */}
      {tab === "create" && (
        <Card className="mt-4 p-4">
          <h3 className="mb-3 font-display text-sm font-bold text-slate-800">Start New Factory Batch</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-slate-400">Batch Code</label>
              <input value={batchCode} onChange={e => setBatchCode(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400">Green Leaf In (kg)</label>
              <input type="number" step="0.1" value={greenLeafKg} onChange={e => setGreenLeafKg(+e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm tnum" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400">Grade Code</label>
              <select value={gradeCode} onChange={e => setGradeCode(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2.5 text-sm">
                {["BOP", "BOPF", "PEKOE", "OP", "FBOP", "DUST", "DUST1", "PF1"].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400">Grade Name</label>
              <input value={gradeName} onChange={e => setGradeName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
            </div>
          </div>
          <button onClick={create} disabled={busy}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition enabled:hover:brightness-110 disabled:opacity-50">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            Start Batch (Withering Stage)
          </button>
        </Card>
      )}

      {/* Stage Advance Modal */}
      {advancingBatch && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setAdvancingBatch(null)}>
          <Card className="w-full max-w-lg p-4" >
            <div onClick={e => e.stopPropagation()}>
              <h3 className="font-display text-sm font-bold text-slate-800">Advance {advancingBatch.batchCode}</h3>
              <p className="text-[11px] text-slate-400">Current: {STAGE_LABEL[advancingBatch.currentStage]} → Next: {STAGE_LABEL[advanceForm.toStage]}</p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400">Output Weight (kg)</label>
                  <input type="number" step="0.1" value={advanceForm.outputKg || ""} onChange={e => setAdvanceForm({ ...advanceForm, outputKg: +e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm tnum" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Moisture %</label>
                  <input type="number" step="0.1" value={advanceForm.moisturePct || ""} onChange={e => setAdvanceForm({ ...advanceForm, moisturePct: +e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm tnum" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Temperature °C</label>
                  <input type="number" step="0.1" value={advanceForm.temperatureC || ""} onChange={e => setAdvanceForm({ ...advanceForm, temperatureC: +e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm tnum" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Humidity %</label>
                  <input type="number" step="0.1" value={advanceForm.humidityPct || ""} onChange={e => setAdvanceForm({ ...advanceForm, humidityPct: +e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm tnum" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Grade Code</label>
                  <input value={advanceForm.gradeCode} onChange={e => setAdvanceForm({ ...advanceForm, gradeCode: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Grade Name</label>
                  <input value={advanceForm.gradeName} onChange={e => setAdvanceForm({ ...advanceForm, gradeName: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-slate-400">Notes</label>
                  <textarea value={advanceForm.notes} onChange={e => setAdvanceForm({ ...advanceForm, notes: e.target.value })} rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button onClick={() => setAdvancingBatch(null)} className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-500">Cancel</button>
                <button onClick={confirmAdvance} disabled={busy}
                  className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-50">
                  {busy ? "Advancing…" : `Advance to ${STAGE_LABEL[advanceForm.toStage]}`}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
