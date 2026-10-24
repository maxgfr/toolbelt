import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { useToolState } from "../../../app/state";
import {
  Button,
  ErrorNote,
  Field,
  FileDrop,
  Output,
  Segmented,
  TextBox,
  Toggle,
} from "../../../app/ui";
import { fmt, l, locale, tr } from "../../../i18n";
import { formatSize } from "../_shared";
import { errMsg, useAsync } from "../_ui";
import {
  ALGOS,
  Cancelled,
  type DigestFormat,
  type Digests,
  findMatch,
  formatDigest,
  hashAll,
  hashBlob,
  parseChecksum,
} from "./logic";

type Source = "text" | "file";

const T = {
  source: l("Source", "Source", "Quelle"),
  text: l("Text", "Texte", "Text"),
  file: l("File", "Fichier", "Datei"),
  input: l("Text to hash", "Texte à hacher", "Zu hashender Text"),
  placeholder: l("Type or paste text…", "Tape ou colle du texte…", "Text eingeben oder einfügen…"),
  drop: l(
    "Drop a file here, or click to choose (any size, read in chunks)",
    "Dépose un fichier ici, ou clique pour choisir (toute taille, lu par morceaux)",
    "Datei hier ablegen oder klicken, um eine auszuwählen (beliebige Größe, wird stückweise gelesen)",
  ),
  other: l("Choose another file", "Choisir un autre fichier", "Andere Datei wählen"),
  cancel: l("Cancel", "Annuler", "Abbrechen"),
  cancelled: l("Cancelled.", "Annulé.", "Abgebrochen."),
  format: l("Output", "Sortie", "Ausgabe"),
  hex: l("Hex", "Hexa", "Hex"),
  base64: l("Base64", "Base64", "Base64"),
  upper: l("Uppercase", "Majuscules", "Großbuchstaben"),
  expected: l(
    "Compare with an expected checksum",
    "Comparer avec une empreinte attendue",
    "Mit erwarteter Prüfsumme vergleichen",
  ),
  expectedPh: l(
    "Paste the checksum from the download page (hex or Base64)",
    "Colle l'empreinte de la page de téléchargement (hexa ou Base64)",
    "Prüfsumme von der Download-Seite einfügen (hex oder Base64)",
  ),
  matches: l("Matches {algo}", "Correspond à {algo}", "Stimmt mit {algo} überein"),
  noMatch: l(
    "No algorithm gives this checksum.",
    "Aucun algorithme ne donne cette empreinte.",
    "Kein Algorithmus ergibt diese Prüfsumme.",
  ),
  notChecksum: l(
    "This is neither hex nor Base64.",
    "Ce n'est ni de l'hexa ni du Base64.",
    "Das ist weder hex noch Base64.",
  ),
  hashing: l("Hashing… {pct}", "Calcul… {pct}", "Hash wird berechnet… {pct}"),
  weak: l(
    "MD5, SHA-1 and CRC32 only detect accidental corruption: do not rely on them for security.",
    "MD5, SHA-1 et CRC32 ne détectent que les corruptions accidentelles : pas de sécurité avec eux.",
    "MD5, SHA-1 und CRC32 erkennen nur versehentliche Beschädigungen: Verlass dich für Sicherheit nicht auf sie.",
  ),
};

export default function Hash() {
  const source = useToolState<Source>("source", "text");
  const text = useToolState("text", "");
  const format = useToolState<DigestFormat>("format", "hex");
  const upper = useToolState("upper", false);
  const expected = useToolState("expected", "");

  const file = useSignal<File | null>(null);
  const progress = useSignal(0);
  const fileDigests = useSignal<Digests | null>(null);
  const fileError = useSignal<string | null>(null);
  const busy = useSignal(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const textHash = useAsync(() => (source.value === "text" ? hashAll(text.value) : null));

  async function run(f: File) {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    file.value = f;
    progress.value = 0;
    fileDigests.value = null;
    fileError.value = null;
    busy.value = true;
    try {
      const d = await hashBlob(f, {
        signal: ac.signal,
        onProgress: (n) => {
          if (abort.current === ac) progress.value = n;
        },
      });
      if (abort.current === ac) fileDigests.value = d;
    } catch (err) {
      if (abort.current === ac)
        fileError.value = err instanceof Cancelled ? tr(T.cancelled) : errMsg(err);
    } finally {
      if (abort.current === ac) busy.value = false;
    }
  }

  const digests = source.value === "text" ? textHash.value.value : fileDigests.value;
  const exp = expected.value.trim();
  const match = digests && exp ? findMatch(exp, digests) : null;
  const parsable = exp ? parseChecksum(exp) !== null : true;
  const f = file.value;
  const pct = f?.size ? progress.value / f.size : 0;

  return (
    <>
      <div class="row">
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
        <span class="spacer" />
        <Segmented<DigestFormat>
          label={tr(T.format)}
          value={format.value}
          onChange={(v) => {
            format.value = v;
          }}
          options={[
            { value: "hex", label: tr(T.hex) },
            { value: "base64", label: tr(T.base64) },
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

      {source.value === "text" ? (
        <TextBox
          label={tr(T.input)}
          value={text.value}
          onInput={(v) => {
            text.value = v;
          }}
          placeholder={tr(T.placeholder)}
          rows={6}
          files={false}
        />
      ) : (
        <div class="stack">
          <FileDrop
            label={f ? tr(T.other) : tr(T.drop)}
            onFiles={(fs) => {
              if (fs[0]) run(fs[0]);
            }}
          />
          {f && (
            <div class="hash-file">
              <div class="row">
                <strong class="hash-file-name">{f.name}</strong>
                <span class="muted small">{formatSize(f.size, locale())}</span>
                <span class="spacer" />
                {busy.value && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="close"
                    onClick={() => abort.current?.abort()}
                  >
                    {tr(T.cancel)}
                  </Button>
                )}
              </div>
              {busy.value && (
                <div class="hash-progress">
                  <progress max={1} value={pct} />
                  <span class="small muted">
                    {tr(T.hashing).replace("{pct}", fmt(pct, { style: "percent" }))}
                  </span>
                </div>
              )}
              <ErrorNote error={fileError.value} />
            </div>
          )}
        </div>
      )}

      <ErrorNote error={source.value === "text" ? textHash.value.error : null} />

      <div class="hash-list">
        {ALGOS.map((a) => (
          <div key={a.id} class={match === a.id ? "hash-match" : ""}>
            <Output
              label={a.label}
              value={digests ? formatDigest(digests[a.id], format.value, upper.value) : ""}
            />
          </div>
        ))}
      </div>
      <p class="small muted">{tr(T.weak)}</p>

      <Field label={tr(T.expected)}>
        <input
          class="input mono"
          value={expected.value}
          placeholder={tr(T.expectedPh)}
          spellcheck={false}
          aria-invalid={!!exp && (!parsable || (!!digests && !match))}
          onInput={(e) => {
            expected.value = (e.currentTarget as HTMLInputElement).value;
          }}
        />
      </Field>
      {exp && digests && (
        <p class={`hash-verdict ${match ? "success" : "error"}`} role="status">
          {!parsable
            ? tr(T.notChecksum)
            : match
              ? `✓ ${tr(T.matches).replace("{algo}", ALGOS.find((a) => a.id === match)?.label ?? "")}`
              : `✗ ${tr(T.noMatch)}`}
        </p>
      )}
    </>
  );
}
