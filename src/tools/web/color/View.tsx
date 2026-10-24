import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, Field, Output, Panel } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { Badge } from "../_ui";
import {
  type ApcaUse,
  apcaContrast,
  apcaUse,
  colorName,
  contrastRatio,
  formats,
  hex,
  inGamut,
  parseColor,
  readableOn,
  tintsAndShades,
  wcagLevels,
} from "./logic";

const T = {
  color: l("Color", "Couleur", "Farbe"),
  placeholder: l(
    "#0f766e, rgb(…), hsl(…), oklch(…), teal…",
    "#0f766e, rgb(…), hsl(…), oklch(…), teal…",
    "#0f766e, rgb(…), hsl(…), oklch(…), teal…",
  ),
  pick: l("Pick a color", "Choisir une couleur", "Farbe wählen"),
  invalid: l(
    "Not a CSS color. Try #0f766e, rgb(15 118 110), hsl(174 77% 26%), oklch(51% 0.09 182) or a name.",
    "Ce n'est pas une couleur CSS. Essaie #0f766e, rgb(15 118 110), hsl(174 77% 26%), oklch(51% 0.09 182) ou un nom.",
    "Keine CSS-Farbe. Versuch es mit #0f766e, rgb(15 118 110), hsl(174 77% 26%), oklch(51% 0.09 182) oder einem Namen.",
  ),
  formats: l("Formats", "Formats", "Formate"),
  name: l("Name", "Nom", "Name"),
  nearest: l("nearest", "le plus proche", "am nächsten"),
  gamut: l(
    "Outside the sRGB gamut: hex, rgb, hsl and hwb are clamped to the nearest displayable color.",
    "Hors du gamut sRGB : hex, rgb, hsl et hwb sont ramenés à la couleur affichable la plus proche.",
    "Außerhalb des sRGB-Farbraums: hex, rgb, hsl und hwb werden auf die nächste darstellbare Farbe begrenzt.",
  ),
  scale: l("Shades and tints", "Nuances sombres et claires", "Abdunklungen und Aufhellungen"),
  scaleHint: l(
    "Mixed with black and white in OKLab. Click a swatch to use it.",
    "Mélangées au noir et au blanc dans OKLab. Clique sur une pastille pour l'utiliser.",
    "In OKLab mit Schwarz und Weiß gemischt. Klicke auf ein Farbfeld, um es zu übernehmen.",
  ),
  copyScale: l("Copy all", "Tout copier", "Alle kopieren"),
  contrast: l("Contrast checker", "Vérificateur de contraste", "Kontrastprüfer"),
  fg: l("Text (foreground)", "Texte (premier plan)", "Text (Vordergrund)"),
  bg: l("Background", "Arrière-plan", "Hintergrund"),
  swap: l("Swap", "Inverser", "Tauschen"),
  useColor: l("Use the color above", "Prendre la couleur ci-dessus", "Farbe von oben übernehmen"),
  ratio: l("WCAG 2 ratio", "Ratio WCAG 2", "WCAG-2-Verhältnis"),
  normal: l("Normal text", "Texte normal", "Normaler Text"),
  large: l("Large text", "Grand texte", "Großer Text"),
  largeHint: l(
    "≥ 24 px, or ≥ 18.66 px bold",
    "≥ 24 px, ou ≥ 18,66 px en gras",
    "≥ 24 px oder ≥ 18,66 px fett",
  ),
  ui: l("UI components & icons", "Composants d'interface et icônes", "UI-Komponenten & Icons"),
  pass: l("Pass", "Réussi", "Bestanden"),
  fail: l("Fail", "Échec", "Nicht bestanden"),
  sample: l(
    "The quick brown fox jumps over the lazy dog.",
    "Portez ce vieux whisky au juge blond qui fume.",
    "Victor jagt zwölf Boxkämpfer quer über den großen Sylter Deich.",
  ),
  sampleLarge: l("Large heading", "Grand titre", "Große Überschrift"),
  apca: l("APCA Lc (WCAG 3 draft)", "APCA Lc (brouillon WCAG 3)", "APCA Lc (WCAG-3-Entwurf)"),
  bestText: l(
    "Best plain text on this background:",
    "Meilleur texte uni sur ce fond :",
    "Bester einfarbiger Text auf diesem Hintergrund:",
  ),
  black: l("black", "noir", "Schwarz"),
  white: l("white", "blanc", "Weiß"),
};

const APCA_USE: Record<ApcaUse, ReturnType<typeof l>> = {
  body: l("fine for body text", "convient au texte courant", "gut für Fließtext"),
  content: l(
    "fine for content text ≥ 16 px",
    "convient au texte ≥ 16 px",
    "gut für Inhaltstext ≥ 16 px",
  ),
  large: l(
    "headlines and large text only",
    "titres et grand texte seulement",
    "nur für Überschriften und großen Text",
  ),
  spot: l(
    "non-text and spot text only",
    "éléments non textuels seulement",
    "nur für Nicht-Text-Elemente und kurze Texte",
  ),
  none: l("too low for text", "trop faible pour du texte", "zu schwach für Text"),
};

function ColorInput({
  label,
  value,
  onInput,
  invalid,
}: {
  label: string;
  value: string;
  onInput: (v: string) => void;
  invalid: boolean;
}) {
  const c = parseColor(value);
  return (
    <Field label={label}>
      <div class="color-input">
        <input
          type="color"
          value={c ? hex(c).slice(0, 7) : "#000000"}
          aria-label={`${label} — ${tr(T.pick)}`}
          onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
        />
        <input
          class="input mono"
          value={value}
          aria-invalid={invalid}
          spellcheck={false}
          autocomplete="off"
          placeholder={tr(T.placeholder)}
          aria-label={label}
          onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
        />
      </div>
    </Field>
  );
}

