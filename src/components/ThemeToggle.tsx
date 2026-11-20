import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/lib/theme";
import { cn } from "@/utils/cn";

export function ThemeToggle({ darkSurface = false, prominent = false, pill = false }: { darkSurface?: boolean; prominent?: boolean; pill?: boolean }) {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const nextLabel = dark ? t("theme.switchLight") : t("theme.switchDark");

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
      className={cn(
        "inline-flex shrink-0 items-center justify-center border transition active:scale-95",
        pill
          ? // Stitch login style: standalone white circle, brand-green glyph.
            "h-9 w-9 rounded-full border-dalu-outline-variant bg-white text-dalu-primary shadow-sm hover:bg-slate-50"
          : "h-9 w-9 rounded-xl",
        prominent ? "h-10 w-10" : "",
        pill ? "" : darkSurface
          ? "border-white/15 bg-white/10 text-white hover:bg-white/20"
          : "border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50",
      )}
    >
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
