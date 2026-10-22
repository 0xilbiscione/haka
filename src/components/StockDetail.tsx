"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BEARISH_FLAGS, BULLISH_FLAGS, FIELD_TEXT, FLAG_TEXT, NEUTRAL_FLAGS } from "@/i18n/dict";
import { araPct, araPrice, arbPct, arbPrice, fmtCompact, fmtPrice, LOT, tickSize } from "@/lib/idx";
import { buildSnapshot } from "@/lib/snapshot";
import type { Candle, NumField, Snapshot } from "@/lib/types";
import { useApp } from "./AppProvider";
import type { Lower, Overlay } from "./Chart";
import { IconArrowLeft } from "./Icons";
import { ChangePill, fmtField } from "./Results";
import { WatchButton } from "./WatchButton";

const Chart = dynamic(() => import("./Chart").then((m) => m.Chart), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse rounded-2xl bg-[var(--glass)]" />,
});

const RANGES = [
  { id: "3M", bars: 63, fetch: "2y" },
  { id: "6M", bars: 126, fetch: "2y" },
  { id: "1Y", bars: 250, fetch: "2y" },
  { id: "2Y", bars: 500, fetch: "2y" },
  { id: "5Y", bars: 1250, fetch: "5y" },
] as const;

const OVERLAYS: { id: Overlay; label: string }[] = [
  { id: "ma20", label: "MA20" },
  { id: "ma50", label: "MA50" },
  { id: "ma200", label: "MA200" },
  { id: "ema", label: "EMA 9/21" },
  { id: "bb", label: "BB 20,2" },
  { id: "patterns", label: "Candle" },
];
const LOWERS: { id: Lower; label: string }[] = [
  { id: "rsi", label: "RSI" },
  { id: "macd", label: "MACD" },
  { id: "stoch", label: "Stoch" },
];

const GROUPS: { title: "trend" | "momentum" | "volatility" | "performance"; fields: NumField[] }[] = [
  { title: "trend", fields: ["sma20", "sma50", "sma200", "ema9", "ema21", "adx", "plusDI", "minusDI"] },
  { title: "momentum", fields: ["rsi", "macd", "macdSignal", "macdHist", "stochK", "stochD"] },
  { title: "volatility", fields: ["atr", "atrPct", "bbUpper", "bbLower", "bbWidth", "volume", "volRatio", "valueMa20"] },
  { title: "performance", fields: ["ret1w", "ret1m", "ret3m", "high52", "low52", "fromHigh52Pct", "fromLow52Pct"] },
];

