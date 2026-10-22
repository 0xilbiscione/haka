import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { BEARISH_FLAGS, BULLISH_FLAGS, FLAG_TEXT } from "@/i18n/dict";
import { fmtNum, fmtPct, fmtPrice } from "./idx";
import { getDaily } from "./server/data";
import { findTicker } from "./server/universe";
import { buildSnapshot } from "./snapshot";
import type { Ticker } from "./types";

// Shared Open Graph image rendering (Satori via next/og: flexbox only, inline SVG).

export const OG_SIZE = { width: 1200, height: 630 };

// Inter (SIL OFL, see assets/fonts/LICENSE-Inter.txt), bundled so images need no network.
let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 600 | 800; style: "normal" }[]> | null = null;
function loadFonts() {
  fontsPromise ??= Promise.all(
    ([400, 600, 800] as const).map(async (weight) => ({
      name: "Inter",
      data: await readFile(path.join(process.cwd(), "assets", "fonts", `inter-latin-${weight}-normal.woff`)),
      weight,
      style: "normal" as const,
    })),
  );
  return fontsPromise;
}

async function render(node: React.ReactElement) {
  return new ImageResponse(node, { ...OG_SIZE, fonts: await loadFonts() });
}

const C = {
  bg: "#060a14",
  text: "#e9eef8",
  muted: "#8f9bb3",
  faint: "#5b667e",
  accent: "#6ee7d8",
  accent2: "#8b9cff",
  up: "#2fd47a",
  down: "#ff5470",
  glass: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.14)",
};

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: C.bg,
        backgroundImage: [
          "radial-gradient(circle at 8% 10%, rgba(31,184,166,0.55), transparent 42%)",
          "radial-gradient(circle at 95% 25%, rgba(91,91,240,0.55), transparent 45%)",
          "radial-gradient(circle at 40% 115%, rgba(192,63,208,0.4), transparent 45%)",
        ].join(", "),
        color: C.text,
        fontFamily: "Inter",
        padding: 56,
      }}
    >
      {children}
    </div>
  );
}

function Mark({ size = 56 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
      }}
    >
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 64 64">
        <path d="M6 46 24 28l10 9 22-23" stroke="#04121a" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Brand({ size = 56, sub }: { size?: number; sub?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <Mark size={size} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: size * 0.62, fontWeight: 700, letterSpacing: -1 }}>Haka</span>
        {sub && <span style={{ fontSize: 22, color: C.muted }}>{sub}</span>}
      </div>
    </div>
  );
}

function Pill({ children, color = C.text, bg = C.glass, size = 24 }: { children: React.ReactNode; color?: string; bg?: string; size?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: `${Math.round(size * 0.42)}px ${Math.round(size * 0.9)}px`,
        borderRadius: 999,
        backgroundColor: bg,
        border: `1px solid ${C.border}`,
        color,
        fontSize: size,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

/** SVG line + area paths scaled into a width × height box. */
export function sparkPaths(data: number[], width: number, height: number, pad = 6) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => [i * step, pad + (1 - (v - min) / span) * (height - pad * 2)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${width} ${height} L0 ${height} Z` };
}

/** Deterministic decorative candles for the site card. */
function demoBars(n: number) {
  const bars: { o: number; c: number; h: number; l: number }[] = [];
  let p = 100;
  for (let i = 0; i < n; i++) {
    const o = p;
    const c = p + Math.sin(i * 1.7) * 4 + (i > 14 ? 2.6 : -0.8);
    bars.push({ o, c, h: Math.max(o, c) + 1.5 + ((i * 7) % 3), l: Math.min(o, c) - 1.5 - ((i * 5) % 3) });
    p = c;
  }
  return bars;
}

function DemoCandles({ width, height }: { width: number; height: number }) {
  const n = 28;
  const bars = demoBars(n);
  const min = Math.min(...bars.map((b) => b.l));
  const max = Math.max(...bars.map((b) => b.h));
  const y = (v: number) => 10 + (1 - (v - min) / (max - min)) * (height - 20);
  const w = width / n;
  const ma = bars.map((_, i) => bars.slice(Math.max(0, i - 4), i + 1).reduce((s, b) => s + b.c, 0) / Math.min(i + 1, 5));
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {bars.map((b, i) => {
        const x = i * w + w / 2;
        const color = b.c >= b.o ? C.up : C.down;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(b.h)} y2={y(b.l)} stroke={color} strokeWidth={2} />
            <rect x={x - w * 0.32} width={w * 0.64} y={y(Math.max(b.o, b.c))} height={Math.max(2, Math.abs(y(b.o) - y(b.c)))} fill={color} rx={2} />
          </g>
        );
      })}
      <path d={ma.map((v, i) => `${i ? "L" : "M"}${(i * w + w / 2).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")} stroke="#fbbf24" strokeWidth={3} fill="none" />
    </svg>
  );
}

export function renderSiteImage() {
  return render(
    (
      <Frame>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 600 }}>
          <Brand size={64} sub="Screener Saham BEI" />
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>Screener teknikal seluruh saham BEI</div>
            <div style={{ fontSize: 28, color: C.muted, lineHeight: 1.3 }}>Gratis. Golden cross, RSI, MACD, volume, breakout &amp; pola candlestick.</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <Pill>MA</Pill>
            <Pill>RSI</Pill>
            <Pill>MACD</Pill>
            <Pill>Volume</Pill>
            <Pill>Candlestick</Pill>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: "auto",
            width: 460,
            borderRadius: 36,
            padding: 28,
            backgroundColor: "rgba(255,255,255,0.07)",
            border: `1px solid ${C.border}`,
            gap: 18,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 26, fontWeight: 700 }}>IDX · 900+ saham</span>
            <Pill color="#04121a" bg={C.accent}>
              Live
            </Pill>
          </div>
          <DemoCandles width={404} height={250} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Pill color={C.up} bg="rgba(47,212,122,0.14)">
              Golden cross
            </Pill>
            <Pill color={C.accent2} bg="rgba(139,156,255,0.16)">
              Lonjakan volume
            </Pill>
          </div>
        </div>
      </Frame>
    ),
  );
}

