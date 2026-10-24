import { useComputed } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";
import { NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, Field, Output, Panel, Stats, TextBox } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { exampleHost, parseUla, randomGlobalId, subnets, ulaInfo } from "./logic";

const T = {
  prefixIn: l("ULA prefix or Global ID", "Préfixe ULA ou Global ID"),
  prefixHint: l(
    "Generated at random, or paste yours (fd12:3456:789a::/48, 12:3456:789a) to list its subnets",
    "Généré au hasard, ou colle le tien (fd12:3456:789a::/48, 12:3456:789a) pour lister ses sous-réseaux",
  ),
  again: l("New random prefix", "Nouveau préfixe aléatoire"),
  prefix: l("Site prefix (/48)", "Préfixe du site (/48)"),
  globalId: l("Global ID (40 bits)", "Global ID (40 bits)"),
  first: l("First address", "Première adresse"),
  last: l("Last address", "Dernière adresse"),
  subnetCount: l("/64 subnets", "Sous-réseaux /64"),
  hostsPer: l("Addresses per /64", "Adresses par /64"),
  example: l("Example host in the first subnet", "Exemple d'hôte dans le premier sous-réseau"),
  subnets: l("/64 subnets", "Sous-réseaux /64"),
  start: l("Start at subnet ID", "Commencer au sous-réseau"),
  count: l("How many", "Combien"),
  startHint: l("0 to 65535 (shown in hex in the prefix)", "0 à 65535 (en hexa dans le préfixe)"),
  fc: l(
    "fc00::/8 (L bit = 0) is not defined by RFC 4193: use fd00::/8. The fd version is shown.",
    "fc00::/8 (bit L = 0) n'est pas défini par la RFC 4193 : utilise fd00::/8. La version fd est affichée.",
  ),
  about: l(
    "A ULA prefix is fd00::/8 followed by a random 40-bit Global ID, so two sites that merge are very unlikely to collide. ULAs are routable inside your networks but not on the Internet.",
    "Un préfixe ULA est fd00::/8 suivi d'un Global ID aléatoire de 40 bits : deux sites qui fusionnent ont très peu de risque de collision. Les ULA sont routables dans tes réseaux mais pas sur Internet.",
  ),
  random: l(
    "The Global ID comes from your browser's cryptographic random generator.",
    "Le Global ID vient du générateur aléatoire cryptographique de ton navigateur.",
  ),
};

const ERR: Record<"syntax" | "not-ula", L10n> = {
  syntax: l(
    "Not a Global ID (10 hex digits) or an IPv6 address.",
    "Ce n'est ni un Global ID (10 chiffres hexa) ni une adresse IPv6.",
  ),
  "not-ula": l(
    "This address is not a unique local address (fc00::/7).",
    "Cette adresse n'est pas une adresse locale unique (fc00::/7).",
  ),
};

const random = (a: Uint8Array) => {
  crypto.getRandomValues(a);
};

export default function Ipv6Ula() {
  const id = useToolState("id", "");
  const start = useToolState("start", 0);
  const count = useToolState("count", 16);
  const [problem, setProblem] = useState<L10n | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  // First visit: pick a random Global ID and keep it (so reloads and share links show it).
  useEffect(() => {
    if (!/^[0-9a-f]{10}$/.test(id.value)) id.value = randomGlobalId(random);
  }, []);
  const info = useComputed(() => (/^[0-9a-f]{10}$/.test(id.value) ? ulaInfo(id.value) : null));
  const list = useComputed(() =>
    /^[0-9a-f]{10}$/.test(id.value) ? subnets(id.value, start.value, count.value) : [],
  );
  const i = info.value;

  return (
    <>
      <Field label={tr(T.prefixIn)} hint={tr(T.prefixHint)}>
        <div class="row ipv6-ula-input">
          <input
            class="input mono"
            value={draft ?? i?.prefix ?? ""}
            aria-label={tr(T.prefixIn)}
            aria-invalid={problem !== null && problem !== T.fc}
            spellcheck={false}
            autocomplete="off"
            onInput={(e) => {
              const text = (e.currentTarget as HTMLInputElement).value;
              setDraft(text);
              const p = parseUla(text);
              if (!p.ok) {
                setProblem(p.error === "empty" ? null : ERR[p.error]);
                return;
              }
              setProblem(p.warning === "fc" ? T.fc : null);
              id.value = p.id;
              if (p.subnet !== null) start.value = p.subnet;
            }}
            onBlur={() => {
              setDraft(null);
              if (problem !== T.fc) setProblem(null);
            }}
          />
          <Button
            variant="primary"
            icon="refresh"
            onClick={() => {
              setProblem(null);
              setDraft(null);
              id.value = randomGlobalId(random);
              start.value = 0;
            }}
          >
            {tr(T.again)}
          </Button>
        </div>
      </Field>
      {problem && <p class="error-note">{tr(problem)}</p>}
      {i && (
        <>
          <p class="ipv6-ula-prefix mono">{i.prefix}</p>
          <Stats
            items={[
              { label: tr(T.subnetCount), value: fmt(65536) },
              { label: tr(T.hostsPer), value: "2⁶⁴" },
            ]}
          />
          <div class="ipv6-ula-outputs">
            <Output label={tr(T.prefix)} value={i.prefix} />
            <Output label={tr(T.globalId)} value={i.globalId} />
            <Output label={tr(T.first)} value={i.first} />
            <Output label={tr(T.last)} value={i.last} />
            <Output label={tr(T.example)} value={exampleHost(id.value, start.value)} />
          </div>
          <Panel title={tr(T.subnets)}>
            <div class="grid-2">
              <NumberField
                label={tr(T.start)}
                hint={tr(T.startHint)}
                value={start.value}
                min={0}
                max={65535}
                integer
                onChange={(v) => {
                  start.value = v;
                }}
              />
              <NumberField
                label={tr(T.count)}
                value={count.value}
                min={1}
                max={1024}
                integer
                onChange={(v) => {
                  count.value = v;
                }}
              />
            </div>
            <TextBox
              label={tr(T.subnets)}
              value={list.value.join("\n")}
              readOnly
              rows={10}
              downloadName="ula-subnets.txt"
            />
          </Panel>
          <p class="muted small">
            {tr(T.about)} {tr(T.random)}
          </p>
        </>
      )}
    </>
  );
}
