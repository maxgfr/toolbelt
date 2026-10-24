/**
 * Small UI pieces shared by several text tools (could move to src/app/ui.tsx):
 * a clamped number input, a text with highlighted ranges, regex flag toggles
 * and regex error explanations.
 */
import type { ComponentChildren } from "preact";
import { Toggle } from "../../app/ui";
import { type L10n, l, tr } from "../../i18n";
import { FLAGS, type Flag, type RegexHint } from "./_shared";

/** A number input that only reports integers within [min, max]. */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  class: cls,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  class?: string;
}) {
  return (
    <input
      type="number"
      class={`input ${cls ?? ""}`}
      value={value}
      min={min}
      max={max}
      step={step}
      aria-label={label}
      onInput={(e) => {
        const raw = (e.currentTarget as HTMLInputElement).value;
        if (raw === "") return;
        const n = Number(raw);
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
      }}
    />
  );
}

export interface Range {
  start: number;
  end: number;
  /** Class of the mark (default "tx-hit"). */
  cls?: string;
  /** Content shown instead of / after the range (e.g. a replacement). */
  after?: ComponentChildren;
  title?: string;
}

/** `text` with the given non-overlapping ranges (sorted by start) wrapped in <mark>. */
export function Highlight({ text, ranges }: { text: string; ranges: Range[] }) {
  const out: ComponentChildren[] = [];
  let pos = 0;
  ranges.forEach((r, i) => {
    if (r.start < pos) return;
    if (r.start > pos) out.push(text.slice(pos, r.start));
    const body = text.slice(r.start, r.end);
    out.push(
      <mark
        key={i}
        class={`${r.cls ?? "tx-hit"} ${i % 2 ? "tx-odd" : ""} ${body ? "" : "tx-empty"}`}
        title={r.title}
      >
        {body}
      </mark>,
    );
    if (r.after !== undefined) out.push(r.after);
    pos = r.end;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return <pre class="tx-highlight">{out}</pre>;
}

/** Like `Field`, for controls that must not sit inside a <label> (segmented buttons, groups). */
export function Group({
  label,
  children,
  class: cls,
}: {
  label: string;
  children: ComponentChildren;
  class?: string;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset>'s <legend> does not lay out as a flex item like the .field label
    <div class={`field ${cls ?? ""}`} role="group" aria-label={label}>
      <span class="field-label">{label}</span>
      {children}
    </div>
  );
}

const FLAG_LABELS: Record<Flag, L10n> = {
  g: l("g · all matches", "g · toutes les occurrences", "g · alle Treffer"),
  i: l("i · ignore case", "i · ignorer la casse", "i · Groß-/Kleinschreibung ignorieren"),
  m: l("m · ^ $ per line", "m · ^ $ par ligne", "m · ^ $ pro Zeile"),
  s: l("s · . matches newlines", "s · . inclut les retours", "s · . inkl. Zeilenumbrüche"),
  u: l("u · Unicode", "u · Unicode", "u · Unicode"),
};

/** Flags stored as a string ("gi"), in canonical order. */
export function FlagToggles({
  flags,
  onChange,
  only,
}: {
  flags: string;
  onChange: (flags: string) => void;
  only?: readonly Flag[] | undefined;
}) {
  return (
    <>
      {(only ?? FLAGS).map((f) => (
        <Toggle
          key={f}
          checked={flags.includes(f)}
          onChange={(on) => {
            const set = new Set(flags);
            if (on) set.add(f);
            else set.delete(f);
            onChange(FLAGS.filter((x) => set.has(x)).join(""));
          }}
          label={tr(FLAG_LABELS[f])}
        />
      ))}
    </>
  );
}

const HINTS: Record<NonNullable<RegexHint>, L10n> = {
  repeat: l(
    "A quantifier (*, +, ?, {n}) has nothing before it to repeat. To match the character itself, escape it: \\*",
    "Un quantificateur (*, +, ?, {n}) n'a rien à répéter avant lui. Pour chercher le caractère lui-même, échappe-le : \\*",
    "Ein Quantifizierer (*, +, ?, {n}) hat nichts davor, das er wiederholen kann. Um das Zeichen selbst zu finden, maskiere es: \\*",
  ),
  class: l(
    "A [ opens a character class that is never closed by ]. To match a bracket, escape it: \\[",
    "Un [ ouvre une classe de caractères jamais fermée par ]. Pour chercher un crochet, échappe-le : \\[",
    "Ein [ öffnet eine Zeichenklasse, die nie mit ] geschlossen wird. Um eine eckige Klammer zu finden, maskiere sie: \\[",
  ),
  group: l(
    "A ( opens a group that is never closed by ). To match a parenthesis, escape it: \\(",
    "Une ( ouvre un groupe jamais fermé par ). Pour chercher une parenthèse, échappe-la : \\(",
    "Eine ( öffnet eine Gruppe, die nie mit ) geschlossen wird. Um eine Klammer zu finden, maskiere sie: \\(",
  ),
  paren: l(
    "There is a ) without a matching (. To match a parenthesis, escape it: \\)",
    "Il y a une ) sans ( correspondante. Pour chercher une parenthèse, échappe-la : \\)",
    "Hier steht eine ) ohne passende (. Um eine Klammer zu finden, maskiere sie: \\)",
  ),
  backslash: l(
    "The pattern ends with a lone backslash. Use \\\\ to match a backslash.",
    "Le motif se termine par une barre oblique inversée seule. Utilise \\\\ pour en chercher une.",
    "Das Muster endet mit einem einzelnen Backslash. Verwende \\\\, um einen Backslash zu finden.",
  ),
  name: l(
    "Named groups are written (?<name>…), with a name that starts with a letter and is unique.",
    "Les groupes nommés s'écrivent (?<nom>…), avec un nom qui commence par une lettre et unique.",
    "Benannte Gruppen schreibt man (?<name>…), mit einem eindeutigen Namen, der mit einem Buchstaben beginnt.",
  ),
  escape: l(
    "With the u flag, unknown escapes such as \\a are errors, and \\p{…} needs a valid property (e.g. \\p{L}, \\p{Script=Greek}).",
    "Avec le drapeau u, les échappements inconnus comme \\a sont des erreurs, et \\p{…} demande une propriété valide (par ex. \\p{L}, \\p{Script=Greek}).",
    "Mit dem Flag u sind unbekannte Escapes wie \\a Fehler, und \\p{…} braucht eine gültige Eigenschaft (z. B. \\p{L}, \\p{Script=Greek}).",
  ),
  brace: l(
    "Braces must form a quantifier such as {2}, {2,} or {2,5} (min ≤ max). To match a brace, escape it: \\{",
    "Les accolades doivent former un quantificateur comme {2}, {2,} ou {2,5} (min ≤ max). Pour chercher une accolade, échappe-la : \\{",
    "Geschweifte Klammern müssen einen Quantifizierer wie {2}, {2,} oder {2,5} bilden (min ≤ max). Um eine geschweifte Klammer zu finden, maskiere sie: \\{",
  ),
  range: l(
    "In a range such as [a-z], the first character must come before the second. Put - first or last to match a dash.",
    "Dans un intervalle comme [a-z], le premier caractère doit précéder le second. Mets - en premier ou en dernier pour chercher un tiret.",
    "In einem Bereich wie [a-z] muss das erste Zeichen vor dem zweiten kommen. Setze - an den Anfang oder ans Ende, um einen Bindestrich zu finden.",
  ),
  flags: l(
    "Each flag can only appear once.",
    "Chaque drapeau ne peut apparaître qu'une fois.",
    "Jedes Flag darf nur einmal vorkommen.",
  ),
  lookbehind: l(
    "Lookarounds are written (?=…), (?!…), (?<=…) and (?<!…).",
    "Les assertions s'écrivent (?=…), (?!…), (?<=…) et (?<!…).",
    "Lookarounds schreibt man (?=…), (?!…), (?<=…) und (?<!…).",
  ),
};

/** The engine's message, plus a plain explanation when the error is a common one. */
export function RegexError({ message, hint }: { message: string; hint: RegexHint }) {
  return (
    <div class="error-note" role="alert">
      <div>{message}</div>
      {hint && <div class="tx-hint">{tr(HINTS[hint])}</div>}
    </div>
  );
}
