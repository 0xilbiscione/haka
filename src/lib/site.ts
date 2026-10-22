// Shared site identity for metadata, OG images, sitemap and structured data.

export const SITE_NAME = "Haka";
export const SITE_TITLE = "Haka — Screener Saham BEI Gratis";
export const SITE_DESCRIPTION =
  "Screener teknikal gratis untuk seluruh saham Bursa Efek Indonesia (BEI/IDX): golden cross, RSI, MACD, Stochastic, ADX, lonjakan volume, breakout 52 minggu, Bollinger squeeze, dan pola candlestick.";
export const SITE_DESCRIPTION_EN =
  "Free technical stock screener for every Indonesia Stock Exchange (IDX) stock: golden cross, RSI, MACD, Stochastic, ADX, volume spikes, 52-week breakouts, Bollinger squeeze and candlestick patterns.";
export const SITE_KEYWORDS = [
  "screener saham",
  "screener saham BEI",
  "saham BEI",
  "saham IDX",
  "analisa teknikal saham",
  "analisis teknikal",
  "golden cross saham",
  "RSI oversold",
  "MACD",
  "breakout saham",
  "pola candlestick",
  "IDX stock screener",
  "Indonesia stock screener",
];

/** Absolute site origin: explicit env, then Vercel's production / deployment URL, then localhost. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  const deploy = process.env.VERCEL_URL;
  if (deploy) return `https://${deploy}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/** Serializes JSON-LD safely for an inline <script> tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
