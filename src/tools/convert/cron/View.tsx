import { useComputed } from "@preact/signals";
import { NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, ErrorNote, Field, Panel, Segmented } from "../../../app/ui";
import { fmt, type L10n, l, lang, tr } from "../../../i18n";
import { isValidZone, localZone, relative } from "../_shared";
import { attempt, locale, ZonePicker } from "../_ui";
import {
  BUILDER_FIELDS,
  type BuilderField,
  type BuilderSpec,
  type BuildMode,
  buildCron,
  cronToBuilder,
  defaultBuilder,
  describeCron,
  everySpec,
  type FieldName,
  type FieldSpec,
  fieldToCron,
  LIMITS,
  nextRuns,
  PRESETS,
  parseCron,
} from "./logic";

const T = {
  expr: l("Cron expression", "Expression cron"),
  hint: l(
    "5 fields (minute hour day month weekday), 6 with seconds first, or @daily, @hourly…",
    "5 champs (minute heure jour mois jour-de-semaine), 6 avec les secondes en tête, ou @daily, @hourly…",
  ),
  presets: l("Presets", "Modèles"),
  zone: l("Time zone of the runs", "Fuseau des exécutions"),
  fields: l("Fields", "Champs"),
  field: l("Field", "Champ"),
  value: l("Value", "Valeur"),
  allowed: l("Allowed", "Valeurs permises"),
  next: l("Next {n} runs", "{n} prochaines exécutions"),
  when: l("When", "Quand"),
  in: l("In", "Dans"),
  empty: l("Type an expression or pick a preset.", "Tape une expression ou choisis un modèle."),
  count: l(
    "A cron expression has 5 fields (or 6 with seconds): found {n}.",
    "Une expression cron a 5 champs (ou 6 avec les secondes) : {n} trouvé(s).",
  ),
  syntax: l("This expression is not valid:", "Cette expression n'est pas valide :"),
  noRuns: l("No upcoming run.", "Aucune exécution à venir."),
  syntaxHelp: l("Syntax", "Syntaxe"),
  explain: l("Explain", "Expliquer"),
  build: l("Build", "Construire"),
  mode: l("Mode", "Mode"),
  builder: l("Builder", "Constructeur"),
  every: l("Every", "Chaque"),
  everyN: l("Every N", "Tous les N"),
  specific: l("Specific", "Valeurs précises"),
  range: l("Range", "Plage"),
  stepN: l("Every", "Tous les"),
  startAt: l("Starting at", "À partir de"),
  from: l("From", "De"),
  to: l("To", "À"),
  rangeStep: l("Step (1 = every value)", "Pas (1 = chaque valeur)"),
  pickSome: l(
    "Pick one or more values (none = every value).",
    "Choisis une ou plusieurs valeurs (aucune = toutes).",
  ),
  unbuildable: l(
    "The builder cannot show this expression (seconds, L, W or #). Changing a field below starts again from it.",
    "Le constructeur ne peut pas afficher cette expression (secondes, L, W ou #). Modifier un champ ci-dessous repart de lui.",
  ),
  reset: l("Reset the builder", "Réinitialiser le constructeur"),
  domDowNote: l(
    "When both day of month and day of week are restricted, cron runs on days matching either.",
    "Quand le jour du mois et le jour de la semaine sont tous deux restreints, cron s'exécute les jours qui correspondent à l'un ou l'autre.",
  ),
};

const MODE_L: Record<BuildMode, L10n> = {
  every: T.every,
  step: T.everyN,
  specific: T.specific,
  range: T.range,
};

const UNIT: Record<BuilderField, L10n> = {
  minute: l("min", "min"),
  hour: l("h", "h"),
  dom: l("days", "jours"),
  month: l("months", "mois"),
  dow: l("days", "jours"),
};

const PRESET_LABEL: Record<(typeof PRESETS)[number]["id"], ReturnType<typeof l>> = {
  min: l("Every minute", "Chaque minute"),
  "5min": l("Every 5 minutes", "Toutes les 5 min"),
  "15min": l("Every 15 minutes", "Toutes les 15 min"),
  hourly: l("Every hour", "Chaque heure"),
  midnight: l("Daily at midnight", "Chaque jour à minuit"),
  weekdays9: l("Weekdays at 9:00", "En semaine à 9 h"),
  monday: l("Mondays at 9:00", "Le lundi à 9 h"),
  monthly: l("1st of the month", "Le 1er du mois"),
  yearly: l("Every January 1st", "Chaque 1er janvier"),
  "30s": l("Every 30 seconds", "Toutes les 30 s"),
};

const FIELD: Record<FieldName, { name: ReturnType<typeof l>; allowed: ReturnType<typeof l> }> = {
  second: { name: l("Second", "Seconde"), allowed: l("0–59", "0–59") },
  minute: { name: l("Minute", "Minute"), allowed: l("0–59", "0–59") },
  hour: { name: l("Hour", "Heure"), allowed: l("0–23", "0–23") },
  dom: { name: l("Day of month", "Jour du mois"), allowed: l("1–31, L, W", "1–31, L, W") },
  month: { name: l("Month", "Mois"), allowed: l("1–12 or JAN–DEC", "1–12 ou JAN–DEC") },
  dow: {
    name: l("Day of week", "Jour de la semaine"),
    allowed: l("0–7 (0, 7 = Sunday) or SUN–SAT, L, #", "0–7 (0, 7 = dimanche) ou SUN–SAT, L, #"),
  },
};

