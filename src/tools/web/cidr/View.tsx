import type { Signal } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, Field, Output, Panel, Segmented, Stats } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { Badge, NumberField } from "../_ui";
import {
  type ParseError,
  parseCidr4,
  parseCidr6,
  powerLabel,
  split4,
  subnet4,
  subnet6,
  type V4Scope,
  type V6Scope,
} from "./logic";

type Version = "v4" | "v6";

const T = {
  v4: l("IPv4", "IPv4"),
  v6: l("IPv6", "IPv6"),
  address: l("Address / prefix", "Adresse / préfixe"),
  hint4: l(
    "192.168.1.10/24, 10.0.0.1 255.255.0.0, or a bare address",
    "192.168.1.10/24, 10.0.0.1 255.255.0.0, ou une adresse seule",
  ),
  hint6: l("2001:db8::1/64, or a bare address", "2001:db8::1/64, ou une adresse seule"),
  network: l("Network", "Réseau"),
  broadcast: l("Broadcast", "Diffusion (broadcast)"),
  netmask: l("Netmask", "Masque"),
  wildcard: l("Wildcard mask", "Masque inverse (wildcard)"),
  first: l("First host", "Premier hôte"),
  last: l("Last host", "Dernier hôte"),
  firstAddr: l("First address", "Première adresse"),
  lastAddr: l("Last address", "Dernière adresse"),
  total: l("Addresses", "Adresses"),
  hosts: l("Usable hosts", "Hôtes utilisables"),
  prefix: l("Prefix", "Préfixe"),
  ipClass: l("Class", "Classe"),
  binary: l("Binary", "Binaire"),
  integer: l("Integer", "Entier"),
  hostBits: l(
    "The address has host bits set: the network is {net}.",
    "L'adresse a des bits d'hôte : le réseau est {net}.",
  ),
  useNetwork: l("Use the network", "Prendre le réseau"),
  split: l("Split into subnets", "Découper en sous-réseaux"),
  count: l("Number of subnets", "Nombre de sous-réseaux"),
  splitResult: l(
    "{n} subnets of /{p}, {h} hosts each",
    "{n} sous-réseaux en /{p}, {h} hôtes chacun",
  ),
  splitTooMany: l(
    "Too many subnets for this block (at most /32).",
    "Trop de sous-réseaux pour ce bloc (au plus /32).",
  ),
  shown: l("First {n} shown.", "Les {n} premiers sont affichés."),
  copyList: l("Copy the list", "Copier la liste"),
  expanded: l("Expanded", "Développée"),
  compressed: l("Compressed", "Compressée"),
  range: l("Prefix range", "Plage du préfixe"),
  reverse: l("Reverse DNS", "DNS inverse"),
  type: l("Type", "Type"),
  subnet: l("Subnet", "Sous-réseau"),
  subnets64: l("/64 subnets", "Sous-réseaux /64"),
};

const ERRORS: Record<ParseError, L10n> = {
  empty: l("Type an address.", "Tape une adresse."),
  address: l("This is not a valid address.", "Ce n'est pas une adresse valide."),
  prefix: l("The prefix is not valid.", "Le préfixe n'est pas valide."),
  mask: l(
    "This netmask is not contiguous (ones then zeros).",
    "Ce masque n'est pas contigu (des 1 puis des 0).",
  ),
};

const SCOPE4: Record<V4Scope, L10n> = {
  "this-network": l("“This network” (0.0.0.0/8)", "« Ce réseau » (0.0.0.0/8)"),
  private: l("Private (RFC 1918)", "Privée (RFC 1918)"),
  shared: l("Carrier-grade NAT (RFC 6598)", "NAT opérateur (RFC 6598)"),
  loopback: l("Loopback", "Boucle locale"),
  "link-local": l("Link-local (APIPA)", "Lien local (APIPA)"),
  protocol: l("IETF protocol assignments", "Affectations de protocoles IETF"),
  documentation: l("Documentation (TEST-NET)", "Documentation (TEST-NET)"),
  benchmarking: l("Benchmarking (RFC 2544)", "Tests de performance (RFC 2544)"),
  multicast: l("Multicast", "Multidiffusion"),
  reserved: l("Reserved (future use)", "Réservée (usage futur)"),
  broadcast: l("Limited broadcast", "Diffusion limitée"),
  public: l("Public", "Publique"),
};