export default function ColorTool() {
  const input = useToolState("color", "#0f766e");
  const fg = useToolState("fg", "#18181b");
  const bg = useToolState("bg", "#ffffff");

  const color = useComputed(() => parseColor(input.value));
  const fgc = useComputed(() => parseColor(fg.value));
  const bgc = useComputed(() => parseColor(bg.value));
  const c = color.value;
  const scale = c ? tintsAndShades(c) : [];
  const name = c ? colorName(c) : null;

  const f = fgc.value;
  const b = bgc.value;
  const ratio = f && b ? contrastRatio(f, b) : null;
  const levels = ratio ? wcagLevels(ratio) : null;
  const lc = f && b ? apcaContrast(f, b) : null;
  const pass = (ok: boolean) => <Badge kind={ok ? "ok" : "bad"}>{tr(ok ? T.pass : T.fail)}</Badge>;

  return (
    <>
      <div class="color-top">
        <div
          class="color-hero"
          style={c ? { background: hex(c), color: readableOn(c) } : undefined}
          aria-hidden="true"
        >
          {c ? hex(c) : "?"}
        </div>
        <div class="stack">
          <ColorInput
            label={tr(T.color)}
            value={input.value}
            invalid={!!input.value.trim() && !c}
            onInput={(v) => {
              input.value = v;
            }}
          />
          {input.value.trim() && !c && <p class="error-note">{tr(T.invalid)}</p>}
          {c && !inGamut(c) && <p class="color-warn small">{tr(T.gamut)}</p>}
          {name && (
            <Output
              label={tr(T.name)}
              value={name.exact ? name.name : `${name.name} (${tr(T.nearest)})`}
            />
          )}
        </div>
      </div>

      {c && (
        <Panel title={tr(T.formats)}>
          <div class="color-formats">
            {formats(c).map((fm) => (
              <Output key={fm.id} label={fm.id} value={fm.value} />
            ))}
          </div>
        </Panel>
      )}

      {c && (
        <Panel
          title={tr(T.scale)}
          actions={
            <CopyButton label={tr(T.copyScale)} text={() => scale.map((s) => s.hex).join("\n")} />
          }
        >
          <div class="color-scale">
            {scale.map((s) => (
              <button
                type="button"
                key={s.step}
                class={`color-step ${s.step === 0 ? "base" : ""}`}
                style={{ background: s.hex, color: readableOn(parseColor(s.hex) ?? c) }}
                title={s.hex}
                onClick={() => {
                  input.value = s.hex;
                }}
              >
                <span class="mono">{s.hex}</span>
              </button>
            ))}
          </div>
          <p class="muted small">{tr(T.scaleHint)}</p>
        </Panel>
      )}

      <Panel
        title={tr(T.contrast)}
        actions={
          <>
            {c && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  fg.value = input.value;
                }}
              >
                {tr(T.useColor)}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon="swap"
              onClick={() => {
                [fg.value, bg.value] = [bg.value, fg.value];
              }}
            >
              {tr(T.swap)}
            </Button>
          </>
        }
      >
        <div class="grid-2">
          <ColorInput
            label={tr(T.fg)}
            value={fg.value}
            invalid={!!fg.value.trim() && !f}
            onInput={(v) => {
              fg.value = v;
            }}
          />
          <ColorInput
            label={tr(T.bg)}
            value={bg.value}
            invalid={!!bg.value.trim() && !b}
            onInput={(v) => {
              bg.value = v;
            }}
          />
        </div>
        {f && b && ratio && levels && lc !== null ? (
          <div class="color-contrast">
            <div class="color-preview" style={{ background: hex(b), color: hex(f) }}>
              <strong class="color-preview-large">{tr(T.sampleLarge)}</strong>
              <span>{tr(T.sample)}</span>
              <span class="color-preview-ui" style={{ borderColor: hex(f) }}>
                ★
              </span>
            </div>
            <div class="stack">
              <div class="color-ratio">
                <span class="muted small">{tr(T.ratio)}</span>
                <strong>
                  {fmt(Math.floor(ratio * 100) / 100, { maximumFractionDigits: 2 })}:1
                </strong>
              </div>
              <table class="table color-wcag">
                <thead>
                  <tr>
                    <th />
                    <th>AA</th>
                    <th>AAA</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{tr(T.normal)}</td>
                    <td>{pass(levels.aaNormal)}</td>
                    <td>{pass(levels.aaaNormal)}</td>
                  </tr>
                  <tr>
                    <td>
                      {tr(T.large)} <span class="muted small">({tr(T.largeHint)})</span>
                    </td>
                    <td>{pass(levels.aaLarge)}</td>
                    <td>{pass(levels.aaaLarge)}</td>
                  </tr>
                  <tr>
                    <td>{tr(T.ui)}</td>
                    <td>{pass(levels.ui)}</td>
                    <td class="muted">—</td>
                  </tr>
                </tbody>
              </table>
              <p class="small">
                <strong>{tr(T.apca)}</strong>{" "}
                <span class="mono">{fmt(lc, { maximumFractionDigits: 1 })}</span> —{" "}
                <span class="muted">{tr(APCA_USE[apcaUse(lc)])}</span>
              </p>
              <p class="small muted">
                {tr(T.bestText)} {tr(readableOn(b) === "#000000" ? T.black : T.white)}
              </p>
            </div>
          </div>
        ) : (
          <p class="error-note">{tr(T.invalid)}</p>
        )}
      </Panel>
    </>
  );
}
