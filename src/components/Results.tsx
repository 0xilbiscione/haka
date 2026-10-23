"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BEARISH_FLAGS, BULLISH_FLAGS, FIELD_TEXT, FLAG_TEXT, NEUTRAL_FLAGS } from "@/i18n/dict";
import { fmtCompact, fmtNum, fmtPct, fmtPrice } from "@/lib/idx";
import { NUM_FIELDS, type Flag, type NumField, type Snapshot } from "@/lib/types";
import { useApp } from "./AppProvider";
import { IconSort } from "./Icons";
import { Sparkline } from "./Sparkline";
import { WatchButton } from "./WatchButton";

export type SortKey = NumField | "code";
export interface SortState {
  field: SortKey;
  dir: "asc" | "desc";
}

const PAGE = 60;
const COLS_KEY = "haka:columns";
const DEFAULT_COLS: NumField[] = ["valueMa20", "volRatio", "rsi", "adx", "ret1m", "pe"];

const PCT_FIELDS = new Set<NumField>(["changePct", "fromHigh52Pct", "fromLow52Pct", "ret1w", "ret1m", "ret3m", "revenueGrowth", "epsGrowth"]);
/** Percent values shown without a "+" sign. */
const RATE_FIELDS = new Set<NumField>(["divYield", "roe", "roa", "grossMargin", "opMargin", "netMargin"]);
const MULTIPLE_FIELDS = new Set<NumField>(["pe", "pb", "ps", "evEbitda"]);
const PRICE_FIELDS = new Set<NumField>([
  "close", "open", "high", "low", "sma5", "sma10", "sma20", "sma50", "sma100", "sma200", "ema9", "ema21", "ema50",
  "bbUpper", "bbMid", "bbLower", "atr", "high52", "low52",
]);
const COMPACT_FIELDS = new Set<NumField>(["volume", "value", "volMa20", "valueMa20", "marketCap", "revenue", "netIncome"]);

export function fmtField(f: NumField, v: number | null | undefined, lang: "id" | "en") {
  if (PCT_FIELDS.has(f)) return fmtPct(v);
  if (PRICE_FIELDS.has(f) || f === "eps" || f === "bvps") return fmtPrice(v);
  if (RATE_FIELDS.has(f)) return v == null ? "–" : `${fmtNum(v, 1)}%`;
  if (MULTIPLE_FIELDS.has(f)) return v == null ? "–" : `${fmtNum(v, 1)}×`;
  if (f === "der" || f === "currentRatio" || f === "beta") return fmtNum(v, 2);
  if (COMPACT_FIELDS.has(f)) return fmtCompact(v, lang);
  if (f === "volRatio") return v == null ? "–" : `${fmtNum(v, 1)}×`;
  if (f === "bbWidth" || f === "atrPct") return v == null ? "–" : `${fmtNum(v, 1)}%`;
  return fmtNum(v, f === "macd" || f === "macdSignal" || f === "macdHist" || f === "bbPctB" ? 2 : 1);
}

export function ChangePill({ v }: { v: number | null | undefined }) {
  const cls = v == null || v === 0 ? "bg-[var(--glass-strong)] text-muted" : v > 0 ? "bg-up/15 text-up" : "bg-down/15 text-down";
  return <span className={`num inline-flex min-w-[4.5rem] justify-center rounded-lg px-2 py-1 text-xs font-semibold ${cls}`}>{fmtPct(v)}</span>;
}

