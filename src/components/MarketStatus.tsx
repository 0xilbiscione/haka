"use client";

import { useEffect, useState } from "react";
import { PHASES } from "@/i18n/dict";
import { marketPhase, type MarketPhase } from "@/lib/idx";
import { useApp } from "./AppProvider";

export function MarketStatus() {
  const { tr } = useApp();
  const [phase, setPhase] = useState<MarketPhase | null>(null);
  useEffect(() => {
    const tick = () => setPhase(marketPhase());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  if (!phase) return <span className="h-7 w-24" />;
  const live = phase === "session1" || phase === "session2" || phase === "pre" || phase === "preclose";
  return (
    <span className="glass inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs font-medium">
      <span className={`relative size-2 rounded-full ${live ? "bg-up" : "bg-faint"}`}>
        {live && <span className="absolute inset-0 animate-ping rounded-full bg-up opacity-60" />}
      </span>
      <span className="text-muted">IDX</span>
      {tr(PHASES[phase])}
    </span>
  );
}
