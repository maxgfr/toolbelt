import { useComputed } from "@preact/signals";
import { Badge } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Stats, TextBox, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { type Change, type Issue, processList, uniqueAddresses, WARNINGS } from "./logic";

const T = {
  input: l("Email addresses", "Adresses e-mail"),
  inputPh: l(
    "One per line, or separated by commas or semicolons.\nJohn.Doe+news@gmail.com\nJane <jane@example.com>",
    "Une par ligne, ou séparées par des virgules ou points-virgules.\nJean.Dupont+news@gmail.com\nJeanne <jeanne@exemple.fr>",
  ),
  output: l("Unique normalized addresses", "Adresses normalisées uniques"),
  lowercase: l("Lowercase the part before @", "Mettre en minuscules la partie avant @"),
  providers: l(
    "Provider rules (Gmail dots, +tags at Gmail, Outlook, Proton, Fastmail, iCloud…)",
    "Règles des fournisseurs (points Gmail, +tags chez Gmail, Outlook, Proton, Fastmail, iCloud…)",
  ),
  plusAll: l("Remove +tags on every domain", "Retirer les +tags sur tous les domaines"),
  punycode: l("Output domains in punycode (xn--)", "Domaines en punycode (xn--) en sortie"),
  total: l("Entries", "Entrées"),
  valid: l("Valid", "Valides"),
  invalid: l("Invalid", "Invalides"),
  dupes: l("Duplicates", "Doublons"),
  unique: l("Unique", "Uniques"),
  entry: l("Entry", "Entrée"),
  status: l("Status", "État"),
  normalized: l("Normalized", "Normalisée"),
  notes: l("Notes", "Remarques"),
  ok: l("valid", "valide"),
  warn: l("valid*", "valide*"),
  bad: l("invalid", "invalide"),
  dup: l("duplicate of #{n}", "doublon du n°{n}"),
  empty: l("Paste a list of email addresses.", "Colle une liste d'adresses e-mail."),
  caveat: l(
    "Syntax only: an address can be well formed and still not exist. Provider rules can merge addresses that a site would treat as different accounts.",
    "Syntaxe seulement : une adresse bien formée peut ne pas exister. Les règles des fournisseurs peuvent fusionner des adresses qu'un site traiterait comme des comptes différents.",
  ),
};

const ISSUE: Record<Issue, L10n> = {
  empty: l("empty", "vide"),
  "no-at": l("no @", "pas de @"),
  "local-empty": l("nothing before @", "rien avant @"),
  "local-long": l("more than 64 bytes before @", "plus de 64 octets avant @"),
  "local-chars": l("forbidden character before @", "caractère interdit avant @"),
  "local-dots": l(
    "dot at the start, end or doubled before @",
    "point au début, à la fin ou doublé avant @",
  ),
  quoted: l(
    "quoted local part (rarely accepted)",
    "partie locale entre guillemets (rarement acceptée)",
  ),
  "unicode-local": l(
    "non-ASCII before @ (needs SMTPUTF8)",
    "caractères non ASCII avant @ (nécessite SMTPUTF8)",
  ),
  "domain-empty": l("no domain", "pas de domaine"),
  "domain-chars": l("forbidden character in the domain", "caractère interdit dans le domaine"),
  "domain-long": l("domain longer than 253 characters", "domaine de plus de 253 caractères"),
  "label-long": l("domain label longer than 63", "étiquette de domaine de plus de 63"),
  "label-hyphen": l(
    "domain label starts or ends with -",
    "étiquette de domaine qui commence ou finit par -",
  ),
  "no-dot": l("domain without a dot", "domaine sans point"),
  tld: l("invalid top-level domain", "domaine de premier niveau invalide"),
  "ip-literal": l("IP address instead of a domain", "adresse IP au lieu d'un domaine"),
  "too-long": l("longer than 254 characters", "plus de 254 caractères"),
};

