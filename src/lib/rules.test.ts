import { describe, expect, it } from "vitest";
import { evalCondition, evalScreen, type Screen } from "./rules";
import type { Snapshot } from "./types";

const snap: Snapshot = {
  code: "TEST",
  time: 0,
  bars: 250,
  v: { close: 1000, rsi: 28, ema9: 105, ema21: 100, volRatio: 2.5 },
  p: { close: 980, rsi: 25, ema9: 99, ema21: 100, volRatio: 1 },
  flags: ["volSpike"],
  spark: [],
};

describe("evalCondition", () => {
  it("compares with constants and fields", () => {
    expect(evalCondition(snap, { kind: "compare", left: "rsi", op: "<", right: { value: 30 } })).toBe(true);
    expect(evalCondition(snap, { kind: "compare", left: "ema9", op: ">", right: { field: "ema21" } })).toBe(true);
    expect(evalCondition(snap, { kind: "compare", left: "rsi", op: ">=", right: { value: 28 } })).toBe(true);
  });

  it("detects crossovers between the previous and latest bar", () => {
    expect(evalCondition(snap, { kind: "compare", left: "ema9", op: "crossAbove", right: { field: "ema21" } })).toBe(true);
    expect(evalCondition(snap, { kind: "compare", left: "ema9", op: "crossBelow", right: { field: "ema21" } })).toBe(false);
    expect(evalCondition(snap, { kind: "compare", left: "rsi", op: "crossAbove", right: { value: 26 } })).toBe(true);
    expect(evalCondition(snap, { kind: "compare", left: "rsi", op: "crossAbove", right: { value: 20 } })).toBe(false);
  });

  it("treats missing values as no match", () => {
    expect(evalCondition(snap, { kind: "compare", left: "adx", op: ">", right: { value: 0 } })).toBe(false);
    expect(evalCondition(snap, { kind: "compare", left: "adx", op: "<", right: { value: 0 } })).toBe(false);
  });

  it("checks flags with optional negation", () => {
    expect(evalCondition(snap, { kind: "flag", flag: "volSpike" })).toBe(true);
    expect(evalCondition(snap, { kind: "flag", flag: "volSpike", negate: true })).toBe(false);
    expect(evalCondition(snap, { kind: "flag", flag: "doji", negate: true })).toBe(true);
  });
});

describe("evalScreen", () => {
  const conds: Screen["conditions"] = [
    { kind: "flag", flag: "volSpike" },
    { kind: "compare", left: "rsi", op: ">", right: { value: 70 } },
  ];
  it("combines conditions with AND / OR", () => {
    expect(evalScreen(snap, { id: "a", name: "", logic: "AND", conditions: conds })).toBe(false);
    expect(evalScreen(snap, { id: "o", name: "", logic: "OR", conditions: conds })).toBe(true);
  });
});
