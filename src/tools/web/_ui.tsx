/**
 * Small UI pieces shared by the web tools (could move to src/app/ui.tsx): a status badge,
 * a search box, a labelled number field, a text input that keeps the user's draft while it
 * does not parse, and a "nothing found" line.
 */
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { Field, Icon } from "../../app/ui";

export type BadgeKind = "ok" | "bad" | "warn" | "info";

/** A small pill: ✓ valid, ✗ invalid, warning, or neutral info. */
export function Badge({ kind, children }: { kind: BadgeKind; children: ComponentChildren }) {
  const mark = kind === "ok" ? "✓ " : kind === "bad" ? "✗ " : "";
  return (
    <span class={`web-badge web-badge-${kind}`}>
      {mark}
      {children}
    </span>
  );
}

/** A search input with a magnifier icon. */
export function SearchBox({
  value,
  onInput,
  placeholder,
}: {
  value: string;
  onInput: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div class="web-search">
      <Icon name="search" size={16} />
      <input
        type="search"
        class="input"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        spellcheck={false}
        onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
      />
    </div>
  );
}

/**
 * A labelled number input that only reports finite values within [min, max] (out-of-range
 * keystrokes are ignored rather than clamped, so typing "0.5" with min 0.1 still works).
 */
export function NumberField({
  label,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = "any",
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  suffix?: string;
}) {
  return (
    <Field label={label}>
      <div class="web-number">
        <input
          type="number"
          class="input"
          value={value}
          min={Number.isFinite(min) ? min : undefined}
          max={Number.isFinite(max) ? max : undefined}
          step={step}
          onInput={(e) => {
            const raw = (e.currentTarget as HTMLInputElement).value;
            if (raw === "") return;
            const n = Number(raw);
            if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
          }}
        />
        {suffix && <span class="muted small">{suffix}</span>}
      </div>
    </Field>
  );
}

/**
 * A text input bound to a canonical value: what the user types is applied through `apply`
 * (which returns false when it does not parse) and stays as typed until blur, so a half-typed
 * value is neither lost nor rewritten.
 */
export function DraftInput({
  value,
  apply,
  label,
  mono = true,
  placeholder,
}: {
  value: string;
  apply: (text: string) => boolean;
  label: string;
  mono?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  return (
    <input
      class={`input ${mono ? "mono" : ""}`}
      value={draft ?? value}
      aria-label={label}
      aria-invalid={bad}
      placeholder={placeholder}
      spellcheck={false}
      autocomplete="off"
      onInput={(e) => {
        const t = (e.currentTarget as HTMLInputElement).value;
        setDraft(t);
        setBad(t.trim() !== "" && !apply(t));
      }}
      onBlur={() => {
        setDraft(null);
        setBad(false);
      }}
    />
  );
}

/** The muted line shown when a search or filter matches nothing. */
export function Empty({ children }: { children: ComponentChildren }) {
  return <p class="muted web-empty">{children}</p>;
}