const SCOPE6: Record<V6Scope, L10n> = {
  unspecified: l("Unspecified (::)", "Non spécifiée (::)"),
  loopback: l("Loopback (::1)", "Boucle locale (::1)"),
  "ipv4-mapped": l("IPv4-mapped", "IPv4 mappée"),
  documentation: l("Documentation (2001:db8::/32)", "Documentation (2001:db8::/32)"),
  "6to4": l("6to4 (2002::/16)", "6to4 (2002::/16)"),
  teredo: l("Teredo (2001::/32)", "Teredo (2001::/32)"),
  "link-local": l("Link-local (fe80::/10)", "Lien local (fe80::/10)"),
  "unique-local": l("Unique local (fc00::/7)", "Locale unique (fc00::/7)"),
  multicast: l("Multicast (ff00::/8)", "Multidiffusion (ff00::/8)"),
  global: l("Global unicast (2000::/3)", "Unicast global (2000::/3)"),
  reserved: l("Reserved", "Réservée"),
};

function V4({
  text,
  onText,
  count,
}: {
  text: string;
  onText: (v: string) => void;
  count: Signal<number>;
}) {
  const p = parseCidr4(text);
  if (!p.ok) return text.trim() ? <p class="error-note">{tr(ERRORS[p.error])}</p> : null;
  const s = subnet4(p.ip, p.prefix);
  const sp = split4(p.ip, p.prefix, count.value);
  return (
    <>
      {s.hostBits && s.prefix < 32 && (
        <div class="row cidr-note">
          <span class="small">{tr(T.hostBits).replace("{net}", s.cidr)}</span>
          <Button size="sm" variant="ghost" onClick={() => onText(s.cidr)}>
            {tr(T.useNetwork)}
          </Button>
        </div>
      )}
      <div class="row">
        <Badge kind={s.scope === "public" ? "info" : "warn"}>{tr(SCOPE4[s.scope])}</Badge>
        {s.scopeRange && <span class="muted small mono">{s.scopeRange}</span>}
      </div>
      <Stats
        items={[
          { label: tr(T.prefix), value: `/${s.prefix}` },
          { label: tr(T.total), value: fmt(s.total) },
          { label: tr(T.hosts), value: fmt(s.hosts) },
          { label: tr(T.ipClass), value: s.ipClass },
        ]}
      />
      <div class="cidr-outputs">
        <Output label={tr(T.network)} value={s.cidr} />
        <Output label={tr(T.netmask)} value={s.netmask} />
        <Output label={tr(T.wildcard)} value={s.wildcard} />
        <Output label={tr(T.broadcast)} value={s.broadcast} />
        <Output label={tr(T.first)} value={s.first} />
        <Output label={tr(T.last)} value={s.last} />
        <Output label="Hex" value={s.hex} />
        <Output label={tr(T.integer)} value={String(s.integer)} />
      </div>
      <div class="cidr-outputs">
        <div class="cidr-wide">
          <Output label={tr(T.binary)} value={s.binary} />
        </div>
        <div class="cidr-wide">
          <Output label={`${tr(T.netmask)} (bin)`} value={s.binaryMask} />
        </div>
      </div>

      <Panel
        title={tr(T.split)}
        actions={
          sp.ok && (
            <CopyButton
              label={tr(T.copyList)}
              text={() => sp.subnets.map((x) => x.cidr).join("\n")}
            />
          )
        }
      >
        <div class="cidr-split-head">
          <NumberField
            label={tr(T.count)}
            value={count.value}
            min={1}
            max={2 ** 24}
            step={1}
            onChange={(v) => {
              count.value = Math.round(v);
            }}
          />
          {sp.ok ? (
            <p class="small">
              {tr(T.splitResult)
                .replace("{n}", fmt(sp.count))
                .replace("{p}", String(sp.prefix))
                .replace("{h}", fmt(sp.subnets[0]?.hosts ?? 0))}
              {sp.count > sp.subnets.length && (
                <span class="muted"> {tr(T.shown).replace("{n}", fmt(sp.subnets.length))}</span>
              )}
            </p>
          ) : (
            <p class="error small">{tr(T.splitTooMany)}</p>
          )}
        </div>
        {sp.ok && (
          <div class="table-wrap cidr-table">
            <table class="table">
              <thead>
                <tr>
                  <th class="num">#</th>
                  <th>{tr(T.subnet)}</th>
                  <th>{tr(T.first)}</th>
                  <th>{tr(T.last)}</th>
                  <th>{tr(T.broadcast)}</th>
                </tr>
              </thead>
              <tbody>
                {sp.subnets.map((x, i) => (
                  <tr key={x.cidr}>
                    <td class="num muted">{i + 1}</td>
                    <td class="mono">{x.cidr}</td>
                    <td class="mono">{x.first}</td>
                    <td class="mono">{x.last}</td>
                    <td class="mono">{x.broadcast}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

function V6({ text }: { text: string }) {
  const p = parseCidr6(text);
  if (!p.ok) return text.trim() ? <p class="error-note">{tr(ERRORS[p.error])}</p> : null;
  const s = subnet6(p.ip, p.prefix);
  return (
    <>
      <div class="row">
        <Badge kind={s.scope === "global" ? "info" : "warn"}>{tr(SCOPE6[s.scope])}</Badge>
      </div>
      <Stats
        items={[
          { label: tr(T.prefix), value: `/${s.prefix}` },
          { label: tr(T.total), value: powerLabel(s.total) },
          {
            label: tr(T.subnets64),
            value: s.prefix <= 64 ? powerLabel(1n << BigInt(64 - s.prefix)) : "—",
          },
        ]}
      />
      <div class="cidr-outputs cidr-outputs-wide">
        <Output label={tr(T.compressed)} value={s.compressed} />
        <Output label={tr(T.expanded)} value={s.expanded} />
        <Output label={tr(T.network)} value={s.network} />
        <Output label={tr(T.firstAddr)} value={s.first} />
        <Output label={tr(T.lastAddr)} value={s.last} />
        <Output label={tr(T.reverse)} value={s.reverse} />
      </div>
    </>
  );
}

export default function Cidr() {
  const version = useToolState<Version>("version", "v4");
  const text4 = useToolState("v4", "192.168.1.10/24");
  const text6 = useToolState("v6", "2001:db8:abcd:12::1/48");
  const count = useToolState("count", 4);
  const v4 = version.value === "v4";
  const text = v4 ? text4 : text6;

  return (
    <>
      <div class="row">
        <Segmented<Version>
          value={version.value}
          onChange={(v) => {
            version.value = v;
          }}
          options={[
            { value: "v4", label: tr(T.v4) },
            { value: "v6", label: tr(T.v6) },
          ]}
        />
      </div>
      <Field label={tr(T.address)} hint={tr(v4 ? T.hint4 : T.hint6)}>
        <input
          class="input mono cidr-input"
          value={text.value}
          spellcheck={false}
          autocomplete="off"
          placeholder={v4 ? "192.168.1.10/24" : "2001:db8::1/64"}
          onInput={(e) => {
            text.value = (e.currentTarget as HTMLInputElement).value;
          }}
        />
      </Field>
      {v4 ? (
        <V4
          text={text4.value}
          onText={(v) => {
            text4.value = v;
          }}
          count={count}
        />
      ) : (
        <V6 text={text6.value} />
      )}
    </>
  );
}
