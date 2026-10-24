import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { CopyButton, ErrorNote, Panel, Stats, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import {
  bitLength,
  groupDigits,
  groupSize,
  isBase,
  parseInBase,
  toBase,
  twosComplement,
} from "./logic";

const T = {
  bases: l("Bases", "Bases", "Basen"),
  binary: l("Binary", "Binaire", "Binär"),
  octal: l("Octal", "Octal", "Oktal"),
  decimal: l("Decimal", "Décimal", "Dezimal"),
  hex: l("Hexadecimal", "Hexadécimal", "Hexadezimal"),
  b36: l("Base 36", "Base 36", "Basis 36"),
  custom: l("Base", "Base", "Basis"),
  customLabel: l("Custom base (2–36)", "Base personnalisée (2–36)", "Eigene Basis (2–36)"),
  group: l("Group digits", "Grouper les chiffres", "Ziffern gruppieren"),
  upper: l("Uppercase letters", "Lettres majuscules", "Großbuchstaben"),
  hint: l(
    "Type in any row. Spaces, _ and the 0x / 0b / 0o prefixes are accepted.",
    "Tape dans n'importe quelle ligne. Espaces, _ et préfixes 0x / 0b / 0o acceptés.",
    "Tippe in eine beliebige Zeile. Leerzeichen, _ und die Präfixe 0x / 0b / 0o sind erlaubt.",
  ),
  badDigit: l(
    "“{c}” is not a digit in base {b} (position {i}).",
    "« {c} » n'est pas un chiffre en base {b} (position {i}).",
    "„{c}“ ist keine Ziffer zur Basis {b} (Position {i}).",
  ),
  badBase: l(
    "The base must be between 2 and 36.",
    "La base doit être entre 2 et 36.",
    "Die Basis muss zwischen 2 und 36 liegen.",
  ),
  bits: l("Bits", "Bits", "Bits"),
  bytes: l("Bytes", "Octets", "Bytes"),
  digits: l("Decimal digits", "Chiffres décimaux", "Dezimalstellen"),
  twos: l("Two's complement", "Complément à deux", "Zweierkomplement"),
  width: l("Width", "Largeur", "Breite"),
  signed: l("Signed", "Signé", "Mit Vorzeichen"),
  unsigned: l("Unsigned", "Non signé", "Ohne Vorzeichen"),
  noFit: l("does not fit", "ne tient pas", "passt nicht"),
};

const FIXED = [
  { base: 2, label: T.binary },
  { base: 8, label: T.octal },
  { base: 10, label: T.decimal },
  { base: 16, label: T.hex },
  { base: 36, label: T.b36 },
];

const WIDTHS = [8, 16, 32, 64];

export default function NumberBase() {
  const input = useToolState("input", "255");
  const base = useToolState("base", 10);
  const custom = useToolState("custom", 3);
  const group = useToolState("group", true);
  const upper = useToolState("upper", true);
  const parsed = useComputed(() => parseInBase(input.value, base.value));
  const p = parsed.value;

  function shown(b: number): string {
    if (b === base.value) return input.value;
    if (!p.ok || !isBase(b)) return "";
    const s = toBase(p.value, b, upper.value);
    return group.value ? groupDigits(s, groupSize(b)) : s;
  }

  function row(b: number, label: string, key: string) {
    const value = shown(b);
    return (
      <div class="nb-row" key={key}>
        <span class="nb-label">
          {label} <span class="muted small">({b})</span>
        </span>
        <input
          class="input mono"
          type="text"
          value={value}
          spellcheck={false}
          autocomplete="off"
          aria-label={`${label} (${b})`}
          aria-invalid={b === base.value && !p.ok && p.error !== "empty"}
          onInput={(e) => {
            base.value = b;
            input.value = (e.currentTarget as HTMLInputElement).value;
          }}
        />
        {value ? <CopyButton text={value.replace(/\s/g, "")} /> : <span />}
      </div>
    );
  }

  const customOk = isBase(custom.value);
  const v = p.ok ? p.value : null;

  return (
    <>
      <div class="row">
        <Toggle
          checked={group.value}
          onChange={(x) => {
            group.value = x;
          }}
          label={tr(T.group)}
        />
        <Toggle
          checked={upper.value}
          onChange={(x) => {
            upper.value = x;
          }}
          label={tr(T.upper)}
        />
      </div>
      <Panel title={tr(T.bases)}>
        <p class="muted small">{tr(T.hint)}</p>
        <div class="nb-rows">
          {FIXED.map((f) => row(f.base, tr(f.label), `b${f.base}`))}
          <div class="nb-row">
            <label class="nb-label nb-custom">
              {tr(T.custom)}
              <input
                class="input"
                type="number"
                min={2}
                max={36}
                value={custom.value}
                aria-label={tr(T.customLabel)}
                aria-invalid={!customOk}
                onInput={(e) => {
                  const n = Number((e.currentTarget as HTMLInputElement).value);
                  if (base.value === custom.value && p.ok && isBase(n)) {
                    // Keep the number when the custom row was the one typed in.
                    input.value = toBase(p.value, n, upper.value);
                    base.value = n;
                  }
                  custom.value = n;
                }}
              />
            </label>
            {customOk ? (
              <>
                <input
                  class="input mono"
                  type="text"
                  value={shown(custom.value)}
                  spellcheck={false}
                  autocomplete="off"
                  aria-label={`${tr(T.custom)} ${custom.value}`}
                  onInput={(e) => {
                    base.value = custom.value;
                    input.value = (e.currentTarget as HTMLInputElement).value;
                  }}
                />
                {shown(custom.value) ? (
                  <CopyButton text={shown(custom.value).replace(/\s/g, "")} />
                ) : (
                  <span />
                )}
              </>
            ) : (
              <span class="error small">{tr(T.badBase)}</span>
            )}
          </div>
        </div>
        {!p.ok && p.error === "digit" && (
          <ErrorNote
            error={tr(T.badDigit)
              .replace("{c}", p.char)
              .replace("{b}", String(base.value))
              .replace("{i}", String(p.index + 1))}
          />
        )}
        {!p.ok && p.error === "base" && <ErrorNote error={tr(T.badBase)} />}
      </Panel>

      {v !== null && (
        <>
          <Stats
            items={[
              { label: tr(T.bits), value: fmt(bitLength(v)) },
              { label: tr(T.bytes), value: fmt(Math.ceil(bitLength(v) / 8)) },
              { label: tr(T.digits), value: fmt(toBase(v < 0n ? -v : v, 10).length) },
            ]}
          />
          <Panel title={tr(T.twos)}>
            <div class="table-wrap">
              <table class="table nb-twos">
                <thead>
                  <tr>
                    <th>{tr(T.width)}</th>
                    <th>{tr(T.binary)}</th>
                    <th>{tr(T.hex)}</th>
                    <th class="num">{tr(T.signed)}</th>
                    <th class="num">{tr(T.unsigned)}</th>
                  </tr>
                </thead>
                <tbody>
                  {WIDTHS.map((w) => {
                    const t = twosComplement(v, w);
                    return (
                      <tr key={w} class={t.fits ? "" : "muted"}>
                        <td>{w} bits</td>
                        {t.fits ? (
                          <>
                            <td class="mono nb-bits">{groupDigits(t.binary, 4)}</td>
                            <td class="mono">{groupDigits(t.hex, 2)}</td>
                            <td class="num mono">{t.signed.toString()}</td>
                            <td class="num mono">{t.unsigned.toString()}</td>
                          </>
                        ) : (
                          <td colSpan={4} class="small">
                            {tr(T.noFit)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