const SYNTAX: [string, ReturnType<typeof l>][] = [
  ["*", l("any value", "toute valeur")],
  [",", l("list: 1,15", "liste : 1,15")],
  ["-", l("range: 1-5", "plage : 1-5")],
  ["/", l("step: */10, 0-30/5", "pas : */10, 0-30/5")],
  ["L", l("last (day of month, or weekday: 5L)", "dernier (jour du mois, ou jour : 5L)")],
  ["#", l("nth weekday: 1#2 = 2nd Monday", "n-ième jour : 1#2 = 2e lundi")],
];

const COUNT = 10;

/** A value as shown in the builder: month and weekday names, plain numbers otherwise. */
function valueLabel(f: BuilderField, v: number, loc: string, width: "short" | "long"): string {
  if (f === "month")
    return (
      attempt(() =>
        new Intl.DateTimeFormat(loc, { month: width, timeZone: "UTC" }).format(
          Date.UTC(2024, v - 1, 1),
        ),
      ) ?? String(v)
    );
  if (f === "dow")
    // 2024-01-07 is a Sunday.
    return (
      attempt(() =>
        new Intl.DateTimeFormat(loc, { weekday: width, timeZone: "UTC" }).format(
          Date.UTC(2024, 0, 7 + v),
        ),
      ) ?? String(v)
    );
  return f === "minute" || f === "hour" ? String(v).padStart(2, "0") : String(v);
}

function FieldBuilder({
  f,
  spec,
  onChange,
}: {
  f: BuilderField;
  spec: FieldSpec;
  onChange: (s: FieldSpec) => void;
}) {
  const { min, max } = LIMITS[f];
  const loc = locale();
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const opts = values.map((v) => ({ value: String(v), label: valueLabel(f, v, loc, "long") }));
  const set = (patch: Partial<FieldSpec>) => onChange({ ...spec, ...patch });
  const picked = new Set(spec.values ?? []);
  return (
    <Panel
      title={tr(FIELD[f].name)}
      actions={<code class="mono small">{fieldToCron(f, spec)}</code>}
    >
      <div class="row">
        <Segmented<BuildMode>
          label={tr(T.mode)}
          value={spec.mode}
          options={(["every", "step", "specific", "range"] as const).map((m) => ({
            value: m,
            label: tr(MODE_L[m]),
          }))}
          onChange={(mode) => set({ mode })}
        />
      </div>
      {spec.mode === "step" && (
        <div class="grid-2">
          <NumberField
            label={tr(T.stepN)}
            value={spec.step}
            min={1}
            max={max - min + 1}
            integer
            suffix={tr(UNIT[f])}
            onChange={(step) => set({ step })}
          />
          <Select
            label={tr(T.startAt)}
            value={String(spec.start)}
            options={opts}
            onChange={(v) => set({ start: Number(v) })}
          />
        </div>
      )}
      {spec.mode === "specific" && (
        <>
          <span class="muted small">{tr(T.pickSome)}</span>
          <fieldset class="segmented">
            <legend class="sr-only">{tr(FIELD[f].name)}</legend>
            {values.map((v) => {
              const on = picked.has(v);
              return (
                <button
                  type="button"
                  key={v}
                  class={on ? "on" : ""}
                  aria-pressed={on}
                  title={valueLabel(f, v, loc, "long")}
                  onClick={() =>
                    set({ values: on ? [...picked].filter((x) => x !== v) : [...picked, v] })
                  }
                >
                  {valueLabel(f, v, loc, "short")}
                </button>
              );
            })}
          </fieldset>
        </>
      )}
      {spec.mode === "range" && (
        <div class="grid-3">
          <Select
            label={tr(T.from)}
            value={String(spec.from)}
            options={opts}
            onChange={(v) => set({ from: Number(v) })}
          />
          <Select
            label={tr(T.to)}
            value={String(spec.to)}
            options={opts}
            onChange={(v) => set({ to: Number(v) })}
          />
          <NumberField
            label={tr(T.rangeStep)}
            value={spec.step}
            min={1}
            max={max - min + 1}
            integer
            onChange={(step) => set({ step })}
          />
        </div>
      )}
    </Panel>
  );
}

