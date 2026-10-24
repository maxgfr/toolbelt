import { useComputed } from "@preact/signals";
import { NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import {
  Button,
  downloadBlob,
  downloadText,
  Field,
  Panel,
  Segmented,
  Toggle,
  toast,
} from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { cssColor } from "../_shared";
import { Code, ColorField } from "../_ui";
import {
  canvasFont,
  cleanPlaceholder,
  DEFAULT,
  type Font,
  fileName,
  label,
  MAX_SIDE,
  type Placeholder,
  placeholderSvg,
  SIZES,
  svgBase64Uri,
  svgDataUri,
} from "./logic";

const T = {
  settings: l("Image", "Image"),
  width: l("Width", "Largeur"),
  height: l("Height", "Hauteur"),
  sizes: l("Common sizes", "Tailles courantes"),
  bg: l("Background", "Fond"),
  fg: l("Text color", "Couleur du texte"),
  text: l("Text", "Texte"),
  textHint: l("Empty: the dimensions (W×H).", "Vide : les dimensions (L×H)."),
  size: l("Font size", "Taille de police"),
  sizeHint: l("0 = fit automatically", "0 = ajustée automatiquement"),
  font: l("Font", "Police"),
  sans: l("Sans-serif", "Sans empattement"),
  serif: l("Serif", "Avec empattement"),
  mono: l("Monospace", "Chasse fixe"),
  bold: l("Bold", "Gras"),
  preview: l("Preview", "Aperçu"),
  output: l("Output", "Export"),
  svg: l("SVG", "SVG"),
  dataUri: l("Data URI", "URI data"),
  base64: l("Base64", "Base64"),
  css: l("CSS", "CSS"),
  img: l("<img>", "<img>"),
  png: l("Download PNG", "Télécharger le PNG"),
  dlSvg: l("Download SVG", "Télécharger le SVG"),
  pngFailed: l("Could not render the PNG.", "Impossible de générer le PNG."),
  alt: l("Placeholder", "Image de remplacement"),
};

function renderPng(p: Placeholder): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = p.w;
  canvas.height = p.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = cssColor(p.bg);
  ctx.fillRect(0, 0, p.w, p.h);
  ctx.fillStyle = cssColor(p.fg);
  ctx.font = canvasFont(p);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label(p), p.w / 2, p.h / 2);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

type Out = "svg" | "uri" | "base64" | "css" | "img";
const OUTS: Out[] = ["svg", "uri", "base64", "css", "img"];
const OUT_LABELS: Record<Out, ReturnType<typeof l>> = {
  svg: T.svg,
  uri: T.dataUri,
  base64: T.base64,
  css: T.css,
  img: T.img,
};

export default function SvgPlaceholder() {
  const out = useToolState<Out>("out", "svg");
  const raw = useToolState<Placeholder>("image", DEFAULT);
  const p = useComputed(() => cleanPlaceholder(raw.value)).value;
  const set = (patch: Partial<Placeholder>) => {
    raw.value = { ...p, ...patch };
  };
  const svg = placeholderSvg(p);
  const uri = svgDataUri(svg);
  const kind: Out = OUTS.includes(out.value) ? out.value : "svg";
  const outputs: Record<Out, string> = {
    svg,
    uri,
    base64: svgBase64Uri(svg),
    css: `background-image: url("${uri}");`,
    img: `<img src="${uri}" width="${p.w}" height="${p.h}" alt="">`,
  };

  return (
    <div class="design-split">
      <Panel title={tr(T.settings)}>
        <div class="grid-2">
          <NumberField
            label={tr(T.width)}
            value={p.w}
            min={1}
            max={MAX_SIDE}
            integer
            suffix="px"
            onChange={(w) => set({ w })}
          />
          <NumberField
            label={tr(T.height)}
            value={p.h}
            min={1}
            max={MAX_SIDE}
            integer
            suffix="px"
            onChange={(h) => set({ h })}
          />
        </div>
        <fieldset class="design-presets">
          <legend class="sr-only">{tr(T.sizes)}</legend>
          {SIZES.map((s) => (
            <button
              type="button"
              key={s.name.en}
              class="design-preset"
              aria-pressed={p.w === s.w && p.h === s.h}
              onClick={() => set({ w: s.w, h: s.h })}
            >
              {tr(s.name)}
            </button>
          ))}
        </fieldset>
        <div class="grid-2">
          <ColorField label={tr(T.bg)} value={p.bg} onInput={(bg) => set({ bg })} />
          <ColorField label={tr(T.fg)} value={p.fg} onInput={(fg) => set({ fg })} />
        </div>
        <Field label={tr(T.text)} hint={tr(T.textHint)}>
          <input
            class="input"
            value={p.text}
            placeholder={`${p.w}×${p.h}`}
            maxLength={200}
            onInput={(e) => set({ text: (e.currentTarget as HTMLInputElement).value })}
          />
        </Field>
        <div class="grid-2">
          <NumberField
            label={tr(T.size)}
            hint={tr(T.sizeHint)}
            value={p.size}
            min={0}
            max={1000}
            suffix="px"
            onChange={(size) => set({ size })}
          />
          <Select<Font>
            label={tr(T.font)}
            value={p.font}
            options={[
              { value: "sans", label: tr(T.sans) },
              { value: "serif", label: tr(T.serif) },
              { value: "mono", label: tr(T.mono) },
            ]}
            onChange={(font) => set({ font })}
          />
        </div>
        <Toggle label={tr(T.bold)} checked={p.bold} onChange={(bold) => set({ bold })} />
      </Panel>

      <div class="stack">
        <Panel
          title={tr(T.preview)}
          actions={
            <>
              <Button
                size="sm"
                variant="ghost"
                icon="download"
                onClick={() => downloadText(svg, fileName(p, "svg"), "image/svg+xml")}
              >
                {tr(T.dlSvg)}
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon="download"
                onClick={async () => {
                  const blob = await renderPng(p).catch(() => null);
                  if (blob) downloadBlob(blob, fileName(p, "png"));
                  else toast(tr(T.pngFailed), "error");
                }}
              >
                {tr(T.png)}
              </Button>
            </>
          }
        >
          <div class="svg-placeholder-stage">
            <img src={uri} width={p.w} height={p.h} alt={`${tr(T.alt)} ${p.w}×${p.h}`} />
          </div>
        </Panel>
        <Panel
          title={tr(T.output)}
          actions={
            <Segmented<Out>
              label={tr(T.output)}
              value={kind}
              options={OUTS.map((o) => ({ value: o, label: tr(OUT_LABELS[o]) }))}
              onChange={(v) => {
                out.value = v;
              }}
            />
          }
        >
          <Code label={tr(OUT_LABELS[kind])} code={outputs[kind]} />
        </Panel>
      </div>
    </div>
  );
}
