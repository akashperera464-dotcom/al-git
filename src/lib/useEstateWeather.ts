import { useCallback, useEffect, useMemo, useState } from "react";
import { readEstate, readMyEstates, type Estate } from "./estateRepo";
import { readUserEstateAssociation } from "./supplierOperations";
import { fetchForecast, getMockForecast, hasWeatherCoordinates, weatherConfigured, type ForecastResult, type WeatherStatus } from "./weather";

const weatherEstateKey = (userId: string) => `kdu.weather.selectedEstate.${userId}`;
const weatherPreferredEstateKey = (userId: string) => `kdu.weather.preferredEstate.${userId}`;

/** Include the admin-linked primary estate even when its legacy owner field has not yet been backfilled. */
export function mergeSupplierWeatherEstates(ownedEstates: Estate[], linkedEstate?: Estate | null): Estate[] {
  if (!linkedEstate || ownedEstates.some((estate) => estate.id === linkedEstate.id)) return ownedEstates;
  return [linkedEstate, ...ownedEstates];
}

export function chooseWeatherEstate(estates: Estate[], savedId?: string, preferredId?: string): Estate | undefined {
  return estates.find((estate) => estate.id === savedId)
    ?? estates.find((estate) => estate.id === preferredId)
    ?? estates.find((estate) => estate.status === "approved" && hasWeatherCoordinates(estate.latitude, estate.longitude))
    ?? estates.find((estate) => estate.status === "approved")
    ?? estates[0];
}

/**
 * A supplier may select another owned estate and keep that choice. When an
 * administrator changes the account's linked estate, however, an old device
 * selection must not override the new assignment on the next login.
 */
export function chooseSupplierWeatherEstate(
  estates: Estate[],
  savedId?: string,
  previousPreferredId?: string,
  preferredId?: string,
): Estate | undefined {
  const assignmentChanged = Boolean(preferredId && previousPreferredId !== preferredId);
  return chooseWeatherEstate(estates, assignmentChanged ? undefined : savedId, preferredId);
}

export function useSupplierWeatherEstate(userId: string, preferredId?: string) {
  const [estates, setEstates] = useState<Estate[]>([]);
  const [selectedEstateId, setSelectedEstateIdState] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([
      readMyEstates(userId).catch(() => [] as Estate[]),
      readUserEstateAssociation(userId).then((id) => ({ id, loaded: true })).catch(() => ({ id: null, loaded: false })),
    ]).then(async ([ownedRows, profileLink]) => {
      if (!active) return;
      const persistedPreferredId = profileLink.loaded ? profileLink.id ?? undefined : preferredId;
      const linkedEstate = persistedPreferredId && persistedPreferredId !== userId
        ? await readEstate(persistedPreferredId).catch(() => null)
        : null;
      if (!active) return;
      const rows = mergeSupplierWeatherEstates(ownedRows, linkedEstate);
      const approvedRows = rows.filter((estate) => estate.status === "approved");
      let savedId: string | undefined;
      let previousPreferredId: string | undefined;
      try {
        savedId = localStorage.getItem(weatherEstateKey(userId)) ?? undefined;
        previousPreferredId = localStorage.getItem(weatherPreferredEstateKey(userId)) ?? undefined;
      } catch { /* storage can be unavailable */ }
      const selected = chooseSupplierWeatherEstate(approvedRows, savedId, previousPreferredId, persistedPreferredId);
      setEstates(approvedRows);
      setSelectedEstateIdState(selected?.id ?? "");
      try {
        if (persistedPreferredId) localStorage.setItem(weatherPreferredEstateKey(userId), persistedPreferredId);
        if (selected) localStorage.setItem(weatherEstateKey(userId), selected.id);
      } catch { /* storage can be unavailable */ }
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setEstates([]);
      setSelectedEstateIdState("");
      setLoading(false);
    });
    return () => { active = false; };
  }, [userId, preferredId]);

  const setSelectedEstateId = useCallback((estateId: string) => {
    setSelectedEstateIdState(estateId);
    try { localStorage.setItem(weatherEstateKey(userId), estateId); } catch { /* storage can be unavailable */ }
  }, [userId]);

  const estate = useMemo(() => estates.find((row) => row.id === selectedEstateId), [estates, selectedEstateId]);
  return { estates, estate, selectedEstateId, setSelectedEstateId, loading };
}

export function useEstateWeather(latitude?: number, longitude?: number) {
  const coordinateKey = hasWeatherCoordinates(latitude, longitude) ? `${latitude.toFixed(4)},${longitude!.toFixed(4)}` : "missing";
  const initialStatus: WeatherStatus = hasWeatherCoordinates(latitude, longitude)
    ? (weatherConfigured ? "request-failed" : "not-configured")
    : "missing-coordinates";
  const [state, setState] = useState<{ coordinateKey: string; result: ForecastResult }>({ coordinateKey, result: { days: getMockForecast(), source: "mock", status: initialStatus } });
  const [loading, setLoading] = useState(weatherConfigured && hasWeatherCoordinates(latitude, longitude));

  useEffect(() => {
    let active = true;
    setLoading(weatherConfigured && hasWeatherCoordinates(latitude, longitude));
    void fetchForecast(latitude, longitude).then((next) => {
      if (!active) return;
      setState({ coordinateKey, result: next });
      setLoading(false);
    });
    return () => { active = false; };
  }, [latitude, longitude, coordinateKey]);

  const result = state.coordinateKey === coordinateKey
    ? state.result
    : { days: getMockForecast(), source: "mock" as const, status: initialStatus };
  return { ...result, today: result.days[0], loading: loading || state.coordinateKey !== coordinateKey };
}
