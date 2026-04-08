import { createServer as createHttpServer } from "node:http";
import type { Server } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { routeRequest } from "./router.js";
import { stopSession } from "./runtime/session-manager.js";

/**
 * Basic .env loader to support local development without external dependencies.
 */
async function loadEnvFile(rootDirectory: string): Promise<void> {
  try {
    const envPath = join(rootDirectory, ".env");
    const content = await readFile(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (key && rest.length > 0) {
        process.env[key.trim()] = rest.join("=").trim();
      }
    }
  } catch (err) {
    // Ignore if .env doesn't exist
  }
}

// ---------------------------------------------------------------------------
// Server configuration
// ---------------------------------------------------------------------------

export interface GatewayServerConfig {
  /** Workspace root directory. Defaults to process.cwd(). */
  readonly rootDirectory?: string;
  /** Port to listen on. 0 = OS-assigned ephemeral port (useful in tests). */
  readonly port?: number;
  /** Hostname to bind to. Defaults to "127.0.0.1". */
  readonly host?: string;
  /** Environment to use for provider health checks. Defaults to process.env. */
  readonly environment?: NodeJS.ProcessEnv;
}

export interface StartedGatewayServer {
  /** The underlying Node.js HTTP server. */
  readonly server: Server;
  /** Actual port the server is listening on (useful when port was 0). */
  readonly port: number;
  /** Host the server is bound to. */
  readonly host: string;
  /** Cleanly closes the server and waits for it to stop. */
  readonly stop: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates and starts the SRP gateway HTTP server.
 *
 * Returns a StartedGatewayServer so callers can await a clean shutdown,
 * and so tests can pin a random ephemeral port (port: 0).
 */
export async function createGatewayServer(
  config: GatewayServerConfig = {}
): Promise<StartedGatewayServer> {
  const rootDirectory = config.rootDirectory ?? process.cwd();
  
  // Load environment variables before routing requests
  await loadEnvFile(rootDirectory);

  const port = config.port ?? 6969;
  const host = config.host ?? "0.0.0.0";
  const environment = config.environment ?? process.env;

  const routerConfig = { rootDirectory, environment };

  console.log(`[Server] Initializing SRP Gateway on ${host}:${port}...`);
  const server = createHttpServer((req, res) => {
    routeRequest(req, res, routerConfig).catch((err: unknown) => {
      // Last-resort: swallow unhandled handler errors so the server stays up
      const detail = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal_error", detail }));
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  const actualPort = (server.address() as { port: number }).port;

  const stop = async (): Promise<void> => {
    await stopSession();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  return { server, port: actualPort, host, stop };
}
