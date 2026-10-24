import { useComputed, useSignal } from "@preact/signals";
import { useToolState } from "../../../app/state";
import {
  Button,
  ErrorNote,
  Field,
  Output,
  Panel,
  Segmented,
  TextBox,
  Toggle,
} from "../../../app/ui";
import { fmt, type L10n, l, locale, tr } from "../../../i18n";
import { attempt } from "../_shared";
import { NumberField, Select } from "../_ui";
import {
  generateIds,
  type IdKind,
  inspectId,
  NANOID_ALPHABETS,
  nanoidBits,
  RANDOM_BITS,
  type Variant,
} from "./logic";

type Preset = keyof typeof NANOID_ALPHABETS | "custom";

const T = {
  generate: l("Generate", "Générer", "Erzeugen"),
  kind: l("Kind", "Type", "Art"),
  v4: l("UUID v4", "UUID v4", "UUID v4"),
  v7: l("UUID v7", "UUID v7", "UUID v7"),
  count: l("How many", "Combien", "Anzahl"),
  uppercase: l("Uppercase", "Majuscules", "Großbuchstaben"),
  dashes: l("Dashes", "Tirets", "Bindestriche"),
  size: l("Length", "Longueur", "Länge"),
  alphabet: l("Alphabet", "Alphabet", "Alphabet"),
  custom: l("Custom alphabet", "Alphabet personnalisé", "Eigenes Alphabet"),
  presetUrl: l(
    "URL-safe (A–Z a–z 0–9 _ -)",
    "Compatible URL (A–Z a–z 0–9 _ -)",
    "URL-sicher (A–Z a–z 0–9 _ -)",
  ),
  presetAlnum: l("Letters and digits", "Lettres et chiffres", "Buchstaben und Ziffern"),
  presetLower: l("Lowercase and digits", "Minuscules et chiffres", "Kleinbuchstaben und Ziffern"),
  presetHex: l("Hexadecimal", "Hexadécimal", "Hexadezimal"),
  presetDigits: l("Digits only", "Chiffres seulement", "Nur Ziffern"),
  presetNoLook: l(
    "No look-alikes (no 1/l/I, 0/O…)",
    "Sans sosies (pas de 1/l/I, 0/O…)",
    "Ohne ähnliche Zeichen (kein 1/l/I, 0/O…)",
  ),
  presetCustom: l("Custom…", "Personnalisé…", "Eigenes…"),
  again: l("Generate again", "Régénérer", "Neu erzeugen"),
  bits: l("≈ {n} random bits each", "≈ {n} bits aléatoires chacun", "≈ {n} Zufallsbits pro Stück"),
  sorted: l(
    "Same millisecond, sorted in creation order.",
    "Même milliseconde, triés dans l'ordre de création.",
    "Gleiche Millisekunde, in Erstellungsreihenfolge sortiert.",
  ),
  results: l("Identifiers", "Identifiants", "Kennungen"),
  inspect: l(
    "Inspect a UUID or ULID",
    "Inspecter un UUID ou un ULID",
    "UUID oder ULID untersuchen",
  ),
  inspectPh: l(
    "Paste a UUID or a ULID, e.g. 017f22e2-79b0-7cc3-98c4-dc0c0c07398f",
    "Colle un UUID ou un ULID, par ex. 017f22e2-79b0-7cc3-98c4-dc0c0c07398f",
    "UUID oder ULID einfügen, z. B. 017f22e2-79b0-7cc3-98c4-dc0c0c07398f",
  ),
  type: l("Type", "Type", "Typ"),
  canonical: l("Canonical form", "Forme canonique", "Kanonische Form"),
  version: l("Version", "Version", "Version"),
  variant: l("Variant", "Variante", "Variante"),
  time: l("Embedded time", "Date intégrée", "Eingebettete Zeit"),
  timeUtc: l("Embedded time (UTC)", "Date intégrée (UTC)", "Eingebettete Zeit (UTC)"),
  unix: l("Unix time (ms)", "Temps Unix (ms)", "Unix-Zeit (ms)"),
  asUlid: l("Same bits as ULID", "Mêmes bits en ULID", "Dieselben Bits als ULID"),
  asUuid: l("Same bits as UUID", "Mêmes bits en UUID", "Dieselben Bits als UUID"),
  node: l("Node (MAC)", "Nœud (MAC)", "Knoten (MAC)"),
  clockSeq: l("Clock sequence", "Séquence d'horloge", "Taktsequenz"),
  hex: l("Hex", "Hexa", "Hex"),
  nil: l("Nil UUID (all zeros)", "UUID nul (que des zéros)", "Nil-UUID (nur Nullen)"),
  max: l("Max UUID (all ones)", "UUID max (que des uns)", "Max-UUID (nur Einsen)"),
  ulid: l("ULID", "ULID", "ULID"),
};

