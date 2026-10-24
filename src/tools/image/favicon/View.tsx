import { useSignal, useSignalEffect } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import {
  Button,
  downloadBlob,
  ErrorNote,
  Field,
  FileDrop,
  Segmented,
  TextBox,
  Toggle,
} from "../../../app/ui";
import { l, tr } from "../../../i18n";
import {
  blobBytes,
  bytesBlob,
  ctx2d,
  type Decoded,
  decodeImage,
  drawScaled,
  encodeCanvas,
  makeCanvas,
} from "../_dom";
import { zipStore } from "../_shared";
import { errText, UI, usePasteImage } from "../_ui";
import {
  containRect,
  fitFontSize,
  ICO_SIZES,
  ICON_FILES,
  iconLayout,
  linkTags,
  manifest,
  writeIco,
} from "./logic";

type Source = "text" | "image";
type Font = "sans" | "serif" | "mono" | "rounded";

const FONTS: Record<Font, string> = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  rounded: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif',
};
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';

const T = {
  source: l("Source", "Source", "Quelle"),
  text: l("Text or emoji", "Texte ou emoji", "Text oder Emoji"),
  image: l("Image or SVG", "Image ou SVG", "Bild oder SVG"),
  textLabel: l("Letters or emoji", "Lettres ou emoji", "Buchstaben oder Emoji"),
  font: l("Font", "Police", "Schrift"),
  sans: l("Sans-serif", "Sans empattement", "Serifenlos"),
  serif: l("Serif", "Avec empattement", "Mit Serifen"),
  mono: l("Monospace", "Chasse fixe", "Festbreite"),
  rounded: l("Rounded", "Arrondie", "Abgerundet"),
  bold: l("Bold", "Gras", "Fett"),
  color: l("Text color", "Couleur du texte", "Textfarbe"),
  bg: l("Background", "Fond", "Hintergrund"),
  transparent: l("Transparent background", "Fond transparent", "Transparenter Hintergrund"),
  radius: l("Corner radius", "Arrondi des coins", "Eckenradius"),
  padding: l("Padding", "Marge intérieure", "Innenabstand"),
  name: l("Site name", "Nom du site", "Name der Website"),
  shortName: l("Short name", "Nom court", "Kurzname"),
  theme: l("Theme color", "Couleur du thème", "Designfarbe"),
  zip: l("Download all (ZIP)", "Tout télécharger (ZIP)", "Alle herunterladen (ZIP)"),
  ico: l("favicon.ico (16, 32, 48)", "favicon.ico (16, 32, 48)", "favicon.ico (16, 32, 48)"),
  tags: l("HTML <head> tags", "Balises HTML du <head>", "HTML-Tags für <head>"),
  manifest: l("site.webmanifest", "site.webmanifest", "site.webmanifest"),
  previews: l("Preview", "Aperçu", "Vorschau"),
  tab: l("Browser tab", "Onglet du navigateur", "Browser-Tab"),
  mySite: l("My site", "Mon site", "Meine Website"),
  pickImage: l(
    "Drop an image or SVG here, click to choose, or paste one (⌘V / Ctrl+V). Square images work best.",
    "Dépose une image ou un SVG ici, clique pour choisir, ou colle-la (⌘V / Ctrl+V). Les images carrées rendent le mieux.",
    "Zieh ein Bild oder SVG hierher, klicke zum Auswählen oder füge eines ein (⌘V / Strg+V). Quadratische Bilder eignen sich am besten.",
  ),
  noImage: l(
    "Choose an image to build the icons.",
    "Choisis une image pour fabriquer les icônes.",
    "Wähle ein Bild, um die Icons zu erstellen.",
  ),
  where: l(
    "Put the files at the root of your site, then paste the tags in <head>.",
    "Place les fichiers à la racine du site, puis colle les balises dans le <head>.",
    "Leg die Dateien ins Stammverzeichnis deiner Website und füge die Tags dann in <head> ein.",
  ),
};

interface Png {
  size: number;
  name: string;
  blob: Blob;
  url: string;
}

interface Settings {
  source: Source;
  text: string;
  font: Font;
  bold: boolean;
  color: string;
  bg: string;
  transparent: boolean;
  radius: number;
  padding: number;
}

