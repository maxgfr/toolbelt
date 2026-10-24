import { useComputed } from "@preact/signals";
import { Badge } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, Segmented, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { formatPath } from "../_shared";
import { ParseNote } from "../_ui";
import { parseJson } from "../json/logic";
import { type ErrorCode, inferSchema, isSchema, type SchemaError, validate } from "./logic";

type Mode = "generate" | "validate";

const T = {
  generate: l("Sample → schema", "Exemple → schéma"),
  validate: l("Validate", "Valider"),
  sample: l("JSON sample", "Exemple JSON"),
  samplePh: l(
    'Paste a JSON sample, e.g. {"id": 1, "email": "ann@example.com", "tags": ["a"]}',
    'Colle un exemple JSON, par ex. {"id": 1, "email": "ann@example.com", "tags": ["a"]}',
  ),
  schema: l("JSON Schema", "JSON Schema"),
  schemaPh: l(
    'Paste a JSON Schema, e.g. {"type": "object", "required": ["id"]}',
    'Colle un JSON Schema, par ex. {"type": "object", "required": ["id"]}',
  ),
  doc: l("JSON document", "Document JSON"),
  docPh: l("Paste the JSON to check…", "Colle le JSON à vérifier…"),
  formats: l(
    "Detect formats (date-time, email, uri…)",
    "Détecter les formats (date-time, email, uri…)",
  ),
  strict: l(
    "No extra keys (additionalProperties: false)",
    "Aucune clé en plus (additionalProperties: false)",
  ),
  checkFormats: l("Check formats", "Vérifier les formats"),
  useIt: l("Validate with this schema", "Valider avec ce schéma"),
  valid: l("Valid JSON", "JSON valide"),
  notSchema: l(
    "A schema must be a JSON object (or true / false).",
    "Un schéma doit être un objet JSON (ou true / false).",
  ),
  ok: l("The document matches the schema.", "Le document respecte le schéma."),
  errors: l("{n} errors", "{n} erreurs"),
  oneError: l("1 error", "1 erreur"),
  path: l("Path", "Chemin"),
  problem: l("Problem", "Problème"),
  hint: l(
    "Draft 2020-12. Keys missing from some array items are not required; integers and other numbers are told apart.",
    "Draft 2020-12. Les clés absentes de certains éléments d'un tableau ne sont pas requises ; les entiers sont distingués des autres nombres.",
  ),
  support: l(
    "Supported: type, enum, const, properties, required, additionalProperties, patternProperties, items, prefixItems, min/max*, pattern, format, uniqueItems, allOf/anyOf/oneOf/not, if/then/else, $ref inside the schema.",
    "Pris en charge : type, enum, const, properties, required, additionalProperties, patternProperties, items, prefixItems, min/max*, pattern, format, uniqueItems, allOf/anyOf/oneOf/not, if/then/else, $ref interne au schéma.",
  ),
  e: {
    type: l("Expected {expected}, got {actual}.", "{expected} attendu, {actual} trouvé."),
    enum: l("{actual} is not one of {expected}.", "{actual} ne fait pas partie de {expected}."),
    const: l("Must be {expected}, got {actual}.", "Doit valoir {expected}, vaut {actual}."),
    required: l("Missing required key “{expected}”.", "Clé requise « {expected} » manquante."),
    additional: l("Key “{expected}” is not allowed.", "La clé « {expected} » n'est pas autorisée."),
    minimum: l(
      "{actual} is less than the minimum {expected}.",
      "{actual} est inférieur au minimum {expected}.",
    ),
    maximum: l(
      "{actual} is more than the maximum {expected}.",
      "{actual} dépasse le maximum {expected}.",
    ),
    exclusiveMinimum: l(
      "{actual} must be more than {expected}.",
      "{actual} doit être supérieur à {expected}.",
    ),
    exclusiveMaximum: l(
      "{actual} must be less than {expected}.",
      "{actual} doit être inférieur à {expected}.",
    ),
    multipleOf: l(
      "{actual} is not a multiple of {expected}.",
      "{actual} n'est pas un multiple de {expected}.",
    ),
    minLength: l(
      "Too short: {actual} characters, at least {expected}.",
      "Trop court : {actual} caractères, au moins {expected}.",
    ),
    maxLength: l(
      "Too long: {actual} characters, at most {expected}.",
      "Trop long : {actual} caractères, au plus {expected}.",
    ),
    pattern: l("Does not match the pattern {expected}.", "Ne correspond pas au motif {expected}."),
    format: l("Not a valid {expected}.", "{expected} invalide."),
    minItems: l("{actual} items, at least {expected}.", "{actual} éléments, au moins {expected}."),
    maxItems: l("{actual} items, at most {expected}.", "{actual} éléments, au plus {expected}."),
    uniqueItems: l("Items {actual} are equal.", "Les éléments {actual} sont identiques."),
    minProperties: l("{actual} keys, at least {expected}.", "{actual} clés, au moins {expected}."),
    maxProperties: l("{actual} keys, at most {expected}.", "{actual} clés, au plus {expected}."),
    anyOf: l(
      "Matches none of the {expected} anyOf schemas.",
      "Ne correspond à aucun des {expected} schémas anyOf.",
    ),
    oneOf: l(
      "Must match exactly one of the {expected} oneOf schemas, matches {actual}.",
      "Doit correspondre à exactement un des {expected} schémas oneOf, en respecte {actual}.",
    ),
    not: l("Must not match the “not” schema.", "Ne doit pas correspondre au schéma « not »."),
    false: l("Not allowed here (schema false).", "Interdit ici (schéma false)."),
    ref: l("Cannot resolve $ref {expected}.", "Impossible de résoudre le $ref {expected}."),
    badPattern: l(
      "The schema's pattern {expected} is not a valid regex.",
      "Le motif {expected} du schéma n'est pas une regex valide.",
    ),
    depth: l(
      "Too deeply nested (a $ref loop?).",
      "Imbrication trop profonde (une boucle de $ref ?).",
    ),
  } satisfies Record<ErrorCode, unknown>,
};

