import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import {
  Button,
  downloadBlob,
  ErrorNote,
  FileDrop,
  Icon,
  Segmented,
  Stats,
  Toggle,
} from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { ctx2d, type Decoded, decodeImage, drawScaled, encodeCanvas, makeCanvas } from "../_dom";
import { extOf, formatSize, hasQuality, isOpaque, type OutFormat, stem } from "../_shared";
import {
  errText,
  FormatSelect,
  locale,
  QualitySlider,
  UI,
  useEncodable,
  usePasteImage,
} from "../_ui";
import {
  type AspectPreset,
  aspectRatio,
  clampRect,
  dragRect,
  fitAspect,
  flipRectH,
  flipRectV,
  fullRect,
  HANDLES,
  type Handle,
  type Orientation,
  orientedSize,
  outputSize,
  PRESETS,
  type Rect,
  type ResizeSettings,
  rotateOrientation,
  rotateRect,
} from "./logic";

const T = {
  aspect: l("Crop ratio", "Proportions du recadrage", "Seitenverhältnis des Zuschnitts"),
  free: l("Free", "Libre", "Frei"),
  original: l("Original", "Originale", "Original"),
  custom: l("Custom", "Personnalisé", "Benutzerdefiniert"),
  ratioW: l("Ratio width", "Ratio largeur", "Verhältnis Breite"),
  ratioH: l("Ratio height", "Ratio hauteur", "Verhältnis Höhe"),
  rotate: l("Rotate 90°", "Pivoter de 90°", "Um 90° drehen"),
  flipH: l("Flip horizontally", "Miroir horizontal", "Horizontal spiegeln"),
  flipV: l("Flip vertically", "Miroir vertical", "Vertikal spiegeln"),
  resetCrop: l("Reset the crop", "Réinitialiser le recadrage", "Zuschnitt zurücksetzen"),
  x: l("Left (X)", "Gauche (X)", "Links (X)"),
  y: l("Top (Y)", "Haut (Y)", "Oben (Y)"),
  w: l("Width", "Largeur", "Breite"),
  h: l("Height", "Hauteur", "Höhe"),
  crop: l("Crop", "Recadrage", "Zuschnitt"),
  resize: l("Resize", "Redimensionner", "Größe ändern"),
  px: l("Pixels", "Pixels", "Pixel"),
  pct: l("Percent", "Pourcentage", "Prozent"),
  scale: l("Scale", "Échelle", "Skalierung"),
  lock: l("Keep proportions", "Garder les proportions", "Proportionen beibehalten"),
  output: l("Output", "Sortie", "Ausgabe"),
  source: l("Source", "Source", "Quelle"),
  download: l("Download", "Télécharger", "Herunterladen"),
  encoded: l("Last file", "Dernier fichier", "Letzte Datei"),
  background: l("Background", "Fond", "Hintergrund"),
  box: l(
    "Crop box: drag it or use the arrow keys (Shift = 10 px)",
    "Zone de recadrage : fais-la glisser ou utilise les flèches (Maj = 10 px)",
    "Zuschnittrahmen: zieh ihn oder nutze die Pfeiltasten (Umschalt = 10 px)",
  ),
  empty: l(
    "Choose an image to crop, rotate, flip and resize it.",
    "Choisis une image pour la recadrer, la pivoter, la retourner et la redimensionner.",
    "Wähle ein Bild, um es zuzuschneiden, zu drehen, zu spiegeln und seine Größe zu ändern.",
  ),
  image: l("Image to crop", "Image à recadrer", "Zuzuschneidendes Bild"),
};

/** Longest side of the on-screen preview (the export always uses full resolution). */
const PREVIEW_MAX = 1600;

/** Draws the source turned and flipped, scaled by `scale`. */
function orient(img: Decoded, o: Orientation, scale = 1): HTMLCanvasElement {
  const { w, h } = orientedSize(img.width, img.height, o);
  const c = makeCanvas(w * scale, h * scale);
  const ctx = ctx2d(c);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.scale(o.flipH ? -1 : 1, o.flipV ? -1 : 1);
  ctx.rotate((o.turns * Math.PI) / 2);
  const sw = img.width * scale;
  const sh = img.height * scale;
  ctx.drawImage(img.source, -sw / 2, -sh / 2, sw, sh);
  return c;
}

