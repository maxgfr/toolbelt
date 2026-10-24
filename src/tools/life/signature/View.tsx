import { useEffect, useRef } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { Button, downloadBlob, downloadText, Field, toast } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import {
  addPoint,
  bounds,
  normalizeStrokes,
  type Pen,
  type Stroke,
  startPen,
  strokePath,
  toSvg,
} from "./logic";

const T = {
  pad: l(
    "Signature pad: draw with a mouse, a finger or a pen",
    "Zone de signature : dessine à la souris, au doigt ou au stylet",
  ),
  signHere: l("Sign here", "Signez ici"),
  color: l("Ink", "Encre"),
  width: l("Pen width", "Épaisseur"),
  custom: l("Custom color", "Couleur personnalisée"),
  undo: l("Undo", "Annuler"),
  clear: l("Clear", "Effacer"),
  png: l("Download PNG", "Télécharger en PNG"),
  svg: l("Download SVG", "Télécharger en SVG"),
  empty: l("Draw a signature first.", "Dessine d'abord une signature."),
  note: l(
    "The PNG and SVG have a transparent background and are cropped to the signature. Nothing is saved or sent: the drawing disappears when you leave the page.",
    "Le PNG et le SVG ont un fond transparent et sont recadrés sur la signature. Rien n'est enregistré ni envoyé : le dessin disparaît quand tu quittes la page.",
  ),
  keys: l("Ctrl/⌘+Z undoes the last stroke.", "Ctrl/⌘+Z annule le dernier trait."),
  black: l("Black", "Noir"),
  blue: l("Blue", "Bleu"),
  navy: l("Navy", "Bleu marine"),
  red: l("Red", "Rouge"),
};

const INKS = [
  { css: "#111111", name: T.black },
  { css: "#1d4ed8", name: T.blue },
  { css: "#1e2a5a", name: T.navy },
  { css: "#b91c1c", name: T.red },
];

export default function Signature() {
  // A signature is personal: it is kept neither in storage nor in share links.
  const strokesSig = useToolState<Stroke[]>("strokes", [], { persist: false, share: false });
  const color = useToolState("color", "#1d4ed8");
  const width = useToolState("width", 2.5);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pen = useRef<{ id: number; pen: Pen; color: string; width: number } | null>(null);
  const frame = useRef(0);

  const strokes = normalizeStrokes(strokesSig.value);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const draw = () => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const all = [...strokesRef.current];
    const live = pen.current;
    if (live) all.push({ color: live.color, width: live.width, points: live.pen.points });
    for (const s of all) {
      if (!s.points.length) continue;
      ctx.fillStyle = s.color;
      ctx.fill(new Path2D(strokePath(s)));
    }
  };
  const schedule = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(draw);
  };

  // Keep the canvas sharp at any size and pixel ratio.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = c.getBoundingClientRect();
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      draw();
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(c);
    return () => {
      ro?.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, []);

  useEffect(schedule, [strokesSig.value]);

  const point = (e: PointerEvent) => {
    const c = canvas.current;
    const r = c?.getBoundingClientRect();
    return {
      x: e.clientX - (r?.left ?? 0),
      y: e.clientY - (r?.top ?? 0),
      t: e.timeStamp,
      pressure: e.pointerType === "pen" && e.pressure > 0 ? e.pressure : null,
    };
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    pen.current = {
      id: e.pointerId,
      pen: addPoint(startPen(), point(e), width.value),
      color: color.value,
      width: width.value,
    };
    schedule();
  };
  const onMove = (e: PointerEvent) => {
    const live = pen.current;
    if (!live || live.id !== e.pointerId) return;
    const events = e.getCoalescedEvents?.() ?? [e];
    for (const ev of events.length ? events : [e])
      live.pen = addPoint(live.pen, point(ev), live.width);
    schedule();
  };
  const onUp = (e: PointerEvent) => {
    const live = pen.current;
    if (!live || live.id !== e.pointerId) return;
    pen.current = null;
    if (live.pen.points.length)
      strokesSig.value = [
        ...strokes,
        { color: live.color, width: live.width, points: live.pen.points },
      ];
    schedule();
  };

  const undo = () => {
    if (strokes.length) strokesSig.value = strokes.slice(0, -1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        e.preventDefault();
        if (strokesRef.current.length) strokesSig.value = strokesRef.current.slice(0, -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const exportPng = () => {
    const b = bounds(strokes, 8);
    if (!b) return toast(tr(T.empty), "error");
    const scale = 3;
    const out = document.createElement("canvas");
    out.width = Math.ceil(b.w * scale);
    out.height = Math.ceil(b.h * scale);
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, -b.x * scale, -b.y * scale);
    for (const s of strokes) {
      ctx.fillStyle = s.color;
      ctx.fill(new Path2D(strokePath(s)));
    }
    out.toBlob((blob) => {
      if (blob) downloadBlob(blob, "signature.png");
    }, "image/png");
  };
  const exportSvg = () => {
    const svg = toSvg(strokes);
    if (!svg) return toast(tr(T.empty), "error");
    downloadText(svg, "signature.svg", "image/svg+xml");
  };

  return (
    <div class="stack">
      <div class="row">
        <fieldset class="signature-inks">
          <legend class="sr-only">{tr(T.color)}</legend>
          {INKS.map((ink) => (
            <button
              key={ink.css}
              type="button"
              aria-pressed={color.value === ink.css}
              aria-label={tr(ink.name)}
              title={tr(ink.name)}
              class={`signature-ink ${color.value === ink.css ? "on" : ""}`}
              style={{ background: ink.css }}
              onClick={() => {
                color.value = ink.css;
              }}
            />
          ))}
          <input
            type="color"
            class="signature-custom"
            aria-label={tr(T.custom)}
            title={tr(T.custom)}
            value={color.value}
            onInput={(e) => {
              color.value = e.currentTarget.value;
            }}
          />
        </fieldset>
        <Field label={`${tr(T.width)} · ${width.value}`} class="signature-width">
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={width.value}
            onInput={(e) => {
              width.value = Number(e.currentTarget.value);
            }}
          />
        </Field>
        <span class="spacer" />
        <Button icon="back" onClick={undo} disabled={!strokes.length}>
          {tr(T.undo)}
        </Button>
        <Button
          variant="ghost"
          icon="trash"
          onClick={() => {
            strokesSig.value = [];
          }}
          disabled={!strokes.length}
        >
          {tr(T.clear)}
        </Button>
      </div>
      <div class="signature-pad">
        <canvas
          ref={canvas}
          aria-label={tr(T.pad)}
          role="img"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        <div class="signature-line" aria-hidden="true">
          <span>✕ {tr(T.signHere)}</span>
        </div>
      </div>
      <div class="row">
        <Button variant="primary" icon="download" onClick={exportPng} disabled={!strokes.length}>
          {tr(T.png)}
        </Button>
        <Button icon="download" onClick={exportSvg} disabled={!strokes.length}>
          {tr(T.svg)}
        </Button>
      </div>
      <p class="muted small">
        {tr(T.note)} {tr(T.keys)}
      </p>
    </div>
  );
}
