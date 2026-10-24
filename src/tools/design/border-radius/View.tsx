import { useComputed } from "@preact/signals";
import { useRef, useState } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { Button, Field, Output, Panel, Segmented, Toggle } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { cssColor } from "../_shared";
import { Code, ColorField, Presets, Slider } from "../_ui";
import {
  cleanRadius,
  DEFAULT,
  fromHandles,
  type Handles,
  MAX,
  PRESETS,
  parseRadius,
  type Quad,
  type Radius,
  radiusCss,
  radiusTailwind,
  radiusValue,
  randomBlob,
  sameQuad,
  toHandles,
  type Unit,
} from "./logic";

const T = {
  presets: l("Presets", "Préréglages", "Voreinstellungen"),
  random: l("Random blob", "Blob au hasard", "Zufälliger Blob"),
  corners: l("Corners", "Coins", "Ecken"),
  unit: l("Unit", "Unité", "Einheit"),
  linked: l(
    "Same radius on every corner",
    "Même rayon pour tous les coins",
    "Gleicher Radius für alle Ecken",
  ),
  elliptic: l(
    "Elliptical corners (8 values: horizontal / vertical)",
    "Coins elliptiques (8 valeurs : horizontal / vertical)",
    "Elliptische Ecken (8 Werte: horizontal / vertikal)",
  ),
  all: l("All corners", "Tous les coins", "Alle Ecken"),
  tl: l("Top left", "Haut gauche", "Oben links"),
  tr: l("Top right", "Haut droite", "Oben rechts"),
  br: l("Bottom right", "Bas droite", "Unten rechts"),
  bl: l("Bottom left", "Bas gauche", "Unten links"),
  horiz: l("horizontal", "horizontal", "horizontal"),
  vert: l("vertical", "vertical", "vertikal"),
  paste: l(
    "Paste a border-radius value",
    "Coller une valeur border-radius",
    "border-radius-Wert einfügen",
  ),
  pasteBad: l(
    "Not an editable border-radius (one unit, % or px, 1 to 4 values per side of the /).",
    "Valeur border-radius non modifiable (une seule unité, % ou px, 1 à 4 valeurs de chaque côté du /).",
    "Kein bearbeitbarer border-radius (eine Einheit, % oder px, 1 bis 4 Werte pro Seite des /).",
  ),
  preview: l("Preview", "Aperçu", "Vorschau"),
  handles: l(
    "Drag the four handles on the edges to shape a blob (percent mode).",
    "Fais glisser les quatre poignées sur les bords pour modeler un blob (mode pourcentage).",
    "Zieh die vier Griffe an den Rändern, um einen Blob zu formen (Prozentmodus).",
  ),
  handle: l("Edge handle", "Poignée de bord", "Randgriff"),
  top: l("top", "haut", "oben"),
  right: l("right", "droite", "rechts"),
  bottom: l("bottom", "bas", "unten"),
  left: l("left", "gauche", "links"),
  width: l("Width", "Largeur", "Breite"),
  height: l("Height", "Hauteur", "Höhe"),
  fill: l("Fill", "Remplissage", "Füllung"),
  css: l("CSS", "CSS", "CSS"),
  tailwind: l("Tailwind", "Tailwind", "Tailwind"),
};

const CORNERS = [T.tl, T.tr, T.br, T.bl];
type Edge = keyof Handles;
const EDGES: { id: Edge; label: ReturnType<typeof l> }[] = [
  { id: "top", label: T.top },
  { id: "right", label: T.right },
  { id: "bottom", label: T.bottom },
  { id: "left", label: T.left },
];

