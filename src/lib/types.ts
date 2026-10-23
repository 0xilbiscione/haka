export interface Candle {
  /** Unix seconds (exchange-local trading day). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker {
  code: string;
  name: string;
  sector?: string;
}

export type Series = (number | null)[];

/** Technical fields computed from daily candles. */
export const TECH_FIELDS = [
  "close",
  "open",
  "high",
  "low",
  "changePct",
  "volume",
  "value",
  "sma5",
  "sma10",
  "sma20",
  "sma50",
  "sma100",
  "sma200",
  "ema9",
  "ema21",
  "ema50",
  "rsi",
  "macd",
  "macdSignal",
  "macdHist",
  "stochK",
  "stochD",
  "adx",
  "plusDI",
  "minusDI",
  "bbUpper",
  "bbMid",
  "bbLower",
  "bbWidth",
  "bbPctB",
  "atr",
  "atrPct",
  "volMa20",
  "volRatio",
  "valueMa20",
  "high52",
  "low52",
  "fromHigh52Pct",
  "fromLow52Pct",
  "ret1w",
  "ret1m",
  "ret3m",
] as const;

/** Fundamental fields (latest reported / trailing twelve months). Constant across bars. */
export const FUNDAMENTAL_FIELDS = [
  "marketCap",
  "pe",
  "pb",
  "ps",
  "evEbitda",
  "divYield",
  "eps",
  "bvps",
  "roe",
  "roa",
  "grossMargin",
  "opMargin",
  "netMargin",
  "der",
  "currentRatio",
  "revenue",
  "netIncome",
  "revenueGrowth",
  "epsGrowth",
  "beta",
] as const;
export type FundamentalField = (typeof FUNDAMENTAL_FIELDS)[number];

/** Numeric fields available to screens. */
export const NUM_FIELDS = [...TECH_FIELDS, ...FUNDAMENTAL_FIELDS] as const;
export type NumField = (typeof NUM_FIELDS)[number];

export type Fundamentals = Partial<Record<FundamentalField, number | null>>;

export interface CompanyProfile {
  code: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  employees: number | null;
  website: string | null;
  description: string | null;
  address: string | null;
  sharesOutstanding: number | null;
  floatShares: number | null;
  officers: { name: string; title: string }[];
}

/** Boolean signal flags available to screens. */
export const FLAGS = [
  "goldenCross",
  "deathCross",
  "maUptrend",
  "maDowntrend",
  "macdBullCross",
  "macdBearCross",
  "stochBullCross",
  "stochBearCross",
  "bbSqueeze",
  "bbBreakoutUp",
  "breakout52w",
  "breakdown52w",
  "volSpike",
  "rsiBullDiv",
  "rsiBearDiv",
  "nearAra",
  "nearArb",
  "hammer",
  "invertedHammer",
  "shootingStar",
  "hangingMan",
  "doji",
  "bullEngulfing",
  "bearEngulfing",
  "morningStar",
  "eveningStar",
  "piercing",
  "darkCloud",
  "bullishCandle",
  "bearishCandle",
] as const;
export type Flag = (typeof FLAGS)[number];

export type NumMap = Partial<Record<NumField, number | null>>;

export interface Snapshot {
  code: string;
  /** Unix seconds of the latest bar. */
  time: number;
  bars: number;
  /** Values at the latest bar. */
  v: NumMap;
  /** Values at the previous bar (for crossovers). */
  p: NumMap;
  flags: Flag[];
  /** Last ~40 closes for sparklines. */
  spark: number[];
}
