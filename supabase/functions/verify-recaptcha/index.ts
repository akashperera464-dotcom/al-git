import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return Response.json({ ok: false }, { status: 405, headers: cors });
  try {
    const { token, action } = await request.json();
    const secret = Deno.env.get("RECAPTCHA_SECRET_KEY");
    if (!secret || !token) return Response.json({ ok: false, reason: "missing_configuration" }, { status: 400, headers: cors });
    const body = new URLSearchParams({ secret, response: token });
    const result = await fetch("https://www.google.com/recaptcha/api/siteverify", { method: "POST", body });
    const verification = await result.json();
    const ok = verification.success === true && Number(verification.score ?? 0) >= 0.5 && (!action || verification.action === action);
    return Response.json({ ok, score: verification.score ?? 0 }, { status: ok ? 200 : 403, headers: cors });
  } catch {
    return Response.json({ ok: false }, { status: 400, headers: cors });
  }
});
