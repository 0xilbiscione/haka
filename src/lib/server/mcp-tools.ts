import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { FLAGS, NUM_FIELDS } from "../types";
import {
  analyzeCodes,
  getUniverseSnapshots,
  HISTORY_INDICATORS,
  marketInfo,
  priceHistory,
  resolveScreen,
  runScreen,
  screenCatalog,
  searchTickers,
  summarize,
} from "./market";
import { getUniverse } from "./universe";

export const MCP_INSTRUCTIONS = `Haka screens and analyses every stock on the Indonesia Stock Exchange (IDX/BEI) with technical indicators on daily bars plus fundamental metrics (valuation, profitability, balance sheet) and company profiles.
- Prices are free Yahoo Finance data, delayed ~10–15 minutes and unofficial; say so when relevant and never present output as investment advice.
- Call list_screens first to see preset ids, numeric fields, signal ids and sectors.
- screen_stocks scans the whole market: the first call can take 15–40 s, later calls reuse a cache for 10–60 min.
- Many IDX stocks are illiquid: pass minAvgValue (20-day average traded value in Rupiah, e.g. 1e9 = Rp 1 billion) to focus on tradable names.
- Fundamentals come from TradingView and Yahoo Finance (TTM / latest report), are unofficial and can lag filings; negative P/E means a loss.
- Prices are in Rupiah; 1 lot = 100 shares.`;

const ro = { readOnlyHint: true, openWorldHint: true, idempotentHint: true } as const;
const code = z.string().regex(/^[A-Za-z]{4}$/, "IDX codes are 4 letters, e.g. BBCA").transform((s) => s.toUpperCase());

function ok(data: object) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: data as Record<string, unknown> };
}
function fail(e: unknown) {
  return { isError: true, content: [{ type: "text" as const, text: e instanceof Error ? e.message : String(e) }] };
}

const conditionSchema = z
  .object({
    field: z.enum(NUM_FIELDS).optional().describe("Numeric field on the left side, e.g. rsi, close, volRatio, pe, roe, divYield"),
    op: z.enum([">", ">=", "<", "<=", "crossAbove", "crossBelow"]).optional(),
    value: z.number().optional().describe("Constant to compare with"),
    compareTo: z.enum(NUM_FIELDS).optional().describe("Another field to compare with instead of a constant, e.g. sma200"),
    signal: z.enum(FLAGS).optional().describe("Use a boolean signal instead of a comparison, e.g. goldenCross, volSpike, bullEngulfing"),
    negate: z.boolean().optional().describe("With signal: require the signal to be absent"),
  })
  .describe("Either {field, op, value|compareTo} or {signal, negate?}");

