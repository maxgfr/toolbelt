import { useComputed } from "@preact/signals";
import { Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Field, Segmented, TextBox } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { ParseNote } from "../_ui";
import { parseJson } from "../json/logic";
import { type CodeOptions, LANGS, type Lang, toCode } from "./logic";

const T = {
  input: l("JSON sample", "Exemple JSON", "JSON-Beispiel"),
  placeholder: l(
    'Paste a JSON sample, e.g. {"id": 1, "tags": ["a"], "owner": {"name": "Ann"}}',
    'Colle un exemple JSON, par ex. {"id": 1, "tags": ["a"], "owner": {"name": "Ann"}}',
    'Füge ein JSON-Beispiel ein, z. B. {"id": 1, "tags": ["a"], "owner": {"name": "Ann"}}',
  ),
  lang: l("Language", "Langage", "Sprache"),
  rootName: l("Root type name", "Nom du type racine", "Name des Wurzeltyps"),
  style: l("Style", "Style", "Stil"),
  records: l("Records", "Records", "Records"),
  pojo: l("Classes (getters/setters)", "Classes (getters/setters)", "Klassen (Getter/Setter)"),
  output: l("Code", "Code", "Code"),
  valid: l("Valid JSON", "JSON valide", "Gültiges JSON"),
  hint: l(
    "Keys missing from some array items become optional, null makes a value nullable, mixed values use the language's generic JSON type.",
    "Les clés absentes de certains éléments d'un tableau deviennent optionnelles, null rend une valeur nullable, les valeurs mélangées prennent le type JSON générique du langage.",
    "Schlüssel, die in manchen Array-Elementen fehlen, werden optional, null macht einen Wert nullable, gemischte Werte nutzen den generischen JSON-Typ der Sprache.",
  ),
  notes: {
    go: l("Go structs with json tags.", "Structs Go avec tags json.", "Go-Structs mit json-Tags."),
    rust: l(
      "Rust structs for serde (needs serde with derive, and serde_json for generic values).",
      "Structs Rust pour serde (nécessite serde avec derive, et serde_json pour les valeurs génériques).",
      "Rust-Structs für serde (braucht serde mit derive und serde_json für generische Werte).",
    ),
    kotlin: l(
      "Kotlin data classes for kotlinx.serialization.",
      "Data classes Kotlin pour kotlinx.serialization.",
      "Kotlin-Data-Classes für kotlinx.serialization.",
    ),
    java: l(
      "Java 16+ for records; renamed keys use Jackson's @JsonProperty.",
      "Java 16+ pour les records ; les clés renommées utilisent @JsonProperty de Jackson.",
      "Java 16+ für Records; umbenannte Schlüssel nutzen @JsonProperty von Jackson.",
    ),
    csharp: l(
      "C# positional records for System.Text.Json.",
      "Records positionnels C# pour System.Text.Json.",
      "Positionale C#-Records für System.Text.Json.",
    ),
    python: l(
      "Python 3.10+ (X | None syntax). Dataclasses do not rename keys: see the comments.",
      "Python 3.10+ (syntaxe X | None). Les dataclasses ne renomment pas les clés : voir les commentaires.",
      "Python 3.10+ (Syntax X | None). Dataclasses benennen Schlüssel nicht um: siehe die Kommentare.",
    ),
    swift: l("Swift Codable structs.", "Structs Swift Codable.", "Swift-Codable-Structs."),
    dart: l(
      "Dart classes with fromJson / toJson, no code generation needed.",
      "Classes Dart avec fromJson / toJson, sans génération de code.",
      "Dart-Klassen mit fromJson / toJson, ohne Codegenerierung.",
    ),
  } satisfies Record<Lang, unknown>,
};

export default function JsonToCode() {
  const input = useToolState("input", "");
  const lang = useToolState<Lang>("lang", "go");
  const rootName = useToolState("rootName", "Root");
  const java = useToolState<CodeOptions["java"]>("java", "record");
  const python = useToolState<CodeOptions["python"]>("python", "dataclass");

  const parsed = useComputed(() => (input.value.trim() ? parseJson(input.value) : null));
  const output = useComputed(() => {
    const p = parsed.value;
    if (!p?.ok) return "";
    return toCode(p.value, {
      lang: lang.value,
      rootName: rootName.value.trim() || "Root",
      java: java.value,
      python: python.value,
    });
  });
  const p = parsed.value;
  const ext = LANGS.find((x) => x.value === lang.value)?.ext ?? "txt";
  const file = lang.value === "go" || lang.value === "python" || lang.value === "rust";

  return (
    <>
      <div class="row json-to-code-options">
        <Select<Lang>
          label={tr(T.lang)}
          value={lang.value}
          options={LANGS.map((x) => ({ value: x.value, label: x.label }))}
          onChange={(v) => {
            lang.value = v;
          }}
        />
        <Field label={tr(T.rootName)}>
          <input
            class="input mono json-to-code-root"
            value={rootName.value}
            spellcheck={false}
            onInput={(e) => {
              rootName.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
        </Field>
        {lang.value === "java" && (
          <Segmented<CodeOptions["java"]>
            label={tr(T.style)}
            value={java.value}
            onChange={(v) => {
              java.value = v;
            }}
            options={[
              { value: "record", label: tr(T.records) },
              { value: "pojo", label: tr(T.pojo) },
            ]}
          />
        )}
        {lang.value === "python" && (
          <Segmented<CodeOptions["python"]>
            label={tr(T.style)}
            value={python.value}
            onChange={(v) => {
              python.value = v;
            }}
            options={[
              { value: "dataclass", label: "dataclasses" },
              { value: "pydantic", label: "Pydantic v2" },
            ]}
          />
        )}
      </div>
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(T.placeholder)}
          accept=".json,application/json,text/plain"
          rows={22}
          wrap={false}
          invalid={p ? !p.ok : false}
          note={p ? <ParseNote error={p.ok ? null : p} ok={tr(T.valid)} /> : null}
        />
        <TextBox
          label={tr(T.output)}
          value={output.value}
          readOnly
          rows={22}
          wrap={false}
          downloadName={`${file ? (rootName.value.trim() || "root").toLowerCase() : rootName.value.trim() || "Root"}.${ext}`}
          note={
            <span class="muted">
              {tr(T.notes[lang.value])} {tr(T.hint)}
            </span>
          }
        />
      </div>
    </>
  );
}
