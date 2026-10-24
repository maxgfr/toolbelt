/** Cron expressions: plain-language description (cronstrue) and next run times (croner). */
import { Cron } from "croner";
import cronstrue from "cronstrue";
import "cronstrue/locales/fr";

/** The usual shortcuts, as 5-field expressions. */
export const MACROS: Record<string, string> = {
  "@yearly": "0 0 1 1 *",
  "@annually": "0 0 1 1 *",
  "@monthly": "0 0 1 * *",
  "@weekly": "0 0 * * 0",
  "@daily": "0 0 * * *",
  "@midnight": "0 0 * * *",
  "@hourly": "0 * * * *",
};

export const PRESETS = [
  { id: "min", expr: "* * * * *" },
  { id: "5min", expr: "*/5 * * * *" },
  { id: "15min", expr: "*/15 * * * *" },
  { id: "hourly", expr: "0 * * * *" },
  { id: "midnight", expr: "0 0 * * *" },
  { id: "weekdays9", expr: "0 9 * * 1-5" },
  { id: "monday", expr: "0 9 * * 1" },
  { id: "monthly", expr: "0 0 1 * *" },
  { id: "yearly", expr: "0 0 1 1 *" },
  { id: "30s", expr: "*/30 * * * * *" },
] as const;

export type FieldName = "second" | "minute" | "hour" | "dom" | "month" | "dow";

export type Parsed =
  | { ok: true; expr: string; fields: { name: FieldName; value: string }[] }
  | { ok: false; error: "empty" | "count"; count?: number }
  | { ok: false; error: "syntax"; detail: string };

/** Splits and checks an expression (macros expanded); 5 fields, or 6 with seconds first. */
export function parseCron(input: string): Parsed {
  const raw = input.trim().replace(/\s+/g, " ");
  if (!raw) return { ok: false, error: "empty" };
  const expr = MACROS[raw.toLowerCase()] ?? raw;
  const parts = expr.split(" ");
  if (parts.length !== 5 && parts.length !== 6)
    return { ok: false, error: "count", count: parts.length };
  const names: FieldName[] =
    parts.length === 6
      ? ["second", "minute", "hour", "dom", "month", "dow"]
      : ["minute", "hour", "dom", "month", "dow"];
  try {
    new Cron(expr, { paused: true, mode: "5-or-6-parts" });
  } catch (err) {
    return { ok: false, error: "syntax", detail: cleanError(err) };
  }
  return {
    ok: true,
    expr,
    fields: parts.map((value, i) => ({ name: names[i] as FieldName, value })),
  };
}

function cleanError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/^CronPattern:\s*/i, "");
}

/** "At 09:00, Monday through Friday" / "À 09:00, de lundi à vendredi". */
export function describeCron(expr: string, lang: "en" | "fr"): string | null {
  try {
    return cronstrue.toString(expr, {
      locale: lang,
      use24HourTimeFormat: lang === "fr",
      throwExceptionOnParseError: true,
      verbose: false,
    });
  } catch {
    return null;
  }
}

/** The next `n` run times after `from`, in `zone` (an IANA name). */
export function nextRuns(expr: string, n: number, from: Date, zone: string): Date[] {
  try {
    return new Cron(expr, { paused: true, timezone: zone, mode: "5-or-6-parts" }).nextRuns(n, from);
  } catch {
    return [];
  }
}

/* --- Builder ----------------------------------------------------------------- */

/** The five classic fields the builder edits. */
export type BuilderField = "minute" | "hour" | "dom" | "month" | "dow";
export const BUILDER_FIELDS: BuilderField[] = ["minute", "hour", "dom", "month", "dow"];

/** Allowed values of each field (day of week: 0 = Sunday … 6 = Saturday). */
export const LIMITS: Record<BuilderField, { min: number; max: number }> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dom: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  dow: { min: 0, max: 6 },
};

export type BuildMode = "every" | "step" | "specific" | "range";

/**
 * One field of the builder: every value (`*`), every N starting at `start` (`*∕N` or
 * `S-max/N`), a list of specific values (`1,15`), or a range (`9-17`, or `9-17/2` with a step).
 */
export type FieldSpec = {
  mode: BuildMode;
  step: number;
  start: number;
  values: number[];
  from: number;
  to: number;
};

export type BuilderSpec = Record<BuilderField, FieldSpec>;

/** "Every value" for a field, with sensible numbers for the other modes. */
export function everySpec(f: BuilderField): FieldSpec {
  const { min, max } = LIMITS[f];
  return { mode: "every", step: 1, start: min, values: [min], from: min, to: max };
}

