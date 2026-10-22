"use client";

import { useMemo } from "react";
import { FIELD_TEXT, FLAG_TEXT, PRESET_TEXT, type Lang } from "@/i18n/dict";
import { PRESETS, type Preset } from "@/lib/presets";
import type { Condition, Screen } from "@/lib/rules";
import { useApp } from "./AppProvider";

export type AnyScreen = (Preset | Screen) & { group?: string };

export function useAllScreens() {
  const { screens, tr } = useApp();
  return useMemo(() => {
    const all: AnyScreen[] = [...PRESETS, ...screens.map((s) => ({ ...s, group: "custom" }))];
    const label = (s: AnyScreen) => (s.builtin ? tr(PRESET_TEXT[s.id]?.name ?? { id: s.id, en: s.id }) : s.name);
    const desc = (s: AnyScreen) => (s.builtin ? tr(PRESET_TEXT[s.id]?.desc ?? { id: "", en: "" }) : "");
    return { all, byId: new Map(all.map((s) => [s.id, s])), label, desc };
  }, [screens, tr]);
}

const OP_TEXT: Record<string, { id: string; en: string }> = {
  ">": { id: ">", en: ">" },
  ">=": { id: "≥", en: "≥" },
  "<": { id: "<", en: "<" },
  "<=": { id: "≤", en: "≤" },
  crossAbove: { id: "memotong ke atas", en: "crosses above" },
  crossBelow: { id: "memotong ke bawah", en: "crosses below" },
};

export function opText(op: string, tr: (p: { id: string; en: string }) => string) {
  return tr(OP_TEXT[op] ?? { id: op, en: op });
}

export function describeCondition(c: Condition, tr: (p: { id: string; en: string }) => string, lang: Lang) {
  if (c.kind === "flag") return `${c.negate ? (lang === "id" ? "bukan " : "not ") : ""}${tr(FLAG_TEXT[c.flag])}`;
  const right = "value" in c.right ? new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-US").format(c.right.value) : tr(FIELD_TEXT[c.right.field]);
  return `${tr(FIELD_TEXT[c.left])} ${opText(c.op, tr)} ${right}`;
}

export function describeScreen(s: Screen, tr: (p: { id: string; en: string }) => string, lang: Lang) {
  const joiner = s.logic === "AND" ? (lang === "id" ? " dan " : " and ") : lang === "id" ? " atau " : " or ";
  return s.conditions.map((c) => describeCondition(c, tr, lang)).join(joiner);
}
