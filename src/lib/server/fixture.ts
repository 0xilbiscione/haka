import { roundDownToTick } from "../idx";
import type { Candle } from "../types";

// Deterministic synthetic OHLCV for demo/offline mode (DATA_SOURCE=fixture).
// Never mixed with live data: the API reports `source: "fixture"` and the UI
// shows a "demo data" badge.

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fixtureDaily(code: string, bars: number, now = new Date()): Candle[] {
  const rnd = mulberry32(hash(code));
  let price = 50 + Math.floor(rnd() * 9000);
  const drift = (rnd() - 0.45) * 0.003;
  const vol = 0.012 + rnd() * 0.03;
  const baseVol = 1e5 * (1 + rnd() * 500);

  // Walk back over weekdays from today.
  const days: number[] = [];
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (days.length < bars) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) days.push(d.getTime() / 1000);
    d.setUTCDate(d.getUTCDate() - 1);
  }
  days.reverse();

  const out: Candle[] = [];
  let regime = 0;
  for (const time of days) {
    if (rnd() < 0.02) regime = (rnd() - 0.5) * 0.01;
    const ret = drift + regime + (rnd() - 0.5) * 2 * vol;
    const open = price * (1 + (rnd() - 0.5) * vol * 0.5);
    const close = Math.max(50, price * (1 + ret));
    const high = Math.max(open, close) * (1 + rnd() * vol * 0.6);
    const low = Math.min(open, close) * (1 - rnd() * vol * 0.6);
    const spike = rnd() < 0.04 ? 2 + rnd() * 4 : 1;
    const r = (x: number) => Math.max(50, roundDownToTick(x));
    out.push({ time, open: r(open), high: r(high), low: r(low), close: r(close), volume: Math.round(baseVol * (0.4 + rnd()) * spike) });
    price = close;
  }
  return out;
}
