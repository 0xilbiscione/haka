"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { UI, type Lang, type UIKey } from "@/i18n/dict";
import type { Screen } from "@/lib/rules";
import type { Snapshot, Ticker } from "@/lib/types";
import bundled from "@/data/tickers.json";

export type Theme = "dark" | "light" | "system";

const CHUNK = 40;
const PARALLEL = 4;

const KEYS = {
  lang: "haka:lang",
  theme: "haka:theme",
  watch: "haka:watchlist",
  screens: "haka:screens",
  snaps: "haka:snapshots",
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    // storage full or unavailable: the app still works for this session
  }
}

export interface ScanState {
  running: boolean;
  done: number;
  total: number;
  failed: number;
}

interface Stored {
  asOf: number;
  source: string;
  data: Record<string, Snapshot>;
}

interface AppCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: UIKey) => string;
  tr: (p: { id: string; en: string }) => string;
  theme: Theme;
  setTheme: (t: Theme) => void;
  watchlist: string[];
  toggleWatch: (code: string) => void;
  screens: Screen[];
  saveScreen: (s: Screen) => void;
  deleteScreen: (id: string) => void;
  universe: Ticker[];
  tickerMap: Map<string, Ticker>;
  universeSource: string;
  dataSource: string;
  snapshots: Record<string, Snapshot>;
  asOf: number | null;
  scan: ScanState;
  startScan: (codes?: string[]) => Promise<void>;
  stopScan: () => void;
  clearCache: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");
  const [theme, setThemeState] = useState<Theme>("dark");
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [universe, setUniverse] = useState<Ticker[]>(bundled as Ticker[]);
  const [universeSource, setUniverseSource] = useState("bundled");
  const [dataSource, setDataSource] = useState("yahoo");
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [asOf, setAsOf] = useState<number | null>(null);
  const [scan, setScan] = useState<ScanState>({ running: false, done: 0, total: 0, failed: 0 });
  const abortRef = useRef<AbortController | null>(null);
  const snapsRef = useRef(snapshots);
  useEffect(() => {
    snapsRef.current = snapshots;
  }, [snapshots]);

  // Hydrate persisted preferences after mount (server render uses defaults).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from localStorage */
    setLangState(load<Lang>(KEYS.lang, "id"));
    setThemeState(load<Theme>(KEYS.theme, "dark"));
    setWatchlist(load<string[]>(KEYS.watch, []));
    setScreens(load<Screen[]>(KEYS.screens, []));
    const stored = load<Stored | null>(KEYS.snaps, null);
    if (stored) {
      setSnapshots(stored.data);
      setAsOf(stored.asOf);
      setDataSource(stored.source);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/universe")
      .then((r) => r.json())
      .then((j: { tickers: Ticker[]; source: string; dataSource: string }) => {
        if (cancelled || !j.tickers?.length) return;
        setUniverse(j.tickers);
        setUniverseSource(j.source);
        setDataSource(j.dataSource);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    save(KEYS.lang, JSON.stringify(l));
  }, []);

  const setTheme = useCallback((th: Theme) => {
    setThemeState(th);
    save(KEYS.theme, JSON.stringify(th));
    if (th === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", th);
  }, []);

  const toggleWatch = useCallback((code: string) => {
    setWatchlist((w) => {
      const next = w.includes(code) ? w.filter((c) => c !== code) : [...w, code];
      save(KEYS.watch, next);
      return next;
    });
  }, []);

  const saveScreen = useCallback((s: Screen) => {
    setScreens((all) => {
      const next = all.some((x) => x.id === s.id) ? all.map((x) => (x.id === s.id ? s : x)) : [...all, s];
      save(KEYS.screens, next);
      return next;
    });
  }, []);

  const deleteScreen = useCallback((id: string) => {
    setScreens((all) => {
      const next = all.filter((x) => x.id !== id);
      save(KEYS.screens, next);
      return next;
    });
  }, []);

  const stopScan = useCallback(() => abortRef.current?.abort(), []);

  const startScan = useCallback(
    async (codes?: string[]) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const list = codes ?? universe.map((u) => u.code);
      const chunks: string[][] = [];
      for (let i = 0; i < list.length; i += CHUNK) chunks.push(list.slice(i, i + CHUNK));
      setScan({ running: true, done: 0, total: list.length, failed: 0 });

      // A full scan replaces the cache; a partial one (watchlist) merges into it.
      const acc: Record<string, Snapshot> = codes ? { ...snapsRef.current } : {};
      let source = dataSource;
      let next = 0;
      const worker = async () => {
        while (next < chunks.length && !ac.signal.aborted) {
          const chunk = chunks[next++];
          let failed = chunk.length;
          try {
            const res = await fetch(`/api/scan?symbols=${chunk.join(",")}`, { signal: ac.signal });
            if (res.ok) {
              const j = (await res.json()) as { snapshots: Snapshot[]; failed: string[]; source: string };
              source = j.source;
              for (const s of j.snapshots) acc[s.code] = s;
              failed = j.failed.length;
              setSnapshots({ ...acc });
            }
          } catch {
            if (ac.signal.aborted) return;
          }
          setScan((st) => ({ ...st, done: st.done + chunk.length, failed: st.failed + failed }));
        }
      };
      await Promise.all(Array.from({ length: PARALLEL }, worker));

      const now = Date.now();
      setSnapshots({ ...acc });
      setAsOf(now);
      setDataSource(source);
      setScan((st) => ({ ...st, running: false }));
      save(KEYS.snaps, { asOf: now, source, data: acc } satisfies Stored);
    },
    [universe, dataSource],
  );

  const clearCache = useCallback(() => {
    try {
      localStorage.removeItem(KEYS.snaps);
    } catch {}
    setSnapshots({});
    setAsOf(null);
  }, []);

  const value = useMemo<AppCtx>(
    () => ({
      lang,
      setLang,
      t: (k) => UI[k][lang],
      tr: (p) => p[lang],
      theme,
      setTheme,
      watchlist,
      toggleWatch,
      screens,
      saveScreen,
      deleteScreen,
      universe,
      tickerMap: new Map(universe.map((u) => [u.code, u])),
      universeSource,
      dataSource,
      snapshots,
      asOf,
      scan,
      startScan,
      stopScan,
      clearCache,
    }),
    [lang, setLang, theme, setTheme, watchlist, toggleWatch, screens, saveScreen, deleteScreen, universe, universeSource, dataSource, snapshots, asOf, scan, startScan, stopScan, clearCache],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
