import { useComputed, useSignal } from "@preact/signals";
import { Badge, NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, ErrorNote, Field, Segmented, TextBox, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { formatMac, type MacFormat, macInfo, parseMacList, parsePrefix, randomMacs } from "./logic";

type Tab = "generate" | "parse";

const T = {
  tabs: l("Mode", "Mode"),
  generate: l("Generate", "Générer"),
  parse: l("Parse & normalize", "Analyser et normaliser"),
  count: l("How many", "Combien"),
  prefix: l("Prefix (optional)", "Préfixe (facultatif)"),
  prefixHint: l(
    "1 to 5 bytes kept as is, e.g. an OUI 00:1A:2B",
    "1 à 5 octets gardés tels quels, par ex. un OUI 00:1A:2B",
  ),
  badPrefix: l(
    "The prefix must be 1 to 5 bytes in hex (e.g. 02:00 or 001A2B).",
    "Le préfixe doit faire 1 à 5 octets en hexa (par ex. 02:00 ou 001A2B).",
  ),
  local: l("Locally administered (U/L bit set)", "Administrée localement (bit U/L à 1)"),
  cast: l("Address type", "Type d'adresse"),
  unicast: l("Unicast", "Unicast"),
  multicast: l("Multicast", "Multicast"),
  bitsIgnored: l(
    "With a prefix, the U/L and I/G bits come from the prefix's first byte.",
    "Avec un préfixe, les bits U/L et I/G viennent du premier octet du préfixe.",
  ),
  format: l("Format", "Format"),
  upper: l("Uppercase", "Majuscules"),
  again: l("Generate again", "Regénérer"),
  output: l("MAC addresses", "Adresses MAC"),
  input: l("MAC addresses, one per line", "Adresses MAC, une par ligne"),
  inputPh: l(
    "00:1a:2b:3c:4d:5e\n02-00-5E-10-00-01\n001a.2b3c.4d5e",
    "00:1a:2b:3c:4d:5e\n02-00-5E-10-00-01\n001a.2b3c.4d5e",
  ),
  normalized: l("Normalized", "Normalisées"),
  address: l("Address", "Adresse"),
  ig: l("I/G (bit 0)", "I/G (bit 0)"),
  ul: l("U/L (bit 1)", "U/L (bit 1)"),
  oui: l("OUI / prefix", "OUI / préfixe"),
  linkLocal: l("IPv6 link-local (EUI-64)", "IPv6 lien local (EUI-64)"),
  individual: l("individual", "individuelle"),
  group: l("group", "groupe"),
  universal: l("universal", "universelle"),
  localShort: l("local", "locale"),
  broadcast: l("broadcast", "diffusion"),
  invalid: l("not a MAC address", "pas une adresse MAC"),
  empty: l("Paste one or more MAC addresses.", "Colle une ou plusieurs adresses MAC."),
  valid: l("{n} valid of {t}", "{n} valide(s) sur {t}"),
};

const FORMATS: { value: MacFormat; label: string }[] = [
  { value: "colon", label: "00:1a:2b:3c:4d:5e" },
  { value: "dash", label: "00-1a-2b-3c-4d-5e" },
  { value: "dot", label: "001a.2b3c.4d5e" },
  { value: "none", label: "001a2b3c4d5e" },
];

const LEGEND: [string, L10n][] = [
  [
    "I/G",
    l(
      "Individual/Group: 0 = unicast (one interface), 1 = multicast or broadcast.",
      "Individuelle/Groupe : 0 = unicast (une interface), 1 = multicast ou diffusion.",
    ),
  ],
  [
    "U/L",
    l(
      "Universal/Local: 0 = assigned by the maker (OUI), 1 = set locally (VMs, random MACs).",
      "Universelle/Locale : 0 = attribuée par le fabricant (OUI), 1 = définie localement (VM, MAC aléatoires).",
    ),
  ],
];

const random = (a: Uint8Array) => {
  crypto.getRandomValues(a);
};

export default function MacAddress() {
  const tab = useToolState<Tab>("tab", "generate");
  const count = useToolState("count", 5);
  const prefix = useToolState("prefix", "");
  const local = useToolState("local", true);
  const unicast = useToolState("unicast", true);
  const format = useToolState<MacFormat>("format", "colon");
  const upper = useToolState("upper", false);
  const input = useToolState("input", "");
  const nonce = useSignal(0);

  const prefixBytes = useComputed(() => parsePrefix(prefix.value));
  const generated = useComputed(() => {
    nonce.value;
    const p = prefixBytes.value;
    if (p === null) return "";
    return randomMacs(
      count.value,
      { prefix: p, local: local.value, unicast: unicast.value },
      random,
    )
      .map((m) => formatMac(m, format.value, upper.value))
      .join("\n");
  });
  const parsed = useComputed(() => parseMacList(input.value));
  const validCount = parsed.value.filter((p) => p.bytes).length;
  const normalized = parsed.value
    .map((p) => (p.bytes ? formatMac(p.bytes, format.value, upper.value) : ""))
    .filter(Boolean)
    .join("\n");

  const formatControls = (
    <div class="grid-2">
      <Select<MacFormat>
        label={tr(T.format)}
        value={format.value}
        options={FORMATS}
        onChange={(v) => {
          format.value = v;
        }}
      />
      <div class="mac-address-end">
        <Toggle
          checked={upper.value}
          onChange={(v) => {
            upper.value = v;
          }}
          label={tr(T.upper)}
        />
      </div>
    </div>
  );

  return (
    <>
      <div class="row">
        <Segmented<Tab>
          label={tr(T.tabs)}
          value={tab.value}
          options={[
            { value: "generate", label: tr(T.generate) },
            { value: "parse", label: tr(T.parse) },
          ]}
          onChange={(v) => {
            tab.value = v;
          }}
        />
      </div>
      {tab.value === "generate" && (
        <div class="grid-2">
          <div class="stack">
            <div class="grid-2">
              <NumberField
                label={tr(T.count)}
                value={count.value}
                min={1}
                max={1000}
                integer
                onChange={(v) => {
                  count.value = v;
                }}
              />
              <Field label={tr(T.prefix)} hint={tr(T.prefixHint)}>
                <input
                  class="input mono"
                  value={prefix.value}
                  placeholder="02:00:5e"
                  spellcheck={false}
                  autocomplete="off"
                  aria-invalid={prefixBytes.value === null}
                  onInput={(e) => {
                    prefix.value = (e.currentTarget as HTMLInputElement).value;
                  }}
                />
              </Field>
            </div>
            {prefixBytes.value === null && <ErrorNote error={tr(T.badPrefix)} />}
            {prefixBytes.value?.length ? (
              <p class="muted small">{tr(T.bitsIgnored)}</p>
            ) : (
              <>
                <Toggle
                  checked={local.value}
                  onChange={(v) => {
                    local.value = v;
                  }}
                  label={tr(T.local)}
                />
                <div class="row">
                  <Segmented<"u" | "m">
                    label={tr(T.cast)}
                    value={unicast.value ? "u" : "m"}
                    options={[
                      { value: "u", label: tr(T.unicast) },
                      { value: "m", label: tr(T.multicast) },
                    ]}
                    onChange={(v) => {
                      unicast.value = v === "u";
                    }}
                  />
                </div>
              </>
            )}
            {formatControls}
            <div class="row">
              <Button
                variant="primary"
                icon="refresh"
                onClick={() => {
                  nonce.value++;
                }}
              >
                {tr(T.again)}
              </Button>
            </div>
            <dl class="mac-address-legend small">
              {LEGEND.map(([k, v]) => (
                <div key={k}>
                  <dt class="mono">{k}</dt>
                  <dd class="muted">{tr(v)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <TextBox
            label={tr(T.output)}
            value={generated.value}
            readOnly
            rows={14}
            downloadName="mac-addresses.txt"
          />
        </div>
      )}
      {tab.value === "parse" && (
        <>
          <div class="grid-2">
            <TextBox
              label={tr(T.input)}
              value={input.value}
              onInput={(v) => {
                input.value = v;
              }}
              placeholder={tr(T.inputPh)}
              rows={8}
            />
            <div class="stack">
              <TextBox label={tr(T.normalized)} value={normalized} readOnly rows={5} />
              {formatControls}
            </div>
          </div>
          {parsed.value.length === 0 ? (
            <p class="muted">{tr(T.empty)}</p>
          ) : (
            <>
              <span class="muted small">
                {tr(T.valid)
                  .replace("{n}", fmt(validCount))
                  .replace("{t}", fmt(parsed.value.length))}
              </span>
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>{tr(T.address)}</th>
                      <th>{tr(T.ig)}</th>
                      <th>{tr(T.ul)}</th>
                      <th>{tr(T.oui)}</th>
                      <th>{tr(T.linkLocal)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.value.map((p, i) => {
                      if (!p.bytes)
                        return (
                          <tr key={`${i}-${p.line}`}>
                            <td class="mono">{p.line}</td>
                            <td colSpan={4}>
                              <Badge kind="bad">{tr(T.invalid)}</Badge>
                            </td>
                          </tr>
                        );
                      const info = macInfo(p.bytes);
                      return (
                        <tr key={`${i}-${p.line}`}>
                          <td class="mono">{formatMac(p.bytes, format.value, upper.value)}</td>
                          <td>
                            <Badge kind={info.group ? "warn" : "info"}>
                              {tr(
                                info.broadcast ? T.broadcast : info.group ? T.group : T.individual,
                              )}
                            </Badge>
                          </td>
                          <td>
                            <Badge kind={info.local ? "warn" : "info"}>
                              {tr(info.local ? T.localShort : T.universal)}
                            </Badge>
                          </td>
                          <td class="mono">{info.oui}</td>
                          <td class="mono small">{info.group ? "—" : info.linkLocal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <dl class="mac-address-legend small">
                {LEGEND.map(([k, v]) => (
                  <div key={k}>
                    <dt class="mono">{k}</dt>
                    <dd class="muted">{tr(v)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </>
      )}
    </>
  );
}
