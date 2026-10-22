import { describe, expect, it } from "vitest";
import { detectPatterns } from "./patterns";
import type { Candle } from "./types";

let t = 0;
const c = (open: number, high: number, low: number, close: number): Candle => ({ time: t++ * 86400, open, high, low, close, volume: 1000 });

/** Six bars falling from 120 to 100, so the next bar follows a downtrend. */
const downtrend = () => [120, 116, 112, 108, 104, 100].map((p) => c(p + 2, p + 3, p - 1, p));
const uptrend = () => [100, 104, 108, 112, 116, 120].map((p) => c(p - 2, p + 1, p - 3, p));

describe("detectPatterns", () => {
  it("detects a hammer after a decline", () => {
    const f = detectPatterns([...downtrend(), c(98, 99.2, 90, 99)]);
    expect(f).toContain("hammer");
    expect(f).toContain("bullishCandle");
  });

  it("calls the same shape a hanging man after a rally", () => {
    const f = detectPatterns([...uptrend(), c(120, 121.2, 112, 121)]);
    expect(f).toContain("hangingMan");
    expect(f).not.toContain("hammer");
  });

  it("detects bullish and bearish engulfing", () => {
    expect(detectPatterns([...downtrend(), c(101, 101.5, 97, 98), c(97, 103, 96.5, 102)])).toContain("bullEngulfing");
    expect(detectPatterns([...uptrend(), c(119, 123, 118.5, 122), c(123, 123.5, 117, 118)])).toContain("bearEngulfing");
  });

  it("detects a morning star", () => {
    const f = detectPatterns([...downtrend(), c(104, 104.5, 95.5, 96), c(95, 96, 94, 95.3), c(96, 103, 95.5, 102.5)]);
    expect(f).toContain("morningStar");
  });

  it("detects a doji", () => {
    expect(detectPatterns([...uptrend(), c(120, 123, 117, 120.1)])).toContain("doji");
  });

  it("ignores untraded bars (no range, no volume)", () => {
    const flat = { time: t++ * 86400, open: 50, high: 50, low: 50, close: 50, volume: 0 };
    expect(detectPatterns([...downtrend(), flat])).toEqual([]);
  });
});
