"use client";

import { useEffect, useState } from "react";
import { FIELD_TEXT } from "@/i18n/dict";
import { fmtCompact, fmtNum } from "@/lib/idx";
import type { CompanyProfile, FundamentalField, Fundamentals } from "@/lib/types";
import { useApp } from "./AppProvider";
import { fmtField } from "./Results";

interface Payload {
  metrics: Fundamentals;
  profile: CompanyProfile;
  sources: { metrics: string; profile: string };
}

const VALUATION: FundamentalField[] = ["marketCap", "pe", "pb", "ps", "evEbitda", "divYield", "eps", "bvps", "beta"];
const PROFITABILITY: FundamentalField[] = [
  "roe", "roa", "grossMargin", "opMargin", "netMargin", "der", "currentRatio", "revenue", "netIncome", "revenueGrowth", "epsGrowth",
];

/** Colors a few metrics where the direction is unambiguous. */
function tone(f: FundamentalField, v: number | null | undefined) {
  if (v == null) return "";
  if (f === "pe" && v < 0) return "text-down";
  if ((f === "netIncome" || f === "netMargin" || f === "roe" || f === "revenueGrowth" || f === "epsGrowth") && v < 0) return "text-down";
  if ((f === "revenueGrowth" || f === "epsGrowth") && v > 0) return "text-up";
  return "";
}

export function useFundamentals(code: string) {
  const [state, setState] = useState<{ code: string; data: Payload | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/fundamentals?code=${code}`)
      .then((r) => (r.ok ? (r.json() as Promise<Payload>) : null))
      .then((data) => !cancelled && setState({ code, data }))
      .catch(() => !cancelled && setState({ code, data: null }));
    return () => {
      cancelled = true;
    };
  }, [code]);
  return { loading: !state || state.code !== code, data: state?.code === code ? state.data : null };
}

export function FundamentalsPanels({ code }: { code: string }) {
  const { t, tr, lang } = useApp();
  const { loading, data } = useFundamentals(code);
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-48 animate-pulse rounded-[24px] bg-[var(--glass)] ${i === 0 ? "sm:col-span-2" : ""}`} />
        ))}
      </div>
    );
  }

  const m = data?.metrics ?? {};
  const p = data?.profile;
  const hasMetrics = Object.values(m).some((v) => v != null);
  const desc = p?.description ?? null;
  const longDesc = desc != null && desc.length > 320;
  const freeFloat = p?.floatShares && p?.sharesOutstanding ? (p.floatShares / p.sharesOutstanding) * 100 : null;
  let site: string | null = null;
  try {
    site = p?.website ? new URL(p.website).hostname.replace(/^www\./, "") : null;
  } catch {
    site = null;
  }

  const metricList = (fields: FundamentalField[]) => (
    <dl className="grid grid-cols-2 gap-x-4 text-sm">
      {fields.map((f) => (
        <div key={f} className="flex items-baseline justify-between gap-2 border-b border-line/60 py-1.5">
          <dt className="truncate text-xs text-muted">{tr(FIELD_TEXT[f])}</dt>
          <dd className={`num font-medium ${tone(f, m[f])}`}>{fmtField(f, m[f], lang)}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="glass rounded-[24px] p-4 sm:col-span-2">
        <h2 className="mb-2 text-sm font-semibold">{t("profile")}</h2>
        {p ? (
          <div className="space-y-3 text-sm">
            {p.name && <p className="font-semibold">{p.name}</p>}
            {desc ? (
              <div>
                <p className={`leading-relaxed text-muted ${!expanded && longDesc ? "line-clamp-4" : ""}`}>{desc}</p>
                {longDesc && (
                  <button type="button" className="mt-1 text-xs font-semibold text-accent" onClick={() => setExpanded((e) => !e)}>
                    {expanded ? t("readLess") : t("readMore")}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-xs text-faint">{t("noProfile")}</p>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              <Item label={t("sector")} value={p.sector} />
              <Item label={t("industry")} value={p.industry} />
              <Item label={t("employees")} value={p.employees != null ? fmtNum(p.employees, 0) : null} />
              <Item label={t("sharesOut")} value={p.sharesOutstanding != null ? fmtCompact(p.sharesOutstanding, lang) : null} />
              <Item label={t("freeFloat")} value={freeFloat != null ? `${fmtNum(freeFloat, 1)}%` : null} />
              <Item
                label={t("website")}
                value={
                  site ? (
                    <a href={p.website!} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      {site}
                    </a>
                  ) : null
                }
              />
            </dl>
            {p.address && <Item label={t("address")} value={p.address} />}
            {p.officers.length > 0 && (
              <div>
                <h3 className="mb-1 text-[11px] text-muted">{t("management")}</h3>
                <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                  {p.officers.map((o) => (
                    <li key={`${o.name}-${o.title}`} className="text-xs">
                      <span className="font-medium">{o.name}</span>
                      {o.title && <span className="text-muted"> · {o.title}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">{t("noProfile")}</p>
        )}
      </section>

      {hasMetrics ? (
        <>
          <section className="glass rounded-[24px] p-4">
            <h2 className="mb-2 text-sm font-semibold">{t("valuation")}</h2>
            {metricList(VALUATION)}
          </section>
          <section className="glass rounded-[24px] p-4">
            <h2 className="mb-2 text-sm font-semibold">{t("profitability")}</h2>
            {metricList(PROFITABILITY)}
          </section>
        </>
      ) : (
        <p className="glass rounded-[24px] p-4 text-sm text-muted sm:col-span-2">{t("noFundamentals")}</p>
      )}
      <p className="px-1 text-[11px] text-faint sm:col-span-2">{t("fundamentalsNote")}</p>
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="truncate font-medium">{value ?? "–"}</dd>
    </div>
  );
}
