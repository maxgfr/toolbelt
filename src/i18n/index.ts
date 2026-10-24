/**
 * Three languages: English, French and German. Every user-facing string is an
 * `L10n` written next to the code that shows it; `tr()` picks the current one.
 * The language follows the browser when it is one of these (English
 * otherwise), and a choice made in the header list is remembered.
 */
import { effect, signal } from "@preact/signals";

export type Lang = "en" | "fr" | "de";

/** The languages, in the order of the header list, with their own names. */
export const LANGS: { id: Lang; name: string; locale: string }[] = [
  { id: "en", name: "English", locale: "en-US" },
  { id: "fr", name: "Français", locale: "fr-FR" },
  { id: "de", name: "Deutsch", locale: "de-DE" },
];

export interface L10n {
  en: string;
  fr: string;
  de?: string;
}

const KEY = "toolbelt:lang";

function isLang(v: unknown): v is Lang {
  return LANGS.some((x) => x.id === v);
}

/** The first of the browser's preferred languages that toolbelt speaks, or English. */
export function detectLang(preferred: readonly string[]): Lang {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (isLang(base)) return base;
  }
  return "en";
}

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch {}
  if (typeof navigator === "undefined") return "en";
  return detectLang(navigator.languages?.length ? navigator.languages : [navigator.language ?? ""]);
}

export const lang = signal<Lang>(typeof window === "undefined" ? "en" : initial());

if (typeof document !== "undefined") {
  effect(() => {
    document.documentElement.lang = lang.value;
  });
}

/** Switches language and remembers the choice for the next visits. */
export function setLang(next: Lang): void {
  lang.value = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {}
}

/** The current language's version of a string (English if a translation is missing). */
export function tr(s: L10n): string {
  return s[lang.value] ?? s.en;
}

/** Shorthand to write a string inline: `l("Copy", "Copier", "Kopieren")`. */
export function l(en: string, fr: string, de?: string): L10n {
  return de === undefined ? { en, fr } : { en, fr, de };
}

/** The BCP 47 locale of the current language, for Intl formatting ("en-US", "fr-FR", "de-DE"). */
export function locale(): string {
  const id = lang.value;
  return LANGS.find((x) => x.id === id)?.locale ?? "en-US";
}

/** Picks the current language's value from a per-language map (English as the fallback). */
export function pick<T>(values: { en: T; fr: T; de?: T }): T {
  return values[lang.value] ?? values.en;
}

/** Locale-aware number formatting in the current language. */
export function fmt(n: number, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale(), opts).format(n);
}
