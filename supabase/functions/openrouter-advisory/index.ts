import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: Record<string, unknown>, status = 200) => Response.json(body, { status, headers: cors });

function jwtSubject(authorization: string): string | null {
  try {
    const token = authorization.replace(/^Bearer\s+/i, "");
    const encoded = token.split(".")[1];
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const payload = JSON.parse(atob(normalized));
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

function responseText(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content.map((part) => typeof part === "object" && part && "text" in part ? String(part.text) : "").join(" ").trim();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const userId = jwtSubject(authorization);
    if (!userId) return json({ error: "authentication_required" }, 401);

    const { routeId, estateId, distanceKm, etaMinutes, language } = await request.json();
    const distance = Number(distanceKm);
    const eta = Math.ceil(Number(etaMinutes));
    if (typeof routeId !== "string" || typeof estateId !== "string" || !Number.isFinite(distance) || distance < 0 || distance >= 1.5 || !Number.isFinite(eta) || eta < 1 || eta > 180) {
      return json({ error: "invalid_proximity_context" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openRouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!url || !serviceKey || !openRouterKey) return json({ error: "server_not_configured" }, 503);

    // The Edge gateway verifies the JWT. This server-side lookup additionally
    // proves that the caller owns both the requested route and estate.
    const db = createClient(url, serviceKey);
    const { data: user, error: userError } = await db.from("users")
      .select("status,deactivated_at")
      .eq("id", userId).eq("role", "supplier").maybeSingle();
    if (userError || !user || user.status !== "active" || user.deactivated_at) {
      return json({ error: "route_access_denied" }, 403);
    }
    const { data: routeAccess, error: routeAccessError } = await db.from("user_route_assignments")
      .select("route_id")
      .eq("user_id", userId).eq("route_id", routeId).maybeSingle();
    if (routeAccessError || !routeAccess) return json({ error: "route_access_denied" }, 403);
    const { data: estate, error: estateError } = await db.from("estates")
      .select("id")
      .eq("id", estateId).eq("owner_supplier_id", userId).eq("route_id", routeId).maybeSingle();
    if (estateError || !estate) return json({ error: "estate_access_denied" }, 403);

    const languageName = language === "si" ? "professional written Sinhala" : language === "ta" ? "standard written Tamil" : "clear English";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let upstream: Response;
    try {
      upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": request.headers.get("origin") ?? "https://akashpereraproject24.vercel.app",
          "X-Title": "KDU Estate Management System",
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.25,
          max_tokens: 180,
          messages: [
            {
              role: "system",
              content: `You are a tea-estate collection safety assistant. Reply in ${languageName} using two short, friendly, actionable sentences. Advise leaf-bag readiness, leaf quality protection and safe handover. Never invent traffic, weather, road or arrival facts that were not supplied. Do not use markdown. Do not mention AI.`,
            },
            {
              role: "user",
              content: `A collection lorry is ${distance.toFixed(2)} km from a registered tea-estate collection point with an estimated arrival time of ${eta} minutes. Give the supplier immediate preparation advice.`,
            },
          ],
        }),
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!upstream.ok) {
      console.error("OpenRouter advisory failed", upstream.status, await upstream.text());
      return json({ error: "advisory_provider_unavailable" }, 502);
    }
    const result = await upstream.json();
    const advice = responseText(result?.choices?.[0]?.message?.content).slice(0, 900);
    if (!advice) return json({ error: "empty_advisory" }, 502);
    return json({ advice, model: MODEL, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("openrouter-advisory", error instanceof Error ? error.message : error);
    return json({ error: "advisory_failed" }, 500);
  }
});
