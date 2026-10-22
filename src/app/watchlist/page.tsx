import type { Metadata } from "next";
import { Watchlist } from "@/components/Watchlist";

export const metadata: Metadata = {
  title: "Pantauan",
  description: "Daftar pantauan saham BEI Anda dengan harga, perubahan, dan sinyal teknikal terbaru.",
  alternates: { canonical: "/watchlist" },
  robots: { index: false, follow: true },
};

export default function WatchlistPage() {
  return <Watchlist />;
}