const VERSIONS: Record<number, L10n> = {
  1: l("1 — time and node (MAC)", "1 — date et nœud (MAC)", "1 — Zeit und Knoten (MAC)"),
  2: l("2 — DCE security", "2 — sécurité DCE", "2 — DCE-Sicherheit"),
  3: l("3 — name-based, MD5", "3 — basé sur un nom, MD5", "3 — namensbasiert, MD5"),
  4: l("4 — random", "4 — aléatoire", "4 — zufällig"),
  5: l("5 — name-based, SHA-1", "5 — basé sur un nom, SHA-1", "5 — namensbasiert, SHA-1"),
  6: l("6 — reordered time", "6 — date réordonnée", "6 — umsortierte Zeit"),
  7: l("7 — Unix time, sortable", "7 — temps Unix, triable", "7 — Unix-Zeit, sortierbar"),
  8: l("8 — custom", "8 — personnalisé", "8 — benutzerdefiniert"),
};

const VARIANTS: Record<Variant, L10n> = {
  rfc: l("RFC 9562 (10xx)", "RFC 9562 (10xx)", "RFC 9562 (10xx)"),
  ncs: l("NCS, reserved (0xxx)", "NCS, réservé (0xxx)", "NCS, reserviert (0xxx)"),
  microsoft: l(
    "Microsoft, reserved (110x)",
    "Microsoft, réservé (110x)",
    "Microsoft, reserviert (110x)",
  ),
  future: l(
    "Reserved for the future (111x)",
    "Réservé pour le futur (111x)",
    "Für die Zukunft reserviert (111x)",
  ),
};

function versionLabel(v: number): string {
  const label = VERSIONS[v];
  return label ? tr(label) : String(v);
}

