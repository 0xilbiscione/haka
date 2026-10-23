import { describe, expect, it } from "vitest";
import { PRESETS } from "../presets";
import { evalScreen } from "../rules";
import { buildSnapshot } from "../snapshot";
import { fixtureDaily } from "./fixture";
import { attachFundamentals, getStockFundamentals, resolveColumns, rowToMetrics, TV_COLUMNS, withFundamentals, yahooMetrics } from "./fundamentals";

describe("resolveColumns", () => {
  it("drops columns the endpoint rejects, using few probes", async () => {
    const bad = new Set(["b", "e"]);
    let probes = 0;
    const cols = await resolveColumns(["a", "b", "c", "d", "e", "f"], async (c) => {
      probes++;
      return !c.some((x) => bad.has(x));
    });
    expect(cols).toEqual(["a", "c", "d", "f"]);
    expect(probes).toBeLessThan(12);
  });
  it("returns everything with a single probe when all are valid", async () => {
    let probes = 0;
    expect(await resolveColumns(["a", "b"], async () => (probes++, true))).toEqual(["a", "b"]);
    expect(probes).toBe(1);
  });
});

describe("rowToMetrics", () => {
  it("takes the first non-null candidate column", () => {
    const columns = ["price_earnings_ttm", "price_book_fq", "price_book_ratio", "gross_margin"];
    // d[0] is the name column
    const m = rowToMetrics(columns, ["BBCA", 21.5, null, 4.2, 55]);
    expect(m.pe).toBe(21.5);
    expect(m.pb).toBe(4.2);
    expect(m.grossMargin).toBe(55);
    expect(m.roe).toBeNull();
  });
  it("covers every fundamental field", () => {
    expect(Object.keys(rowToMetrics([], []))).toEqual(Object.keys(TV_COLUMNS));
  });
});

describe("yahooMetrics", () => {
  it("converts Yahoo fractions to percent and D/E percent to a ratio", () => {
    const m = yahooMetrics({
      financialData: { returnOnEquity: { raw: 0.205 }, profitMargins: { raw: 0.45 }, debtToEquity: { raw: 85 } },
      summaryDetail: { trailingPE: { raw: 18.2 }, dividendYield: { raw: 0.031 } },
      defaultKeyStatistics: { priceToBook: 3.9 },
    });
    expect(m.roe).toBeCloseTo(20.5);
    expect(m.netMargin).toBeCloseTo(45);
    expect(m.der).toBeCloseTo(0.85);
    expect(m.pe).toBe(18.2);
    expect(m.divYield).toBeCloseTo(3.1);
    expect(m.pb).toBe(3.9);
    expect(m.roa).toBeNull();
  });
});

describe("withFundamentals + presets", () => {
  const snap = buildSnapshot("TEST", fixtureDaily("TEST", 250))!;

  it("copies metrics onto both bars so crossovers never fire on them", () => {
    const s = withFundamentals(snap, { pe: 8, pb: 1.1, roe: 18 });
    expect(s.v.pe).toBe(8);
    expect(s.p.pe).toBe(8);
    expect(s.v.close).toBe(snap.v.close);
  });

  it("evaluates the value / quality / dividend presets", () => {
    const preset = (id: string) => PRESETS.find((p) => p.id === id)!;
    const cheap = withFundamentals(snap, { pe: 8, pb: 1.1, roe: 18, netMargin: 12, der: 0.4, divYield: 6 });
    const loss = withFundamentals(snap, { pe: -5, pb: 0.8, roe: -3, netMargin: -4, der: 2, divYield: 0 });
    expect(evalScreen(cheap, preset("value"))).toBe(true);
    expect(evalScreen(cheap, preset("quality"))).toBe(true);
    expect(evalScreen(cheap, preset("dividend"))).toBe(true);
    expect(evalScreen(loss, preset("value"))).toBe(false); // negative P/E is excluded
    expect(evalScreen(snap, preset("value"))).toBe(false); // missing data never matches
  });
});

describe("fixture mode", () => {
  it("attaches metrics to scanned snapshots and builds a profile", async () => {
    const [s] = await attachFundamentals([buildSnapshot("BBCA", fixtureDaily("BBCA", 250))!]);
    expect(s.v.marketCap).toBeGreaterThan(0);
    const f = await getStockFundamentals("BBCA", { name: "Bank Central Asia", sector: "Finance" });
    expect(f.profile).toMatchObject({ code: "BBCA", name: "Bank Central Asia", sector: "Finance" });
    expect(f.profile.description).toMatch(/synthetic/);
    expect(f.sources).toEqual({ metrics: "fixture", profile: "fixture" });
  });
});
