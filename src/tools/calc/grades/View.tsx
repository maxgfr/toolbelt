import { Badge, NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, IconButton, Panel, Stats } from "../../../app/ui";
import { type L10n, l, tr } from "../../../i18n";
import { Formula, NumText, num, numOr, Result } from "../_ui";
import {
  type Grade,
  letterGrade,
  type Mention,
  mention,
  neededGrade,
  rescale,
  totalWeight,
  weightedAverage,
} from "./logic";

const T = {
  scale: l("Average out of", "Moyenne sur"),
  grades: l("Grades", "Notes"),
  subject: l("Subject / exam", "Matière / épreuve"),
  grade: l("Grade", "Note"),
  outOf: l("Out of", "Sur"),
  coef: l("Coefficient", "Coefficient"),
  add: l("Add a grade", "Ajouter une note"),
  remove: l("Remove", "Retirer"),
  average: l("Weighted average", "Moyenne pondérée"),
  weights: l("Total coefficients: {n}", "Total des coefficients : {n}"),
  none: l("Type at least one grade.", "Tape au moins une note."),
  needTitle: l("What do I need on the next exam?", "Quelle note me faut-il au prochain examen ?"),
  target: l("Target average", "Moyenne visée"),
  nextCoef: l("Coefficient of the next exam", "Coefficient du prochain examen"),
  need: l("You need", "Il te faut"),
  reached: l("Already reached, whatever you get.", "Déjà atteinte, quelle que soit la note."),
  impossible: l(
    "Out of reach with this exam alone (more than the maximum).",
    "Hors d'atteinte avec ce seul examen (plus que le maximum).",
  ),
  convert: l("Convert a grade", "Convertir une note"),
  value: l("Grade", "Note"),
  on20: l("/20", "/20"),
  on10: l("/10", "/10"),
  on100: l("%", "%"),
  letter: l("US letter", "Lettre (US)"),
  gpa: l("GPA (4.0)", "GPA (4.0)"),
  mention: l("French honours", "Mention (France)"),
  f1: l(
    "Average = Σ (grade ÷ out of × scale × coefficient) ÷ Σ coefficients. Needed grade = (target × (Σ coefficients + c) − average × Σ coefficients) ÷ c.",
    "Moyenne = Σ (note ÷ barème × échelle × coefficient) ÷ Σ coefficients. Note nécessaire = (cible × (Σ coefficients + c) − moyenne × Σ coefficients) ÷ c.",
  ),
  f2: l(
    "Conversions between scales are proportional (14/20 = 70 %). Grading cultures differ: a French 14/20 is a very good mark, a US 70 % is a C−. Letter grades use the common US scale (A ≥ 93, A− ≥ 90, B+ ≥ 87…).",
    "Les conversions entre barèmes sont proportionnelles (14/20 = 70 %). Les cultures de notation diffèrent : un 14/20 français est une très bonne note, un 70 % américain un C−. Les lettres suivent l'échelle US courante (A ≥ 93, A− ≥ 90, B+ ≥ 87…).",
  ),
};

const MENTION: Record<Mention, L10n> = {
  tb: l("Très bien (highest honours)", "Très bien"),
  b: l("Bien (high honours)", "Bien"),
  ab: l("Assez bien (honours)", "Assez bien"),
  pass: l("Pass", "Admis (sans mention)"),
  fail: l("Below 10/20", "Sous la moyenne"),
};

type Row = {
  label: string;
  value: string;
  outOf: string;
  coef: string;
};

