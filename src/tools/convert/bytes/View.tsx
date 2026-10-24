import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { CopyButton, ErrorNote, Field, Panel } from "../../../app/ui";
import { l, lang, tr } from "../../../i18n";
import { parseNumber } from "../_shared";
import { formatDuration, formatNum, plainNum } from "../_ui";
import { convertSize, humanSize, RATE_UNITS, SIZE_UNITS, transferSeconds } from "./logic";

const T = {
  size: l("Size", "Taille"),
  value: l("Value", "Valeur"),
  unit: l("Unit", "Unité"),
  bits: l("Bits", "Bits"),
  si: l("Decimal (SI, ×1000)", "Décimal (SI, ×1000)"),
  iec: l("Binary (IEC, ×1024)", "Binaire (CEI, ×1024)"),
  readable: l("Readable", "Lisible"),
  invalid: l("Type a number, e.g. 1.5 or 700.", "Tape un nombre, par ex. 1,5 ou 700."),
  transfer: l("Transfer time", "Temps de transfert"),
  transferOf: l(
    "Time to transfer the size above at…",
    "Temps pour transférer la taille ci-dessus à…",
  ),
  bandwidth: l("Bandwidth", "Débit"),
  badRate: l("The bandwidth must be above zero.", "Le débit doit être supérieur à zéro."),
  common: l("At common speeds", "Aux débits courants"),
  speed: l("Speed", "Débit"),
  time: l("Time", "Durée"),
  noteSi: l(
    "Drives and networks count in 1000s (GB, Mbit/s); operating systems often show 1024s (GiB) with the GB label.",
    "Disques et réseaux comptent par 1000 (Go, Mbit/s) ; les systèmes affichent souvent des 1024 (Gio) sous l'étiquette Go.",
  ),
};

const COMMON = [
  { label: "1 Mbit/s", bps: 1e6 },
  { label: "10 Mbit/s", bps: 1e7 },
  { label: "100 Mbit/s", bps: 1e8 },
  { label: "1 Gbit/s", bps: 1e9 },
  { label: "10 Gbit/s", bps: 1e10 },
];

const GROUPS = [
  { system: "bit", label: T.bits },
  { system: "si", label: T.si },
  { system: "iec", label: T.iec },
] as const;

/** French writes bytes as octets: GB → Go, MiB/s → Mio/s. */
function label(id: string): string {
  return lang.value === "fr" ? id.replace("iB", "io").replace("B", "o") : id;
}

export default function Bytes() {
  const value = useToolState("value", "1");
  const unit = useToolState("unit", "GB");
  const rate = useToolState("rate", "100");
  const rateUnit = useToolState("rateUnit", "Mbit/s");

  const n = useComputed(() => parseNumber(value.value));
  const rows = useComputed(() => (n.value === null ? [] : convertSize(n.value, unit.value)));
  const bytes = rows.value.find((r) => r.id === "B")?.value ?? null;
  const r = parseNumber(rate.value);
  const seconds =
    n.value !== null && r !== null ? transferSeconds(n.value, unit.value, r, rateUnit.value) : null;

  return (
    <>
      <Panel title={tr(T.size)}>
        <div class="by-input">
          <Field label={tr(T.value)}>
            <input
              class="input"
              type="text"
              inputMode="decimal"
              value={value.value}
              aria-invalid={n.value === null && !!value.value.trim()}
              onInput={(e) => {
                value.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
          <Field label={tr(T.unit)}>
            <select
              class="input"
              value={unit.value}
              onChange={(e) => {
                unit.value = (e.currentTarget as HTMLSelectElement).value;
              }}
            >
              {GROUPS.map((g) => (
                <optgroup key={g.system} label={tr(g.label)}>
                  {SIZE_UNITS.filter((u) => u.system === g.system).map((u) => (
                    <option key={u.id} value={u.id}>
                      {label(u.id)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </div>
        {n.value === null && value.value.trim() && <ErrorNote error={tr(T.invalid)} />}
        {bytes !== null && (
          <p class="by-readable">
            <span class="muted small">{tr(T.readable)}</span>{" "}
            <strong>
              {formatNum(humanSize(bytes, "si").value, 4)} {label(humanSize(bytes, "si").id)}
            </strong>{" "}
            <span class="muted">·</span>{" "}
            <strong>
              {formatNum(humanSize(bytes, "iec").value, 4)} {label(humanSize(bytes, "iec").id)}
            </strong>
          </p>
        )}
      </Panel>

      {rows.value.length > 0 && (
        <div class="grid-3">
          {GROUPS.map((g) => (
            <div class="table-wrap" key={g.system}>
              <table class="table">
                <thead>
                  <tr>
                    <th colSpan={3}>{tr(g.label)}</th>
                  </tr>
                </thead>
                <tbody>
                  {SIZE_UNITS.filter((u) => u.system === g.system).map((u) => {
                    const v = rows.value.find((x) => x.id === u.id)?.value ?? 0;
                    return (
                      <tr key={u.id} class={u.id === unit.value ? "by-on" : ""}>
                        <td class="num mono">{formatNum(v)}</td>
                        <td class="by-unit">{label(u.id)}</td>
                        <td class="by-copy">
                          <CopyButton text={plainNum(v)} label="" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      <p class="muted small">{tr(T.noteSi)}</p>

      <Panel title={tr(T.transfer)}>
        <p class="muted small">{tr(T.transferOf)}</p>
        <div class="by-input">
          <Field label={tr(T.bandwidth)}>
            <input
              class="input"
              type="text"
              inputMode="decimal"
              value={rate.value}
              aria-invalid={r === null || r <= 0}
              onInput={(e) => {
                rate.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
          <Field label={tr(T.unit)}>
            <select
              class="input"
              value={rateUnit.value}
              onChange={(e) => {
                rateUnit.value = (e.currentTarget as HTMLSelectElement).value;
              }}
            >
              {RATE_UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  {label(u.id)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {(r === null || r <= 0) && rate.value.trim() && <ErrorNote error={tr(T.badRate)} />}
        {seconds !== null && <p class="by-time">{formatDuration(seconds)}</p>}
        {n.value !== null && n.value >= 0 && (
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{tr(T.common)}</th>
                  <th class="num">{tr(T.time)}</th>
                </tr>
              </thead>
              <tbody>
                {COMMON.map((c) => {
                  const s = transferSeconds(n.value ?? 0, unit.value, c.bps / 1e6, "Mbit/s");
                  return (
                    <tr key={c.label}>
                      <td>{c.label}</td>
                      <td class="num">{s === null ? "—" : formatDuration(s)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
