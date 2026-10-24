import { useComputed } from "@preact/signals";
import { NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Field, Panel, Segmented, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { Code } from "../_ui";
import {
  cleanScale,
  DEFAULT,
  RATIOS,
  type Scale,
  scaleCss,
  scaleTailwind3,
  scaleTailwind4,
  steps,
} from "./logic";

const T = {
  scale: l("Scale", "Échelle", "Skala"),
  base: l("Base size", "Taille de base", "Grundgröße"),
  ratio: l("Ratio", "Ratio", "Verhältnis"),
  preset: l("Musical interval", "Intervalle musical", "Musikalisches Intervall"),
  custom: l("Custom", "Personnalisé", "Eigenes"),
  up: l("Steps up", "Paliers au-dessus", "Stufen nach oben"),
  down: l("Steps down", "Paliers en dessous", "Stufen nach unten"),
  root: l("Root font size (1rem)", "Taille racine (1rem)", "Basis-Schriftgröße (1rem)"),
  prefix: l("Variable name", "Nom de variable", "Variablenname"),
  fluid: l(
    "Fluid (clamp between two viewports)",
    "Fluide (clamp entre deux largeurs d'écran)",
    "Fließend (clamp zwischen zwei Viewports)",
  ),
  small: l("Small screen", "Petit écran", "Kleiner Bildschirm"),
  large: l("Large screen", "Grand écran", "Großer Bildschirm"),
  viewport: l("Viewport width", "Largeur d'écran", "Viewport-Breite"),
  sample: l("Preview text", "Texte d'aperçu", "Vorschautext"),
  sampleDefault: l("The quick brown fox", "Portez ce vieux whisky", "Franz jagt im Taxi"),
  preview: l("Preview", "Aperçu", "Vorschau"),
  step: l("Step", "Palier", "Stufe"),
  px: l("Size", "Taille", "Größe"),
  value: l("CSS value", "Valeur CSS", "CSS-Wert"),
  output: l("Output", "Export", "Ausgabe"),
  css: l("CSS variables", "Variables CSS", "CSS-Variablen"),
  tw4: l("Tailwind v4", "Tailwind v4", "Tailwind v4"),
  tw3: l("Tailwind v3", "Tailwind v3", "Tailwind v3"),
  previewHint: l(
    "Shown at the large-screen size; the fluid value moves between the two sizes.",
    "Affiché à la taille grand écran ; la valeur fluide varie entre les deux tailles.",
    "Angezeigt in der Größe für große Bildschirme; der fließende Wert bewegt sich zwischen beiden Größen.",
  ),
};

type Out = "css" | "tw4" | "tw3";

function RatioField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const preset = RATIOS.find((r) => r.value === value);
  return (
    <div class="type-scale-ratio">
      <Select
        label={label}
        value={preset ? String(preset.value) : "custom"}
        options={[
          ...RATIOS.map((r) => ({ value: String(r.value), label: `${r.value} · ${tr(r.name)}` })),
          { value: "custom", label: tr(T.custom) },
        ]}
        onChange={(v) => {
          if (v !== "custom") onChange(Number(v));
        }}
      />
      <NumberField
        label={tr(T.ratio)}
        value={value}
        min={1}
        max={4}
        step={0.001}
        onChange={onChange}
      />
    </div>
  );
}

