import { Check, MapPinned } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RouteOption } from "@/lib/supplierOperations";

export function RouteMultiSelect({ routes, selected, onChange, disabled = false, emptyText = "Select a factory first" }: {
  routes: RouteOption[];
  selected: string[];
  onChange: (routeIds: string[]) => void;
  disabled?: boolean;
  emptyText?: string;
}) {
  const { t } = useTranslation();
  const toggle = (routeId: string) => {
    if (disabled) return;
    onChange(selected.includes(routeId) ? selected.filter((id) => id !== routeId) : [...selected, routeId]);
  };
  if (!routes.length) return <div className="mt-1 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-400">{emptyText}</div>;
  return <div className={`mt-1 max-h-44 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-white p-2 ${disabled ? "opacity-60" : ""}`}>
    {routes.map((route) => {
      const checked = selected.includes(route.id);
      const primary = selected[0] === route.id;
      return <button key={route.id} type="button" disabled={disabled} onClick={() => toggle(route.id)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${checked ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50"}`}>
        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}>{checked && <Check className="h-3 w-3" />}</span>
        <MapPinned className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{route.label}</span>
        {primary && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase">{t("auth.primaryRoute")}</span>}
      </button>;
    })}
    <p className="px-2 pt-1 text-[10px] text-slate-400">{t("auth.multiRouteHelp")}</p>
  </div>;
}
