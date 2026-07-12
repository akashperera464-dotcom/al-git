import { MapPin, Layers, Navigation, Crosshair } from "lucide-react";
import { PageHeader, StatCard, Panel, Badge, IconChip } from "@/components/ui";
import { allFields, fmtNum } from "@/lib/data";

interface Poly {
  id: string;
  label: string;
  d: string;
  status: "plucking" | "pruned" | "young" | "nursery";
  cx: number;
  cy: number;
}
const POLYS: Poly[] = [
  { id: "S-01", label: "Sutton Upper", status: "plucking", d: "M40,50 L120,40 L130,110 L50,120 Z", cx: 85, cy: 80 },
  { id: "S-02", label: "Sutton Lower", status: "plucking", d: "M135,45 L210,55 L205,130 L130,115 Z", cx: 170, cy: 88 },
  { id: "S-03", label: "Camellia Bank", status: "pruned", d: "M50,130 L130,120 L140,200 L60,205 Z", cx: 95, cy: 165 },
  { id: "C-01", label: "Craighead East", status: "plucking", d: "M220,60 L320,50 L330,150 L215,160 Z", cx: 270, cy: 105 },
  { id: "C-02", label: "Mist Valley", status: "plucking", d: "M335,55 L390,70 L380,170 L340,160 Z", cx: 360, cy: 115 },
  { id: "T-01", label: "Tennant Peak", status: "plucking", d: "M215,170 L320,165 L315,250 L210,255 Z", cx: 265, cy: 210 },
  { id: "T-03", label: "Springs Nursery", status: "nursery", d: "M150,210 L205,205 L200,255 L150,255 Z", cx: 175, cy: 230 },
];
const FILL: Record<string, string> = { plucking: "#10b981", pruned: "#f59e0b", young: "#38bdf8", nursery: "#2dd4bf" };

export default function GisMap() {
  return (
    <div>
      <PageHeader
        eyebrow="GPS & GIS Mapping"
        title="Estate Geo-Spatial View"
        desc="Map visualisation tracking estate fields, paths and distribution targets (placeholder for tile/Mapbox layer)."
        icon={<IconChip icon={MapPin} tone="emerald" className="h-12 w-12" />}
        actions={
          <div className="flex gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><Crosshair className="h-3.5 w-3.5" /> Locate</button>
            <button className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><Navigation className="h-3.5 w-3.5" /> Route</button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={Layers} label="Mapped Fields" value={String(allFields.length)} sub="Geofenced" tone="emerald" />
        <StatCard icon={MapPin} label="Collection Centers" value="3" sub="Active nodes" tone="amber" />
        <StatCard icon={Navigation} label="Transport Routes" value="6" sub="Leaf corridors" tone="sky" />
        <StatCard icon={Crosshair} label="GPS Accuracy" value="±2.4m" sub="RTK corrected" tone="violet" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Glenview Estate — Field Polygons" subtitle="Tap a parcel for live telemetry" icon={<IconChip icon={MapPin} tone="emerald" className="h-9 w-9" />}>
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50">
            <div className="grid-overlay absolute inset-0 opacity-60" />
            <svg viewBox="0 0 410 280" className="relative w-full">
              {/* roads */}
              <path d="M0,150 Q150,135 410,165" stroke="#cbd5e1" strokeWidth="4" fill="none" strokeDasharray="2 6" />
              <path d="M205,0 Q200,120 210,280" stroke="#cbd5e1" strokeWidth="3" fill="none" strokeDasharray="2 6" />
              {POLYS.map((p) => (
                <g key={p.id} className="cursor-pointer">
                  <path d={p.d} fill={FILL[p.status]} fillOpacity="0.65" stroke="#ffffff" strokeWidth="2" className="transition-all hover:fill-opacity-90" />
                  <text x={p.cx} y={p.cy} textAnchor="middle" className="fill-slate-700 text-[9px] font-bold">{p.id}</text>
                </g>
              ))}
              {/* collection center pins */}
              {[[170, 88], [270, 105], [265, 210]].map(([x, y], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r="7" fill="#dc2626" opacity="0.25" className="animate-pulse" />
                  <circle cx={x} cy={y} r="3.5" fill="#dc2626" stroke="#fff" strokeWidth="1.5" />
                </g>
              ))}
            </svg>
            <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-lg bg-white/90 p-2 backdrop-blur">
              {Object.entries(FILL).map(([k, c]) => (
                <span key={k} className="flex items-center gap-1 text-[10px] font-medium text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} /> {k}
                </span>
              ))}
              <span className="flex items-center gap-1 text-[10px] font-medium text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-rose-600" /> Center</span>
            </div>
          </div>
        </Panel>

        <Panel title="Parcel Telemetry" subtitle="Selected: Craighead East (C-01)" icon={<IconChip icon={Layers} tone="sky" className="h-9 w-9" />}>
          <div className="space-y-2.5 text-sm">
            {[
              ["Area", `${fmtNum(42)} ha`],
              ["Cultivar", "TRI 2025 (VP)"],
              ["Elevation", "1,850 m"],
              ["Centroid", "6.9679°N, 80.7618°E"],
              ["Last pluck", "2 days ago"],
              ["NDVI health", "0.78 — Vigorous"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-slate-50 pb-2">
                <span className="text-slate-400">{k}</span>
                <span className="font-semibold text-slate-700">{v}</span>
              </div>
            ))}
          </div>
          <Badge tone="emerald" className="mt-3">Within plucking window</Badge>
        </Panel>
      </div>
    </div>
  );
}