/** 09:00, Monday to Friday. */
export function defaultBuilder(): BuilderSpec {
  return {
    minute: { ...everySpec("minute"), mode: "specific", values: [0], step: 5 },
    hour: { ...everySpec("hour"), mode: "specific", values: [9], step: 2 },
    dom: everySpec("dom"),
    month: everySpec("month"),
    dow: { ...everySpec("dow"), mode: "range", from: 1, to: 5 },
  };
}

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** The text of one field. Out-of-range numbers are clamped, so the result is always valid. */
export function fieldToCron(f: BuilderField, spec: FieldSpec): string {
  const { min, max } = LIMITS[f];
  const span = max - min + 1;
  switch (spec.mode) {
    case "step": {
      const step = clampInt(spec.step, 1, span);
      const start = clampInt(spec.start, min, max);
      return start === min ? `*/${step}` : `${start}-${max}/${step}`;
    }
    case "specific": {
      const vals = [...new Set((spec.values ?? []).map((v) => clampInt(v, min, max)))].sort(
        (a, b) => a - b,
      );
      return vals.length ? vals.join(",") : "*";
    }
    case "range": {
      let from = clampInt(spec.from, min, max);
      let to = clampInt(spec.to, min, max);
      if (from > to) [from, to] = [to, from];
      const step = clampInt(spec.step, 1, span);
      return step > 1 ? `${from}-${to}/${step}` : `${from}-${to}`;
    }
    default:
      return "*";
  }
}

/** The 5-field expression of a builder state. */
export function buildCron(spec: BuilderSpec): string {
  return BUILDER_FIELDS.map((f) => fieldToCron(f, spec[f] ?? everySpec(f))).join(" ");
}

const NAMES: Partial<Record<BuilderField, string[]>> = {
  month: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"],
  dow: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
};

function fieldNumber(f: BuilderField, text: string): number | null {
  const t = text.toLowerCase();
  let n: number;
  if (/^\d{1,2}$/.test(t)) n = Number(t);
  else {
    const i = NAMES[f]?.indexOf(t) ?? -1;
    if (i < 0) return null;
    n = f === "month" ? i + 1 : i;
  }
  if (f === "dow" && n === 7) n = 0;
  const { min, max } = LIMITS[f];
  return n >= min && n <= max ? n : null;
}

/**
 * Reads one field back into the builder, or null when it uses syntax the builder does not
 * offer (L, W, #, ?). Lists that contain ranges are expanded into specific values.
 */
export function parseField(f: BuilderField, text: string): FieldSpec | null {
  const { min, max } = LIMITS[f];
  const base = everySpec(f);
  const t = text.trim();
  if (t === "*") return base;
  let m = /^\*\/(\d{1,2})$/.exec(t);
  if (m) {
    const step = Number(m[1]);
    return step >= 1 ? { ...base, mode: "step", step, start: min } : null;
  }
  m = /^(\w+)-(\w+)(?:\/(\d{1,2}))?$/.exec(t);
  if (m) {
    // "7" (Sunday) at the end of a weekday range means "through Saturday".
    const a = fieldNumber(f, m[1] ?? "");
    let b = fieldNumber(f, m[2] ?? "");
    if (f === "dow" && b === 0 && a !== 0) b = 6;
    const step = m[3] ? Number(m[3]) : 1;
    if (a === null || b === null || step < 1 || a > b) return null;
    if (m[3] && b === max) return { ...base, mode: "step", step, start: a };
    return { ...base, mode: "range", from: a, to: b, step };
  }
  const values: number[] = [];
  for (const part of t.split(",")) {
    const r = /^(\w+)-(\w+)$/.exec(part);
    if (r) {
      const a = fieldNumber(f, r[1] ?? "");
      const b = fieldNumber(f, r[2] ?? "");
      if (a === null || b === null || a > b) return null;
      for (let v = a; v <= b; v++) values.push(v);
      continue;
    }
    const v = fieldNumber(f, part);
    if (v === null) return null;
    values.push(v);
  }
  const uniq = [...new Set(values)].sort((a, b) => a - b);
  return uniq.length ? { ...base, mode: "specific", values: uniq } : null;
}

/**
 * The builder state of an expression, or null when the builder cannot show it (6 fields with
 * seconds, or L/W/# syntax). Macros such as @daily are expanded first.
 */
export function cronToBuilder(input: string): BuilderSpec | null {
  const raw = input.trim().replace(/\s+/g, " ");
  const expr = MACROS[raw.toLowerCase()] ?? raw;
  const parts = expr.split(" ");
  if (parts.length !== 5) return null;
  const out: Partial<BuilderSpec> = {};
  for (const [i, f] of BUILDER_FIELDS.entries()) {
    const spec = parseField(f, parts[i] ?? "");
    if (!spec) return null;
    out[f] = spec;
  }
  return out as BuilderSpec;
}
