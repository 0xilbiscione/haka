import type { Candle, Flag } from "./types";

const body = (c: Candle) => Math.abs(c.close - c.open);
const range = (c: Candle) => c.high - c.low;
const upperWick = (c: Candle) => c.high - Math.max(c.open, c.close);
const lowerWick = (c: Candle) => Math.min(c.open, c.close) - c.low;
const bull = (c: Candle) => c.close > c.open;
const bear = (c: Candle) => c.close < c.open;
const mid = (c: Candle) => (c.open + c.close) / 2;

/** Trend into bar `i` (exclusive): compares the close before it with 5 bars earlier. */
function trendBefore(candles: Candle[], i: number): "up" | "down" | "flat" {
  if (i < 6) return "flat";
  const a = candles[i - 6].close;
  const b = candles[i - 1].close;
  if (b < a * 0.98) return "down";
  if (b > a * 1.02) return "up";
  return "flat";
}

/** Candlestick patterns completed on the latest bar. */
export function detectPatterns(candles: Candle[]): Flag[] {
  const n = candles.length;
  if (n < 3) return [];
  const c = candles[n - 1];
  const p = candles[n - 2];
  const pp = candles[n - 3];
  const out: Flag[] = [];
  const r = range(c);
  if (r <= 0 || c.volume <= 0) return out;

  const b = body(c);
  const trend = trendBefore(candles, n - 1);

  if (b <= 0.1 * r) out.push("doji");

  const smallTopWick = upperWick(c) <= Math.max(0.1 * r, 0.3 * b);
  const smallBottomWick = lowerWick(c) <= Math.max(0.1 * r, 0.3 * b);
  if (b > 0 && lowerWick(c) >= 2 * b && smallTopWick) {
    if (trend === "down") out.push("hammer");
    if (trend === "up") out.push("hangingMan");
  }
  if (b > 0 && upperWick(c) >= 2 * b && smallBottomWick) {
    if (trend === "down") out.push("invertedHammer");
    if (trend === "up") out.push("shootingStar");
  }

  if (bear(p) && bull(c) && c.open <= p.close && c.close >= p.open && b > body(p)) {
    out.push("bullEngulfing");
  }
  if (bull(p) && bear(c) && c.open >= p.close && c.close <= p.open && b > body(p)) {
    out.push("bearEngulfing");
  }

  if (bear(p) && bull(c) && c.open < p.close && c.close > mid(p) && c.close < p.open) {
    out.push("piercing");
  }
  if (bull(p) && bear(c) && c.open > p.close && c.close < mid(p) && c.close > p.open) {
    out.push("darkCloud");
  }

  const ppBody = body(pp);
  const bigPP = ppBody >= 0.5 * range(pp) && ppBody > 0;
  if (bigPP && bear(pp) && body(p) <= 0.35 * ppBody && bull(c) && c.close > mid(pp)) {
    out.push("morningStar");
  }
  if (bigPP && bull(pp) && body(p) <= 0.35 * ppBody && bear(c) && c.close < mid(pp)) {
    out.push("eveningStar");
  }

  const bullish: Flag[] = ["hammer", "invertedHammer", "bullEngulfing", "piercing", "morningStar"];
  const bearish: Flag[] = ["shootingStar", "hangingMan", "bearEngulfing", "darkCloud", "eveningStar"];
  if (out.some((f) => bullish.includes(f))) out.push("bullishCandle");
  if (out.some((f) => bearish.includes(f))) out.push("bearishCandle");
  return out;
}
