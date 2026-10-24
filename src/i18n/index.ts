/**
 * Two languages, English and French. Every user-facing string is an `L10n`
 * pair written next to the code that shows it; `tr()` picks the current one.
 * The language comes from the browser (English unless it prefers French), and
 * a choice made with the header switch is remembered.
 */
import { effect, signal } from "@preact/signals";

export type Lang = "en" | "fr";
export interface L10n {
  en: string;
  fr: string;
}

const KEY = "toolbelt:lang";

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "fr") return saved;
  } catch {}
  if (typeof navigator === "undefined") return "en";
  const first = navigator.languages?.[0] ?? navigator.language ?? "en";
  return first.toLowerCase().startsWith("fr") ? "fr" : "en";
}

export const lang = signal<Lang>(typeof window === "undefined" ? "en" : initial());

if (typeof document !== "undefined") {
  effect(() => {
    document.documentElement.lang = lang.value;
  });
}

/**
 * Switches language and remembers the choice. Until the user picks one, the language follows
 * the browser on every visit: French if the browser prefers French, English otherwise.
 */
export function setLang(next: Lang): void {
  lang.value = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {}
}

/** The current language's version of a string. */
export function tr(s: L10n): string {
  return s[lang.value];
}

/** Shorthand to write a pair inline: `l("Copy", "Copier")`. */
export function l(en: string, fr: string): L10n {
  return { en, fr };
}

/** Locale-aware number formatting in the current language. */
export function fmt(n: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(lang.value === "fr" ? "fr-FR" : "en-US", opts).format(n);
}
