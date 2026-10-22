import { buildSnapshot } from "../snapshot";
import type { Candle, Snapshot } from "../types";
import { fixtureDaily } from "./fixture";
import { fetchYahooDaily } from "./yahoo";

export type DataSource = "yahoo" | "fixture";

export const dataSource: DataSource = process.env.DATA_SOURCE === "fixture" ? "fixture" : "yahoo";

/** Seconds to cache upstream price data: short while the market is open. */
export function revalidateSeconds(now = new Date()): number {
  const wib = new Date(now.getTime() + 7 * 3600_000);
  const day = wib.getUTCDay();
  const m = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  const open = day >= 1 && day <= 5 && m >= 8 * 60 + 45 && m < 16 * 60 + 15;
  return open ? 600 : 3600;
}

export async function getDaily(code: string, range: "1y" | "2y" | "5y"): Promise<Candle[]> {
  if (dataSource === "fixture") return fixtureDaily(code, range === "1y" ? 250 : range === "2y" ? 500 : 1250);
  return fetchYahooDaily(code, range, revalidateSeconds());
}

/** Runs `fn` over `items` with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function scanCodes(codes: string[]) {
  const failed: string[] = [];
  const results = await mapLimit(codes, 8, async (code): Promise<Snapshot | null> => {
    try {
      const candles = await getDaily(code, "1y");
      return candles.length >= 2 ? buildSnapshot(code, candles) : null;
    } catch {
      failed.push(code);
      return null;
    }
  });
  return { snapshots: results.filter((s): s is Snapshot => s != null), failed };
}
