import { useComputed } from "@preact/signals";
import { useState } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { Button, IconButton, Output, Panel, Segmented, Toggle } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { cssColor, move } from "../_shared";
import { Code, ColorField, Presets, Slider } from "../_ui";
import {
  cleanLayers,
  LIMITS,
  layerCss,
  newLayer,
  PRESETS,
  type ShadowLayer,
  shadowCss,
  shadowTailwind,
  shadowValue,
} from "./logic";

const T = {
  presets: l("Presets", "Préréglages", "Voreinstellungen"),
  layers: l("Layers", "Calques", "Ebenen"),
  layersHint: l(
    "The first layer is drawn on top of the others.",
    "Le premier calque est dessiné au-dessus des autres.",
    "Die erste Ebene liegt über den anderen.",
  ),
  layer: l("Layer", "Calque", "Ebene"),
  add: l("Add a layer", "Ajouter un calque", "Ebene hinzufügen"),
  up: l("Move up", "Monter", "Nach oben"),
  down: l("Move down", "Descendre", "Nach unten"),
  remove: l("Remove", "Supprimer", "Entfernen"),
  x: l("Horizontal offset", "Décalage horizontal", "Horizontaler Versatz"),
  y: l("Vertical offset", "Décalage vertical", "Vertikaler Versatz"),
  blur: l("Blur", "Flou", "Weichzeichnung"),
  spread: l("Spread", "Étalement", "Ausdehnung"),
  color: l("Color", "Couleur", "Farbe"),
  alpha: l("Opacity", "Opacité", "Deckkraft"),
  inset: l("Inset (inner shadow)", "Intérieure (inset)", "Inset (Innenschatten)"),
  none: l(
    "No layer: box-shadow is none.",
    "Aucun calque : box-shadow vaut none.",
    "Keine Ebene: box-shadow ist none.",
  ),
  preview: l("Preview", "Aperçu", "Vorschau"),
  light: l("Light", "Clair", "Hell"),
  dark: l("Dark", "Sombre", "Dunkel"),
  custom: l("Custom", "Personnalisé", "Eigene"),
  page: l("Page", "Page", "Seite"),
  box: l("Box", "Boîte", "Box"),
  radius: l("Corner radius", "Arrondi", "Eckenradius"),
  css: l("CSS", "CSS", "CSS"),
  tailwind: l("Tailwind", "Tailwind", "Tailwind"),
};

type Bg = "light" | "dark" | "custom";

