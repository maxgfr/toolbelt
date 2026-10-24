import { useToolState } from "../../../app/state";
import { Button, Field, Output, Panel, Toggle } from "../../../app/ui";
import { type L10n, l, locale, tr } from "../../../i18n";
import { DraftInput } from "../_ui";
import {
  bit,
  chmodCommand,
  PERMS,
  type Perm,
  PRESETS,
  parseOctal,
  parseSymbolic,
  SETGID,
  SETUID,
  STICKY,
  shortOctal,
  toOctal,
  toSymbolic,
  WHO,
  type Who,
} from "./logic";

const T = {
  permissions: l("Permissions", "Permissions", "Rechte"),
  octal: l("Octal", "Octal", "Oktal"),
  symbolic: l("Symbolic", "Symbolique", "Symbolisch"),
  special: l("Special bits", "Bits spéciaux", "Spezialbits"),
  presets: l("Common modes", "Modes courants", "Gängige Modi"),
  command: l("Command", "Commande", "Befehl"),
  path: l("File or folder", "Fichier ou dossier", "Datei oder Ordner"),
  recursive: l("Recursive (-R)", "Récursif (-R)", "Rekursiv (-R)"),
  useSymbolic: l(
    "Symbolic form (u=…,g=…,o=…)",
    "Forme symbolique (u=…,g=…,o=…)",
    "Symbolische Form (u=…,g=…,o=…)",
  ),
  can: l("can", "peut", "kann"),
  noAccess: l("has no access", "n'a aucun droit", "hat keinen Zugriff"),
  folderNote: l(
    "On a folder, r lists its content, w creates and deletes files in it, x lets you enter it.",
    "Sur un dossier, r liste son contenu, w y crée et supprime des fichiers, x permet d'y entrer.",
    "Bei einem Ordner listet r den Inhalt auf, w legt darin Dateien an und löscht sie, x erlaubt das Betreten.",
  ),
};

const WHO_L: Record<Who, L10n> = {
  owner: l("Owner (u)", "Propriétaire (u)", "Besitzer (u)"),
  group: l("Group (g)", "Groupe (g)", "Gruppe (g)"),
  others: l("Others (o)", "Autres (o)", "Andere (o)"),
};
const WHO_SHORT: Record<Who, L10n> = {
  owner: l("The owner", "Le propriétaire", "Der Besitzer"),
  group: l("The group", "Le groupe", "Die Gruppe"),
  others: l("Everyone else", "Tous les autres", "Jeder andere"),
};
const PERM_L: Record<Perm, L10n> = {
  r: l("Read", "Lecture", "Lesen"),
  w: l("Write", "Écriture", "Schreiben"),
  x: l("Execute", "Exécution", "Ausführen"),
};
const PERM_VERB: Record<Perm, L10n> = {
  r: l("read", "lire", "lesen"),
  w: l("write", "écrire", "schreiben"),
  x: l("execute", "exécuter", "ausführen"),
};
const SPECIALS: { bit: number; label: L10n; hint: L10n }[] = [
  {
    bit: SETUID,
    label: l("setuid", "setuid", "setuid"),
    hint: l(
      "Runs as the file's owner",
      "S'exécute avec les droits du propriétaire",
      "Läuft mit den Rechten des Dateibesitzers",
    ),
  },
  {
    bit: SETGID,
    label: l("setgid", "setgid", "setgid"),
    hint: l(
      "Runs as the group; new files in a folder inherit its group",
      "S'exécute avec le groupe ; les fichiers créés dans un dossier héritent de son groupe",
      "Läuft mit der Gruppe; neue Dateien in einem Ordner erben dessen Gruppe",
    ),
  },
  {
    bit: STICKY,
    label: l("sticky", "sticky", "sticky"),
    hint: l(
      "In a shared folder, only owners can delete their files (like /tmp)",
      "Dans un dossier partagé, seuls les propriétaires suppriment leurs fichiers (comme /tmp)",
      "In einem geteilten Ordner können nur die Besitzer ihre Dateien löschen (wie /tmp)",
    ),
  },
];
/** Keyed by the short octal form. */
const PRESET_L: Record<string, L10n> = {
  "644": l("files", "fichiers", "Dateien"),
  "600": l("private file, keys", "fichier privé, clés", "private Datei, Schlüssel"),
  "755": l("scripts, folders", "scripts, dossiers", "Skripte, Ordner"),
  "700": l("private folder", "dossier privé", "privater Ordner"),
  "664": l("shared with group", "partagé avec le groupe", "mit der Gruppe geteilt"),
  "775": l("group folder", "dossier de groupe", "Gruppenordner"),
  "444": l("read-only", "lecture seule", "schreibgeschützt"),
  "777": l("everyone, avoid", "tout le monde, à éviter", "alle, vermeiden"),
  "1777": l("like /tmp", "comme /tmp", "wie /tmp"),
  "2775": l("team folder", "dossier d'équipe", "Teamordner"),
};

