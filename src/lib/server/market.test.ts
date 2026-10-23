import { describe, expect, it } from "vitest";
import { buildSnapshot } from "../snapshot";
import type { Snapshot, Ticker } from "../types";
import { fixtureDaily } from "./fixture";
import { priceHistory, resolveScreen, runScreen, screenCatalog, searchTickers, summarize } from "./market";

const tickers: Ticker[] = [
  { code: "BBCA", name: "Bank Central Asia", sector: "Finance" },
  { code: "BBRI", name: "Bank Rakyat Indonesia", sector: "Finance" },
  { code: "TLKM", name: "Telkom Indonesia", sector: "Communications" },
  { code: "ANTM", name: "Aneka Tambang", sector: "Non-Energy Minerals" },
];
const snapshots = tickers.map((t) => buildSnapshot(t.code, fixtureDaily(t.code, 250))!) as Snapshot[];
const scan = { snapshots, tickers: new Map(tickers.map((t) => [t.code, t])) };

describe("resolveScreen", () => {
  it("maps preset ids and rejects unknown ones", () => {
    expect(resolveScreen({ preset: "rsiOversold" })?.id).toBe("rsiOversold");
    expect(() => resolveScreen({ preset: "nope" })).toThrow(/Unknown preset/);
  });

  it("builds custom conditions and validates fields", () => {
    const s = resolveScreen({
      conditions: [
        { field: "rsi", op: "<", value: 40 },
        { field: "close", op: ">", compareTo: "sma200" },
        { signal: "volSpike", negate: true },
      ],
      logic: "OR",
    })!;
    expect(s.logic).toBe("OR");
    expect(s.conditions).toEqual([
      { kind: "compare", left: "rsi", op: "<", right: { value: 40 } },
      { kind: "compare", left: "close", op: ">", right: { field: "sma200" } },
      { kind: "flag", flag: "volSpike", negate: true },
    ]);
    expect(() => resolveScreen({ conditions: [{ field: "foo", op: ">", value: 1 }] })).toThrow(/unknown field/);
    expect(() => resolveScreen({ conditions: [{ field: "rsi", op: ">" }] })).toThrow(/numeric value or compareTo/);
    expect(resolveScreen({})).toBeNull();
  });
});

describe("runScreen", () => {
  it("applies filters, sorting and limit", () => {
    const all = runScreen(scan, { screen: null, sort: { field: "close", dir: "asc" } });
    expect(all.total).toBe(4);
    const closes = all.rows.map((s) => s.v.close!);
    expect(closes).toEqual([...closes].sort((a, b) => a - b));

    const fin = runScreen(scan, { screen: null, sectors: ["finance"], limit: 1 });
    expect(fin.total).toBe(2);
    expect(fin.rows).toHaveLength(1);

    expect(runScreen(scan, { screen: null, codes: ["tlkm"] }).rows.map((s) => s.code)).toEqual(["TLKM"]);
    expect(runScreen(scan, { screen: null, minAvgValue: Number.MAX_SAFE_INTEGER }).total).toBe(0);
  });

  it("evaluates screens", () => {
    const rsiBelow = runScreen(scan, { screen: resolveScreen({ conditions: [{ field: "rsi", op: "<", value: 101 }] }) });
    expect(rsiBelow.total).toBe(4);
    const none = runScreen(scan, { screen: resolveScreen({ conditions: [{ field: "rsi", op: ">", value: 101 }] }) });
    expect(none.total).toBe(0);
  });
});

describe("output shaping", () => {
  it("summarizes a snapshot with readable signals and a page URL", () => {
    const row = summarize(snapshots[0], tickers[0]);
    expect(row).toMatchObject({ code: "BBCA", name: "Bank Central Asia", sector: "Finance" });
    expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row.url).toMatch(/\/stock\/BBCA$/);
  });

  it("searches by code and name", () => {
    expect(searchTickers(tickers, "bank", undefined, 10).results.map((t) => t.code)).toEqual(["BBCA", "BBRI"]);
    expect(searchTickers(tickers, "TLKM", undefined, 10).results[0].code).toBe("TLKM");
    expect(searchTickers(tickers, "", "Finance", 1)).toMatchObject({ total: 2, results: [{ code: "BBCA" }] });
  });

  it("lists presets, fields, signals and sectors", () => {
    const c = screenCatalog(tickers);
    expect(c.presets.find((p) => p.id === "goldenCross")?.name).toBe("Golden cross");
    expect(c.fields.some((f) => f.id === "rsi")).toBe(true);
    expect(c.sectors).toContain("Finance");
  });
});

describe("priceHistory", () => {
  it("returns trimmed rows with indicator columns", async () => {
    const h = await priceHistory("BBCA", "1y", 30, ["sma20", "rsi"]);
    expect(h.columns).toEqual(["date", "open", "high", "low", "close", "volume", "sma20", "rsi"]);
    expect(h.rows).toHaveLength(30);
    expect(typeof h.rows[29][6]).toBe("number");
  });
});
