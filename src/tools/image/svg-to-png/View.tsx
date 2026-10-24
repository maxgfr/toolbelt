import { useComputed, useSignal } from "@preact/signals";
import { NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import {
  Button,
  downloadBlob,
  ErrorNote,
  Field,
  Segmented,
  Stats,
  TextBox,
  Toggle,
} from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { decodeImage, drawScaled, encodeCanvas } from "../_dom";
import {
  attempt,
  extOf,
  formatSize,
  hasQuality,
  isOpaque,
  type OutFormat,
  sizeChange,
} from "../_shared";
import { errText, FormatSelect, locale, QualitySlider, UI, useObjectUrl } from "../_ui";
import { byteLength, cleanSvg, renderSize, svgInfo, withSize } from "./logic";

type Tab = "export" | "clean";
type SizeMode = "scale" | "width";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Sample icon -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <metadata>Sample</metadata>
  <circle cx="12.000000" cy="12.000000" r="9.500000" fill="#0f766e"/>
  <path d="M7.5000 12.2500 L10.7500 15.5000 L16.5000 8.7500" fill="none" stroke="#ffffff" stroke-width="2.000" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const T = {
  markup: l("SVG markup", "Code SVG", "SVG-Code"),
  placeholder: l(
    "Paste SVG code here, or open / drop a .svg file…",
    "Colle du code SVG ici, ou ouvre / dépose un fichier .svg…",
    "Füge hier SVG-Code ein oder öffne / zieh eine .svg-Datei hierher…",
  ),
  sample: l("Load a sample", "Charger un exemple", "Beispiel laden"),
  export: l("Convert to an image", "Convertir en image", "In ein Bild umwandeln"),
  clean: l("Clean up & minify", "Nettoyer et minifier", "Bereinigen und minifizieren"),
  size: l("Size", "Taille", "Größe"),
  scale: l("Scale", "Échelle", "Skalierung"),
  width: l("Width", "Largeur", "Breite"),
  bg: l("Background", "Fond", "Hintergrund"),
  transparent: l("Transparent", "Transparent", "Transparent"),
  intrinsic: l("SVG size", "Taille du SVG", "SVG-Größe"),
  output: l("Output", "Sortie", "Ausgabe"),
  last: l("Last file", "Dernier fichier", "Letzte Datei"),
  download: l("Download", "Télécharger", "Herunterladen"),
  noSize: l(
    "This SVG has no width, height or viewBox: 300 × 150 is assumed.",
    "Ce SVG n'a ni largeur, ni hauteur, ni viewBox : 300 × 150 est supposé.",
    "Dieses SVG hat weder Breite noch Höhe noch viewBox: Es wird 300 × 150 angenommen.",
  ),
  preview: l("SVG preview", "Aperçu du SVG", "SVG-Vorschau"),
  round: l("Round numbers", "Arrondir les nombres", "Zahlen runden"),
  decimals: l("Decimals", "Décimales", "Nachkommastellen"),
  cleaned: l("Cleaned SVG", "SVG nettoyé", "Bereinigtes SVG"),
  before: l("Before", "Avant", "Vorher"),
  after: l("After", "Après", "Nachher"),
  saved: l("Saved", "Gain", "Ersparnis"),
  use: l("Use this version", "Utiliser cette version", "Diese Version verwenden"),
  cleanNote: l(
    "Removes comments, metadata, editor data (Inkscape, Illustrator, Sketch…), empty groups and whitespace between tags; text, styles and scripts are kept as they are.",
    "Retire commentaires, métadonnées, données d'éditeur (Inkscape, Illustrator, Sketch…), groupes vides et espaces entre balises ; textes, styles et scripts sont gardés tels quels.",
    "Entfernt Kommentare, Metadaten, Editor-Daten (Inkscape, Illustrator, Sketch…), leere Gruppen und Leerraum zwischen Tags; Texte, Styles und Skripte bleiben unverändert.",
  ),
  renderError: l(
    "The browser could not draw this SVG (invalid XML?).",
    "Le navigateur n'a pas pu dessiner ce SVG (XML invalide ?).",
    "Der Browser konnte dieses SVG nicht zeichnen (ungültiges XML?).",
  ),
};

export default function SvgToPng() {
  const tab = useToolState<Tab>("tab", "export");
  const mode = useToolState<SizeMode>("sizeMode", "scale");
  const scale = useToolState("scale", 4);
  const width = useToolState("width", 512);
  const format = useToolState<OutFormat>("format", "png");
  const quality = useToolState("quality", 90);
  const bg = useToolState("bg", "#ffffff");
  const transparent = useToolState("transparent", true);
  const round = useToolState("round", true);
  const decimals = useToolState("decimals", 2);

  const markup = useSignal("");
  const fileName = useSignal("image.svg");
  const error = useSignal<string | null>(null);
  const last = useSignal<number | null>(null);
  const busy = useSignal(false);

  const info = useComputed(() =>
    markup.value.trim() ? attempt(() => svgInfo(markup.value)) : null,
  );
  const cleaned = useComputed(() =>
    markup.value.trim()
      ? attempt(() => cleanSvg(markup.value, { decimals: round.value ? decimals.value : -1 }))
      : null,
  );
  const previewBlob = useComputed(() => {
    const i = info.value;
    if (!i?.ok) return null;
    const r = attempt(() => withSize(markup.value, i.value.width, i.value.height));
    return r.ok ? new Blob([r.value], { type: "image/svg+xml" }) : null;
  });
  const previewUrl = useObjectUrl(previewBlob.value);

  const fmtOut: OutFormat = format.value === "avif" ? "png" : format.value;
  const i = info.value;
  const meta = i?.ok ? i.value : null;
  const out = meta ? renderSize(meta, mode.value, scale.value, width.value) : null;
  const loc = locale();
  const stemName = fileName.value.replace(/\.svg$/i, "") || "image";

  async function exportImage() {
    if (!meta || !out) return;
    busy.value = true;
    error.value = null;
    try {
      const blob = new Blob([withSize(markup.value, out.w, out.h)], { type: "image/svg+xml" });
      let img: Awaited<ReturnType<typeof decodeImage>>;
      try {
        img = await decodeImage(blob, "x.svg", [out.w, out.h]);
      } catch {
        throw new Error(tr(T.renderError));
      }
      const background = isOpaque(fmtOut) || !transparent.value ? bg.value : undefined;
      const canvas = drawScaled(img.source, out.w, out.h, out.w, out.h, background);
      const result = await encodeCanvas(canvas, fmtOut, quality.value / 100);
      last.value = result.size;
      downloadBlob(result, `${stemName}-${out.w}x${out.h}.${extOf(fmtOut)}`);
    } catch (err) {
      error.value = errText(err);
    } finally {
      busy.value = false;
    }
  }

  const c = cleaned.value;
  const before = byteLength(markup.value);
  const after = c?.ok ? byteLength(c.value) : 0;

  return (
    <div class="stack">
      <TextBox
        label={tr(T.markup)}
        value={markup.value}
        onInput={(v) => {
          markup.value = v;
          last.value = null;
        }}
        onFileName={(n) => {
          fileName.value = n;
        }}
        accept=".svg,image/svg+xml"
        placeholder={tr(T.placeholder)}
        rows={8}
        invalid={i ? !i.ok : false}
        note={i && !i.ok && <span class="error">{tr(i.error)}</span>}
        actions={
          !markup.value && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                markup.value = SAMPLE;
                fileName.value = "sample.svg";
              }}
            >
              {tr(T.sample)}
            </Button>
          )
        }
      />
      <Segmented<Tab>
        value={tab.value}
        onChange={(v) => {
          tab.value = v;
        }}
        options={[
          { value: "export", label: tr(T.export) },
          { value: "clean", label: tr(T.clean) },
        ]}
      />
      {tab.value === "export" ? (
        <div class="svg-to-png-layout">
          <div class="stack">
            <Segmented<SizeMode>
              label={tr(T.size)}
              value={mode.value}
              onChange={(v) => {
                mode.value = v;
              }}
              options={[
                { value: "scale", label: tr(T.scale) },
                { value: "width", label: tr(T.width) },
              ]}
            />
            <div class="grid-2">
              {mode.value === "scale" ? (
                <NumberField
                  label={tr(T.scale)}
                  value={scale.value}
                  min={0.1}
                  max={64}
                  step="any"
                  suffix="×"
                  onChange={(v) => {
                    scale.value = v;
                  }}
                />
              ) : (
                <NumberField
                  label={tr(T.width)}
                  value={width.value}
                  min={1}
                  max={16384}
                  integer
                  suffix="px"
                  onChange={(v) => {
                    width.value = v;
                  }}
                />
              )}
              <FormatSelect
                value={fmtOut}
                formats={["png", "jpeg", "webp"]}
                onChange={(v) => {
                  format.value = v;
                }}
              />
              {hasQuality(fmtOut) ? (
                <QualitySlider
                  value={quality.value}
                  onChange={(v) => {
                    quality.value = v;
                  }}
                />
              ) : (
                <span />
              )}
              <Field label={tr(T.bg)} class="image-color-field">
                <input
                  type="color"
                  value={bg.value}
                  disabled={transparent.value && !isOpaque(fmtOut)}
                  onInput={(e) => {
                    bg.value = (e.currentTarget as HTMLInputElement).value;
                  }}
                />
              </Field>
              <div class="image-toggle-cell">
                {!isOpaque(fmtOut) && (
                  <Toggle
                    checked={transparent.value}
                    onChange={(v) => {
                      transparent.value = v;
                    }}
                    label={tr(T.transparent)}
                  />
                )}
              </div>
            </div>
            {meta && out && (
              <>
                {!meta.known && <p class="muted small">{tr(T.noSize)}</p>}
                <Stats
                  items={[
                    {
                      label: tr(T.intrinsic),
                      value: `${fmt(meta.width, { maximumFractionDigits: 2 })} × ${fmt(meta.height, { maximumFractionDigits: 2 })}`,
                    },
                    { label: tr(T.output), value: `${fmt(out.w)} × ${fmt(out.h)}` },
                    ...(last.value != null
                      ? [{ label: tr(T.last), value: formatSize(last.value, loc) }]
                      : []),
                  ]}
                />
                <Button
                  variant="primary"
                  icon="download"
                  disabled={busy.value}
                  onClick={exportImage}
                >
                  {busy.value
                    ? tr(UI.working)
                    : `${tr(T.download)} · ${extOf(fmtOut).toUpperCase()}`}
                </Button>
              </>
            )}
            <ErrorNote error={error.value} />
          </div>
          {previewUrl && (
            <figure
              class={`image-preview svg-to-png-preview ${transparent.value && !isOpaque(fmtOut) ? "image-checker" : ""}`}
              style={transparent.value && !isOpaque(fmtOut) ? undefined : { background: bg.value }}
            >
              <img src={previewUrl} alt={tr(T.preview)} />
            </figure>
          )}
        </div>
      ) : (
        <div class="stack">
          <div class="row">
            <Toggle
              checked={round.value}
              onChange={(v) => {
                round.value = v;
              }}
              label={tr(T.round)}
            />
            {round.value && (
              <NumberField
                label={tr(T.decimals)}
                value={decimals.value}
                min={0}
                max={6}
                integer
                onChange={(v) => {
                  decimals.value = v;
                }}
              />
            )}
          </div>
          <p class="muted small">{tr(T.cleanNote)}</p>
          {c && !c.ok && <ErrorNote error={tr(c.error)} />}
          {c?.ok && (
            <>
              <Stats
                items={[
                  { label: tr(T.before), value: formatSize(before, loc) },
                  { label: tr(T.after), value: formatSize(after, loc) },
                  {
                    label: tr(T.saved),
                    value: fmt(-sizeChange(before, after), {
                      style: "percent",
                      maximumFractionDigits: 1,
                    }),
                  },
                ]}
              />
              <TextBox
                label={tr(T.cleaned)}
                value={c.value}
                readOnly
                rows={8}
                downloadName={`${stemName}.min.svg`}
                actions={
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="swap"
                    onClick={() => {
                      markup.value = c.value;
                    }}
                  >
                    {tr(T.use)}
                  </Button>
                }
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
