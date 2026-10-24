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
