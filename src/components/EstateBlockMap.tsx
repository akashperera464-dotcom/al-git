import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { LocateFixed, MapPinned, RotateCcw, Trash2, Undo2 } from "lucide-react";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  boundaryCenter,
  boundaryToPoints,
  calculatePolygonAreaHa,
  pointsToBoundary,
  type EstateBlockBoundary,
  type EstateLandType,
  type EstateMapPoint,
} from "@/lib/estateMap";

export interface EstateBlockMapItem {
  id: string;
  name: string;
  areaHa: number;
  bushCount?: number;
  status?: string;
  landType?: EstateLandType;
  boundaryGeojson?: EstateBlockBoundary;
}

interface Props {
  estatePoint?: EstateMapPoint;
  blocks: EstateBlockMapItem[];
  editable?: boolean;
  onBoundaryChange?: (blockId: string, boundary: EstateBlockBoundary | undefined, areaHa: number) => void;
}

const COLORS: Record<EstateLandType, string> = {
  tea: "#059669", nursery: "#84cc16", forest: "#166534", water: "#0284c7", road: "#78716c", other: "#d97706",
};

function ClickCapture({ enabled, onPoint }: { enabled: boolean; onPoint: (point: EstateMapPoint) => void }) {
  useMapEvents({ click: (event) => { if (enabled) onPoint({ latitude: event.latlng.lat, longitude: event.latlng.lng }); } });
  return null;
}

function FitMap({ estatePoint, blocks }: { estatePoint?: EstateMapPoint; blocks: EstateBlockMapItem[] }) {
  const map = useMap();
  useEffect(() => {
    const points = blocks.flatMap((block) => boundaryToPoints(block.boundaryGeojson));
    if (estatePoint) points.push(estatePoint);
    if (points.length > 1) {
      map.fitBounds(points.map((point) => [point.latitude, point.longitude]) as LatLngBoundsExpression, { padding: [24, 24], maxZoom: 18 });
    } else if (points[0]) map.setView([points[0].latitude, points[0].longitude], 17);
  }, [blocks, estatePoint, map]);
  return null;
}

export default function EstateBlockMap({ estatePoint, blocks, editable = false, onBoundaryChange }: Props) {
  const [activeBlockId, setActiveBlockId] = useState(blocks[0]?.id ?? "");
  const [drawing, setDrawing] = useState(false);
  const activeBlock = blocks.find((block) => block.id === activeBlockId);
  const [draft, setDraft] = useState<EstateMapPoint[]>([]);
  const center = useMemo<LatLngExpression>(() => {
    const fromBoundary = boundaryCenter(activeBlock?.boundaryGeojson);
    return estatePoint ? [estatePoint.latitude, estatePoint.longitude] : fromBoundary ? [fromBoundary.latitude, fromBoundary.longitude] : [6.9271, 79.8612];
  }, [activeBlock?.boundaryGeojson, estatePoint]);

  useEffect(() => { setDraft(boundaryToPoints(activeBlock?.boundaryGeojson)); setDrawing(false); }, [activeBlockId, activeBlock?.boundaryGeojson]);
  useEffect(() => { if (activeBlockId && !blocks.some((block) => block.id === activeBlockId)) setActiveBlockId(blocks[0]?.id ?? ""); }, [activeBlockId, blocks]);

  const saveDraft = () => {
    if (!activeBlock || !onBoundaryChange) return;
    const boundary = pointsToBoundary(draft);
    if (!boundary) return;
    onBoundaryChange(activeBlock.id, boundary, Number(calculatePolygonAreaHa(draft).toFixed(4)));
    setDrawing(false);
  };
  const clear = () => {
    if (!activeBlock || !onBoundaryChange) return;
    setDraft([]); onBoundaryChange(activeBlock.id, undefined, activeBlock.areaHa); setDrawing(false);
  };

  return <div className="rounded-2xl border border-slate-200 bg-white p-3">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-sm font-bold text-slate-800">GPS block map · වතු කොටස් සිතියම</p><p className="text-[11px] text-slate-500">OpenStreetMap මත සීමා ලකුණු කරන්න. Area is an operational estimate, not a legal survey.</p></div>
      {editable && <select value={activeBlockId} onChange={(event) => setActiveBlockId(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><option value="">— Select block —</option>{blocks.map((block) => <option key={block.id} value={block.id}>{block.name}</option>)}</select>}
    </div>
    {editable && <div className="mb-3 flex flex-wrap gap-2">
      <button type="button" disabled={!activeBlock} onClick={() => { setDraft(boundaryToPoints(activeBlock?.boundaryGeojson)); setDrawing(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><MapPinned className="h-3.5 w-3.5" />{draft.length ? "Edit boundary" : "Draw boundary"}</button>
      <button type="button" disabled={!drawing || !draft.length} onClick={() => setDraft((points) => points.slice(0, -1))} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40"><Undo2 className="h-3.5 w-3.5" />Undo point</button>
      <button type="button" disabled={!drawing || draft.length < 3} onClick={saveDraft} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-40"><LocateFixed className="h-3.5 w-3.5" />Finish · {calculatePolygonAreaHa(draft).toFixed(3)} ha</button>
      <button type="button" disabled={!activeBlock || (!draft.length && !activeBlock.boundaryGeojson)} onClick={clear} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />Clear</button>
      {drawing && <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><RotateCcw className="h-3.5 w-3.5" />Map එක මත අවම ලකුණු 3ක් ඔබන්න</span>}
    </div>}
    {!blocks.length ? <div className="rounded-xl bg-slate-50 px-4 py-10 text-center text-xs text-slate-500">Add an estate block before drawing its boundary.</div> : <div className="h-[360px] overflow-hidden rounded-xl border border-slate-200">
      <MapContainer center={center} zoom={17} scrollWheelZoom className="h-full w-full">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitMap estatePoint={estatePoint} blocks={blocks} />
        <ClickCapture enabled={editable && drawing && Boolean(activeBlock)} onPoint={(point) => setDraft((points) => [...points, point])} />
        {estatePoint && <CircleMarker center={[estatePoint.latitude, estatePoint.longitude]} radius={7} pathOptions={{ color: "#0f172a", fillColor: "#f8fafc", fillOpacity: 1 }}><Popup>Estate GPS reference point</Popup></CircleMarker>}
        {blocks.map((block) => {
          const points = block.id === activeBlockId && drawing ? draft : boundaryToPoints(block.boundaryGeojson);
          if (points.length < 3) return null;
          const positions = points.map((point) => [point.latitude, point.longitude] as LatLngExpression);
          const color = COLORS[block.landType ?? "tea"];
          return <Polygon key={block.id} positions={positions} pathOptions={{ color, weight: block.id === activeBlockId ? 4 : 2, fillColor: color, fillOpacity: 0.24 }}><Popup><b>{block.name}</b><br />{block.areaHa.toFixed(3)} ha · {block.landType ?? "tea"}<br />{block.status ?? "active"}</Popup></Polygon>;
        })}
        {drawing && draft.map((point, index) => <CircleMarker key={`${point.latitude}-${point.longitude}-${index}`} center={[point.latitude, point.longitude]} radius={5} pathOptions={{ color: "#047857", fillColor: "#10b981", fillOpacity: 1 }} />)}
      </MapContainer>
    </div>}
  </div>;
}