function message(e: SchemaError): string {
  return tr(T.e[e.code])
    .replace("{expected}", e.expected ?? "")
    .replace("{actual}", e.actual ?? "");
}

export default function JsonSchema() {
  const mode = useToolState<Mode>("mode", "generate");
  const sample = useToolState("sample", "");
  const formats = useToolState("formats", true);
  const strict = useToolState("strict", false);
  const schemaText = useToolState("schema", "");
  const docText = useToolState("doc", "");
  const checkFormats = useToolState("checkFormats", true);

  const parsedSample = useComputed(() => (sample.value.trim() ? parseJson(sample.value) : null));
  const generated = useComputed(() => {
    const p = parsedSample.value;
    if (!p?.ok) return "";
    return JSON.stringify(
      inferSchema(p.value, { formats: formats.value, strict: strict.value }),
      null,
      2,
    );
  });
  const parsedSchema = useComputed(() =>
    schemaText.value.trim() ? parseJson(schemaText.value) : null,
  );
  const parsedDoc = useComputed(() => (docText.value.trim() ? parseJson(docText.value) : null));
  const result = useComputed(() => {
    const s = parsedSchema.value;
    const d = parsedDoc.value;
    if (!s?.ok || !d?.ok || !isSchema(s.value)) return null;
    return validate(d.value, s.value, { formats: checkFormats.value });
  });

  const ps = parsedSample.value;
  const sc = parsedSchema.value;
  const dc = parsedDoc.value;
  const res = result.value;

  return (
    <>
      <div class="row">
        <Segmented<Mode>
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "generate", label: tr(T.generate) },
            { value: "validate", label: tr(T.validate) },
          ]}
        />
        {mode.value === "generate" ? (
          <>
            <Toggle
              checked={formats.value}
              onChange={(v) => {
                formats.value = v;
              }}
              label={tr(T.formats)}
            />
            <Toggle
              checked={strict.value}
              onChange={(v) => {
                strict.value = v;
              }}
              label={tr(T.strict)}
            />
          </>
        ) : (
          <Toggle
            checked={checkFormats.value}
            onChange={(v) => {
              checkFormats.value = v;
            }}
            label={tr(T.checkFormats)}
          />
        )}
      </div>
      {mode.value === "generate" ? (
        <div class="grid-2">
          <TextBox
            label={tr(T.sample)}
            value={sample.value}
            onInput={(v) => {
              sample.value = v;
            }}
            placeholder={tr(T.samplePh)}
            accept=".json,application/json,text/plain"
            rows={22}
            wrap={false}
            invalid={ps ? !ps.ok : false}
            note={ps ? <ParseNote error={ps.ok ? null : ps} ok={tr(T.valid)} /> : null}
          />
          <TextBox
            label={tr(T.schema)}
            value={generated.value}
            readOnly
            rows={22}
            wrap={false}
            downloadName="schema.json"
            actions={
              generated.value ? (
                <Button
                  size="sm"
                  variant="ghost"
                  icon="check"
                  onClick={() => {
                    schemaText.value = generated.value;
                    docText.value = sample.value;
                    mode.value = "validate";
                  }}
                >
                  {tr(T.useIt)}
                </Button>
              ) : null
            }
            note={<span class="muted">{tr(T.hint)}</span>}
          />
        </div>
      ) : (
        <>
          <div class="grid-2">
            <TextBox
              label={tr(T.schema)}
              value={schemaText.value}
              onInput={(v) => {
                schemaText.value = v;
              }}
              placeholder={tr(T.schemaPh)}
              accept=".json,application/json,application/schema+json,text/plain"
              rows={18}
              wrap={false}
              invalid={sc ? !sc.ok || !isSchema(sc.value) : false}
              note={
                sc ? (
                  !sc.ok ? (
                    <ParseNote error={sc} />
                  ) : !isSchema(sc.value) ? (
                    <span class="error">{tr(T.notSchema)}</span>
                  ) : null
                ) : (
                  <span class="muted">{tr(T.support)}</span>
                )
              }
            />
            <TextBox
              label={tr(T.doc)}
              value={docText.value}
              onInput={(v) => {
                docText.value = v;
              }}
              placeholder={tr(T.docPh)}
              accept=".json,application/json,text/plain"
              rows={18}
              wrap={false}
              invalid={dc ? !dc.ok : false}
              note={dc && !dc.ok ? <ParseNote error={dc} /> : null}
            />
          </div>
          {res &&
            (res.length === 0 ? (
              <p>
                <Badge kind="ok">{tr(T.ok)}</Badge>
              </p>
            ) : (
              <div class="stack">
                <p>
                  <Badge kind="bad">
                    {res.length === 1
                      ? tr(T.oneError)
                      : tr(T.errors).replace("{n}", fmt(res.length))}
                  </Badge>
                </p>
                <div class="table-wrap json-schema-errors">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>{tr(T.path)}</th>
                        <th>{tr(T.problem)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {res.map((e, i) => (
                        <tr key={i}>
                          <td class="mono json-schema-path">{formatPath(e.path)}</td>
                          <td class="json-schema-msg">{message(e)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </>
      )}
    </>
  );
}
