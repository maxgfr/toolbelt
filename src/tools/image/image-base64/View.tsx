import { useComputed, useSignal } from "@preact/signals";
import { useToolState } from "../../../app/state";
import {
  Button,
  CopyButton,
  downloadBlob,
  ErrorNote,
  FileDrop,
  Segmented,
  Stats,
  TextBox,
} from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { bytesBlob } from "../_dom";
import { attempt, formatSize, imageDims, type Size, sniffImage, stem } from "../_shared";
import { locale, UI, useObjectUrl, usePasteImage } from "../_ui";
import {
  bytesToBase64,
  cssSnippet,
  extFor,
  formatName,
  imgSnippet,
  markdownSnippet,
  overhead,
  parseImageInput,
} from "./logic";

type Mode = "encode" | "decode";

/** Above this many characters, the data URI is not put in a textarea (copy it instead). */
const SHOW_MAX = 500_000;

const T = {
  encode: l("Image → Base64", "Image → Base64", "Bild → Base64"),
  decode: l("Base64 → image", "Base64 → image", "Base64 → Bild"),
  uri: l("Data URI", "Data URI", "Data-URI"),
  format: l("Format", "Format", "Format"),
  dims: l("Dimensions", "Dimensions", "Abmessungen"),
  size: l("Image size", "Taille de l'image", "Bildgröße"),
  length: l("Base64 length", "Longueur Base64", "Base64-Länge"),
  overhead: l("Overhead", "Surcoût", "Mehraufwand"),
  chars: l("chars", "car.", "Zeichen"),
  copyB64: l("Copy Base64 only", "Copier le Base64 seul", "Nur Base64 kopieren"),
  copyUri: l("Copy data URI", "Copier la data URI", "Data-URI kopieren"),
  copyCss: l("Copy CSS background", "Copier le fond CSS", "CSS-Hintergrund kopieren"),
  copyImg: l("Copy <img> tag", "Copier la balise <img>", "<img>-Tag kopieren"),
  copyMd: l("Copy Markdown", "Copier en Markdown", "Als Markdown kopieren"),
  tooBig: l(
    "This data URI is too long to display; use the copy buttons.",
    "Cette data URI est trop longue pour être affichée ; utilise les boutons de copie.",
    "Diese Data-URI ist zu lang für die Anzeige; nutze die Kopier-Buttons.",
  ),
  bigWarn: l(
    "Inlined images over a few KB bloat HTML/CSS and are not cached separately: prefer a file for big images.",
    "Les images de plus de quelques Ko alourdissent le HTML/CSS et ne sont pas mises en cache à part : préfère un fichier pour les grosses images.",
    "Eingebettete Bilder über ein paar KB blähen HTML/CSS auf und werden nicht separat gecacht: Nimm für große Bilder lieber eine Datei.",
  ),
  input: l("Base64 or data URI", "Base64 ou data URI", "Base64 oder Data-URI"),
  inputPh: l(
    "Paste data:image/png;base64,iVBOR… or bare Base64",
    "Colle data:image/png;base64,iVBOR… ou du Base64 brut",
    "Füge data:image/png;base64,iVBOR… oder reines Base64 ein",
  ),
  download: l("Download the image", "Télécharger l'image", "Bild herunterladen"),
  preview: l("Image preview", "Aperçu de l'image", "Bildvorschau"),
  notImage: l(
    "This file is not a recognized image (PNG, JPEG, GIF, WebP, AVIF, SVG, BMP, ICO).",
    "Ce fichier n'est pas une image reconnue (PNG, JPEG, GIF, WebP, AVIF, SVG, BMP, ICO).",
    "Diese Datei ist kein erkanntes Bild (PNG, JPEG, GIF, WebP, AVIF, SVG, BMP, ICO).",
  ),
  empty: l(
    "Choose an image to turn it into Base64, a data URI and ready-to-paste CSS / HTML snippets.",
    "Choisis une image pour la transformer en Base64, en data URI et en extraits CSS / HTML prêts à coller.",
    "Wähle ein Bild, um es in Base64, eine Data-URI und einfügefertige CSS-/HTML-Snippets umzuwandeln.",
  ),
};

function useDims(bytes: Uint8Array | null) {
  const loaded = useSignal<Size | null>(null);
  const fromHeader = bytes ? imageDims(bytes) : null;
  return {
    dims: fromHeader ?? loaded.value,
    onLoad: (e: Event) => {
      const img = e.currentTarget as HTMLImageElement;
      loaded.value = img.naturalWidth ? { w: img.naturalWidth, h: img.naturalHeight } : null;
    },
  };
}

function Preview({ blob, onLoad }: { blob: Blob; onLoad: (e: Event) => void }) {
  const url = useObjectUrl(blob);
  return url ? (
    <figure class="image-preview image-checker">
      <img src={url} alt={tr(T.preview)} onLoad={onLoad} />
    </figure>
  ) : null;
}

interface Loaded {
  name: string;
  mime: string;
  bytes: Uint8Array;
  blob: Blob;
}