export default function BoxShadow() {
  const raw = useToolState<ShadowLayer[]>("layers", PRESETS[0]?.layers ?? [newLayer()]);
  const bgMode = useToolState<Bg>("bg", "light");
  const pageColor = useToolState("page", "#e0e5ec");
  const boxColor = useToolState("box", "#ffffff");
  const radius = useToolState("radius", 16);
  const [sel, setSel] = useState(0);

  const layers = useComputed(() => cleanLayers(raw.value));
  const list = layers.value;
  const i = Math.min(sel, list.length - 1);
  const cur = list[i];

  const set = (next: ShadowLayer[]) => {
    raw.value = next;
  };
  const patch = (p: Partial<ShadowLayer>) =>
    set(list.map((l, k) => (k === i ? { ...l, ...p } : l)));

  const bg =
    bgMode.value === "light" ? "#f4f4f5" : bgMode.value === "dark" ? "#18181b" : pageColor.value;
  const box =
    bgMode.value === "dark" && boxColor.value === "#ffffff" ? "#27272a" : cssColor(boxColor.value);

  return (
    <>
      <Panel title={tr(T.presets)}>
        <Presets
          label={tr(T.presets)}
          presets={PRESETS}
          onPick={(p) => {
            set(p.layers);
            setSel(0);
            if (p.bg) {
              bgMode.value = "custom";
              pageColor.value = p.bg;
            }
            boxColor.value = p.box ?? "#ffffff";
          }}
        />
      </Panel>

      <div class="design-split">
        <div class="stack">
          <Panel
            title={tr(T.layers)}
            actions={
              <Button
                size="sm"
                icon="plus"
                onClick={() => {
                  set([...list, newLayer()]);
                  setSel(list.length);
                }}
                disabled={list.length >= 12}
              >
                {tr(T.add)}
              </Button>
            }
          >
            {list.length === 0 && <p class="muted small">{tr(T.none)}</p>}
            <ol class="box-shadow-layers">
              {list.map((l, k) => (
                <li key={k} class={k === i ? "on" : ""}>
                  <button
                    type="button"
                    class="box-shadow-pick"
                    aria-pressed={k === i}
                    onClick={() => setSel(k)}
                  >
                    <span
                      class="box-shadow-swatch"
                      style={{ background: cssColor(l.color, l.alpha) }}
                    />
                    <span class="mono small">{layerCss(l)}</span>
                  </button>
                  <IconButton
                    icon="back"
                    class="box-shadow-up"
                    label={tr(T.up)}
                    disabled={k === 0}
                    onClick={() => {
                      set(move(list, k, -1));
                      setSel(k - 1);
                    }}
                  />
                  <IconButton
                    icon="back"
                    class="box-shadow-down"
                    label={tr(T.down)}
                    disabled={k === list.length - 1}
                    onClick={() => {
                      set(move(list, k, 1));
                      setSel(k + 1);
                    }}
                  />
                  <IconButton
                    icon="trash"
                    label={tr(T.remove)}
                    onClick={() => {
                      set(list.filter((_, n) => n !== k));
                      if (sel >= k && sel > 0) setSel(sel - 1);
                    }}
                  />
                </li>
              ))}
            </ol>
            <p class="muted small">{tr(T.layersHint)}</p>
          </Panel>

          {cur && (
            <Panel title={`${tr(T.layer)} ${i + 1}`}>
              <Slider
                label={tr(T.x)}
                value={cur.x}
                min={-LIMITS.offset}
                max={LIMITS.offset}
                suffix="px"
                onChange={(x) => patch({ x })}
              />
              <Slider
                label={tr(T.y)}
                value={cur.y}
                min={-LIMITS.offset}
                max={LIMITS.offset}
                suffix="px"
                onChange={(y) => patch({ y })}
              />
              <Slider
                label={tr(T.blur)}
                value={cur.blur}
                min={0}
                max={LIMITS.blur}
                suffix="px"
                onChange={(blur) => patch({ blur })}
              />
              <Slider
                label={tr(T.spread)}
                value={cur.spread}
                min={-LIMITS.spread}
                max={LIMITS.spread}
                suffix="px"
                onChange={(spread) => patch({ spread })}
              />
              <ColorField
                label={tr(T.color)}
                value={cur.color}
                onInput={(color) => patch({ color })}
              />
              <Slider
                label={tr(T.alpha)}
                value={cur.alpha}
                min={0}
                max={1}
                step={0.01}
                onChange={(alpha) => patch({ alpha })}
              />
              <Toggle
                label={tr(T.inset)}
                checked={cur.inset}
                onChange={(inset) => patch({ inset })}
              />
            </Panel>
          )}
        </div>

        <div class="stack design-sticky">
          <Panel title={tr(T.preview)}>
            <Segmented<Bg>
              label={tr(T.preview)}
              value={bgMode.value}
              options={[
                { value: "light", label: tr(T.light) },
                { value: "dark", label: tr(T.dark) },
                { value: "custom", label: tr(T.custom) },
              ]}
              onChange={(v) => {
                bgMode.value = v;
              }}
            />
            <div class="box-shadow-stage" style={{ background: cssColor(bg) }}>
              <div
                class="box-shadow-box"
                style={{
                  background: box,
                  borderRadius: `${radius.value}px`,
                  boxShadow: shadowValue(list),
                }}
              />
            </div>
            <div class="grid-2">
              {bgMode.value === "custom" && (
                <ColorField
                  label={tr(T.page)}
                  value={pageColor.value}
                  onInput={(v) => {
                    pageColor.value = v;
                  }}
                />
              )}
              <ColorField
                label={tr(T.box)}
                value={boxColor.value}
                onInput={(v) => {
                  boxColor.value = v;
                }}
              />
            </div>
            <Slider
              label={tr(T.radius)}
              value={radius.value}
              min={0}
              max={100}
              suffix="px"
              onChange={(v) => {
                radius.value = v;
              }}
            />
          </Panel>
          <Code label={tr(T.css)} code={shadowCss(list)} />
          <Output label={tr(T.tailwind)} value={shadowTailwind(list)} />
        </div>
      </div>
    </>
  );
}
