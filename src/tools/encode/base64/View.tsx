import { type Signal, useComputed, useSignal } from "@preact/signals";
import { useToolState } from "../../../app/state";
import {
  Button,
  CopyButton,
  downloadBlob,
  ErrorNote,
  Field,
  FileDrop,
  Panel,
  Segmented,
  TextBox,
  Toggle,
} from "../../../app/ui";
import { fmt, l, lang, tr } from "../../../i18n";
import { attempt, formatSize } from "../_shared";
import { decode, encodeBytes, encodeText, fileNameFor } from "./logic";

type Mode = "text" | "file";
type Dir = "encode" | "decode";

const T = {
  text: l("Text", "Texte"),
  file: l("File", "Fichier"),
  encode: l("Encode", "Encoder"),
  decode: l("Decode", "Décoder"),
  urlSafe: l("URL-safe (- _ no padding)", "Compatible URL (- _ sans =)"),
  wrap: l("Wrap lines at 76", "Retour à la ligne à 76"),
  swap: l("Use output as input", "Réutiliser le résultat"),
  plain: l("Text", "Texte"),
  base64: l("Base64", "Base64"),
  phText: l("Type or paste text…", "Tape ou colle du texte…"),
  phB64: l("Paste Base64, e.g. SGVsbG8=", "Colle du Base64, par ex. SGVsbG8="),
  binary: l(
    "These bytes are not text ({size}, {type}). Download them as a file.",
    "Ces octets ne sont pas du texte ({size}, {type}). Télécharge-les en fichier.",
  ),
  unknownType: l("unknown type", "type inconnu"),
  downloadFile: l("Download file", "Télécharger le fichier"),
  fileToB64: l("File → Base64", "Fichier → Base64"),
  b64ToFile: l("Base64 → file", "Base64 → fichier"),
  dropFile: l(
    "Drop a file to encode, or click to choose",
    "Dépose un fichier à encoder, ou clique",
  ),
  copyDataUri: l("Copy as data URI", "Copier en data URI"),
  fileName: l("File name", "Nom du fichier"),
  detected: l("Detected:", "Détecté :"),
  bytes: l("{n} bytes → {m} characters", "{n} octets → {m} caractères"),
  chars: l("{n} characters → {m} bytes", "{n} caractères → {m} octets"),
  reading: l("Reading the file…", "Lecture du fichier…"),
};

function sizeText(n: number): string {
  return formatSize(n, lang.value === "fr" ? "fr-FR" : "en-US");
}

interface Loaded {
  name: string;
  type: string;
  bytes: Uint8Array;
}

interface Opts {
  urlSafe: Signal<boolean>;
  wrap: Signal<boolean>;
}

