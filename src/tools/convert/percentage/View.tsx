import { useToolState } from "../../../app/state";
import { CopyButton, Panel, Segmented } from "../../../app/ui";
import { l, lang, tr } from "../../../i18n";
import { parseNumber } from "../_shared";
import { formatNum, plainNum } from "../_ui";
import {
  addPercent,
  clean,
  percentChange,
  percentDifference,
  percentOf,
  reversePercent,
  whatPercent,
} from "./logic";

const T = {
  of: l("Percentage of a value", "Pourcentage d'une valeur"),
  ofQ: l("What is|% of|?", "Combien font|% de|?"),
  what: l("Share as a percentage", "Part en pourcentage"),
  whatQ: l("|is what % of|?", "|représente quel % de|?"),
  change: l("Percentage change", "Variation en pourcentage"),
  changeQ: l("From|to|", "De|à|"),
  add: l("Add or remove a percentage", "Ajouter ou retirer un pourcentage"),
  addQ: l("|% applied to|", "|% appliqués à|"),
  reverse: l("Value before a change", "Valeur avant une variation"),
  reverseQ: l("|is the result after|%", "|est le résultat après|%"),
  diff: l("Percentage difference", "Écart en pourcentage"),
  diffQ: l("Between|and|", "Entre|et|"),
  diffHint: l(
    "Relative to the mean of both values: the order does not matter.",
    "Par rapport à la moyenne des deux valeurs : l'ordre ne compte pas.",
  ),
  increase: l("increase", "hausse"),
  decrease: l("decrease", "baisse"),
  noChange: l("no change", "aucune variation"),
  plus: l("+ increase", "+ hausse"),
  minus: l("− decrease", "− baisse"),
  undefined: l("undefined (division by zero)", "indéfini (division par zéro)"),
  original: l("Original value", "Valeur d'origine"),
  diffAbs: l("Difference", "Différence"),
};

type Sign = "+" | "-";

const DEFAULTS: Record<string, string> = {
  ofX: "15",
  ofY: "200",
  whatX: "30",
  whatY: "200",
  chA: "80",
  chB: "100",
  addX: "20",
  addY: "100",
  revX: "20",
  revY: "120",
  dA: "90",
  dB: "110",
};

export default function Percentage() {
  const v = useToolState<Record<string, string>>("values", DEFAULTS);
  const addSign = useToolState<Sign>("addSign", "+");
  const revSign = useToolState<Sign>("revSign", "+");
  const n = (k: string) => parseNumber(v.value[k] ?? "");
  // French puts a (narrow) space before %.
  const pct = lang.value === "fr" ? "\u202f%" : "%";

  const input = (k: string, label: string) => (
    <input
      class="input pc-num"
      type="text"
      inputMode="decimal"
      aria-label={label}
      value={v.value[k] ?? ""}
      aria-invalid={!!(v.value[k] ?? "").trim() && n(k) === null}
      onInput={(e) => {
        v.value = { ...v.value, [k]: (e.currentTarget as HTMLInputElement).value };
      }}
    />
  );

  /** A question written around its inputs: "What is|% of|?" → text, input, text, input, text. */
  const sentence = (q: typeof T.ofQ, a: string, b: string, title: string) => {
    const [t0, t1, t2] = tr(q).split("|");
    return (
      <p class="pc-q">
        {t0 && <span>{t0}</span>}
        {input(a, `${title} (1)`)}
        {t1 && <span>{t1}</span>}
        {input(b, `${title} (2)`)}
        {t2 && <span>{t2}</span>}
      </p>
    );
  };

  const result = (value: number | null, suffix = "", note?: string) => {
    if (value === null) return <p class="pc-result muted">{tr(T.undefined)}</p>;
    if (!Number.isFinite(value)) return <p class="pc-result muted">—</p>;
    const c = clean(value);
    return (
      <div class="pc-result">
        <strong>
          {formatNum(c)}
          {suffix}
        </strong>
        {note && <span class="muted small">{note}</span>}
        <span class="spacer" />
        <CopyButton text={plainNum(c)} />
      </div>
    );
  };

  const both = (a: string, b: string) => {
    const x = n(a);
    const y = n(b);
    return x === null || y === null ? null : ([x, y] as const);
  };

  const of = both("ofX", "ofY");
  const what = both("whatX", "whatY");
  const ch = both("chA", "chB");
  const add = both("addX", "addY");
  const rev = both("revX", "revY");
  const diff = both("dA", "dB");
  const sign = (s: Sign) => (s === "-" ? -1 : 1);
  const change = ch ? percentChange(ch[0], ch[1]) : null;

  return (
    <div class="grid-2 pc-grid">
      <Panel title={tr(T.of)}>
        {sentence(T.ofQ, "ofX", "ofY", tr(T.of))}
        {of ? result(percentOf(of[0], of[1])) : result(Number.NaN)}
      </Panel>

      <Panel title={tr(T.what)}>
        {sentence(T.whatQ, "whatX", "whatY", tr(T.what))}
        {what ? result(whatPercent(what[0], what[1]), pct) : result(Number.NaN)}
      </Panel>

      <Panel title={tr(T.change)}>
        {sentence(T.changeQ, "chA", "chB", tr(T.change))}
        {ch
          ? result(
              change === null ? null : clean(change),
              pct,
              change === null
                ? undefined
                : change > 0
                  ? `${tr(T.increase)} · ${formatNum(clean(ch[1] - ch[0]))}`
                  : change < 0
                    ? `${tr(T.decrease)} · ${formatNum(clean(ch[1] - ch[0]))}`
                    : tr(T.noChange),
            )
          : result(Number.NaN)}
      </Panel>

      <Panel
        title={tr(T.add)}
        actions={
          <Segmented<Sign>
            label={tr(T.add)}
            value={addSign.value}
            onChange={(s) => {
              addSign.value = s;
            }}
            options={[
              { value: "+", label: tr(T.plus) },
              { value: "-", label: tr(T.minus) },
            ]}
          />
        }
      >
        {sentence(T.addQ, "addX", "addY", tr(T.add))}
        {add
          ? result(
              addPercent(add[1], sign(addSign.value) * add[0]),
              "",
              `${addSign.value === "-" ? "−" : "+"}${formatNum(clean((add[1] * add[0]) / 100))}`,
            )
          : result(Number.NaN)}
      </Panel>

      <Panel
        title={tr(T.reverse)}
        actions={
          <Segmented<Sign>
            label={tr(T.reverse)}
            value={revSign.value}
            onChange={(s) => {
              revSign.value = s;
            }}
            options={[
              { value: "+", label: tr(T.plus) },
              { value: "-", label: tr(T.minus) },
            ]}
          />
        }
      >
        {sentence(T.reverseQ, "revY", "revX", tr(T.reverse))}
        {rev
          ? result(reversePercent(rev[1], sign(revSign.value) * rev[0]), "", tr(T.original))
          : result(Number.NaN)}
      </Panel>

      <Panel title={tr(T.diff)}>
        {sentence(T.diffQ, "dA", "dB", tr(T.diff))}
        {diff ? result(percentDifference(diff[0], diff[1]), pct) : result(Number.NaN)}
        <p class="muted small">{tr(T.diffHint)}</p>
      </Panel>
    </div>
  );
}
