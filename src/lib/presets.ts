import type { Condition, Screen } from "./rules";
import type { Flag, NumField } from "./types";

export type PresetGroup = "trend" | "momentum" | "volume" | "candle" | "fundamental";

export interface Preset extends Screen {
  group: PresetGroup;
  /** Default sort column for the result list. */
  sort?: { field: string; dir: "asc" | "desc" };
}

const flag = (f: Flag): Condition => ({ kind: "flag", flag: f });
const gt = (left: NumField, value: number): Condition => ({ kind: "compare", left, op: ">", right: { value } });
const gte = (left: NumField, value: number): Condition => ({ kind: "compare", left, op: ">=", right: { value } });
const lt = (left: NumField, value: number): Condition => ({ kind: "compare", left, op: "<", right: { value } });

const DEFS: Omit<Preset, "builtin">[] = [
  // Trend
  { id: "uptrend", group: "trend", name: "", logic: "AND", conditions: [flag("maUptrend")], sort: { field: "ret1m", dir: "desc" } },
  { id: "goldenCross", group: "trend", name: "", logic: "AND", conditions: [flag("goldenCross")] },
  { id: "deathCross", group: "trend", name: "", logic: "AND", conditions: [flag("deathCross")] },
  {
    id: "aboveMa200", group: "trend", name: "", logic: "AND",
    conditions: [{ kind: "compare", left: "close", op: ">", right: { field: "sma200" } }],
  },
  {
    id: "ema9x21", group: "trend", name: "", logic: "AND",
    conditions: [{ kind: "compare", left: "ema9", op: "crossAbove", right: { field: "ema21" } }],
  },
  { id: "macdBull", group: "trend", name: "", logic: "AND", conditions: [flag("macdBullCross")] },
  {
    id: "strongTrend", group: "trend", name: "", logic: "AND",
    conditions: [
      { kind: "compare", left: "adx", op: ">", right: { value: 25 } },
      { kind: "compare", left: "plusDI", op: ">", right: { field: "minusDI" } },
    ],
    sort: { field: "adx", dir: "desc" },
  },
  // Momentum
  {
    id: "rsiOversold", group: "momentum", name: "", logic: "AND",
    conditions: [{ kind: "compare", left: "rsi", op: "<", right: { value: 30 } }],
    sort: { field: "rsi", dir: "asc" },
  },
  {
    id: "rsiOverbought", group: "momentum", name: "", logic: "AND",
    conditions: [{ kind: "compare", left: "rsi", op: ">", right: { value: 70 } }],
    sort: { field: "rsi", dir: "desc" },
  },
  {
    id: "rsiReversal", group: "momentum", name: "", logic: "AND",
    conditions: [{ kind: "compare", left: "rsi", op: "crossAbove", right: { value: 30 } }],
  },
  { id: "stochBull", group: "momentum", name: "", logic: "AND", conditions: [flag("stochBullCross")] },
  { id: "rsiBullDiv", group: "momentum", name: "", logic: "AND", conditions: [flag("rsiBullDiv")] },
  { id: "rsiBearDiv", group: "momentum", name: "", logic: "AND", conditions: [flag("rsiBearDiv")] },
  // Volume & breakout
  { id: "volSpike", group: "volume", name: "", logic: "AND", conditions: [flag("volSpike")], sort: { field: "volRatio", dir: "desc" } },
  { id: "breakout52w", group: "volume", name: "", logic: "AND", conditions: [flag("breakout52w")] },
  {
    id: "breakoutVol", group: "volume", name: "", logic: "AND",
    conditions: [flag("bbBreakoutUp"), { kind: "compare", left: "volRatio", op: ">=", right: { value: 1.5 } }],
    sort: { field: "volRatio", dir: "desc" },
  },
  { id: "bbSqueeze", group: "volume", name: "", logic: "AND", conditions: [flag("bbSqueeze")], sort: { field: "bbWidth", dir: "asc" } },
  { id: "nearAra", group: "volume", name: "", logic: "AND", conditions: [flag("nearAra")], sort: { field: "changePct", dir: "desc" } },
  { id: "nearArb", group: "volume", name: "", logic: "AND", conditions: [flag("nearArb")], sort: { field: "changePct", dir: "asc" } },
  // Candlesticks
  { id: "bullishCandle", group: "candle", name: "", logic: "AND", conditions: [flag("bullishCandle")] },
  { id: "bearishCandle", group: "candle", name: "", logic: "AND", conditions: [flag("bearishCandle")] },
  { id: "hammer", group: "candle", name: "", logic: "AND", conditions: [flag("hammer")] },
  { id: "bullEngulfing", group: "candle", name: "", logic: "AND", conditions: [flag("bullEngulfing")] },
  { id: "morningStar", group: "candle", name: "", logic: "AND", conditions: [flag("morningStar")] },
  { id: "doji", group: "candle", name: "", logic: "AND", conditions: [flag("doji")] },
  // Fundamentals
  {
    id: "value", group: "fundamental", name: "", logic: "AND",
    conditions: [gt("pe", 0), lt("pe", 10), lt("pb", 1.5), gt("roe", 10)],
    sort: { field: "pe", dir: "asc" },
  },
  {
    id: "quality", group: "fundamental", name: "", logic: "AND",
    conditions: [gt("roe", 15), gt("netMargin", 10), lt("der", 1)],
    sort: { field: "roe", dir: "desc" },
  },
  { id: "dividend", group: "fundamental", name: "", logic: "AND", conditions: [gte("divYield", 5)], sort: { field: "divYield", dir: "desc" } },
  {
    id: "growth", group: "fundamental", name: "", logic: "AND",
    conditions: [gt("revenueGrowth", 15), gt("epsGrowth", 15)],
    sort: { field: "epsGrowth", dir: "desc" },
  },
  { id: "bigCap", group: "fundamental", name: "", logic: "AND", conditions: [gte("marketCap", 50e12)], sort: { field: "marketCap", dir: "desc" } },
  {
    id: "trendValue", group: "fundamental", name: "", logic: "AND",
    conditions: [flag("maUptrend"), gt("pe", 0), lt("pe", 15)],
    sort: { field: "ret1m", dir: "desc" },
  },
];

export const PRESETS: Preset[] = DEFS.map((p) => ({ ...p, builtin: true }));

export const PRESET_GROUPS: PresetGroup[] = ["trend", "momentum", "volume", "candle", "fundamental"];
