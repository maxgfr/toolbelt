import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Field, TextBox, Toggle } from "../../../app/ui";
import { type L10n, l, tr } from "../../../i18n";
import { Badge } from "../_ui";
import {
  buildMessage,
  type CommitInput,
  gitCommand,
  header,
  type Issue,
  type IssueCode,
  MAX_HEADER,
  TYPES,
  validate,
} from "./logic";

const T = {
  type: l("Type", "Type", "Typ"),
  scope: l("Scope", "Portée (scope)", "Scope"),
  scopeHint: l(
    "Optional: the part of the code, e.g. api, parser",
    "Facultatif : la partie du code, par ex. api, parser",
    "Optional: der betroffene Teil des Codes, z. B. api, parser",
  ),
  description: l("Description", "Description", "Beschreibung"),
  descriptionPh: l(
    "add dark mode to the settings page",
    "add dark mode to the settings page",
    "add dark mode to the settings page",
  ),
  body: l("Body", "Corps", "Body"),
  bodyPh: l(
    "Why this change, and what it does differently. Optional.",
    "Pourquoi ce changement, et ce qu'il change. Facultatif.",
    "Warum diese Änderung und was sie anders macht. Optional.",
  ),
  wrap: l(
    "Wrap the body at 72 columns",
    "Couper le corps à 72 colonnes",
    "Body bei 72 Spalten umbrechen",
  ),
  breaking: l("Breaking change", "Changement incompatible", "Breaking Change"),
  breakingNote: l(
    "What breaks, and how to migrate",
    "Ce qui casse, et comment migrer",
    "Was bricht und wie man migriert",
  ),
  closes: l("Closes issues", "Ferme les tickets", "Schließt Issues"),
  closesHint: l(
    "Numbers or references: 12, #34, org/repo#5",
    "Numéros ou références : 12, #34, org/repo#5",
    "Nummern oder Verweise: 12, #34, org/repo#5",
  ),
  footers: l("Other footers", "Autres pieds", "Weitere Footer"),
  footersPh: l(
    "Reviewed-by: Ana\nRefs: #7",
    "Reviewed-by: Ana\nRefs: #7",
    "Reviewed-by: Ana\nRefs: #7",
  ),
  message: l("Commit message", "Message de commit", "Commit-Nachricht"),
  command: l("Command", "Commande", "Befehl"),
  ok: l("Valid Conventional Commit", "Conventional Commit valide", "Gültiger Conventional Commit"),
  header: l("Header", "En-tête", "Header"),
};

const TYPE_L: Record<(typeof TYPES)[number], L10n> = {
  feat: l("a new feature", "une nouvelle fonctionnalité", "ein neues Feature"),
  fix: l("a bug fix", "une correction de bogue", "eine Fehlerbehebung"),
  docs: l("documentation only", "documentation seulement", "nur Dokumentation"),
  style: l(
    "formatting, no code change",
    "mise en forme, sans changement de code",
    "Formatierung, keine Codeänderung",
  ),
  refactor: l(
    "neither a fix nor a feature",
    "ni correction ni fonctionnalité",
    "weder Fehlerbehebung noch Feature",
  ),
  perf: l(
    "a performance improvement",
    "une amélioration des performances",
    "eine Performance-Verbesserung",
  ),
  test: l(
    "adding or fixing tests",
    "ajout ou correction de tests",
    "Tests hinzufügen oder korrigieren",
  ),
  build: l(
    "build system or dependencies",
    "système de build ou dépendances",
    "Build-System oder Abhängigkeiten",
  ),
  ci: l("CI configuration", "configuration de l'intégration continue", "CI-Konfiguration"),
  chore: l(
    "maintenance, nothing in src or tests",
    "maintenance, rien dans le code ni les tests",
    "Wartung, nichts in src oder Tests",
  ),
  revert: l(
    "reverts a previous commit",
    "annule un commit précédent",
    "macht einen früheren Commit rückgängig",
  ),
};

const ISSUES: Record<IssueCode, L10n> = {
  noType: l("Choose a type.", "Choisis un type.", "Wähle einen Typ."),
  badType: l(
    "The type must be a single word.",
    "Le type doit être un seul mot.",
    "Der Typ muss ein einzelnes Wort sein.",
  ),
  badScope: l(
    "The scope must be a noun without spaces or parentheses (commas allowed).",
    "La portée doit être un nom sans espaces ni parenthèses (virgules permises).",
    "Der Scope muss ein Substantiv ohne Leerzeichen oder Klammern sein (Kommas erlaubt).",
  ),
  noDescription: l(
    "Write a short description.",
    "Écris une courte description.",
    "Schreib eine kurze Beschreibung.",
  ),
  headerTooLong: l(
    "The header is longer than 72 characters: it gets cut in many tools.",
    "L'en-tête dépasse 72 caractères : beaucoup d'outils le tronquent.",
    "Der Header ist länger als 72 Zeichen: Viele Tools schneiden ihn ab.",
  ),
  headerLong: l(
    "Over 50 characters: fine, but shorter headers read better in git log.",
    "Plus de 50 caractères : acceptable, mais un en-tête plus court se lit mieux dans git log.",
    "Über 50 Zeichen: in Ordnung, aber kürzere Header lesen sich in git log besser.",
  ),
  capitalized: l(
    "Conventional descriptions usually start in lowercase.",
    "Par convention, la description commence en minuscule.",
    "Konventionell beginnt die Beschreibung mit einem Kleinbuchstaben.",
  ),
  period: l(
    "No period at the end of the header.",
    "Pas de point à la fin de l'en-tête.",
    "Kein Punkt am Ende des Headers.",
  ),
  notImperative: l(
    "Use the imperative mood: “{v}”, as in “{v} …”, not a past or -ing form.",
    "Utilise l'impératif : « {v} », comme dans « {v} … », pas le passé ni la forme en -ing.",
    "Verwende den Imperativ: „{v}“, wie in „{v} …“, keine Vergangenheits- oder -ing-Form.",
  ),
  breakingNoNote: l(
    "Describe the breaking change so users know how to migrate.",
    "Décris le changement incompatible pour que les utilisateurs sachent migrer.",
    "Beschreibe den Breaking Change, damit Nutzer wissen, wie sie migrieren.",
  ),
  badFooter: l(
    "Footers look like “Token: value” or “Token #value”: {v}",
    "Les pieds s'écrivent « Jeton: valeur » ou « Jeton #valeur » : {v}",
    "Footer haben die Form „Token: Wert“ oder „Token #Wert“: {v}",
  ),
};