function FallbackStock({ code, ticker }: { code: string; ticker: Ticker | null }) {
  return (
    <Frame>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
        <Brand size={56} sub="Screener Saham BEI" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 150, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>{code}</span>
          {ticker && <span style={{ fontSize: 40, color: C.muted }}>{ticker.name}</span>}
        </div>
        <span style={{ fontSize: 28, color: C.muted }}>Grafik &amp; analisa teknikal · MA · RSI · MACD · Candlestick</span>
      </div>
    </Frame>
  );
}

function Stat({ label, value, color = C.text }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 22, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 34, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

export async function renderStockImage(rawCode: string) {
  const code = rawCode.toUpperCase();
  const valid = /^[A-Z]{4}$/.test(code);
  const ticker = valid ? await findTicker(code).catch(() => null) : null;

  let snap = null;
  if (valid) {
    try {
      const candles = await getDaily(code, "1y");
      snap = candles.length >= 30 ? buildSnapshot(code, candles) : null;
    } catch {
      snap = null;
    }
  }
  if (!snap) return render(<FallbackStock code={valid ? code : "IDX"} ticker={ticker} />);

  const v = snap.v;
  const chg = v.changePct ?? 0;
  const tone = chg > 0 ? C.up : chg < 0 ? C.down : C.muted;
  const spark = snap.spark;
  const sparkTone = spark[spark.length - 1] >= spark[0] ? C.up : C.down;
  const { line, area } = sparkPaths(spark, 1088, 190);
  const date = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "UTC" }).format(snap.time * 1000);
  const flags = [
    ...snap.flags.filter((f) => BULLISH_FLAGS.includes(f)).map((f) => [f, C.up] as const),
    ...snap.flags.filter((f) => BEARISH_FLAGS.includes(f)).map((f) => [f, C.down] as const),
  ].slice(0, 2);
  const range52 =
    v.high52 != null && v.low52 != null && v.high52 > v.low52 && v.close != null ? ((v.close - v.low52) / (v.high52 - v.low52)) * 100 : null;

  return render(
    (
      <Frame>
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Brand size={44} />
            <span style={{ fontSize: 24, color: C.muted }}>IDX · per {date}</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 26 }}>
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 640 }}>
              <span style={{ fontSize: 112, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>{code}</span>
              <span style={{ fontSize: 30, color: C.muted, marginTop: 8 }}>{ticker?.name ?? ""}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
              <span style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>{fmtPrice(v.close)}</span>
              <div
                style={{
                  display: "flex",
                  padding: "6px 18px",
                  borderRadius: 14,
                  fontSize: 32,
                  fontWeight: 700,
                  color: tone,
                  backgroundColor: chg > 0 ? "rgba(47,212,122,0.16)" : chg < 0 ? "rgba(255,84,112,0.16)" : C.glass,
                }}
              >
                {fmtPct(chg)}
              </div>
            </div>
          </div>

          <svg width={1088} height={190} viewBox="0 0 1088 190" style={{ marginTop: 22 }}>
            <defs>
              <linearGradient id="a" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={sparkTone} stopOpacity="0.45" />
                <stop offset="1" stopColor={sparkTone} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#a)" />
            <path d={line} stroke={sparkTone} strokeWidth={5} fill="none" strokeLinejoin="round" />
          </svg>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: "auto" }}>
            <div style={{ display: "flex", gap: 40 }}>
              <Stat label="RSI(14)" value={fmtNum(v.rsi, 0)} color={v.rsi != null && v.rsi < 30 ? C.up : v.rsi != null && v.rsi > 70 ? C.down : C.text} />
              <Stat label="Rasio volume" value={v.volRatio == null ? "–" : `${fmtNum(v.volRatio, 1)}×`} />
              <Stat label="Posisi 52 mgg" value={range52 == null ? "–" : `${fmtNum(range52, 0)}%`} />
            </div>
            <div style={{ display: "flex", gap: 10, maxWidth: 520, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {flags.map(([f, color]) => (
                <Pill key={f} color={color} bg={color === C.up ? "rgba(47,212,122,0.14)" : "rgba(255,84,112,0.14)"} size={21}>
                  {FLAG_TEXT[f].id}
                </Pill>
              ))}
            </div>
          </div>
        </div>
      </Frame>
    ),
  );
}
