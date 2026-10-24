import { NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { ErrorNote, Panel, Segmented, Stats, Toggle } from "../../../app/ui";
import { type L10n, l, tr } from "../../../i18n";
import {
  CurrencySelect,
  currencySymbol,
  Formula,
  money,
  num,
  plain,
  Result,
  useCurrency,
} from "../_ui";
import {
  type EvUnit,
  type FuelUnit,
  fromKwh100,
  fromL100,
  KM_PER_MILE,
  L_PER_UK_GAL,
  L_PER_US_GAL,
  measured,
  type PriceUnit,
  pricePerBase,
  toKwh100,
  toL100,
  trip,
} from "./logic";

const T = {
  kind: l("Vehicle", "Véhicule"),
  fuel: l("Petrol / diesel", "Essence / diesel"),
  ev: l("Electric", "Électrique"),
  distance: l("Distance", "Distance"),
  distUnit: l("Distance unit", "Unité de distance"),
  roundTrip: l("Round trip (× 2)", "Aller-retour (× 2)"),
  consumption: l("Consumption", "Consommation"),
  consUnit: l("Consumption unit", "Unité de consommation"),
  price: l("Price", "Prix"),
  priceUnit: l("Per", "Par"),
  people: l("People sharing", "Personnes qui partagent"),
  cost: l("Trip cost", "Coût du trajet"),
  perPerson: l("Per person", "Par personne"),
  needed: l("Fuel needed", "Carburant nécessaire"),
  neededEv: l("Energy needed", "Énergie nécessaire"),
  perKm: l("Cost per km", "Coût au km"),
  perMi: l("Cost per mile", "Coût par mile"),
  bad: l(
    "Type a consumption above 0 and at least 1 person.",
    "Tape une consommation supérieure à 0 et au moins 1 personne.",
  ),
  same: l("Same consumption in other units", "La même consommation dans d'autres unités"),
  measure: l("Measure your real consumption", "Mesurer ta consommation réelle"),
  measureHint: l(
    "Fill the tank, reset the trip counter, drive, fill up again: type the amount refilled and the distance driven.",
    "Fais le plein, remets le compteur à zéro, roule, refais le plein : tape la quantité remise et la distance parcourue.",
  ),
  refilled: l("Litres refilled", "Litres remis"),
  charged: l("kWh charged", "kWh rechargés"),
  driven: l("Distance driven (km)", "Distance parcourue (km)"),
  result: l("Your consumption", "Ta consommation"),
  f1: l(
    "Fuel = distance × consumption ÷ 100; cost = fuel × price; per person = cost ÷ people.",
    "Carburant = distance × consommation ÷ 100 ; coût = carburant × prix ; par personne = coût ÷ personnes.",
  ),
  f2: l(
    "mpg (US) = 235.215 ÷ L/100 km; mpg (UK) = 282.481 ÷ L/100 km; km/L = 100 ÷ L/100 km. 1 mile = 1.609 km, 1 US gallon = 3.785 L, 1 UK gallon = 4.546 L.",
    "mpg (US) = 235,215 ÷ L/100 km ; mpg (UK) = 282,481 ÷ L/100 km ; km/L = 100 ÷ L/100 km. 1 mile = 1,609 km, 1 gallon US = 3,785 L, 1 gallon UK = 4,546 L.",
  ),
  f3: l(
    "For an electric car, add charging losses (often 10–15 %) to the consumption shown by the car if you pay at the plug.",
    "Pour une voiture électrique, ajoute les pertes de recharge (souvent 10 à 15 %) à la consommation affichée par la voiture si tu paies à la prise.",
  ),
};

const FUEL_UNITS: { id: FuelUnit; label: L10n }[] = [
  { id: "l100", label: l("L/100 km", "L/100 km") },
  { id: "kmL", label: l("km/L", "km/L") },
  { id: "mpgUS", label: l("mpg (US)", "mpg (US)") },
  { id: "mpgUK", label: l("mpg (UK)", "mpg (UK)") },
];
const EV_UNITS: { id: EvUnit; label: L10n }[] = [
  { id: "kwh100", label: l("kWh/100 km", "kWh/100 km") },
  { id: "whkm", label: l("Wh/km", "Wh/km") },
  { id: "miKwh", label: l("mi/kWh", "mi/kWh") },
  { id: "kwh100mi", label: l("kWh/100 mi", "kWh/100 mi") },
];
const PRICE_UNITS: { id: PriceUnit; label: L10n }[] = [
  { id: "L", label: l("litre", "litre") },
  { id: "galUS", label: l("US gallon", "gallon US") },
  { id: "galUK", label: l("UK gallon", "gallon UK") },
];

type Kind = "fuel" | "ev";

export default function Fuel() {
  const cur = useCurrency();
  const kind = useToolState<Kind>("kind", "fuel");
  const distance = useToolState("distance", 450);
  const distUnit = useToolState<"km" | "mi">("distUnit", "km");
  const round = useToolState("roundTrip", false);
  const cons = useToolState("cons", 6.5);
  const consUnit = useToolState<FuelUnit>("consUnit", "l100");
  const evCons = useToolState("evCons", 17);
  const evUnit = useToolState<EvUnit>("evUnit", "kwh100");
  const price = useToolState("price", 1.85);
  const priceUnit = useToolState<PriceUnit>("priceUnit", "L");
  const kwhPrice = useToolState("kwhPrice", 0.25);
  const people = useToolState("people", 1);
  const mFuel = useToolState("mFuel", 42);
  const mKm = useToolState("mKm", 700);

  const ev = kind.value === "ev";
  const per100 = ev ? toKwh100(evCons.value, evUnit.value) : toL100(cons.value, consUnit.value);
  const km = distUnit.value === "mi" ? distance.value * KM_PER_MILE : distance.value;
  const unitPrice = ev ? kwhPrice.value : pricePerBase(price.value, priceUnit.value);
  const r =
    per100 === null
      ? null
      : trip({
          distance: km,
          per100,
          price: unitPrice,
          people: people.value,
          roundTrip: round.value,
        });
  const m = (n: number) => money(n, cur.code);
  const sym = currencySymbol(cur.code);
  const mine = measured(mFuel.value, mKm.value);

  const energyText = (x: number) =>
    ev
      ? `${num(x, 1)} kWh`
      : priceUnit.value === "L"
        ? `${num(x, 1)} L`
        : `${num(x, 1)} L · ${num(x / (priceUnit.value === "galUS" ? L_PER_US_GAL : L_PER_UK_GAL), 2)} gal`;

  return (
    <>
      <Segmented<Kind>
        label={tr(T.kind)}
        value={kind.value}
        onChange={(v) => {
          kind.value = v;
        }}
        options={[
          { value: "fuel", label: tr(T.fuel) },
          { value: "ev", label: tr(T.ev) },
        ]}
      />
      <div class="grid-3">
        <div class="fuel-pair">
          <NumberField
            label={tr(T.distance)}
            value={distance.value}
            min={0}
            step="any"
            onChange={(v) => {
              distance.value = v;
            }}
          />
          <Select<"km" | "mi">
            label={tr(T.distUnit)}
            value={distUnit.value}
            onChange={(v) => {
              distUnit.value = v;
            }}
            options={[
              { value: "km", label: "km" },
              { value: "mi", label: "miles" },
            ]}
          />
        </div>
        {ev ? (
          <div class="fuel-pair">
            <NumberField
              label={tr(T.consumption)}
              value={evCons.value}
              min={0}
              step="any"
              onChange={(v) => {
                evCons.value = v;
              }}
            />
            <Select<EvUnit>
              label={tr(T.consUnit)}
              value={evUnit.value}
              onChange={(v) => {
                const k = toKwh100(evCons.value, evUnit.value);
                const next = k === null ? null : fromKwh100(k, v);
                if (next !== null) evCons.value = Number(next.toFixed(2));
                evUnit.value = v;
              }}
              options={EV_UNITS.map((u) => ({ value: u.id, label: tr(u.label) }))}
            />
          </div>
        ) : (
          <div class="fuel-pair">
            <NumberField
              label={tr(T.consumption)}
              value={cons.value}
              min={0}
              step="any"
              onChange={(v) => {
                cons.value = v;
              }}
            />
            <Select<FuelUnit>
              label={tr(T.consUnit)}
              value={consUnit.value}
              onChange={(v) => {
                const k = toL100(cons.value, consUnit.value);
                const next = k === null ? null : fromL100(k, v);
                if (next !== null) cons.value = Number(next.toFixed(2));
                consUnit.value = v;
              }}
              options={FUEL_UNITS.map((u) => ({ value: u.id, label: tr(u.label) }))}
            />
          </div>
        )}
        {ev ? (
          <NumberField
            label={`${tr(T.price)} / kWh`}
            value={kwhPrice.value}
            min={0}
            step="any"
            suffix={sym}
            onChange={(v) => {
              kwhPrice.value = v;
            }}
          />
        ) : (
          <div class="fuel-pair">
            <NumberField
              label={tr(T.price)}
              value={price.value}
              min={0}
              step="any"
              suffix={sym}
              onChange={(v) => {
                price.value = v;
              }}
            />
            <Select<PriceUnit>
              label={tr(T.priceUnit)}
              value={priceUnit.value}
              onChange={(v) => {
                priceUnit.value = v;
              }}
              options={PRICE_UNITS.map((u) => ({ value: u.id, label: tr(u.label) }))}
            />
          </div>
        )}
        <NumberField
          label={tr(T.people)}
          value={people.value}
          min={1}
          max={100}
          integer
          onChange={(v) => {
            people.value = v;
          }}
        />
        <CurrencySelect cur={cur} />
      </div>
      <Toggle
        checked={round.value}
        onChange={(v) => {
          round.value = v;
        }}
        label={tr(T.roundTrip)}
      />

      {!r || per100 === null ? (
        <ErrorNote error={tr(T.bad)} />
      ) : (
        <>
          <div class="grid-2">
            <Result label={tr(T.cost)} value={m(r.cost)} copy={plain(r.cost)} />
            {people.value > 1 && (
              <Result label={tr(T.perPerson)} value={m(r.perPerson)} copy={plain(r.perPerson)} />
            )}
          </div>
          <Stats
            items={[
              { label: tr(ev ? T.neededEv : T.needed), value: energyText(r.energy) },
              distUnit.value === "mi"
                ? { label: tr(T.perMi), value: money(r.perKm * KM_PER_MILE, cur.code, 3) }
                : { label: tr(T.perKm), value: money(r.perKm, cur.code, 3) },
            ]}
          />
          <div class="stack">
            <span class="muted small">{tr(T.same)}</span>
            <div class="fuel-units">
              {ev
                ? EV_UNITS.map((u) => (
                    <span key={u.id} class={u.id === evUnit.value ? "on" : ""}>
                      <strong>{num(fromKwh100(per100, u.id) ?? Number.NaN, 2)}</strong>{" "}
                      {tr(u.label)}
                    </span>
                  ))
                : FUEL_UNITS.map((u) => (
                    <span key={u.id} class={u.id === consUnit.value ? "on" : ""}>
                      <strong>{num(fromL100(per100, u.id) ?? Number.NaN, 2)}</strong> {tr(u.label)}
                    </span>
                  ))}
            </div>
          </div>
        </>
      )}

      <Panel title={tr(T.measure)}>
        <p class="muted small">{tr(T.measureHint)}</p>
        <div class="grid-3">
          <NumberField
            label={tr(ev ? T.charged : T.refilled)}
            value={mFuel.value}
            min={0}
            step="any"
            onChange={(v) => {
              mFuel.value = v;
            }}
          />
          <NumberField
            label={tr(T.driven)}
            value={mKm.value}
            min={0}
            step="any"
            onChange={(v) => {
              mKm.value = v;
            }}
          />
          <Result
            label={tr(T.result)}
            value={mine === null ? "—" : `${num(mine, 2)} ${ev ? "kWh/100 km" : "L/100 km"}`}
            copy={mine === null ? "" : plain(mine)}
          />
        </div>
      </Panel>
      <Formula>
        <p>{tr(T.f1)}</p>
        <p>{tr(T.f2)}</p>
        {ev && <p>{tr(T.f3)}</p>}
      </Formula>
    </>
  );
}