export function SignalChips({ flags, max = 3 }: { flags: Flag[]; max?: number }) {
  const { tr } = useApp();
  const ordered = [
    ...flags.filter((f) => BULLISH_FLAGS.includes(f)).map((f) => [f, "up"] as const),
    ...flags.filter((f) => BEARISH_FLAGS.includes(f)).map((f) => [f, "down"] as const),
    ...flags.filter((f) => NEUTRAL_FLAGS.includes(f)).map((f) => [f, "n"] as const),
  ];
  if (!ordered.length) return null;
  const shown = ordered.slice(0, max);
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map(([f, tone]) => (
        <span
          key={f}
          className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${tone === "up" ? "bg-up/12 text-up" : tone === "down" ? "bg-down/12 text-down" : "bg-accent-2/15 text-accent-2"}`}
        >
          {tr(FLAG_TEXT[f])}
        </span>
      ))}
      {ordered.length > max && <span className="px-1 text-[10.5px] text-faint">+{ordered.length - max}</span>}
    </span>
  );
}

function useColumns() {
  const [cols, setCols] = useState<NumField[]>(DEFAULT_COLS);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate saved columns after mount
      if (raw) setCols(JSON.parse(raw));
    } catch {}
  }, []);
  const update = (next: NumField[]) => {
    setCols(next);
    try {
      localStorage.setItem(COLS_KEY, JSON.stringify(next));
    } catch {}
  };
  return [cols, update] as const;
}

export function ResultsList({
  rows,
  sort,
  onSort,
}: {
  rows: Snapshot[];
  sort: SortState;
  onSort: (s: SortState) => void;
}) {
  const { tickerMap, t, tr, lang } = useApp();
  const [limit, setLimit] = useState(PAGE);
  const [cols, setCols] = useColumns();
  const [colsOpen, setColsOpen] = useState(false);
  const visible = rows.slice(0, limit);

  const header = (field: SortKey, label: string, align: "left" | "right" = "right") => (
    <th scope="col" className={`px-3 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`} aria-sort={sort.field === field ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 hover:text-text ${sort.field === field ? "text-text" : ""}`}
        onClick={() => onSort({ field, dir: sort.field === field && sort.dir === "desc" ? "asc" : "desc" })}
      >
        {label}
        {sort.field === field && <span aria-hidden="true">{sort.dir === "desc" ? "↓" : "↑"}</span>}
      </button>
    </th>
  );

  return (
    <div>
      {/* Mobile: cards */}
      <ul className="space-y-2 md:hidden">
        {visible.map((s) => {
          const tk = tickerMap.get(s.code);
          return (
            <li key={s.code}>
              <div className="glass glass-hover flex items-center rounded-[20px] pr-1.5">
                <Link href={`/stock/${s.code}`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold tracking-tight">{s.code}</span>
                    <span className="truncate text-xs text-muted">{tk?.name}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="num text-[15px] font-semibold">{fmtPrice(s.v.close)}</span>
                    <ChangePill v={s.v.changePct} />
                  </div>
                  <div className="mt-1.5">
                    <SignalChips flags={s.flags} max={2} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Sparkline data={s.spark} width={76} height={30} />
                  <span className="num text-[10.5px] text-faint">
                    RSI {fmtNum(s.v.rsi, 0)}
                    {s.v.pe != null && <> · PE {fmtNum(s.v.pe, 0)}</>} · {fmtCompact(s.v.valueMa20, lang)}
                  </span>
                </div>
                </Link>
                <WatchButton code={s.code} />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop: table */}
      <div className="glass hidden overflow-hidden rounded-[24px] md:block">
        <div className="flex items-center justify-end border-b border-line px-3 py-2">
          <div className="relative">
            <button type="button" className="chip min-h-8 text-xs" onClick={() => setColsOpen((o) => !o)} aria-expanded={colsOpen}>
              <IconSort size={14} />
              {t("columns")}
            </button>
            {colsOpen && (
              <div className="glass-strong absolute right-0 z-20 mt-2 grid max-h-80 w-72 grid-cols-1 overflow-auto rounded-2xl p-2 text-sm">
                {NUM_FIELDS.filter((f) => f !== "close" && f !== "changePct").map((f) => (
                  <label key={f} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--glass-hover)]">
                    <input
                      type="checkbox"
                      className="accent-[var(--accent)]"
                      checked={cols.includes(f)}
                      onChange={(e) => setCols(e.target.checked ? [...cols, f] : cols.filter((c) => c !== f))}
                    />
                    {tr(FIELD_TEXT[f])}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                {header("code", t("code"), "left")}
                {header("close", t("price"))}
                {header("changePct", t("change"))}
                {cols.map((c) => header(c, tr(FIELD_TEXT[c])))}
                <th scope="col" className="px-3 py-3 text-left font-medium">{t("signals")}</th>
                <th scope="col" className="px-3 py-3 font-medium">
                  <span className="sr-only">Chart</span>
                </th>
                <th scope="col" className="w-12" />
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => {
                const tk = tickerMap.get(s.code);
                return (
                  <tr key={s.code} className="border-b border-line/60 transition-colors last:border-0 hover:bg-[var(--glass-hover)]">
                    <td className="px-3 py-2">
                      <Link href={`/stock/${s.code}`} className="block">
                        <span className="font-bold">{s.code}</span>
                        <span className="block max-w-48 truncate text-xs text-muted">{tk?.name}</span>
                      </Link>
                    </td>
                    <td className="num px-3 py-2 text-right font-semibold">{fmtPrice(s.v.close)}</td>
                    <td className="px-3 py-2 text-right">
                      <ChangePill v={s.v.changePct} />
                    </td>
                    {cols.map((c) => (
                      <td key={c} className="num px-3 py-2 text-right text-muted">
                        {fmtField(c, s.v[c], lang)}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <SignalChips flags={s.flags} />
                    </td>
                    <td className="px-3 py-2">
                      <Sparkline data={s.spark} />
                    </td>
                    <td className="pr-2">
                      <WatchButton code={s.code} size={18} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {rows.length > limit && (
        <div className="mt-4 text-center">
          <button type="button" className="btn btn-ghost" onClick={() => setLimit((l) => l + PAGE)}>
            +{Math.min(PAGE, rows.length - limit)} · <span className="num">{rows.length - limit}</span>
          </button>
        </div>
      )}
    </div>
  );
}
