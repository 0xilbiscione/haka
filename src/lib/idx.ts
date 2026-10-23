// Indonesia Stock Exchange trading rules used for display and signals.
// Rules change from time to time; keep these tables in sync with IDX
// announcements (https://www.idx.co.id).

/** Price fraction (tick size) by price tier, regular board. */
export function tickSize(price: number): number {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

/** Auto-rejection upper limit (ARA) as a fraction of the reference price. */
export function araPct(ref: number): number {
  if (ref <= 200) return 0.35;
  if (ref <= 5000) return 0.25;
  return 0.2;
}

/**
 * Auto-rejection lower limit (ARB). IDX has switched between a flat 15% and a
 * tiered (symmetric with ARA) limit in recent years; the flat 15% is the
 * conservative default.
 */
export function arbPct(_ref: number): number {
  return 0.15;
}

/** Lowest price on the regular board. */
export const MIN_PRICE = 50;
export const LOT = 100;

/**
 * Lowest price a stock can be pushed to from `ref`. The Rp 50 floor only binds
 * stocks still trading at or above it; stocks already below Rp 50 (watchlist
 * board, full call auction) can trade down to Rp 1.
 */
export function priceFloor(ref: number): number {
  return ref >= MIN_PRICE ? MIN_PRICE : 1;
}

export function roundDownToTick(price: number): number {
  const t = tickSize(price);
  return Math.floor(price / t + 1e-9) * t;
}

export function roundUpToTick(price: number): number {
  const t = tickSize(price);
  return Math.ceil(price / t - 1e-9) * t;
}

export function araPrice(ref: number): number {
  return roundDownToTick(ref * (1 + araPct(ref)));
}

export function arbPrice(ref: number): number {
  return Math.max(priceFloor(ref), roundUpToTick(ref * (1 - arbPct(ref))));
}

export type MarketPhase = "pre" | "session1" | "break" | "session2" | "preclose" | "closed";

/** Current IDX trading phase for a given instant (evaluated in WIB, UTC+7). */
export function marketPhase(now: Date = new Date()): MarketPhase {
  const wib = new Date(now.getTime() + 7 * 3600_000);
  const day = wib.getUTCDay();
  if (day === 0 || day === 6) return "closed";
  const m = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  const at = (h: number, min: number) => h * 60 + min;
  const friday = day === 5;
  if (m >= at(8, 45) && m < at(9, 0)) return "pre";
  if (m >= at(9, 0) && m < (friday ? at(11, 30) : at(12, 0))) return "session1";
  if (m < (friday ? at(14, 0) : at(13, 30)) && m >= (friday ? at(11, 30) : at(12, 0))) return "break";
  if (m >= (friday ? at(14, 0) : at(13, 30)) && m < at(15, 50)) return "session2";
  if (m >= at(15, 50) && m < at(16, 0)) return "preclose";
  return "closed";
}

const idr = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });
const idr2 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

export function fmtPrice(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "–";
  return Math.abs(v) >= 1000 || Number.isInteger(v) ? idr.format(v) : idr2.format(v);
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "–";
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(v);
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "–";
  return `${v > 0 ? "+" : ""}${fmtNum(v, digits)}%`;
}

/** Compact Rupiah / share counts: 1,2 rb · 3,4 jt · 5,6 M · 7,8 T (id) or K/M/B/T (en). */
export function fmtCompact(v: number | null | undefined, lang: "id" | "en" = "id"): string {
  if (v == null || !Number.isFinite(v)) return "–";
  const units = lang === "id" ? ["", " rb", " jt", " M", " T"] : ["", "K", "M", "B", "T"];
  let i = 0;
  let x = Math.abs(v);
  while (x >= 1000 && i < units.length - 1) {
    x /= 1000;
    i++;
  }
  const s = new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-US", { maximumFractionDigits: x < 10 ? 2 : 1 }).format(x);
  return `${v < 0 ? "-" : ""}${s}${units[i]}`;
}