export default function TypeScale() {
  const raw = useToolState<Scale>("scale", DEFAULT);
  const out = useToolState<Out>("out", "css");
  const sample = useToolState("sample", "");
  const s = useComputed(() => cleanScale(raw.value)).value;
  const set = (p: Partial<Scale>) => {
    raw.value = { ...s, ...p };
  };
  const list = steps(s);
  const text = sample.value.trim() || tr(T.sampleDefault);
  const code =
    out.value === "css" ? scaleCss(s) : out.value === "tw4" ? scaleTailwind4(s) : scaleTailwind3(s);
  const px = (n: number) => `${fmt(n, { maximumFractionDigits: 1 })} px`;

  return (
    <>
      <Panel title={tr(T.scale)}>
        <Toggle label={tr(T.fluid)} checked={s.fluid} onChange={(fluid) => set({ fluid })} />
        <div class={s.fluid ? "grid-2" : ""}>
          {s.fluid && (
            <fieldset class="type-scale-group">
              <legend>{tr(T.small)}</legend>
              <NumberField
                label={tr(T.viewport)}
                value={s.minVw}
                min={1}
                max={10000}
                suffix="px"
                onChange={(minVw) => set({ minVw })}
              />
              <NumberField
                label={tr(T.base)}
                value={s.minBase}
                min={1}
                max={200}
                step={0.5}
                suffix="px"
                onChange={(minBase) => set({ minBase })}
              />
              <RatioField
                label={tr(T.preset)}
                value={s.minRatio}
                onChange={(minRatio) => set({ minRatio })}
              />
            </fieldset>
          )}
          <fieldset class="type-scale-group">
            {s.fluid && <legend>{tr(T.large)}</legend>}
            {s.fluid && (
              <NumberField
                label={tr(T.viewport)}
                value={s.maxVw}
                min={1}
                max={10000}
                suffix="px"
                onChange={(maxVw) => set({ maxVw })}
              />
            )}
            <NumberField
              label={tr(T.base)}
              value={s.base}
              min={1}
              max={200}
              step={0.5}
              suffix="px"
              onChange={(base) => set({ base })}
            />
            <RatioField label={tr(T.preset)} value={s.ratio} onChange={(ratio) => set({ ratio })} />
          </fieldset>
        </div>
        <div class="type-scale-misc">
          <NumberField
            label={tr(T.up)}
            value={s.up}
            min={0}
            max={12}
            integer
            onChange={(up) => set({ up })}
          />
          <NumberField
            label={tr(T.down)}
            value={s.down}
            min={0}
            max={6}
            integer
            onChange={(down) => set({ down })}
          />
          <NumberField
            label={tr(T.root)}
            value={s.root}
            min={1}
            max={100}
            suffix="px"
            onChange={(root) => set({ root })}
          />
          <Field label={tr(T.prefix)}>
            <input
              class="input mono"
              value={s.prefix}
              spellcheck={false}
              autocomplete="off"
              onChange={(e) => set({ prefix: (e.currentTarget as HTMLInputElement).value })}
            />
          </Field>
        </div>
      </Panel>

      <Panel title={tr(T.preview)}>
        <Field label={tr(T.sample)}>
          <input
            class="input"
            value={sample.value}
            placeholder={tr(T.sampleDefault)}
            onInput={(e) => {
              sample.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
        </Field>
        <div class="type-scale-rows">
          {list.map((st) => (
            <div key={st.step} class={`type-scale-row ${st.step === 0 ? "base" : ""}`}>
              <div class="type-scale-meta">
                <code class="mono small">{st.name}</code>
                <span class="muted small">
                  {s.fluid ? `${px(st.minPx)} → ${px(st.maxPx)}` : px(st.maxPx)}
                </span>
              </div>
              <div class="type-scale-sample" style={{ fontSize: `${st.maxPx}px` }}>
                {text}
              </div>
            </div>
          ))}
        </div>
        <p class="muted small">{tr(T.previewHint)}</p>
      </Panel>

      <Panel
        title={tr(T.output)}
        actions={
          <Segmented<Out>
            label={tr(T.output)}
            value={out.value}
            options={[
              { value: "css", label: tr(T.css) },
              { value: "tw4", label: tr(T.tw4) },
              { value: "tw3", label: tr(T.tw3) },
            ]}
            onChange={(v) => {
              out.value = v;
            }}
          />
        }
      >
        <Code
          label={tr(out.value === "css" ? T.css : out.value === "tw4" ? T.tw4 : T.tw3)}
          code={code}
        />
      </Panel>
    </>
  );
}
