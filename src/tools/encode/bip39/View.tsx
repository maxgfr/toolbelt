import { useComputed, useSignal } from "@preact/signals";
import { Badge, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import {
  Button,
  CopyButton,
  ErrorNote,
  Field,
  Output,
  Segmented,
  TextBox,
  Toggle,
} from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { attempt, fromHex, toHex } from "../_shared";
import { useAsync } from "../_ui";
import {
  check,
  entropyBits,
  entropyToWords,
  generateMnemonic,
  mnemonicToEntropy,
  mnemonicToSeed,
  suggestions,
  WORD_COUNTS,
  type WordCount,
} from "./logic";

type Mode = "generate" | "validate" | "entropy";

const SECRET = { persist: false, share: false } as const;

const T = {
  warn: l(
    "Do not use a mnemonic made on a web page for real funds: browser extensions, malware or a modified page could read it. Use a hardware wallet. This tool is for learning and testing.",
    "N'utilise pas une phrase créée sur une page web pour de vrais fonds : extensions, logiciels malveillants ou page modifiée pourraient la lire. Utilise un portefeuille matériel. Cet outil sert à apprendre et à tester.",
    "Verwende keine auf einer Webseite erzeugte Wortfolge für echtes Geld: Browser-Erweiterungen, Schadsoftware oder eine veränderte Seite könnten sie mitlesen. Nutze eine Hardware-Wallet. Dieses Werkzeug dient zum Lernen und Testen.",
  ),
  mode: l("Mode", "Mode", "Modus"),
  generate: l("Generate", "Générer", "Erzeugen"),
  validate: l("Validate", "Valider", "Prüfen"),
  entropy: l("Entropy ↔ words", "Entropie ↔ mots", "Entropie ↔ Wörter"),
  words: l("Words", "Mots", "Wörter"),
  wordsN: l("{n} words ({bits} bits)", "{n} mots ({bits} bits)", "{n} Wörter ({bits} Bit)"),
  newOne: l("Generate a mnemonic", "Générer une phrase", "Wortfolge erzeugen"),
  again: l("Generate again", "Générer à nouveau", "Neu erzeugen"),
  mnemonic: l("Mnemonic", "Phrase mnémonique", "Mnemonic"),
  entropyHex: l("Entropy (hex)", "Entropie (hexa)", "Entropie (hex)"),
  notSaved: l(
    "Nothing is saved nor put in share links. Created with the browser's secure random generator.",
    "Rien n'est enregistré ni mis dans les liens de partage. Créée avec le générateur aléatoire sûr du navigateur.",
    "Nichts wird gespeichert oder in Teilen-Links übernommen. Erzeugt mit dem sicheren Zufallsgenerator des Browsers.",
  ),
  input: l("Mnemonic to check", "Phrase à vérifier", "Zu prüfende Wortfolge"),
  inputPh: l(
    "Type or paste 12 to 24 words…",
    "Tape ou colle 12 à 24 mots…",
    "12 bis 24 Wörter eingeben oder einfügen…",
  ),
  count: l("{n} words", "{n} mots", "{n} Wörter"),
  badCount: l(
    "12, 15, 18, 21 or 24 words expected",
    "12, 15, 18, 21 ou 24 mots attendus",
    "12, 15, 18, 21 oder 24 Wörter erwartet",
  ),
  unknown: l("Unknown words", "Mots inconnus", "Unbekannte Wörter"),
  checksumOk: l("Valid checksum", "Somme de contrôle valide", "Prüfsumme gültig"),
  checksumBad: l("Wrong checksum", "Somme de contrôle fausse", "Prüfsumme falsch"),
  passphrase: l(
    "Passphrase (optional, “25th word”)",
    "Phrase secrète (facultative, « 25e mot »)",
    "Passphrase (optional, „25. Wort“)",
  ),
  showSeed: l("Show the BIP39 seed", "Afficher la graine BIP39", "BIP39-Seed anzeigen"),
  seed: l("Seed (512 bits, hex)", "Graine (512 bits, hexa)", "Seed (512 Bit, hex)"),
  entropyIn: l("Entropy in hex", "Entropie en hexa", "Entropie in hex"),
  entropyPh: l(
    "32 to 64 hex digits, e.g. 7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f",
    "32 à 64 chiffres hexa, par ex. 7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f",
    "32 bis 64 Hex-Ziffern, z. B. 7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f",
  ),
  random: l("Random entropy", "Entropie aléatoire", "Zufällige Entropie"),
};

function WordGrid({ words }: { words: string[] }) {
  return (
    <ol class="bip39-grid mono">
      {words.map((w, i) => (
        <li key={i}>
          <span class="muted">{i + 1}</span> {w}
        </li>
      ))}
    </ol>
  );
}

function Generate() {
  const count = useToolState<string>("words", "12");
  const mnemonic = useSignal("");
  const n = Number(count.value) as WordCount;
  const words = mnemonic.value ? mnemonic.value.split(" ") : [];
  const entropy = mnemonic.value ? attempt(() => toHex(mnemonicToEntropy(mnemonic.value))) : null;
  return (
    <>
      <div class="row bip39-controls">
        <Select<string>
          label={tr(T.words)}
          value={count.value}
          onChange={(v) => {
            count.value = v;
            mnemonic.value = "";
          }}
          options={WORD_COUNTS.map((c) => ({
            value: String(c),
            label: tr(T.wordsN)
              .replace("{n}", String(c))
              .replace("{bits}", String(entropyBits(c))),
          }))}
        />
        <Button
          variant="primary"
          icon={mnemonic.value ? "refresh" : "plus"}
          onClick={() => {
            mnemonic.value = generateMnemonic(n);
          }}
        >
          {tr(mnemonic.value ? T.again : T.newOne)}
        </Button>
      </div>
      {mnemonic.value && (
        <>
          <div class="bip39-result">
            <div class="row">
              <strong>{tr(T.mnemonic)}</strong>
              <span class="spacer" />
              <CopyButton text={mnemonic.value} />
            </div>
            <WordGrid words={words} />
          </div>
          {entropy?.ok && <Output label={tr(T.entropyHex)} value={entropy.value} />}
        </>
      )}
      <p class="muted small">{tr(T.notSaved)}</p>
    </>
  );
}

function Validate() {
  const input = useToolState("mnemonic", "", SECRET);
  const passphrase = useToolState("passphrase", "", SECRET);
  const showSeed = useSignal(false);
  const c = useComputed(() => check(input.value));
  const strict = useComputed(() =>
    input.value.trim() ? attempt(() => mnemonicToEntropy(input.value)) : null,
  );
  const seed = useAsync(() =>
    showSeed.value && strict.value?.ok
      ? mnemonicToSeed(input.value, passphrase.value).then(toHex)
      : null,
  );
  const r = c.value;
  const s = strict.value;
  const countOk = (WORD_COUNTS as readonly number[]).includes(r.words.length);

  return (
    <>
      <TextBox
        label={tr(T.input)}
        value={input.value}
        onInput={(v) => {
          input.value = v;
        }}
        placeholder={tr(T.inputPh)}
        rows={3}
        files={false}
        invalid={s?.ok === false}
      />
      {r.words.length > 0 && (
        <div class="row">
          <Badge kind={countOk ? "info" : "warn"}>
            {tr(T.count).replace("{n}", String(r.words.length))}
          </Badge>
          {!countOk && <span class="small muted">{tr(T.badCount)}</span>}
          {r.checksumOk === true && <Badge kind="ok">{tr(T.checksumOk)}</Badge>}
          {r.checksumOk === false && <Badge kind="bad">{tr(T.checksumBad)}</Badge>}
        </div>
      )}
      {r.unknown.length > 0 && (
        <div class="bip39-unknown small">
          <strong>{tr(T.unknown)}</strong>
          <ul>
            {r.unknown.map((i) => {
              const w = r.words[i] ?? "";
              const sug = suggestions(w);
              return (
                <li key={i}>
                  {i + 1}. <span class="mono">{w}</span>
                  {sug.length > 0 && <span class="muted"> → {sug.join(", ")}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {s && !s.ok && r.unknown.length === 0 && <ErrorNote error={tr(s.error)} />}
      {s?.ok && (
        <>
          <Output label={tr(T.entropyHex)} value={toHex(s.value)} />
          <Toggle
            checked={showSeed.value}
            onChange={(v) => {
              showSeed.value = v;
            }}
            label={tr(T.showSeed)}
          />
          {showSeed.value && (
            <>
              <Field label={tr(T.passphrase)}>
                <input
                  class="input mono"
                  type="text"
                  autocomplete="off"
                  spellcheck={false}
                  value={passphrase.value}
                  onInput={(e) => {
                    passphrase.value = (e.currentTarget as HTMLInputElement).value;
                  }}
                />
              </Field>
              <ErrorNote error={seed.value.error} />
              <Output label={tr(T.seed)} value={seed.value.value ?? ""} />
            </>
          )}
        </>
      )}
    </>
  );
}

function Entropy() {
  const hex = useToolState("entropy", "", SECRET);
  const r = useComputed(() =>
    hex.value.trim() ? attempt(() => entropyToWords(fromHex(hex.value))) : null,
  );
  const res = r.value;
  return (
    <>
      <div class="row bip39-controls">
        <Field label={tr(T.entropyIn)} class="bip39-hex">
          <input
            class="input mono"
            spellcheck={false}
            autocomplete="off"
            placeholder={tr(T.entropyPh)}
            value={hex.value}
            aria-invalid={res?.ok === false}
            onInput={(e) => {
              hex.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
        </Field>
        <Button
          icon="refresh"
          onClick={() => {
            hex.value = toHex(mnemonicToEntropy(generateMnemonic(12)));
          }}
        >
          {tr(T.random)}
        </Button>
      </div>
      {res && !res.ok && <ErrorNote error={tr(res.error)} />}
      {res?.ok && (
        <div class="bip39-result">
          <div class="row">
            <strong>{tr(T.mnemonic)}</strong>
            <span class="spacer" />
            <CopyButton text={res.value.join(" ")} />
          </div>
          <WordGrid words={res.value} />
        </div>
      )}
    </>
  );
}

export default function Bip39() {
  const mode = useToolState<Mode>("mode", "generate");
  return (
    <>
      <p class="bip39-warn" role="note">
        {tr(T.warn)}
      </p>
      <Segmented<Mode>
        label={tr(T.mode)}
        value={mode.value}
        onChange={(v) => {
          mode.value = v;
        }}
        options={[
          { value: "generate", label: tr(T.generate) },
          { value: "validate", label: tr(T.validate) },
          { value: "entropy", label: tr(T.entropy) },
        ]}
      />
      {mode.value === "generate" ? (
        <Generate />
      ) : mode.value === "validate" ? (
        <Validate />
      ) : (
        <Entropy />
      )}
    </>
  );
}
