import { useComputed } from "@preact/signals";
import { useRef, useState } from "preact/hooks";
import { NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, Output, Panel, Segmented } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { num } from "../_shared";
import { Code, Presets, Slider } from "../_ui";
import {
  type Clip,
  cleanClip,
  clipCss,
  clipTailwind,
  clipValue,
  DEFAULT,
  insertPoint,
  type Kind,
  PRESETS,
  type Pt,
  regularPolygon,
  splitLongestEdge,
  star,
} from "./logic";

const T = {
  shapes: l("Shapes", "Formes", "Formen"),
  kind: l("Shape type", "Type de forme", "Formtyp"),
  polygon: l("Polygon", "Polygone", "Polygon"),
  circle: l("Circle", "Cercle", "Kreis"),
  ellipse: l("Ellipse", "Ellipse", "Ellipse"),
  inset: l("Inset", "Retrait", "Inset"),
  editor: l("Editor", "Éditeur", "Editor"),
  hint: l(
    "Drag the points. Click the picture to add a point on the nearest edge. Focus a point to move it with the arrow keys or remove it with Delete.",
    "Fais glisser les points. Clique sur l'image pour ajouter un point sur le bord le plus proche. Sélectionne un point pour le déplacer avec les flèches ou le supprimer avec Suppr.",
    "Zieh die Punkte. Klick auf das Bild, um einen Punkt an der nächsten Kante hinzuzufügen. Wähl einen Punkt aus, um ihn mit den Pfeiltasten zu verschieben oder mit Entf zu löschen.",
  ),
  point: l("Point", "Point", "Punkt"),
  add: l("Add a point", "Ajouter un point", "Punkt hinzufügen"),
  remove: l("Remove the point", "Supprimer le point", "Punkt entfernen"),
  sides: l("Regular polygon", "Polygone régulier", "Regelmäßiges Polygon"),
  sidesN: l("Sides", "Côtés", "Seiten"),
  starN: l("Star branches", "Branches de l'étoile", "Sternzacken"),
  make: l("Make", "Créer", "Erstellen"),
  radius: l("Radius", "Rayon", "Radius"),
  rx: l("Horizontal radius", "Rayon horizontal", "Horizontaler Radius"),
  ry: l("Vertical radius", "Rayon vertical", "Vertikaler Radius"),
  cx: l("Center X", "Centre X", "Mitte X"),
  cy: l("Center Y", "Centre Y", "Mitte Y"),
  top: l("Top", "Haut", "Oben"),
  right: l("Right", "Droite", "Rechts"),
  bottom: l("Bottom", "Bas", "Unten"),
  left: l("Left", "Gauche", "Links"),
  round: l("Corner radius", "Arrondi des coins", "Eckenradius"),
  preview: l("Preview", "Aperçu", "Vorschau"),
  css: l("CSS", "CSS", "CSS"),
  tailwind: l("Tailwind", "Tailwind", "Tailwind"),
};

