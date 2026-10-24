import { useComputed, useSignal } from "@preact/signals";
import { useToolState } from "../../../app/state";
import {
  Button,
  CopyButton,
  downloadBlob,
  downloadText,
  ErrorNote,
  Field,
  FileDrop,
  Segmented,
  Stats,
  TextBox,
} from "../../../app/ui";
import { fmt, l, locale, tr } from "../../../i18n";
import { attempt, formatSize, isUtf8 } from "../_shared";
import {
  buildDataUri,
  cssUrl,
  type DataEncoding,
  extFromMime,
  imgTag,
  isTextMime,
  mimeFromName,
  overhead,
  parseDataUri,
} from "./logic";

type Mode = "encode" | "decode";

/** Above this, the URI is not put in a textarea (it would freeze the page); copy it instead. */
const SHOW_MAX = 500_000;

const T = {
  encode: l("File → data URI", "Fichier → data URI", "Datei → Data-URI"),
  decode: l("Data URI → file", "Data URI → fichier", "Data-URI → Datei"),
  drop: l(
    "Drop a file here, or click to choose",
    "Dépose un fichier ici, ou clique pour choisir",
    "Datei hier ablegen oder klicken, um eine auszuwählen",
  ),
  mime: l("MIME type", "Type MIME", "MIME-Typ"),
  encoding: l("Encoding", "Encodage", "Kodierung"),
  percent: l(
    "Percent (text, smaller for SVG)",
    "Pourcent (texte, plus court pour le SVG)",
    "Prozent (Text, kürzer bei SVG)",
  ),
  uri: l("Data URI", "Data URI", "Data-URI"),
  file: l("File", "Fichier", "Datei"),
  fileSize: l("File size", "Taille du fichier", "Dateigröße"),
  uriLength: l("URI length", "Longueur de l'URI", "URI-Länge"),
  overhead: l("Overhead", "Surcoût", "Mehraufwand"),
  chars: l("chars", "car.", "Zeichen"),
  copyCss: l("Copy as CSS url()", "Copier en url() CSS", "Als CSS-url() kopieren"),
  copyImg: l("Copy as HTML img tag", "Copier en balise HTML img", "Als HTML-img-Tag kopieren"),
  copyUri: l("Copy the URI", "Copier l'URI", "URI kopieren"),
  downloadTxt: l("Download as .txt", "Télécharger en .txt", "Als .txt herunterladen"),
  tooBig: l(
    "This URI is too long to display; copy or download it.",
    "Cette URI est trop longue pour être affichée ; copie-la ou télécharge-la.",
    "Diese URI ist zu lang für die Anzeige; kopiere sie oder lade sie herunter.",
  ),
  bigWarn: l(
    "Data URIs over a few hundred KB slow pages down and are not cached: prefer a separate file.",
    "Les data URI de plus de quelques centaines de Ko ralentissent les pages et ne sont pas mises en cache : préfère un fichier séparé.",
    "Data-URIs über einigen hundert KB bremsen Seiten aus und werden nicht gecacht: Nimm lieber eine eigene Datei.",
  ),
  preview: l("Preview", "Aperçu", "Vorschau"),
  inputPh: l(
    "Paste a data URI, e.g. data:image/png;base64,iVBORw0…",
    "Colle une data URI, par ex. data:image/png;base64,iVBORw0…",
    "Data-URI einfügen, z. B. data:image/png;base64,iVBORw0…",
  ),
  charset: l("Charset", "Jeu de caractères", "Zeichensatz"),
  size: l("Size", "Taille", "Größe"),
  fileName: l("File name", "Nom du fichier", "Dateiname"),
  download: l("Download the file", "Télécharger le fichier", "Datei herunterladen"),
  content: l("Content", "Contenu", "Inhalt"),
  emptyEncode: l(
    "Choose a file to turn it into a data URI. It stays on your device.",
    "Choisis un fichier pour le transformer en data URI. Il reste sur ton appareil.",
    "Wähle eine Datei, um sie in eine Data-URI umzuwandeln. Sie bleibt auf deinem Gerät.",
  ),
};

interface Loaded {
  name: string;
  bytes: Uint8Array;
}

