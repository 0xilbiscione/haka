import type { Candle } from "../types";

const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

interface ChartResponse {
  chart: {
    result?: {
      timestamp?: number[];
      indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[] };
    }[];
    error?: { code: string; description: string } | null;
  };
}

/** Normalizes a Yahoo timestamp to UTC midnight of its WIB (UTC+7) trading day. */
function toTradingDay(ts: number): number {
  return Math.floor((ts + 7 * 3600) / 86400) * 86400;
}

export function parseChart(json: ChartResponse): Candle[] {
  const r = json.chart.result?.[0];
  const q = r?.indicators.quote[0];
  if (!r?.timestamp || !q) return [];
  const byDay = new Map<number, Candle>();
  for (let i = 0; i < r.timestamp.length; i++) {
    const o = q.open[i];
    const h = q.high[i];
    const l = q.low[i];
    const c = q.close[i];
    if (o == null || h == null || l == null || c == null || c <= 0) continue;
    const time = toTradingDay(r.timestamp[i]);
    // Yahoo occasionally repeats the live bar; the later row wins.
    byDay.set(time, { time, open: o, high: h, low: l, close: c, volume: q.volume[i] ?? 0 });
  }
  return [...byDay.values()].sort((a, b) => a.time - b.time);
}

/** Daily OHLCV for an IDX code (without the .JK suffix). */
export async function fetchYahooDaily(code: string, range: "1y" | "2y" | "5y", revalidate: number): Promise<Candle[]> {
  const path = `/v8/finance/chart/${encodeURIComponent(code)}.JK?range=${range}&interval=1d&includePrePost=false`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const host = HOSTS[attempt % HOSTS.length];
    try {
      const res = await fetch(host + path, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        next: { revalidate },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 404) return [];
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Yahoo HTTP ${res.status}`);
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
      return parseChart((await res.json()) as ChartResponse);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
