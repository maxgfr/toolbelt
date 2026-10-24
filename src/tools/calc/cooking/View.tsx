import { NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Panel, Segmented, TextBox } from "../../../app/ui";
import { type L10n, l, lang, tr } from "../../../i18n";
import { Formula, num } from "../_ui";
import {
  convertKitchen,
  cToF,
  fToC,
  GAS_MARKS,
  gasMark,
  gasToF,
  INGREDIENTS,
  KITCHEN_UNITS,
  kitchenUnit,
  scaleRecipe,
  thermostat,
  toFraction,
} from "./logic";

const T = {
  tab: l("Tool", "Outil"),
  convert: l("Cups, spoons, grams", "Tasses, cuillères, grammes"),
  oven: l("Oven temperature", "Température du four"),
  scale: l("Scale a recipe", "Adapter une recette"),
  amount: l("Amount", "Quantité"),
  from: l("Unit", "Unité"),
  ingredient: l("Ingredient", "Ingrédient"),
  ingredientHint: l("Needed between volume and weight", "Nécessaire entre volume et poids"),
  volume: l("Volume", "Volume"),
  weight: l("Weight", "Poids"),
  temp: l("Temperature", "Température"),
  scaleUnit: l("Scale", "Échelle"),
  celsius: l("°C", "°C"),
  fahrenheit: l("°F", "°F"),
  gas: l("Gas mark", "Gas mark (four à gaz UK)"),
  th: l("French thermostat", "Thermostat"),
  table: l("Common oven settings", "Réglages courants du four"),
  servingsFrom: l("Recipe serves", "Recette pour"),
  servingsTo: l("I want to serve", "Je veux servir"),
  people: l("people", "personnes"),
  factor: l("× {f}", "× {f}"),
  recipe: l("Ingredients (one per line)", "Ingrédients (un par ligne)"),
  scaled: l("Scaled", "Adaptée"),
  note: l(
    "Quantities at the start of each line are scaled: 250, 1.5, 1 ½, 3/4, 2-3. Lines without a number stay as they are.",
    "Les quantités en début de ligne sont adaptées : 250, 1,5, 1 ½, 3/4, 2-3. Les lignes sans nombre restent telles quelles.",
  ),
  f1: l(
    "Volume ↔ weight uses a typical density (g per ml) for each ingredient: a cup of flour weighs about 125 g, a cup of sugar about 200 g. Spooned and levelled, not packed: results are kitchen-accurate, not lab-accurate.",
    "Volume ↔ poids utilise une densité typique (g par ml) pour chaque ingrédient : une tasse de farine pèse environ 125 g, une tasse de sucre environ 200 g. Versé à la cuillère et arasé, pas tassé : précision de cuisine, pas de laboratoire.",
  ),
  f2: l(
    "Spoons: 1 tsp = 5 ml, 1 tbsp = 15 ml. Cups: US 236.6 ml, metric 250 ml. °F = °C × 9/5 + 32; gas mark 1 = 275 °F, +25 °F per mark; French thermostat = °C ÷ 30.",
    "Cuillères : 1 c. à café = 5 ml, 1 c. à soupe = 15 ml. Tasses : US 236,6 ml, métrique 250 ml. °F = °C × 9/5 + 32 ; gas mark 1 = 275 °F, +25 °F par cran ; thermostat = °C ÷ 30.",
  ),
};

const UNIT_NAME: Record<string, L10n> = {
  ml: l("ml", "ml"),
  cl: l("cl", "cl"),
  dl: l("dl", "dl"),
  l: l("L", "L"),
  tsp: l("teaspoon (5 ml)", "cuillère à café (5 ml)"),
  tbsp: l("tablespoon (15 ml)", "cuillère à soupe (15 ml)"),
  cup: l("cup (US, 237 ml)", "tasse US (237 ml)"),
  cupMetric: l("cup (metric, 250 ml)", "tasse métrique (250 ml)"),
  floz: l("fl oz (US)", "fl oz (US)"),
  g: l("g", "g"),
  kg: l("kg", "kg"),
  oz: l("oz", "once (oz)"),
  lb: l("lb", "livre (lb)"),
};

const SPOONS = new Set(["tsp", "tbsp", "cup", "cupMetric"]);

type Tab = "convert" | "oven" | "scale";
type TempUnit = "c" | "f" | "gas" | "th";

const RECIPE: L10n = l(
  "250 g flour\n1 ½ cups milk\n3 eggs\n2-3 tbsp sugar\n1/2 tsp vanilla extract\nA pinch of salt",
  "250 g de farine\n50 cl de lait\n3 œufs\n2-3 c. à soupe de sucre\n1/2 c. à café de vanille\nUne pincée de sel",
);

export default function Cooking() {
  const tab = useToolState<Tab>("tab", "convert");
  return (
    <>
      <Segmented<Tab>
        label={tr(T.tab)}
        value={tab.value}
        onChange={(v) => {
          tab.value = v;
        }}
        options={[
          { value: "convert", label: tr(T.convert) },
          { value: "oven", label: tr(T.oven) },
          { value: "scale", label: tr(T.scale) },
        ]}
      />
      {tab.value === "convert" ? <Convert /> : tab.value === "oven" ? <Oven /> : <Scale />}
      <Formula>
        <p>{tr(T.f1)}</p>
        <p>{tr(T.f2)}</p>
      </Formula>
    </>
  );
}

