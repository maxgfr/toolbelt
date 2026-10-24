import { Badge, NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, IconButton, Panel, Stats } from "../../../app/ui";
import { type L10n, l, tr } from "../../../i18n";
import { Formula, NumText, num, numOr, Result } from "../_ui";
import {
  DE_WORST,
  type Grade,
  germanBand,
  gradeFromAveragePoints,
  gradeFromPoints,
  letterGrade,
  type Mention,
  markFromPoints,
  mention,
  neededGermanGrade,
  neededGrade,
  parseGermanGrade,
  pointsFromGrade,
  pointsFromPercent,
  rescale,
  totalWeight,
  truncate1,
  weightedAverage,
} from "./logic";

const T = {
  scale: l("Average out of", "Moyenne sur", "Bewertet von 0 bis"),
  points15: l("0–15 points", "0–15 points", "0–15 Punkte"),
  german: l("German 1–6", "Allemagne 1–6", "Noten 1–6"),
  deHint: l(
    "German grades: 1 is the best, 6 the worst. Type 2+, 2 or 2− (= 1.7, 2, 2.3) or a decimal.",
    "Notes allemandes : 1 est la meilleure, 6 la pire. Tape 2+, 2 ou 2− (= 1,7, 2, 2,3) ou un décimal.",
    "1 ist die beste Note, 6 die schlechteste. Tippe 2+, 2 oder 2− (= 1,7 / 2 / 2,3) oder eine Kommazahl.",
  ),
  grades: l("Grades", "Notes", "Noten"),
  subject: l("Subject / exam", "Matière / épreuve", "Fach / Prüfung"),
  grade: l("Grade", "Note", "Note"),
  outOf: l("Out of", "Sur", "Von"),
  coef: l("Coefficient", "Coefficient", "Gewichtung"),
  add: l("Add a grade", "Ajouter une note", "Note hinzufügen"),
  remove: l("Remove", "Retirer", "Entfernen"),
  average: l("Weighted average", "Moyenne pondérée", "Gewichteter Durchschnitt"),
  weights: l(
    "Total coefficients: {n}",
    "Total des coefficients : {n}",
    "Summe der Gewichtungen: {n}",
  ),
  none: l("Type at least one grade.", "Tape au moins une note.", "Gib mindestens eine Note ein."),
  needTitle: l(
    "What do I need on the next exam?",
    "Quelle note me faut-il au prochain examen ?",
    "Welche Note brauche ich in der nächsten Prüfung?",
  ),
  target: l("Target average", "Moyenne visée", "Angestrebter Schnitt"),
  nextCoef: l(
    "Coefficient of the next exam",
    "Coefficient du prochain examen",
    "Gewichtung der nächsten Prüfung",
  ),
  need: l("You need", "Il te faut", "Du brauchst"),
  needDe: l("You need at least", "Il te faut au moins", "Du brauchst mindestens"),
  reached: l(
    "Already reached, whatever you get.",
    "Déjà atteinte, quelle que soit la note.",
    "Schon erreicht, egal welche Note du bekommst.",
  ),
  impossible: l(
    "Out of reach with this exam alone (more than the maximum).",
    "Hors d'atteinte avec ce seul examen (plus que le maximum).",
    "Mit dieser Prüfung allein nicht erreichbar (mehr als das Maximum).",
  ),
  impossibleDe: l(
    "Out of reach with this exam alone (it would take better than a 1).",
    "Hors d'atteinte avec ce seul examen (il faudrait mieux qu'un 1).",
    "Mit dieser Prüfung allein nicht erreichbar (du bräuchtest besser als eine 1).",
  ),
  convert: l("Convert a grade", "Convertir une note", "Note umrechnen"),
  value: l("Grade", "Note", "Note"),
  on20: l("/20", "/20", "/20"),
  on10: l("/10", "/10", "/10"),
  on100: l("%", "%", "%"),
  letter: l("US letter", "Lettre (US)", "Buchstabennote (USA)"),
  gpa: l("GPA (4.0)", "GPA (4.0)", "GPA (4,0)"),
  mention: l("French honours", "Mention (France)", "Prädikat (Frankreich)"),
  dePoints: l("German Oberstufe points", "Points (lycée allemand)", "Punkte (Oberstufe)"),
  deGrade: l("German grade", "Note allemande", "Schulnote"),
  deReport: l("Report card grade", "Note du bulletin", "Zeugnisnote"),
  f1: l(
    "Average = Σ (grade ÷ out of × scale × coefficient) ÷ Σ coefficients. Needed grade = (target × (Σ coefficients + c) − average × Σ coefficients) ÷ c.",
    "Moyenne = Σ (note ÷ barème × échelle × coefficient) ÷ Σ coefficients. Note nécessaire = (cible × (Σ coefficients + c) − moyenne × Σ coefficients) ÷ c.",
    "Schnitt = Σ (Note ÷ Höchstwert × Skala × Gewichtung) ÷ Σ Gewichtungen. Benötigte Note = (Ziel × (Σ Gewichtungen + g) − Schnitt × Σ Gewichtungen) ÷ g.",
  ),
  f2: l(
    "Conversions between scales are proportional (14/20 = 70 %). Grading cultures differ: a French 14/20 is a very good mark, a US 70 % is a C−. Letter grades use the common US scale (A ≥ 93, A− ≥ 90, B+ ≥ 87…).",
    "Les conversions entre barèmes sont proportionnelles (14/20 = 70 %). Les cultures de notation diffèrent : un 14/20 français est une très bonne note, un 70 % américain un C−. Les lettres suivent l'échelle US courante (A ≥ 93, A− ≥ 90, B+ ≥ 87…).",
    "Umrechnungen zwischen Skalen sind proportional (14/20 = 70 %). Notenkulturen unterscheiden sich: Ein französisches 14/20 ist eine sehr gute Note, 70 % in den USA ein C−. Buchstabennoten folgen der üblichen US-Skala (A ≥ 93, A− ≥ 90, B+ ≥ 87 …).",
  ),
  f3: l(
    "German grades go from 1 (sehr gut) to 6 (ungenügend), lower is better; + and − count for 0.3 (2− = 2.3). An average is cut after the first decimal (2.36 → 2.3) and up to x.5 counts as the better grade (1.5 = sehr gut). Oberstufe points: 15 = 1+, 14 = 1, 13 = 1− … 1 = 5−, 0 = 6; an average of P points is the grade (17 − P) ÷ 3, as for the Abitur. From a percentage, points follow the usual table (95 % → 15, 50 % → 6, 20 % → 1), which varies between states and schools.",
    "Les notes allemandes vont de 1 (sehr gut) à 6 (ungenügend), la plus basse est la meilleure ; + et − comptent pour 0,3 (2− = 2,3). Une moyenne est tronquée après la première décimale (2,36 → 2,3) et jusqu'à x,5 elle compte pour la meilleure note (1,5 = sehr gut). Points de l'Oberstufe : 15 = 1+, 14 = 1, 13 = 1− … 1 = 5−, 0 = 6 ; une moyenne de P points donne la note (17 − P) ÷ 3, comme pour l'Abitur. Depuis un pourcentage, les points suivent le barème courant (95 % → 15, 50 % → 6, 20 % → 1), qui varie selon les Länder et les écoles.",
    "Noten gehen von 1 (sehr gut) bis 6 (ungenügend), kleiner ist besser; + und − zählen 0,3 (2− = 2,3). Ein Schnitt wird nach der ersten Nachkommastelle abgeschnitten (2,36 → 2,3), bis x,5 zählt er zur besseren Note (1,5 = sehr gut). Oberstufenpunkte: 15 = 1+, 14 = 1, 13 = 1− … 1 = 5−, 0 = 6; ein Schnitt von P Punkten ergibt die Note (17 − P) ÷ 3 wie beim Abitur. Aus Prozent ergeben sich die Punkte nach der üblichen Tabelle (95 % → 15, 50 % → 6, 20 % → 1), die je nach Bundesland und Schule abweicht.",
  ),
};

