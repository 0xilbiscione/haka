import type { Metadata } from "next";
import { Builder } from "@/components/Builder";

export const metadata: Metadata = {
  title: "Racik Screen Saham Sendiri",
  description: "Buat screener saham BEI sendiri: gabungkan RSI, MACD, moving average, volume, breakout, dan pola candlestick dengan logika AND/OR.",
  alternates: { canonical: "/builder" },
};

export default function BuilderPage() {
  return <Builder />;
}
