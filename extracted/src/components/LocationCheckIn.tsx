import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Loader2, CheckCircle2, AlertCircle, Navigation, Crosshair } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { recordSupplierLocation, readSupplierLocations } from "@/lib/repo";
import type { SupplierLocation } from "@/lib/data";

/**
 * LocationCheckIn — Supplier "Verify My Location at Estate" button.
 *
 * Flow:
 *   1. Request browser/device GPS permission (Geolocation API on web).
 *   2. Fetch exact latitude + longitude.
 *   3. INSERT into Supabase `supplier_locations`.
 *   4. Show a success message + the captured coordinates.
 *
 * The native Expo app has its own equivalent using `expo-location` (see
 * app/src/components/EstateMapView.tsx → LocationCheckInNative).
 */
export function LocationCheckIn({ estateName }: { estateName: string }) {
  const { t } = useTranslation();
  const { userUid, associatedEntityId } = useApp();
  const [state, setState] = useState<"idle" | "locating" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const verify = async () => {
    setState("locating");
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("GPS / Geolocation is not supported on this device.");
      setState("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setState("saving");
        try {
          await recordSupplierLocation(userUid, lat, lng, associatedEntityId);
          setState("done");
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save location.");
          setState("error");
        }
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: t("supplier.locationDenied"),
          2: "Position unavailable. Check your GPS signal.",
          3: "Location request timed out. Try again.",
        };
        setError(msgs[err.code] ?? "Could not get your location.");
        setState("error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-4 text-white">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          <h3 className="font-display text-base font-bold">{t("supplier.locationVerification")}</h3>
        </div>
        <p className="mt-0.5 text-xs text-emerald-50">{t("supplier.verifyLocationDesc")} ({estateName})</p>
      </div>

      <div className="p-4">
        {state === "idle" && (
          <button
            onClick={verify}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-110 active:scale-[0.99]"
          >
            <Crosshair className="h-5 w-5" />
            {t("supplier.verifyLocationBtn")}
          </button>
        )}

        {(state === "locating" || state === "saving") && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            {state === "locating" ? t("supplier.gettingLocation") : t("supplier.savingLocation")}
          </div>
        )}

        {state === "done" && coords && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm font-bold text-emerald-800">{t("supplier.locationVerified")}</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <p className="text-slate-400">{t("supplier.latitude")}</p>
                <p className="font-mono font-bold text-slate-700">{coords.lat.toFixed(6)}</p>
              </div>
              <div className="rounded-lg bg-white px-2.5 py-1.5">
                <p className="text-slate-400">{t("supplier.longitude")}</p>
                <p className="font-mono font-bold text-slate-700">{coords.lng.toFixed(6)}</p>
              </div>
            </div>
            <button onClick={verify} className="mt-3 w-full rounded-lg border border-emerald-300 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">
              Verify again
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p className="text-xs text-rose-700">{error}</p>
            </div>
            <button onClick={verify} className="mt-2 w-full rounded-lg border border-rose-300 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">
              {t("supplier.retry")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Hook to load a supplier's recent check-in history (for the admin view). */
export function useSupplierLocations(userId: string | undefined) {
  const [locations, setLocations] = useState<SupplierLocation[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setLocations(await readSupplierLocations(userId));
    } catch {
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  return { locations, loading, reload };
}

/** Admin view: a supplier's verified check-in history. */
export function SupplierLocationHistory({ userId, estateName }: { userId: string; estateName?: string }) {
  const { locations, loading } = useSupplierLocations(userId);
  if (loading) return <p className="py-3 text-xs text-slate-400">Loading check-ins…</p>;
  if (!locations.length)
    return (
      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
        <MapPin className="h-3.5 w-3.5" /> No location check-ins yet.
      </div>
    );
  return (
    <div className="space-y-1.5">
      {locations.slice(0, 5).map((l) => (
        <div key={l.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <Crosshair className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-mono text-slate-700">
              {l.latitude.toFixed(5)}, {l.longitude.toFixed(5)}
            </span>
          </div>
          <a
            href={`https://www.google.com/maps?q=${l.latitude},${l.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] font-semibold text-emerald-600 hover:underline"
          >
            {new Date(l.createdAt).toLocaleString()}
          </a>
        </div>
      ))}
      {estateName && <p className="px-1 pt-1 text-[10px] text-slate-400">Relative to estate: {estateName}</p>}
    </div>
  );
}
