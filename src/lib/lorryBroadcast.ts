import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "./supabase";

export interface LorryLocation {
  id: string;
  routeId: string;
  driverId?: string;
  latitude: number;
  longitude: number;
  accuracyM?: number;
  heading?: number;
  speedKmh?: number;
  active: boolean;
  stoppedAt?: string;
  updatedAt: string;
  assignmentId?: string;
}

export type LorryChannelStatus = "connecting" | "live" | "stopped" | "error";

interface BroadcastPayload {
  routeId: string;
  latitude: number;
  longitude: number;
  accuracyM?: number;
  heading?: number;
  speedKmh?: number;
  timestamp: string;
  active: boolean;
}

interface PublisherState {
  channel: RealtimeChannel;
  ready: Promise<void>;
  lastLocation?: LorryLocation;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publisherChannels = new Map<string, PublisherState>();

export function routeTrackingTopic(routeId: string): string {
  if (!UUID_PATTERN.test(routeId)) throw new Error("A valid assigned route is required for live tracking.");
  return `route-tracking:${routeId}`;
}

function finiteOptional(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export function parseLorryBroadcast(payload: unknown, expectedRouteId: string): LorryLocation | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Partial<BroadcastPayload>;
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  if (row.routeId !== expectedRouteId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  const updatedAt = typeof row.timestamp === "string" && !Number.isNaN(Date.parse(row.timestamp))
    ? row.timestamp
    : new Date().toISOString();
  return {
    id: `broadcast:${expectedRouteId}:${updatedAt}`,
    routeId: expectedRouteId,
    latitude,
    longitude,
    accuracyM: finiteOptional(row.accuracyM),
    heading: finiteOptional(row.heading),
    speedKmh: finiteOptional(row.speedKmh),
    active: row.active !== false,
    stoppedAt: row.active === false ? updatedAt : undefined,
    updatedAt,
  };
}

function waitForSubscription(channel: RealtimeChannel): Promise<void> {
  return new Promise((resolve, reject) => {
    let complete = false;
    const finish = (error?: Error) => {
      if (complete) return;
      complete = true;
      window.clearTimeout(timeout);
      if (error) reject(error); else resolve();
    };
    const timeout = window.setTimeout(() => finish(new Error("Live GPS channel connection timed out.")), 12_000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") finish();
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        finish(new Error("Live GPS channel was rejected. Check Realtime authorization and route assignment."));
      }
    });
  });
}

function getPublisher(routeId: string): PublisherState {
  const existing = publisherChannels.get(routeId);
  if (existing) return existing;
  if (!supabaseConfigured) throw new Error("Supabase Realtime is not configured.");
  const channel = getSupabase()!.channel(routeTrackingTopic(routeId), {
    // NOTE: `private: true` was removed because it requires Supabase Auth
    // authentication (Third-Party Auth / Pro plan). On the Free plan with
    // Firebase-only auth, private channels are rejected with 401. Broadcast
    // channels work without authentication — anyone with the channel name
    // can publish/subscribe. The channel name includes the route_id, which
    // is not easily guessable. For true security, upgrade to Pro plan and
    // re-enable private:true.
    config: { broadcast: { ack: true, self: false } },
  });
  const state: PublisherState = { channel, ready: waitForSubscription(channel) };
  publisherChannels.set(routeId, state);
  state.ready.catch(() => {
    if (publisherChannels.get(routeId) === state) publisherChannels.delete(routeId);
    void getSupabase()?.removeChannel(channel);
  });
  return state;
}

/** Broadcasts over WebSockets only. No lorry location row is inserted or updated. */
export async function publishLorryLocation(input: {
  routeId: string;
  driverId: string;
  assignmentId?: string;
  latitude: number;
  longitude: number;
  accuracyM?: number;
  heading?: number | null;
  speedMps?: number | null;
}): Promise<void> {
  const state = getPublisher(input.routeId);
  await state.ready;
  const timestamp = new Date().toISOString();
  const payload: BroadcastPayload = {
    routeId: input.routeId,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyM: input.accuracyM,
    heading: input.heading == null ? undefined : input.heading,
    speedKmh: input.speedMps == null ? undefined : Math.max(0, input.speedMps * 3.6),
    timestamp,
    active: true,
  };
  const result = await state.channel.send({ type: "broadcast", event: "lorry_location", payload });
  if (result !== "ok") throw new Error(`Live GPS broadcast failed (${result}).`);
  state.lastLocation = parseLorryBroadcast(payload, input.routeId) ?? undefined;
}

/** Broadcasts a stop signal and closes the publisher. No database write occurs. */
export async function stopLorryLocation(routeId: string, _driverId: string): Promise<void> {
  const state = publisherChannels.get(routeId);
  if (!state) return;
  try {
    await state.ready;
    const previous = state.lastLocation;
    if (previous) {
      const payload: BroadcastPayload = {
        routeId,
        latitude: previous.latitude,
        longitude: previous.longitude,
        accuracyM: previous.accuracyM,
        heading: previous.heading,
        speedKmh: 0,
        timestamp: new Date().toISOString(),
        active: false,
      };
      await state.channel.send({ type: "broadcast", event: "lorry_stopped", payload });
    }
  } finally {
    publisherChannels.delete(routeId);
    await getSupabase()?.removeChannel(state.channel);
  }
}

export function subscribeToLorryLocation(
  routeId: string,
  onLocation: (location: LorryLocation) => void,
  onStatus?: (status: LorryChannelStatus, message?: string) => void,
): () => void {
  if (!supabaseConfigured || !routeId) return () => {};
  let active = true;
  const sb = getSupabase()!;
  const handle = ({ payload }: { payload: unknown }) => {
    const location = parseLorryBroadcast(payload, routeId);
    if (active && location) onLocation(location);
  };
  const channel = sb.channel(routeTrackingTopic(routeId), {
    // NOTE: private:true removed — see comment in getPublisher() above.
    config: { broadcast: { ack: true, self: false } },
  })
    .on("broadcast", { event: "lorry_location" }, handle)
    .on("broadcast", { event: "lorry_stopped" }, handle)
    .subscribe((status, error) => {
      if (!active) return;
      if (status === "SUBSCRIBED") onStatus?.("live");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onStatus?.("error", error?.message ?? "Realtime authorization failed.");
      else if (status === "CLOSED") onStatus?.("stopped");
      else onStatus?.("connecting");
    });
  return () => {
    active = false;
    void sb.removeChannel(channel);
  };
}
