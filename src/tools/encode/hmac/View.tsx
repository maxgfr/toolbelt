import { useSignal } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { ErrorNote, Field, Output, Segmented, TextBox, Toggle } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { useAsync } from "../_ui";
import {
  formatMac,
  HMAC_ALGOS,
  type HmacAlgo,
  hmac,
  type InputEncoding,
  type OutputFormat,
  parseInput,
  sameMac,
} from "./logic";

const T = {
  message: l("Message", "Message", "Nachricht"),
  messagePh: l(
    "The message to sign, e.g. a webhook's raw body…",
    "Le message à signer, par ex. le corps brut d'un webhook…",
    "Die zu signierende Nachricht, z. B. der rohe Body eines Webhooks…",
  ),
  key: l("Secret key", "Clé secrète", "Geheimer Schlüssel"),
  keyPh: l("The shared secret", "Le secret partagé", "Das gemeinsame Geheimnis"),
  keyNote: l(
    "Never saved nor shared.",
    "Jamais enregistrée ni partagée.",
    "Wird nie gespeichert oder geteilt.",
  ),
  show: l("Show", "Afficher", "Anzeigen"),
  msgFormat: l("Message format", "Format du message", "Nachrichtenformat"),
  keyFormat: l("Key format", "Format de la clé", "Schlüsselformat"),
  text: l("Text", "Texte", "Text"),
  hex: l("Hex", "Hexa", "Hex"),
  base64: l("Base64", "Base64", "Base64"),
  base64url: l("Base64URL", "Base64URL", "Base64URL"),
  output: l("Output", "Sortie", "Ausgabe"),
  upper: l("Uppercase", "Majuscules", "Großbuchstaben"),
  expected: l(
    "Compare with an expected signature",
    "Comparer avec une signature attendue",
    "Mit erwarteter Signatur vergleichen",
  ),
  expectedPh: l(
    "e.g. the X-Hub-Signature-256 header (sha256=…)",
    "par ex. l'en-tête X-Hub-Signature-256 (sha256=…)",
    "z. B. der Header X-Hub-Signature-256 (sha256=…)",
  ),
  matches: l("Matches HMAC-{algo}", "Correspond à HMAC-{algo}", "Stimmt mit HMAC-{algo} überein"),
  noMatch: l(
    "No algorithm gives this signature.",
    "Aucun algorithme ne donne cette signature.",
    "Kein Algorithmus ergibt diese Signatur.",
  ),
  needKey: l(
    "Enter a secret key to compute the HMAC.",
    "Saisis une clé secrète pour calculer le HMAC.",
    "Gib einen geheimen Schlüssel ein, um den HMAC zu berechnen.",
  ),
};

function encodingOptions() {
  return [
    { value: "text" as const, label: tr(T.text) },
    { value: "hex" as const, label: tr(T.hex) },
    { value: "base64" as const, label: tr(T.base64) },
  ];
}

export default function Hmac() {
  const message = useToolState("message", "");
  const msgEnc = useToolState<InputEncoding>("msgEnc", "text");
  const key = useToolState("key", "", { persist: false, share: false });
  const keyEnc = useToolState<InputEncoding>("keyEnc", "text", { persist: false, share: false });
  const format = useToolState<OutputFormat>("format", "hex");
  const upper = useToolState("upper", false);
  const expected = useToolState("expected", "", { share: false });
  const showKey = useSignal(false);

  const macs = useAsync(() => {
    if (!key.value) return null;
    const k = parseInput(key.value, keyEnc.value);
    const m = parseInput(message.value, msgEnc.value);
    return Promise.all(HMAC_ALGOS.map((a) => hmac(a, k, m))).then(
      (all) =>
        Object.fromEntries(HMAC_ALGOS.map((a, i) => [a, all[i]])) as Record<HmacAlgo, Uint8Array>,
    );
  });

  const r = macs.value;
  const exp = expected.value.trim();
  const match =
    r.value && exp
      ? (HMAC_ALGOS.find((a) => sameMac(exp, r.value?.[a] ?? new Uint8Array())) ?? null)
      : null;

  return (
    <>
      <TextBox
        label={tr(T.message)}
        value={message.value}
        onInput={(v) => {
          message.value = v;
        }}
        placeholder={tr(T.messagePh)}
        rows={6}
        actions={
          <Segmented<InputEncoding>
            label={tr(T.msgFormat)}
            value={msgEnc.value}
            onChange={(v) => {
              msgEnc.value = v;
            }}
            options={encodingOptions()}
          />
        }
      />

      <div class="hmac-key">
        <Field label={tr(T.key)} hint={tr(T.keyNote)}>
          <input
            class="input mono"
            type={showKey.value ? "text" : "password"}
            autocomplete="off"
            spellcheck={false}
            value={key.value}
            placeholder={tr(T.keyPh)}
            onInput={(e) => {
              key.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
        </Field>
        <div class="row">
          <Segmented<InputEncoding>
            label={tr(T.keyFormat)}
            value={keyEnc.value}
            onChange={(v) => {
              keyEnc.value = v;
            }}
            options={encodingOptions()}
          />
          <Toggle
            checked={showKey.value}
            onChange={(v) => {
              showKey.value = v;
            }}
            label={tr(T.show)}
          />
        </div>
      </div>

      <div class="row">
        <Segmented<OutputFormat>
          label={tr(T.output)}
          value={format.value}
          onChange={(v) => {
            format.value = v;
          }}
          options={[
            { value: "hex", label: tr(T.hex) },
            { value: "base64", label: tr(T.base64) },
            { value: "base64url", label: tr(T.base64url) },
          ]}
        />
        {format.value === "hex" && (
          <Toggle
            checked={upper.value}
            onChange={(v) => {
              upper.value = v;
            }}
            label={tr(T.upper)}
          />
        )}
      </div>

      {r.error ? (
        <ErrorNote error={r.error} />
      ) : (
        !key.value && <p class="muted small">{tr(T.needKey)}</p>
      )}

      <div class="hmac-list">
        {HMAC_ALGOS.map((a) => (
          <div key={a} class={match === a ? "hmac-match" : ""}>
            <Output
              label={`HMAC-${a}`}
              value={r.value && !r.error ? formatMac(r.value[a], format.value, upper.value) : ""}
            />
          </div>
        ))}
      </div>

      <Field label={tr(T.expected)}>
        <input
          class="input mono"
          value={expected.value}
          placeholder={tr(T.expectedPh)}
          spellcheck={false}
          aria-invalid={!!exp && !!r.value && !match}
          onInput={(e) => {
            expected.value = (e.currentTarget as HTMLInputElement).value;
          }}
        />
      </Field>
      {exp && r.value && (
        <p class={`hmac-verdict ${match ? "success" : "error"}`} role="status">
          {match ? `✓ ${tr(T.matches).replace("{algo}", match)}` : `✗ ${tr(T.noMatch)}`}
        </p>
      )}
    </>
  );
}
