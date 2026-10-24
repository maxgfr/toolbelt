import { useComputed } from "@preact/signals";
import { useRef, useState } from "preact/hooks";
import { Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, IconButton, Output, Panel, Segmented, Toggle } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { cssColor, parseColor } from "../_shared";
import { Code, ColorField, Presets, Slider } from "../_ui";
import {
  cleanGradient,
  colorAt,
  DEFAULT,
  fromPreset,
  type Gradient,
  type GradientType,
  gradientCss,
  gradientTailwind,
  gradientValue,
  type HueMethod,
  newStopPosition,
  PRESETS,
  type Shape,
  type Space,
  type Stop,
} from "./logic";

const T = {
  presets: l("Presets", "Préréglages", "Voreinstellungen"),
  settings: l("Gradient", "Dégradé", "Farbverlauf"),
  type: l("Type", "Type", "Typ"),
  linear: l("Linear", "Linéaire", "Linear"),
  radial: l("Radial", "Radial", "Radial"),
  conic: l("Conic", "Conique", "Konisch"),
  angle: l("Angle", "Angle", "Winkel"),
  from: l("Start angle", "Angle de départ", "Startwinkel"),
  shape: l("Shape", "Forme", "Form"),
  ellipse: l("Ellipse", "Ellipse", "Ellipse"),
  circle: l("Circle", "Cercle", "Kreis"),
  x: l("Center X", "Centre X", "Mitte X"),
  y: l("Center Y", "Centre Y", "Mitte Y"),
  repeating: l("Repeating", "Répété", "Wiederholend"),
  space: l("Interpolation", "Interpolation", "Interpolation"),
  spaceDefault: l(
    "Default (sRGB, not written)",
    "Par défaut (sRGB, non écrit)",
    "Standard (sRGB, nicht ausgegeben)",
  ),
  spaceHint: l(
    "OKLCH and OKLab avoid the grey dead zone between saturated colors.",
    "OKLCH et OKLab évitent la zone grise entre deux couleurs saturées.",
    "OKLCH und OKLab vermeiden die graue Zone zwischen gesättigten Farben.",
  ),
  hue: l("Hue path", "Chemin de teinte", "Farbtonweg"),
  shorter: l("Shorter", "Le plus court", "Kürzer"),
  longer: l("Longer (rainbow)", "Le plus long (arc-en-ciel)", "Länger (Regenbogen)"),
  stops: l("Color stops", "Arrêts de couleur", "Farbstopps"),
  stopsHint: l(
    "Drag the markers, use the arrow keys on them, or click the bar to add a stop.",
    "Fais glisser les repères, utilise les flèches du clavier dessus, ou clique sur la barre pour ajouter un arrêt.",
    "Zieh die Markierungen, nutze darauf die Pfeiltasten oder klick auf die Leiste, um einen Stopp hinzuzufügen.",
  ),
  add: l("Add a stop", "Ajouter un arrêt", "Stopp hinzufügen"),
  remove: l("Remove this stop", "Supprimer cet arrêt", "Diesen Stopp entfernen"),
  stop: l("Stop", "Arrêt", "Stopp"),
  color: l("Color", "Couleur", "Farbe"),
  position: l("Position", "Position", "Position"),
  preview: l("Preview", "Aperçu", "Vorschau"),
  css: l("CSS", "CSS", "CSS"),
  tailwind: l("Tailwind", "Tailwind", "Tailwind"),
};

