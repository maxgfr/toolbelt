/** Searching the HTTP status reference by code, class ("4xx"), name or words, in every language. */
import { matchesQuery } from "../_shared";
import { STATUSES, type Status } from "./data";

export type StatusClass = 1 | 2 | 3 | 4 | 5;
export const CLASSES: StatusClass[] = [1, 2, 3, 4, 5];

export function classOf(code: number): StatusClass {
  return Math.min(5, Math.max(1, Math.floor(code / 100))) as StatusClass;
}

export function findStatus(code: number): Status | undefined {
  return STATUSES.find((s) => s.code === code);
}

/**
 * Statuses matching `query`: a full code ("404") gives that code, a prefix ("40") or class
 * ("4xx") gives the codes starting with it, anything else is searched in names and
 * descriptions (accents and case ignored).
 */
export function searchStatuses(
  query: string,
  filter: StatusClass | 0 = 0,
  showRare = true,
): Status[] {
  const q = query.trim();
  let list = STATUSES.filter(
    (s) => (!filter || classOf(s.code) === filter) && (showRare || !s.rare),
  );
  if (!q) return list;
  const cls = /^([1-5])xx$/i.exec(q);
  if (cls) return list.filter((s) => String(s.code)[0] === cls[1]);
  if (/^\d{1,3}$/.test(q)) {
    list = STATUSES.filter((s) => !filter || classOf(s.code) === filter);
    return list.filter((s) => String(s.code).startsWith(q));
  }
  return list.filter((s) =>
    matchesQuery(q, s.code, s.name, s.nameFr, s.nameDe, s.en, s.fr, s.de, s.ref),
  );
}

/** Statuses grouped by class, keeping only non-empty groups. */
export function groupByClass(list: Status[]): { cls: StatusClass; items: Status[] }[] {
  return CLASSES.map((cls) => ({ cls, items: list.filter((s) => classOf(s.code) === cls) })).filter(
    (g) => g.items.length,
  );
}
