import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return Response.json({ allowed: false }, { status: 405, headers: cors });
  try {
    const { email, phone } = await request.json();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedPhone = String(phone || "").replace(/\s+/g, "");
    const [ipHash, emailHash, phoneHash] = await Promise.all([hash(ip), hash(normalizedEmail), hash(normalizedPhone)]);
    const duplicateFilters = [`email.eq.${normalizedEmail}`];
    if (normalizedPhone) duplicateFilters.push(`phone.eq.${normalizedPhone}`);
    const { data: existing, error: duplicateError } = await db.from("users").select("id").or(duplicateFilters.join(",")).limit(1);
    if (duplicateError) throw duplicateError;
    if (existing?.length) {
      await db.from("admin_audit_log").insert({
        admin_id: "edge:rate-limit", action: "registration_blocked", entity_type: "registration_attempt", entity_id: crypto.randomUUID(),
        details: { ip_hash: ipHash, email_hash: emailHash, phone_hash: normalizedPhone ? phoneHash : null, reason: "account_exists" },
      });
      return Response.json({ allowed: false, reason: "account_exists" }, { status: 200, headers: cors });
    }
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const { data, error } = await db.from("admin_audit_log").select("created_at,details").eq("action", "registration_attempt").gte("created_at", dayAgo).limit(500);
    if (error) throw error;
    const rows = data ?? [];
    const ipCount = rows.filter((row) => row.created_at >= hourAgo && row.details?.ip_hash === ipHash).length;
    const duplicateEmail = rows.some((row) => row.details?.email_hash === emailHash);
    const duplicatePhone = normalizedPhone && rows.some((row) => row.details?.phone_hash === phoneHash);
    const allowed = ipCount < 3 && !duplicateEmail && !duplicatePhone;
    await db.from("admin_audit_log").insert({
      admin_id: "edge:rate-limit", action: allowed ? "registration_attempt" : "registration_blocked",
      entity_type: "registration_attempt", entity_id: crypto.randomUUID(),
      details: { ip_hash: ipHash, email_hash: emailHash, phone_hash: normalizedPhone ? phoneHash : null, reason: allowed ? "allowed" : "rate_limit" },
    });
    return Response.json({ allowed, reason: allowed ? "allowed" : "rate_limit" }, { status: 200, headers: cors });
  } catch (error) {
    return Response.json({ allowed: false, error: error instanceof Error ? error.message : "rate_limit_failed" }, { status: 500, headers: cors });
  }
});
