import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Output, Panel, Segmented } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { declsToStyle } from "../_shared";
import { Code, ColorField, Presets, Slider } from "../_ui";
import {
  BACKGROUNDS,
  type BgId,
  background,
  cardInk,
  cleanGlass,
  DEFAULT,
  type Glass,
  glassCss,
  glassDecls,
  glassTailwind,
  PRESETS,
} from "./logic";

const T = {
  presets: l("Presets", "Préréglages", "Voreinstellungen"),
  settings: l("Glass", "Verre", "Glas"),
  blur: l("Backdrop blur", "Flou de l'arrière-plan", "Hintergrund-Weichzeichnung"),
  alpha: l("Fill opacity", "Opacité du fond", "Deckkraft der Füllung"),
  saturation: l("Backdrop saturation", "Saturation de l'arrière-plan", "Hintergrund-Sättigung"),
  tint: l("Tint", "Teinte", "Tönung"),
  border: l("Border opacity", "Opacité de la bordure", "Deckkraft des Rahmens"),
  radius: l("Corner radius", "Arrondi", "Eckenradius"),
  shadow: l("Shadow opacity", "Opacité de l'ombre", "Deckkraft des Schattens"),
  background: l("Background", "Arrière-plan", "Hintergrund"),
  preview: l("Preview", "Aperçu", "Vorschau"),
  cardTitle: l("Glass card", "Carte en verre", "Glaskarte"),
  cardText: l(
    "Translucent, blurred and a little more saturated than what lies behind it.",
    "Translucide, floutée et un peu plus saturée que ce qu'il y a derrière.",
    "Durchscheinend, weichgezeichnet und etwas satter als das, was dahinter liegt.",
  ),
  css: l("CSS", "CSS", "CSS"),
  tailwind: l("Tailwind", "Tailwind", "Tailwind"),
  note: l(
    "backdrop-filter only blurs what is behind the element: put the card over an image or a colorful background.",
    "backdrop-filter ne floute que ce qui est derrière l'élément : place la carte sur une image ou un fond coloré.",
    "backdrop-filter zeichnet nur weich, was hinter dem Element liegt: Leg die Karte über ein Bild oder einen bunten Hintergrund.",
  ),
};

export default function Glassmorphism() {
  const raw = useToolState<Glass>("glass", DEFAULT);
  const g = useComputed(() => cleanGlass(raw.value)).value;
  const set = (p: Partial<Glass>) => {
    raw.value = { ...g, ...p };
  };

  return (
    <>
      <Panel title={tr(T.presets)}>
        <Presets label={tr(T.presets)} presets={PRESETS} onPick={(p) => set(p.g)} />
      </Panel>
      <div class="design-split">
        <Panel title={tr(T.settings)}>
          <Slider
            label={tr(T.blur)}
            value={g.blur}
            min={0}
            max={64}
            suffix="px"
            onChange={(blur) => set({ blur })}
          />
          <Slider
            label={tr(T.alpha)}
            value={g.alpha}
            min={0}
            max={1}
            step={0.01}
            onChange={(alpha) => set({ alpha })}
          />
          <Slider
            label={tr(T.saturation)}
            value={g.saturation}
            min={0}
            max={400}
            step={5}
            suffix="%"
            onChange={(saturation) => set({ saturation })}
          />
          <ColorField label={tr(T.tint)} value={g.tint} onInput={(tint) => set({ tint })} />
          <Slider
            label={tr(T.border)}
            value={g.border}
            min={0}
            max={1}
            step={0.01}
            onChange={(border) => set({ border })}
          />
          <Slider
            label={tr(T.radius)}
            value={g.radius}
            min={0}
            max={100}
            suffix="px"
            onChange={(radius) => set({ radius })}
          />
          <Slider
            label={tr(T.shadow)}
            value={g.shadow}
            min={0}
            max={1}
            step={0.01}
            onChange={(shadow) => set({ shadow })}
          />
        </Panel>

        <div class="stack design-sticky">
          <Panel title={tr(T.preview)}>
            <Segmented<BgId>
              label={tr(T.background)}
              value={g.bg as BgId}
              options={BACKGROUNDS.map((b) => ({ value: b.id, label: tr(b.name) }))}
              onChange={(bg) => set({ bg })}
            />
            <div class="glassmorphism-stage" style={{ backgroundImage: background(g.bg).css }}>
              <span class="glassmorphism-orb a" aria-hidden="true" />
              <span class="glassmorphism-orb b" aria-hidden="true" />
              <div
                class="glassmorphism-card"
                style={{ ...declsToStyle(glassDecls(g)), color: cardInk(g) }}
              >
                <strong>{tr(T.cardTitle)}</strong>
                <span>{tr(T.cardText)}</span>
              </div>
            </div>
            <p class="muted small">{tr(T.note)}</p>
          </Panel>
          <Code label={tr(T.css)} code={glassCss(g)} />
          <Output label={tr(T.tailwind)} value={glassTailwind(g)} />
        </div>
      </div>
    </>
  );
}
