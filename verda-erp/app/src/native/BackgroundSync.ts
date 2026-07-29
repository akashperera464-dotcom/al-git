/**
 * Native Background Sync — flush IndexedDB write queue when app is closed
 * ------------------------------------------------------------------
 * Uses expo-background-fetch + expo-task-manager to periodically (every 15 min,
 * OS-permitted minimum) replay any queued mutations from the PWA's IndexedDB.
 *
 * The PWA writes its offline mutations to a shared AsyncStorage key
 * ("verda:offline_queue") that this task reads. Each mutation is a Supabase
 * REST call with optimistic-concurrency check (via the `version` column).
 *
 * Install:
 *   npx expo install expo-background-fetch expo-task-manager @react-native-async-storage/async-storage
 *
 * In app.config.js plugins:
 *   ["expo-background-fetch", { backgroundTaskName: "verda-flush-queue" }]
 */
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const FLUSH_QUEUE_TASK = "verda-flush-queue";
const QUEUE_KEY = "verda:offline_queue";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export interface QueuedMutation {
  id: string;
  table: string;             // e.g. "harvest_records", "factory_batches"
  operation: "insert" | "update" | "delete";
  recordId?: string;
  expectedVersion?: number;  // for optimistic concurrency
  payload?: Record<string, unknown>;
  queuedAt: string;
  attempts: number;
  lastError?: string;
}

/**
 * Define the headless background task that replays queued mutations.
 * Must be called at module-scope (not inside a component) so it registers
 * before the app finishes launching.
 */
export function registerBackgroundSync(): void {
  if (!TaskManager.isTaskDefined(FLUSH_QUEUE_TASK)) {
    TaskManager.defineTask(FLUSH_QUEUE_TASK, async () => {
      try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
        const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
        if (!queueJson) return BackgroundFetch.BackgroundFetchResult.NoData;
        const queue: QueuedMutation[] = JSON.parse(queueJson);
        if (queue.length === 0) return BackgroundFetch.BackgroundFetchResult.NoData;

        const stillPending: QueuedMutation[] = [];
        let succeeded = 0;

        for (const mut of queue) {
          // Skip if too many attempts (dead-letter)
          if (mut.attempts >= 5) continue;

          const ok = await replayMutation(mut);
          if (ok) {
            succeeded++;
          } else {
            // Re-queue with incremented attempts
            stillPending.push({ ...mut, attempts: mut.attempts + 1 });
          }
        }

        // Persist remaining queue
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(stillPending));

        return succeeded > 0
          ? BackgroundFetch.BackgroundFetchResult.NewData
          : BackgroundFetch.BackgroundFetchResult.NoData;
      } catch (e) {
        console.error("[bg-sync] flush failed", e);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  }
}

/**
 * Send a single mutation to Supabase with optimistic-concurrency check.
 * Returns true on success, false on conflict/network error (mutation stays queued).
 */
async function replayMutation(mut: QueuedMutation): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: mut.operation === "insert" ? "return=representation" : "return=minimal",
    };

    let url = `${SUPABASE_URL}/rest/v1/${mut.table}`;
    let method = "POST";
    let body: string | undefined;

    if (mut.operation === "insert") {
      body = JSON.stringify(mut.payload);
    } else if (mut.operation === "update") {
      url += `?id=eq.${mut.recordId}`;
      if (mut.expectedVersion !== undefined) url += `&version=eq.${mut.expectedVersion}`;
      method = "PATCH";
      body = JSON.stringify(mut.payload);
    } else if (mut.operation === "delete") {
      url += `?id=eq.${mut.recordId}`;
      if (mut.expectedVersion !== undefined) url += `&version=eq.${mut.expectedVersion}`;
      method = "DELETE";
    }

    const res = await fetch(url, { method, headers, body });

    // 200/201/204 = success
    if (res.status >= 200 && res.status < 300) {
      // For UPDATE: check if 0 rows affected (conflict — version mismatch)
      const contentRange = res.headers.get("content-range");
      if (method === "PATCH" && contentRange === "0/*") {
        // 0 rows updated → conflict; dead-letter this mutation
        return false;
      }
      return true;
    }

    // 409 conflict or any 4xx other than 404 = transient, retry
    if (res.status === 409) return false;
    if (res.status >= 400 && res.status < 500 && res.status !== 404) return false;

    // 404 on UPDATE/DELETE → row no longer exists, drop the mutation
    if (res.status === 404 && mut.operation !== "insert") return true;

    return false;
  } catch (e) {
    return false; // network error — stays queued
  }
}

/**
 * Register the background task with the OS scheduler.
 * Runs approximately every 15 minutes (Android minimum interval).
 *
 * On iOS, background fetch is opportunistic — the OS decides when to run it
 * based on user's usage patterns. Real tea-field use may need a foreground
 * service for guaranteed periodic sync.
 */
export async function startBackgroundSync(): Promise<boolean> {
  registerBackgroundSync();
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status !== BackgroundFetch.BackgroundFetchStatus.Available) {
      return false;
    }
    await BackgroundFetch.registerTaskAsync(FLUSH_QUEUE_TASK, {
      minimumInterval: 900, // 15 min (Android minimum)
      stopOnTerminate: false,
      startOnBoot: true,
    });
    return true;
  } catch (e) {
    console.error("[bg-sync] register failed", e);
    return false;
  }
}

/**
 * Unregister the background sync task (used on sign-out).
 */
export async function stopBackgroundSync(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(FLUSH_QUEUE_TASK);
  } catch { /* ignore */ }
}

/**
 * Manually flush the queue (called from the foreground when user taps "Sync Now").
 * Returns the count of successfully replayed mutations.
 */
export async function flushQueueNow(): Promise<{ succeeded: number; remaining: number; conflicts: number }> {
  const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
  if (!queueJson) return { succeeded: 0, remaining: 0, conflicts: 0 };
  const queue: QueuedMutation[] = JSON.parse(queueJson);

  const stillPending: QueuedMutation[] = [];
  let succeeded = 0;
  let conflicts = 0;

  for (const mut of queue) {
    const ok = await replayMutation(mut);
    if (ok) {
      succeeded++;
    } else {
      stillPending.push(mut);
      conflicts++;
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(stillPending));
  return { succeeded, remaining: stillPending.length, conflicts };
}

/**
 * Push a new mutation onto the queue (called from the WebView when offline).
 */
export async function enqueueMutation(mut: Omit<QueuedMutation, "id" | "queuedAt" | "attempts">): Promise<void> {
  const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
  const queue: QueuedMutation[] = queueJson ? JSON.parse(queueJson) : [];
  queue.push({
    ...mut,
    id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Read the current queue length (for the UI's "Pending Queue" badge).
 */
export async function getQueueLength(): Promise<number> {
  const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
  if (!queueJson) return 0;
  try {
    return (JSON.parse(queueJson) as QueuedMutation[]).length;
  } catch {
    return 0;
  }
}
