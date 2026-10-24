import { useComputed } from "@preact/signals";
import type { SqlLanguage } from "sql-formatter";
import { useToolState } from "../../../app/state";
import { Segmented, TextBox } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { ParseNote } from "../_ui";
import { DIALECTS, formatSql, type Indent, type KeywordCase, minifySql } from "./logic";

type Mode = "format" | "minify";

const T = {
  input: l("SQL", "SQL"),
  output: l("Result", "Résultat"),
  placeholder: l(
    "Paste SQL, e.g. select id, name from users where active = 1 order by name",
    "Colle du SQL, par ex. select id, name from users where active = 1 order by name",
  ),
  format: l("Format", "Formater"),
  minify: l("Minify", "Minifier"),
  dialect: l("Dialect", "Dialecte"),
  keywords: l("Keywords", "Mots-clés"),
  upper: l("UPPER", "MAJUSCULES"),
  lower: l("lower", "minuscules"),
  preserve: l("As typed", "Tels quels"),
  indent: l("Indentation", "Indentation"),
  spaces2: l("2 spaces", "2 espaces"),
  spaces4: l("4 spaces", "4 espaces"),
  tab: l("Tab", "Tabulation"),
  minifyNote: l(
    "Comments are removed; optimizer hints (/*+ … */) are kept.",
    "Les commentaires sont retirés ; les indications d'optimiseur (/*+ … */) sont conservées.",
  ),
};

export default function Sql() {
  const input = useToolState("input", "");
  const mode = useToolState<Mode>("mode", "format");
  const dialect = useToolState<SqlLanguage>("dialect", "sql");
  const keywordCase = useToolState<KeywordCase>("keywordCase", "upper");
  const indent = useToolState<Indent>("indent", "2");

  const result = useComputed(() => {
    if (!input.value.trim()) return null;
    if (mode.value === "minify")
      return { ok: true as const, text: minifySql(input.value, dialect.value) };
    return formatSql(input.value, {
      dialect: dialect.value,
      keywordCase: keywordCase.value,
      indent: indent.value,
    });
  });
  const r = result.value;

  return (
    <>
      <div class="row">
        <Segmented<Mode>
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "format", label: tr(T.format) },
            { value: "minify", label: tr(T.minify) },
          ]}
        />
        <label class="row small">
          <span class="muted">{tr(T.dialect)}</span>
          <select
            class="input sql-dialect"
            value={dialect.value}
            onChange={(e) => {
              dialect.value = (e.currentTarget as HTMLSelectElement).value as SqlLanguage;
            }}
          >
            {DIALECTS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        {mode.value === "format" && (
          <>
            <Segmented<KeywordCase>
              label={tr(T.keywords)}
              value={keywordCase.value}
              onChange={(v) => {
                keywordCase.value = v;
              }}
              options={[
                { value: "upper", label: tr(T.upper) },
                { value: "lower", label: tr(T.lower) },
                { value: "preserve", label: tr(T.preserve) },
              ]}
            />
            <Segmented<Indent>
              label={tr(T.indent)}
              value={indent.value}
              onChange={(v) => {
                indent.value = v;
              }}
              options={[
                { value: "2", label: tr(T.spaces2) },
                { value: "4", label: tr(T.spaces4) },
                { value: "tab", label: tr(T.tab) },
              ]}
            />
          </>
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
          accept=".sql,text/plain"
          rows={22}
          wrap={false}
          invalid={r ? !r.ok : false}
          note={r && !r.ok ? <ParseNote error={r} /> : null}
        />
        <TextBox
          label={tr(T.output)}
          value={r?.ok ? r.text : ""}
          readOnly
          rows={22}
          wrap={mode.value === "minify"}
          downloadName={mode.value === "minify" ? "query.min.sql" : "query.sql"}
          note={mode.value === "minify" ? <span class="muted">{tr(T.minifyNote)}</span> : null}
        />
      </div>
    </>
  );
}
