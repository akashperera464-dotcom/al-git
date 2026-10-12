import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Radio, Truck } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import {
  readLatestLorryLocation,
  readUserOperationalProfile,
  subscribeToLorryLocation,
  type LorryLocation,
} from "@/lib/supplierOperations";

interface LeafletMapInstance {
  setView(center: [number, number], zoom: number): LeafletMapInstance;
  remove(): void;
}

interface LeafletMarkerInstance {
  addTo(map: LeafletMapInstance): LeafletMarkerInstance;
  bindPopup(content: string): LeafletMarkerInstance;
  setLatLng(position: [number, number]): LeafletMarkerInstance;
}

interface LeafletApi {
  map(element: HTMLElement, options?: Record<string, unknown>): LeafletMapInstance;
  tileLayer(url: string, options?: Record<string, unknown>): { addTo(map: LeafletMapInstance): void };
  marker(position: [number, number]): LeafletMarkerInstance;
}

declare global {
  interface Window {
    L?: LeafletApi;
    __verdaLeafletLoader?: Promise<LeafletApi>;
  }
}

const LEAFLET_VERSION = "1.9.4";

function loadLeaflet(): Promise<LeafletApi> {
  if (window.L) return Promise.resolve(window.L);
  if (window.__verdaLeafletLoader) return window.__verdaLeafletLoader;

  window.__verdaLeafletLoader = new Promise<LeafletApi>((resolve, reject) => {
    if (!document.querySelector('link[data-verda-leaflet="true"]')) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
      stylesheet.dataset.verdaLeaflet = "true";
      document.head.appendChild(stylesheet);
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-verda-leaflet="true"]');
    const finish = () => window.L ? resolve(window.L) : reject(new Error("Leaflet did not initialize."));
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("Leaflet could not be loaded.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
    script.async = true;
    script.dataset.verdaLeaflet = "true";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Leaflet could not be loaded.")), { once: true });
    document.head.appendChild(script);
  });

  return window.__verdaLeafletLoader;
}

/**
 * Live supplier-facing collection-lorry map.
 * Supabase Realtime streams route-scoped `lorry_locations` updates; Leaflet
 * renders those coordinates over OpenStreetMap without exposing another route.
 */
export function LorryTracking({ userId }: { userId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const markerRef = useRef<LeafletMarkerInstance | null>(null);
  const leafletRef = useRef<LeafletApi | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [location, setLocation] = useState<LorryLocation | null>(null);
  const [routeName, setRouteName] = useState("");
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void loadLeaflet()
      .then((leaflet) => {
        if (!active || !containerRef.current || mapRef.current) return;
        leafletRef.current = leaflet;
        const map = leaflet.map(containerRef.current, { zoomControl: true }).setView([7.8731, 80.7718], 7);
        leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);
        mapRef.current = map;
        setMapReady(true);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Could not load the map."));

    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !location || !mapRef.current || !leafletRef.current) return;
    const point: [number, number] = [location.latitude, location.longitude];
    mapRef.current.setView(point, 15);
    if (markerRef.current) {
      markerRef.current.setLatLng(point);
    } else {
      markerRef.current = leafletRef.current.marker(point).addTo(mapRef.current).bindPopup("Live collection lorry");
    }
  }, [location, mapReady]);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    setError("");
    setLocation(null);
    void readUserOperationalProfile(userId)
      .then(async (profile) => {
        if (!active) return;
        if (!profile?.routeId) {
          setRouteName("");
          return;
        }
        setRouteName(profile.routeName ?? "Assigned route");
        const latest = await readLatestLorryLocation(profile.routeId);
        if (active) setLocation(latest);
        unsubscribe = subscribeToLorryLocation(profile.routeId, (next) => active && setLocation(next));
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Could not load lorry tracking."));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  const minutesOld = useMemo(
    () => location ? Math.max(0, Math.floor((clock - new Date(location.updatedAt).getTime()) / 60_000)) : null,
    [clock, location],
  );
  const live = Boolean(location?.active) && minutesOld !== null && minutesOld <= 5;

  return (
    <Card className="mb-4 overflow-hidden border-sky-200">
      <div className="flex items-center justify-between gap-3 p-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><Truck className="h-4 w-4" /></span>
          <div>
            <p className="text-sm font-bold text-slate-800">Live collection lorry</p>
            <p className="text-[11px] text-slate-500">{routeName || "No route assigned"} · Leaflet map</p>
          </div>
        </div>
        {location && <Badge tone={live ? "emerald" : "amber"} dot>{live ? "Live" : !location.active ? "Stopped" : `${minutesOld} min ago`}</Badge>}
      </div>

      <div ref={containerRef} className="h-52 w-full bg-slate-100" aria-label="Realtime collection lorry map" />

      {error && <p className="px-3.5 py-2 text-xs text-rose-600">{error}</p>}
      {!error && !location && <p className="px-3.5 py-2 text-xs text-slate-500"><MapPin className="mr-1 inline h-3 w-3" />The driver has not published a location for this route yet.</p>}
      {location && (
        <div className="flex items-center gap-1.5 bg-sky-50 px-3.5 py-2 text-[11px] text-sky-700">
          <Radio className="h-3 w-3" />{location.active ? "Supabase Realtime" : "Last known position"} · GPS accuracy {Math.round(location.accuracyM ?? 0)} m · updated {new Date(location.updatedAt).toLocaleTimeString()}
        </div>
      )}
    </Card>
  );
}

export default LorryTracking;
