import type { Candle, Series } from "../types";

// All indicator functions return a series aligned with the input, padded with
// null where there is not enough history yet.

export function sma(values: Series, period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) {
      sum = 0;
      count = 0;
      continue;
    }
    sum += v;
    count++;
    if (count > period) {
      sum -= values[i - period] as number;
      count = period;
    }
    if (count === period) out[i] = sum / period;
  }
  return out;
}

/** EMA seeded with the SMA of the first `period` values. */
export function ema(values: Series, period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let seed = 0;
  let seen = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (prev == null) {
      seed += v;
      seen++;
      if (seen === period) {
        prev = seed / period;
        out[i] = prev;
      }
      continue;
    }
    prev = v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's smoothing (RMA), seeded with a simple average. */
export function rma(values: Series, period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let prev: number | null = null;
  let seed = 0;
  let seen = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (prev == null) {
      seed += v;
      seen++;
      if (seen === period) {
        prev = seed / period;
        out[i] = prev;
      }
      continue;
    }
    prev = (prev * (period - 1) + v) / period;
    out[i] = prev;
  }
  return out;
}

export function rsi(closes: number[], period = 14): Series {
  const gains: Series = [null];
  const losses: Series = [null];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains.push(Math.max(d, 0));
    losses.push(Math.max(-d, 0));
  }
  const ag = rma(gains, period);
  const al = rma(losses, period);
  return closes.map((_, i) => {
    const g = ag[i];
    const l = al[i];
    if (g == null || l == null) return null;
    if (l === 0) return g === 0 ? 50 : 100;
    return 100 - 100 / (1 + g / l);
  });
}

export function macd(closes: number[], fast = 12, slow = 26, signal = 9) {
  const ef = ema(closes, fast);
  const es = ema(closes, slow);
  const line: Series = closes.map((_, i) =>
    ef[i] != null && es[i] != null ? (ef[i] as number) - (es[i] as number) : null,
  );
  const sig = ema(line, signal);
  const hist: Series = line.map((v, i) => (v != null && sig[i] != null ? v - (sig[i] as number) : null));
  return { line, signal: sig, hist };
}

export function stochastic(candles: Candle[], kPeriod = 14, kSmooth = 3, dPeriod = 3) {
  const raw: Series = candles.map((_, i) => {
    if (i < kPeriod - 1) return null;
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    return hi === lo ? 50 : ((candles[i].close - lo) / (hi - lo)) * 100;
  });
  const k = sma(raw, kSmooth);
  const d = sma(k, dPeriod);
  return { k, d };
}

export function trueRange(candles: Candle[]): Series {
  return candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const pc = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
  });
}

export function atr(candles: Candle[], period = 14): Series {
  return rma(trueRange(candles), period);
}

export function adx(candles: Candle[], period = 14) {
  const plusDM: Series = [null];
  const minusDM: Series = [null];
  for (let i = 1; i < candles.length; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  const tr = trueRange(candles);
  tr[0] = null;
  const str = rma(tr, period);
  const sp = rma(plusDM, period);
  const sm = rma(minusDM, period);
  const plusDI: Series = [];
  const minusDI: Series = [];
  const dx: Series = [];
  for (let i = 0; i < candles.length; i++) {
    const t = str[i];
    if (t == null || sp[i] == null || sm[i] == null || t === 0) {
      plusDI.push(null);
      minusDI.push(null);
      dx.push(null);
      continue;
    }
    const p = (100 * (sp[i] as number)) / t;
    const m = (100 * (sm[i] as number)) / t;
    plusDI.push(p);
    minusDI.push(m);
    dx.push(p + m === 0 ? 0 : (100 * Math.abs(p - m)) / (p + m));
  }
  return { adx: rma(dx, period), plusDI, minusDI };
}

export function bollinger(closes: number[], period = 20, mult = 2) {
  const mid = sma(closes, period);
  const upper: Series = [];
  const lower: Series = [];
  const width: Series = [];
  const pctB: Series = [];
  for (let i = 0; i < closes.length; i++) {
    const m = mid[i];
    if (m == null) {
      upper.push(null);
      lower.push(null);
      width.push(null);
      pctB.push(null);
      continue;
    }
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += (closes[j] - m) ** 2;
    const sd = Math.sqrt(s / period);
    const u = m + mult * sd;
    const l = m - mult * sd;
    upper.push(u);
    lower.push(l);
    width.push(m === 0 ? null : ((u - l) / m) * 100);
    pctB.push(u === l ? 0.5 : (closes[i] - l) / (u - l));
  }
  return { upper, mid, lower, width, pctB };
}

export function rollingMax(values: number[], period: number): Series {
  return values.map((_, i) => (i < period - 1 ? null : Math.max(...values.slice(i - period + 1, i + 1))));
}

export function rollingMin(values: number[], period: number): Series {
  return values.map((_, i) => (i < period - 1 ? null : Math.min(...values.slice(i - period + 1, i + 1))));
}

/** Indices of local pivot lows/highs confirmed by `wing` bars on each side. */
export function pivots(values: number[], wing: number, kind: "low" | "high"): number[] {
  const out: number[] = [];
  for (let i = wing; i < values.length - wing; i++) {
    let ok = true;
    // Strict against the left wing, non-strict against the right so a flat
    // bottom/top yields exactly one pivot (its first bar).
    for (let j = i - wing; j <= i + wing && ok; j++) {
      if (j === i) continue;
      const strict = j < i;
      ok =
        kind === "low"
          ? strict ? values[i] < values[j] : values[i] <= values[j]
          : strict ? values[i] > values[j] : values[i] >= values[j];
    }
    if (ok) out.push(i);
  }
  return out;
}

/**
 * Regular RSI divergence over the last `lookback` bars, comparing the two most
 * recent confirmed price pivots.
 * Bullish: price makes a lower low while RSI makes a higher low (RSI low < 40).
 * Bearish: price makes a higher high while RSI makes a lower high (RSI high > 60).
 */
export function rsiDivergence(candles: Candle[], rsiSeries: Series, lookback = 60, wing = 3) {
  const start = Math.max(0, candles.length - lookback);
  const lows = candles.slice(start).map((c) => c.low);
  const highs = candles.slice(start).map((c) => c.high);
  const check = (idx: number[], prices: number[], kind: "bull" | "bear") => {
    if (idx.length < 2) return false;
    const a = idx[idx.length - 2];
    const b = idx[idx.length - 1];
    // Only signal when the latest pivot is recent.
    if (prices.length - 1 - b > wing + 5) return false;
    const ra = rsiSeries[start + a];
    const rb = rsiSeries[start + b];
    if (ra == null || rb == null) return false;
    return kind === "bull"
      ? prices[b] < prices[a] && rb > ra && rb < 40
      : prices[b] > prices[a] && rb < ra && rb > 60;
  };
  return {
    bull: check(pivots(lows, wing, "low"), lows, "bull"),
    bear: check(pivots(highs, wing, "high"), highs, "bear"),
  };
}
