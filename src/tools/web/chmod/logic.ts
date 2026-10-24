/**
 * Unix permissions: a 12-bit mode (setuid, setgid, sticky, then rwx for owner, group,
 * others) written as octal (0755), symbolic (rwxr-xr-x) and as a `chmod` command.
 */
import { shellQuote } from "../_shared";

export const SETUID = 0o4000;
export const SETGID = 0o2000;
export const STICKY = 0o1000;

export type Who = "owner" | "group" | "others";
export type Perm = "r" | "w" | "x";

export const WHO: Who[] = ["owner", "group", "others"];
export const PERMS: Perm[] = ["r", "w", "x"];

/** The bit for a permission of a class, e.g. bit("group", "w") = 0o020. */
export function bit(who: Who, perm: Perm): number {
  const shift = { owner: 6, group: 3, others: 0 }[who];
  return { r: 4, w: 2, x: 1 }[perm] << shift;
}

/** "0755", "4755": four octal digits, the first one for the special bits. */
export function toOctal(mode: number): string {
  return (mode & 0o7777).toString(8).padStart(4, "0");
}

/** Octal mode from "755", "0755", "4755", "0o644" or "04755". Null when not a valid mode. */
export function parseOctal(text: string): number | null {
  const s = text.trim().replace(/^0o/i, "");
  if (!/^[0-7]{1,5}$/.test(s)) return null;
  const n = Number.parseInt(s, 8);
  if (s.length === 5 && s[0] !== "0") return null;
  return n <= 0o7777 ? n : null;
}

/** "rwxr-xr-x", with s/S for setuid/setgid and t/T for sticky (uppercase: no x under it). */
export function toSymbolic(mode: number): string {
  let out = "";
  for (const who of WHO) {
    out += mode & bit(who, "r") ? "r" : "-";
    out += mode & bit(who, "w") ? "w" : "-";
    const x = mode & bit(who, "x");
    const special = who === "owner" ? SETUID : who === "group" ? SETGID : STICKY;
    const letter = who === "others" ? "t" : "s";
    out += mode & special ? (x ? letter : letter.toUpperCase()) : x ? "x" : "-";
  }
  return out;
}

/** Parses "rwxr-xr-x" (or "-rwxr-xr-x" / "drwxr-xr-x" as `ls -l` prints it). */
export function parseSymbolic(text: string): number | null {
  let s = text.trim();
  if (s.length === 10 && /^[-dlcbps]/.test(s)) s = s.slice(1);
  if (!/^[r-][w-][xsS-][r-][w-][xsS-][r-][w-][xtT-]$/.test(s)) return null;
  let mode = 0;
  WHO.forEach((who, i) => {
    const [r, w, x] = s.slice(i * 3, i * 3 + 3);
    if (r === "r") mode |= bit(who, "r");
    if (w === "w") mode |= bit(who, "w");
    if (x === "x" || x === "s" || x === "t") mode |= bit(who, "x");
    if (x === "s" || x === "S") mode |= who === "owner" ? SETUID : SETGID;
    if (x === "t" || x === "T") mode |= STICKY;
  });
  return mode;
}

/** "u=rwx,g=rx,o=" — the symbolic form `chmod` accepts (special bits as u+s, g+s, +t). */
export function toChmodSymbolic(mode: number): string {
  const part = (who: Who, letter: string) =>
    `${letter}=${PERMS.filter((p) => mode & bit(who, p)).join("")}`;
  const parts = [part("owner", "u"), part("group", "g"), part("others", "o")];
  const special = [
    mode & SETUID ? "u+s" : "",
    mode & SETGID ? "g+s" : "",
    mode & STICKY ? "+t" : "",
  ].filter(Boolean);
  return [...parts, ...special].join(",");
}

/** The shortest octal `chmod` accepts: 3 digits, or 4 with special bits. */
export function shortOctal(mode: number): string {
  return mode & 0o7000 ? toOctal(mode) : toOctal(mode).slice(1);
}

export function chmodCommand(
  mode: number,
  path: string,
  opts: { recursive?: boolean; symbolic?: boolean } = {},
): string {
  const how = opts.symbolic ? toChmodSymbolic(mode) : shortOctal(mode);
  return ["chmod", opts.recursive ? "-R" : "", how, shellQuote(path.trim() || "file")]
    .filter(Boolean)
    .join(" ");
}

/** Usual modes and what they are for (the labels live in the view). */
export const PRESETS = [0o644, 0o600, 0o755, 0o700, 0o664, 0o775, 0o444, 0o777, 0o1777, 0o2775];
