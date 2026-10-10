import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase, supabaseConfigured } from "./supabase";

/**
 * Verda · Real-time data synchronization layer
 * ------------------------------------------------------------------
 * A generic hook that fetches a collection from Supabase AND subscribes to
 * `postgres_changes` so that ANY insert/update/delete on the watched table
 * instantly refetches the data. This keeps every active navigation screen
 * synchronized — no manual refresh needed.
 *
 * Demo mode (no Supabase): runs the fetcher once and returns the result,
 * so mock data still renders.
 *
 * Usage:
 *   const { data, loading, reload } = useLiveData("users", () => readUsersForAdmin());
 *   const { data } = useLiveData("harvest_records", () => readHarvest(role, uid, eid), "user_id=eq.{uid}");
 */
export function useLiveData<T>(
  table: string,
  fetcher: () => Promise<T[]>,
  /** Optional postgres_changes filter, e.g. "user_id=eq.abc-123". */
  filter?: string,
  /** Debounce refetch (ms) to avoid bursts. */
  debounceMs = 250
): { data: T[]; loading: boolean; error: string | null; reload: () => Promise<void> } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const generation = useRef(0);

  const reload = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetcherRef.current();
      if (alive.current && current === generation.current) setData(rows);
    } catch (e) {
      if (alive.current && current === generation.current) setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      if (alive.current && current === generation.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter]);

  // Initial fetch.
  useEffect(() => {
    alive.current = true;
    setData([]);
    void reload();
    return () => {
      alive.current = false;
      generation.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  // Real-time subscription.
  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = getSupabase()!;
    const channelName = `rt-${table}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = sb
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        () => {
          // Debounce to avoid multiple rapid refetches during a burst of changes.
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void reload(), debounceMs);
        }
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter, debounceMs, reload]);

  return { data, loading, error, reload };
}