const CHANGE: Record<Change, L10n> = {
  lowercase: l("lowercased", "minuscules"),
  "gmail-dots": l("Gmail ignores dots", "Gmail ignore les points"),
  googlemail: l("googlemail.com = gmail.com", "googlemail.com = gmail.com"),
  "plus-tag": l("+tag removed", "+tag retiré"),
  "trailing-dot": l("trailing dot removed", "point final retiré"),
};

export default function EmailNormalize() {
  const input = useToolState("input", "");
  const lowercase = useToolState("lower", true);
  const providers = useToolState("providers", true);
  const plusAll = useToolState("plusAll", false);
  const punycode = useToolState("punycode", false);
  const rows = useComputed(() =>
    processList(input.value, {
      lowercase: lowercase.value,
      providers: providers.value,
      plusEverywhere: plusAll.value,
    }),
  );
  const unique = useComputed(() => uniqueAddresses(rows.value, punycode.value));
  const r = rows.value;
  const valid = r.filter((x) => x.validation.ok).length;
  const dupes = r.filter((x) => x.duplicateOf !== null).length;

  return (
    <>
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(T.inputPh)}
          rows={10}
        />
        <TextBox
          label={tr(T.output)}
          value={unique.value.join("\n")}
          readOnly
          rows={10}
          downloadName="emails.txt"
        />
      </div>
      <div class="stack email-normalize-options">
        <Toggle
          checked={lowercase.value}
          onChange={(v) => {
            lowercase.value = v;
          }}
          label={tr(T.lowercase)}
        />
        <Toggle
          checked={providers.value}
          onChange={(v) => {
            providers.value = v;
          }}
          label={tr(T.providers)}
        />
        <Toggle
          checked={plusAll.value}
          onChange={(v) => {
            plusAll.value = v;
          }}
          label={tr(T.plusAll)}
        />
        <Toggle
          checked={punycode.value}
          onChange={(v) => {
            punycode.value = v;
          }}
          label={tr(T.punycode)}
        />
      </div>
      {r.length === 0 ? (
        <p class="muted">{tr(T.empty)}</p>
      ) : (
        <>
          <Stats
            items={[
              { label: tr(T.total), value: fmt(r.length) },
              { label: tr(T.valid), value: fmt(valid) },
              { label: tr(T.invalid), value: fmt(r.length - valid) },
              { label: tr(T.dupes), value: fmt(dupes) },
              { label: tr(T.unique), value: fmt(unique.value.length) },
            ]}
          />
          <div class="table-wrap email-normalize-table">
            <table class="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{tr(T.entry)}</th>
                  <th>{tr(T.status)}</th>
                  <th>{tr(T.normalized)}</th>
                  <th>{tr(T.notes)}</th>
                </tr>
              </thead>
              <tbody>
                {r.map((row, i) => {
                  const warn = row.validation.issues.filter((x) => WARNINGS.has(x));
                  const notes = row.validation.ok
                    ? [...row.changes.map((c) => tr(CHANGE[c])), ...warn.map((x) => tr(ISSUE[x]))]
                    : row.validation.issues
                        .filter((x) => !WARNINGS.has(x))
                        .map((x) => tr(ISSUE[x]));
                  return (
                    <tr key={`${i}-${row.input}`}>
                      <td class="muted">{i + 1}</td>
                      <td class="mono small">{row.input}</td>
                      <td>
                        {!row.validation.ok ? (
                          <Badge kind="bad">{tr(T.bad)}</Badge>
                        ) : row.duplicateOf !== null ? (
                          <Badge kind="warn">
                            {tr(T.dup).replace("{n}", String(row.duplicateOf + 1))}
                          </Badge>
                        ) : warn.length ? (
                          <Badge kind="warn">{tr(T.warn)}</Badge>
                        ) : (
                          <Badge kind="ok">{tr(T.ok)}</Badge>
                        )}
                      </td>
                      <td class="mono small">
                        {punycode.value ? row.ascii : row.normalized}
                        {!punycode.value && row.ascii && row.ascii !== row.normalized && (
                          <div class="muted">{row.ascii}</div>
                        )}
                      </td>
                      <td class="small">{notes.join(" · ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p class="muted small">{tr(T.caveat)}</p>
    </>
  );
}
