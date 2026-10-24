import { useComputed, useSignal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { Badge, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, ErrorNote, Field, Panel, TextBox } from "../../../app/ui";
import { fmt, l, locale, tr } from "../../../i18n";
import { chunkText, clampSettings, languages, pickVoice, voicesFor, wordAt } from "./logic";

const T = {
  text: l("Text to read aloud", "Texte à lire à voix haute", "Vorzulesender Text"),
  placeholder: l(
    "Type or paste a text…",
    "Tape ou colle un texte…",
    "Tippe oder füge einen Text ein…",
  ),
  language: l("Language", "Langue", "Sprache"),
  allLanguages: l("All languages", "Toutes les langues", "Alle Sprachen"),
  voice: l("Voice", "Voix", "Stimme"),
  rate: l("Speed", "Vitesse", "Tempo"),
  pitch: l("Pitch", "Hauteur", "Tonhöhe"),
  volume: l("Volume", "Volume", "Lautstärke"),
  play: l("Read aloud", "Lire", "Vorlesen"),
  pause: l("Pause", "Pause", "Pause"),
  resume: l("Resume", "Reprendre", "Fortsetzen"),
  stop: l("Stop", "Arrêter", "Stopp"),
  reading: l("Reading", "Lecture", "Wird gelesen"),
  online: l("online", "en ligne", "online"),
  onlineWarn: l(
    "This voice is provided by an online service: your browser may send the text to it. Pick a local voice to keep the text on your device.",
    "Cette voix est fournie par un service en ligne : le navigateur peut lui envoyer le texte. Choisis une voix locale pour que le texte reste sur ton appareil.",
    "Diese Stimme kommt von einem Online-Dienst: Dein Browser schickt den Text eventuell dorthin. Wähle eine lokale Stimme, damit der Text auf deinem Gerät bleibt.",
  ),
  unsupported: l(
    "This browser does not support speech synthesis (Web Speech API).",
    "Ce navigateur ne gère pas la synthèse vocale (Web Speech API).",
    "Dieser Browser unterstützt keine Sprachausgabe (Web Speech API).",
  ),
  noVoices: l(
    "No voices are available in this browser. On Linux, install a speech engine (speech-dispatcher, espeak-ng); elsewhere, add voices in the system's speech settings.",
    "Aucune voix n'est disponible dans ce navigateur. Sous Linux, installe un moteur vocal (speech-dispatcher, espeak-ng) ; ailleurs, ajoute des voix dans les réglages de synthèse vocale du système.",
    "In diesem Browser sind keine Stimmen verfügbar. Unter Linux installierst du eine Sprachausgabe (speech-dispatcher, espeak-ng); anderswo fügst du Stimmen in den Sprachausgabe-Einstellungen des Systems hinzu.",
  ),
  loadingVoices: l("Loading voices…", "Chargement des voix…", "Stimmen werden geladen…"),
  noBoundary: l(
    "This voice does not report word positions: the sentence being read is highlighted instead.",
    "Cette voix n'indique pas la position des mots : la phrase lue est surlignée à la place.",
    "Diese Stimme meldet keine Wortpositionen: Stattdessen wird der gelesene Satz hervorgehoben.",
  ),
  failed: l("Speech failed:", "La lecture a échoué :", "Vorlesen fehlgeschlagen:"),
  voicesCount: l("voices", "voix", "Stimmen"),
};

type Status = "idle" | "speaking" | "paused";

const supported =
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  typeof SpeechSynthesisUtterance !== "undefined";

function languageName(code: string): string {
  try {
    return new Intl.DisplayNames([locale()], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export default function Speech() {
  const text = useToolState("text", "");
  const langFilter = useToolState("lang", "");
  const voiceId = useToolState("voice", "");
  const rate = useToolState("rate", 1);
  const pitch = useToolState("pitch", 1);
  const volume = useToolState("volume", 1);

  const voices = useSignal<SpeechSynthesisVoice[]>([]);
  const loaded = useSignal(false);
  const status = useSignal<Status>("idle");
  const chunk = useSignal<[number, number] | null>(null);
  const word = useSignal<[number, number] | null>(null);
  const sawBoundary = useSignal(true);
  const error = useSignal<string | null>(null);
  const spoken = useSignal("");
  const run = useRef(0);

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => {
      voices.value = synth.getVoices();
      if (voices.value.length) loaded.value = true;
    };
    load();
    synth.addEventListener("voiceschanged", load);
    const t = setTimeout(() => {
      loaded.value = true;
    }, 2000);
    return () => {
      synth.removeEventListener("voiceschanged", load);
      clearTimeout(t);
      run.current++;
      synth.cancel();
    };
  }, []);

  const langs = useComputed(() => languages(voices.value, locale()));
  const activeLang = useComputed(() => {
    if (langFilter.value === "all") return "all";
    if (langs.value.includes(langFilter.value)) return langFilter.value;
    return langs.value[0] ?? "all";
  });
  const list = useComputed(
    () => voicesFor(voices.value, activeLang.value) as SpeechSynthesisVoice[],
  );
  const voice = useComputed(
    () => pickVoice(list.value, voiceId.value) as SpeechSynthesisVoice | null,
  );

  function stop() {
    run.current++;
    if (supported) window.speechSynthesis.cancel();
    status.value = "idle";
    chunk.value = null;
    word.value = null;
  }

  function play() {
    if (!supported) return;
    const synth = window.speechSynthesis;
    stop();
    error.value = null;
    const full = text.value;
    const chunks = chunkText(full);
    if (!chunks.length) return;
    const id = run.current;
    const s = clampSettings(rate.value, pitch.value, volume.value);
    const v = voice.value;
    spoken.value = full;
    sawBoundary.value = false;
    chunks.forEach((c, i) => {
      const u = new SpeechSynthesisUtterance(c.text);
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      }
      u.rate = s.rate;
      u.pitch = s.pitch;
      u.volume = s.volume;
      u.onstart = () => {
        if (id !== run.current) return;
        status.value = synth.paused ? "paused" : "speaking";
        chunk.value = [c.offset, c.offset + c.text.length];
        word.value = null;
      };
      u.onboundary = (e) => {
        if (id !== run.current || (e.name && e.name !== "word")) return;
        sawBoundary.value = true;
        word.value = wordAt(full, c.offset + e.charIndex, e.charLength ?? 0);
      };
      u.onend = () => {
        if (id !== run.current || i < chunks.length - 1) return;
        status.value = "idle";
        chunk.value = null;
        word.value = null;
      };
      u.onerror = (e) => {
        if (id !== run.current) return;
        if (e.error !== "interrupted" && e.error !== "canceled") {
          error.value = `${tr(T.failed)} ${e.error}`;
          stop();
        }
      };
      synth.speak(u);
    });
    status.value = "speaking";
  }

  function togglePause() {
    const synth = window.speechSynthesis;
    if (status.value === "paused") {
      synth.resume();
      status.value = "speaking";
    } else {
      synth.pause();
      status.value = "paused";
    }
  }

  if (!supported) return <ErrorNote error={tr(T.unsupported)} />;

  const noVoices = loaded.value && voices.value.length === 0;
  const v = voice.value;

  return (
    <>
      <TextBox
        label={tr(T.text)}
        value={text.value}
        onInput={(val) => {
          text.value = val;
        }}
        placeholder={tr(T.placeholder)}
        rows={8}
        mono={false}
        spellcheck
      />
      {noVoices && <ErrorNote error={tr(T.noVoices)} />}
      {!loaded.value && voices.value.length === 0 && <p class="muted">{tr(T.loadingVoices)}</p>}
      {voices.value.length > 0 && (
        <Panel>
          <div class="speech-controls">
            <Select
              label={tr(T.language)}
              value={activeLang.value}
              onChange={(val) => {
                langFilter.value = val;
              }}
              options={[
                ...langs.value.map((c) => ({ value: c, label: `${languageName(c)} (${c})` })),
                { value: "all", label: tr(T.allLanguages) },
              ]}
            />
            <Select
              label={tr(T.voice)}
              value={v ? v.voiceURI || v.name : ""}
              onChange={(val) => {
                voiceId.value = val;
              }}
              hint={`${fmt(list.value.length)} ${tr(T.voicesCount)}`}
              options={list.value.map((x) => ({
                value: x.voiceURI || x.name,
                label: `${x.name} · ${x.lang}${x.localService ? "" : ` · ${tr(T.online)}`}`,
              }))}
            />
            <Range label={tr(T.rate)} value={rate.value} min={0.5} max={2} step={0.05} sig={rate}>
              ×{fmt(rate.value, { maximumFractionDigits: 2 })}
            </Range>
            <Range label={tr(T.pitch)} value={pitch.value} min={0} max={2} step={0.05} sig={pitch}>
              {fmt(pitch.value, { maximumFractionDigits: 2 })}
            </Range>
            <Range
              label={tr(T.volume)}
              value={volume.value}
              min={0}
              max={1}
              step={0.05}
              sig={volume}
            >
              {fmt(volume.value, { style: "percent" })}
            </Range>
          </div>
          {v && !v.localService && (
            <p class="speech-warn small">
              <Badge kind="warn">{tr(T.online)}</Badge> {tr(T.onlineWarn)}
            </p>
          )}
          <div class="row">
            <Button
              variant="primary"
              onClick={play}
              disabled={!text.value.trim() || (!v && voices.value.length > 0)}
            >
              ▶ {tr(T.play)}
            </Button>
            <Button onClick={togglePause} disabled={status.value === "idle"}>
              {status.value === "paused" ? `▶ ${tr(T.resume)}` : `❚❚ ${tr(T.pause)}`}
            </Button>
            <Button onClick={stop} disabled={status.value === "idle"}>
              ■ {tr(T.stop)}
            </Button>
          </div>
        </Panel>
      )}
      <ErrorNote error={error.value} />
      {status.value !== "idle" && (
        <Panel title={tr(T.reading)}>
          <Spoken text={spoken.value} chunk={chunk.value} word={word.value} />
          {!sawBoundary.value && chunk.value && <p class="muted small">{tr(T.noBoundary)}</p>}
        </Panel>
      )}
    </>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  sig,
  children,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  sig: { value: number };
  children: ComponentChildren;
}) {
  return (
    <Field label={label}>
      <span class="speech-range">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : 1}
          onInput={(e) => {
            const n = Number((e.currentTarget as HTMLInputElement).value);
            if (Number.isFinite(n)) sig.value = n;
          }}
        />
        <span class="mono small">{children}</span>
      </span>
    </Field>
  );
}

/** The text being read, with the current sentence and word marked. */
function Spoken({
  text,
  chunk,
  word,
}: {
  text: string;
  chunk: [number, number] | null;
  word: [number, number] | null;
}) {
  if (!chunk) return <div class="speech-text">{text}</div>;
  const [cs, ce] = chunk;
  const w = word && word[0] >= cs && word[1] <= ce ? word : null;
  return (
    <div class="speech-text">
      {text.slice(0, cs)}
      <span class="speech-chunk">
        {w ? (
          <>
            {text.slice(cs, w[0])}
            <mark class="speech-word">{text.slice(w[0], w[1])}</mark>
            {text.slice(w[1], ce)}
          </>
        ) : (
          text.slice(cs, ce)
        )}
      </span>
      {text.slice(ce)}
    </div>
  );
}