export default function BorderRadius() {
  const raw = useToolState<Radius>("radius", DEFAULT);
  const elliptic = useToolState("elliptic", true);
  const linked = useToolState("linked", false);
  const w = useToolState("w", 260);
  const h = useToolState("h", 260);
  const fill = useToolState("fill", "#0f766e");
  const [paste, setPaste] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef<Edge | null>(null);

  const r = useComputed(() => cleanRadius(raw.value)).value;
  const max = MAX[r.unit];
  const set = (next: Radius) => {
    raw.value = next;
  };
  const setCorner = (axis: "h" | "v" | "both", i: number, n: number) => {
    const upd = (q: Quad) => q.map((x, k) => (k === i ? n : x)) as Quad;
    set({
      ...r,
      h: axis === "v" ? r.h : upd(r.h),
      v: axis === "h" ? r.v : upd(axis === "both" ? r.h : r.v),
    });
  };
  const pasted = paste.trim() ? parseRadius(paste) : null;
  const handles = toHandles(r);
  const showHandles = r.unit === "%" && elliptic.value && !linked.value;

  const moveHandle = (edge: Edge, e: PointerEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    const pos = edge === "top" || edge === "bottom" ? px : py;
    set(fromHandles({ ...handles, [edge]: pos }));
  };

  return (
    <>
      <Panel
        title={tr(T.presets)}
        actions={
          <Button
            size="sm"
            icon="refresh"
            onClick={() => {
              set(randomBlob());
              elliptic.value = true;
              linked.value = false;
            }}
          >
            {tr(T.random)}
          </Button>
        }
      >
        <Presets
          label={tr(T.presets)}
          presets={PRESETS}
          thumb={(p) => ({ borderRadius: radiusValue(p.r) })}
          onPick={(p) => {
            set(p.r);
            elliptic.value = !sameQuad(p.r.h, p.r.v);
            linked.value = false;
          }}
        />
      </Panel>

      <div class="design-split">
        <div class="stack">
          <Panel title={tr(T.corners)}>
            <div class="row">
              <Segmented<Unit>
                label={tr(T.unit)}
                value={r.unit}
                options={[
                  { value: "%", label: "%" },
                  { value: "px", label: "px" },
                ]}
                onChange={(unit) => {
                  if (unit === r.unit) return;
                  const k = unit === "px" ? 2 : 0.5;
                  const conv = (q: Quad) =>
                    q.map((x) => Math.min(MAX[unit], Math.round(x * k))) as Quad;
                  set({ unit, h: conv(r.h), v: conv(r.v) });
                }}
              />
            </div>
            <Toggle
              label={tr(T.linked)}
              checked={linked.value}
              onChange={(v) => {
                linked.value = v;
                if (v) {
                  const n = r.h[0];
                  set({ ...r, h: [n, n, n, n], v: [n, n, n, n] });
                }
              }}
            />
            {!linked.value && (
              <Toggle
                label={tr(T.elliptic)}
                checked={elliptic.value}
                onChange={(v) => {
                  elliptic.value = v;
                  if (!v) set({ ...r, v: [...r.h] as Quad });
                }}
              />
            )}
            {linked.value ? (
              <Slider
                label={tr(T.all)}
                value={r.h[0]}
                min={0}
                max={max}
                suffix={r.unit}
                onChange={(n) => set({ ...r, h: [n, n, n, n], v: [n, n, n, n] })}
              />
            ) : (
              CORNERS.map((c, i) =>
                elliptic.value ? (
                  <div key={c.en} class="border-radius-pair">
                    <Slider
                      label={`${tr(c)} · ${tr(T.horiz)}`}
                      value={r.h[i] as number}
                      min={0}
                      max={max}
                      suffix={r.unit}
                      onChange={(n) => setCorner("h", i, n)}
                    />
                    <Slider
                      label={`${tr(c)} · ${tr(T.vert)}`}
                      value={r.v[i] as number}
                      min={0}
                      max={max}
                      suffix={r.unit}
                      onChange={(n) => setCorner("v", i, n)}
                    />
                  </div>
                ) : (
                  <Slider
                    key={c.en}
                    label={tr(c)}
                    value={r.h[i] as number}
                    min={0}
                    max={max}
                    suffix={r.unit}
                    onChange={(n) => setCorner("both", i, n)}
                  />
                ),
              )
            )}
            <Field label={tr(T.paste)}>
              <input
                class="input mono"
                value={paste}
                placeholder="30% 70% 70% 30% / 30% 30% 70% 70%"
                aria-invalid={!!paste.trim() && !pasted}
                spellcheck={false}
                autocomplete="off"
                onInput={(e) => {
                  const v = (e.currentTarget as HTMLInputElement).value;
                  setPaste(v);
                  const p = v.trim() ? parseRadius(v) : null;
                  if (p) {
                    set(p);
                    elliptic.value = !sameQuad(p.h, p.v);
                    linked.value = false;
                  }
                }}
              />
            </Field>
            {paste.trim() && !pasted && <p class="error-note">{tr(T.pasteBad)}</p>}
          </Panel>
        </div>

        <div class="stack design-sticky">
          <Panel title={tr(T.preview)}>
            <div class="border-radius-stage">
              <div
                ref={box}
                class="border-radius-box"
                style={{
                  width: `${w.value}px`,
                  height: `${h.value}px`,
                }}
              >
                <div
                  class="border-radius-shape"
                  style={{ borderRadius: radiusValue(r), background: cssColor(fill.value) }}
                />
                {showHandles &&
                  EDGES.map(({ id, label }) => {
                    const pos = handles[id];
                    const style =
                      id === "top"
                        ? { left: `${pos}%`, top: "0%" }
                        : id === "bottom"
                          ? { left: `${pos}%`, top: "100%" }
                          : id === "left"
                            ? { left: "0%", top: `${pos}%` }
                            : { left: "100%", top: `${pos}%` };
                    return (
                      <button
                        key={id}
                        type="button"
                        class="border-radius-handle"
                        style={style}
                        aria-label={`${tr(T.handle)} (${tr(label)}): ${pos}%`}
                        onPointerDown={(e) => {
                          dragging.current = id;
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        }}
                        onPointerMove={(e) => {
                          if (dragging.current === id) moveHandle(id, e);
                        }}
                        onPointerUp={() => {
                          dragging.current = null;
                        }}
                        onKeyDown={(e) => {
                          const horiz = id === "top" || id === "bottom";
                          const d =
                            e.key === (horiz ? "ArrowLeft" : "ArrowUp")
                              ? -1
                              : e.key === (horiz ? "ArrowRight" : "ArrowDown")
                                ? 1
                                : 0;
                          if (!d) return;
                          e.preventDefault();
                          set(fromHandles({ ...handles, [id]: pos + d * (e.shiftKey ? 10 : 1) }));
                        }}
                      />
                    );
                  })}
              </div>
            </div>
            {showHandles && <p class="muted small">{tr(T.handles)}</p>}
            <div class="grid-2">
              <Slider
                label={tr(T.width)}
                value={w.value}
                min={60}
                max={400}
                suffix="px"
                onChange={(v) => {
                  w.value = v;
                }}
              />
              <Slider
                label={tr(T.height)}
                value={h.value}
                min={60}
                max={400}
                suffix="px"
                onChange={(v) => {
                  h.value = v;
                }}
              />
            </div>
            <ColorField
              label={tr(T.fill)}
              value={fill.value}
              onInput={(v) => {
                fill.value = v;
              }}
            />
          </Panel>
          <Code label={tr(T.css)} code={radiusCss(r)} />
          <Output label={tr(T.tailwind)} value={radiusTailwind(r)} />
        </div>
      </div>
    </>
  );
}
