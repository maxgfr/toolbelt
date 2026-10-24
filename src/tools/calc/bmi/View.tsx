import { Badge, NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { ErrorNote, Segmented } from "../../../app/ui";
import { type L10n, l, tr } from "../../../i18n";
import { Formula, num, Result } from "../_ui";
import {
  ACTIVITY,
  type Activity,
  bmi,
  bmr,
  CATEGORIES,
  type Category,
  category,
  cmToFeetInches,
  dailyCalories,
  feetInchesToCm,
  gaugePosition,
  healthyRange,
  LB,
  lbToKg,
  type Sex,
} from "./logic";

const T = {
  system: l("Units", "Unités"),
  metric: l("Metric (kg, cm)", "Métrique (kg, cm)"),
  imperial: l("Imperial (lb, ft)", "Impérial (lb, ft)"),
  weight: l("Weight", "Poids"),
  height: l("Height", "Taille"),
  feet: l("Height (feet)", "Taille (pieds)"),
  inches: l("and inches", "et pouces"),
  age: l("Age", "Âge"),
  sex: l("Sex (for the BMR formula)", "Sexe (pour la formule du métabolisme)"),
  male: l("Male", "Homme"),
  female: l("Female", "Femme"),
  activity: l("Activity", "Activité"),
  bmi: l("Body mass index (BMI)", "Indice de masse corporelle (IMC)"),
  range: l("Weight range for a BMI of 18.5–24.9", "Poids pour un IMC de 18,5 à 24,9"),
  bmr: l("Basal metabolic rate", "Métabolisme de base"),
  bmrHint: l("energy used at rest", "énergie dépensée au repos"),
  daily: l("Daily calories to keep your weight", "Calories par jour pour garder ton poids"),
  perDay: l("kcal/day", "kcal/jour"),
  bad: l("Type a weight and a height.", "Tape un poids et une taille."),
  child: l(
    "Under 18, BMI is read on age- and sex-specific growth charts: these adult categories don't apply.",
    "Avant 18 ans, l'IMC se lit sur des courbes de croissance selon l'âge et le sexe : ces catégories adultes ne s'appliquent pas.",
  ),
  note: l(
    "BMI is a rough indicator for adults: it doesn't tell muscle from fat, nor where fat is, and doesn't account for age, sex or build. It is not a diagnosis; a health professional can give a fuller picture.",
    "L'IMC est un indicateur approximatif pour les adultes : il ne distingue pas muscle et graisse, ni leur répartition, et ne tient compte ni de l'âge, ni du sexe, ni de la morphologie. Ce n'est pas un diagnostic ; un professionnel de santé peut donner une vue plus complète.",
  ),
  f1: l(
    "BMI = weight (kg) ÷ height (m)². Categories: WHO, adults.",
    "IMC = poids (kg) ÷ taille (m)². Catégories : OMS, adultes.",
  ),
  f2: l(
    "Basal metabolic rate (Mifflin–St Jeor): 10 × kg + 6.25 × cm − 5 × age, + 5 for men or − 161 for women. Daily needs = BMR × activity factor.",
    "Métabolisme de base (Mifflin–St Jeor) : 10 × kg + 6,25 × cm − 5 × âge, + 5 pour un homme ou − 161 pour une femme. Besoins quotidiens = métabolisme × facteur d'activité.",
  ),
};

const CAT: Record<Category, L10n> = {
  under: l("Underweight", "Insuffisance pondérale"),
  normal: l("Normal range", "Corpulence normale"),
  over: l("Overweight", "Surpoids"),
  obese1: l("Obesity (class I)", "Obésité modérée (classe I)"),
  obese2: l("Obesity (class II)", "Obésité sévère (classe II)"),
  obese3: l("Obesity (class III)", "Obésité massive (classe III)"),
};

const ACT: Record<Activity, L10n> = {
  sedentary: l("Sedentary (little or no exercise)", "Sédentaire (peu ou pas de sport)"),
  light: l("Light (1–3 days a week)", "Légère (1 à 3 jours par semaine)"),
  moderate: l("Moderate (3–5 days a week)", "Modérée (3 à 5 jours par semaine)"),
  active: l("Active (6–7 days a week)", "Active (6 à 7 jours par semaine)"),
  very: l(
    "Very active (physical job, twice a day)",
    "Très active (métier physique, 2 fois par jour)",
  ),
};

type System = "metric" | "imperial";

export default function Bmi() {
  const system = useToolState<System>("system", "metric");
  const kg = useToolState("kg", 70);
  const cm = useToolState("cm", 175);
  const lb = useToolState("lb", 154);
  const ft = useToolState("ft", 5);
  const inch = useToolState("in", 9);
  const age = useToolState("age", 30);
  const sex = useToolState<Sex>("sex", "female");
  const activity = useToolState<Activity>("activity", "light");

  const imperial = system.value === "imperial";
  const w = imperial ? lbToKg(lb.value) : kg.value;
  const h = imperial ? feetInchesToCm(ft.value, inch.value) : cm.value;
  const value = bmi(w, h);
  const range = healthyRange(h);
  const base = bmr(w, h, age.value, sex.value);
  const weight = (k: number) => (imperial ? `${num(k / LB, 0)} lb` : `${num(k, 1)} kg`);

  return (
    <>
      <Segmented<System>
        label={tr(T.system)}
        value={system.value}
        onChange={(v) => {
          if (v === system.value) return;
          if (v === "imperial") {
            lb.value = Math.round(kg.value / LB);
            const fi = cmToFeetInches(cm.value);
            ft.value = fi.feet;
            inch.value = Math.round(fi.inches);
          } else {
            kg.value = Math.round(lbToKg(lb.value) * 10) / 10;
            cm.value = Math.round(feetInchesToCm(ft.value, inch.value));
          }
          system.value = v;
        }}
        options={[
          { value: "metric", label: tr(T.metric) },
          { value: "imperial", label: tr(T.imperial) },
        ]}
      />
      <div class="grid-3">
        {imperial ? (
          <>
            <NumberField
              label={tr(T.weight)}
              value={lb.value}
              min={1}
              max={1500}
              step="any"
              suffix="lb"
              onChange={(v) => {
                lb.value = v;
              }}
            />
            <div class="bmi-feet">
              <NumberField
                label={tr(T.feet)}
                value={ft.value}
                min={0}
                max={9}
                integer
                suffix="ft"
                onChange={(v) => {
                  ft.value = v;
                }}
              />
              <NumberField
                label={tr(T.inches)}
                value={inch.value}
                min={0}
                max={11.99}
                step="any"
                suffix="in"
                onChange={(v) => {
                  inch.value = v;
                }}
              />
            </div>
          </>
        ) : (
          <>
            <NumberField
              label={tr(T.weight)}
              value={kg.value}
              min={1}
              max={700}
              step="any"
              suffix="kg"
              onChange={(v) => {
                kg.value = v;
              }}
            />
            <NumberField
              label={tr(T.height)}
              value={cm.value}
              min={30}
              max={280}
              step="any"
              suffix="cm"
              onChange={(v) => {
                cm.value = v;
              }}
            />
          </>
        )}
        <NumberField
          label={tr(T.age)}
          value={age.value}
          min={1}
          max={130}
          integer
          onChange={(v) => {
            age.value = v;
          }}
        />
        <Select<Sex>
          label={tr(T.sex)}
          value={sex.value}
          onChange={(v) => {
            sex.value = v;
          }}
          options={[
            { value: "female", label: tr(T.female) },
            { value: "male", label: tr(T.male) },
          ]}
        />
        <Select<Activity>
          label={tr(T.activity)}
          value={activity.value}
          onChange={(v) => {
            activity.value = v;
          }}
          options={(Object.keys(ACTIVITY) as Activity[]).map((a) => ({
            value: a,
            label: tr(ACT[a]),
          }))}
        />
      </div>

      {value === null ? (
        <ErrorNote error={tr(T.bad)} />
      ) : (
        <>
          <Result
            label={tr(T.bmi)}
            value={num(value, 1)}
            note={
              age.value >= 18 ? (
                <Badge kind={category(value) === "normal" ? "ok" : "info"}>
                  {tr(CAT[category(value)])}
                </Badge>
              ) : undefined
            }
          />
          {age.value < 18 && <p class="bmi-note small">{tr(T.child)}</p>}
          <div class="bmi-gauge" aria-hidden="true">
            {CATEGORIES.map((c) => {
              const lo = Math.max(15, c.min);
              const hi = Math.min(40, c.max);
              return (
                <span
                  key={c.id}
                  class={`bmi-seg bmi-${c.id}`}
                  style={{ flexGrow: Math.max(0, hi - lo) }}
                  title={tr(CAT[c.id])}
                />
              );
            })}
            <i class="bmi-marker" style={{ left: `${gaugePosition(value) * 100}%` }} />
          </div>
          <div class="bmi-scale small muted" aria-hidden="true">
            {[15, 18.5, 25, 30, 35, 40].map((t) => (
              <span key={t} style={{ left: `${gaugePosition(t) * 100}%` }}>
                {num(t, 1)}
              </span>
            ))}
          </div>
          <div class="grid-3">
            {range && (
              <Result label={tr(T.range)} value={`${weight(range.min)} – ${weight(range.max)}`} />
            )}
            {base !== null && (
              <Result
                label={tr(T.bmr)}
                value={`${num(base, 0)} ${tr(T.perDay)}`}
                note={tr(T.bmrHint)}
              />
            )}
            {base !== null && (
              <Result
                label={tr(T.daily)}
                value={`${num(dailyCalories(base, activity.value), 0)} ${tr(T.perDay)}`}
                note={tr(ACT[activity.value])}
              />
            )}
          </div>
        </>
      )}
      <p class="bmi-note small">{tr(T.note)}</p>
      <Formula>
        <p>{tr(T.f1)}</p>
        <p>{tr(T.f2)}</p>
      </Formula>
    </>
  );
}