const MENTION: Record<Mention, L10n> = {
  tb: l("Très bien (highest honours)", "Très bien", "Très bien (höchstes Prädikat)"),
  b: l("Bien (high honours)", "Bien", "Bien (hohes Prädikat)"),
  ab: l("Assez bien (honours)", "Assez bien", "Assez bien (Prädikat)"),
  pass: l("Pass", "Admis (sans mention)", "Bestanden"),
  fail: l("Below 10/20", "Sous la moyenne", "Unter 10/20"),
};

const DE_WORD: Record<1 | 2 | 3 | 4 | 5 | 6, L10n> = {
  1: l("sehr gut (very good)", "sehr gut (très bien)", "sehr gut"),
  2: l("gut (good)", "gut (bien)", "gut"),
  3: l("befriedigend (satisfactory)", "befriedigend (satisfaisant)", "befriedigend"),
  4: l("ausreichend (pass)", "ausreichend (passable)", "ausreichend"),
  5: l("mangelhaft (fail)", "mangelhaft (insuffisant)", "mangelhaft"),
  6: l("ungenügend (fail)", "ungenügend (très insuffisant)", "ungenügend"),
};

type Row = {
  label: string;
  value: string;
  outOf: string;
  coef: string;
};

type System = "scale" | "de";

const EXAMPLE: Row[] = [
  { label: "", value: "12", outOf: "", coef: "2" },
  { label: "", value: "15", outOf: "", coef: "1" },
  { label: "", value: "9", outOf: "", coef: "3" },
];

