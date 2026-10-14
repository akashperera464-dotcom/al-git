import { getSupabase, supabaseConfigured } from "./supabase";

export const MINIMUM_SCHEMA_VERSION = "round_15";

export async function readLatestSchemaVersion(): Promise<string | null> {
  if (!supabaseConfigured) return null;
  const sb = getSupabase()!;

  // Round 14 exposes a deliberately read-only readiness RPC to both anon and
  // authenticated clients. Prefer it because schema_migrations itself is RLS
  // protected and therefore correctly returns zero rows to public sessions.
  const readiness = await sb.rpc("multi_route_schema_ready");

  // Compatibility fallback for databases that predate Round 14. Read every
  // visible version and compare the numeric round, rather than applied_at:
  // re-running an older idempotent migration must not make the schema appear
  // to move backwards.
  const { data, error } = await sb.from("schema_migrations").select("version");
  if (error) return !readiness.error && readiness.data === true ? "round_14" : null;
  return highestSchemaVersion((data ?? []).map((row) => row.version))
    ?? (!readiness.error && readiness.data === true ? "round_14" : null);
}

export function highestSchemaVersion(versions: Array<string | null | undefined>): string | null {
  const rounds = versions
    .map((version) => Number(version?.match(/^round_(\d+)$/)?.[1] ?? 0))
    .filter((round) => Number.isFinite(round) && round > 0);
  return rounds.length ? `round_${Math.max(...rounds)}` : null;
}

export const schemaMeetsMinimum = (version: string | null) => {
  const installed = Number(version?.match(/^round_(\d+)$/)?.[1] ?? 0);
  const minimum = Number(MINIMUM_SCHEMA_VERSION.match(/^round_(\d+)$/)?.[1] ?? 0);
  return installed >= minimum;
};
