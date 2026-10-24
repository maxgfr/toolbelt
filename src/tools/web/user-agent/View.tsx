import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Panel, TextBox } from "../../../app/ui";
import { type L10n, l, tr } from "../../../i18n";
import { Badge } from "../_ui";
import { parseUA, SAMPLES } from "./logic";

const T = {
  ua: l("User agent", "User agent"),
  placeholder: l("Paste a user-agent string…", "Colle une chaîne user-agent…"),
  mine: l(
    "Empty: showing this browser's user agent.",
    "Vide : c'est le user agent de ce navigateur qui est analysé.",
  ),
  useMine: l("Use mine", "Utiliser le mien"),
  samples: l("Examples", "Exemples"),
  pick: l("Pick an example…", "Choisir un exemple…"),
  browser: l("Browser", "Navigateur"),
  engine: l("Engine", "Moteur"),
  os: l("Operating system", "Système d'exploitation"),
  device: l("Device", "Appareil"),
  cpu: l("CPU", "Processeur"),
  name: l("Name", "Nom"),
  version: l("Version", "Version"),
  major: l("Major version", "Version majeure"),
  kind: l("Type", "Type"),
  vendor: l("Vendor", "Fabricant"),
  model: l("Model", "Modèle"),
  arch: l("Architecture", "Architecture"),
  unknown: l("unknown", "inconnu"),
  desktop: l("desktop (probably)", "ordinateur (probablement)"),
  bot: l("Bot / automated client", "Robot / client automatisé"),
  aiBot: l("AI crawler or assistant", "Robot ou assistant d'IA"),
  human: l("Regular browser", "Navigateur classique"),
  frozen: l(
    "Reduced (frozen) user agent: Chrome now sends a fixed OS version and device model, so those may be inaccurate. Only Client Hints tell the real values.",
    "User agent réduit (figé) : Chrome envoie désormais une version d'OS et un modèle fixes, ils peuvent donc être faux. Seuls les Client Hints donnent les vraies valeurs.",
  ),
  here: l("This browser", "Ce navigateur"),
  languages: l("Languages", "Langues"),
  platform: l("Platform", "Plateforme"),
  screen: l("Screen", "Écran"),
  viewport: l("Window", "Fenêtre"),
  ratio: l("Pixel ratio", "Densité de pixels"),
  cores: l("Logical cores", "Cœurs logiques"),
  touch: l("Touch points", "Points tactiles"),
  timezone: l("Time zone", "Fuseau horaire"),
  cookies: l("Cookies", "Cookies"),
  yes: l("enabled", "activés"),
  no: l("disabled", "désactivés"),
};

const DEVICE_TYPES: Record<string, L10n> = {
  mobile: l("mobile phone", "téléphone mobile"),
  tablet: l("tablet", "tablette"),
  smarttv: l("smart TV", "télévision connectée"),
  console: l("game console", "console de jeu"),
  wearable: l("wearable", "objet connecté portable"),
  xr: l("XR headset", "casque XR"),
  embedded: l("embedded", "embarqué"),
};

const BROWSER_TYPES: Record<string, L10n> = {
  crawler: l("crawler", "robot d'indexation"),
  cli: l("command-line tool", "outil en ligne de commande"),
  email: l("email client", "client mail"),
  fetcher: l("fetcher", "récupérateur"),
  inapp: l("in-app browser", "navigateur intégré"),
  library: l("library", "bibliothèque"),
  mediaplayer: l("media player", "lecteur multimédia"),
};

function Rows({ rows }: { rows: [L10n, string][] }) {
  return (
    <dl class="user-agent-rows">
      {rows.map(([k, v]) => (
        <div key={k.en}>
          <dt>{tr(k)}</dt>
          <dd class={v ? "mono" : "muted"}>{v || tr(T.unknown)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ThisBrowser() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const rows: [L10n, string][] = [
    [T.languages, (nav.languages ?? [nav.language]).join(", ")],
    [T.platform, nav.platform ?? ""],
    [T.screen, `${screen.width} × ${screen.height}`],
    [T.viewport, `${window.innerWidth} × ${window.innerHeight}`],
    [T.ratio, String(window.devicePixelRatio)],
    [T.cores, nav.hardwareConcurrency ? String(nav.hardwareConcurrency) : ""],
    [T.touch, String(nav.maxTouchPoints ?? 0)],
    [T.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone],
    [T.cookies, tr(nav.cookieEnabled ? T.yes : T.no)],
  ];
  return (
    <Panel title={tr(T.here)}>
      <Rows rows={rows} />
    </Panel>
  );
}

export default function UserAgent() {
  const ua = useToolState("ua", "");
  const effective = useComputed(() => ua.value.trim() || navigator.userAgent);
  const r = useComputed(() => parseUA(effective.value)).value;
  const deviceType = r.device.type
    ? tr(DEVICE_TYPES[r.device.type] ?? l(r.device.type, r.device.type))
    : r.browser.name && !r.bot
      ? tr(T.desktop)
      : "";
  const browserType = r.browser.type
    ? tr(BROWSER_TYPES[r.browser.type] ?? l(r.browser.type, r.browser.type))
    : "";

  return (
    <>
      <TextBox
        label={tr(T.ua)}
        value={ua.value}
        onInput={(v) => {
          ua.value = v;
        }}
        placeholder={navigator.userAgent || tr(T.placeholder)}
        rows={3}
        files={false}
        note={!ua.value.trim() && <span class="muted">{tr(T.mine)}</span>}
        actions={
          ua.value.trim() && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                ua.value = "";
              }}
            >
              {tr(T.useMine)}
            </Button>
          )
        }
      />
      <div class="row">
        <select
          class="input user-agent-samples"
          aria-label={tr(T.samples)}
          value=""
          onChange={(e) => {
            const s = SAMPLES.find((x) => x.id === (e.currentTarget as HTMLSelectElement).value);
            if (s) ua.value = s.ua;
          }}
        >
          <option value="">{tr(T.pick)}</option>
          {SAMPLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <span class="spacer" />
        {r.bot ? <Badge kind="warn">{tr(T.bot)}</Badge> : <Badge kind="info">{tr(T.human)}</Badge>}
        {r.aiBot && <Badge kind="warn">{tr(T.aiBot)}</Badge>}
      </div>
      {r.frozen && <p class="user-agent-note small">{tr(T.frozen)}</p>}

      <div class="user-agent-grid">
        <Panel title={tr(T.browser)}>
          <Rows
            rows={[
              [T.name, r.browser.name],
              [T.version, r.browser.version],
              [T.major, r.browser.major],
              ...(browserType ? ([[T.kind, browserType]] as [L10n, string][]) : []),
            ]}
          />
        </Panel>
        <Panel title={tr(T.engine)}>
          <Rows
            rows={[
              [T.name, r.engine.name],
              [T.version, r.engine.version],
            ]}
          />
        </Panel>
        <Panel title={tr(T.os)}>
          <Rows
            rows={[
              [T.name, r.os.name],
              [T.version, r.os.version],
            ]}
          />
        </Panel>
        <Panel title={tr(T.device)}>
          <Rows
            rows={[
              [T.kind, deviceType],
              [T.vendor, r.device.vendor],
              [T.model, r.device.model],
            ]}
          />
        </Panel>
        <Panel title={tr(T.cpu)}>
          <Rows rows={[[T.arch, r.cpu.architecture]]} />
        </Panel>
      </div>
      {!ua.value.trim() && <ThisBrowser />}
    </>
  );
}
