import { useComputed } from "@preact/signals";
import { Badge } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { ErrorNote, Segmented, TextBox } from "../../../app/ui";
import { type L10n, l, tr } from "../../../i18n";
import {
  GENERATORS,
  type NoteCode,
  parseCurl,
  TARGETS,
  type Target,
  type WarningCode,
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

const ERR: Record<"quote" | "not-curl" | "no-url", L10n> = {
  quote: l(
    "A quote is not closed.",
    "Un guillemet n'est pas fermé.",
    "Ein Anführungszeichen ist nicht geschlossen.",
  ),
  "not-curl": l(
    "The command must start with curl.",
    "La commande doit commencer par curl.",
    "Der Befehl muss mit curl beginnen.",
  ),
  "no-url": l(
    "No URL found in the command.",
    "Aucune URL trouvée dans la commande.",
    "Keine URL im Befehl gefunden.",
  ),
};

const WARN: Record<WarningCode, L10n> = {
  "unknown-option": l(
    "Unknown option ignored: {d}",
    "Option inconnue ignorée : {d}",
    "Unbekannte Option ignoriert: {d}",
  ),
  "unsupported-option": l(
    "Option not converted: {d}",
    "Option non convertie : {d}",
    "Option nicht umgewandelt: {d}",
  ),
  "missing-arg": l(
    "Option without its value: {d}",
    "Option sans sa valeur : {d}",
    "Option ohne Wert: {d}",
  ),
  "file-data": l(
    "Reads the local file {d}: the code refers to it by path.",
    "Lit le fichier local {d} : le code y fait référence par son chemin.",
    "Liest die lokale Datei {d}: Der Code verweist über ihren Pfad darauf.",
  ),
  "multiple-urls": l(
    "Only the first URL is used; ignored: {d}",
    "Seule la première URL est utilisée ; ignorées : {d}",
    "Nur die erste URL wird verwendet; ignoriert: {d}",
  ),
  "no-scheme": l(
    "No scheme in the URL: http:// assumed, like curl.",
    "Pas de schéma dans l'URL : http:// supposé, comme curl.",
    "Kein Schema in der URL: http:// angenommen, wie bei curl.",
  ),
  "cookie-file": l(
    "-b {d} reads a cookie file: not converted.",
    "-b {d} lit un fichier de cookies : non converti.",
    "-b {d} liest eine Cookie-Datei: nicht umgewandelt.",
  ),
  "no-password": l(
    "-u without a password: curl would prompt for it; an empty one is used.",
    "-u sans mot de passe : curl le demanderait ; un mot de passe vide est utilisé.",
    "-u ohne Passwort: curl würde danach fragen; es wird ein leeres verwendet.",
  ),
};

const NOTE: Record<NoteCode, L10n> = {
  "insecure-unsupported": l(
    "fetch cannot skip certificate checks (-k); in Node, use NODE_TLS_REJECT_UNAUTHORIZED=0 only for testing.",
    "fetch ne peut pas ignorer la vérification des certificats (-k) ; en Node, NODE_TLS_REJECT_UNAUTHORIZED=0 seulement pour tester.",
    "fetch kann die Zertifikatsprüfung nicht abschalten (-k); in Node NODE_TLS_REJECT_UNAUTHORIZED=0 nur zum Testen verwenden.",
  ),
  "proxy-unsupported": l(
    "The proxy (-x) is not set: fetch has no proxy option.",
    "Le proxy (-x) n'est pas réglé : fetch n'a pas d'option de proxy.",
    "Der Proxy (-x) ist nicht gesetzt: fetch hat keine Proxy-Option.",
  ),
  "multipart-unsupported": l(
    "wget cannot send multipart forms (-F): the body is left out.",
    "wget ne sait pas envoyer de formulaires multipart (-F) : le corps est omis.",
    "wget kann keine Multipart-Formulare senden (-F): Der Body wird weggelassen.",
  ),
  "connect-timeout-unsupported": l(
    "--connect-timeout has no direct equivalent here and is left out.",
    "--connect-timeout n'a pas d'équivalent direct ici et est omis.",
    "--connect-timeout hat hier keine direkte Entsprechung und wird weggelassen.",
  ),
  "node-files": l(
    "Reading local files needs Node.js (node:fs).",
    "La lecture de fichiers locaux nécessite Node.js (node:fs).",
    "Lokale Dateien zu lesen erfordert Node.js (node:fs).",
  ),
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
    ...(p.ok ? p.request.warnings.map((w) => tr(WARN[w.code]).replace("{d}", w.detail ?? "")) : []),
    ...(output.value?.notes ?? []).map((n) => tr(NOTE[n])),
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
        note={!p.ok && p.error !== "empty" ? <ErrorNote error={tr(ERR[p.error])} /> : undefined}
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