export default function Uuid() {
  const kind = useToolState<IdKind>("kind", "v4");
  const count = useToolState("count", 5);
  const uppercase = useToolState("uppercase", false);
  const dashes = useToolState("dashes", true);
  const size = useToolState("size", 21);
  const preset = useToolState<Preset>("preset", "url");
  const custom = useToolState("custom", "abcdef0123456789");
  const query = useToolState("query", "");
  const nonce = useSignal(0);

  const alphabet = useComputed(() =>
    preset.value === "custom"
      ? custom.value
      : (NANOID_ALPHABETS[preset.value] ?? NANOID_ALPHABETS.url),
  );
  const ids = useComputed(() => {
    nonce.value;
    return attempt(() =>
      generateIds(kind.value, count.value, {
        uppercase: uppercase.value,
        dashes: dashes.value,
        size: size.value,
        alphabet: alphabet.value,
      }),
    );
  });
  const info = useComputed(() => attempt(() => inspectId(query.value)));

  const k = kind.value;
  const bits = k === "nanoid" ? nanoidBits(size.value, alphabet.value) : RANDOM_BITS[k];
  const res = ids.value;
  const ins = info.value;

  return (
    <>
      <Panel title={tr(T.generate)}>
        <Segmented<IdKind>
          label={tr(T.kind)}
          value={k}
          onChange={(v) => {
            kind.value = v;
          }}
          options={[
            { value: "v4", label: tr(T.v4) },
            { value: "v7", label: tr(T.v7) },
            { value: "ulid", label: "ULID" },
            { value: "nanoid", label: "nanoid" },
          ]}
        />
        <div class="uuid-controls">
          <NumberField
            label={tr(T.count)}
            value={count.value}
            min={1}
            max={1000}
            onChange={(v) => {
              count.value = v;
            }}
          />
          {k === "nanoid" && (
            <>
              <NumberField
                label={tr(T.size)}
                value={size.value}
                min={2}
                max={256}
                onChange={(v) => {
                  size.value = v;
                }}
              />
              <Select<Preset>
                label={tr(T.alphabet)}
                value={preset.value}
                onChange={(v) => {
                  preset.value = v;
                }}
                options={[
                  { value: "url", label: tr(T.presetUrl) },
                  { value: "alnum", label: tr(T.presetAlnum) },
                  { value: "lower", label: tr(T.presetLower) },
                  { value: "hex", label: tr(T.presetHex) },
                  { value: "digits", label: tr(T.presetDigits) },
                  { value: "nolookalikes", label: tr(T.presetNoLook) },
                  { value: "custom", label: tr(T.presetCustom) },
                ]}
              />
            </>
          )}
        </div>
        {k === "nanoid" && preset.value === "custom" && (
          <Field label={tr(T.custom)}>
            <input
              class="input mono"
              value={custom.value}
              spellcheck={false}
              onInput={(e) => {
                custom.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
        )}
        <div class="row">
          {k !== "nanoid" && (
            <Toggle
              checked={uppercase.value}
              onChange={(v) => {
                uppercase.value = v;
              }}
              label={tr(T.uppercase)}
            />
          )}
          {(k === "v4" || k === "v7") && (
            <Toggle
              checked={dashes.value}
              onChange={(v) => {
                dashes.value = v;
              }}
              label={tr(T.dashes)}
            />
          )}
          <span class="spacer" />
          <Button
            size="sm"
            variant="primary"
            icon="refresh"
            onClick={() => {
              nonce.value++;
            }}
          >
            {tr(T.again)}
          </Button>
        </div>
        {res.ok ? (
          <>
            <p class="muted small">
              {tr(T.bits).replace("{n}", fmt(bits, { maximumFractionDigits: 1 }))}
              {(k === "v7" || k === "ulid") && count.value > 1 ? ` · ${tr(T.sorted)}` : ""}
            </p>
            <TextBox
              label={tr(T.results)}
              value={res.value.join("\n")}
              readOnly
              rows={Math.min(12, Math.max(3, res.value.length))}
              downloadName={`${k}.txt`}
              wrap={false}
            />
          </>
        ) : (
          <ErrorNote error={tr(res.error)} />
        )}
      </Panel>

      <Panel title={tr(T.inspect)}>
        <input
          class="input mono"
          value={query.value}
          placeholder={tr(T.inspectPh)}
          spellcheck={false}
          aria-label={tr(T.inspect)}
          aria-invalid={!ins.ok}
          onInput={(e) => {
            query.value = (e.currentTarget as HTMLInputElement).value;
          }}
        />
        {!ins.ok && <ErrorNote error={tr(ins.error)} />}
        {ins.ok && ins.value && (
          <div class="stack uuid-info">
            <Output
              label={tr(T.type)}
              mono={false}
              value={
                ins.value.special
                  ? tr(ins.value.special === "nil" ? T.nil : T.max)
                  : ins.value.kind === "ulid"
                    ? tr(T.ulid)
                    : `UUID${ins.value.version ? ` v${ins.value.version}` : ""}`
              }
            />
            <Output label={tr(T.canonical)} value={ins.value.canonical} />
            {ins.value.version !== undefined && (
              <Output label={tr(T.version)} mono={false} value={versionLabel(ins.value.version)} />
            )}
            {ins.value.variant && (
              <Output label={tr(T.variant)} mono={false} value={tr(VARIANTS[ins.value.variant])} />
            )}
            {ins.value.timestamp !== undefined && (
              <>
                <Output
                  label={tr(T.time)}
                  mono={false}
                  value={new Date(ins.value.timestamp).toLocaleString(locale(), {
                    dateStyle: "full",
                    timeStyle: "medium",
                  })}
                />
                <Output label={tr(T.timeUtc)} value={new Date(ins.value.timestamp).toISOString()} />
                <Output label={tr(T.unix)} value={String(ins.value.timestamp)} />
              </>
            )}
            {ins.value.node && <Output label={tr(T.node)} value={ins.value.node} />}
            {ins.value.clockSeq !== undefined && (
              <Output label={tr(T.clockSeq)} value={String(ins.value.clockSeq)} />
            )}
            <Output label={tr(T.hex)} value={ins.value.hex} />
            <Output
              label={tr(ins.value.kind === "ulid" ? T.asUuid : T.asUlid)}
              value={ins.value.other}
            />
          </div>
        )}
      </Panel>
    </>
  );
}
