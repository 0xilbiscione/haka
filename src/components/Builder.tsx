"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FIELD_TEXT, FLAG_TEXT, GROUPS } from "@/i18n/dict";
import { evalScreen, type CompareOp, type Condition, type Screen } from "@/lib/rules";
import { FLAGS, FUNDAMENTAL_FIELDS, TECH_FIELDS, type Flag, type NumField } from "@/lib/types";
import { useApp } from "./AppProvider";
import { IconPlay, IconPlus, IconTrash } from "./Icons";
import { describeScreen, opText } from "./screens";

const OPS: CompareOp[] = [">", ">=", "<", "<=", "crossAbove", "crossBelow"];

const blank = (): Screen => ({ id: `c${Date.now().toString(36)}`, name: "", logic: "AND", conditions: [] });

export function Builder() {
  const { t, tr, lang, screens, saveScreen, deleteScreen, snapshots } = useApp();
  const router = useRouter();
  const [draft, setDraft] = useState<Screen>(blank);

  const snaps = useMemo(() => Object.values(snapshots), [snapshots]);
  const matches = useMemo(() => (draft.conditions.length ? snaps.filter((s) => evalScreen(s, draft)).length : null), [snaps, draft]);

  const update = (i: number, c: Condition) => setDraft((d) => ({ ...d, conditions: d.conditions.map((x, j) => (j === i ? c : x)) }));
  const remove = (i: number) => setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, j) => j !== i) }));
  const add = (c: Condition) => setDraft((d) => ({ ...d, conditions: [...d.conditions, c] }));

  const canSave = draft.conditions.length > 0;
  const commit = (run: boolean) => {
    const s = { ...draft, name: draft.name.trim() || describeScreen(draft, tr, lang).slice(0, 40) };
    saveScreen(s);
    if (run) router.push(`/?s=${s.id}`);
    else setDraft(blank());
  };

  return (
    <div className="space-y-5 pt-2">
      <header className="px-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("builderTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("builderHint")}</p>
      </header>

      <section className="glass space-y-4 rounded-[26px] p-4 sm:p-5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">{t("screenName")}</span>
          <input className="field" value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Swing breakout" />
        </label>

        <div className="inline-flex rounded-full bg-[var(--glass)] p-1" role="radiogroup">
          {(["AND", "OR"] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={draft.logic === l}
              onClick={() => setDraft({ ...draft, logic: l })}
              className={`h-9 rounded-full px-4 text-sm font-medium transition-colors ${draft.logic === l ? "bg-[var(--glass-strong)] text-text" : "text-muted"}`}
            >
              {l === "AND" ? t("matchAll") : t("matchAny")}
            </button>
          ))}
        </div>

        <ol className="space-y-2">
          {draft.conditions.map((c, i) => (
            <li key={i} className="rise flex items-start gap-2 rounded-2xl bg-[var(--glass)] p-2.5">
              <span className="num mt-2.5 w-5 shrink-0 text-center text-xs text-faint">{i + 1}</span>
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_auto_1fr]">
                {c.kind === "compare" ? (
                  <>
                    <FieldSelect value={c.left} onChange={(f) => update(i, { ...c, left: f })} />
                    <select className="field sm:w-44" value={c.op} onChange={(e) => update(i, { ...c, op: e.target.value as CompareOp })}>
                      {OPS.map((o) => (
                        <option key={o} value={o}>
                          {opText(o, tr)}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <select
                        className="field w-28 shrink-0"
                        aria-label="Compare with"
                        value={"value" in c.right ? "value" : "field"}
                        onChange={(e) => update(i, { ...c, right: e.target.value === "value" ? { value: 0 } : { field: "sma20" } })}
                      >
                        <option value="value">{t("value_")}</option>
                        <option value="field">{t("indicator")}</option>
                      </select>
                      {"value" in c.right ? (
                        <input
                          className="field num min-w-0"
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={Number.isFinite(c.right.value) ? c.right.value : ""}
                          onChange={(e) => update(i, { ...c, right: { value: e.target.value === "" ? 0 : Number(e.target.value) } })}
                        />
                      ) : (
                        <FieldSelect value={c.right.field} onChange={(f) => update(i, { ...c, right: { field: f } })} />
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <select className="field sm:col-span-2" value={c.flag} onChange={(e) => update(i, { ...c, flag: e.target.value as Flag })}>
                      {FLAGS.map((f) => (
                        <option key={f} value={f}>
                          {tr(FLAG_TEXT[f])}
                        </option>
                      ))}
                    </select>
                    <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
                      <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={!!c.negate} onChange={(e) => update(i, { ...c, negate: e.target.checked })} />
                      {t("not")}
                    </label>
                  </>
                )}
              </div>
              <button type="button" className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-[var(--glass-hover)] hover:text-down" onClick={() => remove(i)} aria-label={t("delete")}>
                <IconTrash size={18} />
              </button>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="chip" onClick={() => add({ kind: "compare", left: "rsi", op: "<", right: { value: 30 } })}>
            <IconPlus size={16} />
            {t("addCondition")}
          </button>
          <button type="button" className="chip" onClick={() => add({ kind: "flag", flag: "volSpike" })}>
            <IconPlus size={16} />
            {t("addSignal")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <span className="mr-auto text-sm text-muted">
            {t("livePreview")}:{" "}
            <span className="num font-semibold text-text">{matches == null ? "–" : snaps.length ? matches : "?"}</span>
            {snaps.length > 0 && <span className="num text-faint"> / {snaps.length}</span>}
          </span>
          <button type="button" className="btn btn-ghost" disabled={!canSave} onClick={() => commit(false)}>
            {t("save")}
          </button>
          <button type="button" className="btn btn-primary" disabled={!canSave} onClick={() => commit(true)}>
            <IconPlay size={14} />
            {t("saveAndRun")}
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-muted">{t("myScreens")}</h2>
        {screens.length === 0 && <p className="glass rounded-[20px] p-5 text-sm text-muted">{t("noScreens")}</p>}
        <ul className="space-y-2">
          {screens.map((s) => (
            <li key={s.id} className="glass flex items-center gap-2 rounded-[20px] py-2 pr-2 pl-4">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{s.name}</div>
                <div className="truncate text-xs text-muted">{describeScreen(s, tr, lang)}</div>
              </div>
              <button type="button" className="btn btn-ghost min-h-10 px-3 text-sm" onClick={() => setDraft(s)}>
                {t("edit")}
              </button>
              <button type="button" className="btn btn-primary min-h-10 px-3 text-sm" onClick={() => router.push(`/?s=${s.id}`)}>
                {t("run")}
              </button>
              <button type="button" className="grid size-10 place-items-center rounded-full text-muted hover:text-down" onClick={() => deleteScreen(s.id)} aria-label={`${t("delete")} ${s.name}`}>
                <IconTrash size={17} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FieldSelect({ value, onChange }: { value: NumField; onChange: (f: NumField) => void }) {
  const { tr } = useApp();
  return (
    <select className="field min-w-0" value={value} onChange={(e) => onChange(e.target.value as NumField)}>
      {(
        [
          [{ id: "Teknikal", en: "Technical" }, TECH_FIELDS],
          [GROUPS.fundamental, FUNDAMENTAL_FIELDS],
        ] as const
      ).map(([label, fields]) => (
        <optgroup key={label.en} label={tr(label)}>
          {fields.map((f) => (
            <option key={f} value={f}>
              {tr(FIELD_TEXT[f])}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
