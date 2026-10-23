import { createMcpHandler } from "mcp-handler";
import { MCP_INSTRUCTIONS, registerHakaTools } from "@/lib/server/mcp-tools";

export const maxDuration = 300;

const handler = createMcpHandler(registerHakaTools, {
  serverInfo: { name: "haka-idx-screener", version: "1.0.0" },
  instructions: MCP_INSTRUCTIONS,
});

// Best-effort per-instance rate limit for this public, read-only endpoint.
const WINDOW_MS = 60_000;
const MAX_CALLS = 60;
const hits = new Map<string, { count: number; reset: number }>();

function limited(req: Request): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  return ++h.count > MAX_CALLS;
}

async function route(req: Request) {
  if (req.method === "POST" && limited(req)) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Rate limit exceeded: max 60 requests per minute." } },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  return handler(req);
}

export { route as GET, route as POST, route as DELETE };
