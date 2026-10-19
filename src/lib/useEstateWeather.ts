import { useCallback, useEffect, useMemo, useState } from "react";
import { readMyEstates, type Estate } from "./estateRepo";
import { fetchForecast, getMockForecast, hasWeatherCoordinates, weatherConfigured, type ForecastResult, type WeatherStatus } from "./weather";

const weatherEstateKey = (userId: string) => `kdu.weather.selectedEstate.${userId}`;

export function chooseWeatherEstate(estates: Estate[], savedId?: string, preferredId?: string): Estate | undefined {
  return estates.find((estate) => estate.id === savedId)
    ?? estates.find((estate) => estate.id === preferredId)
    ?? estates.find((estate) => estate.status === "approved" && hasWeatherCoordinates(estate.latitude, estate.longitude))
    ?? estates.find((estate) => estate.status === "approved")
    ?? estates[0];
}

export function useSupplierWeatherEstate(userId: string, preferredId?: string) {
  const [estates, setEstates] = useState<Estate[]>([]);
  const [selectedEstateId, setSelectedEstateIdState] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void readMyEstates(userId).then((rows) => {
      if (!active) return;
      const approvedRows = rows.filter((estate) => estate.status === "approved");
      let savedId: string | undefined;
      try { savedId = localStorage.getItem(weatherEstateKey(userId)) ?? undefined; } catch { /* storage can be unavailable */ }
      const selected = chooseWeatherEstate(approvedRows, savedId, preferredId);
      setEstates(approvedRows);
      setSelectedEstateIdState(selected?.id ?? "");
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
