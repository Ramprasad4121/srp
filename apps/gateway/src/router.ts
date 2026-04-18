import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { handleGetRuntime, handlePostRuntimeStart } from "./handlers/runtime.js";
import { handleGetBootstrap } from "./handlers/bootstrap.js";
import { handleGetEvents } from "./handlers/events.js";
import {
  handleGetSetup,
  handlePostCompleteProviders,
  handlePostCompleteWelcome,
  handlePostCompleteWorkspace,
  handlePostSetupProviders,
  handlePostSetupRole,
  handlePostSetupWorkspace
} from "./handlers/setup.js";
import { handleGetRuns, handleGetRunDetail } from "./handlers/runs.js";
import {
  handleListConversations,
  handleCreateConversation,
  handleGetConversation,
  handleAddMessage,
  handleStreamingChat
} from "./handlers/chat.js";
import { handleGetSkill, handleListSkills } from "./handlers/skills.js";
import { handleGetControlPlane } from "./handlers/control-plane.js";
import { handleCorsOptions, sendError } from "./http-utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Router config — injected from server, so handlers stay pure
// ---------------------------------------------------------------------------

export interface RouterConfig {
  readonly rootDirectory: string;
  readonly environment: NodeJS.ProcessEnv;
}

async function resolveWebDistPath(rootDirectory: string, gatewayDir: string): Promise<string> {
  const candidates = [
    join(rootDirectory, "apps/web/dist-web"),
    join(gatewayDir, "../../apps/web/dist-web")
  ];

  for (const candidate of candidates) {
    try {
      await readFile(join(candidate, "index.html"), "utf8");
      return candidate;
    } catch {
      // try next candidate
    }
  }

  throw new Error(`Unable to locate web build output. Tried: ${candidates.join(", ")}`);
}

