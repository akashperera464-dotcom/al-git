/**
 * Verda · Web-side Offline Queue (localStorage-backed)
 * ------------------------------------------------------------------
 * When the Extension Officer is in a no-signal area and saveLeafWeighing()
 * fails, the mutation is enqueued here. When connectivity returns, the
 * AppContext auto-flush trigger calls flushQueue() to replay all pending
 * mutations to Supabase.
 *
 * Storage key: "verda:offline_queue" (same name as the native AsyncStorage
 * key in BackgroundSync.ts — but in browser localStorage context).
 *
 * Each mutation stores the Supabase table name + snake_case payload so
 * flushQueue() can directly call sb.from(table).insert(payload).
 */
import { getSupabase, supabaseConfigured } from "./supabase";

const QUEUE_KEY = "verda:offline_queue";
const MAX_ATTEMPTS = 5;

export interface QueuedMutation {
  id: string;
  table: string;
  operation: "insert" | "update" | "delete";
  recordId?: string;
  expectedVersion?: number;
  payload: Record<string, unknown>;
  queuedAt: string;
  attempts: number;
  lastError?: string;
  label: string;       // human-readable for UI display
}

/** Read the full queue from localStorage. */
function readQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedMutation[];
  } catch {
    return [];
  }
}

/** Write the full queue back to localStorage. */
function writeQueue(queue: QueuedMutation[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    // Dispatch a custom event so React components can react to queue changes
    window.dispatchEvent(new CustomEvent("verda:queue-updated", { detail: queue.length }));
  } catch (e) {
    console.warn("[offlineQueue] Failed to write queue:", e);
  }
}

/**
 * Enqueue a mutation that failed to sync online.
 * Returns the queued mutation's ID so the caller can reference it.
 */
export function enqueueMutation(input: {
  table: string;
  operation: "insert" | "update" | "delete";
  recordId?: string;
  expectedVersion?: number;
  payload: Record<string, unknown>;
  label: string;
}): string {
  const queue = readQueue();
  const id = `mut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const mutation: QueuedMutation = {
    id,
    table: input.table,
    operation: input.operation,
    recordId: input.recordId,
    expectedVersion: input.expectedVersion,
    payload: input.payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    label: input.label,
  };
  queue.push(mutation);
  writeQueue(queue);
  console.warn(`[offlineQueue] Enqueued ${input.operation} on ${input.table} (ID: ${id}). Queue length: ${queue.length}`);
  return id;
}

/**
 * Attempt to flush ALL pending mutations to Supabase.
 * - Successfully synced records are removed from the queue.
 * - Failed records stay queued with incremented `attempts`.
 * - Records that exceed MAX_ATTEMPTS are dead-lettered (removed + logged).
 *
 * Returns a summary of what happened.
 */
export async function flushQueue(): Promise<{
  succeeded: number;
  failed: number;
  deadLettered: number;
  remaining: number;
}> {
  const queue = readQueue();
  if (queue.length === 0) return { succeeded: 0, failed: 0, deadLettered: 0, remaining: 0 };

  if (!supabaseConfigured) {
    return { succeeded: 0, failed: queue.length, deadLettered: 0, remaining: queue.length };
  }

  const sb = getSupabase()!;
  const stillPending: QueuedMutation[] = [];
  let succeeded = 0;
  let failed = 0;
  let deadLettered = 0;

  for (const mut of queue) {
    // Dead-letter if too many attempts
    if (mut.attempts >= MAX_ATTEMPTS) {
      deadLettered++;
      console.error(`[offlineQueue] Dead-lettered mutation ${mut.id} after ${MAX_ATTEMPTS} attempts: ${mut.lastError}`);
      continue;
    }

    try {
      let result;
      if (mut.operation === "insert") {
        result = await sb.from(mut.table).insert(mut.payload).select("id").single();
      } else if (mut.operation === "update") {
        let query = sb.from(mut.table).update(mut.payload).eq("id", mut.recordId!);
        if (mut.expectedVersion !== undefined) query = query.eq("version", mut.expectedVersion);
        result = await query.select("id").single();
      } else {
        let query = sb.from(mut.table).delete().eq("id", mut.recordId!);
        if (mut.expectedVersion !== undefined) query = query.eq("version", mut.expectedVersion);
        result = await query;
      }

      if (result.error) {
        throw result.error;
      }

      // Check if UPDATE affected 0 rows (optimistic concurrency conflict)
      if (mut.operation === "update" && !result.data) {
        throw new Error("Optimistic concurrency conflict — record was modified by another user");
      }

      succeeded++;
      console.info(`[offlineQueue] ✅ Synced mutation ${mut.id} (${mut.label})`);
    } catch (e) {
      failed++;
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      stillPending.push({
        ...mut,
        attempts: mut.attempts + 1,
        lastError: errorMsg,
      });
      console.warn(`[offlineQueue] ❌ Failed to sync mutation ${mut.id} (attempt ${mut.attempts + 1}/${MAX_ATTEMPTS}): ${errorMsg}`);
    }
  }

  writeQueue(stillPending);
  return { succeeded, failed, deadLettered, remaining: stillPending.length };
}

/**
 * Get the current count of pending mutations (for UI badges).
 */
export function getQueueLength(): number {
  return readQueue().length;
}

/**
 * Get all pending mutations (for UI display).
 */
export function getQueuedItems(): QueuedMutation[] {
  return readQueue();
}

/**
 * Remove a specific mutation from the queue (used after successful sync
 * in the calling code, or for manual cancellation).
 */
export function removeFromQueue(mutationId: string): void {
  const queue = readQueue().filter(m => m.id !== mutationId);
  writeQueue(queue);
}

/**
 * Clear the entire queue (used on sign-out or admin reset).
 */
export function clearQueue(): void {
  writeQueue([]);
}
