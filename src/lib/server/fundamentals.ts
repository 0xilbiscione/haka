import bundled from "@/data/tickers.json";
import type { CompanyProfile, FundamentalField, Fundamentals, Snapshot } from "../types";
import { dataSource } from "./data";

// Fundamental metrics for the whole market come from TradingView's public
// scanner (one request, ~900 rows). Company profiles come from Yahoo Finance's
// quoteSummary API (per stock). Both are free and unofficial, so every field
// is optional and every failure degrades to "not available".

const TV_URL = "https://scanner.tradingview.com/indonesia/scan";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const TTL_MS = 6 * 3600_000;

/**
 * Candidate TradingView columns per metric, in order of preference. The
 * scanner's column names change over time, so unknown ones are detected and
 * dropped (see resolveColumns) and the first non-null candidate wins.
 */
export const TV_COLUMNS: Record<FundamentalField, string[]> = {
  marketCap: ["market_cap_basic"],
  pe: ["price_earnings_ttm"],
  pb: ["price_book_fq", "price_book_ratio"],
  ps: ["price_sales_current", "price_revenue_ttm"],
  evEbitda: ["enterprise_value_ebitda_ttm"],
  divYield: ["dividends_yield_current", "dividend_yield_recent", "dividends_yield"],
  eps: ["earnings_per_share_basic_ttm", "earnings_per_share_diluted_ttm"],
  bvps: ["book_value_per_share_fq", "book_value_per_share"],
  roe: ["return_on_equity_fq", "return_on_equity"],
  roa: ["return_on_assets_fq", "return_on_assets"],
  grossMargin: ["gross_margin_ttm", "gross_margin"],
  opMargin: ["operating_margin_ttm", "operating_margin"],
  netMargin: ["net_margin_ttm", "net_margin"],
  der: ["debt_to_equity_fq", "debt_to_equity"],
  currentRatio: ["current_ratio_fq", "current_ratio"],
  revenue: ["total_revenue_ttm", "total_revenue"],
  netIncome: ["net_income_ttm", "net_income"],
  revenueGrowth: ["total_revenue_yoy_growth_ttm", "revenue_growth_ttm_yoy"],
  epsGrowth: ["earnings_per_share_diluted_yoy_growth_ttm", "eps_diluted_growth_percent_fy"],
  beta: ["beta_1_year"],
};
const TV_PROFILE_COLUMNS = ["industry", "number_of_employees", "total_shares_outstanding_fundamental", "float_shares_outstanding"];

const BASE_FILTER = [{ left: "type", operation: "equal", right: "stock" }];

interface TvResult {
  ok: boolean;
  data?: { s: string; d: unknown[] }[];
}

async function tvRequest(columns: string[], range: [number, number]): Promise<TvResult> {
  try {
    const res = await fetch(TV_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ filter: BASE_FILTER, markets: ["indonesia"], columns: ["name", ...columns], range }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ok: false };
    const json = (await res.json()) as { data?: { s: string; d: unknown[] }[]; error?: string };
    if (json.error || !Array.isArray(json.data)) return { ok: false };
    return { ok: true, data: json.data };
  } catch {
    return { ok: false };
  }
}

/** Keeps only the columns the scanner accepts, bisecting on failure. */
export async function resolveColumns(columns: string[], probe: (cols: string[]) => Promise<boolean>): Promise<string[]> {
  if (columns.length === 0) return [];
  if (await probe(columns)) return columns;
  if (columns.length === 1) return [];
  const mid = Math.ceil(columns.length / 2);
  return [...(await resolveColumns(columns.slice(0, mid), probe)), ...(await resolveColumns(columns.slice(mid), probe))];
}

export interface FundamentalsTable {
  byCode: Map<string, { metrics: Fundamentals; industry: string | null; employees: number | null; sharesOutstanding: number | null; floatShares: number | null }>;
  columns: string[];
  rejected: string[];
  source: "tradingview" | "fixture" | "unavailable";
  asOf: number;
}

