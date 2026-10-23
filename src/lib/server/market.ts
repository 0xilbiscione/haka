import { FIELD_TEXT, FLAG_TEXT, PRESET_TEXT } from "@/i18n/dict";
import { araPrice, arbPrice, limitLabel, marketPhase, tickSize } from "../idx";
import { PRESETS } from "../presets";
import { evalScreen, type CompareOp, type Condition, type Screen } from "../rules";
import { siteUrl } from "../site";
import { buildSnapshot, computeSeries } from "../snapshot";
import { FLAGS, NUM_FIELDS, TECH_FIELDS, type Flag, type NumField, type Snapshot, type Ticker } from "../types";
import { dataSource, getDaily, mapLimit, revalidateSeconds } from "./data";
import { attachFundamentals, fundamentalsStatus, getStockFundamentals } from "./fundamentals";
import { getUniverse } from "./universe";

// Server-side market access shared by the MCP tools: a cached full-universe
// scan plus helpers that shape results for language-model consumption.

export interface UniverseScan {
  snapshots: Snapshot[];
  tickers: Map<string, Ticker>;
  asOf: number;
  scanned: number;
  failed: string[];
  universeSource: string;
}

let cache: { scan: UniverseScan; expires: number } | null = null;
let inflight: Promise<UniverseScan> | null = null;

async function scanUniverse(): Promise<UniverseScan> {
  const { tickers, source } = await getUniverse();
  const failed: string[] = [];
  const results = await mapLimit(tickers, 16, async (t) => {
    try {
      const candles = await getDaily(t.code, "1y");
      return candles.length >= 2 ? buildSnapshot(t.code, candles) : null;
    } catch {
      failed.push(t.code);
      return null;
    }
  });
  return {
    snapshots: await attachFundamentals(results.filter((s): s is Snapshot => s != null)),
    tickers: new Map(tickers.map((t) => [t.code, t])),
    asOf: Date.now(),
    scanned: tickers.length,
    failed,
    universeSource: source,
  };
}

/** Snapshots for every listed stock, cached per instance (10 min in market hours, 60 min otherwise). */
export async function getUniverseSnapshots(now = Date.now()): Promise<UniverseScan> {
  if (cache && cache.expires > now) return cache.scan;
  inflight ??= scanUniverse()
    .then((scan) => {
      cache = { scan, expires: Date.now() + revalidateSeconds() * 1000 };
      return scan;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function cacheInfo() {
  return cache ? { asOf: new Date(cache.scan.asOf).toISOString(), expiresAt: new Date(cache.expires).toISOString(), stocks: cache.scan.snapshots.length } : null;
}

/** Test hook. */
export function _resetCache() {
  cache = null;
  inflight = null;
}

// ---------- Screens ----------

export interface ConditionInput {
  field?: string;
  op?: string;
  value?: number;
  compareTo?: string;
  signal?: string;
  negate?: boolean;
}

const OPS: CompareOp[] = [">", ">=", "<", "<=", "crossAbove", "crossBelow"];

const isField = (f: unknown): f is NumField => typeof f === "string" && (NUM_FIELDS as readonly string[]).includes(f);
const isFlag = (f: unknown): f is Flag => typeof f === "string" && (FLAGS as readonly string[]).includes(f);

/** Turns a preset id or a list of condition inputs into a validated Screen. Throws a readable Error on bad input. */
export function resolveScreen(input: { preset?: string; conditions?: ConditionInput[]; logic?: "AND" | "OR" }): Screen | null {
  if (input.preset) {
    const p = PRESETS.find((x) => x.id === input.preset);
    if (!p) throw new Error(`Unknown preset "${input.preset}". Call list_screens for valid ids.`);
    return p;
  }
  if (!input.conditions?.length) return null;
  const conditions: Condition[] = input.conditions.map((c, i) => {
    if (c.signal != null) {
      if (!isFlag(c.signal)) throw new Error(`Condition ${i + 1}: unknown signal "${c.signal}".`);
      return { kind: "flag", flag: c.signal, negate: c.negate };
    }
    if (!isField(c.field)) throw new Error(`Condition ${i + 1}: unknown field "${c.field}".`);
    if (!OPS.includes(c.op as CompareOp)) throw new Error(`Condition ${i + 1}: op must be one of ${OPS.join(", ")}.`);
    if (c.compareTo != null) {
      if (!isField(c.compareTo)) throw new Error(`Condition ${i + 1}: unknown compareTo field "${c.compareTo}".`);
      return { kind: "compare", left: c.field, op: c.op as CompareOp, right: { field: c.compareTo } };
    }
    if (typeof c.value !== "number" || !Number.isFinite(c.value)) throw new Error(`Condition ${i + 1}: give either a numeric value or compareTo.`);
    return { kind: "compare", left: c.field, op: c.op as CompareOp, right: { value: c.value } };
  });
  return { id: "custom", name: "custom", logic: input.logic ?? "AND", conditions };
}

export interface ScreenOptions {
  screen: Screen | null;
  minPrice?: number;
  minAvgValue?: number;
  sectors?: string[];
  codes?: string[];
  sort?: { field: NumField | "code"; dir: "asc" | "desc" };
  limit?: number;
}

export function runScreen(scan: Pick<UniverseScan, "snapshots" | "tickers">, opts: ScreenOptions) {
  const sectors = opts.sectors?.map((s) => s.toLowerCase());
  const codes = opts.codes?.map((c) => c.toUpperCase());
  const matches = scan.snapshots.filter((s) => {
    if (codes?.length && !codes.includes(s.code)) return false;
    if (opts.minPrice && (s.v.close ?? 0) < opts.minPrice) return false;
    if (opts.minAvgValue && (s.v.valueMa20 ?? 0) < opts.minAvgValue) return false;
    if (sectors?.length && !sectors.includes((scan.tickers.get(s.code)?.sector ?? "").toLowerCase())) return false;
    return !opts.screen || evalScreen(s, opts.screen);
  });
  const sort = opts.sort ?? defaultSort(opts.screen);
  const dir = sort.dir === "asc" ? 1 : -1;
  const key = (s: Snapshot) => (sort.field === "code" ? s.code : s.v[sort.field]);
  matches.sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka == null) return 1;
    if (kb == null) return -1;
    return ka < kb ? -dir : ka > kb ? dir : 0;
  });
  return { total: matches.length, rows: matches.slice(0, opts.limit ?? 25) };
}

