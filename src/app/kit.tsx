/**
 * More shared pieces for tools: a labelled select, a number field, a status badge, and a hook
 * for async results that keeps only the latest answer.
 */
import { type Signal, useSignal, useSignalEffect } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";
import { Field } from "./ui";

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

/**
 * A number input that reports finite values clamped to [min, max] (rounded when `integer`).
 * Typing an invalid or partial value leaves the last valid one in place.
 */
export function NumberField({
  label,
  value,
  onChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  integer = false,
  hint,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number | "any";
  integer?: boolean;
  hint?: string;
  /** A unit shown after the input ("€", "kg", "%"). */
  suffix?: string;
}) {
  const input = (
    <input
      class="input"
      type="number"
      inputMode={integer ? "numeric" : "decimal"}
      value={Number.isFinite(value) ? value : ""}
      min={Number.isFinite(min) ? min : undefined}
      max={Number.isFinite(max) ? max : undefined}
      step={step}
      onInput={(e) => {
        const raw = (e.currentTarget as HTMLInputElement).value;
        if (raw.trim() === "") return;
        let n = Number(raw);
        if (!Number.isFinite(n)) return;
        if (integer) n = Math.round(n);
        onChange(Math.min(max, Math.max(min, n)));
      }}
    />
  );
  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      {suffix ? (
        <span class="input-suffix">
          {input}
          <span class="muted">{suffix}</span>
        </span>
      ) : (
        input
      )}
    </Field>
  );
}

export type BadgeKind = "ok" | "bad" | "warn" | "info";

/** A small status pill: ✓ valid, ✗ invalid, a warning, or plain info. */
export function Badge({ kind, children }: { kind: BadgeKind; children: ComponentChildren }) {
  const mark = kind === "ok" ? "✓ " : kind === "bad" ? "✗ " : "";
  return (
    <span class={`badge badge-${kind}`}>
      {mark}
      {children}
    </span>
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
      state.value = { busy: false, value: null, error: message(err) };
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
        if (id === seq.current) state.value = { busy: false, value: null, error: message(err) };
      },
    );
  });
  return state;
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
