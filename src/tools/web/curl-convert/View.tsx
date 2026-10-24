import { useComputed } from "@preact/signals";
import { Badge } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { ErrorNote, Segmented, TextBox } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import {
  GENERATORS,
  NOTE_MESSAGES,
  PARSE_ERRORS,
  parseCurl,
  TARGETS,
  type Target,
  warningMessage,
} from "./logic";

const T = {
  input: l("curl command", "Commande curl", "curl-Befehl"),
  inputPh: l(
    "Paste a curl command, e.g. from “Copy as cURL” in the browser's Network tab.",
    "Colle une commande curl, par ex. depuis « Copier en tant que cURL » dans l'onglet Réseau du navigateur.",
    "Füge einen curl-Befehl ein, z. B. über „Als cURL kopieren“ im Netzwerk-Tab des Browsers.",
  ),
  target: l("Language", "Langage", "Sprache"),
  output: l("Code", "Code", "Code"),
  warnings: l("Warnings", "Avertissements", "Warnungen"),
  offline: l(
    "Only code is generated: no request is sent from this page.",
    "Seul du code est généré : aucune requête n'est envoyée depuis cette page.",
    "Es wird nur Code erzeugt: Von dieser Seite wird keine Anfrage gesendet.",
  ),
};

const LABEL: Record<Target, string> = {
  fetch: "fetch (JS)",
  axios: "axios",
  python: "Python requests",
  go: "Go net/http",
  php: "PHP cURL",
  wget: "wget",
  httpie: "HTTPie",
};

const FILE: Record<Target, string> = {
  fetch: "request.mjs",
  axios: "request.mjs",
  python: "request.py",
  go: "main.go",
  php: "request.php",
  wget: "request.sh",
  httpie: "request.sh",
};

const EXAMPLE = `curl -X POST 'https://api.example.com/v1/items' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer TOKEN' \\
  -d '{"name": "Widget", "price": 9.5, "tags": ["new"]}' \\
  --compressed -L -m 10`;

export default function CurlConvert() {
  const input = useToolState("cmd", EXAMPLE);
  const target = useToolState<Target>("target", "fetch");
  const parsed = useComputed(() => parseCurl(input.value));
  const output = useComputed(() => {
    const p = parsed.value;
    if (!p.ok) return null;
    try {
      return GENERATORS[target.value](p.request);
    } catch {
      return null;
    }
  });
  const p = parsed.value;
  const warnings = [
    ...(p.ok ? p.request.warnings.map((w) => tr(warningMessage(w))) : []),
    ...(output.value?.notes ?? []).map((n) => tr(NOTE_MESSAGES[n])),
  ];

  return (
    <>
      <TextBox
        label={tr(T.input)}
        value={input.value}
        onInput={(v) => {
          input.value = v;
        }}
        placeholder={tr(T.inputPh)}
        rows={7}
        invalid={!p.ok && p.error !== "empty"}
        note={
          !p.ok && p.error !== "empty" ? <ErrorNote error={tr(PARSE_ERRORS[p.error])} /> : undefined
        }
      />
      <div class="row">
        <Segmented<Target>
          label={tr(T.target)}
          value={target.value}
          options={TARGETS.map((t) => ({ value: t, label: LABEL[t] }))}
          onChange={(v) => {
            target.value = v;
          }}
        />
      </div>
      {warnings.length > 0 && (
        <ul class="curl-convert-warnings">
          {warnings.map((w, i) => (
            <li key={`${i}-${w}`}>
              <Badge kind="warn">!</Badge>
              <span class="small">{w}</span>
            </li>
          ))}
        </ul>
      )}
      <TextBox
        label={`${tr(T.output)} · ${LABEL[target.value]}`}
        value={output.value?.code ?? ""}
        readOnly
        rows={18}
        wrap={false}
        downloadName={FILE[target.value]}
      />
      <p class="muted small">{tr(T.offline)}</p>
    </>
  );
}