export function registerHakaTools(server: McpServer) {
  server.registerTool(
    "screen_stocks",
    {
      title: "Screen IDX stocks",
      description:
        "Scan all IDX stocks and return those matching a built-in preset (see list_screens) or custom conditions on technical and fundamental fields (e.g. pe, pb, roe, divYield, marketCap), with optional liquidity, price and sector filters. Results include price, change, key indicators, valuation, trend and active signals.",
      inputSchema: z.object({
        preset: z.string().optional().describe("Built-in screen id, e.g. goldenCross, rsiOversold, volSpike, breakout52w, bullishCandle, value, quality, dividend, growth"),
        conditions: z.array(conditionSchema).max(12).optional().describe("Custom conditions (ignored when preset is given)"),
        logic: z.enum(["AND", "OR"]).optional().describe("How custom conditions combine; default AND"),
        minPrice: z.number().min(0).optional().describe("Minimum close price in Rupiah"),
        minAvgValue: z.number().min(0).optional().describe("Minimum 20-day average traded value in Rupiah (e.g. 1000000000 = Rp 1 B)"),
        sectors: z.array(z.string()).max(20).optional().describe("Only these sectors (names from list_screens)"),
        codes: z.array(code).max(200).optional().describe("Limit the scan to these stock codes"),
        sortBy: z.union([z.enum(NUM_FIELDS), z.literal("code")]).optional().describe("Sort field; defaults to the preset's or valueMa20"),
        sortDir: z.enum(["asc", "desc"]).optional(),
        limit: z.number().int().min(1).max(100).optional().describe("Max rows returned, default 25"),
      }),
      annotations: { title: "Screen IDX stocks", ...ro },
    },
    async (args) => {
      try {
        const screen = resolveScreen(args);
        const scan = await getUniverseSnapshots();
        const { total, rows } = runScreen(scan, {
          screen,
          minPrice: args.minPrice,
          minAvgValue: args.minAvgValue,
          sectors: args.sectors,
          codes: args.codes,
          sort: args.sortBy ? { field: args.sortBy, dir: args.sortDir ?? "desc" } : undefined,
          limit: args.limit,
        });
        return ok({
          screen: args.preset ?? (screen ? "custom" : "all"),
          totalMatches: total,
          returned: rows.length,
          asOf: new Date(scan.asOf).toISOString(),
          scanned: scan.scanned,
          withData: scan.snapshots.length,
          failed: scan.failed.length,
          universeSource: scan.universeSource,
          results: rows.map((s) => summarize(s, scan.tickers.get(s.code))),
        });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "analyze_stocks",
    {
      title: "Analyze IDX stocks",
      description:
        "Full picture for 1–10 IDX stocks: latest bar, every technical indicator (latest and previous day), active signals and candlestick patterns, returns, 52-week range, IDX tick size and ARA/ARB prices, fundamental metrics (valuation, margins, ROE, debt, growth) and the company profile (industry, employees, website, business description, management).",
      inputSchema: z.object({ codes: z.array(code).min(1).max(10).describe("Stock codes, e.g. [\"BBCA\", \"TLKM\"]") }),
      annotations: { title: "Analyze IDX stocks", ...ro },
    },
    async ({ codes }) => {
      try {
        return ok({ stocks: await analyzeCodes([...new Set(codes)]) });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "get_price_history",
    {
      title: "Get price history",
      description: "Daily OHLCV candles for one IDX stock, optionally with indicator columns, as compact rows (columns + rows).",
      inputSchema: z.object({
        code,
        range: z.enum(["1y", "2y", "5y"]).optional().describe("History fetched before trimming; default 1y"),
        bars: z.number().int().min(1).max(1250).optional().describe("Most recent bars to return; default 120"),
        indicators: z.array(z.enum(HISTORY_INDICATORS)).max(12).optional().describe("Indicator columns to add, e.g. [\"sma20\",\"sma50\",\"rsi\",\"macdHist\"]"),
      }),
      annotations: { title: "Get price history", ...ro },
    },
    async ({ code, range, bars, indicators }) => {
      try {
        return ok(await priceHistory(code, range ?? "1y", bars ?? 120, indicators ?? []));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "search_tickers",
    {
      title: "Search IDX tickers",
      description: "Find IDX stocks by code or company name, optionally within a sector. Returns code, name and sector.",
      inputSchema: z.object({
        query: z.string().max(60).describe("Code or part of the company name, e.g. \"bank\" or \"BB\"; empty lists all"),
        sector: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional().describe("Default 20"),
      }),
      annotations: { title: "Search IDX tickers", ...ro },
    },
    async ({ query, sector, limit }) => {
      try {
        const { tickers, source } = await getUniverse();
        return ok({ universeSource: source, universeSize: tickers.length, ...searchTickers(tickers, query, sector, limit ?? 20) });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "list_screens",
    {
      title: "List screens, fields and signals",
      description: "Catalog of built-in screen presets, numeric fields, signal ids, comparison operators and sectors accepted by screen_stocks.",
      annotations: { title: "List screens", ...ro },
    },
    async () => {
      try {
        const { tickers } = await getUniverse();
        return ok(screenCatalog(tickers));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    "market_status",
    {
      title: "IDX market status",
      description: "Current IDX trading phase in WIB, session hours, the price data source and scan cache age.",
      annotations: { title: "IDX market status", ...ro },
    },
    async () => ok(marketInfo()),
  );
}
