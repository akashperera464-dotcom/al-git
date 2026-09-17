import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Plus, Check, WifiOff } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { cn } from "@/utils/cn";

const TONES: Record<string, string> = {
  emerald: "from-emerald-600 to-teal-600 shadow-emerald-600/25",
  amber: "from-amber-500 to-orange-500 shadow-amber-500/25",
  sky: "from-sky-500 to-blue-600 shadow-sky-500/25",
  violet: "from-violet-500 to-fuchsia-600 shadow-violet-500/25",
};

export function CaptureButton({
  label,
  icon: Icon = Plus,
  tone = "emerald",
  syncLabel,
}: {
  label: string;
  icon?: LucideIcon;
  tone?: "emerald" | "amber" | "sky" | "violet";
  syncLabel?: string;
}) {
  const { enqueueSync, online } = useApp();
  const [done, setDone] = useState(false);
  const click = () => {
    enqueueSync(syncLabel ?? label);
    setDone(true);
    window.setTimeout(() => setDone(false), 1500);
  };
  return (
    <button
      onClick={click}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl bg-gradient-to-br px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 ring-focus",
        TONES[tone]
      )}
    >
      {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      {done ? "Queued for sync" : label}
      {!online && !done && <WifiOff className="h-3.5 w-3.5 opacity-90" />}
    </button>
  );
}
