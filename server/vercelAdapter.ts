import type { IncomingMessage, ServerResponse } from "node:http";
import { handleFactoryRequest } from "./factoryProxy.js";

export type FactoryEndpointKind = "balance" | "crop" | "monthly" | "lorry";

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Adapt Vercel's Node.js function request/response to the shared Web API handler. */
export function createVercelHandler(kind: FactoryEndpointKind) {
  return async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
      else if (value !== undefined) headers.set(name, value);
    }
    const protocol = firstHeader(request.headers["x-forwarded-proto"]) ?? "https";
    const host = firstHeader(request.headers.host) ?? "localhost";
    const url = new URL(request.url ?? "/", `${protocol}://${host}`);
    const webRequest = new Request(url, { method: request.method ?? "GET", headers });
    const result = await handleFactoryRequest(kind, webRequest);

    response.statusCode = result.status;
    result.headers.forEach((value, name) => response.setHeader(name, value));
    response.end(await result.text());
  };
}