function Encoder() {
  const file = useSignal<Loaded | null>(null);
  const error = useSignal<string | null>(null);
  async function load(f: File) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const mime = sniffImage(bytes) || (f.type.startsWith("image/") ? f.type : "");
    if (!mime) {
      error.value = tr(T.notImage);
      return;
    }
    error.value = null;
    file.value = { name: f.name, mime, bytes, blob: bytesBlob(bytes, mime) };
  }
  usePasteImage(load);

  const f = file.value;
  const b64 = useComputed(() => (file.value ? bytesToBase64(file.value.bytes) : ""));
  const { dims, onLoad } = useDims(f?.bytes ?? null);
  const loc = locale();

  if (!f)
    return (
      <>
        <FileDrop
          accept="image/*,.svg,.ico"
          label={tr(UI.drop)}
          onFiles={(x) => x[0] && load(x[0])}
        />
        <ErrorNote error={error.value} />
        <p class="muted">
          {tr(T.empty)} {tr(UI.local)}
        </p>
      </>
    );

  const uri = `data:${f.mime};base64,${b64.value}`;
  const alt = stem(f.name);
  return (
    <>
      <FileDrop
        accept="image/*,.svg,.ico"
        label={`${f.name} · ${formatSize(f.bytes.length, loc)}`}
        onFiles={(x) => x[0] && load(x[0])}
      />
      <ErrorNote error={error.value} />
      <div class="image-base64-layout">
        <Preview blob={f.blob} onLoad={onLoad} />
        <div class="stack">
          <Stats
            items={[
              {
                label: tr(T.format),
                value: f.mime.startsWith("image/") ? formatName(f.mime) : f.mime,
              },
              { label: tr(T.dims), value: dims ? `${fmt(dims.w)} × ${fmt(dims.h)}` : "—" },
              { label: tr(T.size), value: formatSize(f.bytes.length, loc) },
              { label: tr(T.length), value: `${fmt(uri.length)} ${tr(T.chars)}` },
              {
                label: tr(T.overhead),
                value: `+${fmt(overhead(f.bytes.length, uri.length), { style: "percent", maximumFractionDigits: 1 })}`,
              },
            ]}
          />
          {f.bytes.length > 20_000 && <p class="image-warn small">{tr(T.bigWarn)}</p>}
          <div class="row">
            <CopyButton text={uri} label={tr(T.copyUri)} />
            <CopyButton text={() => b64.value} label={tr(T.copyB64)} />
            <CopyButton text={() => cssSnippet(uri)} label={tr(T.copyCss)} />
            <CopyButton
              text={() => imgSnippet(uri, dims?.w ?? null, dims?.h ?? null, alt)}
              label={tr(T.copyImg)}
            />
            <CopyButton text={() => markdownSnippet(uri, alt)} label={tr(T.copyMd)} />
          </div>
        </div>
      </div>
      {uri.length <= SHOW_MAX ? (
        <TextBox label={tr(T.uri)} value={uri} readOnly rows={6} downloadName={`${alt}.txt`} />
      ) : (
        <p class="muted small">{tr(T.tooBig)}</p>
      )}
    </>
  );
}

function Decoder() {
  const input = useSignal("");
  const parsed = useComputed(() =>
    input.value.trim() ? attempt(() => parseImageInput(input.value)) : null,
  );
  const p = parsed.value;
  const d = p?.ok ? p.value : null;
  const blob = useComputed(() => {
    const v = parsed.value;
    return v?.ok ? bytesBlob(v.value.bytes, v.value.mime) : null;
  }).value;
  const { dims, onLoad } = useDims(d?.bytes ?? null);
  const loc = locale();
  return (
    <>
      <TextBox
        label={tr(T.input)}
        value={input.value}
        onInput={(v) => {
          input.value = v;
        }}
        placeholder={tr(T.inputPh)}
        rows={6}
        files={false}
        invalid={p ? !p.ok : false}
        note={p && !p.ok && <span class="error">{tr(p.error)}</span>}
      />
      {d && blob && (
        <div class="image-base64-layout">
          <Preview blob={blob} onLoad={onLoad} />
          <div class="stack">
            <Stats
              items={[
                { label: tr(T.format), value: formatName(d.mime) },
                { label: tr(T.dims), value: dims ? `${fmt(dims.w)} × ${fmt(dims.h)}` : "—" },
                { label: tr(T.size), value: formatSize(d.bytes.length, loc) },
              ]}
            />
            <div class="row">
              <Button
                variant="primary"
                icon="download"
                onClick={() => downloadBlob(blob, `image.${extFor(d.mime)}`)}
              >
                {tr(T.download)} · image.{extFor(d.mime)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ImageBase64() {
  const mode = useToolState<Mode>("mode", "encode");
  return (
    <div class="stack">
      <Segmented<Mode>
        value={mode.value}
        onChange={(v) => {
          mode.value = v;
        }}
        options={[
          { value: "encode", label: tr(T.encode) },
          { value: "decode", label: tr(T.decode) },
        ]}
      />
      {mode.value === "encode" ? <Encoder /> : <Decoder />}
    </div>
  );
}
