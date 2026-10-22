import type { Metadata } from "next";
import { Watchlist } from "@/components/Watchlist";

export const metadata: Metadata = { title: "Pantauan" };

export default function WatchlistPage() {
  return <Watchlist />;
}
