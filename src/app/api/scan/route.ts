import { dataSource, scanCodes } from "@/lib/server/data";

export const maxDuration = 60;

const MAX_SYMBOLS = 60;

export async function GET(req: Request) {
  const param = new URL(req.url).searchParams.get("symbols") ?? "";
  const codes = [...new Set(param.toUpperCase().split(",").map((s) => s.trim()))].filter((s) => /^[A-Z]{4}$/.test(s));
  if (codes.length === 0) return Response.json({ error: "symbols required" }, { status: 400 });
  if (codes.length > MAX_SYMBOLS) return Response.json({ error: `max ${MAX_SYMBOLS} symbols` }, { status: 400 });

  const { snapshots, failed } = await scanCodes(codes);
  return Response.json(
    { source: dataSource, snapshots, failed, asOf: Date.now() },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
