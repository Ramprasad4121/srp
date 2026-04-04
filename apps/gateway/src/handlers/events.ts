import type { IncomingMessage, ServerResponse } from "node:http";
import type { SrpEvent } from "@srp/events";
import { sharedEventBus } from "../events/event-bus.js";

// ---------------------------------------------------------------------------
// GET /api/events
// ---------------------------------------------------------------------------

/**
 * Handles Server-Sent Events (SSE) connections.
 * Subscribes to the global Gateway EventBus and pushes updates to the connected client.
 */
export async function handleGetEvents(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  // 1. Send SSE required headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });

  // 2. Define the callback that pushes events to the socket
  const onEvent = (event: SrpEvent) => {
    // SSE format: data: <json>\n\n
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    // Optional flush if compression/buffer proxies lie between client and server
    if (typeof (res as any).flush === "function") {
      (res as any).flush();
    }
  };

  // 3. Subscribe to the event bus
  const unsubscribe = sharedEventBus.subscribe(onEvent);

  // 4. Handle client disconnect correctly
  res.on("close", () => {
    unsubscribe();
    res.end();
  });
}
