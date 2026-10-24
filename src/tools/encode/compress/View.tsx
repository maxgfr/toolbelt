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
import { fmt, l, lang, tr } from "../../../i18n";
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
  mode: l("Mode", "Mode"),
  compress: l("Compress", "Compresser"),
  decompress: l("Decompress", "Décompresser"),
  source: l("Source", "Source"),
  text: l("Text", "Texte"),
  file: l("File", "Fichier"),
  format: l("Format", "Format"),
  auto: l("Detect automatically", "Détecter automatiquement"),
  gzip: l("gzip (.gz)", "gzip (.gz)"),
  deflate: l("zlib / deflate (.zz)", "zlib / deflate (.zz)"),
  raw: l("Raw deflate (no header)", "Deflate brut (sans en-tête)"),
  outEnc: l("Output as", "Sortie en"),
  hex: l("Hex", "Hexa"),
  input: l("Text to compress", "Texte à compresser"),
  inputPh: l("Type or paste text…", "Tape ou colle du texte…"),
  packed: l("Compressed data (Base64 or hex)", "Données compressées (Base64 ou hexa)"),
  packedPh: l(
    "Paste gzip, zlib or deflate data as Base64 or hex, e.g. H4sIAAAAAAAA…",
    "Colle des données gzip, zlib ou deflate en Base64 ou hexa, par ex. H4sIAAAAAAAA…",
  ),
  output: l("Compressed", "Compressé"),
  result: l("Decompressed text", "Texte décompressé"),
  drop: l("Drop a file here, or click to choose", "Dépose un fichier ici, ou clique pour choisir"),
  inSize: l("Input", "Entrée"),
  outSize: l("Output", "Sortie"),
  ratio: l("Output / input", "Sortie / entrée"),
  saved: l("Saved", "Gain"),
  detected: l("Format", "Format"),
  storedName: l("Stored name", "Nom stocké"),
  modified: l("Modified", "Modifié"),
  download: l("Download {name}", "Télécharger {name}"),
  binary: l(
    "The result is not UTF-8 text ({size}): download it as a file.",
    "Le résultat n'est pas du texte UTF-8 ({size}) : télécharge-le comme fichier.",
  ),
  tooBig: l(
    "The result is too large to display: download it.",
    "Le résultat est trop gros pour être affiché : télécharge-le.",
  ),
  busy: l("Working…", "En cours…"),
  note: l(
    "Uses the browser's own CompressionStream. gzip and zlib add a checksum; raw deflate has none.",
    "Utilise le CompressionStream du navigateur. gzip et zlib ajoutent une somme de contrôle ; le deflate brut n'en a pas.",
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

function locale(): string {
  return lang.value === "fr" ? "fr-FR" : "en-US";
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