export default function CronView() {
  const expr = useToolState("expr", "0 9 * * 1-5");
  const zone = useToolState("zone", localZone());
  const mode = useToolState<"explain" | "build">("mode", "explain");
  const builder = useToolState<BuilderSpec>("builder", defaultBuilder());
  const parsed = useComputed(() => parseCron(expr.value));
  const p = parsed.value;
  // The builder shows its own state while it matches the expression (so a field keeps the
  // mode it was given), else the expression read back, else its last state with a note.
  const shown = useComputed(() => {
    const b = builder.value;
    const pv = parsed.value;
    if (pv.ok && attempt(() => buildCron(b)) === pv.expr) return { spec: b, fits: true };
    const read = cronToBuilder(expr.value);
    if (read) return { spec: read, fits: true };
    const safe = Object.fromEntries(
      BUILDER_FIELDS.map((f) => [f, b?.[f] ?? everySpec(f)]),
    ) as BuilderSpec;
    return { spec: safe, fits: false };
  });
  const setField = (f: BuilderField, s: FieldSpec) => {
    const next = { ...shown.value.spec, [f]: s };
    builder.value = next;
    expr.value = buildCron(next);
  };
  const domDow =
    mode.value === "build" &&
    shown.value.spec.dom.mode !== "every" &&
    shown.value.spec.dow.mode !== "every";
  const zoneOk = isValidZone(zone.value) ? zone.value : "UTC";
  const description = useComputed(() =>
    parsed.value.ok ? describeCron(parsed.value.expr, lang.value) : null,
  );
  const runs = useComputed(() =>
    parsed.value.ok
      ? nextRuns(parsed.value.expr, COUNT, new Date(), isValidZone(zone.value) ? zone.value : "UTC")
      : [],
  );
  const loc = locale();
  const format = (d: Date) =>
    attempt(() =>
      new Intl.DateTimeFormat(loc, {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        ...(p.ok && p.fields.length === 6 ? { second: "2-digit" } : {}),
        timeZone: zoneOk,
      }).format(d),
    ) ?? d.toISOString();
  const now = Date.now();

  return (
    <>
      <div class="row">
        <Segmented<"explain" | "build">
          label={tr(T.mode)}
          value={mode.value}
          options={[
            { value: "explain", label: tr(T.explain) },
            { value: "build", label: tr(T.build) },
          ]}
          onChange={(v) => {
            mode.value = v;
          }}
        />
      </div>
      <Field label={tr(T.expr)} hint={tr(T.hint)}>
        <div class="row cron-input">
          <input
            class="input mono"
            type="text"
            value={expr.value}
            spellcheck={false}
            autocomplete="off"
            aria-invalid={!p.ok && p.error !== "empty"}
            onInput={(e) => {
              expr.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
          {expr.value && <CopyButton text={expr.value} />}
        </div>
      </Field>
      <div class="row">
        {PRESETS.map((pr) => (
          <Button
            key={pr.id}
            size="sm"
            variant={p.ok && p.expr === pr.expr ? "primary" : "secondary"}
            onClick={() => {
              expr.value = pr.expr;
            }}
          >
            {tr(PRESET_LABEL[pr.id])}
          </Button>
        ))}
      </div>

      {!p.ok && p.error === "empty" && <p class="muted">{tr(T.empty)}</p>}
      {!p.ok && p.error === "count" && (
        <ErrorNote error={tr(T.count).replace("{n}", String(p.count))} />
      )}
      {!p.ok && p.error === "syntax" && <ErrorNote error={`${tr(T.syntax)} ${p.detail}`} />}

      {p.ok && description.value && <p class="cron-desc">{description.value}</p>}

      {mode.value === "build" && (
        <section class="stack">
          <div class="row">
            <h2 class="panel-title">{tr(T.builder)}</h2>
            <span class="spacer" />
            <Button
              size="sm"
              variant="ghost"
              icon="reset"
              onClick={() => {
                const d = defaultBuilder();
                builder.value = d;
                expr.value = buildCron(d);
              }}
            >
              {tr(T.reset)}
            </Button>
          </div>
          {!shown.value.fits && <p class="muted small">{tr(T.unbuildable)}</p>}
          {BUILDER_FIELDS.map((f) => (
            <FieldBuilder
              key={f}
              f={f}
              spec={shown.value.spec[f]}
              onChange={(s) => setField(f, s)}
            />
          ))}
          {domDow && <p class="muted small">{tr(T.domDowNote)}</p>}
        </section>
      )}

      {p.ok && (
        <div class="grid-2">
          <Panel title={tr(T.fields)}>
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>{tr(T.field)}</th>
                    <th>{tr(T.value)}</th>
                    <th>{tr(T.allowed)}</th>
                  </tr>
                </thead>
                <tbody>
                  {p.fields.map((f) => (
                    <tr key={f.name}>
                      <td>{tr(FIELD[f.name].name)}</td>
                      <td class="mono">{f.value}</td>
                      <td class="muted small">{tr(FIELD[f.name].allowed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl class="cron-syntax small">
              {SYNTAX.map(([k, v]) => (
                <div key={k}>
                  <dt class="mono">{k}</dt>
                  <dd class="muted">{tr(v)}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title={tr(T.next).replace("{n}", fmt(COUNT))}>
            <Field label={tr(T.zone)}>
              <ZonePicker
                value={zone.value}
                label={tr(T.zone)}
                onChange={(z) => {
                  zone.value = z;
                }}
              />
            </Field>
            {runs.value.length === 0 ? (
              <p class="muted">{tr(T.noRuns)}</p>
            ) : (
              <ol class="cron-runs">
                {runs.value.map((d) => (
                  <li key={d.getTime()}>
                    <span>{format(d)}</span>
                    <span class="muted small">{relative(d.getTime(), now, loc)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
