/**
 * Two languages, English and French. Every user-facing string is an `L10n`
 * pair written next to the code that shows it; `tr()` picks the current one.
 * The language comes from the browser, can be switched in the header, and is
 * remembered.
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
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("fr")
    ? "fr"
    : "en";
}

export const lang = signal<Lang>(typeof window === "undefined" ? "en" : initial());

if (typeof document !== "undefined") {
  effect(() => {
    document.documentElement.lang = lang.value;
    try {
      localStorage.setItem(KEY, lang.value);
    } catch {}
  });
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
