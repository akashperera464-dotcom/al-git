import { getSupabase, supabaseConfigured } from "./supabase";
import { seedAssignmentStops } from "./connectedOperations";

export type AssignmentStatus = "assigned" | "started" | "completed" | "cancelled";
export interface CollectorAssignment {
  id: string; collectorId: string; factoryId: string; routeId: string; assignmentDate: string;
  lorryPlate?: string; status: AssignmentStatus; startedAt?: string; completedAt?: string;
  collectorName?: string; factoryName?: string; routeName?: string; routeCode?: string;
}
export interface CollectorOption { id: string; name: string }

export async function readCollectors(): Promise<CollectorOption[]> {
  if (!supabaseConfigured) return [];
  const { data, error } = await getSupabase()!.from("users").select("id,name").eq("role", "extension_officer").eq("status", "active").order("name");
  if (error) throw new Error(`Could not load collectors: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, name: row.name ?? "Collector" }));
}

const map = (row: Record<string, any>): CollectorAssignment => ({
  id: row.id, collectorId: row.collector_id, factoryId: row.factory_id, routeId: row.route_id,
  assignmentDate: row.assignment_date, lorryPlate: row.lorry_plate ?? undefined, status: row.status,
  startedAt: row.started_at ?? undefined, completedAt: row.completed_at ?? undefined,
  collectorName: row.collector?.name, factoryName: row.factory?.name,
  routeName: row.route?.route_name, routeCode: row.route?.route_code,
});

const SELECT = "id,collector_id,factory_id,route_id,assignment_date,lorry_plate,status,started_at,completed_at,collector:users!collector_route_assignments_collector_id_fkey(name),factory:factories!collector_route_assignments_factory_id_fkey(name),route:routes!collector_route_assignments_route_id_fkey(route_name,route_code)";

export async function readAssignments(date?: string): Promise<CollectorAssignment[]> {
  if (!supabaseConfigured) return [];
  let query = getSupabase()!.from("collector_route_assignments").select(SELECT).order("assignment_date");
  if (date) query = query.eq("assignment_date", date);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load route assignments: ${error.message}`);
  return (data ?? []).map((row) => map(row as Record<string, any>));
}

export async function readTodayAssignment(collectorId: string, date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date())): Promise<CollectorAssignment | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await getSupabase()!.from("collector_route_assignments").select(SELECT).eq("collector_id", collectorId).eq("assignment_date", date).maybeSingle();
  if (error) throw new Error(`Could not load today's route: ${error.message}`);
  return data ? map(data as Record<string, any>) : null;
}

export async function saveAssignment(input: Omit<CollectorAssignment, "id" | "status"> & { assignedBy: string }): Promise<void> {
  const { data, error } = await getSupabase()!.from("collector_route_assignments").upsert({
    collector_id: input.collectorId, factory_id: input.factoryId, route_id: input.routeId,
    assignment_date: input.assignmentDate, lorry_plate: input.lorryPlate || null, assigned_by: input.assignedBy,
    status: "assigned", started_at: null, completed_at: null,
  }, { onConflict: "collector_id,assignment_date" }).select("id").single();
  if (error) throw new Error(`Could not save assignment: ${error.message}`);
  await seedAssignmentStops(data.id, input.routeId).catch(() => {});
}

export async function updateAssignmentStatus(id: string, status: AssignmentStatus): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "started") patch.started_at = new Date().toISOString();
  if (status === "completed") patch.completed_at = new Date().toISOString();
  const { error } = await getSupabase()!.from("collector_route_assignments").update(patch).eq("id", id);
  if (error) throw new Error(`Could not update assignment: ${error.message}`);
}