export default function Grades() {
  const scale = useToolState("scale", 20);
  const rows = useToolState<Row[]>("rows", [
    { label: "", value: "12", outOf: "", coef: "2" },
    { label: "", value: "15", outOf: "", coef: "1" },
    { label: "", value: "9", outOf: "", coef: "3" },
  ]);
  const target = useToolState("target", 12);
  const nextCoef = useToolState("nextCoef", 2);
  const cv = useToolState("cv", 14);
  const cvFrom = useToolState("cvFrom", 20);

  const S = scale.value > 0 ? scale.value : 20;
  const grades: Grade[] = rows.value
    .filter((r) => r.value.trim() !== "")
    .map((r) => ({
      value: numOr(r.value, Number.NaN),
      outOf: numOr(r.outOf, S),
      coef: numOr(r.coef, 1),
    }));
  const avg = weightedAverage(grades, S);
  const need = neededGrade(grades, S, target.value, nextCoef.value);
  const setRow = (i: number, patch: Partial<Row>) => {
    rows.value = rows.value.map((r, j) => (j === i ? { ...r, ...patch } : r));
  };

  const conversions = (value: number, from: number) => {
    const pct = rescale(value, from, 100);
    if (pct === null) return [];
    const lg = letterGrade(pct);
    return [
      { label: tr(T.on20), value: `${num(pct / 5, 2)} / 20` },
      { label: tr(T.on10), value: `${num(pct / 10, 2)} / 10` },
      { label: tr(T.on100), value: `${num(pct, 1)} %` },
      { label: tr(T.letter), value: lg.letter },
      { label: tr(T.gpa), value: num(lg.gpa, 1) },
      { label: tr(T.mention), value: tr(MENTION[mention(pct / 5)]) },
    ];
  };

  return (
    <>
      <div class="row">
        <div class="grades-scale">
          <NumberField
            label={tr(T.scale)}
            value={scale.value}
            min={1}
            max={1000}
            step="any"
            onChange={(v) => {
              scale.value = v;
            }}
          />
        </div>
        {[20, 10, 100].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={scale.value === s ? "primary" : "secondary"}
            onClick={() => {
              scale.value = s;
            }}
          >
            /{s}
          </Button>
        ))}
      </div>

      <Panel title={tr(T.grades)}>
        <div class="table-wrap">
          <table class="table grades-table">
            <thead>
              <tr>
                <th>{tr(T.subject)}</th>
                <th>{tr(T.grade)}</th>
                <th>{tr(T.outOf)}</th>
                <th>{tr(T.coef)}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.value.map((r, i) => (
                <tr key={i}>
                  <td>
                    <input
                      class="input"
                      type="text"
                      aria-label={tr(T.subject)}
                      placeholder={`${tr(T.subject)} ${i + 1}`}
                      value={r.label}
                      onInput={(e) =>
                        setRow(i, { label: (e.currentTarget as HTMLInputElement).value })
                      }
                    />
                  </td>
                  <td>
                    <NumText
                      hidden
                      class="grades-num"
                      label={tr(T.grade)}
                      value={r.value}
                      onInput={(v) => setRow(i, { value: v })}
                    />
                  </td>
                  <td>
                    <NumText
                      hidden
                      class="grades-num"
                      label={tr(T.outOf)}
                      placeholder={num(S)}
                      value={r.outOf}
                      onInput={(v) => setRow(i, { outOf: v })}
                    />
                  </td>
                  <td>
                    <NumText
                      hidden
                      class="grades-num"
                      label={tr(T.coef)}
                      placeholder="1"
                      value={r.coef}
                      onInput={(v) => setRow(i, { coef: v })}
                    />
                  </td>
                  <td>
                    <IconButton
                      icon="close"
                      label={tr(T.remove)}
                      onClick={() => {
                        rows.value = rows.value.filter((_, j) => j !== i);
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div class="row">
          <Button
            icon="plus"
            onClick={() => {
              rows.value = [...rows.value, { label: "", value: "", outOf: "", coef: "1" }];
            }}
          >
            {tr(T.add)}
          </Button>
        </div>
        {avg === null ? (
          <p class="muted small">{tr(T.none)}</p>
        ) : (
          <>
            <Result
              label={tr(T.average)}
              value={`${num(avg, 2)} / ${num(S)}`}
              copy={String(Math.round(avg * 100) / 100)}
              note={tr(T.weights).replace("{n}", num(totalWeight(grades), 2))}
            />
            <Stats items={conversions(avg, S)} />
          </>
        )}
      </Panel>

      <Panel title={tr(T.needTitle)}>
        <div class="grid-2">
          <NumberField
            label={`${tr(T.target)} (/${num(S)})`}
            value={target.value}
            min={0}
            max={S}
            step="any"
            onChange={(v) => {
              target.value = v;
            }}
          />
          <NumberField
            label={tr(T.nextCoef)}
            value={nextCoef.value}
            min={0.01}
            step="any"
            onChange={(v) => {
              nextCoef.value = v;
            }}
          />
        </div>
        {need &&
          (need.status === "reached" ? (
            <Badge kind="ok">{tr(T.reached)}</Badge>
          ) : need.status === "impossible" ? (
            <>
              <Result label={tr(T.need)} value={`${num(need.grade, 2)} / ${num(S)}`} />
              <Badge kind="warn">{tr(T.impossible)}</Badge>
            </>
          ) : (
            <Result label={tr(T.need)} value={`${num(need.grade, 2)} / ${num(S)}`} />
          ))}
      </Panel>

      <Panel title={tr(T.convert)}>
        <div class="grid-2">
          <NumberField
            label={tr(T.value)}
            value={cv.value}
            min={0}
            step="any"
            onChange={(v) => {
              cv.value = v;
            }}
          />
          <NumberField
            label={tr(T.outOf)}
            value={cvFrom.value}
            min={1}
            step="any"
            onChange={(v) => {
              cvFrom.value = v;
            }}
          />
        </div>
        <Stats items={conversions(cv.value, cvFrom.value)} />
      </Panel>

      <Formula>
        <p>{tr(T.f1)}</p>
        <p>{tr(T.f2)}</p>
      </Formula>
    </>
  );
}
