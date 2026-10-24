/**
 * UI pieces shared by the design tools: a color field (picker + text), a slider with its number
 * input, a code output, and a row of preset buttons.
 */
import { useEffect, useState } from "preact/hooks";
import { CopyButton, Field } from "../../app/ui";
import { l, tr } from "../../i18n";
import { hex6, parseColor } from "./_shared";

const T = {
  pick: l("Pick a color", "Choisir une couleur"),
  invalid: l("Not a CSS color", "Pas une couleur CSS"),
};

/** A color picker next to a text input that accepts any CSS color. */
export function ColorField({
  label,
  value,
  onInput,
  compact,
}: {
  label: string;
  value: string;
  onInput: (v: string) => void;
  compact?: boolean;
}) {
  const ok = !!parseColor(value);
  const body = (
    <span class="design-color">
      <input
        type="color"
        value={hex6(value)}
        aria-label={`${label} — ${tr(T.pick)}`}
        title={tr(T.pick)}
        onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
      />
      <input
        class="input mono"
        value={value}
        aria-label={label}
        aria-invalid={!ok}
        title={ok ? undefined : tr(T.invalid)}
        spellcheck={false}
        autocomplete="off"
        onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
      />
    </span>
  );
  if (compact) return body;
  return <Field label={label}>{body}</Field>;
}

/** A range slider with a number input beside it; both report values clamped to [min, max]. */
export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const v = Number.isFinite(value) ? value : min;
  const [draft, setDraft] = useState(String(v));
  useEffect(() => {
    if (Number(draft) !== v) setDraft(String(v));
  }, [v]);
  const set = (raw: string) => {
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(n)) return;
    onChange(Math.min(max, Math.max(min, n)));
  };
  return (
    <div class="design-slider">
      <span class="field-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v}
        aria-label={label}
        onInput={(e) => set((e.currentTarget as HTMLInputElement).value)}
      />
      <span class="design-slider-num">
        <input
          class="input mono"
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={draft}
          aria-label={label}
          onInput={(e) => {
            const raw = (e.currentTarget as HTMLInputElement).value;
            setDraft(raw);
            set(raw);
          }}
          onBlur={() => setDraft(String(v))}
        />
        {suffix && <span class="muted small">{suffix}</span>}
      </span>
    </div>
  );
}

/** A read-only block of code with a copy button. */
export function Code({ label, code }: { label: string; code: string }) {
  return (
    <div class="design-code">
      <div class="design-code-head">
        <span class="textbox-label">{label}</span>
        <CopyButton text={code} />
      </div>
      <pre class="mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** A row of preset buttons; each shows its name (and optionally a small preview). */
export function Presets<P extends { id: string; name: { en: string; fr: string } }>({
  label,
  presets,
  onPick,
  thumb,
}: {
  label: string;
  presets: readonly P[];
  onPick: (p: P) => void;
  thumb?: (p: P) => Record<string, string> | undefined;
}) {
  return (
    <fieldset class="design-presets">
      <legend class="sr-only">{label}</legend>
      {presets.map((p) => (
        <button type="button" key={p.id} class="design-preset" onClick={() => onPick(p)}>
          {thumb && <span class="design-preset-thumb" style={thumb(p)} aria-hidden="true" />}
          <span>{tr(p.name)}</span>
        </button>
      ))}
    </fieldset>
  );
}
