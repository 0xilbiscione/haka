"use client";

import { useApp } from "./AppProvider";
import { IconPlay, IconRefresh, IconStop } from "./Icons";

export function ScanProgress() {
  const { scan, t, stopScan } = useApp();
  const pct = scan.total ? Math.round((scan.done / scan.total) * 100) : 0;
  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex justify-between text-xs text-muted">
          <span>
            {t("scanning")} <span className="num">{scan.done}/{scan.total}</span> {t("stocks")}
          </span>
          <span className="num">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--glass-strong)]">
          <div
            className="progress-shine relative h-full overflow-hidden rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-300"
            style={{ width: `${Math.max(pct, 3)}%` }}
          />
        </div>
      </div>
      <button type="button" className="btn btn-ghost px-4" onClick={stopScan}>
        <IconStop size={14} />
        {t("stop")}
      </button>
    </div>
  );
}

export function ScanPanel() {
  const { scan, t, lang, startScan, asOf, snapshots, dataSource, universeSource, universe } = useApp();
  const count = Object.keys(snapshots).length;

  if (scan.running) {
    return (
      <section className="glass rounded-[24px] p-4">
        <ScanProgress />
      </section>
    );
  }

  if (!count) {
    return (
      <section className="glass rise relative overflow-hidden rounded-[28px] p-6 text-center sm:p-10">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {lang === "id" ? "Temukan setup teknikal di seluruh BEI" : "Find technical setups across the whole IDX"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("neverScanned")}</p>
        <button type="button" className="btn btn-primary mt-6 px-7 text-base" onClick={() => startScan()}>
          <IconPlay size={16} />
          {t("scan")} · <span className="num">{universe.length}</span>
        </button>
        {dataSource === "fixture" && <p className="mt-3 text-xs text-warn">{t("demoHint")}</p>}
      </section>
    );
  }

  const time = asOf
    ? new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(asOf)
    : "–";

  return (
    <section className="glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[22px] px-4 py-3">
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">
            <span className="num">{count}</span> {t("stocks")}
          </span>
          {dataSource === "fixture" && (
            <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold tracking-wider text-warn" title={t("demoHint")}>
              {t("demoData")}
            </span>
          )}
          {scan.failed > 0 && (
            <span className="text-xs text-muted">
              · <span className="num">{scan.failed}</span> {t("failed")}
            </span>
          )}
        </div>
        <div className="text-xs text-muted">
          {t("lastScan")}: {time}
          {universeSource === "bundled" && dataSource !== "fixture" && <span className="block text-warn">{t("bundledUniverse")}</span>}
        </div>
      </div>
      <button type="button" className="btn btn-ghost" onClick={() => startScan()}>
        <IconRefresh size={16} />
        {t("rescan")}
      </button>
    </section>
  );
}
