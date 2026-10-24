import { useComputed, useSignal } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, ErrorNote, Field, Panel, Segmented, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { attempt } from "../_shared";
import { NumberField, Select } from "../_ui";
import {
  crackSeconds,
  estimateStrength,
  generatePassphrase,
  generatePassword,
  MAX_LENGTH,
  MAX_WORDS,
  MIN_LENGTH,
  MIN_WORDS,
  passphraseEntropy,
  passwordEntropy,
  scoreOf,
  timeUnit,
  type Warning,
} from "./logic";
import { WORDS } from "./words";

type Mode = "password" | "passphrase";
type Sep = "-" | " " | "." | "_" | "," | "";

const T = {
  mode: l("Kind", "Type"),
  password: l("Password", "Mot de passe"),
  passphrase: l("Passphrase", "Phrase de passe"),
  generated: l("Generated", "Généré"),
  again: l("Generate again", "Régénérer"),
  length: l("Length", "Longueur"),
  lower: l("Lowercase (a–z)", "Minuscules (a–z)"),
  upper: l("Uppercase (A–Z)", "Majuscules (A–Z)"),
  digits: l("Digits (0–9)", "Chiffres (0–9)"),
  symbols: l("Symbols (!@#…)", "Symboles (!@#…)"),
  ambiguous: l("Exclude look-alikes (I l 1 O 0…)", "Exclure les sosies (I l 1 O 0…)"),
  eachClass: l("At least one of each kind", "Au moins un de chaque type"),
  words: l("Words", "Mots"),
  separator: l("Separator", "Séparateur"),
  sepDash: l("Hyphen (-)", "Tiret (-)"),
  sepSpace: l("Space", "Espace"),
  sepDot: l("Dot (.)", "Point (.)"),
  sepUnderscore: l("Underscore (_)", "Tiret bas (_)"),
  sepComma: l("Comma (,)", "Virgule (,)"),
  sepNone: l("None", "Aucun"),
  capitalize: l("Capitalize words", "Majuscule à chaque mot"),
  digit: l("Add a digit", "Ajouter un chiffre"),
  listNote: l(
    "Words drawn from a built-in list of {n} common English words.",
    "Mots tirés d'une liste intégrée de {n} mots anglais courants.",
  ),
  check: l("Check a password", "Tester un mot de passe"),
  checkPh: l(
    "Type a password to estimate its strength",
    "Tape un mot de passe pour estimer sa robustesse",
  ),
  show: l("Show", "Afficher"),
  checkNote: l(
    "Estimated locally and never stored. Real attackers also try leaked passwords and personal details.",
    "Estimé localement et jamais enregistré. Les vrais attaquants essaient aussi les mots de passe divulgués et les infos personnelles.",
  ),
  bits: l("{n} bits of entropy", "{n} bits d'entropie"),
  exact: l("exact, from the settings", "exact, d'après les réglages"),
  estimate: l("estimate", "estimation"),
  crack: l(
    "Brute force at 10 billion guesses per second: {t}",
    "Force brute à 10 milliards d'essais par seconde : {t}",
  ),
  instant: l("instantly", "instantané"),
  ages: l("longer than the age of the universe", "plus que l'âge de l'univers"),
};

const SCORES: L10n[] = [
  l("Very weak", "Très faible"),
  l("Weak", "Faible"),
  l("Fair", "Moyen"),
  l("Strong", "Fort"),
  l("Very strong", "Très fort"),
];

const WARNINGS: Record<Warning, L10n> = {
  common: l(
    "This is one of the most common passwords.",
    "C'est l'un des mots de passe les plus courants.",
  ),
  dictionary: l(
    "Contains a dictionary word or a common password.",
    "Contient un mot du dictionnaire ou un mot de passe courant.",
  ),
  pattern: l(
    "Contains repeated or sequential characters (aaa, abc, 123).",
    "Contient des caractères répétés ou qui se suivent (aaa, abc, 123).",
  ),
  short: l("Shorter than 8 characters.", "Moins de 8 caractères."),
};

function crackText(bits: number): string {
  const { unit, value } = timeUnit(crackSeconds(bits));
  if (unit === "instant") return tr(T.instant);
  if (unit === "ages") return tr(T.ages);
  const u = unit.slice(0, -1) as "second" | "minute" | "hour" | "day" | "year";
  return fmt(value, {
    style: "unit",
    unit: u,
    unitDisplay: "long",
    ...(value >= 1e6 ? { notation: "compact", compactDisplay: "long" } : {}),
  });
}

function Strength({ bits, exact }: { bits: number; exact?: boolean }) {
  const score = scoreOf(bits);
  return (
    <div class="password-strength">
      <div class={`password-meter password-s${score}`} aria-hidden="true">
        <span style={{ width: `${Math.min(100, Math.max(3, (bits / 128) * 100))}%` }} />
      </div>
      <p class="small">
        <strong class={`password-label password-s${score}`}>{tr(SCORES[score] as L10n)}</strong>
        {" · "}
        {tr(T.bits).replace("{n}", fmt(bits, { maximumFractionDigits: 1 }))}
        <span class="muted"> ({tr(exact ? T.exact : T.estimate)})</span>
      </p>
      <p class="small muted">{tr(T.crack).replace("{t}", crackText(bits))}</p>
    </div>
  );
}

