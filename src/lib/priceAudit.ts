import { getSupabase, supabaseConfigured } from "./supabase";

export interface AuditedTeaPrice {
  id: string; factoryId?: string; grade: string; priceDate: string; price: number;
  previousPrice?: number; changedBy?: string; changedAt?: string;
  approvalStatus: "pending" | "approved" | "rejected"; changeReason?: string;
}

export async function readPriceHistory(factoryId?: string): Promise<AuditedTeaPrice[]> {
  if (!supabaseConfigured) return [];
  let query = getSupabase()!.from("daily_tea_prices").select("id,factory_id,grade,price_date,price_per_kg,previous_price,changed_by,changed_at,approval_status,change_reason").order("changed_at", { ascending: false }).limit(250);
  if (factoryId) query = query.eq("factory_id", factoryId);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load price history: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, factoryId: row.factory_id ?? undefined, grade: row.grade, priceDate: row.price_date, price: Number(row.price_per_kg), previousPrice: row.previous_price == null ? undefined : Number(row.previous_price), changedBy: row.changed_by ?? undefined, changedAt: row.changed_at ?? undefined, approvalStatus: row.approval_status, changeReason: row.change_reason ?? undefined }));
}

export async function requestPriceChange(input: { id: string; newPrice: number; reason: string; actorId: string }): Promise<void> {
  const { error } = await getSupabase()!.rpc("request_tea_price_change", { p_price_id: input.id, p_new_price: input.newPrice, p_reason: input.reason, p_actor_id: input.actorId });
  if (error) throw new Error(`Could not request price change: ${error.message}`);
}

export async function decidePriceChange(id: string, approve: boolean, actorId: string): Promise<void> {
  const { error } = await getSupabase()!.rpc("decide_tea_price_change", { p_price_id: id, p_approve: approve, p_actor_id: actorId });
  if (error) throw new Error(`Could not decide price change: ${error.message}`);
}

export async function rollbackPrice(id: string, actorId: string): Promise<void> {
  const { error } = await getSupabase()!.rpc("rollback_tea_price", { p_price_id: id, p_actor_id: actorId });
  if (error) throw new Error(`Could not roll back price: ${error.message}`);
}
