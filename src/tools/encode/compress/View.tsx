import { useSignal } from "@preact/signals";
import { Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import {
  Button,
  downloadBlob,
  ErrorNote,
  FileDrop,
  Segmented,
  Stats,
  TextBox,
} from "../../../app/ui";
import { fmt, l, locale, tr } from "../../../i18n";
import { formatSize, utf8 } from "../_shared";
import { useAsync } from "../_ui";
import {
  asText,
  bytesToText,
  compress,
  compressedName,
  decompress,
  decompressAuto,
  decompressedName,
  type Format,
  formatName,
  type GzipHeader,
  gzipHeader,
  ratio,
  type TextEncoding,
  textToBytes,
} from "./logic";

type Mode = "compress" | "decompress";
type Source = "text" | "file";
type FormatChoice = Format | "auto";

/** Outputs longer than this are not put in a textarea (it would freeze the page). */
const SHOW_MAX = 1_000_000;

const T = {
  mode: l("Mode", "Mode", "Modus"),
  compress: l("Compress", "Compresser", "Komprimieren"),
  decompress: l("Decompress", "Décompresser", "Dekomprimieren"),
  source: l("Source", "Source", "Quelle"),
  text: l("Text", "Texte", "Text"),
  file: l("File", "Fichier", "Datei"),
  format: l("Format", "Format", "Format"),
  auto: l("Detect automatically", "Détecter automatiquement", "Automatisch erkennen"),
  gzip: l("gzip (.gz)", "gzip (.gz)", "gzip (.gz)"),
  deflate: l("zlib / deflate (.zz)", "zlib / deflate (.zz)", "zlib / deflate (.zz)"),
  raw: l("Raw deflate (no header)", "Deflate brut (sans en-tête)", "Rohes Deflate (ohne Header)"),
  outEnc: l("Output as", "Sortie en", "Ausgabe als"),
  hex: l("Hex", "Hexa", "Hex"),
  input: l("Text to compress", "Texte à compresser", "Zu komprimierender Text"),
  inputPh: l("Type or paste text…", "Tape ou colle du texte…", "Text eingeben oder einfügen…"),
  packed: l(
    "Compressed data (Base64 or hex)",
    "Données compressées (Base64 ou hexa)",
    "Komprimierte Daten (Base64 oder hex)",
  ),
  packedPh: l(
    "Paste gzip, zlib or deflate data as Base64 or hex, e.g. H4sIAAAAAAAA…",
    "Colle des données gzip, zlib ou deflate en Base64 ou hexa, par ex. H4sIAAAAAAAA…",
    "gzip-, zlib- oder deflate-Daten als Base64 oder hex einfügen, z. B. H4sIAAAAAAAA…",
  ),
  output: l("Compressed", "Compressé", "Komprimiert"),
  result: l("Decompressed text", "Texte décompressé", "Dekomprimierter Text"),
  drop: l(
    "Drop a file here, or click to choose",
    "Dépose un fichier ici, ou clique pour choisir",
    "Datei hier ablegen oder klicken, um eine auszuwählen",
  ),
  inSize: l("Input", "Entrée", "Eingabe"),
  outSize: l("Output", "Sortie", "Ausgabe"),
  ratio: l("Output / input", "Sortie / entrée", "Ausgabe / Eingabe"),
  saved: l("Saved", "Gain", "Ersparnis"),
  detected: l("Format", "Format", "Format"),
  storedName: l("Stored name", "Nom stocké", "Gespeicherter Name"),
  modified: l("Modified", "Modifié", "Geändert"),
  download: l("Download {name}", "Télécharger {name}", "{name} herunterladen"),
  binary: l(
    "The result is not UTF-8 text ({size}): download it as a file.",
    "Le résultat n'est pas du texte UTF-8 ({size}) : télécharge-le comme fichier.",
    "Das Ergebnis ist kein UTF-8-Text ({size}): Lade es als Datei herunter.",
  ),
  tooBig: l(
    "The result is too large to display: download it.",
    "Le résultat est trop gros pour être affiché : télécharge-le.",
    "Das Ergebnis ist zu groß für die Anzeige: Lade es herunter.",
  ),
  busy: l("Working…", "En cours…", "Wird verarbeitet…"),
  note: l(
    "Uses the browser's own CompressionStream. gzip and zlib add a checksum; raw deflate has none.",
    "Utilise le CompressionStream du navigateur. gzip et zlib ajoutent une somme de contrôle ; le deflate brut n'en a pas.",
    "Nutzt den eingebauten CompressionStream des Browsers. gzip und zlib fügen eine Prüfsumme hinzu, rohes Deflate nicht.",
  ),
};

interface Loaded {
  name: string;
  bytes: Uint8Array;
}

interface Done {
  input: number;
  bytes: Uint8Array;
  format: Format;
  header: GzipHeader | null;
}

function download(bytes: Uint8Array, name: string): void {
  downloadBlob(new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }), name);
}

