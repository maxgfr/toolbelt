/**
 * Hooks shared by the life tools: a clock that ticks only while needed, the page title while a
 * timer runs, keyboard shortcuts that leave form fields alone, and alarms scheduled on the
 * audio clock. Everything is cleaned up when the tool unmounts.
 */
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { makeAudio, playTones } from "./_audio";
import type { Tone } from "./_shared";

/**
 * `Date.now()`, refreshed every `ms` milliseconds while `active` (every animation frame when
 * `ms` is 0). Times are always derived from timestamps, so throttled background tabs stay right.
 */
export function useNow(active: boolean, ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    if (ms === 0) {
      let raf = 0;
      const loop = () => {
        setNow(Date.now());
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      // rAF pauses in background tabs: a slow interval keeps the title and checks going.
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => {
        cancelAnimationFrame(raf);
        clearInterval(id);
      };
    }
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

/** Sets the page title while `text` is not null; puts the previous one back afterwards. */
export function useTitle(text: string | null): void {
  const original = useRef<string | null>(null);
  useEffect(() => {
    if (original.current === null) original.current = document.title;
  }, []);
  useEffect(() => {
    if (text !== null) document.title = text;
    else if (original.current !== null) document.title = original.current;
  }, [text]);
  useEffect(
    () => () => {
      if (original.current !== null) document.title = original.current;
    },
    [],
  );
}

/** True when a key event comes from a place where typing means typing. */
export function isTyping(e: Event): boolean {
  const t = e.target as HTMLElement | null;
  if (!t || !(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (t as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "range", "submit", "reset"].includes(type);
  }
  return false;
}

/**
 * Window keyboard shortcuts for the open tool. The handler is skipped while typing in a field,
 * and for Ctrl / ⌘ / Alt combinations (left to the browser and the app).
 */
export function useKeys(handler: (e: KeyboardEvent) => void, active = true): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
      ref.current(e);
    };
    // A focused button would also "click" on Space: the shortcut owns Space instead.
    const onUp = (e: KeyboardEvent) => {
      if (e.key === " " && (e.target as HTMLElement | null)?.tagName === "BUTTON")
        e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [active]);
}

export interface Alarm {
  /** Creates or resumes the audio context; call it from a click so the browser allows sound. */
  ensure(): AudioContext | null;
  /**
   * Keeps one alarm scheduled per entry whose time (epoch ms) is in the future; alarms of
   * entries no longer listed are cancelled unless they already started ringing.
   */
  sync(entries: { id: string; at: number }[]): void;
  /** True when the alarm of `id` at `at` was scheduled on the audio clock. */
  covers(id: string, at: number): boolean;
  /** Plays the pattern now. */
  ring(): void;
  /** Stops every sound that is playing or scheduled. */
  silence(): void;
}

/** Alarms that play `tones` at a given time, scheduled ahead on the WebAudio clock. */
export function useAlarm(tones: Tone[], volume = 0.35): Alarm {
  const ac = useRef<AudioContext | null>(null);
  const scheduled = useRef(new Map<string, { at: number; cancel: () => void }>());
  const playing = useRef<(() => void)[]>([]);
  const opts = useRef({ tones, volume });
  opts.current = { tones, volume };
  const last = useRef<{ id: string; at: number }[]>([]);

  const api = useMemo<Alarm>(() => {
    const ensure = () => {
      if (!ac.current) {
        const a = makeAudio();
        ac.current = a;
        // Once the browser lets the context run, schedule what is waiting.
        if (a) a.onstatechange = () => a.state === "running" && api.sync(last.current);
      }
      if (ac.current?.state === "suspended") ac.current.resume().catch(() => {});
      return ac.current;
    };
    const api: Alarm = {
      ensure,
      sync(entries) {
        last.current = entries;
        const now = Date.now();
        const map = scheduled.current;
        for (const [id, s] of map) {
          const keep = entries.some((e) => e.id === id && e.at === s.at);
          if (keep) continue;
          if (s.at > now) s.cancel();
          else playing.current.push(s.cancel);
          map.delete(id);
        }
        const a = ac.current;
        if (a?.state !== "running") return;
        for (const e of entries) {
          if (map.has(e.id) || e.at <= now) continue;
          const start = a.currentTime + (e.at - now) / 1000;
          map.set(e.id, {
            at: e.at,
            cancel: playTones(a, opts.current.tones, start, opts.current.volume),
          });
        }
      },
      covers(id, at) {
        return scheduled.current.get(id)?.at === at;
      },
      ring() {
        const a = ensure();
        if (a)
          playing.current.push(playTones(a, opts.current.tones, undefined, opts.current.volume));
      },
      silence() {
        const now = Date.now();
        for (const c of playing.current) c();
        playing.current = [];
        for (const [id, s] of scheduled.current)
          if (s.at <= now) {
            s.cancel();
            scheduled.current.delete(id);
          }
      },
    };
    return api;
  }, []);

  useEffect(
    () => () => {
      for (const s of scheduled.current.values()) s.cancel();
      for (const c of playing.current) c();
      scheduled.current.clear();
      ac.current?.close().catch(() => {});
      ac.current = null;
    },
    [],
  );
  return api;
}
