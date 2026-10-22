"use client";

import { useApp } from "./AppProvider";
import { IconStar } from "./Icons";

export function WatchButton({ code, size = 20 }: { code: string; size?: number }) {
  const { watchlist, toggleWatch, t } = useApp();
  const on = watchlist.includes(code);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleWatch(code);
      }}
      aria-pressed={on}
      aria-label={`${on ? t("removeWatch") : t("addWatch")} ${code}`}
      title={on ? t("removeWatch") : t("addWatch")}
      className={`grid size-11 shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--glass-hover)] ${on ? "text-warn" : "text-faint"}`}
    >
      <IconStar size={size} filled={on} />
    </button>
  );
}
