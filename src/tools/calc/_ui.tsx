/**
 * UI pieces shared by the everyday calculators: money in the UI language with a currency
 * picker, number display, a lenient text number input and the "how it's computed" note.
 */
import type { ComponentChildren } from "preact";
import { Select } from "../../app/kit";
import { useToolState } from "../../app/state";
import { CopyButton, Field } from "../../app/ui";
import { fmt, l, locale, pick, tr } from "../../i18n";
import { parseNumber } from "./_shared";

const T = {
  currency: l("Currency", "Devise", "Währung"),
  how: l("How it's computed", "Comment c'est calculé", "So wird gerechnet"),
};

export { locale };

export const CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "AUD",
  "NZD",
  "JPY",
  "CNY",
  "INR",
  "BRL",
  "MXN",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "RON",
  "TRY",
  "ZAR",
  "MAD",
  "TND",
  "DZD",
  "XOF",
  "XAF",
  "SGD",
  "HKD",
  "KRW",
] as const;

/** The tool's currency: EUR in French and German, USD in English, until the user picks one. */
export function useCurrency() {
  const sig = useToolState("currency", "");
  const code = sig.value || pick({ en: "USD", fr: "EUR", de: "EUR" });
  return { sig, code };
}

function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames([locale()], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function CurrencySelect({ cur }: { cur: ReturnType<typeof useCurrency> }) {
  return (
    <Select
      label={tr(T.currency)}
      value={cur.code}
      onChange={(v) => {
        cur.sig.value = v;
      }}
      options={CURRENCIES.map((c) => ({ value: c, label: `${c} · ${currencyName(c)}` }))}
    />
  );
}

/** 1234.5 → "1 234,50 €" / "$1,234.50". */
export function money(n: number, code: string, digits?: number): string {
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat(locale(), {
      style: "currency",
      currency: code,
      ...(digits === undefined
        ? {}
        : { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    }).format(n);
  } catch {
    return `${fmt(n, { maximumFractionDigits: 2 })} ${code}`;
  }
}

/** The currency's symbol in the UI language ("€", "$", "CHF"). */
export function currencySymbol(code: string): string {
  try {
    const parts = new Intl.NumberFormat(locale(), {
      style: "currency",
      currency: code,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? code;
  } catch {
    return code;
  }
}

/** A number for display with at most `max` decimals; "—" when not finite. */
export function num(n: number, max = 2, min = 0): string {
  if (!Number.isFinite(n)) return "—";
  return fmt(n, { maximumFractionDigits: max, minimumFractionDigits: min });
}

/** A percentage given in percent units: 20 → "20 %" / "20%". */
export function pct(n: number, max = 2): string {
  if (!Number.isFinite(n)) return "—";
  return fmt(n / 100, { style: "percent", maximumFractionDigits: max });
}

/** A default decimal for a text input, as people type it: "12.5", or "12,5" in French and German. */
export function typed(s: string): string {
  const comma = s.replace(".", ",");
  return pick({ en: s, fr: comma, de: comma });
}

/** Grouped digits, up to 12 significant digits, scientific when extreme. */
export function formatNumber(n: number): string {
  if (Number.isNaN(n)) return "—";
  if (!Number.isFinite(n)) return n > 0 ? "∞" : "−∞";
  const a = Math.abs(n);
  if (a !== 0 && (a >= 1e15 || a < 1e-9))
    return fmt(n, { notation: "scientific", maximumSignificantDigits: 12 });
  return fmt(n, { maximumSignificantDigits: 12, maximumFractionDigits: 10 });
}

/** A plain number to paste elsewhere (no grouping). */
export function plain(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "";
  return String(Number(n.toFixed(digits)));
}

/**
 * A text input that accepts "1 234,5" as well as "1234.5". It keeps what was typed (a string),
 * and marks itself invalid when the text is not a number.
 */
export function NumText({
  value,
  onInput,
  label,
  placeholder,
  class: cls,
  hidden,
}: {
  value: string;
  onInput: (v: string) => void;
  label: string;
  placeholder?: string;
  class?: string;
  /** Use the label for screen readers only (in table rows). */
  hidden?: boolean;
}) {
  const bad = !!value.trim() && parseNumber(value) === null;
  const input = (
    <input
      class={`input ${cls ?? ""}`}
      type="text"
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      aria-label={hidden ? label : undefined}
      aria-invalid={bad}
      onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
    />
  );
  return hidden ? input : <Field label={label}>{input}</Field>;
}

/** The parsed value of a NumText, or the fallback when empty or invalid. */
export function numOr(s: string, fallback = 0): number {
  return parseNumber(s) ?? fallback;
}

/** A big result line with a copy button. */
export function Result({
  label,
  value,
  copy,
  note,
}: {
  label: string;
  value: string;
  copy?: string;
  note?: ComponentChildren;
}) {
  return (
    <div class="calc-result">
      <span class="muted small">{label}</span>
      <div class="calc-result-line">
        <strong>{value}</strong>
        {copy !== undefined && copy !== "" && <CopyButton text={copy} />}
      </div>
      {note && <span class="muted small">{note}</span>}
    </div>
  );
}

/** "How it's computed": a short, plain-language explanation under the results. */
export function Formula({ children, title }: { children: ComponentChildren; title?: string }) {
  return (
    <aside class="calc-formula small">
      <strong>{title ?? tr(T.how)}</strong>
      {children}
    </aside>
  );
}
