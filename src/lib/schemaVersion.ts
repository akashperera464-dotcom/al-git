import { getSupabase, supabaseConfigured } from "./supabase";

export const MINIMUM_SCHEMA_VERSION = "round_14";

export async function readLatestSchemaVersion(): Promise<string | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await getSupabase()!.from("schema_migrations").select("version,applied_at").order("applied_at", { ascending: false }).limit(1).maybeSingle();
  if (error) return null;
  return data?.version ?? null;
}

export const schemaMeetsMinimum = (version: string | null) => {
  const installed = Number(version?.match(/^round_(\d+)$/)?.[1] ?? 0);
  const minimum = Number(MINIMUM_SCHEMA_VERSION.match(/^round_(\d+)$/)?.[1] ?? 0);
  return installed >= minimum;
};
