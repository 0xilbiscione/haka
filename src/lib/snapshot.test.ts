import { describe, expect, it } from "vitest";
import { fixtureDaily } from "./server/fixture";
import { parseChart } from "./server/yahoo";
import { buildSnapshot } from "./snapshot";
import type { Candle } from "./types";

describe("buildSnapshot", () => {
  it("computes a full snapshot from a year of bars", () => {
    const candles = fixtureDaily("BBCA", 250);
    const s = buildSnapshot("BBCA", candles)!;
    expect(s.code).toBe("BBCA");
    expect(s.bars).toBe(250);
    expect(s.v.close).toBe(candles.at(-1)!.close);
    expect(s.p.close).toBe(candles.at(-2)!.close);
    for (const f of ["sma200", "rsi", "macd", "adx", "bbWidth", "atr", "volRatio", "high52", "ret3m"] as const) {
      expect(s.v[f], f).not.toBeNull();
    }
    expect(s.spark).toHaveLength(40);
  });

  it("flags a golden cross on the bar where MA50 crosses MA200", () => {
    // 200 bars falling then a sharp rally: MA50 eventually crosses MA200.
    const closes = [...Array.from({ length: 200 }, (_, i) => 2000 - i * 2), ...Array.from({ length: 120 }, (_, i) => 1600 + i * 12)];
    const all: Candle[] = closes.map((c, i) => ({ time: i * 86400, open: c, high: c + 5, low: c - 5, close: c, volume: 1e6 }));
    let crossAt = -1;
    for (let n = 210; n <= all.length; n++) {
      if (buildSnapshot("X", all.slice(0, n))!.flags.includes("goldenCross")) {
        crossAt = n;
        break;
      }
    }
    expect(crossAt).toBeGreaterThan(0);
    // Only on that bar, not the next one.
    expect(buildSnapshot("X", all.slice(0, crossAt + 1))!.flags).not.toContain("goldenCross");
  });

  it("flags a volume spike and a 52-week breakout", () => {
    const base: Candle[] = Array.from({ length: 100 }, (_, i) => ({ time: i * 86400, open: 1000, high: 1010, low: 990, close: 1000, volume: 1e6 }));
    base.push({ time: 100 * 86400, open: 1000, high: 1100, low: 1000, close: 1090, volume: 5e6 });
    const s = buildSnapshot("X", base)!;
    expect(s.flags).toContain("volSpike");
    expect(s.flags).toContain("breakout52w");
    expect(s.v.volRatio).toBeGreaterThan(2);
  });
});

describe("near auto-rejection flags", () => {
  const bars = (closes: number[]): Candle[] =>
    closes.map((c, i) => ({ time: i * 86400, open: c, high: c + 1, low: Math.max(1, c - 1), close: c, volume: 1e6 }));

  it("does not flag a sub-Rp50 stock as near ARB just for being below 50", () => {
    const s = buildSnapshot("BHIT", bars([20, 20, 19, 19]))!;
    expect(s.flags).not.toContain("nearArb");
  });

  it("flags a real limit-down day below Rp50", () => {
    const s = buildSnapshot("BHIT", bars([20, 20, 20, 17]))!; // ARB from 20 = 17
    expect(s.flags).toContain("nearArb");
  });

  it("does not flag a stock pinned at the Rp50 floor", () => {
    const s = buildSnapshot("X", bars([50, 50, 50, 50]))!;
    expect(s.flags).not.toContain("nearArb");
  });
});

describe("parseChart", () => {
  it("normalizes Yahoo rows, drops nulls and de-duplicates the live bar", () => {
    const day = 1760925600; // 2025-10-20 02:00 UTC = 09:00 WIB
    const candles = parseChart({
      chart: {
        result: [
          {
            timestamp: [day, day + 86400, day + 2 * 86400, day + 2 * 86400 + 3600],
            indicators: {
              quote: [
                {
                  open: [100, null, 102, 102],
                  high: [105, null, 106, 108],
                  low: [99, null, 101, 101],
                  close: [104, null, 103, 107],
                  volume: [10, null, 20, 25],
                },
              ],
            },
          },
        ],
      },
    });
    expect(candles).toHaveLength(2);
    expect(candles[0].time % 86400).toBe(0);
    expect(candles[1].close).toBe(107);
  });
});
