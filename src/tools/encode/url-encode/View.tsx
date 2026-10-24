import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Segmented, TextBox, Toggle } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { attempt } from "../_shared";
import { decodeUrl, encodeUrl, looksEncoded, type UrlMode } from "./logic";

type Dir = "encode" | "decode";

const T = {
  mode: l("Mode", "Mode"),
  component: l("Component", "Composant"),
  uri: l("Full URL", "URL complète"),
  form: l("Form (+ for spaces)", "Formulaire (+ pour les espaces)"),
  encode: l("Encode", "Encoder"),
  decode: l("Decode", "Décoder"),
  strict: l("Also encode !'()* (RFC 3986)", "Encoder aussi !'()* (RFC 3986)"),
  input: l("Input", "Entrée"),
  output: l("Result", "Résultat"),
  phEncode: l("Type or paste text, e.g. a b&c=é", "Tape ou colle du texte, par ex. a b&c=é"),
  phDecode: l("Paste encoded text, e.g. a%20b%26c", "Colle du texte encodé, par ex. a%20b%26c"),
  swap: l("Use output as input", "Réutiliser le résultat"),
  twice: l(
    "The result still contains escapes: the text was probably encoded twice.",
    "Le résultat contient encore des échappements : le texte a sans doute été encodé deux fois.",
  ),
  again: l("Decode again", "Décoder encore"),
  helpComponent: l(
    "For one query value or path segment: everything except A–Z a–z 0–9 - _ . ! ~ * ' ( ) is escaped.",
    "Pour une valeur de paramètre ou un segment de chemin : tout est échappé sauf A–Z a–z 0–9 - _ . ! ~ * ' ( ).",
  ),
  helpUri: l(
    "For a whole URL: keeps : / ? # [ ] @ & = + $ , ; so the structure survives.",
    "Pour une URL entière : garde : / ? # [ ] @ & = + $ , ; pour que la structure reste intacte.",
  ),
  helpForm: l(
    "As browsers send HTML forms (application/x-www-form-urlencoded): spaces become +.",
    "Comme les navigateurs envoient les formulaires (application/x-www-form-urlencoded) : les espaces deviennent +.",
  ),
};

const HELP: Record<UrlMode, { en: string; fr: string }> = {
  component: T.helpComponent,
  uri: T.helpUri,
  form: T.helpForm,
};

export default function UrlEncode() {
  const mode = useToolState<UrlMode>("mode", "component");
  const dir = useToolState<Dir>("dir", "encode");
  const input = useToolState("input", "");
  const strict = useToolState("strict", false);

  const result = useComputed(() => {
    if (!input.value) return null;
    return attempt(() =>
      dir.value === "encode"
        ? encodeUrl(input.value, mode.value, strict.value)
        : decodeUrl(input.value, mode.value),
    );
  });
  const r = result.value;
  const out = r?.ok ? r.value : "";
  const twice = dir.value === "decode" && !!out && out !== input.value && looksEncoded(out);

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
        <Segmented<UrlMode>
          label={tr(T.mode)}
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "component", label: tr(T.component) },
            { value: "uri", label: tr(T.uri) },
            { value: "form", label: tr(T.form) },
          ]}
        />
        {dir.value === "encode" && mode.value === "component" && (
          <Toggle
            checked={strict.value}
            onChange={(v) => {
              strict.value = v;
            }}
            label={tr(T.strict)}
          />
        )}
      </div>
      <p class="small muted">{tr(HELP[mode.value])}</p>
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(dir.value === "encode" ? T.phEncode : T.phDecode)}
          rows={8}
          invalid={r ? !r.ok : false}
          note={r && !r.ok && <span class="error">{tr(r.error)}</span>}
        />
        <TextBox
          label={tr(T.output)}
          value={out}
          readOnly
          rows={8}
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
            twice && (
              <span class="row">
                <span class="muted">{tr(T.twice)}</span>
                <Button
                  size="sm"
                  onClick={() => {
                    input.value = out;
                  }}
                >
                  {tr(T.again)}
                </Button>
              </span>
            )
          }
        />
      </div>
    </>
  );
}
