import { useState } from "react";
import { MapPin, ExternalLink, Save, Loader2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { updateEstateMap } from "@/lib/repo";
import { cn } from "@/utils/cn";

/**
 * EstateMap — renders an estate's Google Maps embed URL inside an interactive
 * <iframe>. Admins/Super-Admins can paste/edit the embed URL inline.
 *
 * Used in the Web Admin Estate Master screen.
 */
export function EstateMap({
  estateId,
  embedUrl,
  estateName,
  onSaved,
}: {
  estateId: string;
  embedUrl?: string;
  estateName: string;
  onSaved?: (newUrl: string) => void;
}) {
  const { role } = useApp();
  const canEdit = role === "admin" || role === "super_admin";
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(embedUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateEstateMap(role, estateId, url.trim());
      onSaved?.(url.trim());
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save map URL.");
    } finally {
      setBusy(false);
    }
  };

  const safeSrc = (raw: string) => {
    const v = raw.trim();
    // Allow Google Maps embed pb= links + generic https embeds.
    return /^https?:\/\//i.test(v) ? v : "";
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-emerald-600" />
          <h3 className="font-display text-sm font-bold text-slate-800">Interactive Map · {estateName}</h3>
        </div>
        {canEdit && !editing && (
          <button onClick={() => { setUrl(embedUrl ?? ""); setEditing(true); }} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50">
            <Pencil className="h-3 w-3" /> Edit link
          </button>
        )}
        {embedUrl && !editing && (
          <a href={safeSrc(embedUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline">
            Open <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {canEdit && editing ? (
        <div className="p-4">
          <label className="text-[11px] font-medium text-slate-400">Google Maps Embed URL</label>
          <p className="mb-1.5 text-[11px] text-slate-400">
            In Google Maps → Share → "Embed a map" → copy the <code className="rounded bg-slate-100 px-1">src="…"</code> URL and paste here.
          </p>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.google.com/maps/embed?pb=!1m18!1m12…"
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
          />
          {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition enabled:hover:brightness-110 disabled:opacity-60">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save map
            </button>
            <button onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500">Cancel</button>
          </div>
        </div>
      ) : embedUrl ? (
        <div className="aspect-video w-full bg-slate-100">
          <iframe
            title={`Map of ${estateName}`}
            src={safeSrc(embedUrl)}
            className={cn("h-full w-full border-0")}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 bg-slate-50 p-10 text-center">
          <MapPin className="h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-400">No map link set for this estate.</p>
          {canEdit ? (
            <button onClick={() => { setUrl(""); setEditing(true); }} className="mt-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
              Add Google Maps link
            </button>
          ) : (
            <Badge tone="slate">Ask an admin to add the map</Badge>
          )}
        </div>
      )}
    </div>
  );
}
