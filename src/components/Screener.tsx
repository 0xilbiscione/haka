"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { FIELD_TEXT, GROUPS } from "@/i18n/dict";
import { evalScreen } from "@/lib/rules";
import { PRESET_GROUPS } from "@/lib/presets";
import type { NumField, Snapshot } from "@/lib/types";
import { useApp } from "./AppProvider";
import { IconFilter, IconSearch } from "./Icons";
import { ResultsList, type SortKey, type SortState } from "./Results";
import { ScanPanel } from "./ScanPanel";
import { describeScreen, useAllScreens, type AnyScreen } from "./screens";

const VALUE_STEPS = [0, 1e8, 1e9, 5e9, 1e10, 5e10];
const SORT_FIELDS: SortKey[] = ["changePct", "valueMa20", "volRatio", "rsi", "adx", "ret1w", "ret1m", "ret3m", "fromHigh52Pct", "atrPct", "code"];

export function Screener() {
  const { snapshots, tickerMap, t, tr, lang, scan } = useApp();
  const { all, byId, label, desc } = useAllScreens();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const screenId = params.get("s") ?? "";
  const screen = byId.get(screenId) ?? null;
  const [group, setGroup] = useState<string>(() => (screen?.group as string) ?? "trend");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sector, setSector] = useState("");
  const [minPrice, setMinPrice] = useState(0);
  const [minValue, setMinValue] = useState(0);
  const [userSort, setUserSort] = useState<SortState | null>(null);

  const selectScreen = (id: string) => {
    const next = new URLSearchParams(params);
    if (id && id !== screenId) next.set("s", id);
    else next.delete("s");
    setUserSort(null);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const snaps = useMemo(() => Object.values(snapshots), [snapshots]);

  // Universe after the liquidity / sector / price filters, before the screen.
  const base = useMemo(
    () =>
      snaps.filter(
        (s) =>
          (s.v.close ?? 0) >= minPrice &&
          (s.v.valueMa20 ?? 0) >= minValue &&
          (!sector || tickerMap.get(s.code)?.sector === sector),
      ),
    [snaps, minPrice, minValue, sector, tickerMap],
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const sc of all) m.set(sc.id, base.reduce((n, s) => n + (evalScreen(s, sc) ? 1 : 0), 0));
    return m;
  }, [all, base]);

  const sort = useMemo<SortState>(
    () => userSort ?? (screen && "sort" in screen && screen.sort ? (screen.sort as SortState) : { field: "valueMa20", dir: "desc" }),
    [userSort, screen],
  );

  const rows = useMemo(() => {
    const q = query.trim().toUpperCase();
    const list = base.filter(
      (s) =>
        (!screen || evalScreen(s, screen)) &&
        (!q || s.code.includes(q) || (tickerMap.get(s.code)?.name.toUpperCase().includes(q) ?? false)),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    const key = (s: Snapshot) => (sort.field === "code" ? s.code : s.v[sort.field as NumField]);
    return list.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (ka == null) return 1;
      if (kb == null) return -1;
      return ka < kb ? -dir : ka > kb ? dir : 0;
    });
  }, [base, screen, query, sort, tickerMap]);

  const sectors = useMemo(() => {
    const set = new Set<string>();
    for (const s of snaps) {
      const sec = tickerMap.get(s.code)?.sector;
      if (sec) set.add(sec);
    }
    return [...set].sort();
  }, [snaps, tickerMap]);

  const hasData = snaps.length > 0;
  const groupScreens = all.filter((s) => s.group === group);
  const activeFilters = (sector ? 1 : 0) + (minPrice ? 1 : 0) + (minValue ? 1 : 0);
  const valueLabel = (v: number) => (v === 0 ? t("minValueAny") : `≥ Rp ${new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-US", { notation: "compact" }).format(v)}`);

  return (
    <div className="space-y-4 pt-2">
      <ScanPanel />

      {(hasData || scan.running) && (
        <>
          {/* Screen picker */}
          <section aria-label="Screens" className="space-y-2.5">
            <div className="no-scrollbar rail-fade -mx-4 flex gap-1.5 overflow-x-auto px-4" role="tablist">
              {[...PRESET_GROUPS, "custom"].map((g) => (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  aria-selected={group === g}
                  onClick={() => setGroup(g)}
                  className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${group === g ? "bg-[var(--glass-strong)] text-text" : "text-muted hover:text-text"}`}
                >
                  {tr(GROUPS[g])}
                </button>
              ))}
            </div>
            <div className="no-scrollbar rail-fade -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              <ScreenChip active={!screen} onClick={() => selectScreen("")} label={t("allStocks")} count={base.length} />
              {groupScreens.map((sc) => (
                <ScreenChip key={sc.id} active={screen?.id === sc.id} onClick={() => selectScreen(sc.id)} label={label(sc)} count={counts.get(sc.id) ?? 0} />
              ))}
              {group === "custom" && groupScreens.length === 0 && <span className="self-center text-sm text-muted">{t("noScreens")}</span>}
            </div>
            {screen && <ScreenDescription screen={screen} label={label(screen)} desc={desc(screen)} />}
          </section>

          {/* Search + filters */}
          <section className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 basis-56">
              <span className="sr-only">{t("search")}</span>
              <IconSearch size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} className="field pl-10" type="search" autoComplete="off" />
            </label>
            <button type="button" className="chip min-h-11" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen} aria-pressed={activeFilters > 0}>
              <IconFilter size={16} />
              {t("filters")}
              {activeFilters > 0 && <span className="num">({activeFilters})</span>}
            </button>
            <label className="flex items-center gap-2">
              <span className="sr-only">{t("sortBy")}</span>
              <select
                className="field min-h-11 w-auto rounded-full text-sm"
                value={`${sort.field}:${sort.dir}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split(":");
                  setUserSort({ field: field as SortKey, dir: dir as "asc" | "desc" });
                }}
              >
                {SORT_FIELDS.flatMap((f) =>
                  (["desc", "asc"] as const).map((d) => (
                    <option key={`${f}:${d}`} value={`${f}:${d}`}>
                      {f === "code" ? t("code") : tr(FIELD_TEXT[f as NumField])} {d === "desc" ? "↓" : "↑"}
                    </option>
                  )),
                )}
              </select>
            </label>
          </section>

          {filtersOpen && (
            <section className="glass rise grid gap-4 rounded-[22px] p-4 sm:grid-cols-3">
              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-medium text-muted">{t("sector")}</span>
                <select className="field" value={sector} onChange={(e) => setSector(e.target.value)}>
                  <option value="">{t("allSectors")}</option>
                  {sectors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-medium text-muted">{t("minPrice")}</span>
                <input className="field num" type="number" inputMode="numeric" min={0} step={50} value={minPrice || ""} placeholder="0" onChange={(e) => setMinPrice(Number(e.target.value) || 0)} />
              </label>
              <div className="text-sm">
                <span className="mb-1.5 block text-xs font-medium text-muted">{t("minValue")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {VALUE_STEPS.map((v) => (
                    <button key={v} type="button" className="chip min-h-9 px-3 text-xs" aria-pressed={minValue === v} onClick={() => setMinValue(v)}>
                      {valueLabel(v)}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          <div className="flex items-baseline justify-between px-1 text-sm text-muted">
            <span>
              <span className="num font-semibold text-text">{rows.length}</span> {t("results")}
            </span>
          </div>

          {rows.length ? (
            <ResultsList rows={rows} sort={sort} onSort={setUserSort} />
          ) : (
            hasData && <p className="glass rounded-[22px] p-8 text-center text-sm text-muted">{t("noResults")}</p>
          )}
        </>
      )}

      <p className="px-2 pt-4 text-center text-[11px] leading-relaxed text-faint">{t("disclaimer")}</p>
    </div>
  );
}

function ScreenChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button type="button" className="chip shrink-0" aria-pressed={active} onClick={onClick}>
      {label}
      <span className={`num rounded-full px-1.5 text-[11px] ${active ? "bg-black/15" : "bg-[var(--glass-strong)] text-muted"}`}>{count}</span>
    </button>
  );
}

function ScreenDescription({ screen, label, desc }: { screen: AnyScreen; label: string; desc: string }) {
  const { tr, lang } = useApp();
  const text = desc || describeScreen(screen, tr, lang);
  return (
    <p className="flex items-center gap-2 px-1 text-xs text-muted">
      <span className="font-semibold text-text">{label}</span>
      <span aria-hidden="true">—</span>
      <span className="truncate">{text}</span>
    </p>
  );
}
