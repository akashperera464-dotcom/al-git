import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Polygon, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { Footprints, LocateFixed, MapPinned, Pause, Play, RotateCcw, Square, Trash2, Undo2, X } from "lucide-react";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  boundaryCenter, boundaryToPoints, calculatePolygonAreaHa, pointsToBoundary,
  type EstateBlockBoundary, type EstateLandType, type EstateMapPoint,
} from "@/lib/estateMap";
import {
  boundaryWalkDistanceM, DEFAULT_BOUNDARY_WALK_OPTIONS, samplesToEstatePoints,
  isUsableBoundarySample, shouldRecordBoundarySample, type BoundaryGpsSample,
} from "@/lib/estateBoundaryWalk";

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

type WalkState = "idle" | "recording" | "paused";
interface WakeLockHandle { release: () => Promise<void> }

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

function FollowWalkPoint({ point, enabled }: { point?: EstateMapPoint; enabled: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (enabled && point) map.panTo([point.latitude, point.longitude], { animate: true });
  }, [enabled, map, point]);
  return null;
}

function readWalkDraft(key: string): BoundaryGpsSample[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) ?? "[]") as BoundaryGpsSample[];
    return Array.isArray(parsed) ? parsed.filter((sample) =>
      Number.isFinite(sample?.latitude) && Number.isFinite(sample?.longitude) &&
      Number.isFinite(sample?.accuracyM) && Number.isFinite(sample?.recordedAt)) : [];
  } catch { return []; }
}

function storeWalkDraft(key: string, samples: BoundaryGpsSample[]) {
  try {
    if (samples.length) sessionStorage.setItem(key, JSON.stringify(samples));
    else sessionStorage.removeItem(key);
  } catch { /* Session recovery is best-effort only. */ }
}

