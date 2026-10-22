import { dataSource, getDaily } from "@/lib/server/data";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const code = (sp.get("code") ?? "").toUpperCase();
  const range = sp.get("range") === "5y" ? "5y" : sp.get("range") === "1y" ? "1y" : "2y";
  if (!/^[A-Z]{4}$/.test(code)) return Response.json({ error: "invalid code" }, { status: 400 });
  try {
    const candles = await getDaily(code, range);
    if (candles.length === 0) return Response.json({ error: "no data" }, { status: 404 });
    return Response.json(
      { source: dataSource, code, candles },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "upstream error" }, { status: 502 });
  }
}
