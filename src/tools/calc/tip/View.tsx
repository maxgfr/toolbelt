import { NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, ErrorNote, IconButton, Segmented, Stats } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import {
  CurrencySelect,
  currencySymbol,
  Formula,
  money,
  NumText,
  numOr,
  pct,
  plain,
  Result,
  useCurrency,
} from "../_ui";
import { splitEven, splitUneven } from "./logic";

const T = {
  bill: l("Bill", "Addition", "Rechnung"),
  tip: l("Tip", "Pourboire", "Trinkgeld"),
  custom: l("Custom tip", "Pourboire personnalisé", "Eigenes Trinkgeld"),
  people: l("People", "Personnes", "Personen"),
  round: l(
    "Round each share up to",
    "Arrondir chaque part au-dessus à",
    "Jeden Anteil aufrunden auf",
  ),
  noRound: l("No rounding", "Pas d'arrondi", "Nicht runden"),
  split: l("Split", "Partage", "Aufteilung"),
  even: l("Equally", "À parts égales", "Gleichmäßig"),
  uneven: l("Each pays what they had", "Chacun paie ce qu'il a pris", "Jeder zahlt, was er hatte"),
  perPerson: l("Each person pays", "Chacun paie", "Jede Person zahlt"),
  tipAmount: l("Tip", "Pourboire", "Trinkgeld"),
  total: l("Total", "Total", "Gesamt"),
  roundedTip: l("Tip after rounding", "Pourboire après arrondi", "Trinkgeld nach dem Runden"),
  name: l("Name", "Nom", "Name"),
  own: l("Their items", "Ses plats", "Eigene Posten"),
  shared: l("Shared part", "Part commune", "Gemeinsamer Anteil"),
  pays: l("Pays", "Paie", "Zahlt"),
  add: l("Add a person", "Ajouter une personne", "Person hinzufügen"),
  remove: l("Remove", "Retirer", "Entfernen"),
  person: l("Person", "Personne", "Person"),
  unclaimed: l(
    "Not claimed by anyone, split equally: {v}",
    "Non attribué, partagé à parts égales : {v}",
    "Niemandem zugeordnet, gleichmäßig geteilt: {v}",
  ),
  over: l(
    "People's items add up to {v} more than the bill.",
    "Les plats déclarés dépassent l'addition de {v}.",
    "Die eingetragenen Posten ergeben {v} mehr als die Rechnung.",
  ),
  bad: l(
    "Check the bill and the number of people.",
    "Vérifie l'addition et le nombre de personnes.",
    "Prüf die Rechnung und die Zahl der Personen.",
  ),
  f1: l(
    "Tip = bill × tip %. Each share = (bill + tip) ÷ people, rounded up if you chose so; the rounding goes to the tip.",
    "Pourboire = addition × % de pourboire. Chaque part = (addition + pourboire) ÷ personnes, arrondie au-dessus si demandé ; l'arrondi s'ajoute au pourboire.",
    "Trinkgeld = Rechnung × Trinkgeld-%. Jeder Anteil = (Rechnung + Trinkgeld) ÷ Personen, aufgerundet, wenn gewählt; die Rundung geht ins Trinkgeld.",
  ),
  f2: l(
    "Uneven split: each person pays their own items plus an equal part of what nobody claimed; the tip is shared in proportion.",
    "Partage inégal : chacun paie ses plats plus une part égale de ce qui n'est à personne ; le pourboire est réparti au prorata.",
    "Nach Verzehr: Jede Person zahlt ihre eigenen Posten plus einen gleichen Teil dessen, was niemandem zugeordnet ist; das Trinkgeld wird anteilig verteilt.",
  ),
};

const PRESETS = [0, 5, 10, 12, 15, 18, 20, 25];
type Mode = "even" | "uneven";
type P = {
  name: string;
  own: string;
};

