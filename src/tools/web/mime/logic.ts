/** MIME types ↔ file extensions, both ways, over a bundled table of the common types. */
import { MIME_TABLE } from "./data";

export interface MimeEntry {
  type: string;
  /** Top-level type: application, audio, font, image, message, model, multipart, text, video. */
  group: string;
  extensions: string[];
}

export const ENTRIES: MimeEntry[] = MIME_TABLE.map(([type, exts]) => ({
  type,
  group: type.split("/")[0] ?? "",
  extensions: exts.split(" ").filter(Boolean),
}));

/** "photo.JPG", ".jpg", "JPG" → "jpg"; "" when it does not look like an extension. */
export function extensionOf(text: string): string {
  const s = text.trim().toLowerCase();
  const m = /(?:^|\.)([a-z0-9][a-z0-9+_-]*)$/.exec(s);
  return m && !s.includes("/") ? (m[1] ?? "") : "";
}

/** Registered types first, then the ones where `ext` is the main extension. */
function rank(e: MimeEntry, ext: string): number {
  const unregistered = e.type.split("/")[1]?.startsWith("x-") ? 1 : 0;
  return unregistered * 2 + (e.extensions[0] === ext ? 0 : 1);
}

/** The types of a file name or extension, most standard first. */
export function typesForExtension(text: string): MimeEntry[] {
  const ext = extensionOf(text);
  if (!ext) return [];
  return ENTRIES.filter((e) => e.extensions.includes(ext)).sort(
    (a, b) => rank(a, ext) - rank(b, ext),
  );
}

/** The entry of an exact MIME type (parameters like "; charset=utf-8" ignored). */
export function entryForType(text: string): MimeEntry | undefined {
  const t = text.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  return ENTRIES.find((e) => e.type.toLowerCase() === t);
}

/**
 * Searches both ways: an exact type or extension first, then types and extensions that
 * contain the query.
 */
export function searchMime(query: string, group = ""): MimeEntry[] {
  const pool = group ? ENTRIES.filter((e) => e.group === group) : ENTRIES;
  const q = query.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  if (!q) return pool;
  const bare = q.replace(/^\*?\./, "");
  const exact = new Set<MimeEntry>();
  const ext = extensionOf(q);
  for (const e of pool
    .filter((x) => x.extensions.includes(ext))
    .sort((a, b) => rank(a, ext) - rank(b, ext)))
    exact.add(e);
  for (const e of pool) if (e.type.toLowerCase() === q) exact.add(e);
  const loose = pool.filter(
    (e) =>
      !exact.has(e) &&
      (e.type.toLowerCase().includes(q) || e.extensions.some((x) => x.startsWith(bare))),
  );
  return [...exact, ...loose];
}

export const GROUPS = [
  "application",
  "audio",
  "font",
  "image",
  "message",
  "model",
  "multipart",
  "text",
  "video",
] as const;
