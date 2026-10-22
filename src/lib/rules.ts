import type { Flag, NumField, Snapshot } from "./types";

export type CompareOp = ">" | ">=" | "<" | "<=" | "crossAbove" | "crossBelow";

export type Condition =
  | { kind: "compare"; left: NumField; op: CompareOp; right: { field: NumField } | { value: number } }
  | { kind: "flag"; flag: Flag; negate?: boolean };

export interface Screen {
  id: string;
  name: string;
  logic: "AND" | "OR";
  conditions: Condition[];
  /** Built-in screens are translated by id; custom ones use `name` as is. */
  builtin?: boolean;
}

function rightValue(snap: Snapshot, c: Extract<Condition, { kind: "compare" }>, prev: boolean) {
  if ("value" in c.right) return c.right.value;
  const src = prev ? snap.p : snap.v;
  return src[c.right.field] ?? null;
}

export function evalCondition(snap: Snapshot, c: Condition): boolean {
  if (c.kind === "flag") {
    const has = snap.flags.includes(c.flag);
    return c.negate ? !has : has;
  }
  const a = snap.v[c.left];
  const b = rightValue(snap, c, false);
  if (a == null || b == null) return false;
  switch (c.op) {
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case "crossAbove":
    case "crossBelow": {
      const pa = snap.p[c.left];
      const pb = rightValue(snap, c, true);
      if (pa == null || pb == null) return false;
      return c.op === "crossAbove" ? pa <= pb && a > b : pa >= pb && a < b;
    }
  }
}

export function evalScreen(snap: Snapshot, screen: Screen): boolean {
  if (screen.conditions.length === 0) return true;
  return screen.logic === "AND"
    ? screen.conditions.every((c) => evalCondition(snap, c))
    : screen.conditions.some((c) => evalCondition(snap, c));
}
