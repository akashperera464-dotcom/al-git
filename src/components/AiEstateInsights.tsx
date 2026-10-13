import { BrainCircuit, Loader2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ProximityAdvisory } from "@/lib/openRouterAdvisory";

export function AiEstateInsights({ advisory, loading }: { advisory: ProximityAdvisory | null; loading: boolean }) {
  const { t } = useTranslation();
  if (!loading && !advisory) return null;
  return <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 to-sky-50 px-3.5 py-3">
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700"><BrainCircuit className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-violet-900">{t("lorry.aiTitle")}</p>
          {advisory && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-600"><ShieldCheck className="h-3 w-3" />{advisory.source === "openrouter" ? t("lorry.aiGenerated") : t("lorry.safeFallback")}</span>}
        </div>
        {loading
          ? <p className="mt-1 flex items-center gap-1.5 text-[11px] text-violet-600"><Loader2 className="h-3 w-3 animate-spin" />{t("lorry.aiPreparing")}</p>
          : <p className="mt-1 text-xs leading-relaxed text-slate-700">{advisory?.advice}</p>}
      </div>
    </div>
  </div>;
}
