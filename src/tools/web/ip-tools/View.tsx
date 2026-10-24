import { type Signal, useComputed } from "@preact/signals";
import { Badge, NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Field, Output, Panel, Segmented, Stats, TextBox } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { formatIPv4 } from "../cidr/logic";
import {
  checkMembership,
  type InputKind,
  listAddresses,
  notations,
  parseAddress,
  parseAnyIPv4,
  parseRange,
  type RangeProblem,
  rangeToCidrs,
} from "./logic";

type Tab = "convert" | "range" | "contains";

const T = {
  tabs: l("Tool", "Outil", "Werkzeug"),
  convert: l("Convert", "Convertir", "Umrechnen"),
  range: l("Range ↔ CIDR", "Plage ↔ CIDR", "Bereich ↔ CIDR"),
  contains: l("Is it in…?", "Est-elle dans… ?", "Ist sie in …?"),
  address: l("IPv4 address", "Adresse IPv4", "IPv4-Adresse"),
  addressHint: l(
    "Any notation: 192.168.1.1, 3232235777, 0xC0A80101, binary, 0300.0250.1.1, ::ffff:192.168.1.1",
    "Toute notation : 192.168.1.1, 3232235777, 0xC0A80101, binaire, 0300.0250.1.1, ::ffff:192.168.1.1",
    "Beliebige Schreibweise: 192.168.1.1, 3232235777, 0xC0A80101, binär, 0300.0250.1.1, ::ffff:192.168.1.1",
  ),
  read: l("Read as", "Lue comme", "Gelesen als"),
  badAddress: l(
    "This is not an IPv4 address in a known notation.",
    "Ce n'est pas une adresse IPv4 dans une notation connue.",
    "Das ist keine IPv4-Adresse in einer bekannten Schreibweise.",
  ),
  dotted: l("Dotted decimal", "Décimale pointée", "Dezimal mit Punkten"),
  decimal: l("Integer", "Entier", "Ganzzahl"),
  hex: l("Hexadecimal", "Hexadécimal", "Hexadezimal"),
  hexDotted: l("Dotted hex", "Hexadécimal pointé", "Hexadezimal mit Punkten"),
  binary: l("Binary", "Binaire", "Binär"),
  octal: l("Octal", "Octal", "Oktal"),
  octalDotted: l("Dotted octal", "Octal pointé", "Oktal mit Punkten"),
  mapped: l("IPv4-mapped IPv6", "IPv6 mappée IPv4", "IPv4-gemappte IPv6"),
  mappedHex: l("IPv4-mapped IPv6 (hex)", "IPv6 mappée IPv4 (hex)", "IPv4-gemappte IPv6 (hex)"),
  mappedFull: l(
    "IPv4-mapped IPv6 (expanded)",
    "IPv6 mappée IPv4 (développée)",
    "IPv4-gemappte IPv6 (ausgeschrieben)",
  ),
  sixToFour: l("6to4 prefix", "Préfixe 6to4", "6to4-Präfix"),
  reverse: l("Reverse DNS", "DNS inverse", "Reverse DNS"),
  rangeLabel: l("Range or block", "Plage ou bloc", "Bereich oder Block"),
  rangeHint: l(
    "10.0.0.5 - 10.0.0.20, 10.0.0.0/24, or one address",
    "10.0.0.5 - 10.0.0.20, 10.0.0.0/24, ou une adresse",
    "10.0.0.5 - 10.0.0.20, 10.0.0.0/24 oder eine Adresse",
  ),
  first: l("First", "Première", "Erste"),
  last: l("Last", "Dernière", "Letzte"),
  total: l("Addresses", "Adresses", "Adressen"),
  blocks: l("CIDR blocks", "Blocs CIDR", "CIDR-Blöcke"),
  cidrList: l("Smallest CIDR list", "Liste CIDR minimale", "Kleinste CIDR-Liste"),
  addresses: l("Addresses", "Adresses", "Adressen"),
  cap: l("Show at most", "Afficher au plus", "Höchstens anzeigen"),
  truncated: l(
    "Showing {n} of {t} addresses.",
    "Affichage de {n} adresses sur {t}.",
    "{n} von {t} Adressen werden angezeigt.",
  ),
  checkAddress: l("Address (IPv4 or IPv6)", "Adresse (IPv4 ou IPv6)", "Adresse (IPv4 oder IPv6)"),
  checkBlocks: l(
    "CIDR blocks, one per line",
    "Blocs CIDR, un par ligne",
    "CIDR-Blöcke, einer pro Zeile",
  ),
  checkPh: l(
    "10.0.0.0/8\n192.168.0.0/16\n2001:db8::/32  # comments allowed",
    "10.0.0.0/8\n192.168.0.0/16\n2001:db8::/32  # commentaires permis",
    "10.0.0.0/8\n192.168.0.0/16\n2001:db8::/32  # Kommentare erlaubt",
  ),
  badCheck: l(
    "This is not an IPv4 or IPv6 address.",
    "Ce n'est pas une adresse IPv4 ou IPv6.",
    "Das ist keine IPv4- oder IPv6-Adresse.",
  ),
  block: l("Block", "Bloc", "Block"),
  result: l("Result", "Résultat", "Ergebnis"),
  inside: l("contains it", "la contient", "enthält sie"),
  outside: l("not in it", "pas dedans", "nicht enthalten"),
  otherVersion: l("other IP version", "autre version d'IP", "andere IP-Version"),
  invalid: l("not a CIDR block", "pas un bloc CIDR", "kein CIDR-Block"),
  pending: l("—", "—", "—"),
  summary: l("In {n} of {t} blocks", "Dans {n} bloc(s) sur {t}", "In {n} von {t} Blöcken"),
  noBlocks: l(
    "Add CIDR blocks to check against.",
    "Ajoute des blocs CIDR à vérifier.",
    "Füge CIDR-Blöcke zum Prüfen hinzu.",
  ),
};