export default function ImageResize() {
  const preset = useToolState<AspectPreset>("aspect", "free");
  const customW = useToolState("customW", 3);
  const customH = useToolState("customH", 2);
  const format = useToolState<OutFormat>("format", "png");
  const quality = useToolState("quality", 90);
  const mode = useToolState<ResizeSettings["mode"]>("mode", "px");
  const pct = useToolState("pct", 100);
  const lock = useToolState("lock", true);
  const bg = useToolState("bg", "#ffffff");

  const img = useSignal<Decoded | null>(null);
  const name = useSignal("image");
  const error = useSignal<string | null>(null);
  const orientation = useSignal<Orientation>({ turns: 0, flipH: false, flipV: false });
  const crop = useSignal<Rect>({ x: 0, y: 0, w: 1, h: 1 });
  const outW = useSignal(0);
  const outH = useSignal(0);
  const last = useSignal<number | null>(null);
  const busy = useSignal(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const ok = useEncodable();

  const i = img.value;
  const o = orientation.value;
  const dims = i ? orientedSize(i.width, i.height, o) : { w: 1, h: 1 };
  const ratio = aspectRatio(preset.value, { w: customW.value, h: customH.value }, dims);
  const fmtOut: OutFormat = ok.value[format.value] ? format.value : "png";

  async function load(file: File) {
    error.value = null;
    try {
      const d = await decodeImage(file, file.name);
      img.peek()?.close();
      img.value = d;
      name.value = file.name;
      orientation.value = { turns: 0, flipH: false, flipV: false };
      outW.value = 0;
      outH.value = 0;
      last.value = null;
      const r = aspectRatio(
        preset.peek(),
        { w: customW.peek(), h: customH.peek() },
        { w: d.width, h: d.height },
      );
      const full = fullRect(d.width, d.height);
      crop.value = r ? fitAspect(full, r, d.width, d.height) : full;
    } catch (err) {
      error.value = errText(err);
    }
  }
  usePasteImage(load);

  useEffect(() => () => img.peek()?.close(), []);

  // Redraws the preview when the image or its orientation changes.
  useEffect(() => {
    const c = canvasRef.current;
    if (!i || !c) return;
    const scale = Math.min(1, PREVIEW_MAX / Math.max(i.width, i.height));
    const src = orient(i, o, scale);
    c.width = src.width;
    c.height = src.height;
    ctx2d(c).drawImage(src, 0, 0);
  }, [i, o]);

  function setPreset(p: AspectPreset) {
    preset.value = p;
    const r = aspectRatio(p, { w: customW.value, h: customH.value }, dims);
    if (r) crop.value = fitAspect(crop.value, r, dims.w, dims.h);
  }
  function setCustom(w: number, h: number) {
    customW.value = w;
    customH.value = h;
    if (preset.value === "custom" && w > 0 && h > 0)
      crop.value = fitAspect(crop.value, w / h, dims.w, dims.h);
  }

  function rotate() {
    crop.value = rotateRect(crop.value, dims.w, dims.h);
    orientation.value = rotateOrientation(o);
    [outW.value, outH.value] = [outH.value, outW.value];
  }
  function flip(axis: "h" | "v") {
    crop.value = axis === "h" ? flipRectH(crop.value, dims.w) : flipRectV(crop.value, dims.h);
    orientation.value = axis === "h" ? { ...o, flipH: !o.flipH } : { ...o, flipV: !o.flipV };
  }

  function startDrag(handle: Handle, e: PointerEvent) {
    const stage = stageRef.current;
    if (!stage) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    const box = stage.getBoundingClientRect();
    const start = crop.value;
    const sx = e.clientX;
    const sy = e.clientY;
    const kx = dims.w / box.width;
    const ky = dims.h / box.height;
    const move = (ev: PointerEvent) => {
      crop.value = dragRect(
        start,
        handle,
        (ev.clientX - sx) * kx,
        (ev.clientY - sy) * ky,
        dims.w,
        dims.h,
        ratio,
      );
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }

  function onKey(e: KeyboardEvent) {
    const step = e.shiftKey ? 10 : 1;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const v = d[e.key];
    if (!v) return;
    e.preventDefault();
    crop.value = dragRect(crop.value, "move", v[0], v[1], dims.w, dims.h, ratio);
  }

  function setField(k: keyof Rect, v: number) {
    const c = { ...crop.value, [k]: v };
    if (ratio && k === "w") c.h = v / ratio;
    if (ratio && k === "h") c.w = v * ratio;
    crop.value = clampRect(c, dims.w, dims.h);
  }

  const c = crop.value;
  const settings: ResizeSettings = {
    mode: mode.value,
    pct: pct.value,
    w: outW.value,
    h: outH.value,
    lock: lock.value,
  };
  const out = outputSize(c, settings);

  async function exportImage() {
    if (!i) return;
    busy.value = true;
    error.value = null;
    try {
      const full = orient(i, o);
      const cut = makeCanvas(c.w, c.h);
      ctx2d(cut).drawImage(full, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);
      full.width = full.height = 0;
      const final = drawScaled(
        cut,
        c.w,
        c.h,
        out.w,
        out.h,
        isOpaque(fmtOut) ? bg.value : undefined,
      );
      const blob = await encodeCanvas(final, fmtOut, quality.value / 100);
      last.value = blob.size;
      downloadBlob(blob, `${stem(name.value)}-${out.w}x${out.h}.${extOf(fmtOut)}`);
    } catch (err) {
      error.value = errText(err);
    } finally {
      busy.value = false;
    }
  }

  const pctOf = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div class="stack">
      <FileDrop
        accept="image/*,.svg"
        label={i ? `${name.value} · ${i.width}×${i.height}` : tr(UI.drop)}
        onFiles={(f) => f[0] && load(f[0])}
      />
      <ErrorNote error={error.value} />
      {!i ? (
        <p class="muted">
          {tr(T.empty)} {tr(UI.local)}
        </p>
      ) : (
        <div class="image-resize-layout">
          <div class="stack">
            <div class="row">
              <Button size="sm" onClick={rotate}>
                <Icon d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" size={16} />
                {tr(T.rotate)}
              </Button>
              <Button size="sm" onClick={() => flip("h")}>
                <Icon d="M12 3v18M8 7l-5 5 5 5zM16 7l5 5-5 5z" size={16} />
                {tr(T.flipH)}
              </Button>
              <Button size="sm" onClick={() => flip("v")}>
                <Icon d="M3 12h18M7 8l5-5 5 5zM7 16l5 5 5-5z" size={16} />
                {tr(T.flipV)}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon="reset"
                onClick={() => {
                  const full = fullRect(dims.w, dims.h);
                  crop.value = ratio ? fitAspect(full, ratio, dims.w, dims.h) : full;
                }}
              >
                {tr(T.resetCrop)}
              </Button>
            </div>
            <div class="image-resize-frame">
              <div class="image-resize-stage" ref={stageRef}>
                <canvas
                  ref={canvasRef}
                  class="image-resize-canvas"
                  aria-label={tr(T.image)}
                  role="img"
                />
                <button
                  type="button"
                  class="image-resize-box"
                  aria-label={`${tr(T.box)} · ${c.w}×${c.h}`}
                  style={{
                    left: pctOf(c.x, dims.w),
                    top: pctOf(c.y, dims.h),
                    width: pctOf(c.w, dims.w),
                    height: pctOf(c.h, dims.h),
                  }}
                  onPointerDown={(e) => startDrag("move", e)}
                  onKeyDown={onKey}
                >
                  {HANDLES.map((h) => (
                    <span
                      key={h}
                      class={`image-resize-handle image-resize-${h}`}
                      onPointerDown={(e) => startDrag(h, e)}
                    />
                  ))}
                </button>
              </div>
            </div>
          </div>

          <div class="stack">
            <Select<AspectPreset>
              label={tr(T.aspect)}
              value={preset.value}
              onChange={setPreset}
              options={PRESETS.map((p) => ({
                value: p,
                label:
                  p === "free"
                    ? tr(T.free)
                    : p === "original"
                      ? tr(T.original)
                      : p === "custom"
                        ? tr(T.custom)
                        : p,
              }))}
            />
            {preset.value === "custom" && (
              <div class="grid-2">
                <NumberField
                  label={tr(T.ratioW)}
                  value={customW.value}
                  min={0.01}
                  max={1000}
                  step="any"
                  onChange={(v) => setCustom(v, customH.value)}
                />
                <NumberField
                  label={tr(T.ratioH)}
                  value={customH.value}
                  min={0.01}
                  max={1000}
                  step="any"
                  onChange={(v) => setCustom(customW.value, v)}
                />
              </div>
            )}
            <fieldset class="image-fieldset">
              <legend>{tr(T.crop)}</legend>
              <div class="grid-2">
                <NumberField
                  label={tr(T.x)}
                  value={c.x}
                  min={0}
                  max={dims.w - 1}
                  integer
                  suffix="px"
                  onChange={(v) => setField("x", v)}
                />
                <NumberField
                  label={tr(T.y)}
                  value={c.y}
                  min={0}
                  max={dims.h - 1}
                  integer
                  suffix="px"
                  onChange={(v) => setField("y", v)}
                />
                <NumberField
                  label={tr(T.w)}
                  value={c.w}
                  min={1}
                  max={dims.w}
                  integer
                  suffix="px"
                  onChange={(v) => setField("w", v)}
                />
                <NumberField
                  label={tr(T.h)}
                  value={c.h}
                  min={1}
                  max={dims.h}
                  integer
                  suffix="px"
                  onChange={(v) => setField("h", v)}
                />
              </div>
            </fieldset>
            <fieldset class="image-fieldset">
              <legend>{tr(T.resize)}</legend>
              <div class="stack">
                <Segmented<ResizeSettings["mode"]>
                  label={tr(T.resize)}
                  value={mode.value}
                  onChange={(v) => {
                    mode.value = v;
                  }}
                  options={[
                    { value: "px", label: tr(T.px) },
                    { value: "pct", label: tr(T.pct) },
                  ]}
                />
                {mode.value === "pct" ? (
                  <NumberField
                    label={tr(T.scale)}
                    value={pct.value}
                    min={1}
                    max={1000}
                    suffix="%"
                    onChange={(v) => {
                      pct.value = v;
                    }}
                  />
                ) : (
                  <>
                    <div class="grid-2">
                      <NumberField
                        label={tr(T.w)}
                        value={out.w}
                        min={1}
                        max={16384}
                        integer
                        suffix="px"
                        onChange={(v) => {
                          outW.value = v;
                          if (lock.value) outH.value = 0;
                        }}
                      />
                      <NumberField
                        label={tr(T.h)}
                        value={out.h}
                        min={1}
                        max={16384}
                        integer
                        suffix="px"
                        onChange={(v) => {
                          outH.value = v;
                          if (lock.value) outW.value = 0;
                        }}
                      />
                    </div>
                    <Toggle
                      checked={lock.value}
                      onChange={(v) => {
                        lock.value = v;
                        if (v) outH.value = 0;
                      }}
                      label={tr(T.lock)}
                    />
                  </>
                )}
              </div>
            </fieldset>
            <div class="grid-2">
              <FormatSelect
                value={format.value}
                onChange={(v) => {
                  format.value = v;
                }}
              />
              {isOpaque(fmtOut) ? (
                <label class="field image-color-field">
                  <span class="field-label">{tr(T.background)}</span>
                  <input
                    type="color"
                    value={bg.value}
                    onInput={(e) => {
                      bg.value = (e.currentTarget as HTMLInputElement).value;
                    }}
                  />
                </label>
              ) : (
                <span />
              )}
            </div>
            {hasQuality(fmtOut) && (
              <QualitySlider
                value={quality.value}
                onChange={(v) => {
                  quality.value = v;
                }}
              />
            )}
            <Stats
              items={[
                { label: tr(T.source), value: `${dims.w}×${dims.h}` },
                { label: tr(T.crop), value: `${c.w}×${c.h}` },
                { label: tr(T.output), value: `${fmt(out.w)}×${fmt(out.h)}` },
                ...(last.value != null
                  ? [{ label: tr(T.encoded), value: formatSize(last.value, locale()) }]
                  : []),
              ]}
            />
            <Button variant="primary" icon="download" disabled={busy.value} onClick={exportImage}>
              {busy.value ? tr(UI.working) : `${tr(T.download)} · ${extOf(fmtOut).toUpperCase()}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