let table: { value: FundamentalsTable; expires: number } | null = null;
let tableInflight: Promise<FundamentalsTable> | null = null;
let validColumns: string[] | null = null;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Picks the first non-null candidate column for every metric from one scanner row. */
export function rowToMetrics(columns: string[], d: unknown[]): Fundamentals {
  const at = (c: string) => {
    const i = columns.indexOf(c);
    return i < 0 ? null : num(d[i + 1]); // d[0] is "name"
  };
  const out: Fundamentals = {};
  for (const [field, cands] of Object.entries(TV_COLUMNS) as [FundamentalField, string[]][]) {
    out[field] = cands.map(at).find((v) => v != null) ?? null;
  }
  return out;
}

async function loadTradingView(): Promise<FundamentalsTable> {
  const all = [...new Set([...Object.values(TV_COLUMNS).flat(), ...TV_PROFILE_COLUMNS])];
  // Only remember the accepted columns once some were accepted (a network failure rejects all).
  // Bisecting only makes sense when the endpoint itself is reachable.
  const reachable = validColumns != null || (await tvRequest(["close"], [0, 1])).ok;
  const columns = !reachable ? [] : (validColumns ?? (await resolveColumns(all, async (cols) => (await tvRequest(cols, [0, 1])).ok)));
  if (columns.length) validColumns = columns;
  const res = columns.length ? await tvRequest(columns, [0, 2000]) : { ok: false };
  const byCode: FundamentalsTable["byCode"] = new Map();
  if (res.ok && res.data) {
    const at = (d: unknown[], c: string) => {
      const i = columns.indexOf(c);
      return i < 0 ? undefined : d[i + 1];
    };
    for (const row of res.data) {
      const [exchange, code] = row.s.split(":");
      if (exchange !== "IDX" || !/^[A-Z]{4}$/.test(code)) continue;
      byCode.set(code, {
        metrics: rowToMetrics(columns, row.d),
        industry: str(at(row.d, "industry")),
        employees: num(at(row.d, "number_of_employees")),
        sharesOutstanding: num(at(row.d, "total_shares_outstanding_fundamental")),
        floatShares: num(at(row.d, "float_shares_outstanding")),
      });
    }
  }
  return {
    byCode,
    columns,
    rejected: all.filter((c) => !columns.includes(c)),
    source: byCode.size ? "tradingview" : "unavailable",
    asOf: Date.now(),
  };
}

/** Fundamentals for every IDX stock, cached per instance for 6 hours. Never throws. */
export async function getFundamentalsTable(): Promise<FundamentalsTable> {
  if (table && table.expires > Date.now()) return table.value;
  tableInflight ??= (dataSource === "fixture" ? Promise.resolve(fixtureTable()) : loadTradingView())
    .then((value) => {
      // Retry an empty result sooner than a good one.
      table = { value, expires: Date.now() + (value.byCode.size ? TTL_MS : 10 * 60_000) };
      return value;
    })
    .catch(() => {
      const value: FundamentalsTable = { byCode: new Map(), columns: [], rejected: [], source: "unavailable", asOf: Date.now() };
      table = { value, expires: Date.now() + 10 * 60_000 };
      return value;
    })
    .finally(() => {
      tableInflight = null;
    });
  return tableInflight;
}

/** Copies fundamentals onto a snapshot (same value for the latest and previous bar). */
export function withFundamentals(snap: Snapshot, metrics: Fundamentals | undefined): Snapshot {
  if (!metrics) return snap;
  const v = { ...snap.v };
  const p = { ...snap.p };
  for (const [k, val] of Object.entries(metrics) as [FundamentalField, number | null][]) {
    const rounded = val == null ? null : Math.round(val * 1e4) / 1e4;
    v[k] = rounded;
    p[k] = rounded;
  }
  return { ...snap, v, p };
}

export async function attachFundamentals(snaps: Snapshot[]): Promise<Snapshot[]> {
  const t = await getFundamentalsTable();
  return snaps.map((s) => withFundamentals(s, t.byCode.get(s.code)?.metrics));
}

// ---------- Yahoo profile ----------

let crumbCache: { cookie: string; crumb: string; expires: number } | null = null;

async function yahooSession(force = false) {
  if (!force && crumbCache && crumbCache.expires > Date.now()) return crumbCache;
  const first = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": UA }, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(8000) });
  const cookie = first.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Yahoo cookie unavailable");
  const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, Cookie: cookie },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const crumb = (await crumbRes.text()).trim();
  if (!crumbRes.ok || !crumb || crumb.includes("<")) throw new Error("Yahoo crumb unavailable");
  crumbCache = { cookie, crumb, expires: Date.now() + 3600_000 };
  return crumbCache;
}