export default function Tip() {
  const cur = useCurrency();
  const bill = useToolState("bill", 84);
  const tipPct = useToolState("tipPct", 10);
  const people = useToolState("people", 4);
  const roundTo = useToolState("roundTo", "0");
  const mode = useToolState<Mode>("mode", "even");
  const list = useToolState<P[]>("list", [
    { name: "", own: "30" },
    { name: "", own: "25" },
  ]);
  const m = (n: number) => money(n, cur.code);
  const sym = currencySymbol(cur.code);

  const even = splitEven({
    bill: bill.value,
    tipPct: tipPct.value,
    people: people.value,
    roundTo: Number(roundTo.value),
  });
  const uneven = splitUneven(
    bill.value,
    tipPct.value,
    list.value.map((p) => ({ name: p.name, own: numOr(p.own, 0) })),
  );
  const setP = (i: number, patch: Partial<P>) => {
    list.value = list.value.map((p, j) => (j === i ? { ...p, ...patch } : p));
  };

  return (
    <>
      <div class="grid-3">
        <NumberField
          label={tr(T.bill)}
          value={bill.value}
          min={0}
          step="any"
          suffix={sym}
          onChange={(v) => {
            bill.value = v;
          }}
        />
        <NumberField
          label={tr(T.custom)}
          value={tipPct.value}
          min={0}
          max={100}
          step="any"
          suffix="%"
          onChange={(v) => {
            tipPct.value = v;
          }}
        />
        <CurrencySelect cur={cur} />
      </div>
      <fieldset class="tip-presets">
        <legend class="sr-only">{tr(T.tip)}</legend>
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            class={`tip-preset ${tipPct.value === p ? "on" : ""}`}
            aria-pressed={tipPct.value === p}
            onClick={() => {
              tipPct.value = p;
            }}
          >
            {pct(p)}
          </button>
        ))}
      </fieldset>
      <Segmented<Mode>
        label={tr(T.split)}
        value={mode.value}
        onChange={(v) => {
          mode.value = v;
        }}
        options={[
          { value: "even", label: tr(T.even) },
          { value: "uneven", label: tr(T.uneven) },
        ]}
      />

      {mode.value === "even" ? (
        <>
          <div class="grid-2">
            <NumberField
              label={tr(T.people)}
              value={people.value}
              min={1}
              max={1000}
              integer
              onChange={(v) => {
                people.value = v;
              }}
            />
            <Select
              label={tr(T.round)}
              value={roundTo.value}
              onChange={(v) => {
                roundTo.value = v;
              }}
              options={[
                { value: "0", label: tr(T.noRound) },
                ...["0.1", "0.5", "1", "5", "10"].map((s) => ({ value: s, label: m(Number(s)) })),
              ]}
            />
          </div>
          {!even ? (
            <ErrorNote error={tr(T.bad)} />
          ) : (
            <>
              <Result label={tr(T.perPerson)} value={m(even.rounded)} copy={plain(even.rounded)} />
              <Stats
                items={[
                  { label: tr(T.tipAmount), value: m(even.tip) },
                  {
                    label: tr(T.total),
                    value: m(Number(roundTo.value) > 0 ? even.roundedTotal : even.total),
                  },
                  ...(Number(roundTo.value) > 0
                    ? [
                        {
                          label: tr(T.roundedTip),
                          value: `${m(even.actualTip)} (${pct(even.actualTipPct, 1)})`,
                        },
                      ]
                    : []),
                ]}
              />
            </>
          )}
        </>
      ) : (
        <>
          <div class="table-wrap">
            <table class="table tip-table">
              <thead>
                <tr>
                  <th>{tr(T.name)}</th>
                  <th>{tr(T.own)}</th>
                  <th class="num">{tr(T.shared)}</th>
                  <th class="num">{tr(T.tipAmount)}</th>
                  <th class="num">{tr(T.pays)}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.value.map((p, i) => {
                  const s = uneven?.shares[i];
                  return (
                    <tr key={i}>
                      <td>
                        <input
                          class="input"
                          type="text"
                          aria-label={tr(T.name)}
                          placeholder={`${tr(T.person)} ${i + 1}`}
                          value={p.name}
                          onInput={(e) =>
                            setP(i, { name: (e.currentTarget as HTMLInputElement).value })
                          }
                        />
                      </td>
                      <td>
                        <NumText
                          hidden
                          label={tr(T.own)}
                          value={p.own}
                          onInput={(v) => setP(i, { own: v })}
                        />
                      </td>
                      <td class="num">{s ? m(s.shared) : "—"}</td>
                      <td class="num">{s ? m(s.tip) : "—"}</td>
                      <td class="num">
                        <strong>{s ? m(s.total) : "—"}</strong>
                      </td>
                      <td>
                        <IconButton
                          icon="close"
                          label={tr(T.remove)}
                          onClick={() => {
                            list.value = list.value.filter((_, j) => j !== i);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div class="row">
            <Button
              icon="plus"
              onClick={() => {
                list.value = [...list.value, { name: "", own: "0" }];
              }}
            >
              {tr(T.add)}
            </Button>
          </div>
          {uneven && uneven.unclaimed > 0.005 && (
            <p class="muted small">{tr(T.unclaimed).replace("{v}", m(uneven.unclaimed))}</p>
          )}
          {uneven && uneven.unclaimed < -0.005 && (
            <ErrorNote error={tr(T.over).replace("{v}", m(-uneven.unclaimed))} />
          )}
          {uneven && (
            <Stats
              items={[
                { label: tr(T.tipAmount), value: m(uneven.tip) },
                { label: tr(T.total), value: m(uneven.total) },
              ]}
            />
          )}
        </>
      )}
      <Formula>
        <p>{tr(T.f1)}</p>
        <p>{tr(T.f2)}</p>
      </Formula>
    </>
  );
}