const EXAMPLE_DE: Row[] = [
  { label: "", value: "2", outOf: "", coef: "2" },
  { label: "", value: "1-", outOf: "", coef: "1" },
  { label: "", value: "3+", outOf: "", coef: "3" },
];

const same = (a: Row[], b: Row[]) => JSON.stringify(a) === JSON.stringify(b);

export default function Grades() {
  const system = useToolState<System>("system", "scale");
  const scale = useToolState("scale", 20);
  const rows = useToolState<Row[]>("rows", EXAMPLE);
  const target = useToolState("target", 12);
  const targetDe = useToolState("targetDe", 2.5);
  const nextCoef = useToolState("nextCoef", 2);
  const cv = useToolState("cv", 14);
  const cvFrom = useToolState("cvFrom", 20);

  const de = system.value === "de";
  const S = de ? DE_WORST : scale.value > 0 ? scale.value : 20;
  const grades: Grade[] = rows.value
    .filter((r) => r.value.trim() !== "")
    .map((r) => ({
      value: de ? (parseGermanGrade(r.value) ?? Number.NaN) : numOr(r.value, Number.NaN),
      outOf: de ? DE_WORST : numOr(r.outOf, S),
      coef: numOr(r.coef, 1),
    }));
  const avg = weightedAverage(grades, S);
  const need = de
    ? neededGermanGrade(grades, targetDe.value, nextCoef.value)
    : neededGrade(grades, S, target.value, nextCoef.value);
  const setRow = (i: number, patch: Partial<Row>) => {
    rows.value = rows.value.map((r, j) => (j === i ? { ...r, ...patch } : r));
  };
  const setSystem = (next: System, s?: number) => {
    // Swap the untouched example for one that makes sense on the other system.
    if (next === "de" && same(rows.value, EXAMPLE)) rows.value = EXAMPLE_DE;
    if (next === "scale" && same(rows.value, EXAMPLE_DE)) rows.value = EXAMPLE;
    system.value = next;
    if (s !== undefined) scale.value = s;
  };

  const germanItems = (points: number) => {
    const exact = Number.isInteger(points);
    const g = gradeFromAveragePoints(points);
    return [
      { label: tr(T.dePoints), value: `${num(points, 2)} / 15` },
      {
        label: tr(T.deGrade),
        value: exact
          ? `${markFromPoints(points)} · ${tr(DE_WORD[gradeFromPoints(points)])}`
          : `${num(truncate1(g), 1)} · ${tr(DE_WORD[germanBand(g)])}`,
      },
    ];
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
      // Oberstufe points are exact on a /15 scale, from the usual table otherwise.
      ...germanItems(from === 15 ? Math.min(15, Math.max(0, value)) : pointsFromPercent(pct)),
    ];
  };

  const germanAverage = (a: number) => [
    {
      label: tr(T.deReport),
      value: `${num(truncate1(a), 1)} · ${tr(DE_WORD[germanBand(a)])}`,
    },
    { label: tr(T.dePoints), value: `${num(pointsFromGrade(a), 1)} / 15` },
  ];

  const needValue = (g: number) => (de ? num(g, 2) : `${num(g, 2)} / ${num(S)}`);

  return (
    <>
      <div class="row">
        {!de && (
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
        )}
        {[20, 10, 100].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={!de && scale.value === s ? "primary" : "secondary"}
            onClick={() => setSystem("scale", s)}
          >
            /{s}
          </Button>
        ))}
        <Button
          size="sm"
          variant={!de && scale.value === 15 ? "primary" : "secondary"}
          onClick={() => setSystem("scale", 15)}
        >
          {tr(T.points15)}
        </Button>
        <Button size="sm" variant={de ? "primary" : "secondary"} onClick={() => setSystem("de")}>
          {tr(T.german)}
        </Button>
      </div>
      {de && <p class="muted small">{tr(T.deHint)}</p>}

      <Panel title={tr(T.grades)}>
        <div class="table-wrap">
          <table class="table grades-table">
            <thead>
              <tr>
                <th>{tr(T.subject)}</th>
                <th>{tr(T.grade)}</th>
                {!de && <th>{tr(T.outOf)}</th>}
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
                    {de ? (
                      <input
                        class="input grades-num"
                        type="text"
                        aria-label={tr(T.grade)}
                        aria-invalid={!!r.value.trim() && parseGermanGrade(r.value) === null}
                        placeholder="2−"
                        value={r.value}
                        onInput={(e) =>
                          setRow(i, { value: (e.currentTarget as HTMLInputElement).value })
                        }
                      />
                    ) : (
                      <NumText
                        hidden
                        class="grades-num"
                        label={tr(T.grade)}
                        value={r.value}
                        onInput={(v) => setRow(i, { value: v })}
                      />
                    )}
                  </td>
                  {!de && (
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
                  )}
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
              value={de ? num(avg, 2) : `${num(avg, 2)} / ${num(S)}`}
              copy={String(Math.round(avg * 100) / 100)}
              note={tr(T.weights).replace("{n}", num(totalWeight(grades), 2))}
            />
            <Stats items={de ? germanAverage(avg) : conversions(avg, S)} />
          </>
        )}
      </Panel>

      <Panel title={tr(T.needTitle)}>
        <div class="grid-2">
          {de ? (
            <NumberField
              label={`${tr(T.target)} (1–6)`}
              value={targetDe.value}
              min={1}
              max={DE_WORST}
              step="any"
              onChange={(v) => {
                targetDe.value = v;
              }}
            />
          ) : (
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
          )}
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
              <Result label={tr(de ? T.needDe : T.need)} value={needValue(need.grade)} />
              <Badge kind="warn">{tr(de ? T.impossibleDe : T.impossible)}</Badge>
            </>
          ) : (
            <Result label={tr(de ? T.needDe : T.need)} value={needValue(need.grade)} />
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
        <p>{tr(T.f3)}</p>
      </Formula>
    </>
  );
}