function render(size: number, s: Settings, img: Decoded | null): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const ctx = ctx2d(c);
  const L = iconLayout(size, s.padding, s.radius);
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, L.radius);
  if (!s.transparent) {
    ctx.fillStyle = s.bg;
    ctx.fill();
  }
  ctx.clip();
  if (s.source === "image" && img) {
    const r = containRect(img.width, img.height, L.x, L.y, L.box);
    const w = Math.max(1, Math.round(r.w));
    const h = Math.max(1, Math.round(r.h));
    const scaled = drawScaled(img.source, img.width, img.height, w, h);
    ctx.drawImage(scaled, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2);
  } else if (s.source === "text" && s.text.trim()) {
    const text = s.text.trim();
    const family = `${FONTS[s.font]}, ${EMOJI}`;
    const weight = s.bold ? "700" : "400";
    ctx.font = `${weight} 100px ${family}`;
    let m = ctx.measureText(text);
    const fs = fitFontSize(
      m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
      m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
      L.box,
    );
    ctx.font = `${weight} ${fs}px ${family}`;
    m = ctx.measureText(text);
    const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    ctx.fillStyle = s.color;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillText(
      text,
      L.x + (L.box - w) / 2 + m.actualBoundingBoxLeft,
      L.y + (L.box - h) / 2 + m.actualBoundingBoxAscent,
    );
  }
  return c;
}

function Range({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label class="field">
      <span class="field-label">
        {label} · {value} %
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onInput={(e) => onChange(Number((e.currentTarget as HTMLInputElement).value))}
      />
    </label>
  );
}

