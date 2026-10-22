import bundled from "@/data/tickers.json";
import type { Ticker } from "../types";
import { dataSource } from "./data";

// Full IDX equity list from TradingView's public scanner endpoint (free, no
// key). Falls back to the bundled list in src/data/tickers.json.
const TV_URL = "https://scanner.tradingview.com/indonesia/scan";

interface TvResponse {
  totalCount: number;
  data: { s: string; d: [string, string | null, string | null] }[];
}

export async function fetchTradingViewUniverse(revalidate = 86400): Promise<Ticker[]> {
  const res = await fetch(TV_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      filter: [{ left: "type", operation: "equal", right: "stock" }],
      markets: ["indonesia"],
      columns: ["name", "description", "sector"],
      sort: { sortBy: "name", sortOrder: "asc" },
      range: [0, 2000],
    }),
    next: { revalidate },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`TradingView HTTP ${res.status}`);
  const json = (await res.json()) as TvResponse;
  const seen = new Set<string>();
  const out: Ticker[] = [];
  for (const row of json.data) {
    const [exchange] = row.s.split(":");
    const code = row.d[0];
    // Ordinary shares only: 4-letter codes (excludes warrants, rights, ETFs with suffixes).
    if (exchange !== "IDX" || !/^[A-Z]{4}$/.test(code) || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name: row.d[1] ?? code, sector: row.d[2] ?? undefined });
  }
  return out;
}

export async function getUniverse(): Promise<{ tickers: Ticker[]; source: "tradingview" | "bundled" }> {
  if (dataSource === "yahoo") {
    try {
      const tickers = await fetchTradingViewUniverse();
      if (tickers.length > 300) return { tickers, source: "tradingview" };
    } catch {
      // fall through to the bundled list
    }
  }
  return { tickers: bundled as Ticker[], source: "bundled" };
}
