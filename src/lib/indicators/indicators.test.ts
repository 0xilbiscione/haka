import { describe, expect, it } from "vitest";
import type { Candle } from "../types";
import { adx, atr, bollinger, ema, macd, pivots, rsi, sma, stochastic } from "./index";

const candle = (close: number, i: number, spread = 1): Candle => ({
  time: i * 86400,
  open: close,
  high: close + spread,
  low: close - spread,
  close,
  volume: 1000,
});

describe("sma", () => {
  it("averages a sliding window and pads the warm-up", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
});

describe("ema", () => {
  it("seeds with the SMA, then smooths with k = 2/(n+1)", () => {
    const out = ema([2, 4, 6, 8, 10], 3);
    expect(out.slice(0, 2)).toEqual([null, null]);
    expect(out[2]).toBe(4); // SMA(2,4,6)
    expect(out[3]).toBeCloseTo(8 * 0.5 + 4 * 0.5); // 6
    expect(out[4]).toBeCloseTo(10 * 0.5 + 6 * 0.5); // 8
  });
});

describe("rsi", () => {
  // Classic Wilder example (StockCharts "RSI" ChartSchool table).
  const closes = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 45.64,
  ];
  it("matches the reference values", () => {
    const r = rsi(closes, 14);
    expect(r[13]).toBeNull();
    expect(r[14]).toBeCloseTo(70.46, 1);
    expect(r[15]).toBeCloseTo(66.25, 1);
  });
  it("is 100 for a straight rise and 0 for a straight fall", () => {
    const upward = Array.from({ length: 30 }, (_, i) => 100 + i);
    expect(rsi(upward).at(-1)).toBe(100);
    expect(rsi([...upward].reverse()).at(-1)).toBe(0);
  });
});

describe("macd", () => {
  it("is zero on a flat series and positive in a steady uptrend", () => {
    const flat = macd(Array(60).fill(100));
    expect(flat.line.at(-1)).toBeCloseTo(0);
    expect(flat.hist.at(-1)).toBeCloseTo(0);
    const rising = macd(Array.from({ length: 60 }, (_, i) => 100 + i));
    expect(rising.line.at(-1)!).toBeGreaterThan(0);
    // MACD starts at index 25 (slow EMA), the signal 8 bars later.
    expect(rising.line[24]).toBeNull();
    expect(rising.line[25]).not.toBeNull();
    expect(rising.signal[32]).toBeNull();
    expect(rising.signal[33]).not.toBeNull();
  });
});

describe("bollinger", () => {
  it("collapses to the mean on a flat series", () => {
    const b = bollinger(Array(25).fill(50));
    expect(b.upper.at(-1)).toBe(50);
    expect(b.lower.at(-1)).toBe(50);
    expect(b.width.at(-1)).toBe(0);
  });
  it("uses population standard deviation", () => {
    const closes = [...Array(19).fill(10), 30];
    const b = bollinger(closes, 20, 2);
    const mean = 11;
    const sd = Math.sqrt((19 * 1 + 19 ** 2) / 20);
    expect(b.mid.at(-1)).toBeCloseTo(mean);
    expect(b.upper.at(-1)).toBeCloseTo(mean + 2 * sd);
  });
});

describe("stochastic", () => {
  it("reads 100 at the top of the range", () => {
    const cs = Array.from({ length: 30 }, (_, i) => candle(100 + i, i, 0.5));
    cs.forEach((c) => (c.high = c.close));
    const { k } = stochastic(cs);
    expect(k.at(-1)).toBeCloseTo(100);
  });
});

describe("atr / adx", () => {
  it("ATR equals the constant range of identical bars", () => {
    const cs = Array.from({ length: 30 }, (_, i) => candle(100, i, 2));
    expect(atr(cs).at(-1)).toBeCloseTo(4);
  });
  it("ADX is high in a clean trend with +DI over -DI", () => {
    const cs = Array.from({ length: 80 }, (_, i) => candle(100 + i * 2, i, 1));
    const r = adx(cs);
    expect(r.adx.at(-1)!).toBeGreaterThan(50);
    expect(r.plusDI.at(-1)!).toBeGreaterThan(r.minusDI.at(-1)!);
  });
});

describe("pivots", () => {
  it("finds confirmed swing lows", () => {
    expect(pivots([5, 4, 3, 4, 5, 4, 2, 4, 5], 2, "low")).toEqual([2, 6]);
  });
  it("picks one bar for a flat bottom", () => {
    expect(pivots([5, 4, 3, 3, 4, 5], 2, "low")).toEqual([2]);
  });
});