type Raw = { raw?: number } | number | undefined | null;
const rawNum = (v: Raw) => (typeof v === "number" ? v : num(v?.raw));

interface QuoteSummary {
  assetProfile?: {
    longBusinessSummary?: string;
    website?: string;
    fullTimeEmployees?: number;
    industry?: string;
    sector?: string;
    address1?: string;
    address2?: string;
    city?: string;
    country?: string;
    companyOfficers?: { name?: string; title?: string }[];
  };
  defaultKeyStatistics?: { sharesOutstanding?: Raw; floatShares?: Raw; priceToBook?: Raw; trailingEps?: Raw; bookValue?: Raw; beta?: Raw };
  summaryDetail?: { trailingPE?: Raw; dividendYield?: Raw; marketCap?: Raw; priceToSalesTrailing12Months?: Raw };
  financialData?: {
    returnOnEquity?: Raw;
    returnOnAssets?: Raw;
    grossMargins?: Raw;
    operatingMargins?: Raw;
    profitMargins?: Raw;
    debtToEquity?: Raw;
    currentRatio?: Raw;
    totalRevenue?: Raw;
    revenueGrowth?: Raw;
    earningsGrowth?: Raw;
  };
  price?: { longName?: string; shortName?: string };
}

async function fetchQuoteSummary(code: string): Promise<QuoteSummary | null> {
  const modules = "assetProfile,defaultKeyStatistics,summaryDetail,financialData,price";
  for (let attempt = 0; attempt < 2; attempt++) {
    const s = await yahooSession(attempt > 0);
    const res = await fetch(
      `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${code}.JK?modules=${modules}&crumb=${encodeURIComponent(s.crumb)}`,
      { headers: { "User-Agent": UA, Cookie: s.cookie, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000) },
    );
    if (res.status === 401 || res.status === 403) continue; // stale crumb: refresh once
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const json = (await res.json()) as { quoteSummary?: { result?: QuoteSummary[] | null } };
    return json.quoteSummary?.result?.[0] ?? null;
  }
  throw new Error("Yahoo authorization failed");
}

/** Yahoo values are fractions (0.18); app fields are percent units (18). */
const pct = (v: Raw) => {
  const n = rawNum(v);
  return n == null ? null : n * 100;
};

export function yahooMetrics(q: QuoteSummary): Fundamentals {
  const f = q.financialData ?? {};
  const k = q.defaultKeyStatistics ?? {};
  const d = q.summaryDetail ?? {};
  const der = rawNum(f.debtToEquity);
  return {
    marketCap: rawNum(d.marketCap),
    pe: rawNum(d.trailingPE),
    pb: rawNum(k.priceToBook),
    ps: rawNum(d.priceToSalesTrailing12Months),
    divYield: pct(d.dividendYield),
    eps: rawNum(k.trailingEps),
    bvps: rawNum(k.bookValue),
    roe: pct(f.returnOnEquity),
    roa: pct(f.returnOnAssets),
    grossMargin: pct(f.grossMargins),
    opMargin: pct(f.operatingMargins),
    netMargin: pct(f.profitMargins),
    der: der == null ? null : der / 100, // Yahoo reports D/E in percent
    currentRatio: rawNum(f.currentRatio),
    revenue: rawNum(f.totalRevenue),
    revenueGrowth: pct(f.revenueGrowth),
    epsGrowth: pct(f.earningsGrowth),
    beta: rawNum(k.beta),
  };
}

export interface StockFundamentals {
  code: string;
  metrics: Fundamentals;
  profile: CompanyProfile;
  sources: { metrics: string; profile: string };
}

const profileCache = new Map<string, { value: StockFundamentals; expires: number }>();

/**
 * Metrics + profile for one stock. TradingView metrics take priority; Yahoo
 * fills gaps and supplies the business description, website and officers.
 */
