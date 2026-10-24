import { useState } from "preact/hooks";
import { NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, ErrorNote, Panel, Segmented, TextBox, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { cryptoInt } from "../_shared";
import {
  type DiceRoll,
  flipCoin,
  makeTeams,
  type Pair,
  parseDice,
  parseExclusions,
  parseList,
  pick,
  randomNumbers,
  rollDice,
  secretSanta,
  shuffle,
} from "./logic";

type Tab = "number" | "dice" | "coin" | "pick" | "shuffle" | "teams" | "santa";

const T = {
  number: l("Number", "Nombre"),
  dice: l("Dice", "Dés"),
  coin: l("Coin", "Pile ou face"),
  pick: l("Draw", "Tirage"),
  shuffle: l("Shuffle", "Mélanger"),
  teams: l("Teams", "Équipes"),
  santa: l("Secret Santa", "Père Noël secret"),
  min: l("Minimum", "Minimum"),
  max: l("Maximum", "Maximum"),
  count: l("How many", "Combien"),
  decimals: l("Decimals", "Décimales"),
  unique: l("No repeats", "Sans doublons"),
  generate: l("Generate", "Générer"),
  results: l("Results", "Résultats"),
  sorted: l("Sorted", "Triés"),
  notation: l("Dice", "Dés"),
  notationHint: l(
    "2d6+3 · d20 · 4d6kh3 (keep the 3 highest) · d% · 1d8-1",
    "2d6+3 · d20 · 4d6kh3 (garder les 3 meilleurs) · d% · 1d8-1",
  ),
  roll: l("Roll", "Lancer"),
  history: l("History", "Historique"),
  clear: l("Clear", "Effacer"),
  range: l("range {a}–{b}", "de {a} à {b}"),
  flip: l("Flip", "Lancer"),
  flip10: l("Flip 10", "Lancer 10 fois"),
  heads: l("Heads", "Pile"),
  tails: l("Tails", "Face"),
  tally: l("Heads {h} · Tails {t}", "Pile {h} · Face {t}"),
  list: l("List (one per line)", "Liste (une ligne par élément)"),
  listPh: l("Alice\nBob\nChloé\nDavid", "Alice\nBob\nChloé\nDavid"),
  winners: l("Winners", "Gagnants"),
  draw: l("Draw", "Tirer au sort"),
  items: l("{n} items", "{n} éléments"),
  shuffled: l("Shuffled list", "Liste mélangée"),
  teamCount: l("Number of teams", "Nombre d'équipes"),
  teamSize: l("People per team", "Personnes par équipe"),
  byCount: l("By number of teams", "Par nombre d'équipes"),
  bySize: l("By team size", "Par taille d'équipe"),
  make: l("Make teams", "Former les équipes"),
  team: l("Team {n}", "Équipe {n}"),
  people: l("People (one per line)", "Participants (un par ligne)"),
  exclusions: l("Exclusions (optional)", "Exclusions (facultatif)"),
  exclusionsHint: l(
    "One pair per line. “Alice, Bob”: neither gives to the other (a couple). “Alice > Bob”: Alice does not give to Bob.",
    "Une paire par ligne. « Alice, Bob » : aucun n'offre à l'autre (un couple). « Alice > Bob » : Alice n'offre pas à Bob.",
  ),
  drawSanta: l("Draw", "Faire le tirage"),
  revealNext: l("Reveal next", "Révéler le suivant"),
  revealAll: l("Show all", "Tout afficher"),
  hideAll: l("Hide all", "Tout masquer"),
  gives: l("gives to", "offre à"),
  hidden: l("Click to reveal", "Clique pour révéler"),
  santaNote: l(
    "Pass the screen around: each person reveals only their own line. Nobody gives to themselves.",
    "Fais passer l'écran : chacun révèle seulement sa ligne. Personne ne s'offre de cadeau à soi-même.",
  ),
  fair: l(
    "Drawn with the browser's cryptographic randomness (crypto.getRandomValues), without bias.",
    "Tiré avec l'aléa cryptographique du navigateur (crypto.getRandomValues), sans biais.",
  ),
};

const TABS: { value: Tab; label: L10n }[] = [
  { value: "number", label: T.number },
  { value: "dice", label: T.dice },
  { value: "coin", label: T.coin },
  { value: "pick", label: T.pick },
  { value: "shuffle", label: T.shuffle },
  { value: "teams", label: T.teams },
  { value: "santa", label: T.santa },
];

export default function RandomTool() {
  const tab = useToolState<Tab>("tab", "number");
  return (
    <div class="stack">
      <Segmented<Tab>
        value={tab.value}
        onChange={(v) => {
          tab.value = v;
        }}
        options={TABS.map((t) => ({ value: t.value, label: tr(t.label) }))}
      />
      {tab.value === "number" && <Numbers />}
      {tab.value === "dice" && <Dice />}
      {tab.value === "coin" && <Coin />}
      {(tab.value === "pick" || tab.value === "shuffle" || tab.value === "teams") && (
        <Lists mode={tab.value} />
      )}
      {tab.value === "santa" && <Santa />}
      <p class="muted small">{tr(T.fair)}</p>
    </div>
  );
}

function Numbers() {
  const min = useToolState("min", 1);
  const max = useToolState("max", 100);
  const count = useToolState("count", 1);
  const decimals = useToolState("decimals", 0);
  const unique = useToolState("unique", false);
  const [out, setOut] = useState<number[] | null>(null);
  const [error, setError] = useState<L10n | null>(null);

  const run = () => {
    const r = randomNumbers(cryptoInt, {
      min: min.value,
      max: max.value,
      count: count.value,
      decimals: decimals.value,
      unique: unique.value,
    });
    if (r.ok) {
      setOut(r.value);
      setError(null);
    } else {
      setOut(null);
      setError(r.error);
    }
  };

  const text = (out ?? []).map((n) => n.toFixed(decimals.value)).join("\n");
  return (
    <Panel>
      <div class="grid-3">
        <NumberField
          label={tr(T.min)}
          value={min.value}
          onChange={(v) => (min.value = v)}
          step="any"
        />
        <NumberField
          label={tr(T.max)}
          value={max.value}
          onChange={(v) => (max.value = v)}
          step="any"
        />
        <NumberField
          label={tr(T.count)}
          value={count.value}
          min={1}
          max={10_000}
          integer
          onChange={(v) => (count.value = v)}
        />
        <NumberField
          label={tr(T.decimals)}
          value={decimals.value}
          min={0}
          max={6}
          integer
          onChange={(v) => (decimals.value = v)}
        />
      </div>
      <div class="row">
        <Toggle label={tr(T.unique)} checked={unique.value} onChange={(v) => (unique.value = v)} />
        <span class="spacer" />
        <Button variant="primary" onClick={run}>
          {tr(T.generate)}
        </Button>
      </div>
      <ErrorNote error={error && tr(error)} />
      {out && out.length === 1 && (
        <div class="random-big">
          {fmt(out[0] as number, {
            minimumFractionDigits: decimals.value,
            maximumFractionDigits: decimals.value,
          })}
        </div>
      )}
      {out && out.length > 1 && (
        <>
          <TextBox label={tr(T.results)} value={text} readOnly rows={Math.min(10, out.length)} />
          <TextBox
            label={tr(T.sorted)}
            value={[...out]
              .sort((a, b) => a - b)
              .map((n) => n.toFixed(decimals.value))
              .join(", ")}
            readOnly
            rows={3}
            wrap
          />
        </>
      )}
    </Panel>
  );
}

function Dice() {
  const expr = useToolState("dice", "2d6");
  const [history, setHistory] = useState<DiceRoll[]>([]);
  const parsed = parseDice(expr.value);

  const roll = (text?: string) => {
    const p = text !== undefined ? parseDice(text) : parsed;
    if (!p.ok) return;
    if (text !== undefined) expr.value = text;
    setHistory((h) => [rollDice(cryptoInt, p.value), ...h].slice(0, 30));
  };
  const last = history[0];

  return (
    <Panel>
      <form
        class="row"
        onSubmit={(e) => {
          e.preventDefault();
          roll();
        }}
      >
        <label class="field random-dice-input">
          <span class="field-label">{tr(T.notation)}</span>
          <span class="field-hint">{tr(T.notationHint)}</span>
          <input
            class="input mono"
            value={expr.value}
            aria-invalid={!parsed.ok}
            onInput={(e) => {
              expr.value = e.currentTarget.value;
            }}
          />
        </label>
        <Button type="submit" variant="primary" disabled={!parsed.ok}>
          🎲 {tr(T.roll)}
        </Button>
      </form>
      <ErrorNote error={parsed.ok || !expr.value.trim() ? null : tr(parsed.error)} />
      <div class="row">
        {["d4", "d6", "2d6", "d8", "d10", "d12", "d20", "d100", "4d6kh3"].map((d) => (
          <Button key={d} size="sm" onClick={() => roll(d)}>
            {d}
          </Button>
        ))}
      </div>
      {last && (
        <div class="random-roll">
          <div class="random-big">{fmt(last.total)}</div>
          <div class="row">
            {last.terms.flatMap((t, ti) =>
              t.rolls.map((v, i) => (
                <span key={`${ti}-${i}`} class={`random-die ${t.kept[i] ? "" : "random-dropped"}`}>
                  {v}
                </span>
              )),
            )}
          </div>
          <p class="muted small">
            {last.notation} ·{" "}
            {tr(T.range).replace("{a}", fmt(last.min)).replace("{b}", fmt(last.max))}
          </p>
        </div>
      )}
      {history.length > 1 && (
        <details class="random-history">
          <summary>
            {tr(T.history)} ({history.length})
          </summary>
          <ol>
            {history.map((h, i) => (
              <li key={history.length - i} class="mono small">
                {h.notation} → <strong>{h.total}</strong>{" "}
                <span class="muted">[{h.terms.flatMap((t) => t.rolls).join(", ")}]</span>
              </li>
            ))}
          </ol>
          <Button size="sm" variant="ghost" onClick={() => setHistory([])}>
            {tr(T.clear)}
          </Button>
        </details>
      )}
    </Panel>
  );
}

function Coin() {
  const [flips, setFlips] = useState<("heads" | "tails")[]>([]);
  const [spin, setSpin] = useState(0);
  const flip = (n: number) => {
    const fresh = Array.from({ length: n }, () => flipCoin(cryptoInt));
    setFlips((f) => [...fresh.reverse(), ...f].slice(0, 200));
    setSpin((s) => s + 1);
  };
  const last = flips[0];
  const heads = flips.filter((f) => f === "heads").length;
  return (
    <Panel>
      <div class="random-coin-wrap">
        <div
          key={spin}
          class={`random-coin ${last ? `random-${last}` : ""} ${spin ? "random-spin" : ""}`}
        >
          {last ? tr(last === "heads" ? T.heads : T.tails) : "?"}
        </div>
      </div>
      <div class="row">
        <Button variant="primary" onClick={() => flip(1)}>
          🪙 {tr(T.flip)}
        </Button>
        <Button onClick={() => flip(10)}>{tr(T.flip10)}</Button>
        {flips.length > 0 && (
          <>
            <span class="muted small">
              {tr(T.tally)
                .replace("{h}", String(heads))
                .replace("{t}", String(flips.length - heads))}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setFlips([])}>
              {tr(T.clear)}
            </Button>
          </>
        )}
      </div>
      {flips.length > 1 && (
        <p class="mono small random-flips">
          {flips
            .slice(0, 60)
            .map((f) => tr(f === "heads" ? T.heads : T.tails).charAt(0))
            .join(" ")}
        </p>
      )}
    </Panel>
  );
}

