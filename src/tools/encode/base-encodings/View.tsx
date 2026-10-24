import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, downloadBlob, Output, Panel, Segmented, TextBox, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { attempt, isUtf8, utf8 } from "../_shared";
import { decode, ENCODINGS, type EncodeOptions, type Encoding, encode, PER_BYTE } from "./logic";

type Dir = "encode" | "decode";
type Sep = "space" | "none" | "comma" | "newline";

const SEPARATORS: Record<Sep, string> = { space: " ", none: "", comma: ", ", newline: "\n" };

const NAMES: Record<Encoding, L10n> = {
  hex: l("Hex", "Hexa", "Hex"),
  binary: l("Binary", "Binaire", "Binär"),
  octal: l("Octal", "Octal", "Oktal"),
  decimal: l("Decimal", "Décimal", "Dezimal"),
  base32: l("Base32", "Base32", "Base32"),
  base58: l("Base58", "Base58", "Base58"),
  ascii85: l("Ascii85", "Ascii85", "Ascii85"),
};

const PLACEHOLDERS: Record<Encoding, string> = {
  hex: "48 65 6c 6c 6f",
  binary: "01001000 01101001",
  octal: "110 151",
  decimal: "72 101 108 108 111",
  base32: "JBSWY3DP",
  base58: "9Ajdvzr",
  ascii85: "87cURDZ",
};

const T = {
  encoding: l("Encoding", "Encodage", "Kodierung"),
  toEnc: l("Text → {enc}", "Texte → {enc}", "Text → {enc}"),
  fromEnc: l("{enc} → text", "{enc} → texte", "{enc} → Text"),
  separator: l("Separator", "Séparateur", "Trennzeichen"),
  space: l("Space", "Espace", "Leerzeichen"),
  none: l("None", "Aucun", "Keines"),
  comma: l("Comma", "Virgule", "Komma"),
  newline: l("New line", "Retour à la ligne", "Zeilenumbruch"),
  upper: l("Uppercase", "Majuscules", "Großbuchstaben"),
  padding: l("Padding (=)", "Remplissage (=)", "Auffüllung (=)"),
  delimiters: l("<~ ~> delimiters", "Délimiteurs <~ ~>", "Begrenzer <~ ~>"),
  text: l("Text", "Texte", "Text"),
  phText: l("Type or paste text…", "Tape ou colle du texte…", "Text eingeben oder einfügen…"),
  phEnc: l("Paste {enc}, e.g. {ex}", "Colle du {enc}, par ex. {ex}", "{enc} einfügen, z. B. {ex}"),
  swap: l("Use output as input", "Réutiliser le résultat", "Ergebnis als Eingabe verwenden"),
  bytes: l("{n} bytes", "{n} octets", "{n} Bytes"),
  notUtf8: l(
    "These bytes are not valid UTF-8 text: invalid sequences show as �.",
    "Ces octets ne sont pas du texte UTF-8 valide : les séquences invalides s'affichent en �.",
    "Diese Bytes sind kein gültiger UTF-8-Text: Ungültige Sequenzen erscheinen als �.",
  ),
  downloadBytes: l("Download the bytes", "Télécharger les octets", "Bytes herunterladen"),
  all: l("In every encoding", "Dans tous les encodages", "In allen Kodierungen"),
};

