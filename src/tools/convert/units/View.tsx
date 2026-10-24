import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { CopyButton, ErrorNote, Field, IconButton, Segmented } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { parseNumber } from "../_shared";
import { formatNum, plainNum } from "../_ui";
import {
  belowAbsoluteZero,
  CATEGORIES,
  convert,
  convertAll,
  findCategory,
  findUnit,
} from "./logic";

const T = {
  category: l("Category", "Catégorie", "Kategorie"),
  value: l("Value", "Valeur", "Wert"),
  from: l("From", "De", "Von"),
  to: l("To", "Vers", "In"),
  swap: l("Swap units", "Inverser les unités", "Einheiten tauschen"),
  invalid: l(
    "Type a number, e.g. 12.5",
    "Tape un nombre, par ex. 12,5",
    "Gib eine Zahl ein, z. B. 12,5",
  ),
  absolute: l("Below absolute zero.", "Sous le zéro absolu.", "Unter dem absoluten Nullpunkt."),
  unit: l("Unit", "Unité", "Einheit"),
  result: l("Value", "Valeur", "Wert"),
  pick: l(
    "Click a unit to convert to it.",
    "Clique une unité pour convertir vers elle.",
    "Klicke auf eine Einheit, um in sie umzurechnen.",
  ),
  imperial: l("imperial / US", "impérial / US", "imperial / US"),
};

/** The pair shown when a category is first opened. */
const DEFAULT_PAIR: Record<string, [string, string]> = {
  length: ["m", "ft"],
  mass: ["kg", "lb"],
  temperature: ["c", "f"],
  volume: ["l", "gal"],
  area: ["m2", "ft2"],
  speed: ["kmh", "mph"],
  time: ["h", "min"],
  energy: ["kcal", "kj"],
  pressure: ["bar", "psi"],
  datarate: ["mbps", "MBps"],
};

export default function Units() {
  const category = useToolState("category", "length");
  const value = useToolState("value", "1");
  const from = useToolState("from", "m");
  const to = useToolState("to", "ft");

  const cat = findCategory(category.value);
  const pair = DEFAULT_PAIR[cat.id] ?? ["", ""];
  const fromId = findUnit(cat, from.value) ? from.value : pair[0];
  const toId = findUnit(cat, to.value) ? to.value : pair[1];
  const n = useComputed(() => parseNumber(value.value));
  const v = n.value;
  const result = v === null ? null : convert(v, cat.id, fromId, toId);
  const all = v === null ? [] : convertAll(v, cat.id, fromId);
  const toUnit = findUnit(cat, toId);
  const fromUnit = findUnit(cat, fromId);

  const select = (sig: typeof from, current: string, label: string) => (
    <select
      class="input"
      value={current}
      aria-label={label}
      onChange={(e) => {
        sig.value = (e.currentTarget as HTMLSelectElement).value;
      }}
    >
      {cat.units.map((u) => (
        <option key={u.id} value={u.id}>
          {tr(u.name)} ({u.symbol})
        </option>
      ))}
    </select>
  );

  return (
    <>
      <Segmented
        label={tr(T.category)}
        value={cat.id}
        onChange={(id) => {
          category.value = id;
          const [a, b] = DEFAULT_PAIR[id] ?? ["", ""];
          from.value = a;
          to.value = b;
        }}
        options={CATEGORIES.map((c) => ({ value: c.id, label: tr(c.name) }))}
      />

      <div class="un-form">
        <Field label={tr(T.value)}>
          <input
            class="input un-value"
            type="text"
            inputMode="decimal"
            value={value.value}
            aria-invalid={v === null && !!value.value.trim()}
            onInput={(e) => {
              value.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
        </Field>
        <Field label={tr(T.from)}>{select(from, fromId, tr(T.from))}</Field>
        <IconButton
          icon="swap"
          label={tr(T.swap)}
          class="un-swap"
          onClick={() => {
            from.value = toId;
            to.value = fromId;
          }}
        />
        <Field label={tr(T.to)}>{select(to, toId, tr(T.to))}</Field>
      </div>

      {v === null && value.value.trim() && <ErrorNote error={tr(T.invalid)} />}
      {v !== null && belowAbsoluteZero(v, cat.id, fromId) && <ErrorNote error={tr(T.absolute)} />}

      {result !== null && toUnit && fromUnit && (
        <div class="un-result">
          <span class="muted">
            {formatNum(v ?? 0)} {fromUnit.symbol} =
          </span>
          <strong>
            {formatNum(result)} {toUnit.symbol}
          </strong>
          <span class="spacer" />
          <CopyButton text={plainNum(result)} />
        </div>
      )}

      {all.length > 0 && (
        <div class="stack">
          <p class="muted small">{tr(T.pick)}</p>
          <div class="table-wrap">
            <table class="table un-table">
              <thead>
                <tr>
                  <th>{tr(T.unit)}</th>
                  <th class="num">{tr(T.result)}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {all.map((r) => (
                  <tr
                    key={r.unit.id}
                    class={r.unit.id === toId ? "un-on" : r.unit.id === fromId ? "un-from" : ""}
                  >
                    <td>
                      <button
                        type="button"
                        class="un-pick"
                        aria-pressed={r.unit.id === toId}
                        onClick={() => {
                          to.value = r.unit.id;
                        }}
                      >
                        {tr(r.unit.name)} <span class="muted mono small">{r.unit.symbol}</span>
                      </button>
                      {r.unit.imperial && <span class="un-tag small">{tr(T.imperial)}</span>}
                    </td>
                    <td class="num mono">{formatNum(r.value)}</td>
                    <td class="un-copy">
                      <CopyButton text={plainNum(r.value)} label="" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
