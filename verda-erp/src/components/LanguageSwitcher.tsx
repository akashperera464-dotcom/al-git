import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Check, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "@/i18n";

/**
 * LanguageSwitcher — compact dropdown to toggle EN / SI / TA globally.
 * `dark` variant for placement on the emerald app headers.
 */
export function LanguageSwitcher({ dark }: { dark?: boolean }) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = (SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language) ??
    SUPPORTED_LANGUAGES[0]) as (typeof SUPPORTED_LANGUAGES)[number];

  const change = (code: LanguageCode) => {
    void i18n.changeLanguage(code);
    setOpen(false);
  };

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("common.language")}
        title={t("common.language")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold transition ring-focus",
          dark
            ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        )}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{t(current.labelKey)}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-scale-in">
          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("common.language")}</p>
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => change(l.code)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-slate-50",
                l.code === i18n.language ? "bg-emerald-50 font-bold text-emerald-700" : "text-slate-700"
              )}
            >
              <span className="text-base leading-none">{l.flag}</span>
              <span className="flex-1">{t(l.labelKey)}</span>
              {l.code === i18n.language && <Check className="h-4 w-4 text-emerald-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
