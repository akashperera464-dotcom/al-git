import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Radio, Truck } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { EtaBanner } from "@/components/EtaBanner";
import { calculateEta } from "@/lib/etaCalculation";
import { readMyEstates } from "@/lib/estateRepo";
import { readLatestLorryLocation, readUserOperationalProfile, subscribeToLorryLocation, type LorryLocation } from "@/lib/supplierOperations";

function Follow({ location }: { location: LorryLocation }) {
  const map = useMap();
  useEffect(() => { map.setView([location.latitude, location.longitude], 15); }, [location, map]);
  return null;
}

/** Route-scoped Supabase Realtime map using bundled Leaflet (no CDN). */
export function LorryTracking({ userId }: { userId: string }) {
  const [location, setLocation] = useState<LorryLocation | null>(null);
  const [routeName, setRouteName] = useState("");
  const [routeCode, setRouteCode] = useState("");
  const [estatePoint, setEstatePoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 60_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    setError(""); setLocation(null);
    void Promise.all([readUserOperationalProfile(userId), readMyEstates(userId)]).then(async ([profile, estates]) => {
      if (!active) return;
      const estate = estates.find((item) => item.latitude != null && item.longitude != null);
      if (estate?.latitude != null && estate.longitude != null) setEstatePoint({ latitude: estate.latitude, longitude: estate.longitude });
      if (!profile?.routeId) { setRouteName(""); return; }
      setRouteName(profile.routeName ?? "Assigned route"); setRouteCode(profile.routeCode ?? "");
      const latest = await readLatestLorryLocation(profile.routeId);
      if (active) setLocation(latest);
      unsubscribe = subscribeToLorryLocation(profile.routeId, (next) => active && setLocation(next));
    }).catch((reason) => active && setError(reason instanceof Error ? reason.message : "Could not load lorry tracking."));
    return () => { active = false; unsubscribe(); };
  }, [userId]);

  const minutesOld = useMemo(() => location ? Math.max(0, Math.floor((clock - new Date(location.updatedAt).getTime()) / 60_000)) : null, [clock, location]);
  const live = Boolean(location?.active) && minutesOld !== null && minutesOld <= 5;
  const eta = useMemo(() => location && estatePoint ? calculateEta(location, estatePoint) : null, [location, estatePoint]);

  return <Card className="mb-4 overflow-hidden border-sky-200">
    <div className="flex items-center justify-between gap-3 p-3.5"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><Truck className="h-4 w-4" /></span><div><p className="text-sm font-bold text-slate-800">Live collection lorry</p><p className="text-[11px] text-slate-500">{routeCode && <b>{routeCode} · </b>}{routeName || "No route assigned"}</p></div></div>{location && <Badge tone={live ? "emerald" : "amber"} dot>{live ? "Live" : !location.active ? "Stopped" : `${minutesOld} min ago`}</Badge>}</div>
    {eta && <EtaBanner eta={eta} />}
    <div className="h-52 w-full bg-slate-100">
      {location ? <MapContainer center={[location.latitude, location.longitude]} zoom={15} className="h-full w-full" scrollWheelZoom={false}><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><CircleMarker center={[location.latitude, location.longitude]} radius={10} pathOptions={{ color: "#0284c7", fillOpacity: 0.9 }}><Popup>Live collection lorry</Popup></CircleMarker>{estatePoint && <CircleMarker center={[estatePoint.latitude, estatePoint.longitude]} radius={8} pathOptions={{ color: "#059669", fillOpacity: 0.8 }}><Popup>Your collection point</Popup></CircleMarker>}<Follow location={location} /></MapContainer> : <div className="flex h-full items-center justify-center text-xs text-slate-400"><MapPin className="mr-1 h-4 w-4" />Waiting for route GPS…</div>}
    </div>
    {error && <p className="px-3.5 py-2 text-xs text-rose-600">{error}</p>}
    {!error && !location && <p className="px-3.5 py-2 text-xs text-slate-500">The driver has not published a location for this route yet.</p>}
    {location && <div className="flex items-center gap-1.5 bg-sky-50 px-3.5 py-2 text-[11px] text-sky-700"><Radio className="h-3 w-3" />{location.active ? "Supabase Realtime" : "Last known position"} · GPS accuracy {Math.round(location.accuracyM ?? 0)} m · updated {new Date(location.updatedAt).toLocaleTimeString()}</div>}
  </Card>;
}

export default LorryTracking;
