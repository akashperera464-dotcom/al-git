import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { LocateFixed, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { formatEstateCoordinate, geolocationErrorMessage, parseEstateCoordinate, type EstateCoordinate } from "@/lib/estateLocation";

const SRI_LANKA_CENTER: [number, number] = [7.8731, 80.7718];

function ClickSelector({ onSelect }: { onSelect: (point: EstateCoordinate) => void }) {
  useMapEvents({
    click(event) {
      onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

function FollowSelection({ point }: { point: EstateCoordinate | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.flyTo([point.latitude, point.longitude], Math.max(map.getZoom(), 16), { duration: 0.65 });
  }, [map, point]);
  return null;
}

export function EstateLocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: string;
  longitude: string;
  onChange: (latitude: string, longitude: string) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const point = useMemo(() => parseEstateCoordinate(latitude, longitude), [latitude, longitude]);

  const select = (next: EstateCoordinate) => {
    onChange(formatEstateCoordinate(next.latitude), formatEstateCoordinate(next.longitude));
    setMessage("Location selected. Save the estate to keep these coordinates.");
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("This device/browser does not support GPS location.");
      return;
    }
    setLocating(true);
    setMessage("Detecting the device location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        select({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setMessage(`Current location detected (accuracy about ${Math.round(position.coords.accuracy)} m).`);
        setLocating(false);
      },
      (error) => {
        setMessage(geolocationErrorMessage(error));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };

  const center: [number, number] = point ? [point.latitude, point.longitude] : SRI_LANKA_CENTER;
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><MapPin className="h-4 w-4 text-emerald-600" />Estate GPS location</p>
          <p className="text-[10px] text-slate-400">Tap the exact estate/collection point on the map, or use this device's current GPS.</p>
        </div>
        <button type="button" onClick={useCurrentLocation} disabled={locating} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
          <LocateFixed className={`h-4 w-4 ${locating ? "animate-pulse" : ""}`} />{locating ? "Finding…" : "Use current location"}
        </button>
      </div>
      <div className="h-72 w-full bg-slate-100 sm:h-80">
        <MapContainer center={center} zoom={point ? 16 : 7} className="h-full w-full" scrollWheelZoom>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickSelector onSelect={select} />
          <FollowSelection point={point} />
          {point && <CircleMarker center={[point.latitude, point.longitude]} radius={10} pathOptions={{ color: "#047857", fillColor: "#10b981", fillOpacity: 0.9, weight: 3 }}><Popup>Selected estate location<br />{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</Popup></CircleMarker>}
        </MapContainer>
      </div>
      <div className={`px-3 py-2 text-[11px] ${message?.includes("denied") || message?.includes("could not") || message?.includes("timed out") ? "text-rose-600" : "text-slate-500"}`}>
        {message ?? (point ? `Selected: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}` : "No GPS point selected yet.")}
      </div>
    </div>
  );
}