export function StockDetail({ code }: { code: string }) {
  const { t, tr, lang, tickerMap, dataSource } = useApp();
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[1]);
  const [overlays, setOverlays] = useState<Overlay[]>(["ma20", "ma50", "ma200", "patterns"]);
  const [lowers, setLowers] = useState<Lower[]>(["rsi", "macd"]);
  const [data, setData] = useState<{ key: string; candles?: Candle[]; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const fetchKey = `${code}:${range.fetch}:${attempt}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/history?code=${code}&range=${range.fetch}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        return j.candles as Candle[];
      })
      .then((candles) => !cancelled && setData({ key: fetchKey, candles }))
      .catch((e: Error) => !cancelled && setData({ key: fetchKey, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [code, range.fetch, fetchKey]);

  const loading = !data || data.key !== fetchKey;
  const candles = !loading ? data.candles : undefined;
  const snap: Snapshot | null = useMemo(() => (candles ? buildSnapshot(code, candles) : null), [code, candles]);
  const tk = tickerMap.get(code);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const prevClose = snap?.p.close ?? null;
  const last = snap?.v.close ?? null;

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-2">
        <Link href="/" className="grid size-11 place-items-center rounded-full text-muted hover:bg-[var(--glass-hover)] hover:text-text" aria-label={t("back")}>
          <IconArrowLeft />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            {code}
            {dataSource === "fixture" && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-warn">{t("demoData")}</span>}
          </h1>
          <p className="truncate text-sm text-muted">
            {tk?.name}
            {tk?.sector && <span className="text-faint"> · {tk.sector}</span>}
          </p>
        </div>
        <WatchButton code={code} size={22} />
      </div>

      <section className="glass rounded-[26px] p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-1 px-1 pb-3">
          <span className="num text-3xl font-bold tracking-tight">{fmtPrice(last)}</span>
          {snap && <ChangePill v={snap.v.changePct} />}
          {snap && (
            <span className="num pb-1 text-xs text-faint">
              {t("asOf")} {new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(snap.time * 1000)}
            </span>
          )}
        </div>

        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2">
          {RANGES.map((r) => (
            <button key={r.id} type="button" className="chip min-h-9 px-3 text-xs" aria-pressed={range.id === r.id} onClick={() => setRange(r)}>
              {r.id}
            </button>
          ))}
          <span className="mx-1 w-px shrink-0 bg-[var(--border)]" />
          {OVERLAYS.map((o) => (
            <button key={o.id} type="button" className="chip min-h-9 px-3 text-xs" aria-pressed={overlays.includes(o.id)} onClick={() => setOverlays(toggle(overlays, o.id))}>
              {o.label}
            </button>
          ))}
          <span className="mx-1 w-px shrink-0 bg-[var(--border)]" />
          {LOWERS.map((o) => (
            <button key={o.id} type="button" className="chip min-h-9 px-3 text-xs" aria-pressed={lowers.includes(o.id)} onClick={() => setLowers(toggle(lowers, o.id))}>
              {o.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-[520px] animate-pulse rounded-2xl bg-[var(--glass)]" />
        ) : candles ? (
          <Chart candles={candles} overlays={overlays} lowers={lowers} visibleBars={range.bars} />
        ) : (
          <div className="grid h-72 place-items-center text-center text-sm text-muted">
            <div>
              <p>
                {t("loadError")}: {data?.error}
              </p>
              <button type="button" className="btn btn-ghost mt-3" onClick={() => setAttempt((a) => a + 1)}>
                {t("retry")}
              </button>
            </div>
          </div>
        )}
      </section>

      {snap && (
        <>
          <section className="glass rounded-[24px] p-4">
            <h2 className="mb-2.5 text-sm font-semibold">{t("activeSignals")}</h2>
            {snap.flags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {snap.flags
                  .filter((f) => f !== "bullishCandle" && f !== "bearishCandle")
                  .map((f) => (
                    <span
                      key={f}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${BULLISH_FLAGS.includes(f) ? "bg-up/12 text-up" : BEARISH_FLAGS.includes(f) ? "bg-down/12 text-down" : NEUTRAL_FLAGS.includes(f) ? "bg-accent-2/15 text-accent-2" : "bg-[var(--glass-strong)]"}`}
                    >
                      {tr(FLAG_TEXT[f])}
                    </span>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted">{t("noSignals")}</p>
            )}
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            {GROUPS.map((g) => (
              <section key={g.title} className="glass rounded-[24px] p-4">
                <h2 className="mb-2 text-sm font-semibold">{t(g.title)}</h2>
                <dl className="grid grid-cols-2 gap-x-4 text-sm">
                  {g.fields.map((f) => (
                    <div key={f} className="flex items-baseline justify-between gap-2 border-b border-line/60 py-1.5 last:border-0 [&:nth-last-child(2)]:border-0">
                      <dt className="truncate text-xs text-muted">{tr(FIELD_TEXT[f])}</dt>
                      <dd className="num font-medium">{fmtField(f, snap.v[f], lang)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}

            {prevClose != null && last != null && (
              <section className="glass rounded-[24px] p-4 sm:col-span-2">
                <h2 className="mb-2 text-sm font-semibold">{t("idxRules")}</h2>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Stat label={t("tick")} value={`Rp ${fmtPrice(tickSize(last))}`} />
                  <Stat label={`${t("araLimit")} (${Math.round(araPct(prevClose) * 100)}%)`} value={fmtPrice(araPrice(prevClose))} tone="up" />
                  <Stat label={`${t("arbLimit")} (${Math.round(arbPct(prevClose) * 100)}%)`} value={fmtPrice(arbPrice(prevClose))} tone="down" />
                  <Stat label={`${t("lot")} = ${LOT} ${t("shares")}`} value={`Rp ${fmtCompact(last * LOT, lang)}`} />
                </dl>
              </section>
            )}
          </div>
        </>
      )}

      <p className="px-2 text-center text-[11px] leading-relaxed text-faint">{t("disclaimer")}</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-2xl bg-[var(--glass)] p-3">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={`num mt-0.5 text-base font-semibold ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""}`}>{value}</dd>
    </div>
  );
}
