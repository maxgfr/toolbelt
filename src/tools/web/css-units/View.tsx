import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Field, Output, Panel } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { num } from "../_shared";
import { NumberField } from "../_ui";
import { COMMON_PX, convert, convertAll, parseLength, UNITS, type Unit } from "./logic";

const T = {
  value: l("Length", "Longueur"),
  placeholder: l("24px, 1.5rem, 12pt, 50vw…", "24px, 1.5rem, 12pt, 50vw…"),
  unit: l("Unit of a bare number", "Unité d'un nombre seul"),
  invalid: l(
    "Not a CSS length. Type a number, optionally followed by a unit: 24px, 1.5rem, 12pt.",
    "Ce n'est pas une longueur CSS. Tape un nombre, éventuellement suivi d'une unité : 24px, 1.5rem, 12pt.",
  ),
  context: l("Context", "Contexte"),
  root: l("Root font size (1rem)", "Taille de police racine (1rem)"),
  parent: l("Parent font size (1em, 100%)", "Taille de police parente (1em, 100 %)"),
  vw: l("Viewport width", "Largeur de la fenêtre"),
  vh: l("Viewport height", "Hauteur de la fenêtre"),
  thisWindow: l("This window", "Cette fenêtre"),
  results: l("In every unit", "Dans toutes les unités"),
  absolute: l(
    "Absolute units use the CSS reference: 1in = 96px = 72pt.",
    "Les unités absolues suivent la référence CSS : 1in = 96px = 72pt.",
  ),
  table: l("Common sizes", "Tailles courantes"),
};

const VIEWPORTS = [
  { label: "375 × 667", vw: 375, vh: 667 },
  { label: "768 × 1024", vw: 768, vh: 1024 },
  { label: "1440 × 900", vw: 1440, vh: 900 },
  { label: "1920 × 1080", vw: 1920, vh: 1080 },
];

const TABLE_UNITS: Unit[] = ["rem", "em", "pt", "vw", "vh"];

export default function CssUnits() {
  const text = useToolState("value", "24px");
  const unit = useToolState<Unit>("unit", "px");
  const root = useToolState("root", 16);
  const parent = useToolState("parent", 16);
  const vw = useToolState("vw", 1440);
  const vh = useToolState("vh", 900);

  const ctx = useComputed(() => ({
    root: root.value,
    parent: parent.value,
    vw: vw.value,
    vh: vh.value,
  }));
  const parsed = useComputed(() => parseLength(text.value, unit.value));
  const p = parsed.value;
  const rows = p ? convertAll(p.value, p.unit, ctx.value) : [];

  return (
    <>
      <div class="grid-2">
        <Field label={tr(T.value)}>
          <input
            class="input mono css-units-main"
            value={text.value}
            placeholder={tr(T.placeholder)}
            aria-invalid={!!text.value.trim() && !p}
            spellcheck={false}
            autocomplete="off"
            onInput={(e) => {
              text.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
        </Field>
        <Field label={tr(T.unit)}>
          <select
            class="input"
            value={unit.value}
            onChange={(e) => {
              unit.value = (e.currentTarget as HTMLSelectElement).value as Unit;
            }}
          >
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {text.value.trim() && !p && <p class="error-note">{tr(T.invalid)}</p>}

      <Panel title={tr(T.context)}>
        <div class="css-units-context">
          <NumberField
            label={tr(T.root)}
            value={root.value}
            min={0.1}
            suffix="px"
            onChange={(v) => {
              root.value = v;
            }}
          />
          <NumberField
            label={tr(T.parent)}
            value={parent.value}
            min={0.1}
            suffix="px"
            onChange={(v) => {
              parent.value = v;
            }}
          />
          <NumberField
            label={tr(T.vw)}
            value={vw.value}
            min={1}
            suffix="px"
            onChange={(v) => {
              vw.value = v;
            }}
          />
          <NumberField
            label={tr(T.vh)}
            value={vh.value}
            min={1}
            suffix="px"
            onChange={(v) => {
              vh.value = v;
            }}
          />
        </div>
        <div class="row">
          {VIEWPORTS.map((v) => (
            <Button
              key={v.label}
              size="sm"
              variant={vw.value === v.vw && vh.value === v.vh ? "primary" : "secondary"}
              onClick={() => {
                vw.value = v.vw;
                vh.value = v.vh;
              }}
            >
              {v.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              vw.value = window.innerWidth;
              vh.value = window.innerHeight;
            }}
          >
            {tr(T.thisWindow)}
          </Button>
        </div>
      </Panel>

      {p && (
        <Panel title={tr(T.results)}>
          <div class="css-units-results">
            {rows.map((r) => (
              <Output key={r.unit} label={r.unit} value={r.css} />
            ))}
          </div>
          <p class="muted small">{tr(T.absolute)}</p>
        </Panel>
      )}

      <Panel title={tr(T.table)}>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th class="num">px</th>
                {TABLE_UNITS.map((u) => (
                  <th key={u} class="num">
                    {u}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMMON_PX.map((px) => (
                <tr key={px}>
                  <td class="num mono">
                    <button
                      type="button"
                      class="css-units-pick"
                      onClick={() => {
                        text.value = `${px}px`;
                      }}
                    >
                      {px}
                    </button>
                  </td>
                  {TABLE_UNITS.map((u) => (
                    <td key={u} class="num mono">
                      {num(convert(px, "px", u, ctx.value), 4)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="muted small">
          {fmt(root.value)} px = 1rem · {fmt(parent.value)} px = 1em · {fmt(vw.value)} ×{" "}
          {fmt(vh.value)} px
        </p>
      </Panel>
    </>
  );
}
