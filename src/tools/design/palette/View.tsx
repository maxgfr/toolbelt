import { useComputed } from "@preact/signals";
import { Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { copyText, Field, Panel, Segmented, Toggle, toast } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { parseColor } from "../_shared";
import { Code, ColorField } from "../_ui";
import {
  type ColorFormat,
  cleanName,
  contrastHint,
  cssVars,
  type Harmony,
  harmony,
  type Level,
  type Swatch,
  scale,
  tailwind3,
  tailwind4,
  toJson,
} from "./logic";

const T = {
  base: l("Base color", "Couleur de base", "Grundfarbe"),
  name: l("Name", "Nom", "Name"),
  invalid: l(
    "Not a CSS color. Try #3b82f6, rgb(59 130 246), oklch(62% 0.19 260) or a name.",
    "Ce n'est pas une couleur CSS. Essaie #3b82f6, rgb(59 130 246), oklch(62% 0.19 260) ou un nom.",
    "Keine CSS-Farbe. Probier #3b82f6, rgb(59 130 246), oklch(62% 0.19 260) oder einen Namen.",
  ),
  harmony: l("Harmony", "Harmonie", "Harmonie"),
  harmonyType: l("Kind of harmony", "Type d'harmonie", "Art der Harmonie"),
  complementary: l("Complementary", "Complémentaire", "Komplementär"),
  analogous: l("Analogous", "Analogue", "Analog"),
  triadic: l("Triadic", "Triadique", "Triadisch"),
  split: l("Split complementary", "Complémentaire adjacente", "Geteilt komplementär"),
  tetradic: l("Tetradic (square)", "Tétradique (carré)", "Tetradisch (Quadrat)"),
  monochrome: l("Monochrome", "Monochrome", "Monochrom"),
  harmonyHint: l(
    "Hue rotations in OKLCH, same lightness and chroma. Click a swatch to copy it.",
    "Rotations de teinte en OKLCH, même luminosité et même chroma. Clique sur une pastille pour la copier.",
    "Farbtondrehungen in OKLCH, gleiche Helligkeit und Chroma. Klick auf ein Farbfeld, um es zu kopieren.",
  ),
  scale: l("Scale 50–950", "Échelle 50–950", "Skala 50–950"),
  keepBase: l(
    "Keep the exact base color in the scale",
    "Garder la couleur de base exacte dans l'échelle",
    "Exakte Grundfarbe in der Skala behalten",
  ),
  scaleHint: l(
    "OKLCH lightness steps like Tailwind's palettes, gamut-mapped to sRGB. Each swatch shows the WCAG contrast of white and black text; struck through below 4.5:1 (AA).",
    "Paliers de luminosité OKLCH comme les palettes Tailwind, ramenés dans le gamut sRGB. Chaque pastille montre le contraste WCAG d'un texte blanc et d'un texte noir ; barré sous 4,5:1 (AA).",
    "OKLCH-Helligkeitsstufen wie in den Tailwind-Paletten, in den sRGB-Farbraum abgebildet. Jedes Farbfeld zeigt den WCAG-Kontrast von weißem und schwarzem Text; unter 4,5:1 (AA) durchgestrichen.",
  ),
  baseMark: l("base", "base", "Basis"),
  whiteText: l("White text", "Texte blanc", "Weißer Text"),
  blackText: l("Black text", "Texte noir", "Schwarzer Text"),
  aaLarge: l("AA large text", "AA grand texte", "AA großer Text"),
  export: l("Export", "Export", "Export"),
  format: l("Color format", "Format des couleurs", "Farbformat"),
  css: l("CSS variables", "Variables CSS", "CSS-Variablen"),
  tw4: l("Tailwind v4", "Tailwind v4", "Tailwind v4"),
  tw3: l("Tailwind v3", "Tailwind v3", "Tailwind v3"),
  json: l("JSON", "JSON", "JSON"),
  copied: l("Copied", "Copié", "Kopiert"),
  fail: l("fail", "échec", "ungenügend"),
};

type Out = "css" | "tw4" | "tw3" | "json";

const HARMONY_OPTIONS: { value: Harmony; label: ReturnType<typeof l> }[] = [
  { value: "complementary", label: T.complementary },
  { value: "analogous", label: T.analogous },
  { value: "triadic", label: T.triadic },
  { value: "split", label: T.split },
  { value: "tetradic", label: T.tetradic },
  { value: "monochrome", label: T.monochrome },
];

async function copy(s: string) {
  if (await copyText(s)) toast(`${tr(T.copied)} ${s}`, "success", 1600);
}

function levelText(lv: Level): string {
  return lv === "fail" ? tr(T.fail) : lv === "AA18" ? tr(T.aaLarge) : lv;
}

function SwatchButton({ s, label, isBase }: { s: Swatch; label?: string; isBase?: boolean }) {
  const c = contrastHint(s.hex);
  const ratio = (n: number) => fmt(n, { maximumFractionDigits: 2 });
  return (
    <button
      type="button"
      class={`palette-swatch ${isBase ? "base" : ""}`}
      style={{ background: s.hex, color: c.text }}
      title={`${s.hex} · ${s.oklch}\n${tr(T.whiteText)}: ${ratio(c.white)}:1 (${levelText(c.whiteLevel)}) · ${tr(T.blackText)}: ${ratio(c.black)}:1 (${levelText(c.blackLevel)})`}
      onClick={() => copy(s.hex)}
    >
      {label && (
        <span class="palette-step">
          {label}
          {isBase && ` · ${tr(T.baseMark)}`}
        </span>
      )}
      <span class="mono palette-hex">{s.hex}</span>
      <span class="palette-contrast">
        <span class={`palette-aa w ${c.whiteLevel}`}>
          Aa {fmt(c.white, { maximumFractionDigits: 1 })}
        </span>
        <span class={`palette-aa b ${c.blackLevel}`}>
          Aa {fmt(c.black, { maximumFractionDigits: 1 })}
        </span>
      </span>
    </button>
  );
}

export default function Palette() {
  const input = useToolState("color", "#3b82f6");
  const name = useToolState("name", "primary");
  const kind = useToolState<Harmony>("harmony", "complementary");
  const keepBase = useToolState("keepBase", true);
  const format = useToolState<ColorFormat>("format", "hex");
  const out = useToolState<Out>("out", "css");

  const color = useComputed(() => parseColor(input.value));
  const c = color.value;
  const n = cleanName(name.value);
  const k = HARMONY_OPTIONS.some((o) => o.value === kind.value) ? kind.value : "complementary";
  const f: ColorFormat = format.value === "oklch" ? "oklch" : "hex";
  const steps = c ? scale(c, keepBase.value) : [];
  const harm = c ? harmony(c, k) : [];
  const code = !c
    ? ""
    : out.value === "tw4"
      ? tailwind4(n, steps, f)
      : out.value === "tw3"
        ? tailwind3(n, steps, f)
        : out.value === "json"
          ? toJson(n, steps, harm, k, f)
          : cssVars(n, steps, f);

  return (
    <>
      <Panel>
        <div class="grid-2">
          <ColorField
            label={tr(T.base)}
            value={input.value}
            onInput={(v) => {
              input.value = v;
            }}
          />
          <Field label={tr(T.name)}>
            <input
              class="input mono"
              value={name.value}
              spellcheck={false}
              autocomplete="off"
              onInput={(e) => {
                name.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
        </div>
        {!c && <p class="error-note">{tr(T.invalid)}</p>}
      </Panel>

      {c && (
        <>
          <Panel title={tr(T.harmony)}>
            <Select<Harmony>
              label={tr(T.harmonyType)}
              value={k}
              options={HARMONY_OPTIONS.map((o) => ({ value: o.value, label: tr(o.label) }))}
              onChange={(v) => {
                kind.value = v;
              }}
            />
            <div class="palette-harmony">
              {harm.map((s, i) => (
                <SwatchButton key={i} s={s} />
              ))}
            </div>
            <p class="muted small">{tr(T.harmonyHint)}</p>
          </Panel>

          <Panel title={tr(T.scale)}>
            <Toggle
              label={tr(T.keepBase)}
              checked={keepBase.value}
              onChange={(v) => {
                keepBase.value = v;
              }}
            />
            <div class="palette-scale">
              {steps.map((s) => (
                <SwatchButton key={s.step} s={s} label={String(s.step)} isBase={s.base} />
              ))}
            </div>
            <p class="muted small">{tr(T.scaleHint)}</p>
          </Panel>

          <Panel
            title={tr(T.export)}
            actions={
              <Segmented<ColorFormat>
                label={tr(T.format)}
                value={f}
                options={[
                  { value: "hex", label: "HEX" },
                  { value: "oklch", label: "OKLCH" },
                ]}
                onChange={(v) => {
                  format.value = v;
                }}
              />
            }
          >
            <Segmented<Out>
              label={tr(T.export)}
              value={out.value}
              options={[
                { value: "css", label: tr(T.css) },
                { value: "tw4", label: tr(T.tw4) },
                { value: "tw3", label: tr(T.tw3) },
                { value: "json", label: tr(T.json) },
              ]}
              onChange={(v) => {
                out.value = v;
              }}
            />
            <Code
              label={tr(
                out.value === "tw4"
                  ? T.tw4
                  : out.value === "tw3"
                    ? T.tw3
                    : out.value === "json"
                      ? T.json
                      : T.css,
              )}
              code={code}
            />
          </Panel>
        </>
      )}
    </>
  );
}
