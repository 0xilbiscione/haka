import { dataSource } from "@/lib/server/data";
import { getUniverse } from "@/lib/server/universe";

export async function GET() {
  const { tickers, source } = await getUniverse();
  return Response.json(
    { source, dataSource, tickers },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
  );
}
