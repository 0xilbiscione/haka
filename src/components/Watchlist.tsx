"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "./AppProvider";
import { IconRefresh, IconStar } from "./Icons";
import { ResultsList, type SortState } from "./Results";
import { ScanProgress } from "./ScanPanel";

export function Watchlist() {
  const { watchlist, snapshots, t, startScan, scan } = useApp();
  const [sort, setSort] = useState<SortState>({ field: "changePct", dir: "desc" });
  const missing = watchlist.filter((c) => !snapshots[c]);
  const fetched = useRef(false);

  // Fetch snapshots for watched codes that have no data yet (e.g. before the first full scan).
  useEffect(() => {
    if (fetched.current || scan.running || missing.length === 0) return;
    fetched.current = true;
    void startScan(missing);
  }, [missing, scan.running, startScan]);

  const rows = useMemo(() => {
    const list = watchlist.map((c) => snapshots[c]).filter((s) => s != null);
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const ka = sort.field === "code" ? a.code : a.v[sort.field];
      const kb = sort.field === "code" ? b.code : b.v[sort.field];
      if (ka == null) return 1;
      if (kb == null) return -1;
      return ka < kb ? -dir : ka > kb ? dir : 0;
    });
  }, [watchlist, snapshots, sort]);

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("navWatchlist")}</h1>
        {watchlist.length > 0 && !scan.running && (
          <button type="button" className="btn btn-ghost" onClick={() => startScan(watchlist)}>
            <IconRefresh size={16} />
            {t("refresh")}
          </button>
        )}
      </div>
      {scan.running && (
        <div className="glass rounded-[22px] p-4">
          <ScanProgress />
        </div>
      )}
      {watchlist.length === 0 ? (
        <div className="glass rise flex flex-col items-center gap-3 rounded-[28px] p-10 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-warn/15 text-warn">
            <IconStar size={26} />
          </span>
          <p className="max-w-xs text-sm text-muted">{t("watchlistEmpty")}</p>
        </div>
      ) : (
        <ResultsList rows={rows} sort={sort} onSort={setSort} />
      )}
    </div>
  );
}
