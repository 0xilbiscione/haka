"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UIKey } from "@/i18n/dict";
import { useApp } from "./AppProvider";
import { IconGear, IconRadar, IconSliders, IconStar } from "./Icons";
import { Logo } from "./Logo";
import { MarketStatus } from "./MarketStatus";

const TABS: { href: string; label: UIKey; Icon: typeof IconRadar }[] = [
  { href: "/", label: "navScreener", Icon: IconRadar },
  { href: "/watchlist", label: "navWatchlist", Icon: IconStar },
  { href: "/builder", label: "navBuilder", Icon: IconSliders },
  { href: "/settings", label: "navSettings", Icon: IconGear },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" || path.startsWith("/stock") : path.startsWith(href);
}

export function TopBar() {
  const { t, lang, setLang, watchlist } = useApp();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
      <div className="glass mx-auto flex h-14 max-w-6xl items-center gap-3 rounded-[22px] pl-2.5 pr-2">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Haka">
          <Logo size={34} />
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight">Haka</span>
            <span className="hidden text-[11px] text-muted sm:block">{t("appTagline")}</span>
          </span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
          {TABS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(path, href) ? "page" : undefined}
              className="flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-muted transition-colors hover:text-text aria-[current=page]:bg-[var(--glass-strong)] aria-[current=page]:text-text"
            >
              <Icon size={17} />
              {t(label)}
              {href === "/watchlist" && watchlist.length > 0 && <span className="num text-xs text-faint">{watchlist.length}</span>}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <MarketStatus />
          <button
            type="button"
            onClick={() => setLang(lang === "id" ? "en" : "id")}
            className="grid h-9 min-w-11 place-items-center rounded-full px-2 text-xs font-bold tracking-wide text-muted transition-colors hover:bg-[var(--glass-hover)] hover:text-text"
            aria-label={`${t("language")}: ${lang === "id" ? "English" : "Bahasa Indonesia"}`}
          >
            {lang === "id" ? "EN" : "ID"}
          </button>
        </div>
      </div>
    </header>
  );
}

export function BottomBar() {
  const { t, watchlist } = useApp();
  const path = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 px-3 md:hidden" aria-label="Main">
      <div className="glass-bar mx-auto grid max-w-md grid-cols-4 rounded-[26px] p-1.5">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(path, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-[20px] text-[11px] font-medium transition-colors ${active ? "bg-[var(--glass-strong)] text-text" : "text-muted"}`}
            >
              <span className={active ? "text-accent" : undefined}>
                <Icon size={22} />
              </span>
              {t(label)}
              {href === "/watchlist" && watchlist.length > 0 && (
                <span className="num absolute top-1.5 right-[calc(50%-20px)] grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
                  {watchlist.length}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