function defaultSort(screen: Screen | null): { field: NumField; dir: "asc" | "desc" } {
  const preset = screen && PRESETS.find((p) => p.id === screen.id);
  if (preset?.sort) return preset.sort as { field: NumField; dir: "asc" | "desc" };
  return { field: "valueMa20", dir: "desc" };
}

// ---------- Output shaping ----------

const r = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const date = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
const signalNames = (flags: Flag[]) => flags.filter((f) => f !== "bullishCandle" && f !== "bearishCandle").map((f) => FLAG_TEXT[f].en);

/** Compact row for screen results. */
export function summarize(s: Snapshot, t?: Ticker) {
  const v = s.v;
  return {
    code: s.code,
    name: t?.name ?? null,
    sector: t?.sector ?? null,
    date: date(s.time),
    close: v.close,
    changePct: r(v.changePct),
    avgValue20d: r(v.valueMa20, 0),
    volRatio: r(v.volRatio),
    rsi: r(v.rsi, 1),
    adx: r(v.adx, 1),
    macdHist: r(v.macdHist),
    fromHigh52Pct: r(v.fromHigh52Pct),
    ret1m: r(v.ret1m),
    marketCap: r(v.marketCap, 0),
    pe: r(v.pe, 1),
    pb: r(v.pb, 2),
    roe: r(v.roe, 1),
    divYield: r(v.divYield, 2),
    trend: v.sma20 != null && v.sma50 != null && v.sma200 != null && v.close != null
      ? v.close > v.sma20 && v.sma20 > v.sma50 && v.sma50 > v.sma200 ? "up" : v.close < v.sma20 && v.sma20 < v.sma50 && v.sma50 < v.sma200 ? "down" : "mixed"
      : null,
    signals: signalNames(s.flags),
    url: `${siteUrl()}/stock/${s.code}`,
  };
}

/** Full analysis for one stock. */
export function detail(s: Snapshot, t?: Ticker | null) {
  const indicators: Record<string, { now: number | null; prev: number | null }> = {};
  for (const f of TECH_FIELDS) indicators[f] = { now: r(s.v[f], 4), prev: r(s.p[f], 4) };
  const ref = s.p.close ?? s.v.close ?? 0;
  const close = s.v.close ?? 0;
  return {
    code: s.code,
    name: t?.name ?? null,
    sector: t?.sector ?? null,
    date: date(s.time),
    bars: s.bars,
    signals: signalNames(s.flags),
    signalIds: s.flags,
    indicators,
    idxRules: {
      tickSize: tickSize(close),
      araPrice: ref ? araPrice(ref) : null,
      araPct: ref ? ((araPrice(ref) - ref) / ref) * 100 : null,
      araRule: ref ? limitLabel(ref, "ara") : null,
      arbPrice: ref ? arbPrice(ref) : null,
      arbPct: ref ? ((arbPrice(ref) - ref) / ref) * 100 : null,
      arbRule: ref ? limitLabel(ref, "arb") : null,
      lotShares: 100,
      lotValue: close * 100,
    },
    url: `${siteUrl()}/stock/${s.code}`,
  };
}