export default function Compress() {
  const mode = useToolState<Mode>("mode", "compress");
  const source = useToolState<Source>("source", "text");
  const format = useToolState<Format>("format", "gzip");
  const unFormat = useToolState<FormatChoice>("unformat", "auto");
  const outEnc = useToolState<TextEncoding>("enc", "base64");
  const text = useToolState("text", "");
  const packed = useToolState("packed", "");
  const file = useSignal<Loaded | null>(null);

  const job = useAsync<Done>(() => {
    const isComp = mode.value === "compress";
    const fmtChoice = isComp ? format.value : unFormat.value;
    let input: Uint8Array;
    if (source.value === "file") {
      const f = file.value;
      if (!f) return null;
      input = f.bytes;
    } else if (isComp) {
      if (!text.value) return null;
      input = utf8(text.value);
    } else {
      if (!packed.value.trim()) return null;
      input = textToBytes(packed.value, "auto");
    }
    if (isComp)
      return compress(input, fmtChoice as Format).then((bytes) => ({
        input: input.length,
        bytes,
        format: fmtChoice as Format,
        header: null,
      }));
    const header = gzipHeader(input);
    const run =
      fmtChoice === "auto"
        ? decompressAuto(input)
        : decompress(input, fmtChoice).then((bytes) => ({ format: fmtChoice, bytes }));
    return run.then((r) => ({ input: input.length, bytes: r.bytes, format: r.format, header }));
  });

  const isComp = mode.value === "compress";
  const isFile = source.value === "file";
  const f = file.value;
  const r = job.value.value;
  const err = job.value.error;
  const nameIn = f?.name ?? "data";

  const formatOptions = [
    { value: "gzip" as const, label: tr(T.gzip) },
    { value: "deflate" as const, label: tr(T.deflate) },
    { value: "deflate-raw" as const, label: tr(T.raw) },
  ];

  const stats = r
    ? [
        { label: tr(T.inSize), value: formatSize(r.input, locale()) },
        { label: tr(T.outSize), value: formatSize(r.bytes.length, locale()) },
        ...(isComp
          ? [
              {
                label: tr(T.ratio),
                value: (() => {
                  const q = ratio(r.input, r.bytes.length);
                  return q === null ? "—" : fmt(q, { style: "percent", maximumFractionDigits: 1 });
                })(),
              },
            ]
          : [{ label: tr(T.detected), value: formatName(r.format) }]),
        ...(r.header?.name ? [{ label: tr(T.storedName), value: r.header.name }] : []),
        ...(r.header?.mtime
          ? [{ label: tr(T.modified), value: r.header.mtime.toLocaleString(locale()) }]
          : []),
      ]
    : [];

  const outName = r
    ? isComp
      ? compressedName(isFile ? nameIn : "text.txt", r.format)
      : decompressedName(isFile ? nameIn : "data.gz", r.header)
    : "";
  const decodedText = r && !isComp && !isFile ? asText(r.bytes) : null;

  return (
    <>
      <div class="row">
        <Segmented<Mode>
          label={tr(T.mode)}
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
            file.value = null;
          }}
          options={[
            { value: "compress", label: tr(T.compress) },
            { value: "decompress", label: tr(T.decompress) },
          ]}
        />
        <Segmented<Source>
          label={tr(T.source)}
          value={source.value}
          onChange={(v) => {
            source.value = v;
          }}
          options={[
            { value: "text", label: tr(T.text) },
            { value: "file", label: tr(T.file) },
          ]}
        />
      </div>

      <div class="grid-2">
        {isComp ? (
          <Select<Format>
            label={tr(T.format)}
            value={format.value}
            onChange={(v) => {
              format.value = v;
            }}
            options={formatOptions}
          />
        ) : (
          <Select<FormatChoice>
            label={tr(T.format)}
            value={unFormat.value}
            onChange={(v) => {
              unFormat.value = v;
            }}
            options={[{ value: "auto", label: tr(T.auto) }, ...formatOptions]}
          />
        )}
      </div>

      {isFile ? (
        <FileDrop
          label={f ? `${f.name} · ${formatSize(f.bytes.length, locale())}` : tr(T.drop)}
          onFiles={async (list) => {
            const x = list[0];
            if (x) file.value = { name: x.name, bytes: new Uint8Array(await x.arrayBuffer()) };
          }}
        />
      ) : isComp ? (
        <TextBox
          label={tr(T.input)}
          value={text.value}
          onInput={(v) => {
            text.value = v;
          }}
          placeholder={tr(T.inputPh)}
          rows={6}
        />
      ) : (
        <TextBox
          label={tr(T.packed)}
          value={packed.value}
          onInput={(v) => {
            packed.value = v;
          }}
          placeholder={tr(T.packedPh)}
          rows={6}
          invalid={!!err}
        />
      )}

      <ErrorNote error={err} />
      {job.value.busy && !r && <p class="muted small">{tr(T.busy)}</p>}

      {r && (
        <>
          <Stats items={stats} />
          {isComp && !isFile && r.bytes.length * 2 > SHOW_MAX && (
            <p class="muted small">{tr(T.tooBig)}</p>
          )}
          {isComp && !isFile && r.bytes.length * 2 <= SHOW_MAX && (
            <TextBox
              label={tr(T.output)}
              value={bytesToText(r.bytes, outEnc.value)}
              readOnly
              rows={5}
              actions={
                <Segmented<TextEncoding>
                  label={tr(T.outEnc)}
                  value={outEnc.value}
                  onChange={(v) => {
                    outEnc.value = v;
                  }}
                  options={[
                    { value: "base64", label: "Base64" },
                    { value: "hex", label: tr(T.hex) },
                  ]}
                />
              }
            />
          )}
          {decodedText !== null &&
            (decodedText.length <= SHOW_MAX ? (
              <TextBox label={tr(T.result)} value={decodedText} readOnly rows={8} mono={false} />
            ) : (
              <p class="muted small">{tr(T.tooBig)}</p>
            ))}
          {!isComp && !isFile && decodedText === null && (
            <p class="muted small">
              {tr(T.binary).replace("{size}", formatSize(r.bytes.length, locale()))}
            </p>
          )}
          {(isFile ||
            (decodedText !== null && decodedText.length > SHOW_MAX) ||
            (!isComp && decodedText === null) ||
            (isComp && r.bytes.length * 2 > SHOW_MAX)) && (
            <div class="row">
              <Button variant="primary" icon="download" onClick={() => download(r.bytes, outName)}>
                {tr(T.download).replace("{name}", outName)}
              </Button>
            </div>
          )}
        </>
      )}

      <p class="muted small">{tr(T.note)}</p>
    </>
  );
}