function Convert() {
  const amount = useToolState("amount", 1);
  const from = useToolState("from", "cup");
  const ingredient = useToolState("ingredient", "flour");
  const value = (to: string) => convertKitchen(amount.value, from.value, to, ingredient.value);
  const show = (id: string) => {
    const v = value(id);
    return SPOONS.has(id) && v >= 0.1 && v < 20
      ? `${num(v, 2)} (≈ ${toFraction(v)})`
      : num(v, v < 10 ? 2 : 1);
  };
  const column = (dim: "volume" | "mass", title: string) => (
    <Panel title={title}>
      <table class="table cooking-table">
        <tbody>
          {KITCHEN_UNITS.filter((u) => u.dim === dim).map((u) => (
            <tr key={u.id} class={u.id === from.value ? "cooking-on" : ""}>
              <td>{tr(UNIT_NAME[u.id] ?? l(u.id, u.id))}</td>
              <td class="num mono">{show(u.id)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
  return (
    <>
      <div class="grid-3">
        <NumberField
          label={tr(T.amount)}
          value={amount.value}
          min={0}
          step="any"
          onChange={(v) => {
            amount.value = v;
          }}
        />
        <Select
          label={tr(T.from)}
          value={kitchenUnit(from.value).id}
          onChange={(v) => {
            from.value = v;
          }}
          options={KITCHEN_UNITS.map((u) => ({
            value: u.id,
            label: tr(UNIT_NAME[u.id] ?? l(u.id, u.id)),
          }))}
        />
        <Select
          label={tr(T.ingredient)}
          hint={tr(T.ingredientHint)}
          value={ingredient.value}
          onChange={(v) => {
            ingredient.value = v;
          }}
          options={INGREDIENTS.map((i) => ({
            value: i.id,
            label: `${tr(i)} · ${num(i.density, 2)} g/ml`,
          }))}
        />
      </div>
      <div class="grid-2">
        {column("volume", tr(T.volume))}
        {column("mass", tr(T.weight))}
      </div>
    </>
  );
}

function Oven() {
  const temp = useToolState("temp", 180);
  const unit = useToolState<TempUnit>("tempUnit", "c");
  const c =
    unit.value === "c"
      ? temp.value
      : unit.value === "f"
        ? fToC(temp.value)
        : unit.value === "gas"
          ? fToC(gasToF(temp.value))
          : temp.value * 30;
  const gm = gasMark(c);
  const gasLabel = (g: number) => (g === 0.25 ? "¼" : g === 0.5 ? "½" : String(g));
  return (
    <>
      <div class="grid-3">
        <NumberField
          label={tr(T.temp)}
          value={temp.value}
          min={0}
          max={1000}
          step="any"
          onChange={(v) => {
            temp.value = v;
          }}
        />
        <Select<TempUnit>
          label={tr(T.scaleUnit)}
          value={unit.value}
          onChange={(v) => {
            unit.value = v;
          }}
          options={[
            { value: "c", label: tr(T.celsius) },
            { value: "f", label: tr(T.fahrenheit) },
            { value: "gas", label: tr(T.gas) },
            { value: "th", label: tr(T.th) },
          ]}
        />
      </div>
      <dl class="stats">
        <div class="stat">
          <dt>°C</dt>
          <dd>{num(c, 0)} °C</dd>
        </div>
        <div class="stat">
          <dt>°F</dt>
          <dd>{num(cToF(c), 0)} °F</dd>
        </div>
        <div class="stat">
          <dt>{tr(T.gas)}</dt>
          <dd>{gm === null ? "—" : gasLabel(gm)}</dd>
        </div>
        <div class="stat">
          <dt>{tr(T.th)}</dt>
          <dd>{lang.value === "fr" ? `th. ${num(thermostat(c), 1)}` : num(thermostat(c), 1)}</dd>
        </div>
      </dl>
      <Panel title={tr(T.table)}>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{tr(T.gas)}</th>
                <th class="num">°F</th>
                <th class="num">°C</th>
                <th class="num">{tr(T.th)}</th>
              </tr>
            </thead>
            <tbody>
              {GAS_MARKS.map((g) => {
                const f = gasToF(g);
                const cc = fToC(f);
                return (
                  <tr key={g} class={gm === g ? "cooking-on" : ""}>
                    <td>{gasLabel(g)}</td>
                    <td class="num">{f}</td>
                    <td class="num">{num(Math.round(cc / 5) * 5, 0)}</td>
                    <td class="num">{num(thermostat(cc), 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function Scale() {
  const text = useToolState("recipe", tr(RECIPE));
  const fromN = useToolState("servingsFrom", 4);
  const toN = useToolState("servingsTo", 6);
  const factor = fromN.value > 0 ? toN.value / fromN.value : Number.NaN;
  const out = scaleRecipe(text.value, factor, lang.value === "fr");
  return (
    <>
      <div class="grid-3">
        <NumberField
          label={tr(T.servingsFrom)}
          value={fromN.value}
          min={1}
          max={1000}
          step="any"
          suffix={tr(T.people)}
          onChange={(v) => {
            fromN.value = v;
          }}
        />
        <NumberField
          label={tr(T.servingsTo)}
          value={toN.value}
          min={0}
          max={1000}
          step="any"
          suffix={tr(T.people)}
          onChange={(v) => {
            toN.value = v;
          }}
        />
        <div class="cooking-factor">
          <strong>{tr(T.factor).replace("{f}", num(factor, 3))}</strong>
        </div>
      </div>
      <div class="grid-2">
        <TextBox
          label={tr(T.recipe)}
          value={text.value}
          onInput={(v) => {
            text.value = v;
          }}
          rows={10}
          mono={false}
          files={false}
        />
        <TextBox
          label={tr(T.scaled)}
          value={out.map((x) => x.text).join("\n")}
          readOnly
          rows={10}
          mono={false}
        />
      </div>
      <p class="muted small">{tr(T.note)}</p>
    </>
  );
}