function Encoder() {
  const file = useSignal<Loaded | null>(null);
  const mime = useSignal("");
  const encoding = useToolState<DataEncoding>("encoding", "base64");

  const result = useComputed(() => {
    const f = file.value;
    if (!f) return null;
    const enc = encoding.value === "percent" && !isUtf8(f.bytes) ? "base64" : encoding.value;
    return attempt(() => buildDataUri(f.bytes, mime.value, enc));
  });

  const f = file.value;
  const r = result.value;
  const uri = r?.ok ? r.value : "";
  const textOk = f ? isUtf8(f.bytes) && isTextMime(mime.value) : false;

  return (
    <>
      <FileDrop
        label={f ? `${f.name} · ${formatSize(f.bytes.length, locale())}` : tr(T.drop)}
        onFiles={async (list) => {
          const x = list[0];
          if (!x) return;
          mime.value = x.type || mimeFromName(x.name);
          file.value = { name: x.name, bytes: new Uint8Array(await x.arrayBuffer()) };
        }}
      />
      {!f ? (
        <p class="muted">{tr(T.emptyEncode)}</p>
      ) : (
        <>
          <div class="row">
            <Field label={tr(T.mime)} class="data-uri-mime">
              <input
                class="input mono"
                value={mime.value}
                onInput={(e) => {
                  mime.value = (e.currentTarget as HTMLInputElement).value;
                }}
              />
            </Field>
            {textOk && (
              <Segmented<DataEncoding>
                label={tr(T.encoding)}
                value={encoding.value}
                onChange={(v) => {
                  encoding.value = v;
                }}
                options={[
                  { value: "base64", label: "Base64" },
                  { value: "percent", label: tr(T.percent) },
                ]}
              />
            )}
          </div>
          {r && !r.ok && <ErrorNote error={tr(r.error)} />}
          {uri && (
            <>
              <Stats
                items={[
                  { label: tr(T.fileSize), value: formatSize(f.bytes.length, locale()) },
                  { label: tr(T.uriLength), value: `${fmt(uri.length)} ${tr(T.chars)}` },
                  {
                    label: tr(T.overhead),
                    value: `+${fmt(overhead(f.bytes.length, uri.length), { style: "percent", maximumFractionDigits: 1 })}`,
                  },
                ]}
              />
              {uri.length > 200_000 && <p class="data-uri-warn small">{tr(T.bigWarn)}</p>}
              {uri.length <= SHOW_MAX ? (
                <TextBox label={tr(T.uri)} value={uri} readOnly rows={8} />
              ) : (
                <p class="muted small">{tr(T.tooBig)}</p>
              )}
              <div class="row">
                {uri.length > SHOW_MAX && <CopyButton text={uri} label={tr(T.copyUri)} />}
                <CopyButton text={() => cssUrl(uri)} label={tr(T.copyCss)} />
                <CopyButton text={() => imgTag(uri, f.name)} label={tr(T.copyImg)} />
                <Button
                  size="sm"
                  variant="ghost"
                  icon="download"
                  onClick={() => downloadText(uri, `${f.name}.txt`)}
                >
                  {tr(T.downloadTxt)}
                </Button>
              </div>
              {mime.value.startsWith("image/") && (
                <figure class="data-uri-preview">
                  <img src={uri} alt={tr(T.preview)} />
                </figure>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function Decoder() {
  const input = useToolState("uri", "");
  const name = useToolState("name", "file");
  const parsed = useComputed(() =>
    input.value.trim() ? attempt(() => parseDataUri(input.value)) : null,
  );
  const p = parsed.value;
  const d = p?.ok ? p.value : null;
  const ext = d ? extFromMime(d.mime) : "bin";
  const stem = name.value.trim().replace(/\.[^.]*$/, "") || "file";
  const textContent =
    d && isTextMime(d.mime) && isUtf8(d.bytes) && d.bytes.length <= SHOW_MAX
      ? new TextDecoder().decode(d.bytes)
      : null;
  const preview = d?.mime.startsWith("image/") ? buildDataUri(d.bytes, d.mime, "base64") : null;

  return (
    <>
      <TextBox
        label={tr(T.uri)}
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
      {d && (
        <>
          <Stats
            items={[
              { label: tr(T.mime), value: d.mime },
              { label: tr(T.encoding), value: d.base64 ? "Base64" : "Percent" },
              { label: tr(T.charset), value: d.charset ?? "—" },
              { label: tr(T.size), value: formatSize(d.bytes.length, locale()) },
            ]}
          />
          <div class="row">
            <Field label={tr(T.fileName)} class="data-uri-name">
              <input
                class="input mono"
                value={name.value}
                onInput={(e) => {
                  name.value = (e.currentTarget as HTMLInputElement).value;
                }}
              />
            </Field>
            <Button
              variant="primary"
              icon="download"
              class="data-uri-dl"
              onClick={() =>
                downloadBlob(
                  new Blob([d.bytes as Uint8Array<ArrayBuffer>], { type: d.mime }),
                  `${stem}.${ext}`,
                )
              }
            >
              {tr(T.download)} · {stem}.{ext}
            </Button>
          </div>
          {preview && (
            <figure class="data-uri-preview">
              <img src={preview} alt={tr(T.preview)} />
            </figure>
          )}
          {textContent != null && (
            <TextBox label={tr(T.content)} value={textContent} readOnly rows={8} />
          )}
        </>
      )}
    </>
  );
}

export default function DataUriTool() {
  const mode = useToolState<Mode>("mode", "encode");
  return (
    <>
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
    </>
  );
}
