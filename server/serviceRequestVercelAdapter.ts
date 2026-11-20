import type { IncomingMessage, ServerResponse } from "node:http";
import { handleServiceRequest } from "./serviceRequestWorkflow.js";

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function readBody(request: IncomingMessage): Promise<Buffer | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export function createServiceRequestHandler() {
  return async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
      else if (value !== undefined) headers.set(name, value);
    }
    const protocol = firstHeader(request.headers["x-forwarded-proto"]) ?? "https";
    const host = firstHeader(request.headers.host) ?? "localhost";
    const url = new URL(request.url ?? "/", `${protocol}://${host}`);
    const body = await readBody(request);
    const result = await handleServiceRequest(new Request(url, {
      method: request.method ?? "GET",
      headers,
      body: body?.toString("utf8"),
    }));
    response.statusCode = result.status;
    result.headers.forEach((value, name) => response.setHeader(name, value));
    response.end(await result.text());
  };
}