export default function BaseEncodings() {
  const enc = useToolState<Encoding>("encoding", "hex");
  const dir = useToolState<Dir>("dir", "encode");
  const input = useToolState("input", "");
  const sep = useToolState<Sep>("separator", "space");
  const upper = useToolState("upper", false);
  const padding = useToolState("padding", true);
  const delimiters = useToolState("delimiters", false);

  const opts = useComputed<EncodeOptions>(() => ({
    separator: SEPARATORS[sep.value],
    upper: upper.value,
    padding: padding.value,
    delimiters: delimiters.value,
  }));
  const result = useComputed(() => {
    if (!input.value) return null;
    if (dir.value === "encode")
      return attempt(() => ({
        out: encode(utf8(input.value), enc.value, opts.value),
        bytes: null,
      }));
    return attempt(() => {
      const bytes = decode(input.value, enc.value);
      return { out: new TextDecoder().decode(bytes), bytes };
    });
  });
  const everywhere = useComputed(() => {
    const bytes = utf8(input.value);
    if (dir.value !== "encode" || !bytes.length || bytes.length > 1024) return [];
    return ENCODINGS.map((e) => ({ enc: e, value: encode(bytes, e, opts.value) }));
  });

  const r = result.value;
  const out = r?.ok ? r.value.out : "";
  const decodedBytes = r?.ok ? r.value.bytes : null;
  const name = tr(NAMES[enc.value]);
  const e = enc.value;

  return (
    <>
      <div class="row">
        <Segmented<Encoding>
          label={tr(T.encoding)}
          value={enc.value}
          onChange={(v) => {
            enc.value = v;
          }}
          options={ENCODINGS.map((x) => ({ value: x, label: tr(NAMES[x]) }))}
        />
        <Segmented<Dir>
          value={dir.value}
          onChange={(v) => {
            dir.value = v;
          }}
          options={[
            { value: "encode", label: tr(T.toEnc).replace("{enc}", name) },
            { value: "decode", label: tr(T.fromEnc).replace("{enc}", name) },
          ]}
        />
      </div>
      {dir.value === "encode" && (
        <div class="row">
          {PER_BYTE.includes(e) && (
            <Segmented<Sep>
              label={tr(T.separator)}
              value={sep.value}
              onChange={(v) => {
                sep.value = v;
              }}
              options={(["space", "none", "comma", "newline"] as const).map((s) => ({
                value: s,
                label: tr(T[s]),
              }))}
            />
          )}
          {e === "hex" && (
            <Toggle
              checked={upper.value}
              onChange={(v) => {
                upper.value = v;
              }}
              label={tr(T.upper)}
            />
          )}
          {e === "base32" && (
            <Toggle
              checked={padding.value}
              onChange={(v) => {
                padding.value = v;
              }}
              label={tr(T.padding)}
            />
          )}
          {e === "ascii85" && (
            <Toggle
              checked={delimiters.value}
              onChange={(v) => {
                delimiters.value = v;
              }}
              label={tr(T.delimiters)}
            />
          )}
        </div>
      )}
      <div class="grid-2">
        <TextBox
          label={dir.value === "encode" ? tr(T.text) : name}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={
            dir.value === "encode"
              ? tr(T.phText)
              : tr(T.phEnc).replace("{enc}", name).replace("{ex}", PLACEHOLDERS[e])
          }
          mono={dir.value === "decode"}
          invalid={r ? !r.ok : false}
          note={r && !r.ok && <span class="error">{tr(r.error)}</span>}
        />
        <div class="stack">
          <TextBox
            label={dir.value === "encode" ? name : tr(T.text)}
            value={out}
            readOnly
            mono={dir.value === "encode"}
            actions={
              out && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon="swap"
                  onClick={() => {
                    input.value = out;
                    dir.value = dir.value === "encode" ? "decode" : "encode";
                  }}
                >
                  {tr(T.swap)}
                </Button>
              )
            }
            note={
              decodedBytes && (
                <span class="muted">{tr(T.bytes).replace("{n}", fmt(decodedBytes.length))}</span>
              )
            }
          />
          {decodedBytes && decodedBytes.length > 0 && !isUtf8(decodedBytes) && (
            <div class="row">
              <span class="small muted">{tr(T.notUtf8)}</span>
              <Button
                size="sm"
                icon="download"
                onClick={() => downloadBlob(new Blob([decodedBytes as BlobPart]), "decoded.bin")}
              >
                {tr(T.downloadBytes)}
              </Button>
            </div>
          )}
        </div>
      </div>
      {everywhere.value.length > 0 && (
        <Panel title={tr(T.all)}>
          <div class="stack base-encodings-all">
            {everywhere.value.map((x) => (
              <Output key={x.enc} label={tr(NAMES[x.enc])} value={x.value} />
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