function Lists({ mode }: { mode: "pick" | "shuffle" | "teams" }) {
  const list = useToolState("list", "");
  const winners = useToolState("winners", 1);
  const teamN = useToolState("teamN", 2);
  const by = useToolState<"count" | "size">("teamBy", "count");
  const [out, setOut] = useState<{ mode: string; items: string[][] } | null>(null);
  const [error, setError] = useState<L10n | null>(null);
  const items = parseList(list.value);

  const run = () => {
    setError(null);
    if (mode === "shuffle") {
      if (!items.length) return setError(l("The list is empty.", "La liste est vide."));
      setOut({ mode, items: [shuffle(cryptoInt, items)] });
      return;
    }
    const r =
      mode === "pick"
        ? (() => {
            const p = pick(cryptoInt, items, winners.value);
            return p.ok ? { ok: true as const, value: [p.value] } : p;
          })()
        : makeTeams(cryptoInt, items, teamN.value, by.value);
    if (r.ok) setOut({ mode, items: r.value });
    else {
      setOut(null);
      setError(r.error);
    }
  };
  const result = out && out.mode === mode ? out.items : null;
  const asText = result
    ? mode === "teams"
      ? result
          .map((t, i) => `${tr(T.team).replace("{n}", String(i + 1))}: ${t.join(", ")}`)
          .join("\n")
      : (result[0] ?? []).map((x, i) => `${i + 1}. ${x}`).join("\n")
    : "";

  return (
    <div class="grid-2">
      <TextBox
        label={`${tr(T.list)} · ${tr(T.items).replace("{n}", String(items.length))}`}
        value={list.value}
        onInput={(v) => {
          list.value = v;
        }}
        placeholder={tr(T.listPh)}
        rows={12}
        mono={false}
      />
      <Panel>
        {mode === "pick" && (
          <NumberField
            label={tr(T.winners)}
            value={winners.value}
            min={1}
            max={Math.max(1, items.length)}
            integer
            onChange={(v) => (winners.value = v)}
          />
        )}
        {mode === "teams" && (
          <>
            <Segmented<"count" | "size">
              value={by.value}
              onChange={(v) => {
                by.value = v;
              }}
              options={[
                { value: "count", label: tr(T.byCount) },
                { value: "size", label: tr(T.bySize) },
              ]}
            />
            <NumberField
              label={tr(by.value === "count" ? T.teamCount : T.teamSize)}
              value={teamN.value}
              min={1}
              max={1000}
              integer
              onChange={(v) => (teamN.value = v)}
            />
          </>
        )}
        <div class="row">
          <Button variant="primary" onClick={run} disabled={!items.length}>
            {tr(mode === "pick" ? T.draw : mode === "teams" ? T.make : T.shuffle)}
          </Button>
          {result && <CopyButton text={asText} />}
        </div>
        <ErrorNote error={error && tr(error)} />
        {result &&
          (mode === "teams" ? (
            <div class="random-teams">
              {result.map((team, i) => (
                <div key={i} class="random-team">
                  <strong>{tr(T.team).replace("{n}", String(i + 1))}</strong>
                  <span class="muted small"> ({team.length})</span>
                  <ul>
                    {team.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ol class={mode === "pick" ? "random-winners" : "random-list"}>
              {(result[0] ?? []).map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ol>
          ))}
      </Panel>
    </div>
  );
}

function Santa() {
  const names = useToolState("santaNames", "");
  const ex = useToolState("santaEx", "");
  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [error, setError] = useState<L10n | null>(null);
  const people = parseList(names.value);

  const draw = () => {
    const r = secretSanta(cryptoInt, people, parseExclusions(ex.value));
    setShown(new Set());
    setStep(-1);
    if (r.ok) {
      setPairs(r.value);
      setError(null);
    } else {
      setPairs(null);
      setError(r.error);
    }
  };
  const [step, setStep] = useState(-1);
  const toggle = (i: number) =>
    setShown((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  // One at a time: revealing the next person hides the previous one.
  const revealNext = () => {
    const i = step + 1;
    setStep(i);
    setShown(new Set([i]));
  };
  const allShown = pairs !== null && shown.size === pairs.length;

  return (
    <div class="grid-2">
      <div class="stack">
        <TextBox
          label={`${tr(T.people)} · ${people.length}`}
          value={names.value}
          onInput={(v) => {
            names.value = v;
            setPairs(null);
          }}
          placeholder={tr(T.listPh)}
          rows={8}
          mono={false}
        />
        <TextBox
          label={tr(T.exclusions)}
          value={ex.value}
          onInput={(v) => {
            ex.value = v;
            setPairs(null);
          }}
          placeholder={"Alice, Bob\nChloé > David"}
          rows={4}
          mono={false}
          note={<span class="muted small">{tr(T.exclusionsHint)}</span>}
        />
      </div>
      <Panel>
        <div class="row">
          <Button variant="primary" onClick={draw} disabled={people.length < 2}>
            🎁 {tr(T.drawSanta)}
          </Button>
          {pairs && step + 1 < pairs.length && (
            <Button onClick={revealNext}>
              {tr(T.revealNext)} ({step + 2}/{pairs.length})
            </Button>
          )}
          {pairs && (
            <Button
              variant="ghost"
              onClick={() => setShown(allShown ? new Set() : new Set(pairs.map((_, i) => i)))}
            >
              {tr(allShown ? T.hideAll : T.revealAll)}
            </Button>
          )}
        </div>
        <ErrorNote error={error && tr(error)} />
        {pairs && (
          <>
            <p class="muted small">{tr(T.santaNote)}</p>
            <ul class="random-santa">
              {pairs.map((p, i) => (
                <li key={p.giver}>
                  <strong>{p.giver}</strong> <span class="muted">{tr(T.gives)}</span>{" "}
                  <button
                    type="button"
                    class={shown.has(i) ? "random-receiver" : "random-hidden"}
                    aria-pressed={shown.has(i)}
                    onClick={() => toggle(i)}
                  >
                    {shown.has(i) ? p.receiver : tr(T.hidden)}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