function IssueLine({ issue }: { issue: Issue }) {
  return (
    <li class={`commit-issue commit-${issue.level}`}>
      <Badge
        kind={issue.code === "noDescription" ? "info" : issue.level === "error" ? "bad" : "warn"}
      >
        {tr(ISSUES[issue.code]).replaceAll("{v}", issue.detail ?? "")}
      </Badge>
    </li>
  );
}

export default function Commit() {
  const type = useToolState("type", "feat");
  const scope = useToolState("scope", "");
  const description = useToolState("description", "");
  const body = useToolState("body", "");
  const wrapBody = useToolState("wrap", true);
  const breaking = useToolState("breaking", false);
  const breakingNote = useToolState("breakingNote", "");
  const closes = useToolState("closes", "");
  const footers = useToolState("footers", "");

  const input = useComputed<CommitInput>(() => ({
    type: type.value,
    scope: scope.value,
    description: description.value,
    body: body.value,
    breaking: breaking.value,
    breakingNote: breakingNote.value,
    closes: closes.value,
    footers: footers.value,
  }));
  const issues = useComputed(() => validate(input.value));
  const message = useComputed(() =>
    description.value.trim() ? buildMessage(input.value, wrapBody.value) : "",
  );
  const len = header(input.value).length;
  const text = (s: { value: string }) => (e: Event) => {
    s.value = (e.currentTarget as HTMLInputElement).value;
  };

  return (
    <div class="grid-2">
      <div class="stack">
        <div class="commit-head">
          <Field label={tr(T.type)}>
            <select class="input" value={type.value} onChange={text(type)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t} — {tr(TYPE_L[t])}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr(T.scope)} hint={tr(T.scopeHint)}>
            <input
              class="input mono"
              value={scope.value}
              spellcheck={false}
              onInput={text(scope)}
            />
          </Field>
        </div>
        <Field label={tr(T.description)}>
          <div class="commit-desc">
            <input
              class="input"
              value={description.value}
              placeholder={tr(T.descriptionPh)}
              onInput={text(description)}
            />
            <span class={`mono small ${len > MAX_HEADER ? "error" : "muted"}`} title={tr(T.header)}>
              {len}/{MAX_HEADER}
            </span>
          </div>
        </Field>
        <Toggle
          checked={breaking.value}
          onChange={(v) => {
            breaking.value = v;
          }}
          label={tr(T.breaking)}
        />
        {breaking.value && (
          <Field label={tr(T.breakingNote)}>
            <textarea
              class="input textarea"
              rows={2}
              value={breakingNote.value}
              onInput={text(breakingNote)}
            />
          </Field>
        )}
        <Field label={tr(T.body)}>
          <textarea
            class="input textarea"
            rows={5}
            value={body.value}
            placeholder={tr(T.bodyPh)}
            onInput={text(body)}
          />
        </Field>
        <Toggle
          checked={wrapBody.value}
          onChange={(v) => {
            wrapBody.value = v;
          }}
          label={tr(T.wrap)}
        />
        <Field label={tr(T.closes)} hint={tr(T.closesHint)}>
          <input class="input mono" value={closes.value} onInput={text(closes)} />
        </Field>
        <Field label={tr(T.footers)}>
          <textarea
            class="input textarea mono"
            rows={2}
            value={footers.value}
            placeholder={tr(T.footersPh)}
            onInput={text(footers)}
          />
        </Field>
      </div>

      <div class="stack">
        <ul class="commit-issues">
          {issues.value.length === 0 ? (
            <li>
              <Badge kind="ok">{tr(T.ok)}</Badge>
            </li>
          ) : (
            issues.value.map((i) => <IssueLine key={i.code + (i.detail ?? "")} issue={i} />)
          )}
        </ul>
        <TextBox label={tr(T.message)} value={message.value} readOnly rows={12} />
        {message.value && (
          <TextBox label={tr(T.command)} value={gitCommand(message.value)} readOnly rows={4} />
        )}
      </div>
    </div>
  );
}