export async function getStockFundamentals(code: string, base?: { name?: string | null; sector?: string | null }): Promise<StockFundamentals> {
  const hit = profileCache.get(code);
  if (hit && hit.expires > Date.now()) return hit.value;

  const t = await getFundamentalsTable();
  const tv = t.byCode.get(code);
  let q: QuoteSummary | null = null;
  let profileSource = "unavailable";
  if (dataSource === "fixture") {
    q = fixtureQuote(code);
    profileSource = "fixture";
  } else {
    try {
      q = await fetchQuoteSummary(code);
      if (q) profileSource = "yahoo";
    } catch {
      q = null;
    }
  }

  const ym = q ? yahooMetrics(q) : {};
  const metrics: Fundamentals = {};
  for (const field of Object.keys(TV_COLUMNS) as FundamentalField[]) {
    metrics[field] = tv?.metrics[field] ?? ym[field] ?? null;
  }
  const ap = q?.assetProfile;
  const k = q?.defaultKeyStatistics;
  const value: StockFundamentals = {
    code,
    metrics,
    profile: {
      code,
      name: q?.price?.longName ?? base?.name ?? null,
      sector: base?.sector ?? ap?.sector ?? null,
      industry: tv?.industry ?? ap?.industry ?? null,
      employees: tv?.employees ?? ap?.fullTimeEmployees ?? null,
      website: ap?.website ?? null,
      description: ap?.longBusinessSummary ?? null,
      address: [ap?.address1, ap?.address2, ap?.city, ap?.country].filter(Boolean).join(", ") || null,
      sharesOutstanding: tv?.sharesOutstanding ?? rawNum(k?.sharesOutstanding),
      floatShares: tv?.floatShares ?? rawNum(k?.floatShares),
      officers: (ap?.companyOfficers ?? [])
        .filter((o) => o.name)
        .slice(0, 5)
        .map((o) => ({ name: o.name!, title: o.title ?? "" })),
    },
    sources: { metrics: tv ? t.source : q ? profileSource : "unavailable", profile: profileSource },
  };
  profileCache.set(code, { value, expires: Date.now() + (profileSource === "unavailable" ? 10 * 60_000 : 12 * 3600_000) });
  if (profileCache.size > 2000) profileCache.delete(profileCache.keys().next().value!);
  return value;
}

export function fundamentalsStatus() {
  return table
    ? {
        source: table.value.source,
        stocks: table.value.byCode.size,
        columns: table.value.columns.length,
        rejectedColumns: table.value.rejected,
        asOf: new Date(table.value.asOf).toISOString(),
      }
    : null;
}

// ---------- Fixture (demo mode) ----------

function seeded(code: string) {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) h = Math.imul(h ^ code.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function fixtureMetrics(code: string): Fundamentals {
  const r = seeded(code);
  const pe = r() < 0.15 ? -(2 + r() * 20) : 3 + r() * 35;
  const revenue = 1e11 * (1 + r() * 400);
  const netMargin = pe < 0 ? -(r() * 15) : 2 + r() * 30;
  return {
    marketCap: 5e10 * (1 + r() * 3000),
    pe,
    pb: 0.3 + r() * 6,
    ps: 0.2 + r() * 8,
    evEbitda: 2 + r() * 20,
    divYield: r() < 0.4 ? 0 : r() * 12,
    eps: 5 + r() * 500,
    bvps: 50 + r() * 4000,
    roe: -10 + r() * 45,
    roa: -5 + r() * 20,
    grossMargin: 10 + r() * 60,
    opMargin: -5 + r() * 40,
    netMargin,
    der: r() * 3,
    currentRatio: 0.5 + r() * 3,
    revenue,
    netIncome: (revenue * netMargin) / 100,
    revenueGrowth: -20 + r() * 60,
    epsGrowth: -40 + r() * 100,
    beta: 0.3 + r() * 1.7,
  };
}

function fixtureTable(): FundamentalsTable {
  return {
    byCode: new Map(
      (bundled as { code: string }[]).map((t) => [t.code, { metrics: fixtureMetrics(t.code), industry: "Demo industry", employees: 1000, sharesOutstanding: 1e9, floatShares: 4e8 }]),
    ),
    columns: [],
    rejected: [],
    source: "fixture",
    asOf: Date.now(),
  };
}

function fixtureQuote(code: string): QuoteSummary {
  return {
    assetProfile: {
      longBusinessSummary: `${code} is shown with synthetic demo data. Run without DATA_SOURCE=fixture to load the real company profile from Yahoo Finance.`,
      website: "https://www.idx.co.id",
      city: "Jakarta",
      country: "Indonesia",
      companyOfficers: [{ name: "Demo Director", title: "President Director" }],
    },
  };
}
