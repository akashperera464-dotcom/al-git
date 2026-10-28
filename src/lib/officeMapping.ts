import { getSupabase, supabaseConfigured } from "./supabase";

export interface FactoryOfficeMapping { id: string; name: string; officeFactoryCode: string }
export interface RouteOfficeMapping { id: string; factoryId: string; name: string; routeCode?: string; officeRouteCode: string }

const migrationHint = (message: string) => /office_factory_code|office_route_code|office_supplier_id|schema cache/i.test(message)
  ? " Run docs/migration_phase3_round16_factory_api_mapping.sql first."
  : "";

export async function readFactoryOfficeMappings(): Promise<FactoryOfficeMapping[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await getSupabase()!.from("factories").select("id,name,office_factory_code").order("name");
  if (error) throw new Error(`Could not load office factory mappings: ${error.message}.${migrationHint(error.message)}`);
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, officeFactoryCode: row.office_factory_code ?? "" }));
}

export async function readRouteOfficeMappings(factoryId: string): Promise<RouteOfficeMapping[]> {
  if (!supabaseConfigured || !factoryId) return [];
  const { data, error } = await getSupabase()!.from("routes").select("id,factory_id,route_name,route_code,office_route_code").eq("factory_id", factoryId).order("route_name");
  if (error) throw new Error(`Could not load office route mappings: ${error.message}.${migrationHint(error.message)}`);
  return (data ?? []).map((row) => ({ id: row.id, factoryId: row.factory_id, name: row.route_name, routeCode: row.route_code ?? undefined, officeRouteCode: row.office_route_code ?? "" }));
}

export async function saveFactoryOfficeCode(id: string, code: string): Promise<void> {
  const { error } = await getSupabase()!.from("factories").update({ office_factory_code: code.trim() || null }).eq("id", id);
  if (error) throw new Error(`Could not save factory API code: ${error.message}`);
}

export async function saveRouteOfficeCode(id: string, code: string): Promise<void> {
  const { error } = await getSupabase()!.from("routes").update({ office_route_code: code.trim() || null }).eq("id", id);
  if (error) throw new Error(`Could not save route API code: ${error.message}`);
}
