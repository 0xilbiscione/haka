"use client";

import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import { BEARISH_FLAGS, BULLISH_FLAGS, FLAG_TEXT } from "@/i18n/dict";
import { detectPatterns } from "@/lib/patterns";
import { computeSeries } from "@/lib/snapshot";
import type { Candle, Series } from "@/lib/types";
import { useApp } from "./AppProvider";

export type Overlay = "ma20" | "ma50" | "ma200" | "ema" | "bb" | "patterns";
export type Lower = "rsi" | "macd" | "stoch";

const OVERLAY_COLORS = { ma20: "#fbbf24", ma50: "#38bdf8", ma200: "#e879f9", ema9: "#a3e635", ema21: "#fb923c", bb: "#94a3b8" };

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function line(candles: Candle[], s: Series) {
  const out: { time: UTCTimestamp; value: number }[] = [];
  s.forEach((v, i) => {
    if (v != null) out.push({ time: candles[i].time as UTCTimestamp, value: v });
  });
  return out;
}

export function Chart({ candles, overlays, lowers, visibleBars }: { candles: Candle[]; overlays: Overlay[]; lowers: Lower[]; visibleBars: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { tr, lang } = useApp();

  useEffect(() => {
    const el = ref.current;
    if (!el || candles.length === 0) return;

    const up = cssVar("--up");
    const down = cssVar("--down");
    const text = cssVar("--muted");
    const grid = cssVar("--border");
    const fmt = new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: 2 });

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: text,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        attributionLogo: false,
        panes: { separatorColor: grid, separatorHoverColor: grid },
      },
      grid: { vertLines: { color: "transparent" }, horzLines: { color: grid } },
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, rightOffset: 4 },
      localization: { locale: lang === "id" ? "id-ID" : "en-US", priceFormatter: (p: number) => fmt.format(p) },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
    });
    chartRef.current = chart;

    const s = computeSeries(candles);
    const t = (i: number) => candles[i].time as UTCTimestamp;

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderVisible: false,
      wickUpColor: up,
      wickDownColor: down,
      priceLineVisible: true,
    });
    candle.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));

    const vol = chart.addSeries(HistogramSeries, { priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.volume, color: `${c.close >= c.open ? up : down}55` })));

    const addLine = (data: Series, color: string, pane = 0, width: 1 | 2 = 1, style: LineStyle = LineStyle.Solid) => {
      const ls = chart.addSeries(LineSeries, { color, lineWidth: width, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }, pane);
      ls.setData(line(candles, data));
      return ls;
    };

    if (overlays.includes("ma20")) addLine(s.sma20, OVERLAY_COLORS.ma20);
    if (overlays.includes("ma50")) addLine(s.sma50, OVERLAY_COLORS.ma50);
    if (overlays.includes("ma200")) addLine(s.sma200, OVERLAY_COLORS.ma200, 0, 2);
    if (overlays.includes("ema")) {
      addLine(s.ema9, OVERLAY_COLORS.ema9);
      addLine(s.ema21, OVERLAY_COLORS.ema21);
    }
    if (overlays.includes("bb")) {
      addLine(s.bbUpper, OVERLAY_COLORS.bb, 0, 1, LineStyle.Dashed);
      addLine(s.bbMid, OVERLAY_COLORS.bb, 0, 1, LineStyle.Dotted);
      addLine(s.bbLower, OVERLAY_COLORS.bb, 0, 1, LineStyle.Dashed);
    }

    // Candlestick pattern markers on the recent bars; only the newest few carry a label.
    const markers: SeriesMarker<Time>[] = [];
    for (let i = Math.max(10, candles.length - 90); i < candles.length && overlays.includes("patterns"); i++) {
      const flags = detectPatterns(candles.slice(0, i + 1));
      const bull = flags.find((f) => BULLISH_FLAGS.includes(f));
      const bear = flags.find((f) => BEARISH_FLAGS.includes(f));
      if (bull) markers.push({ time: t(i), position: "belowBar", color: up, shape: "arrowUp", text: tr(FLAG_TEXT[bull]) });
      else if (bear) markers.push({ time: t(i), position: "aboveBar", color: down, shape: "arrowDown", text: tr(FLAG_TEXT[bear]) });
    }
    markers.forEach((m, i) => {
      if (i < markers.length - 3) m.text = undefined;
    });
    createSeriesMarkers(candle, markers);

    let pane = 0;
    for (const lower of lowers) {
      pane++;
      if (lower === "rsi") {
        const r = addLine(s.rsi, "#a78bfa", pane, 2);
        r.applyOptions({ lastValueVisible: true });
        r.createPriceLine({ price: 70, color: down, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
        r.createPriceLine({ price: 30, color: up, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
      } else if (lower === "macd") {
        const h = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pane);
        h.setData(
          s.macdHist.flatMap((v, i) => (v == null ? [] : [{ time: t(i), value: v, color: `${v >= 0 ? up : down}99` }])),
        );
        addLine(s.macd, "#38bdf8", pane, 2);
        addLine(s.macdSignal, "#fb923c", pane);
      } else {
        const k = addLine(s.stochK, "#38bdf8", pane, 2);
        addLine(s.stochD, "#fb923c", pane);
        k.createPriceLine({ price: 80, color: down, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
        k.createPriceLine({ price: 20, color: up, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
      }
    }
    const panes = chart.panes();
    panes[0]?.setStretchFactor(3);
    for (let i = 1; i < panes.length; i++) panes[i].setStretchFactor(1);

    const n = candles.length;
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - visibleBars), to: n + 3 });

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, overlays, lowers, visibleBars, tr, lang]);

  // Rebuild colors when the theme flips.
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const c = chartRef.current;
      if (!c) return;
      c.applyOptions({ layout: { textColor: cssVar("--muted") }, grid: { horzLines: { color: cssVar("--border") } } });
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const height = 300 + lowers.length * 110;
  return <div ref={ref} style={{ height }} className="w-full" />;
}
