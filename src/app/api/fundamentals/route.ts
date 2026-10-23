import { getStockFundamentals } from "@/lib/server/fundamentals";
import { findTicker } from "@/lib/server/universe";

export async function GET(req: Request) {
  const code = (new URL(req.url).searchParams.get("code") ?? "").toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) return Response.json({ error: "invalid code" }, { status: 400 });
  const ticker = await findTicker(code).catch(() => null);
  const data = await getStockFundamentals(code, ticker ?? undefined);
  return Response.json(data, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