export default function EstateBlockMap({ estatePoint, blocks, editable = false, onBoundaryChange }: Props) {
  const [activeBlockId, setActiveBlockId] = useState(blocks[0]?.id ?? "");
  const [drawing, setDrawing] = useState(false);
  const activeBlock = blocks.find((block) => block.id === activeBlockId);
  const [draft, setDraft] = useState<EstateMapPoint[]>([]);
  const [walkState, setWalkState] = useState<WalkState>("idle");
  const [walkSamples, setWalkSamples] = useState<BoundaryGpsSample[]>([]);
  const [gpsAccuracyM, setGpsAccuracyM] = useState<number>();
  const [liveGpsPoint, setLiveGpsPoint] = useState<BoundaryGpsSample>();
  const [gpsStarting, setGpsStarting] = useState(false);
  const [walkMessage, setWalkMessage] = useState("");
  const watchIdRef = useRef<number | undefined>(undefined);
  const wakeLockRef = useRef<WakeLockHandle | undefined>(undefined);
  const walkSamplesRef = useRef<BoundaryGpsSample[]>([]);
  const walkOriginalRef = useRef<EstateMapPoint[]>([]);

  const center = useMemo<LatLngExpression>(() => {
    const fromBoundary = boundaryCenter(activeBlock?.boundaryGeojson);
    return estatePoint ? [estatePoint.latitude, estatePoint.longitude] : fromBoundary ? [fromBoundary.latitude, fromBoundary.longitude] : [6.9271, 79.8612];
  }, [activeBlock?.boundaryGeojson, estatePoint]);
  const walkStorageKey = useMemo(() => {
    const reference = estatePoint ? `${estatePoint.latitude.toFixed(5)}:${estatePoint.longitude.toFixed(5)}` : "no-estate-point";
    return `kdu.estate-boundary-walk.v1:${activeBlockId}:${reference}`;
  }, [activeBlockId, estatePoint]);

  const releaseWakeLock = useCallback(() => {
    const lock = wakeLockRef.current;
    wakeLockRef.current = undefined;
    if (lock) void lock.release().catch(() => undefined);
  }, []);
  const stopGpsWatch = useCallback(() => {
    if (watchIdRef.current !== undefined && "geolocation" in navigator) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = undefined;
    releaseWakeLock();
  }, [releaseWakeLock]);
  const requestWakeLock = useCallback(async () => {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLockHandle> } }).wakeLock;
    if (!wakeLock) return;
    try { wakeLockRef.current = await wakeLock.request("screen"); } catch { /* Unsupported or denied; GPS remains usable. */ }
  }, []);

  const startGpsWatch = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setWalkState("paused");
      setWalkMessage("This device/browser does not provide GPS location.");
      return;
    }
    stopGpsWatch();
    void requestWakeLock();
    setWalkMessage(walkSamplesRef.current.length
      ? `${walkSamplesRef.current.length} GPS point recorded · boundary එක වටා අවම මීටර් ${DEFAULT_BOUNDARY_WALK_OPTIONS.minDistanceM} බැගින් ඇවිදින්න.`
      : "GPS signal එක ලැබෙන තුරු එළිමහනේ මඳක් රැඳී සිටින්න…");
    watchIdRef.current = navigator.geolocation.watchPosition((position) => {
      const sample: BoundaryGpsSample = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyM: position.coords.accuracy,
        recordedAt: position.timestamp || Date.now(),
      };
      setLiveGpsPoint(sample);
      setGpsAccuracyM(sample.accuracyM);
      const previous = walkSamplesRef.current.at(-1);
      if (!shouldRecordBoundarySample(previous, sample)) {
        if (sample.accuracyM > DEFAULT_BOUNDARY_WALK_OPTIONS.maxAccuracyM) {
          setWalkMessage(`GPS accuracy ±${Math.round(sample.accuracyM)} m — signal එක හොඳ වන තුරු මේ point එක නොගත්තෙමු.`);
        }
        return;
      }
      const next = [...walkSamplesRef.current, sample];
      walkSamplesRef.current = next;
      setWalkSamples(next);
      setDraft(samplesToEstatePoints(next));
      storeWalkDraft(walkStorageKey, next);
      setWalkMessage(`${next.length} GPS points recorded · minimum spacing ${DEFAULT_BOUNDARY_WALK_OPTIONS.minDistanceM} m`);
    }, (error) => {
      stopGpsWatch();
      const hasRecordedPoints = walkSamplesRef.current.length > 0;
      setWalkState(error.code === error.PERMISSION_DENIED && !hasRecordedPoints ? "idle" : "paused");
      if (error.code === error.PERMISSION_DENIED && !hasRecordedPoints) {
        setDraft(walkOriginalRef.current);
      }
      const message = error.code === error.PERMISSION_DENIED
        ? "Location permission denied. Phone/website Settings වලින් location access allow කරන්න. Manual Draw on map තවම භාවිත කළ හැක."
        : error.code === error.POSITION_UNAVAILABLE
          ? "GPS location unavailable. එළිමහනකට ගොස් Resume කරන්න."
          : "GPS response timed out. Resume කර නැවත උත්සාහ කරන්න.";
      setWalkMessage(message);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
  }, [requestWakeLock, stopGpsWatch, walkStorageKey]);

  useEffect(() => {
    if (!activeBlockId && blocks[0]) setActiveBlockId(blocks[0].id);
    else if (activeBlockId && !blocks.some((block) => block.id === activeBlockId)) setActiveBlockId(blocks[0]?.id ?? "");
  }, [activeBlockId, blocks]);

  useEffect(() => {
    stopGpsWatch();
    const savedBoundary = boundaryToPoints(activeBlock?.boundaryGeojson);
    walkOriginalRef.current = savedBoundary;
    const recovered = activeBlockId ? readWalkDraft(walkStorageKey) : [];
    walkSamplesRef.current = recovered;
    setWalkSamples(recovered);
    setDraft(recovered.length ? samplesToEstatePoints(recovered) : savedBoundary);
    setWalkState(recovered.length ? "paused" : "idle");
    setWalkMessage(recovered.length ? `Recovered ${recovered.length} unsaved GPS points. Resume or cancel the walk.` : "");
    setLiveGpsPoint(undefined);
    setGpsStarting(false);
    setDrawing(false);
  }, [activeBlock?.boundaryGeojson, activeBlockId, stopGpsWatch, walkStorageKey]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && walkState === "recording") {
        stopGpsWatch();
        setWalkState("paused");
        setWalkMessage("App එක background වූ නිසා GPS recording pause කළා. App එක නැවත විවෘත කර Resume කරන්න.");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [stopGpsWatch, walkState]);
  useEffect(() => () => stopGpsWatch(), [stopGpsWatch]);

  const saveDraft = () => {
    if (!activeBlock || !onBoundaryChange) return;
    const boundary = pointsToBoundary(draft);
    if (!boundary) return;
    onBoundaryChange(activeBlock.id, boundary, Number(calculatePolygonAreaHa(draft).toFixed(4)));
    setDrawing(false);
  };
  const beginWalk = () => {
    if (!activeBlock) return;
    if (!window.isSecureContext) {
      setWalkMessage("GPS walking requires the secure HTTPS app. Manual Draw on map can still be used anywhere.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setWalkMessage("This browser does not provide GPS. Manual Draw on map can still be used anywhere.");
      return;
    }
    setGpsStarting(true);
    setWalkMessage("Checking current phone GPS and location permission…");
    navigator.geolocation.getCurrentPosition((position) => {
      const firstSample: BoundaryGpsSample = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyM: position.coords.accuracy,
        recordedAt: position.timestamp || Date.now(),
      };
      const initialSamples = isUsableBoundarySample(firstSample) ? [firstSample] : [];
      walkOriginalRef.current = boundaryToPoints(activeBlock.boundaryGeojson);
      walkSamplesRef.current = initialSamples;
      setWalkSamples(initialSamples);
      setDraft(samplesToEstatePoints(initialSamples));
      setLiveGpsPoint(firstSample);
      setGpsAccuracyM(firstSample.accuracyM);
      storeWalkDraft(walkStorageKey, initialSamples);
      setDrawing(false);
      setGpsStarting(false);
      setWalkState("recording");
      setWalkMessage(initialSamples.length
        ? "Current location found · 1 GPS point recorded. දැන් boundary එක වටා ඇවිදින්න."
        : `Current location found, but accuracy is ±${Math.round(firstSample.accuracyM)} m. Better signal එකක් ලැබෙන තුරු රැඳී සිටින්න.`);
      startGpsWatch();
    }, (error) => {
      setGpsStarting(false);
      setWalkState("idle");
      const message = error.code === error.PERMISSION_DENIED
        ? "Location permission denied for this website/app. Permission allow කර නැවත උත්සාහ කරන්න. Manual Draw on map තවම වැඩ කරයි."
        : error.code === error.POSITION_UNAVAILABLE
          ? "Current GPS location unavailable. එළිමහනකට ගොස් නැවත උත්සාහ කරන්න, නැත්නම් Manual Draw on map භාවිත කරන්න."
          : "GPS request timed out. නැවත උත්සාහ කරන්න, නැත්නම් Manual Draw on map භාවිත කරන්න.";
      setWalkMessage(message);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
  };
  const pauseWalk = () => {
    stopGpsWatch();
    setWalkState("paused");
    setWalkMessage("Recording paused. එම ස්ථානයේ සිට Resume කරන්න.");
  };
  const resumeWalk = () => { setWalkState("recording"); startGpsWatch(); };
  const cancelWalk = () => {
    stopGpsWatch();
    storeWalkDraft(walkStorageKey, []);
    walkSamplesRef.current = [];
    setWalkSamples([]);
    setDraft(walkOriginalRef.current);
    setWalkState("idle");
    setWalkMessage("");
    setGpsAccuracyM(undefined);
    setLiveGpsPoint(undefined);
    setGpsStarting(false);
  };
  const finishWalk = () => {
    if (!activeBlock || !onBoundaryChange) return;
    const points = samplesToEstatePoints(walkSamplesRef.current);
    const boundary = pointsToBoundary(points);
    if (!boundary) {
      setWalkMessage("Boundary එක finish කිරීමට GPS points අවම 3ක් අවශ්‍යයි.");
      return;
    }
    stopGpsWatch();
    onBoundaryChange(activeBlock.id, boundary, Number(calculatePolygonAreaHa(points).toFixed(4)));
    storeWalkDraft(walkStorageKey, []);
    setWalkState("idle");
    setWalkMessage("Boundary prepared. දැන් estate form එකේ Save changes / Submit request ඔබන්න.");
    setLiveGpsPoint(undefined);
  };
  const clear = () => {
    if (!activeBlock || !onBoundaryChange) return;
    stopGpsWatch();
    storeWalkDraft(walkStorageKey, []);
    walkSamplesRef.current = [];
    setWalkSamples([]);
    setDraft([]);
    onBoundaryChange(activeBlock.id, undefined, activeBlock.areaHa);
    setDrawing(false);
    setWalkState("idle");
    setWalkMessage("");
    setLiveGpsPoint(undefined);
    setGpsStarting(false);
  };

  const walkAreaHa = calculatePolygonAreaHa(samplesToEstatePoints(walkSamples));
  const walkDistanceM = boundaryWalkDistanceM(walkSamples);

  return <div className="rounded-2xl border border-slate-200 bg-white p-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><MapPinned className="h-4 w-4 text-emerald-600" />Estate block GPS map</div>
        <p className="mt-1 text-xs leading-5 text-slate-500">Operational field map only — phone GPS is not a legal land survey.</p>
        {editable && <p className="mt-1 text-[11px] leading-5 text-sky-700"><b>Not at the estate?</b> Select the place and use Draw on map. <b>At the estate?</b> Walk boundary uses your live phone GPS.</p>}
      </div>
      {editable && <select disabled={walkState !== "idle" || gpsStarting} value={activeBlockId} onChange={(event) => setActiveBlockId(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"><option value="">— Select block —</option>{blocks.map((block) => <option key={block.id} value={block.id}>{block.name}</option>)}</select>}
    </div>
    {editable && <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={!activeBlock || walkState !== "idle" || gpsStarting} onClick={() => { setDraft(boundaryToPoints(activeBlock?.boundaryGeojson)); setDrawing(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><MapPinned className="h-3.5 w-3.5" />{draft.length ? "Edit on map" : "Draw on map"}</button>
      <button type="button" disabled={!activeBlock || drawing || walkState !== "idle" || gpsStarting} onClick={beginWalk} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Footprints className={`h-3.5 w-3.5 ${gpsStarting ? "animate-pulse" : ""}`} />{gpsStarting ? "Starting current GPS…" : "Walk boundary with current GPS"}</button>
      <button type="button" disabled={!drawing || !draft.length} onClick={() => setDraft((points) => points.slice(0, -1))} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40"><Undo2 className="h-3.5 w-3.5" />Undo point</button>
      <button type="button" disabled={!drawing || draft.length < 3} onClick={saveDraft} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-40"><LocateFixed className="h-3.5 w-3.5" />Finish · {calculatePolygonAreaHa(draft).toFixed(3)} ha</button>
      <button type="button" disabled={!activeBlock || (!draft.length && !activeBlock.boundaryGeojson)} onClick={clear} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />Clear</button>
      {drawing && <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><RotateCcw className="h-3.5 w-3.5" />Map එක මත අවම ලකුණු 3ක් ඔබන්න</span>}
    </div>}

    {editable && walkState !== "idle" && <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-sky-900"><span className={`h-2.5 w-2.5 rounded-full ${walkState === "recording" ? "animate-pulse bg-rose-500" : "bg-amber-500"}`} />{walkState === "recording" ? "GPS boundary recording" : "GPS boundary paused"}</div>
          <p className="mt-1 text-xs leading-5 text-sky-800">Phone එක block boundary එක වටා රැගෙන යන්න. Screen එක open තබන්න.</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700 sm:grid-cols-4">
          <span><b>{walkSamples.length}</b> points</span><span><b>{walkDistanceM.toFixed(0)}</b> m walked</span>
          <span><b>{walkAreaHa.toFixed(3)}</b> ha</span><span><b>{gpsAccuracyM ? `±${Math.round(gpsAccuracyM)} m` : "—"}</b> accuracy</span>
        </div>
      </div>
      <p className="mt-2 text-xs font-medium text-sky-800">{walkMessage}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {walkState === "recording" ? <button type="button" onClick={pauseWalk} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-700"><Pause className="h-3.5 w-3.5" />Pause</button> : <button type="button" onClick={resumeWalk} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white"><Play className="h-3.5 w-3.5" />Resume</button>}
        <button type="button" disabled={walkSamples.length < 3} onClick={finishWalk} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Square className="h-3.5 w-3.5" />Finish boundary</button>
        <button type="button" onClick={cancelWalk} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600"><X className="h-3.5 w-3.5" />Cancel</button>
      </div>
    </div>}
    {editable && walkState === "idle" && walkMessage && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{walkMessage}</div>}

    {!blocks.length ? <div className="mt-3 rounded-xl bg-slate-50 px-4 py-10 text-center text-xs text-slate-500">Add an estate block before drawing or walking its boundary.</div> : <div className="mt-3 h-[360px] overflow-hidden rounded-xl border border-slate-200">
      <MapContainer center={center} zoom={17} scrollWheelZoom className="h-full w-full">
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitMap estatePoint={estatePoint} blocks={blocks} />
        <FollowWalkPoint point={liveGpsPoint} enabled={walkState === "recording"} />
        <ClickCapture enabled={editable && drawing && walkState === "idle" && Boolean(activeBlock)} onPoint={(point) => setDraft((points) => [...points, point])} />
        {estatePoint && <CircleMarker center={[estatePoint.latitude, estatePoint.longitude]} radius={7} pathOptions={{ color: "#0f172a", fillColor: "#f8fafc", fillOpacity: 1 }}><Popup>Estate GPS reference point</Popup></CircleMarker>}
        {walkSamples.length > 1 && <Polyline positions={walkSamples.map((point) => [point.latitude, point.longitude] as LatLngExpression)} pathOptions={{ color: "#0284c7", weight: 4, dashArray: "8 6" }} />}
        {liveGpsPoint && walkState !== "idle" && <CircleMarker center={[liveGpsPoint.latitude, liveGpsPoint.longitude]} radius={8} pathOptions={{ color: "#0369a1", fillColor: "#38bdf8", fillOpacity: 1 }}><Popup>Current GPS point · ±{Math.round(liveGpsPoint.accuracyM)} m</Popup></CircleMarker>}
        {blocks.map((block) => {
          const showDraft = block.id === activeBlockId && (drawing || walkState !== "idle");
          const points = showDraft ? draft : boundaryToPoints(block.boundaryGeojson);
          if (points.length < 3) return null;
          const positions = points.map((point) => [point.latitude, point.longitude] as LatLngExpression);
          const color = COLORS[block.landType ?? "tea"];
          return <Polygon key={block.id} positions={positions} pathOptions={{ color, weight: block.id === activeBlockId ? 4 : 2, fillColor: color, fillOpacity: 0.2 }}><Popup><b>{block.name}</b><br />{block.landType ?? "tea"} · {block.areaHa.toFixed(3)} ha</Popup></Polygon>;
        })}
      </MapContainer>
    </div>}
  </div>;
}
