import { useSignal, useSignalEffect } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { copyText, ErrorNote, FileDrop, Output, Panel, TextBox, toast } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { S } from "../../../i18n/strings";
import { ctx2d, decodeImage, drawScaled } from "../_dom";
import { fitWithin, type Rgb, toHex } from "../_shared";
import { errText, UI, usePasteImage } from "../_ui";
import {
  averageColor,
  cssVariables,
  formatsOf,
  kmeans,
  pickPoint,
  type Swatch,
  samplePixels,
  textOn,
} from "./logic";

const T = {
  count: l("Number of colors", "Nombre de couleurs", "Anzahl der Farben"),
  palette: l("Dominant colors", "Couleurs dominantes", "Dominante Farben"),
  average: l("Average color", "Couleur moyenne", "Durchschnittsfarbe"),
  picked: l("Picked color", "Couleur prélevée", "Gewählte Farbe"),
  pickHint: l(
    "Click anywhere on the image to pick the color of that pixel.",
    "Clique n'importe où sur l'image pour prélever la couleur de ce pixel.",
    "Klicke irgendwo ins Bild, um die Farbe dieses Pixels aufzunehmen.",
  ),
  css: l("CSS variables", "Variables CSS", "CSS-Variablen"),
  copyHex: l("Click to copy", "Clique pour copier", "Zum Kopieren klicken"),
  analyzing: l("Analyzing…", "Analyse…", "Wird analysiert…"),
  image: l(
    "Image: click to pick a color",
    "Image : clique pour prélever une couleur",
    "Bild: klicke, um eine Farbe aufzunehmen",
  ),
  transparent: l(
    "This image has no opaque pixels.",
    "Cette image n'a aucun pixel opaque.",
    "Dieses Bild hat keine deckenden Pixel.",
  ),
  empty: l(
    "Choose an image to extract its palette and pick colors from it.",
    "Choisis une image pour en extraire la palette et y prélever des couleurs.",
    "Wähle ein Bild, um seine Farbpalette zu extrahieren und Farben daraus aufzunehmen.",
  ),
};

/** Longest side analyzed and shown (plenty for a palette, keeps it fast). */
const WORK_MAX = 1200;

function SwatchButton({ rgb, share }: { rgb: Rgb; share?: number }) {
  const hex = toHex(rgb);
  return (
    <button
      type="button"
      class="image-colors-swatch"
      style={{ background: hex, color: textOn(rgb) }}
      title={tr(T.copyHex)}
      onClick={async () => {
        if (await copyText(hex)) toast(`${tr(S.copied)} ${hex}`, "success", 1600);
        else toast(tr(S.copyFailed), "error");
      }}
    >
      <span class="mono">{hex}</span>
      {share != null && (
        <span class="small">{fmt(share, { style: "percent", maximumFractionDigits: 1 })}</span>
      )}
    </button>
  );
}

export default function ImageColors() {
  const count = useToolState("count", 6);
  const pixels = useSignal<ImageData | null>(null);
  const name = useSignal("");
  const swatches = useSignal<Swatch[]>([]);
  const average = useSignal<Rgb | null>(null);
  const picked = useSignal<Rgb | null>(null);
  const busy = useSignal(false);
  const error = useSignal<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const run = useRef(0);

  async function load(f: File) {
    error.value = null;
    try {
      const img = await decodeImage(f, f.name);
      const { w, h } = fitWithin(img.width, img.height, WORK_MAX, WORK_MAX);
      const c = drawScaled(img.source, img.width, img.height, w, h);
      img.close();
      pixels.value = ctx2d(c, true).getImageData(0, 0, w, h);
      name.value = f.name;
      picked.value = null;
    } catch (err) {
      error.value = errText(err);
    }
  }
  usePasteImage(load);

  useEffect(() => {
    const c = canvasRef.current;
    const data = pixels.value;
    if (!c || !data) return;
    c.width = data.width;
    c.height = data.height;
    ctx2d(c).putImageData(data, 0, 0);
  }, [pixels.value]);

  // Runs k-means one iteration at a time, yielding to the page in between.
  useSignalEffect(() => {
    const data = pixels.value;
    const k = count.value;
    const id = ++run.current;
    if (!data) return;
    busy.value = true;
    const timer = setTimeout(async () => {
      const px = samplePixels(data.data);
      average.value = averageColor(px);
      const km = kmeans(px, k, 1);
      while (!km.step()) {
        await new Promise((r) => setTimeout(r, 0));
        if (id !== run.current) return;
      }
      if (id !== run.current) return;
      swatches.value = km.result();
      busy.value = false;
    }, 60);
    return () => clearTimeout(timer);
  });

  function pick(e: MouseEvent) {
    const data = pixels.value;
    const c = canvasRef.current;
    if (!data || !c) return;
    const { x, y } = pickPoint(
      e.clientX,
      e.clientY,
      c.getBoundingClientRect(),
      data.width,
      data.height,
    );
    const p = (y * data.width + x) * 4;
    picked.value = [data.data[p] ?? 0, data.data[p + 1] ?? 0, data.data[p + 2] ?? 0];
  }

  const data = pixels.value;
  const pk = picked.value ? formatsOf(picked.value) : null;
  const avg = average.value;

  return (
    <div class="stack">
      <FileDrop
        accept="image/*,.svg"
        label={name.value || tr(UI.drop)}
        onFiles={(f) => f[0] && load(f[0])}
      />
      <ErrorNote error={error.value} />
      {!data ? (
        <p class="muted">
          {tr(T.empty)} {tr(UI.local)}
        </p>
      ) : (
        <div class="image-colors-layout">
          <div class="stack">
            <figure class="image-preview image-checker image-colors-figure">
              <canvas
                ref={canvasRef}
                class="image-colors-canvas"
                role="img"
                aria-label={tr(T.image)}
                onClick={pick}
              />
            </figure>
            <p class="muted small">{tr(T.pickHint)}</p>
          </div>
          <div class="stack">
            <NumberField
              label={tr(T.count)}
              value={count.value}
              min={2}
              max={16}
              integer
              onChange={(v) => {
                count.value = v;
              }}
            />
            <Panel
              title={tr(T.palette)}
              actions={busy.value ? <span class="muted small">{tr(T.analyzing)}</span> : undefined}
            >
              {avg == null && !busy.value ? (
                <p class="muted">{tr(T.transparent)}</p>
              ) : (
                <div class="image-colors-palette">
                  {swatches.value.map((s) => (
                    <SwatchButton key={toHex(s.rgb)} rgb={s.rgb} share={s.share} />
                  ))}
                </div>
              )}
            </Panel>
            {avg && (
              <Panel title={tr(T.average)}>
                <div class="image-colors-palette">
                  <SwatchButton rgb={avg} />
                </div>
              </Panel>
            )}
            {pk && picked.value && (
              <Panel title={tr(T.picked)}>
                <div class="stack">
                  <div class="image-colors-palette">
                    <SwatchButton rgb={picked.value} />
                  </div>
                  <Output label="HEX" value={pk.hex} />
                  <Output label="RGB" value={pk.rgb} />
                  <Output label="HSL" value={pk.hsl} />
                </div>
              </Panel>
            )}
            {swatches.value.length > 0 && (
              <TextBox
                label={tr(T.css)}
                value={cssVariables(swatches.value)}
                readOnly
                rows={Math.min(10, swatches.value.length + 2)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
