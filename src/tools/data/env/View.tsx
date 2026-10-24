import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Segmented, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { ParseNote } from "../_ui";
import { parseJson } from "../json/logic";
import { type EnvIssue, parseEnv, toEnv } from "./logic";

type Mode = "env2json" | "json2env";

const T = {
  env2json: l(".env → JSON", ".env → JSON", ".env → JSON"),
  json2env: l("JSON → .env", "JSON → .env", "JSON → .env"),
  env: l(".env", ".env", ".env"),
  json: l("JSON", "JSON", "JSON"),
  phEnv: l(
    'Paste a .env file…\n# comment\nexport API_URL=https://example.com\nGREETING="Hello\\nWorld"',
    'Colle un fichier .env…\n# commentaire\nexport API_URL=https://example.com\nGREETING="Bonjour\\nle monde"',
    'Füge eine .env-Datei ein…\n# Kommentar\nexport API_URL=https://example.com\nGREETING="Hallo\\nWelt"',
  ),
  phJson: l(
    'Paste a JSON object, e.g. {"PORT": 8080}',
    'Colle un objet JSON, par ex. {"PORT": 8080}',
    'Füge ein JSON-Objekt ein, z. B. {"PORT": 8080}',
  ),
  exportPrefix: l("Prefix with export", "Préfixer par export", "export voranstellen"),
  sort: l("Sort keys", "Trier les clés", "Schlüssel sortieren"),
  swap: l(
    "Use the result as input",
    "Reprendre le résultat en entrée",
    "Ergebnis als Eingabe verwenden",
  ),
  private: l(
    "Secrets stay private: this input is neither saved nor put in share links.",
    "Les secrets restent privés : cette saisie n'est ni enregistrée ni mise dans les liens de partage.",
    "Geheimnisse bleiben privat: Diese Eingabe wird weder gespeichert noch in Teilen-Links übernommen.",
  ),
  "no-equals": l(
    "Line {line}: no “=” sign.",
    "Ligne {line} : pas de signe « = ».",
    "Zeile {line}: kein „=“-Zeichen.",
  ),
  "bad-key": l(
    "Line {line}: invalid name “{key}”.",
    "Ligne {line} : nom « {key} » invalide.",
    "Zeile {line}: ungültiger Name „{key}“.",
  ),
  unterminated: l(
    "Line {line}: the quote of {key} is never closed.",
    "Ligne {line} : le guillemet de {key} n'est jamais fermé.",
    "Zeile {line}: Das Anführungszeichen von {key} wird nie geschlossen.",
  ),
  duplicate: l(
    "{key} is defined {n} times (lines {lines}); the last one wins.",
    "{key} est défini {n} fois (lignes {lines}) ; la dernière valeur l'emporte.",
    "{key} ist {n}-mal definiert (Zeilen {lines}); der letzte Wert gilt.",
  ),
  vars: l("{n} variables", "{n} variables", "{n} Variablen"),
  notObject: l("Expected a JSON object.", "Attendu : un objet JSON.", "Erwartet: ein JSON-Objekt."),
  badKeys: l(
    "Not valid variable names: {keys}.",
    "Noms de variables non valides : {keys}.",
    "Ungültige Variablennamen: {keys}.",
  ),
  nested: l(
    "Written as JSON text: {keys}.",
    "Écrits en texte JSON : {keys}.",
    "Als JSON-Text geschrieben: {keys}.",
  ),
};

function issueText(i: EnvIssue): string {
  return tr(T[i.code])
    .replace("{line}", fmt(i.line))
    .replace("{key}", i.key ?? "");
}

export default function Env() {
  const mode = useToolState<Mode>("mode", "env2json");
  // .env files hold secrets: never stored, never shared.
  const input = useToolState("input", "", { persist: false, share: false });
  const exportPrefix = useToolState("exportPrefix", false);
  const sort = useToolState("sort", false);

  const env = useComputed(() =>
    mode.value === "env2json" && input.value.trim() ? parseEnv(input.value) : null,
  );
  const json = useComputed(() => {
    if (mode.value !== "json2env" || !input.value.trim()) return null;
    const p = parseJson(input.value);
    return {
      p,
      w: p.ok ? toEnv(p.value, { exportPrefix: exportPrefix.value, sort: sort.value }) : null,
    };
  });
  const output = useComputed(() => {
    const e = env.value;
    if (e) {
      const v = sort.value
        ? Object.fromEntries(Object.entries(e.values).sort(([a], [b]) => a.localeCompare(b)))
        : e.values;
      return JSON.stringify(v, null, 2);
    }
    const w = json.value?.w;
    return w?.ok ? w.text : "";
  });

  const toJson = mode.value === "env2json";
  const e = env.value;
  const j = json.value;
  const warnings: string[] = [];
  if (e) {
    for (const i of e.issues) warnings.push(issueText(i));
    for (const d of e.duplicates)
      warnings.push(
        tr(T.duplicate)
          .replace("{key}", d.key)
          .replace("{n}", fmt(d.lines.length))
          .replace("{lines}", d.lines.map((x) => fmt(x)).join(", ")),
      );
  }
  if (j?.w?.ok) {
    if (j.w.badKeys.length) warnings.push(tr(T.badKeys).replace("{keys}", j.w.badKeys.join(", ")));
    if (j.w.nested.length) warnings.push(tr(T.nested).replace("{keys}", j.w.nested.join(", ")));
  }

  return (
    <>
      <div class="row">
        <Segmented<Mode>
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "env2json", label: tr(T.env2json) },
            { value: "json2env", label: tr(T.json2env) },
          ]}
        />
        <Button
          size="sm"
          variant="ghost"
          icon="swap"
          disabled={!output.value}
          onClick={() => {
            input.value = output.value;
            mode.value = toJson ? "json2env" : "env2json";
          }}
        >
          {tr(T.swap)}
        </Button>
        <span class="spacer" />
        {!toJson && (
          <Toggle
            checked={exportPrefix.value}
            onChange={(v) => {
              exportPrefix.value = v;
            }}
            label={tr(T.exportPrefix)}
          />
        )}
        <Toggle
          checked={sort.value}
          onChange={(v) => {
            sort.value = v;
          }}
          label={tr(T.sort)}
        />
      </div>
      <div class="grid-2">
        <TextBox
          label={tr(toJson ? T.env : T.json)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(toJson ? T.phEnv : T.phJson)}
          accept={toJson ? ".env,text/plain" : ".json,application/json"}
          rows={18}
          wrap={false}
          invalid={!!j && (!j.p.ok || !j.w?.ok)}
          note={
            j && !j.p.ok ? (
              <ParseNote error={j.p} />
            ) : j && !j.w?.ok ? (
              <span class="error">{tr(T.notObject)}</span>
            ) : (
              <span class="muted">{tr(T.private)}</span>
            )
          }
        />
        <TextBox
          label={tr(toJson ? T.json : T.env)}
          value={output.value}
          readOnly
          rows={18}
          wrap={false}
          downloadName={toJson ? "env.json" : ".env"}
          note={
            e ? (
              <span class="muted">
                {tr(T.vars).replace("{n}", fmt(Object.keys(e.values).length))}
              </span>
            ) : null
          }
        />
      </div>
      {warnings.length > 0 && (
        <ul class="env-warnings">
          {warnings.map((w, i) => (
            <li key={i} class="data-warn">
              {w}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
