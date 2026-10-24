import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Segmented, TextBox, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { decodeEntities, type EncodeMode, encodeEntities } from "./logic";

type Dir = "encode" | "decode";

const T = {
  encode: l("Encode", "Encoder", "Kodieren"),
  decode: l("Decode", "Décoder", "Dekodieren"),
  mode: l("What to encode", "Quoi encoder", "Was kodieren"),
  unsafe: l("Only & < > \" '", "Seulement & < > \" '", "Nur & < > \" '"),
  named: l("Named (&eacute;)", "Nommées (&eacute;)", "Benannt (&eacute;)"),
  numeric: l("Numeric (&#233;)", "Numériques (&#233;)", "Numerisch (&#233;)"),
  hex: l("Hexadecimal (&#xE9;)", "Hexadécimal (&#xE9;)", "Hexadezimal (&#xE9;)"),
  text: l("Text", "Texte", "Text"),
  html: l("HTML", "HTML", "HTML"),
  phText: l(
    "Type or paste text, e.g. <p>Café & co</p>",
    "Tape ou colle du texte, par ex. <p>Café & co</p>",
    "Text eingeben oder einfügen, z. B. <p>Café & co</p>",
  ),
  phHtml: l(
    "Paste HTML with entities, e.g. caf&eacute; &amp; co",
    "Colle du HTML avec des entités, par ex. caf&eacute; &amp; co",
    "HTML mit Entities einfügen, z. B. caf&eacute; &amp; co",
  ),
  swap: l("Use output as input", "Réutiliser le résultat", "Ergebnis als Eingabe verwenden"),
  decoded: l("{n} references decoded", "{n} références décodées", "{n} Referenzen dekodiert"),
  unknown: l(
    "Unknown names, left as is: {list}",
    "Noms inconnus, laissés tels quels : {list}",
    "Unbekannte Namen, unverändert gelassen: {list}",
  ),
  helpUnsafe: l(
    "Enough to put text safely inside HTML elements and quoted attributes; accents stay as they are (UTF-8 pages).",
    "Suffit pour placer du texte dans des éléments et attributs entre guillemets ; les accents restent tels quels (pages UTF-8).",
    "Reicht, um Text sicher in HTML-Elemente und Attribute in Anführungszeichen zu setzen; Umlaute und Akzente bleiben, wie sie sind (UTF-8-Seiten).",
  ),
  helpNamed: l(
    "Also turns non-ASCII characters into references: named when HTML has a name, numeric otherwise.",
    "Transforme aussi les caractères non ASCII en références : nommées quand le HTML a un nom, numériques sinon.",
    "Wandelt auch Nicht-ASCII-Zeichen in Referenzen um: benannt, wenn HTML einen Namen dafür hat, sonst numerisch.",
  ),
  helpNumeric: l(
    "Pure ASCII output: every non-ASCII and unsafe character becomes a numeric reference.",
    "Sortie 100 % ASCII : chaque caractère non ASCII ou dangereux devient une référence numérique.",
    "Reine ASCII-Ausgabe: Jedes Nicht-ASCII- und unsichere Zeichen wird zu einer numerischen Referenz.",
  ),
};

const HELP: Record<EncodeMode, L10n> = {
  unsafe: T.helpUnsafe,
  named: T.helpNamed,
  numeric: T.helpNumeric,
};

export default function HtmlEntities() {
  const dir = useToolState<Dir>("dir", "encode");
  const mode = useToolState<EncodeMode>("mode", "unsafe");
  const hex = useToolState("hex", false);
  const input = useToolState("input", "");

  const result = useComputed(() => {
    if (dir.value === "encode")
      return {
        text: encodeEntities(input.value, { mode: mode.value, hex: hex.value }),
        info: null,
      };
    const d = decodeEntities(input.value);
    return { text: d.text, info: d };
  });
  const r = result.value;
  const info = r.info;

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
            <Segmented<EncodeMode>
              label={tr(T.mode)}
              value={mode.value}
              onChange={(v) => {
                mode.value = v;
              }}
              options={[
                { value: "unsafe", label: tr(T.unsafe) },
                { value: "named", label: tr(T.named) },
                { value: "numeric", label: tr(T.numeric) },
              ]}
            />
            {mode.value !== "unsafe" && (
              <Toggle
                checked={hex.value}
                onChange={(v) => {
                  hex.value = v;
                }}
                label={tr(T.hex)}
              />
            )}
          </>
        )}
      </div>
      {dir.value === "encode" && <p class="small muted">{tr(HELP[mode.value])}</p>}
      <div class="grid-2">
        <TextBox
          label={tr(dir.value === "encode" ? T.text : T.html)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(dir.value === "encode" ? T.phText : T.phHtml)}
          accept=".html,.htm,.xml,.txt,text/*"
        />
        <TextBox
          label={tr(dir.value === "encode" ? T.html : T.text)}
          value={input.value ? r.text : ""}
          readOnly
          downloadName={dir.value === "encode" ? "encoded.html" : "decoded.txt"}
          actions={
            input.value && (
              <Button
                size="sm"
                variant="ghost"
                icon="swap"
                onClick={() => {
                  input.value = r.text;
                  dir.value = dir.value === "encode" ? "decode" : "encode";
                }}
              >
                {tr(T.swap)}
              </Button>
            )
          }
          note={
            info &&
            input.value && (
              <span class="html-entities-note">
                <span class="muted">{tr(T.decoded).replace("{n}", fmt(info.count))}</span>
                {info.unknown.length > 0 && (
                  <span class="html-entities-unknown">
                    {tr(T.unknown).replace("{list}", info.unknown.slice(0, 8).join(" "))}
                  </span>
                )}
              </span>
            )
          }
        />
      </div>
    </>
  );
}
