import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { latLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Radio, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, Card } from "@/components/ui";
import { AiEstateInsights } from "@/components/AiEstateInsights";
import { EtaBanner } from "@/components/EtaBanner";
import { calculateEta, DEFAULT_RURAL_SPEED_KMH, isValidGeoPoint } from "@/lib/etaCalculation";
import { readMyEstates } from "@/lib/estateRepo";
import { AI_ADVISORY_DISTANCE_KM, requestProximityAdvisory, type ProximityAdvisory } from "@/lib/openRouterAdvisory";
import { readUserOperationalProfile } from "@/lib/supplierOperations";
import { subscribeToLorryLocation, type LorryChannelStatus, type LorryLocation } from "@/lib/lorryBroadcast";

interface EstatePoint { id: string; name: string; latitude: number; longitude: number }

function FollowTracking({ location, estate }: { location: LorryLocation; estate: EstatePoint | null }) {
  const map = useMap();
  useEffect(() => {
    if (estate) {
      map.fitBounds(latLngBounds([location.latitude, location.longitude], [estate.latitude, estate.longitude]), { padding: [28, 28], maxZoom: 16 });
    } else {
      map.setView([location.latitude, location.longitude], 15);
    }
  }, [estate, location, map]);
  return null;
}

/** Private route-scoped WebSocket map. GPS coordinates are never persisted. */
export function LorryTracking({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const [location, setLocation] = useState<LorryLocation | null>(null);
  const [routeId, setRouteId] = useState("");
  const [routeName, setRouteName] = useState("");
  const [routeCode, setRouteCode] = useState("");
  const [estatePoint, setEstatePoint] = useState<EstatePoint | null>(null);
  const [channelStatus, setChannelStatus] = useState<LorryChannelStatus>("connecting");
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const [advisory, setAdvisory] = useState<ProximityAdvisory | null>(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const advisoryScopeRef = useRef("");

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    setError(""); setLocation(null); setChannelStatus("connecting");
    void Promise.all([readUserOperationalProfile(userId), readMyEstates(userId)]).then(([profile, estates]) => {
      if (!active) return;
      const estate = estates.find((item) => item.latitude != null && item.longitude != null
        && isValidGeoPoint({ latitude: item.latitude, longitude: item.longitude }));
      setEstatePoint(estate?.latitude != null && estate.longitude != null
        ? { id: estate.id, name: estate.name, latitude: estate.latitude, longitude: estate.longitude }
        : null);
      if (!profile?.routeId) {
        setRouteId(""); setRouteName(""); setChannelStatus("stopped");
        return;
      }
      setRouteId(profile.routeId);
      setRouteName(profile.routeName ?? t("lorry.assignedRoute"));
      setRouteCode(profile.routeCode ?? "");
      unsubscribe = subscribeToLorryLocation(profile.routeId, (next) => active && setLocation(next), (status, message) => {
        if (!active) return;
        setChannelStatus(status);
        if (status === "error") setError(message ?? t("lorry.trackingUnavailable"));
        else setError("");
      });
    }).catch((reason) => active && setError(reason instanceof Error ? reason.message : t("lorry.trackingUnavailable")));
    return () => { active = false; unsubscribe(); };
  }, [t, userId]);

  const minutesOld = useMemo(() => location ? Math.max(0, Math.floor((clock - new Date(location.updatedAt).getTime()) / 60_000)) : null, [clock, location]);
  const live = channelStatus === "live" && Boolean(location?.active) && minutesOld !== null && minutesOld <= 2;
  // `location` changes for every route Broadcast packet, so this memo performs
  // an immediate, frontend-only Haversine + ETA recalculation with no query.
  const eta = useMemo(
    () => location && estatePoint ? calculateEta(location, estatePoint, DEFAULT_RURAL_SPEED_KMH) : null,
    [location, estatePoint],
  );

  useEffect(() => {
    if (!eta || !routeId || !estatePoint || eta.distanceKm >= AI_ADVISORY_DISTANCE_KM) {
      advisoryScopeRef.current = ""; setAdvisory(null); setAdvisoryLoading(false);
      return;
    }
    const scope = `${routeId}:${estatePoint.id}`;
    if (advisoryScopeRef.current === scope) return;
    advisoryScopeRef.current = scope;
    let active = true;
    setAdvisoryLoading(true);
    const resolved = (i18n.resolvedLanguage ?? i18n.language).split("-")[0];
    const language = resolved === "si" || resolved === "ta" ? resolved : "en";
    void requestProximityAdvisory({ routeId, estateId: estatePoint.id, distanceKm: eta.distanceKm, etaMinutes: eta.etaMinutes, language })
      .then((result) => { if (active) setAdvisory(result); })
      .finally(() => { if (active) setAdvisoryLoading(false); });
    return () => { active = false; };
  }, [estatePoint, eta, i18n.language, i18n.resolvedLanguage, routeId]);

  const statusLabel = channelStatus === "live" ? t("lorry.liveBroadcast")
    : channelStatus === "error" ? t("lorry.trackingUnavailable")
      : channelStatus === "stopped" ? t("lorry.stopped") : t("lorry.connecting");

  return <Card className="mb-4 overflow-hidden border-sky-200">
    <div className="flex items-center justify-between gap-3 p-3.5">
      <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><Truck className="h-4 w-4" /></span><div><p className="text-sm font-bold text-slate-800">{t("lorry.liveCollectionLorry")}</p><p className="text-[11px] text-slate-500">{routeCode && <b>{routeCode} · </b>}{routeName || t("lorry.noRoute")}</p></div></div>
      <Badge tone={live ? "emerald" : channelStatus === "error" ? "rose" : "amber"} dot>{live ? t("lorry.live") : location && !location.active ? t("lorry.stopped") : statusLabel}</Badge>
    </div>
    {eta && <EtaBanner eta={eta} />}
    <AiEstateInsights advisory={advisory} loading={advisoryLoading} />
    <div className="h-64 w-full bg-slate-100">
      {location ? <MapContainer center={[location.latitude, location.longitude]} zoom={15} className="h-full w-full" scrollWheelZoom={false}><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><CircleMarker center={[location.latitude, location.longitude]} radius={11} pathOptions={{ color: "#0369a1", fillColor: "#0ea5e9", fillOpacity: 0.95, weight: 3 }}><Popup>{t("lorry.lorryMarker")}</Popup></CircleMarker>{estatePoint && <CircleMarker center={[estatePoint.latitude, estatePoint.longitude]} radius={9} pathOptions={{ color: "#047857", fillColor: "#10b981", fillOpacity: 0.85, weight: 3 }}><Popup>{estatePoint.name} · {t("lorry.estatePoint")}</Popup></CircleMarker>}<FollowTracking location={location} estate={estatePoint} /></MapContainer> : <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-slate-400"><MapPin className="h-5 w-5" /><span>{routeId ? t("lorry.waiting") : t("lorry.noRoute")}</span></div>}
    </div>
    {error && <p className="px-3.5 py-2 text-xs text-rose-600">{error}</p>}
    {!error && !estatePoint && <p className="px-3.5 py-2 text-xs text-amber-700">{t("lorry.noEstateGps")}</p>}
    <div className="flex flex-wrap items-center justify-between gap-2 bg-sky-50 px-3.5 py-2 text-[11px] text-sky-700"><span className="flex items-center gap-1.5"><Radio className="h-3 w-3" />{statusLabel} · {t("lorry.databaseFree")}</span>{location && <span>{t("lorry.gpsAccuracy")}: {Math.round(location.accuracyM ?? 0)} m · {new Date(location.updatedAt).toLocaleTimeString()}</span>}</div>
  </Card>;
}

export default LorryTracking;
