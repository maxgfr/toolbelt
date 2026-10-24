/**
 * Tool state. `useToolState(key, initial)` is a signal that:
 *  - is remembered in localStorage per tool (unless `persist: false`, for secrets),
 *  - goes into the share link (unless `share: false`),
 *  - starts from a shared link's value when the tool is opened from one.
 */
import { type Signal, signal } from "@preact/signals";
import { useMemo } from "preact/hooks";

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

interface Entry {
  sig: Signal<Json>;
  initial: Json;
  share: boolean;
}

let current = "";
const live = new Map<string, Entry>();
let pending: Record<string, Json> | null = null;
/** Writes waiting for their debounce; flushed when the page is hidden or closed. */
const unsaved = new Set<() => void>();

if (typeof window !== "undefined") {
  const flush = () => {
    for (const write of [...unsaved]) write();
  };
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

/** Called by the shell when a tool page mounts. */
export function beginTool(id: string, shared: Record<string, Json> | null): void {
  current = id;
  live.clear();
  pending = shared;
}

function storageKey(tool: string, key: string): string {
  return `toolbelt:${tool}:${key}`;
}

function readStored(tool: string, key: string): Json | undefined {
  try {
    const raw = localStorage.getItem(storageKey(tool, key));
    return raw == null ? undefined : (JSON.parse(raw) as Json);
  } catch {
    return undefined;
  }
}

export interface StateOptions {
  /** Keep in localStorage (default true). Set false for passwords, keys, secrets. */
  persist?: boolean;
  /** Include in share links (default true). */
  share?: boolean;
}

export function useToolState(key: string, initial: string, opts?: StateOptions): Signal<string>;
export function useToolState(key: string, initial: number, opts?: StateOptions): Signal<number>;
export function useToolState(key: string, initial: boolean, opts?: StateOptions): Signal<boolean>;
export function useToolState<T extends Json>(
  key: string,
  initial: T,
  opts?: StateOptions,
): Signal<T>;
export function useToolState<T extends Json>(
  key: string,
  initial: T,
  opts: StateOptions = {},
): Signal<T> {
  const tool = current;
  return useMemo(() => {
    const persist = opts.persist ?? true;
    const share = opts.share ?? true;
    let start: Json = initial;
    if (pending && key in pending && share) start = pending[key] as Json;
    else if (persist) start = readStored(tool, key) ?? initial;
    const sig = signal<Json>(start);
    if (persist) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const write = () => {
        timer = undefined;
        unsaved.delete(write);
        try {
          const v = sig.peek();
          if (JSON.stringify(v) === JSON.stringify(initial))
            localStorage.removeItem(storageKey(tool, key));
          else localStorage.setItem(storageKey(tool, key), JSON.stringify(v));
        } catch {}
      };
      sig.subscribe(() => {
        clearTimeout(timer);
        timer = setTimeout(write, 250);
        unsaved.add(write);
      });
    }
    live.set(key, { sig, initial, share });
    return sig as Signal<T>;
  }, []);
}

/** The shareable part of the open tool's state (only values that differ from the defaults). */
export function snapshot(): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const [k, e] of live)
    if (e.share && JSON.stringify(e.sig.value) !== JSON.stringify(e.initial)) out[k] = e.sig.value;
  return out;
}

/** Puts every value of the open tool back to its default. */
export function resetTool(): void {
  for (const e of live.values()) e.sig.value = e.initial;
}

export const favorites = signal<string[]>(readList("toolbelt:favorites"));
export const recents = signal<string[]>(readList("toolbelt:recents"));

function readList(k: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(k) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeList(k: string, v: string[]): void {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

export function toggleFavorite(id: string): void {
  const f = favorites.value;
  favorites.value = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
  writeList("toolbelt:favorites", favorites.value);
}

export function markRecent(id: string): void {
  recents.value = [id, ...recents.value.filter((x) => x !== id)].slice(0, 8);
  writeList("toolbelt:recents", recents.value);
}
