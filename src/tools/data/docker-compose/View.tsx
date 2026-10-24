import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, TextBox } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { toCompose, type Warning, type WarningCode } from "./logic";

const SAMPLE = `docker run -d --name db --restart unless-stopped \\
  -e POSTGRES_PASSWORD=secret -v pgdata:/var/lib/postgresql/data \\
  -p 5432:5432 postgres:16

docker run -d --name web -p 8080:80 --env-file .env \\
  -v ./site:/usr/share/nginx/html:ro --link db nginx:alpine`;

const T = {
  input: l("docker run commands", "Commandes docker run", "docker-run-Befehle"),
  placeholder: l(
    "Paste one or more docker run commands (one per line, \\ continuations allowed)…",
    "Colle une ou plusieurs commandes docker run (une par ligne, continuations \\ acceptées)…",
    "Füge einen oder mehrere docker-run-Befehle ein (einer pro Zeile, Fortsetzungen mit \\ erlaubt)…",
  ),
  output: l("docker-compose.yml", "docker-compose.yml", "docker-compose.yml"),
  sample: l("Load sample", "Charger l'exemple", "Beispiel laden"),
  quote: l(
    "Unclosed quote on line {line}.",
    "Guillemet non fermé à la ligne {line}.",
    "Anführungszeichen in Zeile {line} nicht geschlossen.",
  ),
  services: l("{n} services", "{n} services", "{n} Services"),
  oneService: l("1 service", "1 service", "1 Service"),
  rmNote: l(
    '--rm: compose keeps stopped containers; for one-off runs use "docker compose run --rm SERVICE".',
    '--rm : compose garde les conteneurs arrêtés ; pour une exécution ponctuelle, utilise "docker compose run --rm SERVICE".',
    '--rm: Compose behält gestoppte Container; für einmalige Läufe nutze "docker compose run --rm SERVICE".',
  ),
  hint: l(
    "Named volumes are declared at the end; custom networks are marked external (create them with docker network create, or remove the line).",
    "Les volumes nommés sont déclarés à la fin ; les réseaux personnalisés sont marqués external (crée-les avec docker network create, ou retire la ligne).",
    "Benannte Volumes werden am Ende deklariert; eigene Netzwerke sind als external markiert (lege sie mit docker network create an oder entferne die Zeile).",
  ),
  w: {
    unsupported: l(
      "{service}: {subject} has no compose equivalent and was left out.",
      "{service} : {subject} n'a pas d'équivalent compose et a été ignoré.",
      "{service}: {subject} hat keine Compose-Entsprechung und wurde weggelassen.",
    ),
    publishAll: l(
      "{service}: -P publishes every exposed port on random host ports; list them with -p instead.",
      "{service} : -P publie tous les ports exposés sur des ports aléatoires ; liste-les plutôt avec -p.",
      "{service}: -P veröffentlicht alle freigegebenen Ports auf zufälligen Host-Ports; liste sie stattdessen mit -p auf.",
    ),
    notRun: l(
      "Skipped, not a docker run command: {subject}",
      "Ignorée, ce n'est pas une commande docker run : {subject}",
      "Übersprungen, kein docker-run-Befehl: {subject}",
    ),
    noImage: l(
      "No image in: {subject}",
      "Aucune image dans : {subject}",
      "Kein Image in: {subject}",
    ),
  } satisfies Record<WarningCode, unknown>,
};

function warningText(w: Warning): string {
  return tr(T.w[w.code])
    .replace("{service}", w.service ?? "")
    .replace("{subject}", w.subject);
}

export default function DockerCompose() {
  const input = useToolState("input", "");
  const result = useComputed(() =>
    input.value.trim() ? toCompose(input.value, { rmNote: tr(T.rmNote) }) : null,
  );
  const r = result.value;

  return (
    <>
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(T.placeholder)}
          accept=".sh,.txt,.ps1,.bat,.cmd,text/plain"
          rows={20}
          wrap={false}
          invalid={!!r && !r.ok}
          note={
            r && !r.ok ? (
              <span class="error">{tr(T.quote).replace("{line}", fmt(r.line))}</span>
            ) : r?.ok && r.services.length ? (
              <span class="success">
                ✓{" "}
                {r.services.length === 1
                  ? tr(T.oneService)
                  : tr(T.services).replace("{n}", fmt(r.services.length))}
              </span>
            ) : null
          }
          actions={
            <Button
              size="sm"
              variant="ghost"
              icon="file"
              onClick={() => {
                input.value = SAMPLE;
              }}
            >
              {tr(T.sample)}
            </Button>
          }
        />
        <TextBox
          label={tr(T.output)}
          value={r?.ok ? r.yaml : ""}
          readOnly
          rows={20}
          wrap={false}
          downloadName="docker-compose.yml"
          note={<span class="muted">{tr(T.hint)}</span>}
        />
      </div>
      {r?.ok && r.warnings.length > 0 && (
        <ul class="docker-compose-warnings">
          {r.warnings.map((w, i) => (
            <li key={i} class="data-warn">
              {warningText(w)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
