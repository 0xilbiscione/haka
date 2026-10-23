import { adx, atr, bollinger, ema, macd, rsi, rsiDivergence, sma, stochastic } from "./indicators";
import { araPrice, arbPrice, tickSize } from "./idx";
import { detectPatterns } from "./patterns";
import type { Candle, Flag, NumField, NumMap, Series, Snapshot } from "./types";

const at = (s: Series, i: number) => (i >= 0 && i < s.length ? s[i] : null);

function pctChange(a: number | null | undefined, b: number | null | undefined) {
  return a != null && b != null && b !== 0 ? ((a - b) / b) * 100 : null;
}

/** Computes all indicator series for a candle array. Shared by the scanner and the chart. */
export function computeSeries(candles: Candle[]) {
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const values = candles.map((c) => c.close * c.volume);
  const m = macd(closes);
  const st = stochastic(candles);
  const dmi = adx(candles);
  const bb = bollinger(closes);
  const atrS = atr(candles);
  return {
    closes,
    sma5: sma(closes, 5),
    sma10: sma(closes, 10),
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma100: sma(closes, 100),
    sma200: sma(closes, 200),
    ema9: ema(closes, 9),
    ema21: ema(closes, 21),
    ema50: ema(closes, 50),
    rsi: rsi(closes),
    macd: m.line,
    macdSignal: m.signal,
    macdHist: m.hist,
    stochK: st.k,
    stochD: st.d,
    adx: dmi.adx,
    plusDI: dmi.plusDI,
    minusDI: dmi.minusDI,
    bbUpper: bb.upper,
    bbMid: bb.mid,
    bbLower: bb.lower,
    bbWidth: bb.width,
    bbPctB: bb.pctB,
    atr: atrS,
    volMa20: sma(volumes, 20),
    valueMa20: sma(values, 20),
  };
}

const SERIES_FIELDS = [
  "sma5", "sma10", "sma20", "sma50", "sma100", "sma200", "ema9", "ema21", "ema50",
  "rsi", "macd", "macdSignal", "macdHist", "stochK", "stochD", "adx", "plusDI", "minusDI",
  "bbUpper", "bbMid", "bbLower", "bbWidth", "bbPctB", "atr", "volMa20", "valueMa20",
] as const satisfies readonly NumField[];

/** Builds the screenable snapshot (latest + previous bar values and signal flags). */
export function buildSnapshot(code: string, candles: Candle[]): Snapshot | null {
  const n = candles.length;
  if (n < 2) return null;
  const s = computeSeries(candles);

  const valuesAt = (i: number): NumMap => {
    const c = candles[i];
    const prev = candles[i - 1];
    const out: NumMap = {
      close: c.close,
      open: c.open,
      high: c.high,
      low: c.low,
      volume: c.volume,
      value: c.close * c.volume,
      changePct: prev ? pctChange(c.close, prev.close) : null,
    };
    for (const f of SERIES_FIELDS) out[f] = at(s[f], i);
    const a = out.atr;
    out.atrPct = a != null ? (a / c.close) * 100 : null;
    out.volRatio = out.volMa20 ? c.volume / out.volMa20 : null;
    // 52-week window ≈ 250 trading days (uses whatever history is available).
    const from = Math.max(0, i - 249);
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = from; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    out.high52 = hi;
    out.low52 = lo;
    out.fromHigh52Pct = pctChange(c.close, hi);
    out.fromLow52Pct = pctChange(c.close, lo);
    out.ret1w = i >= 5 ? pctChange(c.close, candles[i - 5].close) : null;
    out.ret1m = i >= 21 ? pctChange(c.close, candles[i - 21].close) : null;
    out.ret3m = i >= 63 ? pctChange(c.close, candles[i - 63].close) : null;
    return out;
  };

  const v = valuesAt(n - 1);
  const p = valuesAt(n - 2);
  const flags = new Set<Flag>(detectPatterns(candles));

  const crossAbove = (a: NumField, b: NumField) =>
    v[a] != null && v[b] != null && p[a] != null && p[b] != null && (p[a] as number) <= (p[b] as number) && (v[a] as number) > (v[b] as number);

  if (crossAbove("sma50", "sma200")) flags.add("goldenCross");
  if (crossAbove("sma200", "sma50")) flags.add("deathCross");
  if (crossAbove("macd", "macdSignal")) flags.add("macdBullCross");
  if (crossAbove("macdSignal", "macd")) flags.add("macdBearCross");
  if (crossAbove("stochK", "stochD") && (p.stochK ?? 100) < 25) flags.add("stochBullCross");
  if (crossAbove("stochD", "stochK") && (p.stochK ?? 0) > 75) flags.add("stochBearCross");

  const { close } = v as { close: number };
  const { sma20: m20, sma50: m50, sma200: m200 } = v;
  if (m20 != null && m50 != null && m200 != null) {
    if (close > m20 && m20 > m50 && m50 > m200) flags.add("maUptrend");
    if (close < m20 && m20 < m50 && m50 < m200) flags.add("maDowntrend");
  }

  // Squeeze: band width within 10% of its 120-bar low.
  const widths = s.bbWidth.slice(-120).filter((x): x is number => x != null);
  if (v.bbWidth != null && widths.length >= 60 && v.bbWidth <= Math.min(...widths) * 1.1) flags.add("bbSqueeze");
  if (v.bbUpper != null && p.bbUpper != null && close > v.bbUpper && (p.close as number) <= p.bbUpper) flags.add("bbBreakoutUp");

  // 52-week breakout: today's close beats the prior 52-week high (excluding today).
  if (n > 60) {
    const window = candles.slice(Math.max(0, n - 251), n - 1);
    const priorHigh = Math.max(...window.map((c) => c.high));
    const priorLow = Math.min(...window.map((c) => c.low));
    if (close > priorHigh) flags.add("breakout52w");
    if (close < priorLow) flags.add("breakdown52w");
  }

  if (v.volRatio != null && v.volRatio >= 2 && v.volume! > 0) flags.add("volSpike");

  const div = rsiDivergence(candles, s.rsi);
  if (div.bull) flags.add("rsiBullDiv");
  if (div.bear) flags.add("rsiBearDiv");

  // Near auto-rejection: within one tick of the limit computed from yesterday's close.
  const ref = p.close as number;
  if (ref > 0) {
    if (close >= araPrice(ref) - tickSize(close)) flags.add("nearAra");
    // A stock already at its floor has no room to fall, so it is not "near" ARB.
    const arb = arbPrice(ref);
    if (arb < ref && close <= arb + tickSize(close)) flags.add("nearArb");
  }

  return {
    code,
    time: candles[n - 1].time,
    bars: n,
    v: round(v),
    p: round(p),
    flags: [...flags],
    spark: s.closes.slice(-40),
  };
}

function round(m: NumMap): NumMap {
  const out: NumMap = {};
  for (const [k, val] of Object.entries(m)) {
    out[k as NumField] = val == null || !Number.isFinite(val) ? null : Math.round(val * 1e4) / 1e4;
  }
  return out;
}
