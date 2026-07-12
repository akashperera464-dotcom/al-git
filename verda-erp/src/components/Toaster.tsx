import { BellRing, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { cn } from "@/utils/cn";

const CARD: Record<string, string> = {
  emerald: "border-emerald-200",
  rose: "border-rose-200",
  amber: "border-amber-200",
  sky: "border-sky-200",
  violet: "border-violet-200",
};
const CHIP: Record<string, string> = {
  emerald: "bg-emerald-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
};

/** Global FCM-style toast surface (renders above both shells). */
export function Toaster() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-3 sm:left-auto sm:right-4 sm:items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-white p-3 shadow-xl animate-fade-up",
            CARD[t.tone] ?? CARD.emerald
          )}
        >
          <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white", CHIP[t.tone] ?? CHIP.emerald)}>
            <BellRing className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold text-slate-800">{t.title}</p>
              <span className="rounded bg-violet-100 px-1 text-[9px] font-bold uppercase text-violet-700">{t.channel}</span>
            </div>
            <p className="text-xs text-slate-500">{t.body}</p>
          </div>
          <button onClick={() => dismissToast(t.id)} className="shrink-0 text-slate-300 transition hover:text-slate-500">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
