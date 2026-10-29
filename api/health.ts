import type { IncomingMessage, ServerResponse } from "node:http";

/** Lightweight production probe proving that Vercel's Node runtime can load API functions. */
export default function handler(_request: IncomingMessage, response: ServerResponse): void {
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify({ ok: true, service: "factory-api-proxy" }));
}