export default function GradientTool() {
  const raw = useToolState<Gradient>("gradient", DEFAULT);
  const [sel, setSel] = useState(0);
  const bar = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);

  const g = useComputed(() => cleanGradient(raw.value)).value;
  const set = (p: Partial<Gradient>) => {
    raw.value = { ...g, ...p };
  };
  const setStop = (i: number, p: Partial<Stop>) =>
    set({ stops: g.stops.map((s, k) => (k === i ? { ...s, ...p } : s)) });
  const addStop = (pos: number) => {
    set({ stops: [...g.stops, { color: colorAt(g.stops, pos), pos }] });
    setSel(g.stops.length);
  };
  const posFromEvent = (e: PointerEvent | MouseEvent) => {
    const r = bar.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
  };

  const i = Math.min(sel, g.stops.length - 1);
  const cur = g.stops[i];
  const barStops = [...g.stops].sort((a, b) => a.pos - b.pos);
  const barCss = `linear-gradient(90deg${g.space ? ` in ${g.space}` : ""}, ${barStops
    .map((s) => `${cssColor(parseColor(s.color) ? s.color : "#000")} ${s.pos}%`)
    .join(", ")})`;
  const polar = g.space === "oklch" || g.space === "hsl";

  return (
    <>
      <Panel title={tr(T.presets)}>
        <Presets
          label={tr(T.presets)}
          presets={PRESETS}
          thumb={(p) => ({ backgroundImage: gradientValue(fromPreset(p)) })}
          onPick={(p) => {
            raw.value = fromPreset(p);
            setSel(0);
          }}
        />
      </Panel>

      <div class="design-split">
        <div class="stack">
          <Panel title={tr(T.settings)}>
            <Segmented<GradientType>
              label={tr(T.type)}
              value={g.type}
              options={[
                { value: "linear", label: tr(T.linear) },
                { value: "radial", label: tr(T.radial) },
                { value: "conic", label: tr(T.conic) },
              ]}
              onChange={(type) => set({ type })}
            />
            {g.type !== "radial" && (
              <Slider
                label={tr(g.type === "conic" ? T.from : T.angle)}
                value={g.angle}
                min={0}
                max={360}
                suffix="°"
                onChange={(angle) => set({ angle })}
              />
            )}
            {g.type === "radial" && (
              <Select<Shape>
                label={tr(T.shape)}
                value={g.shape}
                options={[
                  { value: "ellipse", label: tr(T.ellipse) },
                  { value: "circle", label: tr(T.circle) },
                ]}
                onChange={(shape) => set({ shape })}
              />
            )}
            {g.type !== "linear" && (
              <>
                <Slider
                  label={tr(T.x)}
                  value={g.x}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(x) => set({ x })}
                />
                <Slider
                  label={tr(T.y)}
                  value={g.y}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(y) => set({ y })}
                />
              </>
            )}
            <div class="grid-2">
              <Select<Space>
                label={tr(T.space)}
                value={g.space}
                hint={tr(T.spaceHint)}
                options={[
                  { value: "", label: tr(T.spaceDefault) },
                  { value: "oklch", label: "OKLCH" },
                  { value: "oklab", label: "OKLab" },
                  { value: "srgb", label: "sRGB" },
                  { value: "hsl", label: "HSL" },
                ]}
                onChange={(space) => set({ space })}
              />
              {polar && (
                <Select<HueMethod>
                  label={tr(T.hue)}
                  value={g.hue}
                  options={[
                    { value: "shorter", label: tr(T.shorter) },
                    { value: "longer", label: tr(T.longer) },
                  ]}
                  onChange={(hue) => set({ hue })}
                />
              )}
            </div>
            <Toggle
              label={tr(T.repeating)}
              checked={g.repeating}
              onChange={(repeating) => set({ repeating })}
            />
          </Panel>

          <Panel
            title={tr(T.stops)}
            actions={
              <Button
                size="sm"
                icon="plus"
                disabled={g.stops.length >= 16}
                onClick={() => addStop(newStopPosition(g.stops))}
              >
                {tr(T.add)}
              </Button>
            }
          >
            <div class="gradient-bar-wrap">
              {/* biome-ignore lint/a11y/noStaticElementInteractions: a pointer shortcut; the Add button does the same */}
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: the Add button is the keyboard path */}
              <div
                ref={bar}
                class="gradient-bar"
                style={{ backgroundImage: barCss }}
                onClick={(e) => {
                  if (e.target === bar.current && g.stops.length < 16) addStop(posFromEvent(e));
                }}
              />
              {g.stops.map((s, k) => (
                <button
                  key={k}
                  type="button"
                  class={`gradient-marker ${k === i ? "on" : ""}`}
                  style={{
                    left: `calc(9px + (100% - 18px) * ${s.pos / 100})`,
                    background: cssColor(parseColor(s.color) ? s.color : "#000"),
                  }}
                  aria-label={`${tr(T.stop)} ${k + 1}: ${s.pos}%`}
                  onPointerDown={(e) => {
                    setSel(k);
                    drag.current = k;
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (drag.current === k) setStop(k, { pos: posFromEvent(e) });
                  }}
                  onPointerUp={() => {
                    drag.current = null;
                  }}
                  onKeyDown={(e) => {
                    const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
                    if (d) {
                      e.preventDefault();
                      setStop(k, {
                        pos: Math.min(100, Math.max(0, s.pos + d * (e.shiftKey ? 10 : 1))),
                      });
                    } else if (
                      (e.key === "Delete" || e.key === "Backspace") &&
                      g.stops.length > 2
                    ) {
                      set({ stops: g.stops.filter((_, n) => n !== k) });
                      setSel(0);
                    }
                  }}
                  onFocus={() => setSel(k)}
                />
              ))}
            </div>
            <p class="muted small">{tr(T.stopsHint)}</p>
            {cur && (
              <div class="gradient-stop">
                <ColorField
                  label={`${tr(T.color)} (${tr(T.stop)} ${i + 1})`}
                  value={cur.color}
                  onInput={(color) => setStop(i, { color })}
                />
                <Slider
                  label={tr(T.position)}
                  value={cur.pos}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(pos) => setStop(i, { pos })}
                />
                <IconButton
                  icon="trash"
                  label={tr(T.remove)}
                  disabled={g.stops.length <= 2}
                  onClick={() => {
                    set({ stops: g.stops.filter((_, n) => n !== i) });
                    setSel(Math.max(0, i - 1));
                  }}
                />
              </div>
            )}
          </Panel>
        </div>

        <div class="stack design-sticky">
          <Panel title={tr(T.preview)}>
            <div class="gradient-preview" style={{ backgroundImage: gradientValue(g) }} />
          </Panel>
          <Code label={tr(T.css)} code={gradientCss(g)} />
          <Output label={tr(T.tailwind)} value={gradientTailwind(g)} />
        </div>
      </div>
    </>
  );
}
