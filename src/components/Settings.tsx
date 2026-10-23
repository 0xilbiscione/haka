"use client";

import { useEffect, useState } from "react";
import { useApp, type Theme } from "./AppProvider";

export function Settings() {
  const { t, lang, setLang, theme, setTheme, clearCache, universe, universeSource, dataSource } = useApp();
  const [cleared, setCleared] = useState(false);

  const seg = <T extends string>(value: T, options: [T, string][], onChange: (v: T) => void, name: string) => (
    <div className="inline-flex rounded-full bg-[var(--glass)] p-1" role="radiogroup" aria-label={name}>
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`h-10 rounded-full px-4 text-sm font-medium transition-colors ${value === v ? "bg-[var(--glass-strong)] text-text" : "text-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4 pt-2">
      <h1 className="px-1 text-2xl font-bold tracking-tight">{t("navSettings")}</h1>

      <section className="glass divide-y divide-line rounded-[26px]">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="font-medium">{t("language")}</span>
          {seg(lang, [["id", "Bahasa Indonesia"], ["en", "English"]], setLang, t("language"))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="font-medium">{t("theme")}</span>
          {seg<Theme>(theme, [["dark", t("dark")], ["light", t("light")], ["system", t("system")]], setTheme, t("theme"))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="font-medium">{t("clearCache")}</span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              clearCache();
              setCleared(true);
            }}
          >
            {cleared ? `✓ ${t("cleared")}` : t("clearCache")}
          </button>
        </div>
      </section>

      <McpCard />

      <section className="glass space-y-2 rounded-[26px] p-5 text-sm">
        <h2 className="font-semibold">{t("dataSourceTitle")}</h2>
        <p className="leading-relaxed text-muted">{t("dataSourceBody")}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 pt-2 text-xs">
          <dt className="text-faint">Prices</dt>
          <dd className="font-medium">{dataSource === "fixture" ? t("demoData") : "Yahoo Finance"}</dd>
          <dt className="text-faint">Listing</dt>
          <dd className="font-medium">
            {universeSource === "tradingview" ? "TradingView" : "Bundled"} · <span className="num">{universe.length}</span> {t("stocks")}
          </dd>
        </dl>
      </section>

      <p className="px-2 text-center text-[11px] leading-relaxed text-faint">{t("disclaimer")}</p>
    </div>
  );
}

function CopyField({ value, label }: { value: string; label: string }) {
  const { t } = useApp();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="field num flex min-w-0 flex-1 items-center overflow-x-auto font-mono text-xs whitespace-nowrap" aria-label={label}>
        {value}
      </code>
      <button
        type="button"
        className="btn btn-ghost shrink-0 px-4 text-sm"
        onClick={() => {
          navigator.clipboard
            ?.writeText(value)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => {});
        }}
      >
        {copied ? `✓ ${t("copied")}` : t("copy")}
      </button>
    </div>
  );
}

function McpCard() {
  const { t } = useApp();
  const [origin, setOrigin] = useState("https://haka-id.vercel.app");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show this deployment's own URL after mount
    setOrigin(window.location.origin);
  }, []);
  const url = `${origin}/api/mcp`;
  return (
    <section className="glass space-y-3 rounded-[26px] p-5 text-sm">
      <h2 className="font-semibold">{t("mcpTitle")}</h2>
      <p className="leading-relaxed text-muted">{t("mcpBody")}</p>
      <CopyField value={url} label="MCP URL" />
      <p className="text-xs text-muted">{t("mcpClaudeAi")}</p>
      <p className="text-xs text-muted">{t("mcpClaudeCode")}</p>
      <CopyField value={`claude mcp add --transport http haka ${url}`} label="Claude Code command" />
    </section>
  );
}
