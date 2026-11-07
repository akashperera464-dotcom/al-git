import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { latLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Eye, MapPin, Radio, RefreshCw, Truck, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge, Card } from "@/components/ui";
import { AiEstateInsights } from "@/components/AiEstateInsights";
import { EtaBanner } from "@/components/EtaBanner";
import { calculateEta, DEFAULT_RURAL_SPEED_KMH, isValidGeoPoint } from "@/lib/etaCalculation";
import { readMyEstates, type Estate } from "@/lib/estateRepo";
import { AI_ADVISORY_DISTANCE_KM, requestProximityAdvisory, type ProximityAdvisory } from "@/lib/openRouterAdvisory";
import { readUserOperationalProfile } from "@/lib/supplierOperations";
import { subscribeToLorryLocation, type LorryChannelStatus, type LorryLocation } from "@/lib/lorryBroadcast";
import { readUserRouteAssignments, type UserRouteAssignment } from "@/lib/userRoutes";
import { canUseLorryBroadcastFallback, fetchOfficeLorryWithMeta, isOfficeLorryDisabled, LORRY_REFRESH_COOLDOWN_SECONDS } from "@/lib/officeApi";

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
  const [routeOptions, setRouteOptions] = useState<UserRouteAssignment[]>([]);
  const [estates, setEstates] = useState<Estate[]>([]);
  const [channelStatus, setChannelStatus] = useState<LorryChannelStatus>("connecting");
  const [trackingSource, setTrackingSource] = useState<"office-api" | "realtime">("office-api");
  const [error, setError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(0);
  const [officeDisabled, setOfficeDisabled] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [advisory, setAdvisory] = useState<ProximityAdvisory | null>(null);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const advisoryScopeRef = useRef("");
  const requestInFlightRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const fallbackUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setError(""); setLocation(null); setChannelStatus("stopped");
    void Promise.all([readUserOperationalProfile(userId), readMyEstates(userId), readUserRouteAssignments(userId)]).then(([profile, estateRows, assignments]) => {
      if (!active) return;
      setEstates(estateRows);
      setRouteOptions(assignments);
      const preferred = assignments.find((route) => route.isPrimary) ?? assignments[0];
      const nextRouteId = preferred?.id ?? profile?.routeId ?? "";
      if (!nextRouteId) {
        setRouteId(""); setChannelStatus("stopped");
        return;
      }
      setRouteId((current) => assignments.some((route) => route.id === current) ? current : nextRouteId);
    }).catch((reason) => active && setError(reason instanceof Error ? reason.message : t("lorry.trackingUnavailable")));
    return () => { active = false; };
  }, [t, userId]);

  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const timer = window.setInterval(() => setRefreshCooldown((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [refreshCooldown]);

  const stopActiveRequest = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    fallbackUnsubscribeRef.current?.();
    fallbackUnsubscribeRef.current = null;
    requestInFlightRef.current = false;
    setRequesting(false);
  };

  const requestLocation = async (forceRefresh = false) => {
    if (!routeId || requestInFlightRef.current || document.visibilityState !== "visible") return;
    requestInFlightRef.current = true;
    setRequesting(true);
    setOfficeDisabled(false);
    setError("");
    setChannelStatus("connecting");
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    const signal = controllerRef.current.signal;

    try {
      const result = await fetchOfficeLorryWithMeta(routeId, { signal, forceRefresh });
      if (signal.aborted) return;
      const next = result.data;
      setTrackingSource("office-api");
      setChannelStatus("live");
      setError(result.error ?? "");
      setLocation({ id: `office:${routeId}:${next.fetchedAt}`, latitude: next.latitude, longitude: next.longitude, routeId, active: true, updatedAt: next.fetchedAt });
    } catch (reason) {
      if (signal.aborted || (reason instanceof DOMException && reason.name === "AbortError")) return;
      if (isOfficeLorryDisabled(reason)) {
        setOfficeDisabled(true);
        setChannelStatus("stopped");
        setError(t("lorry.disabledByAdmin"));
      } else if (canUseLorryBroadcastFallback(reason)) {
        setTrackingSource("realtime");
        fallbackUnsubscribeRef.current?.();
        fallbackUnsubscribeRef.current = subscribeToLorryLocation(routeId, (next) => setLocation(next), (status, message) => {
          setChannelStatus(status);
          if (status === "error") setError(message ?? t("lorry.trackingUnavailable"));
          else setError("");
        });
      } else {
        setChannelStatus("error");
        setError(reason instanceof Error ? reason.message : t("lorry.trackingUnavailable"));
      }
    } finally {
      if (!signal.aborted) {
        requestInFlightRef.current = false;
        setRequesting(false);
      }
    }
  };

  useEffect(() => {
    if (!mapOpen || !routeId) return;
    void requestLocation(false);
    return () => stopActiveRequest();
    // One request only when the user explicitly opens the map or changes route.
    // Automatic polling is intentionally prohibited to protect the Office API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapOpen, routeId]);

  useEffect(() => {
    const stopWhenHidden = () => { if (document.visibilityState !== "visible") stopActiveRequest(); };
    const stopOnPageHide = () => stopActiveRequest();
    document.addEventListener("visibilitychange", stopWhenHidden);
    window.addEventListener("pagehide", stopOnPageHide);
    return () => {
      stopActiveRequest();
      document.removeEventListener("visibilitychange", stopWhenHidden);
      window.removeEventListener("pagehide", stopOnPageHide);
    };
  }, []);

  const selectedRoute = routeOptions.find((route) => route.id === routeId);
  const estatePoint = useMemo<EstatePoint | null>(() => {
    const estate = estates.find((item) => item.routeId === routeId && item.latitude != null && item.longitude != null
      && isValidGeoPoint({ latitude: item.latitude, longitude: item.longitude }));
    return estate?.latitude != null && estate.longitude != null
      ? { id: estate.id, name: estate.name, latitude: estate.latitude, longitude: estate.longitude }
      : null;
  }, [estates, routeId]);

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

  const statusLabel = officeDisabled ? t("lorry.disabled")
    : channelStatus === "live" ? t("lorry.locationAvailable")
      : channelStatus === "error" ? t("lorry.trackingUnavailable")
        : channelStatus === "stopped" ? t("lorry.onDemand") : t("lorry.connecting");
  const lastUpdatedLabel = location
    ? t("lorry.lastUpdated", { time: new Date(location.updatedAt).toLocaleTimeString() })
    : t("lorry.notRequestedYet");

  return <Card className="mb-4 overflow-hidden border-sky-200">
    <div className="flex items-center justify-between gap-3 p-3.5">
      <div className="flex min-w-0 items-center gap-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><Truck className="h-4 w-4" /></span><div className="min-w-0"><p className="text-sm font-bold text-slate-800">{t("lorry.liveCollectionLorry")}</p>{routeOptions.length > 1 ? <select aria-label={t("lorry.selectTrackedRoute")} value={routeId} onChange={(event) => { stopActiveRequest(); setMapOpen(false); setLocation(null); setRouteId(event.target.value); }} className="mt-1 max-w-full rounded-lg border border-sky-200 bg-white px-2 py-1 text-[11px] font-semibold text-sky-800">{routeOptions.map((route) => <option key={route.id} value={route.id}>{route.label}</option>)}</select> : <p className="truncate text-[11px] text-slate-500">{selectedRoute?.code && <b>{selectedRoute.code} · </b>}{selectedRoute?.name || t("lorry.noRoute")}</p>}</div></div>
      <Badge tone={live ? "emerald" : officeDisabled || channelStatus === "error" ? "rose" : "amber"} dot>{live ? t("lorry.locationAvailable") : location && !location.active ? t("lorry.stopped") : statusLabel}</Badge>
    </div>
    {!mapOpen ? (
      <div className="border-t border-sky-100 bg-sky-50/60 p-3.5">
        <p className="text-xs text-slate-600">{lastUpdatedLabel}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t("lorry.onDemandHint")}</p>
        <button type="button" disabled={!routeId} onClick={() => setMapOpen(true)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
          <Eye className="h-4 w-4" /> {t("lorry.viewLocation")}
        </button>
      </div>
    ) : (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sky-100 bg-white px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-slate-500">{lastUpdatedLabel}</p>
          <div className="flex gap-2">
            <button type="button" disabled={requesting || refreshCooldown > 0 || !routeId} onClick={() => { setRefreshCooldown(LORRY_REFRESH_COOLDOWN_SECONDS); void requestLocation(true); }} className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 px-2.5 py-1.5 text-[11px] font-bold text-sky-700 disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${requesting ? "animate-spin" : ""}`} />
              {requesting ? t("lorry.loadingLocation") : refreshCooldown > 0 ? t("lorry.refreshIn", { seconds: refreshCooldown }) : t("lorry.refreshLocation")}
            </button>
            <button type="button" onClick={() => { stopActiveRequest(); setMapOpen(false); setChannelStatus("stopped"); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600">
              <X className="h-3.5 w-3.5" /> {t("lorry.closeMap")}
            </button>
          </div>
        </div>
        {eta && <EtaBanner eta={eta} />}
        <AiEstateInsights advisory={advisory} loading={advisoryLoading} />
        <div className="h-64 w-full bg-slate-100">
          {location ? <MapContainer center={[location.latitude, location.longitude]} zoom={15} className="h-full w-full" scrollWheelZoom={false}><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><CircleMarker center={[location.latitude, location.longitude]} radius={11} pathOptions={{ color: "#0369a1", fillColor: "#0ea5e9", fillOpacity: 0.95, weight: 3 }}><Popup>{t("lorry.lorryMarker")}</Popup></CircleMarker>{estatePoint && <CircleMarker center={[estatePoint.latitude, estatePoint.longitude]} radius={9} pathOptions={{ color: "#047857", fillColor: "#10b981", fillOpacity: 0.85, weight: 3 }}><Popup>{estatePoint.name} · {t("lorry.estatePoint")}</Popup></CircleMarker>}<FollowTracking location={location} estate={estatePoint} /></MapContainer> : <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center text-xs text-slate-400"><MapPin className="h-5 w-5" /><span>{requesting ? t("lorry.loadingLocation") : officeDisabled ? t("lorry.disabledByAdmin") : routeId ? t("lorry.requestWhenReady") : t("lorry.noRoute")}</span></div>}
        </div>
        {error && <p className="px-3.5 py-2 text-xs text-rose-600">{error}</p>}
        {!error && !estatePoint && <p className="px-3.5 py-2 text-xs text-amber-700">{t("lorry.noEstateGps")}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-sky-50 px-3.5 py-2 text-[11px] text-sky-700"><span className="flex items-center gap-1.5"><Radio className="h-3 w-3" />{statusLabel} · {trackingSource === "office-api" ? t("lorry.officeSnapshot") : t("lorry.databaseFree")}</span>{location && <span>{location.accuracyM != null ? `${t("lorry.gpsAccuracy")}: ${Math.round(location.accuracyM)} m · ` : ""}{new Date(location.updatedAt).toLocaleTimeString()}</span>}</div>
      </>
    )}
  </Card>;
}

export default LorryTracking;
