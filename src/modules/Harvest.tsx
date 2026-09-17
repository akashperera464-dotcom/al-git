import { Scale, PackageCheck, Percent, MapPin } from "lucide-react";
import { PageHeader, StatCard, Panel, Badge, IconChip, DataTable } from "@/components/ui";
import { CaptureButton } from "@/components/CaptureButton";
import { Donut } from "@/components/charts";
import { harvestRecords, fmtNum, type HarvestRecord } from "@/lib/data";

const GRADE_TONE: Record<HarvestRecord["grade"], "emerald" | "amber" | "rose"> = {
  Super: "emerald",
  Standard: "amber",
  Coarse: "rose",
};
const GRADE_COLOR: Record<HarvestRecord["grade"], string> = { Super: "#059669", Standard: "#f59e0b", Coarse: "#f43f5e" };

export default function Harvest() {
  const net = harvestRecords.reduce((s, r) => s + r.netKg, 0);
  const gross = harvestRecords.reduce((s, r) => s + r.grossKg, 0);
  const ded = gross - net;
  const superKg = harvestRecords.filter((r) => r.grade === "Super").reduce((s, r) => s + r.netKg, 0);
  const centers = [...new Set(harvestRecords.map((r) => r.center))];

  const gradeDonut = (["Super", "Standard", "Coarse"] as HarvestRecord["grade"][]).map((g) => ({
    name: g,
    value: Math.round(harvestRecords.filter((r) => r.grade === g).reduce((s, r) => s + r.netKg, 0)),
    color: GRADE_COLOR[g],
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Harvest Management"
        title="Green Leaf Weigh-in"
        desc="Weighing records at regional collection centers, mapped to workers, fields and quality grades."
        icon={<IconChip icon={Scale} tone="emerald" className="h-12 w-12" />}
        actions={<CaptureButton label="Log weigh-in" tone="emerald" icon={Scale} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={Scale} label="Net Leaf Today" value={`${net.toFixed(1)} kg`} sub={`${gross.toFixed(1)} kg gross`} tone="emerald" />
        <StatCard icon={Percent} label="Deductions" value={`${((ded / gross) * 100).toFixed(1)}%`} sub="Coarse / impurities" tone="amber" />
        <StatCard icon={PackageCheck} label="Super Grade" value={`${((superKg / net) * 100).toFixed(0)}%`} sub="Of net intake" tone="sky" />
        <StatCard icon={MapPin} label="Centers Active" value={String(centers.length)} sub={centers.join(" · ")} tone="violet" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Today's Weigh-in Records" subtitle="Collection center intake" icon={<IconChip icon={Scale} tone="emerald" className="h-9 w-9" />}>
          <DataTable<HarvestRecord>
            rows={harvestRecords}
            columns={[
              { key: "time", header: "Time", render: (r) => <span className="font-semibold text-slate-800 tnum">{r.time}</span> },
              { key: "center", header: "Center" },
              { key: "worker", header: "Worker" },
              { key: "field", header: "Field", align: "center" },
              { key: "grossKg", header: "Gross", align: "right", render: (r) => `${r.grossKg} kg` },
              { key: "netKg", header: "Net", align: "right", render: (r) => <span className="font-bold text-emerald-700">{r.netKg} kg</span> },
              { key: "grade", header: "Grade", align: "center", render: (r) => <Badge tone={GRADE_TONE[r.grade]}>{r.grade}</Badge> },
            ]}
          />
        </Panel>

        <div className="space-y-4">
          <Panel title="Quality Grade Mix" subtitle="Net kg by grade" icon={<IconChip icon={PackageCheck} tone="sky" className="h-9 w-9" />}>
            <Donut data={gradeDonut} centerValue={fmtNum(Math.round(net))} centerLabel="kg net" height={190} />
            <div className="mt-3 space-y-1.5">
              {gradeDonut.map((g) => (
                <div key={g.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-500">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: g.color }} />
                    {g.name}
                  </span>
                  <span className="font-semibold text-slate-700 tnum">{g.value} kg</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Quick Capture" subtitle="Offline-first weigh-in" icon={<IconChip icon={Scale} tone="amber" className="h-9 w-9" />}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <label className="text-[11px] font-medium text-slate-400">Center</label>
                <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm">
                  <option>Sutton CC</option>
                  <option>Craighead CC</option>
                  <option>Tennant CC</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-400">Field</label>
                <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm">
                  <option>S-01</option>
                  <option>C-01</option>
                  <option>T-01</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[11px] font-medium text-slate-400">Gross weight (kg)</label>
                <input defaultValue="24.6" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm tnum" />
              </div>
            </div>
            <div className="mt-3">
              <CaptureButton label="Record & queue" tone="emerald" icon={Scale} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