export default function Password() {
  const mode = useToolState<Mode>("mode", "password");
  const length = useToolState("length", 20);
  const lower = useToolState("lower", true);
  const upper = useToolState("upper", true);
  const digits = useToolState("digits", true);
  const symbols = useToolState("symbols", true);
  const excludeAmbiguous = useToolState("excludeAmbiguous", false);
  const eachClass = useToolState("eachClass", true);
  const words = useToolState("words", 5);
  const separator = useToolState<Sep>("separator", "-");
  const capitalize = useToolState("capitalize", false);
  const digit = useToolState("digit", false);
  // What the user types to check is a secret: neither stored nor shared.
  const typed = useToolState("typed", "", { persist: false, share: false });
  const show = useSignal(false);
  const nonce = useSignal(0);

  const pwOpts = useComputed(() => ({
    length: length.value,
    lower: lower.value,
    upper: upper.value,
    digits: digits.value,
    symbols: symbols.value,
    excludeAmbiguous: excludeAmbiguous.value,
    eachClass: eachClass.value,
  }));
  const ppOpts = useComputed(() => ({
    words: words.value,
    separator: separator.value,
    capitalize: capitalize.value,
    digit: digit.value,
  }));
  const result = useComputed(() => {
    nonce.value;
    return mode.value === "password"
      ? attempt(() => generatePassword(pwOpts.value))
      : attempt(() => generatePassphrase(ppOpts.value));
  });
  const bits = useComputed(() =>
    mode.value === "password" ? passwordEntropy(pwOpts.value) : passphraseEntropy(ppOpts.value),
  );
  const check = useComputed(() => estimateStrength(typed.value));

  const r = result.value;
  const c = check.value;

  return (
    <>
      <Panel title={tr(T.generated)}>
        <Segmented<Mode>
          label={tr(T.mode)}
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "password", label: tr(T.password) },
            { value: "passphrase", label: tr(T.passphrase) },
          ]}
        />
        {r.ok ? (
          <>
            <div class="password-result">
              <output class="mono" aria-live="polite">
                {r.value}
              </output>
              <div class="row">
                <CopyButton text={r.value} size="md" />
                <Button
                  variant="primary"
                  icon="refresh"
                  onClick={() => {
                    nonce.value++;
                  }}
                >
                  {tr(T.again)}
                </Button>
              </div>
            </div>
            <Strength bits={bits.value} exact />
          </>
        ) : (
          <ErrorNote error={tr(r.error)} />
        )}

        {mode.value === "password" ? (
          <div class="stack">
            <Field label={`${tr(T.length)} · ${length.value}`}>
              <input
                type="range"
                min={MIN_LENGTH}
                max={MAX_LENGTH}
                value={length.value}
                onInput={(e) => {
                  length.value = Number((e.currentTarget as HTMLInputElement).value);
                }}
              />
            </Field>
            <div class="password-toggles">
              <Toggle
                checked={lower.value}
                onChange={(v) => {
                  lower.value = v;
                }}
                label={tr(T.lower)}
              />
              <Toggle
                checked={upper.value}
                onChange={(v) => {
                  upper.value = v;
                }}
                label={tr(T.upper)}
              />
              <Toggle
                checked={digits.value}
                onChange={(v) => {
                  digits.value = v;
                }}
                label={tr(T.digits)}
              />
              <Toggle
                checked={symbols.value}
                onChange={(v) => {
                  symbols.value = v;
                }}
                label={tr(T.symbols)}
              />
              <Toggle
                checked={excludeAmbiguous.value}
                onChange={(v) => {
                  excludeAmbiguous.value = v;
                }}
                label={tr(T.ambiguous)}
              />
              <Toggle
                checked={eachClass.value}
                onChange={(v) => {
                  eachClass.value = v;
                }}
                label={tr(T.eachClass)}
              />
            </div>
          </div>
        ) : (
          <div class="stack">
            <div class="grid-2">
              <NumberField
                label={tr(T.words)}
                value={words.value}
                min={MIN_WORDS}
                max={MAX_WORDS}
                onChange={(v) => {
                  words.value = v;
                }}
              />
              <Select<Sep>
                label={tr(T.separator)}
                value={separator.value}
                onChange={(v) => {
                  separator.value = v;
                }}
                options={[
                  { value: "-", label: tr(T.sepDash) },
                  { value: " ", label: tr(T.sepSpace) },
                  { value: ".", label: tr(T.sepDot) },
                  { value: "_", label: tr(T.sepUnderscore) },
                  { value: ",", label: tr(T.sepComma) },
                  { value: "", label: tr(T.sepNone) },
                ]}
              />
            </div>
            <div class="row">
              <Toggle
                checked={capitalize.value}
                onChange={(v) => {
                  capitalize.value = v;
                }}
                label={tr(T.capitalize)}
              />
              <Toggle
                checked={digit.value}
                onChange={(v) => {
                  digit.value = v;
                }}
                label={tr(T.digit)}
              />
            </div>
            <p class="small muted">{tr(T.listNote).replace("{n}", fmt(WORDS.length))}</p>
          </div>
        )}
      </Panel>

      <Panel title={tr(T.check)}>
        <div class="row password-check">
          <input
            class="input mono"
            type={show.value ? "text" : "password"}
            value={typed.value}
            placeholder={tr(T.checkPh)}
            aria-label={tr(T.check)}
            autocomplete="off"
            spellcheck={false}
            onInput={(e) => {
              typed.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
          <Toggle
            checked={show.value}
            onChange={(v) => {
              show.value = v;
            }}
            label={tr(T.show)}
          />
        </div>
        {typed.value && (
          <>
            <Strength bits={c.bits} />
            {c.warnings.length > 0 && (
              <ul class="password-warnings small">
                {c.warnings.map((w) => (
                  <li key={w}>{tr(WARNINGS[w])}</li>
                ))}
              </ul>
            )}
          </>
        )}
        <p class="small muted">{tr(T.checkNote)}</p>
      </Panel>
    </>
  );
}