async function findWebEntryScript(webDistPath: string): Promise<string | null> {
  try {
    const assets = await readdir(join(webDistPath, "assets"));
    const candidates = assets
      .filter((file) => /^index-.*\.js$/.test(file))
      .sort();

    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const file = candidates[index];
      if (!file) {
        continue;
      }
      const details = await stat(join(webDistPath, "assets", file));
      if (details.size > 0) {
        return `/assets/${file}`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function loadIndexHtml(webDistPath: string): Promise<string> {
  const indexPath = join(webDistPath, "index.html");
  let content = await readFile(indexPath, "utf-8");
  const entryScript = await findWebEntryScript(webDistPath);

  if (!entryScript) {
    return content;
  }

  if (content.includes('src="/src/index.ts"')) {
    content = content.replace(
      /<script[^>]*type="module"[^>]*src="\/src\/index\.ts"[^>]*><\/script>/,
      `<script type="module" crossorigin src="${entryScript}"></script>`
    );
  }

  if (!content.includes(entryScript) && !/src="\/assets\/index-.*\.js"/.test(content)) {
    content = content.replace("</head>", `  <script type="module" crossorigin src="${entryScript}"></script>\n</head>`);
  }

  return content;
}

// ---------------------------------------------------------------------------
// Route dispatch
// ---------------------------------------------------------------------------

export async function routeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: RouterConfig
): Promise<void> {
  const method = req.method ?? "GET";
  const url = req.url ?? "/";

  // Strip query string for routing
  const path = url.split("?")[0] ?? "/";

  console.log(`[Gateway] ${method} ${path}`);

  // CORS preflight
  if (method === "OPTIONS") {
    handleCorsOptions(res);
    return;
  }

  // ── API Routes ──────────────────────────────────────────────────────────────
  if (path.startsWith("/api/")) {
    const setupConfig = { rootDirectory: config.rootDirectory };
    const bootstrapConfig = { rootDirectory: config.rootDirectory, environment: config.environment };

    if (method === "GET" && path === "/api/bootstrap") {
      await handleGetBootstrap(req, res, bootstrapConfig);
      return;
    }

    if (method === "GET" && path === "/api/events") {
      await handleGetEvents(req, res);
      return;
    }

    if (method === "GET" && path === "/api/runtime") {
      await handleGetRuntime(req, res);
      return;
    }

    if (method === "GET" && path === "/api/runs") {
      await handleGetRuns(req, res, setupConfig);
      return;
    }

    if (method === "GET" && path.startsWith("/api/runs/")) {
      await handleGetRunDetail(req, res, setupConfig);
      return;
    }

    if (method === "GET" && path === "/api/chat/conversations") {
      await handleListConversations(req, res);
      return;
    }

    if (method === "GET" && path === "/api/skills") {
      await handleListSkills(req, res);
      return;
    }

    if (method === "GET" && path === "/api/control-plane") {
      await handleGetControlPlane(req, res, setupConfig);
      return;
    }

    if (method === "POST" && path === "/api/chat/conversations") {
      await handleCreateConversation(req, res);
      return;
    }

    if (path.startsWith("/api/chat/conversations/")) {
      const segments = path.split("/");
      const id = segments[4];
      const action = segments[5];

      if (id && method === "GET" && !action) {
        await handleGetConversation(req, res, { id });
        return;
      }
      if (id && method === "POST" && action === "messages") {
         await handleAddMessage(req, res, { id }, setupConfig);
         return;
      }
      if (id && method === "POST" && action === "stream") {
         await handleStreamingChat(req, res, { id }, setupConfig);
         return;
      }
    }

    if (method === "GET" && path.startsWith("/api/skills/")) {
      const id = path.split("/")[3];
      if (id) {
        await handleGetSkill(req, res, { id });
        return;
      }
    }

    if (method === "POST" && path === "/api/runtime/start") {
      await handlePostRuntimeStart(req, res, setupConfig);
      return;
    }

    if (method === "GET" && path === "/api/setup") {
      await handleGetSetup(req, res, setupConfig);
      return;
    }

    if (method === "POST" && path === "/api/setup/role") {
      await handlePostSetupRole(req, res, setupConfig);
      return;
    }

    if (method === "POST" && path === "/api/setup/providers") {
      await handlePostSetupProviders(req, res, setupConfig);
      return;
    }

    if (method === "POST" && path === "/api/setup/workspace") {
      await handlePostSetupWorkspace(req, res, setupConfig);
      return;
    }

    if (method === "POST" && path === "/api/setup/complete/welcome") {
      await handlePostCompleteWelcome(req, res, setupConfig);
      return;
    }

    if (method === "POST" && path === "/api/setup/complete/providers") {
      await handlePostCompleteProviders(req, res, setupConfig);
      return;
    }

    if (method === "POST" && path === "/api/setup/complete/workspace") {
      await handlePostCompleteWorkspace(req, res, setupConfig);
      return;
    }

    sendError(res, 404, "not_found", `${method} ${path} is not a known gateway route`);
    return;
  }

  // ── Static Web UI ───────────────────────────────────────────────────────────
  if (method === "GET" || method === "HEAD") {
    try {
      const gatewayDir = dirname(__dirname);
      const webDistPath = await resolveWebDistPath(config.rootDirectory, gatewayDir);

      // First try to serve specific files (assets)
      if (path !== "/" && path !== "/setup" && path !== "/audit" && path !== "/audit-flow") {
        try {
          const filePath = join(webDistPath, path);
          const content = await readFile(filePath);
          
          const cleanPath = path.split("?")[0] || "";
          const ext = cleanPath.split(".").pop();
          
          const contentTypes: Record<string, string> = {
            "js": "application/javascript; charset=utf-8",
            "css": "text/css; charset=utf-8",
            "svg": "image/svg+xml",
            "png": "image/png",
            "json": "application/json; charset=utf-8",
            "html": "text/html; charset=utf-8",
            "ico": "image/x-icon"
          };
          const contentType = contentTypes[ext || ""] || "application/octet-stream";
          
          res.writeHead(200, { 
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=3600"
          });
          
          if (method === "GET") {
            res.end(content);
          } else {
            res.end();
          }
          return;
        } catch {
          // Fall through to index.html for SPA routing
        }
      }

      // Serve index.html for everything else (SPA fallback)
      const content = await loadIndexHtml(webDistPath);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (method === "GET") {
        res.end(content);
      } else {
        res.end();
      }
      return;
    } catch (err) {
      console.error("[Gateway] Error serving Web UI:", err);
      sendError(res, 500, "internal_error", "Web UI not found on server");
      return;
    }
  }

  sendError(res, 404, "not_found", `${method} ${path} is not a known gateway route`);
}
