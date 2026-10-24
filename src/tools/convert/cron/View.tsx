import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, ErrorNote, Field, Panel } from "../../../app/ui";
import { fmt, l, lang, tr } from "../../../i18n";
import { isValidZone, localZone, relative } from "../_shared";
import { attempt, locale, ZonePicker } from "../_ui";
import { describeCron, type FieldName, nextRuns, PRESETS, parseCron } from "./logic";

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

export default function CronView() {
  const expr = useToolState("expr", "0 9 * * 1-5");
  const zone = useToolState("zone", localZone());
  const parsed = useComputed(() => parseCron(expr.value));
  const p = parsed.value;
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

      {p.ok && (
        <>
          {description.value && <p class="cron-desc">{description.value}</p>}
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
        </>
      )}
    </>
  );
}