export async function analyzeCodes(codes: string[]) {
  const { tickers } = await getUniverse();
  const map = new Map(tickers.map((t) => [t.code, t]));
  return mapLimit(codes, 5, async (code) => {
    try {
      const candles = await getDaily(code, "1y");
      const snap = candles.length >= 2 ? buildSnapshot(code, candles) : null;
      if (!snap) return { code, error: "No price data (unknown, suspended or newly listed code)." };
      const t = map.get(code);
      const f = await getStockFundamentals(code, t);
      const fundamentals: Record<string, number | null> = {};
      for (const [k, v] of Object.entries(f.metrics)) fundamentals[k] = r(v, 4);
      return {
        ...detail(snap, t),
        fundamentals,
        profile: { ...f.profile, description: f.profile.description ? f.profile.description.slice(0, 900) : null },
        fundamentalSources: f.sources,
      };
    } catch (e) {
      return { code, error: `Price fetch failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  });
}

export const HISTORY_INDICATORS = [
  "sma5", "sma10", "sma20", "sma50", "sma100", "sma200", "ema9", "ema21", "ema50", "rsi", "macd", "macdSignal", "macdHist",
  "stochK", "stochD", "adx", "plusDI", "minusDI", "bbUpper", "bbMid", "bbLower", "bbWidth", "atr", "volMa20",
] as const;
export type HistoryIndicator = (typeof HISTORY_INDICATORS)[number];

export async function priceHistory(code: string, range: "1y" | "2y" | "5y", bars: number, indicators: HistoryIndicator[]) {
  const candles = await getDaily(code, range);
  if (!candles.length) throw new Error(`No price data for ${code}.`);
  const series = indicators.length ? computeSeries(candles) : null;
  const start = Math.max(0, candles.length - bars);
  const columns = ["date", "open", "high", "low", "close", "volume", ...indicators];
  const rows = candles.slice(start).map((c, j) => {
    const i = start + j;
    return [date(c.time), c.open, c.high, c.low, c.close, c.volume, ...indicators.map((k) => r(series![k][i], 4))];
  });
  return { code, range, bars: rows.length, columns, rows };
}

export function searchTickers(tickers: Ticker[], query: string, sector: string | undefined, limit: number) {
  const q = query.trim().toUpperCase();
  const sec = sector?.toLowerCase();
  const scored = tickers
    .filter((t) => !sec || (t.sector ?? "").toLowerCase() === sec)
    .map((t) => {
      const name = t.name.toUpperCase();
      const score = !q ? 1 : t.code === q ? 4 : t.code.startsWith(q) ? 3 : name.startsWith(q) ? 2 : name.includes(q) || t.code.includes(q) ? 1 : 0;
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.t.code.localeCompare(b.t.code));
  return { total: scored.length, results: scored.slice(0, limit).map(({ t }) => ({ code: t.code, name: t.name, sector: t.sector ?? null })) };
}

export function screenCatalog(tickers: Ticker[]) {
  return {
    presets: PRESETS.map((p) => ({ id: p.id, group: p.group, name: PRESET_TEXT[p.id]?.name.en ?? p.id, description: PRESET_TEXT[p.id]?.desc.en ?? "" })),
    fields: NUM_FIELDS.map((f) => ({ id: f, label: FIELD_TEXT[f].en })),
    signals: FLAGS.map((f) => ({ id: f, label: FLAG_TEXT[f].en })),
    operators: OPS,
    sectors: [...new Set(tickers.map((t) => t.sector).filter((s): s is string => !!s))].sort(),
    notes: [
      "Values are on daily bars; 'prev' means the previous trading day.",
      "crossAbove/crossBelow compare the previous and latest bar.",
      "Percent fields (changePct, ret*, fromHigh52Pct, bbWidth, atrPct) are in percent units, e.g. 5 = 5%.",
      "value / valueMa20 are traded value in Rupiah (close × volume); volume is in shares (1 lot = 100 shares).",
      "Fundamental fields (marketCap … beta) are trailing-twelve-month or latest-report values: marketCap, revenue, netIncome in Rupiah; roe, roa, margins, divYield, revenueGrowth, epsGrowth in percent; pe, pb, ps, evEbitda, der, currentRatio, beta as ratios. Negative pe means a loss.",
    ],
  };
}

export function marketInfo() {
  return {
    phase: marketPhase(),
    timezone: "Asia/Jakarta (WIB, UTC+7)",
    sessions: {
      monThu: "Pre-open 08:45–09:00 · Session 1 09:00–12:00 · Session 2 13:30–15:50 · Pre-close 15:50–16:00",
      friday: "Pre-open 08:45–09:00 · Session 1 09:00–11:30 · Session 2 14:00–15:50 · Pre-close 15:50–16:00",
    },
    dataSource: dataSource === "fixture" ? "fixture (synthetic demo data — NOT real prices)" : "Yahoo Finance daily bars (free, ~10–15 min delayed)",
    scanCache: cacheInfo(),
    fundamentals: fundamentalsStatus(),
    now: new Date().toISOString(),
  };
}
