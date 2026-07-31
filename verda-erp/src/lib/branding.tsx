import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { readBrandingFromDb, writeBrandingToDb } from "./repo";

/**
 * KDU TEA FACTORY · Branding / White-label settings (Super Admin controlled)
 * ------------------------------------------------------------------
 * PERSISTED TO THE DATABASE (Supabase `settings` table, key='branding') so the
 * branding is shared across ALL devices, browsers, and users — and survives
 * cache clears. localStorage is used only as a fast first-paint cache so the
 * Login screen renders instantly before the DB fetch resolves.
 *
 * All images/videos are referenced by URL — paste a Cloudinary (or any CDN)
 * upload URL into the Super Admin Settings screen.
 */

export interface Branding {
  companyName: string;
  companyTagline: string;
  companyLogoUrl: string;
  loginTitle: string;
  loginSubtitle: string;
  loginLogoUrl: string;
  loginBackgroundUrl: string;
  loginScrimOpacity: number;
  accentColor: string;
}

export const DEFAULT_BRANDING: Branding = {
  companyName: "KDU TEA FACTORY",
  companyTagline: "Tea Estate ERP",
  companyLogoUrl: "https://res.cloudinary.com/dhd06wdov/image/upload/v1781669562/logokdu_xo5m6f.png",
  loginTitle: "KDU TEA FACTORY",
  loginSubtitle: "Integrated Tea Estate Enterprise Platform",
  loginLogoUrl: "https://res.cloudinary.com/dhd06wdov/image/upload/v1781669562/logokdu_xo5m6f.png",
  loginBackgroundUrl: "",
  loginScrimOpacity: 70,
  accentColor: "#10b981",
};

const CACHE_KEY = "kdu.branding.cache";

interface BrandingContextValue {
  branding: Branding;
  setBranding: (patch: Partial<Branding>) => Promise<boolean>;
  resetBranding: () => Promise<boolean>;
  source: "database" | "cache" | "default";
  /** Sync status so the Settings UI can show "Saving to database…". */
  saving: boolean;
  syncError: string | null;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

/** Read the localStorage cache synchronously (instant first paint). */
function readCache(): Branding | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? { ...DEFAULT_BRANDING, ...(JSON.parse(raw) as Partial<Branding>) } : null;
  } catch {
    return null;
  }
}

function writeCache(b: Branding) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(b));
  } catch {
    /* ignore */
  }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  // 1) Instant first paint from cache (or defaults).
  const cached = useRef(readCache());
  const [branding, setBrandingState] = useState<Branding>(cached.current ?? DEFAULT_BRANDING);
  const [source, setSource] = useState<"database" | "cache" | "default">(cached.current ? "cache" : "default");
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // 2) On mount, pull the authoritative copy from Supabase and override the cache.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await readBrandingFromDb();
        if (!active) return;
        if (data && Object.keys(data).length) {
          const merged = { ...DEFAULT_BRANDING, ...(data as Partial<Branding>) };
          setBrandingState(merged);
          writeCache(merged);
          setSource("database");
        }
      } catch (e) {
        // DB not reachable — keep the cache/default.
        // eslint-disable-next-line no-console
        console.warn("[branding] DB read failed, using cache", e);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // 3) setBranding: write to the DATABASE (source of truth) + update cache.
  const setBranding = useCallback(async (patch: Partial<Branding>): Promise<boolean> => {
    setSaving(true);
    setSyncError(null);
    const next = { ...branding, ...patch };
    setBrandingState(next); // optimistic UI update
    writeCache(next);
    try {
      await writeBrandingToDb(next);
      setSource("database");
      setSaving(false);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save to database.";
      setSyncError(msg);
      setSaving(false);
      // eslint-disable-next-line no-console
      console.error("[branding] DB write failed", e);
      return false;
    }
  }, [branding]);

  const resetBranding = useCallback(async (): Promise<boolean> => {
    return setBranding(DEFAULT_BRANDING);
  }, [setBranding]);

  const value = useMemo<BrandingContextValue>(
    () => ({ branding, setBranding, resetBranding, source, saving, syncError }),
    [branding, setBranding, resetBranding, source, saving, syncError]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}

/* ----------------------------- helpers ----------------------------- */

export function isMediaUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim()) || /^data:image\//i.test(url.trim());
}

export function isCloudinary(url: string): boolean {
  return /res\.cloudinary\.com/i.test(url.trim());
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url.trim());
}
