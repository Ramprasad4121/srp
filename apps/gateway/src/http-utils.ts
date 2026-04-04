import type { IncomingMessage, ServerResponse } from "node:http";

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

export function sendJson<T>(res: ServerResponse, statusCode: number, body: T): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "*"
  });
  res.end(payload);
}

export interface ApiError {
  readonly error: string;
  readonly detail?: string;
}

export function sendError(
  res: ServerResponse,
  statusCode: number,
  error: string,
  detail?: string
): void {
  const body: ApiError = detail !== undefined ? { error, detail } : { error };
  sendJson(res, statusCode, body);
}

// ---------------------------------------------------------------------------
// Request body parsing
// ---------------------------------------------------------------------------

const MAX_BODY_BYTES = 64 * 1024; // 64 KiB — enough for any setup payload

export async function readJsonBody<T>(req: IncomingMessage): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.on("data", (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        req.destroy(new Error("Request body too large"));
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw.trim().length === 0) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw) as T);
      } catch {
        resolve(null);
      }
    });

    req.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// CORS preflight
// ---------------------------------------------------------------------------

export function handleCorsOptions(res: ServerResponse): void {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end();
}
