import { useComputed } from "@preact/signals";
import { useRef, useState } from "preact/hooks";
import { NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, Field, Output, Panel } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { num } from "../_shared";
import { Code, Slider } from "../_ui";
import {
  type Bezier,
  bezierCss,
  bezierTailwind,
  bezierValue,
  cleanBezier,
  curvePath,
  FRAME,
  frameHeight,
  fromSvg,
  PRESETS,
  parseBezier,
  toSvg,
  Y_MAX,
  Y_MIN,
} from "./logic";

const T = {
  presets: l("Presets", "Préréglages", "Voreinstellungen"),
  curve: l("Curve", "Courbe", "Kurve"),
  graphHint: l(
    "Drag the two handles, or focus one and use the arrow keys (Shift for bigger steps).",
    "Fais glisser les deux poignées, ou sélectionne-en une et utilise les flèches (Maj pour aller plus vite).",
    "Zieh die beiden Griffe oder wähl einen aus und nutze die Pfeiltasten (Umschalt für größere Schritte).",
  ),
  p1: l("First control point", "Premier point de contrôle", "Erster Kontrollpunkt"),
  p2: l("Second control point", "Second point de contrôle", "Zweiter Kontrollpunkt"),
  paste: l(
    "Paste a timing function",
    "Coller une fonction de temporisation",
    "Timing-Funktion einfügen",
  ),
  pasteBad: l(
    "Not a cubic-bezier (four numbers, both x between 0 and 1).",
    "Pas une cubic-bezier (quatre nombres, les deux x entre 0 et 1).",
    "Kein cubic-bezier (vier Zahlen, beide x zwischen 0 und 1).",
  ),
  preview: l("Preview", "Aperçu", "Vorschau"),
  duration: l("Duration", "Durée", "Dauer"),
  pause: l("Pause", "Pause", "Pause"),
  play: l("Play", "Lecture", "Abspielen"),
  replay: l("Restart", "Relancer", "Neu starten"),
  yours: l("Your curve", "Ta courbe", "Deine Kurve"),
  linear: l("linear", "linear", "linear"),
  css: l("CSS", "CSS", "CSS"),
  tailwind: l("Tailwind", "Tailwind", "Tailwind"),
};

const W = FRAME.size + 2 * FRAME.pad;
const H = frameHeight();

