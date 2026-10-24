/**
 * UI pieces shared by the time & number tools: the UI locale, number
 * formatting that stays readable for tiny and huge values, and a searchable
 * time zone picker.
 */
import { useMemo, useRef, useState } from "preact/hooks";
import { fmt, l, lang, tr } from "../../i18n";
import {
  formatOffset,
  isValidZone,
  searchZones,
  splitSeconds,
  timeZones,
  zoneCity,
  zoneOffset,
} from "./_shared";

/** The Intl locale of the UI language. */
export function locale(): string {
  return lang.value === "fr" ? "fr-FR" : "en-US";
}

/** A number for display: grouped digits, up to `digits` significant digits, scientific when extreme. */
export function formatNum(n: number, digits = 10): string {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a !== 0 && (a >= 1e15 || a < 1e-6))
    return fmt(n, { notation: "scientific", maximumSignificantDigits: Math.min(digits, 12) });
  return fmt(n, { maximumSignificantDigits: digits });
}

/** The same, without grouping separators: what to paste elsewhere. */
export function plainNum(n: number, digits = 12): string {
  if (!Number.isFinite(n)) return "";
  return String(Number(n.toPrecision(digits)));
}

/** Runs `f`, or gives null if it throws (Intl on an odd zone or a date out of range). */
export function attempt<T>(f: () => T): T | null {
  try {
    return f();
  } catch {
    return null;
  }
}

/** 3725.5 s → "1 h 2 min 6 s"; under a minute keeps decimals ("2.5 s"). */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "∞";
  if (seconds < 60) return `${fmt(seconds, { maximumSignificantDigits: 3 })} s`;
  const { days: d, hours: h, minutes: m, seconds: s } = splitSeconds(Math.round(seconds));
  const parts: string[] = [];
  if (d) parts.push(`${fmt(d)} ${lang.value === "fr" ? "j" : "d"}`);
  if (h) parts.push(`${h} h`);
  if (m && d < 10) parts.push(`${m} min`);
  if (s && !d) parts.push(`${s} s`);
  return parts.join(" ");
}

const T = {
  search: l("Search a city, zone or offset…", "Chercher une ville, un fuseau, un décalage…"),
  none: l("No matching time zone", "Aucun fuseau ne correspond"),
  invalid: l("Unknown time zone", "Fuseau inconnu"),
};

let uid = 0;

/** A text box that searches the IANA zones (city, region, abbreviation, offset). */
export function ZonePicker({
  value,
  onChange,
  label,
  placeholder,
  clearOnPick,
}: {
  value: string;
  onChange: (zone: string) => void;
  label?: string;
  placeholder?: string;
  /** Empty the box after a pick (for "add a zone" boxes). */
  clearOnPick?: boolean;
}) {
  const id = useMemo(() => `zp-${++uid}`, []);
  const all = useMemo(() => timeZones(), []);
  const [text, setText] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const shown = text ?? (clearOnPick ? "" : value);
  const now = useMemo(() => new Date(), [open]);
  const matches = useMemo(
    () => (open ? searchZones(text ?? "", all, now).slice(0, 60) : []),
    [open, text, all, now],
  );
  const invalid = !clearOnPick && text === null && !!value && !isValidZone(value);

  function pick(z: string) {
    onChange(z);
    setText(null);
    setOpen(false);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const n = matches.length;
      if (!n) return;
      const next = (active + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
      setActive(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      const z = matches[active];
      if (z) pick(z);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      setText(null);
    }
  }

  return (
    <div class="zp">
      <input
        class="input"
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && matches.length ? `${id}-${active}` : undefined}
        aria-invalid={invalid}
        placeholder={placeholder ?? tr(T.search)}
        value={shown}
        spellcheck={false}
        autocomplete="off"
        onFocus={(e) => {
          (e.currentTarget as HTMLInputElement).select();
          setOpen(true);
          setActive(0);
        }}
        onBlur={() => {
          // Let a click on an option land first.
          setTimeout(() => {
            setOpen(false);
            setText(null);
          }, 150);
        }}
        onInput={(e) => {
          setText((e.currentTarget as HTMLInputElement).value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKey}
      />
      {open && (
        <div class="zp-list" id={`${id}-list`} role="listbox" ref={listRef}>
          {matches.length === 0 && <div class="zp-empty muted small">{tr(T.none)}</div>}
          {matches.map((z, i) => (
            <div
              key={z}
              id={`${id}-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={i === active}
              class={`zp-option ${i === active ? "on" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(z);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span class="zp-city">{zoneCity(z)}</span>
              <span class="zp-id muted small">{z}</span>
              <span class="zp-off mono small">UTC{formatOffset(zoneOffset(now, z))}</span>
            </div>
          ))}
        </div>
      )}
      {invalid && <span class="error small">{tr(T.invalid)}</span>}
    </div>
  );
}
