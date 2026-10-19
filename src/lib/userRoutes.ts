import { getSupabase, supabaseConfigured } from "./supabase";
import { formatRouteLabel, type RouteOption } from "./supplierOperations";

export interface UserRouteAssignment extends RouteOption {
  isPrimary: boolean;
}

export function normalizeRouteSelection(routeIds: string[], primaryRouteId?: string): { routeIds: string[]; primaryRouteId: string } {
  const unique = [...new Set(routeIds.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) throw new Error("Select at least one route.");
  const primary = primaryRouteId && unique.includes(primaryRouteId) ? primaryRouteId : unique[0];
  return { routeIds: unique, primaryRouteId: primary };
}

export async function assertMultiRouteSchemaReady(): Promise<void> {
  if (!supabaseConfigured) return;
  const { data, error } = await getSupabase()!.rpc("multi_route_schema_ready");
  if (error || data !== true) {
    throw new Error("Database multi-route update is required. Ask an administrator to apply the Round 14 migration first.");
  }
}

export async function readUserRouteAssignments(userId: string): Promise<UserRouteAssignment[]> {
  if (!supabaseConfigured || !userId) return [];
  const sb = getSupabase()!;
  const { data, error } = await sb.from("user_route_assignments")
    .select("factory_id,route_id,is_primary,routes(route_name,route_code)")
    .eq("user_id", userId)
    .order("is_primary", { ascending: false });
  if (!error) {
    return (data ?? []).map((row) => {
      const route = row.routes as unknown as { route_name?: string; route_code?: string } | null;
      const name = route?.route_name ?? "Assigned route";
      const code = route?.route_code ?? undefined;
      return { id: row.route_id, factoryId: row.factory_id, name, code, label: formatRouteLabel(name, code), isPrimary: row.is_primary === true };
    });
  }
  // Deployment-safe fallback for a single primary route before Round 14.
  if (/user_route_assignments|relation .* does not exist|schema cache/i.test(error.message)) {
    const fallback = await sb.from("users").select("factory_id,route_id,routes(route_name,route_code)").eq("id", userId).maybeSingle();
    if (fallback.error || !fallback.data?.route_id || !fallback.data.factory_id) return [];
    const route = fallback.data.routes as unknown as { route_name?: string; route_code?: string } | null;
    const name = route?.route_name ?? "Assigned route";
    const code = route?.route_code ?? undefined;
    return [{ id: fallback.data.route_id, factoryId: fallback.data.factory_id, name, code, label: formatRouteLabel(name, code), isPrimary: true }];
  }
  throw new Error(`Could not load user routes: ${error.message}`);
}

export async function replaceUserRoutes(input: {
  userId: string;
  factoryId: string;
  routeIds: string[];
  primaryRouteId?: string;
  registrationEmail?: string;
}): Promise<void> {
  if (!supabaseConfigured) return;
  const selection = normalizeRouteSelection(input.routeIds, input.primaryRouteId);
  const { error } = await getSupabase()!.rpc("set_user_routes", {
    p_user_id: input.userId,
    p_factory_id: input.factoryId,
    p_route_ids: selection.routeIds,
    p_primary_route_id: selection.primaryRouteId,
    p_registration_email: input.registrationEmail?.trim().toLowerCase() || null,
  });
  if (error) {
    const hint = /route assignment access denied/i.test(error.message)
      ? " Apply docs/migration_phase3_round15_route_assignment_hotfix.sql in Supabase SQL Editor."
      : "";
    throw new Error(`Could not save route assignments: ${error.message}.${hint}`);
  }
}