export default function Chmod() {
  const mode = useToolState("mode", 0o644);
  const path = useToolState("path", "");
  const recursive = useToolState("recursive", false);
  const symbolic = useToolState("symbolic", false);
  const m = mode.value;

  const list = new Intl.ListFormat(locale(), { type: "conjunction" });
  const flip = (b: number) => {
    mode.value = m ^ b;
  };

  return (
    <>
      <div class="grid-2">
        <Field label={tr(T.octal)}>
          <DraftInput
            label={tr(T.octal)}
            value={toOctal(m)}
            apply={(t) => {
              const v = parseOctal(t);
              if (v !== null) mode.value = v;
              return v !== null;
            }}
          />
        </Field>
        <Field label={tr(T.symbolic)}>
          <DraftInput
            label={tr(T.symbolic)}
            value={toSymbolic(m)}
            apply={(t) => {
              const v = parseSymbolic(t);
              if (v !== null) mode.value = v;
              return v !== null;
            }}
          />
        </Field>
      </div>

      <Panel title={tr(T.permissions)}>
        <div class="table-wrap">
          <table class="table chmod-grid">
            <thead>
              <tr>
                <th />
                {PERMS.map((p) => (
                  <th key={p}>
                    {tr(PERM_L[p])} <span class="muted mono">({p})</span>
                  </th>
                ))}
                <th class="num">{tr(T.octal)}</th>
              </tr>
            </thead>
            <tbody>
              {WHO.map((who) => (
                <tr key={who}>
                  <th scope="row">{tr(WHO_L[who])}</th>
                  {PERMS.map((p) => (
                    <td key={p}>
                      <input
                        type="checkbox"
                        class="chmod-check"
                        checked={!!(m & bit(who, p))}
                        aria-label={`${tr(WHO_L[who])} — ${tr(PERM_L[p])}`}
                        onChange={() => flip(bit(who, p))}
                      />
                    </td>
                  ))}
                  <td class="num mono">{(m >> { owner: 6, group: 3, others: 0 }[who]) & 7}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div class="chmod-specials">
          <span class="field-label">{tr(T.special)}</span>
          {SPECIALS.map((s) => (
            <label key={s.bit} class="toggle" title={tr(s.hint)}>
              <input type="checkbox" checked={!!(m & s.bit)} onChange={() => flip(s.bit)} />
              <span>
                <span class="mono">{tr(s.label)}</span>{" "}
                <span class="muted small">— {tr(s.hint)}</span>
              </span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title={tr(T.command)}>
        <div class="grid-2">
          <Field label={tr(T.path)}>
            <input
              class="input mono"
              value={path.value}
              placeholder="deploy.sh"
              spellcheck={false}
              onInput={(e) => {
                path.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
          <div class="stack chmod-opts">
            <Toggle
              checked={recursive.value}
              onChange={(v) => {
                recursive.value = v;
              }}
              label={tr(T.recursive)}
            />
            <Toggle
              checked={symbolic.value}
              onChange={(v) => {
                symbolic.value = v;
              }}
              label={tr(T.useSymbolic)}
            />
          </div>
        </div>
        <Output
          label="chmod"
          value={chmodCommand(m, path.value || "deploy.sh", {
            recursive: recursive.value,
            symbolic: symbolic.value,
          })}
        />
        <ul class="chmod-words small">
          {WHO.map((who) => {
            const can = PERMS.filter((p) => m & bit(who, p));
            return (
              <li key={who}>
                {tr(WHO_SHORT[who])}{" "}
                {can.length
                  ? `${tr(T.can)} ${list.format(can.map((p) => tr(PERM_VERB[p])))}`
                  : tr(T.noAccess)}
                .
              </li>
            );
          })}
        </ul>
        <p class="muted small">{tr(T.folderNote)}</p>
      </Panel>

      <Panel title={tr(T.presets)}>
        <div class="chmod-presets">
          {PRESETS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={p === m ? "primary" : "secondary"}
              onClick={() => {
                mode.value = p;
              }}
            >
              <span class="mono">{shortOctal(p)}</span>
              <span class="chmod-preset-label">{tr(PRESET_L[shortOctal(p)] ?? l("", "", ""))}</span>
            </Button>
          ))}
        </div>
      </Panel>
    </>
  );
}