const KIND: Record<InputKind, L10n> = {
  dotted: T.dotted,
  decimal: T.decimal,
  hex: T.hex,
  binary: T.binary,
  octal: T.octalDotted,
  mapped: T.mapped,
};

const RANGE_ERR: Record<RangeProblem, L10n> = {
  empty: l(
    "Type a range or a CIDR block.",
    "Tape une plage ou un bloc CIDR.",
    "Gib einen Bereich oder einen CIDR-Block ein.",
  ),
  start: l(
    "The first address is not valid.",
    "La première adresse n'est pas valide.",
    "Die erste Adresse ist ungültig.",
  ),
  end: l(
    "The last address is not valid.",
    "La dernière adresse n'est pas valide.",
    "Die letzte Adresse ist ungültig.",
  ),
  order: l(
    "The last address comes before the first.",
    "La dernière adresse est avant la première.",
    "Die letzte Adresse liegt vor der ersten.",
  ),
  syntax: l(
    "Write “first - last” or “address/prefix” (prefix 0 to 32).",
    "Écris « première - dernière » ou « adresse/préfixe » (préfixe de 0 à 32).",
    "Schreib „erste - letzte“ oder „Adresse/Präfix“ (Präfix 0 bis 32).",
  ),
};

function Convert({ text }: { text: Signal<string> }) {
  const parsed = useComputed(() => parseAnyIPv4(text.value));
  const p = parsed.value;
  const n = p ? notations(p.ip) : null;
  const rows: [L10n, keyof NonNullable<typeof n>][] = [
    [T.dotted, "dotted"],
    [T.decimal, "decimal"],
    [T.hex, "hex"],
    [T.hexDotted, "hexDotted"],
    [T.binary, "binary"],
    [T.octal, "octal"],
    [T.octalDotted, "octalDotted"],
    [T.mapped, "mapped"],
    [T.mappedHex, "mappedHex"],
    [T.mappedFull, "mappedFull"],
    [T.sixToFour, "sixToFour"],
    [T.reverse, "reverse"],
  ];
  return (
    <>
      <Field label={tr(T.address)} hint={tr(T.addressHint)}>
        <input
          class="input mono ip-tools-input"
          value={text.value}
          spellcheck={false}
          autocomplete="off"
          aria-invalid={!p && text.value.trim() !== ""}
          onInput={(e) => {
            text.value = (e.currentTarget as HTMLInputElement).value;
          }}
        />
      </Field>
      {!p && text.value.trim() !== "" && <p class="error-note">{tr(T.badAddress)}</p>}
      {p && n && (
        <>
          <div class="row">
            <span class="muted small">{tr(T.read)}</span>
            <Badge kind="info">{tr(KIND[p.kind])}</Badge>
          </div>
          <div class="ip-tools-outputs">
            {rows.map(([label, key]) => (
              <Output key={key} label={tr(label)} value={n[key]} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Range({ text, cap }: { text: Signal<string>; cap: Signal<number> }) {
  const parsed = useComputed(() => parseRange(text.value));
  const p = parsed.value;
  const cidrs = useComputed(() => {
    const r = parsed.value;
    return r.ok ? rangeToCidrs(r.start, r.end) : [];
  });
  const list = useComputed(() => {
    const r = parsed.value;
    return r.ok ? listAddresses(r.start, r.end, cap.value) : null;
  });
  return (
    <>
      <Field label={tr(T.rangeLabel)} hint={tr(T.rangeHint)}>
        <input
          class="input mono ip-tools-input"
          value={text.value}
          spellcheck={false}
          autocomplete="off"
          aria-invalid={!p.ok && p.error !== "empty"}
          onInput={(e) => {
            text.value = (e.currentTarget as HTMLInputElement).value;
          }}
        />
      </Field>
      {!p.ok && (
        <p class={p.error === "empty" ? "muted" : "error-note"}>{tr(RANGE_ERR[p.error])}</p>
      )}
      {p.ok && list.value && (
        <>
          <Stats
            items={[
              { label: tr(T.first), value: formatIPv4(p.start) },
              { label: tr(T.last), value: formatIPv4(p.end) },
              { label: tr(T.total), value: fmt(list.value.total) },
              { label: tr(T.blocks), value: fmt(cidrs.value.length) },
            ]}
          />
          <div class="grid-2">
            <TextBox
              label={tr(T.cidrList)}
              value={cidrs.value.join("\n")}
              readOnly
              rows={12}
              downloadName="cidrs.txt"
            />
            <div class="stack">
              <TextBox
                label={tr(T.addresses)}
                value={list.value.addresses.join("\n")}
                readOnly
                rows={9}
                downloadName="addresses.txt"
                note={
                  list.value.truncated
                    ? tr(T.truncated)
                        .replace("{n}", fmt(list.value.addresses.length))
                        .replace("{t}", fmt(list.value.total))
                    : undefined
                }
              />
              <NumberField
                label={tr(T.cap)}
                value={cap.value}
                min={1}
                max={65536}
                integer
                onChange={(v) => {
                  cap.value = v;
                }}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Contains({ address, blocks }: { address: Signal<string>; blocks: Signal<string> }) {
  const results = useComputed(() => checkMembership(address.value, blocks.value));
  const valid = parseAddress(address.value) !== null;
  const inCount = results.value.filter((r) => r.status === "in").length;
  const checkable = results.value.filter((r) => r.status === "in" || r.status === "out").length;
  return (
    <>
      <Field label={tr(T.checkAddress)}>
        <input
          class="input mono ip-tools-input"
          value={address.value}
          spellcheck={false}
          autocomplete="off"
          aria-invalid={!valid && address.value.trim() !== ""}
          onInput={(e) => {
            address.value = (e.currentTarget as HTMLInputElement).value;
          }}
        />
      </Field>
      {!valid && address.value.trim() !== "" && <p class="error-note">{tr(T.badCheck)}</p>}
      <div class="grid-2">
        <TextBox
          label={tr(T.checkBlocks)}
          value={blocks.value}
          onInput={(v) => {
            blocks.value = v;
          }}
          placeholder={tr(T.checkPh)}
          rows={12}
        />
        <Panel
          title={
            valid && checkable
              ? tr(T.summary).replace("{n}", fmt(inCount)).replace("{t}", fmt(checkable))
              : tr(T.result)
          }
        >
          {results.value.length === 0 ? (
            <p class="muted">{tr(T.noBlocks)}</p>
          ) : (
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>{tr(T.block)}</th>
                    <th>{tr(T.result)}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.value.map((r, i) => (
                    <tr key={`${i}-${r.line}`}>
                      <td class="mono">{r.status === "invalid" ? r.line : r.block}</td>
                      <td>
                        {r.status === "in" && <Badge kind="ok">{tr(T.inside)}</Badge>}
                        {r.status === "out" && <Badge kind="info">{tr(T.outside)}</Badge>}
                        {r.status === "other-version" && (
                          <span class="muted small">{tr(T.otherVersion)}</span>
                        )}
                        {r.status === "invalid" && <Badge kind="bad">{tr(T.invalid)}</Badge>}
                        {r.status === "pending" && <span class="muted">{tr(T.pending)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function IpTools() {
  const tab = useToolState<Tab>("tab", "convert");
  const addr = useToolState("addr", "192.168.1.1");
  const range = useToolState("range", "10.0.0.5 - 10.0.0.20");
  const cap = useToolState("cap", 256);
  const check = useToolState("check", "10.1.2.3");
  const blocks = useToolState(
    "blocks",
    "10.0.0.0/8\n172.16.0.0/12\n192.168.0.0/16\n100.64.0.0/10\n2001:db8::/32",
  );
  return (
    <>
      <div class="row">
        <Segmented<Tab>
          label={tr(T.tabs)}
          value={tab.value}
          options={[
            { value: "convert", label: tr(T.convert) },
            { value: "range", label: tr(T.range) },
            { value: "contains", label: tr(T.contains) },
          ]}
          onChange={(v) => {
            tab.value = v;
          }}
        />
      </div>
      {tab.value === "convert" && <Convert text={addr} />}
      {tab.value === "range" && <Range text={range} cap={cap} />}
      {tab.value === "contains" && <Contains address={check} blocks={blocks} />}
    </>
  );
}
