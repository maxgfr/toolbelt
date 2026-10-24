import { useEffect, useRef, useState } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { Button, Segmented, Stats } from "../../../app/ui";
import { fmt, type Lang, l, lang, tr } from "../../../i18n";
import { cryptoInt } from "../_shared";
import { useKeys, useNow } from "../_ui";
import { bestKey, compareWord, keystroke, makeWords, score } from "./logic";
import { DE_WORDS, EN_WORDS, FR_WORDS } from "./words";

type Mode = "time" | "words";
type WordLang = Lang;

const LISTS: Record<WordLang, readonly string[]> = { en: EN_WORDS, fr: FR_WORDS, de: DE_WORDS };

const T = {
  time: l("Time", "Temps", "Zeit"),
  words: l("Words", "Mots", "Wörter"),
  english: l("English", "Anglais", "Englisch"),
  french: l("French", "Français", "Französisch"),
  german: l("German", "Allemand", "Deutsch"),
  restart: l("Restart", "Recommencer", "Neu starten"),
  start: l(
    "Start typing to begin the test…",
    "Commence à taper pour lancer le test…",
    "Fang an zu tippen, um den Test zu starten…",
  ),
  input: l("Type the words here", "Tape les mots ici", "Tippe die Wörter hier"),
  wpm: l("WPM", "Mots/min", "Wörter/Min."),
  raw: l("Raw WPM", "Mots/min bruts", "Wörter/Min. brutto"),
  accuracy: l("Accuracy", "Précision", "Genauigkeit"),
  errors: l("Errors", "Erreurs", "Fehler"),
  wordsOk: l("Correct words", "Mots justes", "Richtige Wörter"),
  seconds: l("Time", "Durée", "Dauer"),
  best: l(
    "Personal best: {n} WPM",
    "Record personnel : {n} mots/min",
    "Persönlicher Rekord: {n} Wörter/Min.",
  ),
  newBest: l("New personal best!", "Nouveau record personnel !", "Neuer persönlicher Rekord!"),
  noBest: l(
    "No personal best yet for this test.",
    "Pas encore de record pour ce test.",
    "Noch kein Rekord für diesen Test.",
  ),
  help: l(
    "Space moves to the next word. Esc restarts. WPM counts correct words (5 characters = 1 word); raw WPM counts everything typed.",
    "Espace passe au mot suivant. Échap recommence. Les mots/min comptent les mots justes (5 caractères = 1 mot) ; les mots/min bruts comptent tout ce qui est tapé.",
    "Die Leertaste springt zum nächsten Wort. Esc startet neu. Wörter/Min. zählt richtige Wörter (5 Zeichen = 1 Wort); brutto zählt alles Getippte.",
  ),
};

const TIME_OPTIONS = [15, 30, 60];
const WORD_OPTIONS = [10, 25, 50];

function newWords(mode: Mode, n: number, wl: WordLang): string[] {
  return makeWords(cryptoInt, LISTS[wl] ?? EN_WORDS, mode === "time" ? 250 : n);
}

