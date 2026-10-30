import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

export type ColorTheme = "light" | "dark";

const THEME_STORAGE_KEY = "kdu.color-theme";

interface ThemeContextValue {
  theme: ColorTheme;
  setTheme: (theme: ColorTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function resolveInitialTheme(savedTheme: string | null, prefersDark: boolean): ColorTheme {
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return prefersDark ? "dark" : "light";
}

function readInitialTheme(): ColorTheme {
  if (typeof window === "undefined") return "light";
  let saved: string | null = null;
  try { saved = window.localStorage.getItem(THEME_STORAGE_KEY); } catch { /* Restricted browser storage. */ }
  return resolveInitialTheme(saved, window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
}

function applyTheme(theme: ColorTheme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#07110e" : "#064e3b");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ColorTheme>(readInitialTheme);

  useBrowserLayoutEffect(() => {
    applyTheme(theme);
    try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Theme still works for this session. */ }
  }, [theme]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      setThemeState(resolveInitialTheme(event.newValue, window.matchMedia("(prefers-color-scheme: dark)").matches));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme: setThemeState,
    toggleTheme: () => setThemeState((current) => current === "dark" ? "light" : "dark"),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}

export { THEME_STORAGE_KEY };