export default function ClipPath() {
  const raw = useToolState<Clip>("clip", DEFAULT);
  const sides = useToolState("sides", 6);
  const [sel, setSel] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  /** A drag ends with a click on the stage: ignore it. */
  const quietUntil = useRef(0);

  const c = useComputed(() => cleanClip(raw.value)).value;
  const set = (p: Partial<Clip>) => {
    raw.value = { ...c, ...p };
  };
  const pts = c.points;
  const i = Math.min(sel, pts.length - 1);
  const cur = pts[i];
  const setPt = (k: number, p: Pt) =>
    set({
      points: pts.map((q, n) => (n === k ? [Math.round(p[0]), Math.round(p[1])] : q)) as Pt[],
    });
  const removePt = (k: number) => {
    if (pts.length <= 3) return;
    set({ points: pts.filter((_, n) => n !== k) });
    setSel(Math.max(0, k - 1));
  };
  const toPct = (e: PointerEvent | MouseEvent): Pt | null => {
    const r = stage.current?.getBoundingClientRect();
    if (!r?.width || !r.height) return null;
    const k = (v: number) => Math.min(100, Math.max(0, Math.round(v)));
    return [k(((e.clientX - r.left) / r.width) * 100), k(((e.clientY - r.top) / r.height) * 100)];
  };

  const value = clipValue(c);

  return (
    <>
      <Panel title={tr(T.shapes)}>
        <Presets
          label={tr(T.shapes)}
          presets={PRESETS}
          thumb={(p) => ({ clipPath: clipValue({ ...c, kind: "polygon", points: p.points }) })}
          onPick={(p) => {
            set({ kind: "polygon", points: p.points });
            setSel(0);
          }}
        />
      </Panel>

      <div class="design-split">
        <div class="stack">
          <Panel title={tr(T.editor)}>
            <Segmented<Kind>
              label={tr(T.kind)}
              value={c.kind}
              options={[
                { value: "polygon", label: tr(T.polygon) },
                { value: "circle", label: tr(T.circle) },
                { value: "ellipse", label: tr(T.ellipse) },
                { value: "inset", label: tr(T.inset) },
              ]}
              onChange={(kind) => set({ kind })}
            />

            {c.kind === "polygon" && (
              <>
                <p class="muted small">{tr(T.hint)}</p>
                {cur && (
                  <div class="clip-path-point">
                    <span class="field-label">
                      {tr(T.point)} {i + 1}/{pts.length}
                    </span>
                    <NumberField
                      label="X"
                      value={cur[0]}
                      min={0}
                      max={100}
                      suffix="%"
                      onChange={(x) => setPt(i, [x, cur[1]])}
                    />
                    <NumberField
                      label="Y"
                      value={cur[1]}
                      min={0}
                      max={100}
                      suffix="%"
                      onChange={(y) => setPt(i, [cur[0], y])}
                    />
                  </div>
                )}
                <div class="row">
                  <Button
                    size="sm"
                    icon="plus"
                    disabled={pts.length >= 64}
                    onClick={() => {
                      const r = splitLongestEdge(pts);
                      set({ points: r.points });
                      setSel(r.index);
                    }}
                  >
                    {tr(T.add)}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="trash"
                    disabled={pts.length <= 3}
                    onClick={() => removePt(i)}
                  >
                    {tr(T.remove)}
                  </Button>
                </div>
                <div class="clip-path-make">
                  <NumberField
                    label={tr(T.sidesN)}
                    value={sides.value}
                    min={3}
                    max={32}
                    integer
                    onChange={(v) => {
                      sides.value = v;
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      set({ points: regularPolygon(sides.value) });
                      setSel(0);
                    }}
                  >
                    {tr(T.sides)}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      set({ points: star(sides.value, 0.45) });
                      setSel(0);
                    }}
                  >
                    {tr(T.starN)}
                  </Button>
                </div>
              </>
            )}

            {c.kind === "circle" && (
              <Slider
                label={tr(T.radius)}
                value={c.r}
                min={0}
                max={100}
                suffix="%"
                onChange={(r) => set({ r })}
              />
            )}
            {c.kind === "ellipse" && (
              <>
                <Slider
                  label={tr(T.rx)}
                  value={c.rx}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(rx) => set({ rx })}
                />
                <Slider
                  label={tr(T.ry)}
                  value={c.ry}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(ry) => set({ ry })}
                />
              </>
            )}
            {(c.kind === "circle" || c.kind === "ellipse") && (
              <>
                <Slider
                  label={tr(T.cx)}
                  value={c.cx}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(cx) => set({ cx })}
                />
                <Slider
                  label={tr(T.cy)}
                  value={c.cy}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(cy) => set({ cy })}
                />
              </>
            )}
            {c.kind === "inset" && (
              <>
                {[T.top, T.right, T.bottom, T.left].map((label, k) => (
                  <Slider
                    key={label.en}
                    label={tr(label)}
                    value={c.inset[k] as number}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) =>
                      set({ inset: c.inset.map((x, n) => (n === k ? v : x)) as Clip["inset"] })
                    }
                  />
                ))}
                <Slider
                  label={tr(T.round)}
                  value={c.round}
                  min={0}
                  max={200}
                  suffix="px"
                  onChange={(round) => set({ round })}
                />
              </>
            )}
          </Panel>
        </div>

        <div class="stack design-sticky">
          <Panel title={tr(T.preview)}>
            {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut; "Add a point" is the keyboard path */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: "Add a point" is the keyboard path */}
            <div
              ref={stage}
              class="clip-path-stage"
              onClick={(e) => {
                if (c.kind !== "polygon" || pts.length >= 64) return;
                if (e.timeStamp < quietUntil.current) return;
                if ((e.target as Element).closest(".clip-path-handle")) return;
                const p = toPct(e);
                if (!p) return;
                const r = insertPoint(pts, p);
                set({ points: r.points });
                setSel(r.index);
              }}
              onPointerMove={(e) => {
                if (drag.current === null) return;
                const p = toPct(e);
                if (p) setPt(drag.current, p);
              }}
              onPointerUp={(e) => {
                if (drag.current !== null) quietUntil.current = e.timeStamp + 250;
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              <div class="clip-path-sample ghost" />
              <div class="clip-path-sample" style={{ clipPath: value }} />
              {c.kind === "polygon" && (
                <svg
                  class="clip-path-overlay"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <polygon points={pts.map((p) => p.join(",")).join(" ")} />
                </svg>
              )}
              {c.kind === "polygon" &&
                pts.map((p, k) => (
                  <button
                    key={k}
                    type="button"
                    class={`clip-path-handle ${k === i ? "on" : ""}`}
                    style={{ left: `${p[0]}%`, top: `${p[1]}%` }}
                    aria-label={`${tr(T.point)} ${k + 1}: ${num(p[0])}% ${num(p[1])}%`}
                    onFocus={() => setSel(k)}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setSel(k);
                      drag.current = k;
                      stage.current?.setPointerCapture(e.pointerId);
                    }}
                    onKeyDown={(e) => {
                      const s = e.shiftKey ? 10 : 1;
                      const dx = e.key === "ArrowLeft" ? -s : e.key === "ArrowRight" ? s : 0;
                      const dy = e.key === "ArrowUp" ? -s : e.key === "ArrowDown" ? s : 0;
                      if (dx || dy) {
                        e.preventDefault();
                        setPt(k, [
                          Math.min(100, Math.max(0, p[0] + dx)),
                          Math.min(100, Math.max(0, p[1] + dy)),
                        ]);
                      } else if (e.key === "Delete" || e.key === "Backspace") {
                        e.preventDefault();
                        removePt(k);
                      }
                    }}
                  >
                    <span>{k + 1}</span>
                  </button>
                ))}
            </div>
          </Panel>
          <Code label={tr(T.css)} code={clipCss(c)} />
          <Output label={tr(T.tailwind)} value={clipTailwind(c)} />
        </div>
      </div>
    </>
  );
}
