import { useComputed, useSignal } from "@preact/signals";
import { Badge, NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, Panel, Segmented, TextBox, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, lang, tr } from "../../../i18n";
import { Empty, SearchBox } from "../_ui";
import type { Proto } from "./data";
import { candidates, cryptoInt, RANGES, type RangeId, randomPorts, searchPorts } from "./logic";

const T = {
  generator: l("Random port", "Port aléatoire"),
  range: l("Range", "Plage"),
  min: l("From", "De"),
  max: l("To", "À"),
  count: l("How many", "Combien"),
  skipWellKnown: l("Skip well-known ports (0–1023)", "Éviter les ports système (0–1023)"),
  skipCommon: l(
    "Skip the commonly used ports listed below",
    "Éviter les ports courants listés ci-dessous",
  ),
  skipEphemeral: l(
    "Skip the Linux ephemeral range (32768–60999)",
    "Éviter la plage éphémère de Linux (32768–60999)",
  ),
  again: l("Pick again", "Tirer à nouveau"),
  ports: l("Ports", "Ports"),
  pool: l("{n} ports available", "{n} ports disponibles"),
  none: l("No port left with these settings.", "Aucun port possible avec ces réglages."),
  reference: l("Common ports", "Ports courants"),
  search: l("Search a port, a service or a word…", "Chercher un port, un service ou un mot…"),
  all: l("All", "Tous"),
  noMatch: l("No port matches.", "Aucun port ne correspond."),
  port: l("Port", "Port"),
  proto: l("Protocol", "Protocole"),
  service: l("Service", "Service"),
  desc: l("Use", "Usage"),
  count2: l("{n} ports", "{n} ports"),
  random: l(
    "Ports come from your browser's cryptographic random generator. A port that is free here may still be in use on your machine.",
    "Les ports viennent du générateur aléatoire cryptographique de ton navigateur. Un port libre ici peut quand même être pris sur ta machine.",
  ),
};

const RANGE_L: Record<RangeId, L10n> = {
  registered: l("Registered (1024–49151)", "Enregistrés (1024–49151)"),
  dynamic: l("Dynamic / private (49152–65535)", "Dynamiques / privés (49152–65535)"),
  unprivileged: l("Any unprivileged (1024–65535)", "Tout non privilégié (1024–65535)"),
  custom: l("Custom", "Personnalisée"),
};

const PROTO_L: Record<Proto, string> = { tcp: "TCP", udp: "UDP", both: "TCP/UDP" };

export default function RandomPort() {
  const range = useToolState<RangeId>("range", "registered");
  const min = useToolState("min", 10000);
  const max = useToolState("max", 20000);
  const count = useToolState("count", 5);
  const skipWellKnown = useToolState("wellknown", true);
  const skipCommon = useToolState("common", true);
  const skipEphemeral = useToolState("ephemeral", false);
  const query = useToolState("q", "");
  const proto = useToolState<Proto | "all">("proto", "all");
  const nonce = useSignal(0);

  const opts = useComputed(() => {
    const [lo, hi] = range.value === "custom" ? [min.value, max.value] : RANGES[range.value];
    return {
      min: lo,
      max: hi,
      skipWellKnown: skipWellKnown.value,
      skipCommon: skipCommon.value,
      skipEphemeral: skipEphemeral.value,
    };
  });
  const pool = useComputed(() => candidates(opts.value).length);
  const picked = useComputed(() => {
    nonce.value;
    return randomPorts(count.value, opts.value, cryptoInt);
  });
  const matches = useComputed(() => searchPorts(query.value, proto.value));
  const fr = lang.value === "fr";

  return (
    <>
      <Panel title={tr(T.generator)}>
        <div class="grid-2">
          <div class="stack">
            <Select<RangeId>
              label={tr(T.range)}
              value={range.value}
              options={(["registered", "dynamic", "unprivileged", "custom"] as const).map((r) => ({
                value: r,
                label: tr(RANGE_L[r]),
              }))}
              onChange={(v) => {
                range.value = v;
              }}
            />
            {range.value === "custom" && (
              <div class="grid-2">
                <NumberField
                  label={tr(T.min)}
                  value={min.value}
                  min={1}
                  max={65535}
                  integer
                  onChange={(v) => {
                    min.value = v;
                  }}
                />
                <NumberField
                  label={tr(T.max)}
                  value={max.value}
                  min={1}
                  max={65535}
                  integer
                  onChange={(v) => {
                    max.value = v;
                  }}
                />
              </div>
            )}
            <NumberField
              label={tr(T.count)}
              value={count.value}
              min={1}
              max={500}
              integer
              onChange={(v) => {
                count.value = v;
              }}
            />
            {range.value === "custom" && (
              <Toggle
                checked={skipWellKnown.value}
                onChange={(v) => {
                  skipWellKnown.value = v;
                }}
                label={tr(T.skipWellKnown)}
              />
            )}
            <Toggle
              checked={skipCommon.value}
              onChange={(v) => {
                skipCommon.value = v;
              }}
              label={tr(T.skipCommon)}
            />
            <Toggle
              checked={skipEphemeral.value}
              onChange={(v) => {
                skipEphemeral.value = v;
              }}
              label={tr(T.skipEphemeral)}
            />
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
              <span class="muted small">{tr(T.pool).replace("{n}", fmt(pool.value))}</span>
            </div>
          </div>
          <div class="stack">
            {picked.value.length === 0 ? (
              <p class="error-note">{tr(T.none)}</p>
            ) : (
              <>
                <p class="random-port-hero mono">{picked.value[0]}</p>
                <TextBox label={tr(T.ports)} value={picked.value.join("\n")} readOnly rows={6} />
              </>
            )}
            <p class="muted small">{tr(T.random)}</p>
          </div>
        </div>
      </Panel>

      <section class="stack">
        <h2 class="panel-title">{tr(T.reference)}</h2>
        <SearchBox
          value={query.value}
          onInput={(v) => {
            query.value = v;
          }}
          placeholder={tr(T.search)}
        />
        <div class="row">
          <Segmented<Proto | "all">
            label={tr(T.proto)}
            value={proto.value}
            options={[
              { value: "all", label: tr(T.all) },
              { value: "tcp", label: "TCP" },
              { value: "udp", label: "UDP" },
            ]}
            onChange={(v) => {
              proto.value = v;
            }}
          />
          <span class="spacer" />
          <span class="muted small">{tr(T.count2).replace("{n}", fmt(matches.value.length))}</span>
        </div>
        {matches.value.length === 0 ? (
          <Empty>{tr(T.noMatch)}</Empty>
        ) : (
          <div class="table-wrap random-port-table">
            <table class="table">
              <thead>
                <tr>
                  <th>{tr(T.port)}</th>
                  <th>{tr(T.proto)}</th>
                  <th>{tr(T.service)}</th>
                  <th>{tr(T.desc)}</th>
                </tr>
              </thead>
              <tbody>
                {matches.value.map((p) => (
                  <tr key={`${p.port}-${p.proto}`}>
                    <td class="mono">{p.port}</td>
                    <td>
                      <Badge kind="info">{PROTO_L[p.proto]}</Badge>
                    </td>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td class="small">{fr ? p.fr : p.en}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
