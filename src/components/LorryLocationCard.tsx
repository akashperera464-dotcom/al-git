import { useEffect, useMemo, useState } from "react";
import { MapPin, Radio } from "lucide-react";
import { Card, Badge } from "@/components/ui";
import { readLatestLorryLocation, readUserOperationalProfile, subscribeToLorryLocation, type LorryLocation } from "@/lib/supplierOperations";

export function LorryLocationCard({ userId }: { userId: string }) {
  const [location, setLocation] = useState<LorryLocation | null>(null);
  const [routeName, setRouteName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let unsubscribe = () => {};
    let mounted = true;
    void readUserOperationalProfile(userId).then(async (profile) => {
      if (!mounted || !profile?.routeId) return;
      setRouteName(profile.routeName ?? "Assigned route");
      const latest = await readLatestLorryLocation(profile.routeId);
      if (mounted) setLocation(latest);
      unsubscribe = subscribeToLorryLocation(profile.routeId, (next) => mounted && setLocation(next));
    }).catch((reason) => mounted && setError(reason instanceof Error ? reason.message : "Could not load lorry location."));
    return () => { mounted = false; unsubscribe(); };
  }, [userId]);

  const minutesOld = useMemo(() => location ? Math.max(0, Math.floor((Date.now() - new Date(location.updatedAt).getTime()) / 60_000)) : null, [location]);
  const isLive = minutesOld !== null && minutesOld <= 5;
  const mapUrl = location ? `https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - 0.012}%2C${location.latitude - 0.008}%2C${location.longitude + 0.012}%2C${location.latitude + 0.008}&layer=mapnik&marker=${location.latitude}%2C${location.longitude}` : "";

  return (
    <Card className="mb-4 overflow-hidden border-sky-200">
      <div className="flex items-center justify-between gap-3 p-3.5">
        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-sky-600" /><div><p className="text-sm font-bold text-slate-800">Collection lorry</p><p className="text-[11px] text-slate-500">{routeName || "No route assigned"}</p></div></div>
        {location && <Badge tone={isLive ? "emerald" : "amber"} dot>{isLive ? "Live" : `${minutesOld} min ago`}</Badge>}
      </div>
      {error && <p className="px-3.5 pb-3 text-xs text-rose-600">{error}</p>}
      {location ? <><iframe title="Live collection lorry map" src={mapUrl} className="h-48 w-full border-0" loading="lazy" /><div className="flex items-center gap-1.5 bg-sky-50 px-3.5 py-2 text-[11px] text-sky-700"><Radio className="h-3 w-3" />GPS accuracy {Math.round(location.accuracyM ?? 0)} m · updated {new Date(location.updatedAt).toLocaleTimeString()}</div></> : <p className="px-3.5 pb-4 text-xs text-slate-400">The driver has not started live GPS for this route yet.</p>}
    </Card>
  );
}
