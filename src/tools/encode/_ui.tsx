/**
 * Small UI pieces shared by the encode tools: a select and a number field with the shared look,
 * the message of an error in the current language, and a hook for async results (hashing,
 * WebCrypto) that ignores answers that arrive after the input changed.
 */
import { type Signal, useSignal, useSignalEffect } from "@preact/signals";
import { useRef } from "preact/hooks";
import { Field } from "../../app/ui";
import { tr } from "../../i18n";
import { errorL10n } from "./_shared";

/** The message of any thrown value, in the current language. */
export function errMsg(err: unknown): string {
  return tr(errorL10n(err));
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      <select
        class="input"
        value={value}
        onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** A number input that only reports integers within [min, max]. */
export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      <input
        class="input"
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number((e.currentTarget as HTMLInputElement).value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
      />
    </Field>
  );
}

export interface AsyncState<T> {
  busy: boolean;
  value: T | null;
  error: string | null;
}

/**
 * Runs `run` whenever the signals it reads (synchronously, before its first `await`) change.
 * `run` returns null when there is nothing to compute. Only the latest call's answer is kept.
 */
export function useAsync<T>(run: () => Promise<T> | null): Signal<AsyncState<T>> {
  const state = useSignal<AsyncState<T>>({ busy: false, value: null, error: null });
  const seq = useRef(0);
  useSignalEffect(() => {
    const id = ++seq.current;
    let p: Promise<T> | null;
    try {
      p = run();
    } catch (err) {
      state.value = { busy: false, value: null, error: errMsg(err) };
      return;
    }
    if (!p) {
      state.value = { busy: false, value: null, error: null };
      return;
    }
    state.value = { ...state.peek(), busy: true };
    p.then(
      (value) => {
        if (id === seq.current) state.value = { busy: false, value, error: null };
      },
      (err) => {
        if (id === seq.current) state.value = { busy: false, value: null, error: errMsg(err) };
      },
    );
  });
  return state;
}