export default function Favicon() {
  const source = useToolState<Source>("source", "text");
  const text = useToolState("text", "T");
  const font = useToolState<Font>("font", "sans");
  const bold = useToolState("bold", true);
  const color = useToolState("color", "#ffffff");
  const bg = useToolState("bg", "#0f766e");
  const transparent = useToolState("transparent", false);
  const radius = useToolState("radius", 20);
  const padding = useToolState("padding", 10);
  const name = useToolState("name", "");
  const shortName = useToolState("shortName", "");
  const theme = useToolState("theme", "#0f766e");

  const img = useSignal<Decoded | null>(null);
  const imgName = useSignal("");
  const pngs = useSignal<Png[]>([]);
  const error = useSignal<string | null>(null);
  const run = useRef(0);

  async function load(f: File) {
    error.value = null;
    try {
      const d = await decodeImage(f, f.name);
      img.peek()?.close();
      img.value = d;
      imgName.value = f.name;
      source.value = "image";
    } catch (err) {
      error.value = errText(err);
    }
  }
  usePasteImage(load);

  useEffect(
    () => () => {
      img.peek()?.close();
      for (const p of pngs.peek()) URL.revokeObjectURL(p.url);
    },
    [],
  );

  useSignalEffect(() => {
    const s: Settings = {
      source: source.value,
      text: text.value,
      font: font.value,
      bold: bold.value,
      color: color.value,
      bg: bg.value,
      transparent: transparent.value,
      radius: radius.value,
      padding: padding.value,
    };
    const image = img.value;
    const id = ++run.current;
    const timer = setTimeout(async () => {
      try {
        const out: Png[] = [];
        for (const f of ICON_FILES) {
          const blob = await encodeCanvas(render(f.size, s, image), "png");
          out.push({ ...f, blob, url: URL.createObjectURL(blob) });
        }
        if (id !== run.current) {
          for (const p of out) URL.revokeObjectURL(p.url);
          return;
        }
        for (const p of pngs.peek()) URL.revokeObjectURL(p.url);
        pngs.value = out;
        error.value = null;
      } catch (err) {
        if (id === run.current) error.value = errText(err);
      }
    }, 120);
    return () => clearTimeout(timer);
  });

  const icoSizes = () => pngs.value.filter((p) => ICO_SIZES.includes(p.size));

  async function ico(): Promise<Uint8Array> {
    return writeIco(
      await Promise.all(
        icoSizes().map(async (p) => ({ size: p.size, png: await blobBytes(p.blob) })),
      ),
    );
  }

  const manifestText = manifest({
    name: name.value || tr(T.mySite),
    shortName: shortName.value,
    themeColor: theme.value,
    backgroundColor: transparent.value ? "#ffffff" : bg.value,
  });
  const tags = linkTags(theme.value);

  async function downloadZip() {
    const enc = new TextEncoder();
    const files = await Promise.all(
      pngs.value.map(async (p) => ({ name: p.name, data: await blobBytes(p.blob) })),
    );
    files.push({ name: "favicon.ico", data: await ico() });
    files.push({ name: "site.webmanifest", data: enc.encode(manifestText) });
    files.push({ name: "head.html", data: enc.encode(`${tags}\n`) });
    downloadBlob(bytesBlob(zipStore(files), "application/zip"), "favicon.zip");
  }

  const ready = pngs.value.length > 0 && !(source.value === "image" && !img.value);
  const tab = pngs.value.find((p) => p.size === 32);

  return (
    <div class="favicon-layout">
      <div class="stack">
        <Segmented<Source>
          label={tr(T.source)}
          value={source.value}
          onChange={(v) => {
            source.value = v;
          }}
          options={[
            { value: "text", label: tr(T.text) },
            { value: "image", label: tr(T.image) },
          ]}
        />
        {source.value === "image" ? (
          <FileDrop
            accept="image/*,.svg"
            label={imgName.value || tr(T.pickImage)}
            onFiles={(f) => f[0] && load(f[0])}
          />
        ) : (
          <div class="grid-2">
            <Field label={tr(T.textLabel)}>
              <input
                class="input"
                value={text.value}
                maxLength={8}
                onInput={(e) => {
                  text.value = (e.currentTarget as HTMLInputElement).value;
                }}
              />
            </Field>
            <Select<Font>
              label={tr(T.font)}
              value={font.value}
              onChange={(v) => {
                font.value = v;
              }}
              options={(["sans", "serif", "mono", "rounded"] as Font[]).map((f) => ({
                value: f,
                label: tr(T[f]),
              }))}
            />
            <Field label={tr(T.color)} class="image-color-field">
              <input
                type="color"
                value={color.value}
                onInput={(e) => {
                  color.value = (e.currentTarget as HTMLInputElement).value;
                }}
              />
            </Field>
            <div class="image-toggle-cell">
              <Toggle
                checked={bold.value}
                onChange={(v) => {
                  bold.value = v;
                }}
                label={tr(T.bold)}
              />
            </div>
          </div>
        )}
        <div class="grid-2">
          <Field label={tr(T.bg)} class="image-color-field">
            <input
              type="color"
              value={bg.value}
              disabled={transparent.value}
              onInput={(e) => {
                bg.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
          <div class="image-toggle-cell">
            <Toggle
              checked={transparent.value}
              onChange={(v) => {
                transparent.value = v;
              }}
              label={tr(T.transparent)}
            />
          </div>
          <Range
            label={tr(T.radius)}
            value={radius.value}
            max={50}
            onChange={(v) => {
              radius.value = v;
            }}
          />
          <Range
            label={tr(T.padding)}
            value={padding.value}
            max={40}
            onChange={(v) => {
              padding.value = v;
            }}
          />
        </div>
        <ErrorNote error={error.value} />
        <div class="grid-3">
          <Field label={tr(T.name)}>
            <input
              class="input"
              value={name.value}
              placeholder={tr(T.mySite)}
              onInput={(e) => {
                name.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
          <Field label={tr(T.shortName)}>
            <input
              class="input"
              value={shortName.value}
              onInput={(e) => {
                shortName.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
          <Field label={tr(T.theme)} class="image-color-field">
            <input
              type="color"
              value={theme.value}
              onInput={(e) => {
                theme.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
        </div>
        <TextBox label={tr(T.tags)} value={tags} readOnly rows={6} />
        <TextBox
          label={tr(T.manifest)}
          value={manifestText}
          readOnly
          rows={8}
          downloadName="site.webmanifest"
        />
        <p class="muted small">{tr(T.where)}</p>
      </div>

      <div class="stack favicon-side">
        {!ready ? (
          <div class="favicon-placeholder muted">
            {tr(source.value === "image" ? T.noImage : UI.working)}
          </div>
        ) : (
          <>
            {tab && (
              <div class="favicon-tab" title={tr(T.tab)}>
                <img src={tab.url} width={16} height={16} alt="" />
                <span>{name.value || tr(T.mySite)}</span>
              </div>
            )}
            <div class="favicon-grid">
              {pngs.value.map((p) => (
                <button
                  type="button"
                  key={p.size}
                  class="favicon-cell"
                  title={p.name}
                  onClick={() => downloadBlob(p.blob, p.name)}
                >
                  <span class="favicon-img image-checker">
                    <img
                      src={p.url}
                      alt={p.name}
                      style={{
                        width: `${Math.min(p.size, 96)}px`,
                        height: `${Math.min(p.size, 96)}px`,
                      }}
                    />
                  </span>
                  <span class="small mono">
                    {p.size}×{p.size}
                  </span>
                </button>
              ))}
            </div>
            <Button variant="primary" icon="download" onClick={downloadZip}>
              {tr(T.zip)}
            </Button>
            <Button
              icon="download"
              onClick={async () =>
                downloadBlob(bytesBlob(await ico(), "image/x-icon"), "favicon.ico")
              }
            >
              {tr(T.ico)}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