export default function CubicBezier() {
  const raw = useToolState<Bezier>("curve", [0.34, 1.56, 0.64, 1]);
  const duration = useToolState("duration", 1000);
  const [paste, setPaste] = useState("");
  const [playing, setPlaying] = useState(true);
  const [run, setRun] = useState(0);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<0 | 1 | null>(null);

  const b = useComputed(() => cleanBezier(raw.value)).value;
  const set = (next: Bezier) => {
    raw.value = next;
  };
  const setPoint = (p: 0 | 1, x: number, y: number) => {
    const n = [...b] as Bezier;
    n[p * 2] = Math.min(1, Math.max(0, Math.round(x * 100) / 100));
    n[p * 2 + 1] = Math.min(Y_MAX, Math.max(Y_MIN, Math.round(y * 100) / 100));
    set(n);
  };
  const svgPoint = (e: PointerEvent): [number, number] | null => {
    const r = svg.current?.getBoundingClientRect();
    if (!r?.width || !r.height) return null;
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const pasted = paste.trim() ? parseBezier(paste) : null;

  const [ox, oy] = toSvg(0, 0);
  const [ex, ey] = toSvg(1, 1);
  const [ax, ay] = toSvg(b[0], b[1]);
  const [bx, by] = toSvg(b[2], b[3]);
  const anim = {
    animationDuration: `${duration.value}ms`,
    animationPlayState: playing ? "running" : "paused",
  };

  return (
    <>
      <Panel title={tr(T.presets)}>
        <div class="design-presets cubic-bezier-presets">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p.id}
              class="design-preset"
              aria-pressed={p.b.every((n, i) => n === b[i])}
              onClick={() => {
                set([...p.b]);
                setRun(run + 1);
              }}
            >
              <svg viewBox={`0 0 ${W} ${H}`} class="cubic-bezier-thumb" aria-hidden="true">
                <path d={curvePath(p.b)} />
              </svg>
              <span class="mono">{p.name}</span>
            </button>
          ))}
        </div>
      </Panel>

      <div class="design-split">
        <Panel title={tr(T.curve)}>
          <div class="cubic-bezier-graph">
            <div
              class="cubic-bezier-box"
              onPointerMove={(e) => {
                if (drag.current === null) return;
                const p = svgPoint(e);
                if (!p) return;
                const [x, y] = fromSvg(p[0], p[1]);
                setPoint(drag.current, x, y);
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              <svg ref={svg} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
                <rect class="cubic-bezier-square" x={ox} y={ey} width={ex - ox} height={oy - ey} />
                <line class="cubic-bezier-diag" x1={ox} y1={oy} x2={ex} y2={ey} />
                <line class="cubic-bezier-arm" x1={ox} y1={oy} x2={ax} y2={ay} />
                <line class="cubic-bezier-arm" x1={ex} y1={ey} x2={bx} y2={by} />
                <path class="cubic-bezier-curve" d={curvePath(b)} />
              </svg>
              {([0, 1] as const).map((p) => {
                const [cx, cy] = p === 0 ? [ax, ay] : [bx, by];
                return (
                  <button
                    key={p}
                    type="button"
                    class={`cubic-bezier-handle h${p}`}
                    style={{ left: `${(cx / W) * 100}%`, top: `${(cy / H) * 100}%` }}
                    aria-label={`${tr(p === 0 ? T.p1 : T.p2)}: ${num(b[p * 2] as number, 2)}, ${num(b[p * 2 + 1] as number, 2)}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      drag.current = p;
                      (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                    onKeyDown={(e) => {
                      const step = e.shiftKey ? 0.1 : 0.01;
                      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
                      const dy = e.key === "ArrowDown" ? -step : e.key === "ArrowUp" ? step : 0;
                      if (!dx && !dy) return;
                      e.preventDefault();
                      setPoint(p, (b[p * 2] as number) + dx, (b[p * 2 + 1] as number) + dy);
                    }}
                  />
                );
              })}
            </div>
          </div>
          <p class="muted small">{tr(T.graphHint)}</p>
          <div class="cubic-bezier-inputs">
            {(["x1", "y1", "x2", "y2"] as const).map((name, i) => (
              <NumberField
                key={name}
                label={name}
                value={b[i] as number}
                step={0.01}
                min={i % 2 === 0 ? 0 : Y_MIN}
                max={i % 2 === 0 ? 1 : Y_MAX}
                onChange={(v) => {
                  const n = [...b] as Bezier;
                  n[i] = v;
                  set(n);
                }}
              />
            ))}
          </div>
          <Field label={tr(T.paste)}>
            <input
              class="input mono"
              value={paste}
              placeholder="cubic-bezier(0.68, -0.6, 0.32, 1.6)"
              aria-invalid={!!paste.trim() && !pasted}
              spellcheck={false}
              autocomplete="off"
              onInput={(e) => {
                const v = (e.currentTarget as HTMLInputElement).value;
                setPaste(v);
                const p = v.trim() ? parseBezier(v) : null;
                if (p) set(p);
              }}
            />
          </Field>
          {paste.trim() && !pasted && <p class="error-note">{tr(T.pasteBad)}</p>}
        </Panel>

        <div class="stack design-sticky">
          <Panel
            title={tr(T.preview)}
            actions={
              <>
                <Button size="sm" variant="ghost" onClick={() => setPlaying(!playing)}>
                  {tr(playing ? T.pause : T.play)}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon="refresh"
                  onClick={() => {
                    setRun(run + 1);
                    setPlaying(true);
                  }}
                >
                  {tr(T.replay)}
                </Button>
              </>
            }
          >
            <div class="cubic-bezier-tracks" key={run}>
              <div class="cubic-bezier-track">
                <span class="small">{tr(T.yours)}</span>
                <div class="cubic-bezier-lane">
                  <span
                    class="cubic-bezier-ball"
                    style={{ ...anim, animationTimingFunction: bezierValue(b, false) }}
                  />
                </div>
              </div>
              <div class="cubic-bezier-track">
                <span class="small muted">{tr(T.linear)}</span>
                <div class="cubic-bezier-lane">
                  <span
                    class="cubic-bezier-ball linear"
                    style={{ ...anim, animationTimingFunction: "linear" }}
                  />
                </div>
              </div>
            </div>
            <Slider
              label={tr(T.duration)}
              value={duration.value}
              min={100}
              max={5000}
              step={50}
              suffix="ms"
              onChange={(v) => {
                duration.value = v;
              }}
            />
          </Panel>
          <Code label={tr(T.css)} code={bezierCss(b, duration.value)} />
          <Output label={tr(T.tailwind)} value={bezierTailwind(b)} />
        </div>
      </div>
    </>
  );
}