function TextMode({
  dir,
  input,
  urlSafe,
  wrap,
}: Opts & { dir: Signal<Dir>; input: Signal<string> }) {
  const result = useComputed(() => {
    if (!input.value) return null;
    if (dir.value === "encode")
      return attempt(() => ({
        out: encodeText(input.value, { urlSafe: urlSafe.value, wrap: wrap.value }),
        decoded: null,
      }));
    return attempt(() => {
      const d = decode(input.value);
      return { out: d.text ?? "", decoded: d };
    });
  });
  const r = result.value;
  const out = r?.ok ? r.value.out : "";
  const decoded = r?.ok ? r.value.decoded : null;
  const inBytes = new TextEncoder().encode(input.value).length;

  return (
    <>
      <div class="row">
        <Segmented<Dir>
          value={dir.value}
          onChange={(v) => {
            dir.value = v;
          }}
          options={[
            { value: "encode", label: tr(T.encode) },
            { value: "decode", label: tr(T.decode) },
          ]}
        />
        {dir.value === "encode" && (
          <>
            <Toggle
              checked={urlSafe.value}
              onChange={(v) => {
                urlSafe.value = v;
              }}
              label={tr(T.urlSafe)}
            />
            {!urlSafe.value && (
              <Toggle
                checked={wrap.value}
                onChange={(v) => {
                  wrap.value = v;
                }}
                label={tr(T.wrap)}
              />
            )}
          </>
        )}
        <span class="spacer" />
        <Button
          size="sm"
          icon="swap"
          disabled={!out}
          onClick={() => {
            input.value = out;
            dir.value = dir.value === "encode" ? "decode" : "encode";
          }}
        >
          {tr(T.swap)}
        </Button>
      </div>
      <div class="grid-2">
        <TextBox
          label={tr(dir.value === "encode" ? T.plain : T.base64)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(dir.value === "encode" ? T.phText : T.phB64)}
          mono={dir.value === "decode"}
          invalid={r ? !r.ok : false}
          note={
            r &&
            (r.ok ? (
              <span class="muted">
                {dir.value === "encode"
                  ? tr(T.bytes).replace("{n}", fmt(inBytes)).replace("{m}", fmt(r.value.out.length))
                  : tr(T.chars)
                      .replace("{n}", fmt(input.value.length))
                      .replace("{m}", fmt(decoded?.bytes.length ?? 0))}
              </span>
            ) : (
              <span class="error">{tr(r.error)}</span>
            ))
          }
        />
        <div class="stack">
          <TextBox
            label={tr(dir.value === "encode" ? T.base64 : T.plain)}
            value={out}
            readOnly
            mono={dir.value === "encode"}
            downloadName={dir.value === "encode" ? "base64.txt" : "decoded.txt"}
          />
          {decoded && decoded.text === null && (
            <div class="row base64-binary">
              <span class="small">
                {tr(T.binary)
                  .replace("{size}", sizeText(decoded.bytes.length))
                  .replace("{type}", decoded.mime ?? tr(T.unknownType))}
              </span>
              <Button
                size="sm"
                variant="primary"
                icon="download"
                onClick={() =>
                  downloadBlob(
                    new Blob([decoded.bytes as BlobPart], {
                      type: decoded.mime ?? "application/octet-stream",
                    }),
                    fileNameFor(decoded.mime),
                  )
                }
              >
                {tr(T.downloadFile)}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function FileMode({
  urlSafe,
  wrap,
  pasted,
  name,
}: Opts & { pasted: Signal<string>; name: Signal<string> }) {
  const loaded = useSignal<Loaded | null>(null);
  const reading = useSignal(false);
  const readError = useSignal<string | null>(null);

  const encoded = useComputed(() =>
    loaded.value
      ? encodeBytes(loaded.value.bytes, { urlSafe: urlSafe.value, wrap: wrap.value })
      : "",
  );
  const decoded = useComputed(() =>
    pasted.value.trim() ? attempt(() => decode(pasted.value)) : null,
  );
  const d = decoded.value;
  const f = loaded.value;

  return (
    <div class="grid-2">
      <Panel title={tr(T.fileToB64)}>
        <FileDrop
          label={tr(T.dropFile)}
          onFiles={async ([file]) => {
            if (!file) return;
            reading.value = true;
            readError.value = null;
            try {
              const bytes = new Uint8Array(await file.arrayBuffer());
              loaded.value = { name: file.name, type: file.type, bytes };
            } catch (err) {
              readError.value = err instanceof Error ? err.message : String(err);
            } finally {
              reading.value = false;
            }
          }}
        />
        {reading.value && <p class="muted small">{tr(T.reading)}</p>}
        <ErrorNote error={readError.value} />
        <div class="row">
          <Toggle
            checked={urlSafe.value}
            onChange={(v) => {
              urlSafe.value = v;
            }}
            label={tr(T.urlSafe)}
          />
          {!urlSafe.value && (
            <Toggle
              checked={wrap.value}
              onChange={(v) => {
                wrap.value = v;
              }}
              label={tr(T.wrap)}
            />
          )}
        </div>
        {f && (
          <>
            <p class="small base64-file">
              <strong>{f.name}</strong>{" "}
              <span class="muted">
                · {sizeText(f.bytes.length)} · {f.type || tr(T.unknownType)}
              </span>
            </p>
            <TextBox
              label={tr(T.base64)}
              value={encoded.value}
              readOnly
              rows={8}
              downloadName={`${f.name}.b64.txt`}
              actions={
                !urlSafe.value && (
                  <CopyButton
                    label={tr(T.copyDataUri)}
                    text={() =>
                      `data:${f.type || "application/octet-stream"};base64,${encodeBytes(f.bytes, {
                        urlSafe: false,
                        wrap: false,
                      })}`
                    }
                  />
                )
              }
            />
          </>
        )}
      </Panel>
      <Panel title={tr(T.b64ToFile)}>
        <TextBox
          label={tr(T.base64)}
          value={pasted.value}
          onInput={(v) => {
            pasted.value = v;
          }}
          placeholder={tr(T.phB64)}
          rows={8}
          invalid={d ? !d.ok : false}
          note={
            d &&
            (d.ok ? (
              <span class="muted">
                {tr(T.detected)} {d.value.mime ?? tr(T.unknownType)} ·{" "}
                {sizeText(d.value.bytes.length)}
              </span>
            ) : (
              <span class="error">{tr(d.error)}</span>
            ))
          }
        />
        {d?.ok && (
          <div class="row base64-save">
            <Field label={tr(T.fileName)}>
              <input
                class="input mono"
                value={name.value || fileNameFor(d.value.mime)}
                onInput={(e) => {
                  name.value = (e.currentTarget as HTMLInputElement).value;
                }}
              />
            </Field>
            <Button
              variant="primary"
              icon="download"
              onClick={() =>
                downloadBlob(
                  new Blob([d.value.bytes as BlobPart], {
                    type: d.value.mime ?? "application/octet-stream",
                  }),
                  name.value.trim() || fileNameFor(d.value.mime),
                )
              }
            >
              {tr(T.downloadFile)}
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}

export default function Base64() {
  const mode = useToolState<Mode>("mode", "text");
  const dir = useToolState<Dir>("dir", "encode");
  const input = useToolState("input", "");
  const urlSafe = useToolState("urlSafe", false);
  const wrap = useToolState("wrap", false);
  const pasted = useToolState("fileB64", "");
  const name = useToolState("fileName", "");
  return (
    <>
      <Segmented<Mode>
        value={mode.value}
        onChange={(v) => {
          mode.value = v;
        }}
        options={[
          { value: "text", label: tr(T.text) },
          { value: "file", label: tr(T.file) },
        ]}
      />
      {mode.value === "text" ? (
        <TextMode dir={dir} input={input} urlSafe={urlSafe} wrap={wrap} />
      ) : (
        <FileMode urlSafe={urlSafe} wrap={wrap} pasted={pasted} name={name} />
      )}
    </>
  );
}