export default function TypingTest() {
  const mode = useToolState<Mode>("mode", "time");
  const n = useToolState("n", 30);
  const wl = useToolState<WordLang>("lang", lang.value);
  const bests = useToolState<Record<string, number>>("best", {}, { share: false });

  const [words, setWords] = useState(() => newWords(mode.value, n.value, wl.value));
  const [typed, setTyped] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [keys, setKeys] = useState({ correct: 0, wrong: 0 });
  const [startAt, setStartAt] = useState<number | null>(null);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [record, setRecord] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLLabelElement>(null);

  const running = startAt !== null && endAt === null;
  const now = useNow(running, 100);
  const limit = n.value * 1000;
  const elapsed = startAt === null ? 0 : (endAt ?? now) - startAt;
  const key = bestKey(mode.value, n.value, wl.value);
  const best = bests.value[key];

  const reset = (m = mode.value, count = n.value, w = wl.value) => {
    setWords(newWords(m, count, w));
    setTyped([]);
    setCurrent("");
    setKeys({ correct: 0, wrong: 0 });
    setStartAt(null);
    setEndAt(null);
    setRecord(false);
    if (boxRef.current) boxRef.current.scrollTop = 0;
    inputRef.current?.focus();
  };

  const finish = (at: number, finalTyped: string[], k = keys) => {
    if (startAt === null) return;
    setEndAt(at);
    const s = score(words, finalTyped, k, at - startAt);
    const wpm = Math.round(s.wpm);
    if (wpm > 0 && wpm > (bests.value[key] ?? 0)) {
      bests.value = { ...bests.value, [key]: wpm };
      setRecord(true);
    }
  };

  useKeys((e) => {
    if (e.key === "Escape") reset();
  });

  // Time mode ends on the clock.
  useEffect(() => {
    if (running && mode.value === "time" && startAt !== null && now - startAt >= limit)
      finish(startAt + limit, [...typed, current]);
  }, [now]);

  // Keep the current word on the second visible line.
  useEffect(() => {
    const box = boxRef.current;
    const el = box?.querySelector<HTMLElement>(".typing-current");
    if (box && el) {
      const line = el.offsetHeight || 32;
      box.scrollTop = Math.max(0, el.offsetTop - box.offsetTop - line);
    }
  }, [typed.length]);

  const onInput = (v: string) => {
    if (endAt !== null) return;
    let t0 = startAt;
    if (t0 === null) {
      if (!v.trim()) return;
      t0 = Date.now();
      setStartAt(t0);
    }
    const target = words[typed.length] ?? "";
    let k = keys;
    if (/\s/.test(v)) {
      const word = v.replace(/\s+/g, "");
      if (!word && !current) {
        setCurrent("");
        return;
      }
      k = word === target ? { ...k, correct: k.correct + 1 } : { ...k, wrong: k.wrong + 1 };
      const next = [...typed, word];
      setKeys(k);
      setTyped(next);
      setCurrent("");
      if (next.length >= words.length) finish(Date.now(), next, k);
      return;
    }
    const hit = keystroke(target, current, v);
    if (hit !== null) {
      k = hit ? { ...k, correct: k.correct + 1 } : { ...k, wrong: k.wrong + 1 };
      setKeys(k);
    }
    setCurrent(v);
    // The last word of a words test ends it as soon as it is right.
    if (mode.value === "words" && typed.length === words.length - 1 && v === target)
      finish(Date.now(), [...typed, v], k);
  };

  const done = endAt !== null;
  const s = score(
    words,
    done ? typed.concat(current ? [current] : []) : [...typed, current],
    keys,
    Math.max(elapsed, 1),
  );
  const left = mode.value === "time" ? Math.max(0, limit - elapsed) : null;
  const options = mode.value === "time" ? TIME_OPTIONS : WORD_OPTIONS;

  return (
    <div class="stack">
      <div class="row">
        <Segmented<Mode>
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
            const count = v === "time" ? 30 : 25;
            n.value = count;
            reset(v, count);
          }}
          options={[
            { value: "time", label: tr(T.time) },
            { value: "words", label: tr(T.words) },
          ]}
        />
        <Segmented<string>
          value={String(n.value)}
          onChange={(v) => {
            n.value = Number(v);
            reset(mode.value, Number(v));
          }}
          options={options.map((o) => ({
            value: String(o),
            label: mode.value === "time" ? `${o} s` : String(o),
          }))}
        />
        <Segmented<WordLang>
          value={wl.value}
          onChange={(v) => {
            wl.value = v;
            reset(mode.value, n.value, v);
          }}
          options={[
            { value: "en", label: tr(T.english) },
            { value: "fr", label: tr(T.french) },
            { value: "de", label: tr(T.german) },
          ]}
        />
        <span class="spacer" />
        <Button icon="refresh" onClick={() => reset()}>
          {tr(T.restart)}
        </Button>
      </div>

      <div class="panel typing-panel">
        <div class="row typing-status">
          <span class="typing-counter">
            {left !== null
              ? Math.ceil(left / 1000)
              : `${Math.min(typed.length, words.length)}/${words.length}`}
          </span>
          {running && (
            <span class="muted mono">
              {fmt(Math.round(s.wpm))} {tr(T.wpm)}
            </span>
          )}
          {!startAt && <span class="muted small">{tr(T.start)}</span>}
        </div>
        {/* A click on the words focuses the input (it is their label). */}
        <label class="typing-words" ref={boxRef} lang={wl.value} for="typing-input">
          {words.map((w, i) => {
            const isCur = i === typed.length && !done;
            const u = i < typed.length ? (typed[i] as string) : isCur ? current : "";
            const chars = compareWord(w, u, i < typed.length);
            const wrong = i < typed.length && u !== w;
            return (
              <span
                key={i}
                class={`typing-word ${isCur ? "typing-current" : ""} ${wrong ? "typing-wrong-word" : ""}`}
              >
                {chars.map((c, j) => (
                  <span
                    key={j}
                    class={`typing-${c.state} ${isCur && j === [...u].length ? "typing-caret" : ""}`}
                  >
                    {c.char}
                  </span>
                ))}
                {isCur && [...u].length >= chars.length && <span class="typing-caret typing-end" />}
              </span>
            );
          })}
        </label>
        <input
          id="typing-input"
          ref={inputRef}
          class="input typing-input mono"
          value={current}
          disabled={done}
          aria-label={tr(T.input)}
          placeholder={done ? "" : tr(T.input)}
          autocomplete="off"
          autocapitalize="off"
          spellcheck={false}
          lang={wl.value}
          onInput={(e) => onInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              reset();
            }
          }}
        />
        <p class="muted small">{tr(T.help)}</p>
      </div>

      {done && (
        <>
          <Stats
            items={[
              { label: tr(T.wpm), value: fmt(Math.round(s.wpm)) },
              { label: tr(T.raw), value: fmt(Math.round(s.raw)) },
              {
                label: tr(T.accuracy),
                value: `${fmt(s.accuracy, { maximumFractionDigits: 1 })} %`,
              },
              { label: tr(T.errors), value: fmt(s.errors) },
              { label: tr(T.wordsOk), value: `${s.correctWords}/${s.correctWords + s.wrongWords}` },
              { label: tr(T.seconds), value: `${fmt(s.seconds, { maximumFractionDigits: 1 })} s` },
            ]}
          />
          {record && <p class="badge badge-ok typing-record">🏆 {tr(T.newBest)}</p>}
        </>
      )}
      <p class="muted small">{best ? tr(T.best).replace("{n}", fmt(best)) : tr(T.noBest)}</p>
    </div>
  );
}
