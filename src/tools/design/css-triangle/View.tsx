import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Output, Panel } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { declsToStyle } from "../_shared";
import { Code, ColorField, Slider } from "../_ui";
import {
  borderCss,
  borderDecls,
  borderTailwind,
  cleanTriangle,
  clipCss,
  clipDecls,
  clipTailwind,
  DEFAULT,
  type Direction,
  equilateral,
  type Triangle,
} from "./logic";

const T = {
  settings: l("Triangle", "Triangle", "Dreieck"),
  direction: l("Direction", "Direction", "Richtung"),
  width: l("Width", "Largeur", "Breite"),
  height: l("Height", "Hauteur", "Höhe"),
  color: l("Color", "Couleur", "Farbe"),
  equilateral: l("Make it equilateral", "Le rendre équilatéral", "Gleichseitig machen"),
  preview: l("Preview", "Aperçu", "Vorschau"),
  border: l("Border technique", "Technique des bordures", "Border-Technik"),
  borderHint: l(
    "Works everywhere, even in old browsers; the box itself has no size, so it cannot have a shadow or a gradient.",
    "Fonctionne partout, même dans les vieux navigateurs ; la boîte n'a pas de taille, donc ni ombre ni dégradé.",
    "Funktioniert überall, auch in alten Browsern; die Box selbst hat keine Größe, kann also weder Schatten noch Farbverlauf haben.",
  ),
  clip: l("clip-path alternative", "Alternative clip-path", "Alternative mit clip-path"),
  clipHint: l(
    "A real box cut to shape: it can take a gradient, an image or a transition.",
    "Une vraie boîte découpée : elle accepte un dégradé, une image ou une transition.",
    "Eine echte, zugeschnittene Box: Sie kann einen Farbverlauf, ein Bild oder eine Transition haben.",
  ),
  css: l("CSS", "CSS", "CSS"),
  tailwind: l("Tailwind", "Tailwind", "Tailwind"),
};

const DIRS: { dir: Direction | null; label: ReturnType<typeof l>; arrow: string }[] = [
  { dir: "up-left", label: l("Up left", "Haut gauche", "Oben links"), arrow: "◤" },
  { dir: "up", label: l("Up", "Haut", "Oben"), arrow: "▲" },
  { dir: "up-right", label: l("Up right", "Haut droite", "Oben rechts"), arrow: "◥" },
  { dir: "left", label: l("Left", "Gauche", "Links"), arrow: "◀" },
  { dir: null, label: l("", "", ""), arrow: "" },
  { dir: "right", label: l("Right", "Droite", "Rechts"), arrow: "▶" },
  { dir: "down-left", label: l("Down left", "Bas gauche", "Unten links"), arrow: "◣" },
  { dir: "down", label: l("Down", "Bas", "Unten"), arrow: "▼" },
  { dir: "down-right", label: l("Down right", "Bas droite", "Unten rechts"), arrow: "◢" },
];

export default function CssTriangle() {
  const raw = useToolState<Triangle>("triangle", DEFAULT);
  const t = useComputed(() => cleanTriangle(raw.value)).value;
  const set = (p: Partial<Triangle>) => {
    raw.value = { ...t, ...p };
  };
  const vertical = t.dir === "up" || t.dir === "down";
  const horizontal = t.dir === "left" || t.dir === "right";

  return (
    <div class="design-split">
      <Panel title={tr(T.settings)}>
        <fieldset class="css-triangle-field">
          <legend class="field-label">{tr(T.direction)}</legend>
          <div class="css-triangle-dirs">
            {DIRS.map((d) =>
              d.dir ? (
                <button
                  key={d.dir}
                  type="button"
                  class={`css-triangle-dir ${d.dir === t.dir ? "on" : ""}`}
                  aria-pressed={d.dir === t.dir}
                  aria-label={tr(d.label)}
                  title={tr(d.label)}
                  onClick={() => set({ dir: d.dir as Direction })}
                >
                  {d.arrow}
                </button>
              ) : (
                <span key="center" />
              ),
            )}
          </div>
        </fieldset>
        <Slider
          label={tr(T.width)}
          value={t.w}
          min={1}
          max={400}
          suffix="px"
          onChange={(w) => set({ w })}
        />
        <Slider
          label={tr(T.height)}
          value={t.h}
          min={1}
          max={400}
          suffix="px"
          onChange={(h) => set({ h })}
        />
        {(vertical || horizontal) && (
          <div class="row">
            <Button
              size="sm"
              onClick={() =>
                vertical ? set({ h: equilateral(t.w) }) : set({ w: equilateral(t.h) })
              }
            >
              {tr(T.equilateral)}
            </Button>
          </div>
        )}
        <ColorField label={tr(T.color)} value={t.color} onInput={(color) => set({ color })} />
      </Panel>

      <div class="stack">
        <Panel title={tr(T.border)}>
          <div class="css-triangle-stage">
            <div style={declsToStyle(borderDecls(t))} />
          </div>
          <p class="muted small">{tr(T.borderHint)}</p>
          <Code label={tr(T.css)} code={borderCss(t)} />
          <Output label={tr(T.tailwind)} value={borderTailwind(t)} />
        </Panel>
        <Panel title={tr(T.clip)}>
          <div class="css-triangle-stage">
            <div style={declsToStyle(clipDecls(t))} />
          </div>
          <p class="muted small">{tr(T.clipHint)}</p>
          <Code label={tr(T.css)} code={clipCss(t)} />
          <Output label={tr(T.tailwind)} value={clipTailwind(t)} />
        </Panel>
      </div>
    </div>
  );
}
