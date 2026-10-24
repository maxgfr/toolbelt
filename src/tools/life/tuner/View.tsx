import { useEffect, useRef, useState } from "preact/hooks";
import { NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, ErrorNote, Segmented } from "../../../app/ui";
import { fmt, l, lang, pick, tr } from "../../../i18n";
import { makeAudio, playTones } from "../_audio";
import { useNow } from "../_ui";
import {
  detectPitch,
  GUITAR,
  inTune,
  median,
  midiToFreq,
  nearestString,
  noteFromFreq,
  noteName,
} from "./logic";

type Mode = "chromatic" | "guitar";

const T = {
  start: l("Start the tuner", "Démarrer l'accordeur", "Stimmgerät starten"),
  stop: l("Stop", "Arrêter", "Stopp"),
  chromatic: l("Chromatic", "Chromatique", "Chromatisch"),
  guitar: l("Guitar (standard)", "Guitare (standard)", "Gitarre (Standard)"),
  a4: l("Reference A4", "La 4 de référence", "Kammerton A4"),
  listening: l("Play a note…", "Joue une note…", "Spiel einen Ton…"),
  idle: l(
    "Start the tuner and allow the microphone. The sound is analyzed in your browser: it is never recorded or sent.",
    "Démarre l'accordeur et autorise le micro. Le son est analysé dans ton navigateur : il n'est jamais enregistré ni envoyé.",
    "Starte das Stimmgerät und erlaube das Mikrofon. Der Ton wird in deinem Browser analysiert: Er wird nie aufgenommen oder gesendet.",
  ),
  flat: l("too low", "trop bas", "zu tief"),
  sharp: l("too high", "trop haut", "zu hoch"),
  ok: l("in tune", "juste", "gestimmt"),
  cents: l("cents", "cents", "Cent"),
  denied: l(
    "The microphone was refused. Allow it in the browser's site settings, then try again.",
    "Le micro a été refusé. Autorise-le dans les réglages du site du navigateur, puis réessaie.",
    "Das Mikrofon wurde abgelehnt. Erlaube es in den Website-Einstellungen des Browsers und versuch es dann noch mal.",
  ),
  noMic: l(
    "No microphone is available (or this browser cannot use one here).",
    "Aucun micro disponible (ou ce navigateur ne peut pas l'utiliser ici).",
    "Kein Mikrofon verfügbar (oder dieser Browser kann hier keins verwenden).",
  ),
  strings: l(
    "Strings — click one to hear it",
    "Cordes — clique pour l'entendre",
    "Saiten – klick eine an, um sie zu hören",
  ),
};

interface Reading {
  freq: number;
  at: number;
}

export default function Tuner() {
  const mode = useToolState<Mode>("mode", "chromatic");
  const a4 = useToolState("a4", 440);
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const live = useRef<{ ac: AudioContext; stream: MediaStream; raf: number } | null>(null);
  const beep = useRef<AudioContext | null>(null);

  const stop = () => {
    const s = live.current;
    if (s) {
      cancelAnimationFrame(s.raf);
      for (const t of s.stream.getTracks()) t.stop();
      s.ac.close().catch(() => {});
    }
    live.current = null;
    setOn(false);
    setReading(null);
  };

  useEffect(
    () => () => {
      stop();
      beep.current?.close().catch(() => {});
    },
    [],
  );

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(tr(T.noMic));
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      setError(tr((e as Error)?.name === "NotAllowedError" ? T.denied : T.noMic));
      return;
    }
    const ac = makeAudio();
    if (!ac) {
      for (const t of stream.getTracks()) t.stop();
      setError(tr(T.noMic));
      return;
    }
    ac.resume().catch(() => {});
    const src = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser();
    an.fftSize = 4096;
    src.connect(an); // Not connected to the speakers: nothing is played back.
    const buf = new Float32Array(an.fftSize);
    const recent: number[] = [];
    let lastRun = 0;
    const state = { ac, stream, raf: 0 };
    const loop = (t: number) => {
      state.raf = requestAnimationFrame(loop);
      if (t - lastRun < 60) return;
      lastRun = t;
      an.getFloatTimeDomainData(buf);
      const p = detectPitch(buf, ac.sampleRate, { minFreq: 60, maxFreq: 1400 });
      if (p && p.clarity > 0.7) {
        // A jump of more than a semitone resets the smoothing.
        const last = recent[recent.length - 1];
        if (last && Math.abs(12 * Math.log2(p.freq / last)) > 1) recent.length = 0;
        recent.push(p.freq);
        if (recent.length > 5) recent.shift();
        setReading({ freq: median(recent), at: Date.now() });
      } else recent.length = 0;
    };
    state.raf = requestAnimationFrame(loop);
    live.current = state;
    setOn(true);
  };

  const play = (midi: number) => {
    if (!beep.current) beep.current = makeAudio();
    const ac = beep.current;
    if (!ac) return;
    ac.resume().catch(() => {});
    const f = midiToFreq(midi, a4.value);
    playTones(ac, [{ at: 0, dur: 1.6, freq: f }], undefined, 0.25, ac.destination, "triangle");
  };

  // The last note fades after a second without a clear pitch.
  const now = useNow(on, 300);
  const fresh = reading !== null && now - reading.at < 1000;
  const freq = reading?.freq ?? 0;
  const note = reading ? noteFromFreq(freq, a4.value) : null;
  const string = mode.value === "guitar" && reading ? nearestString(freq, a4.value) : null;
  const cents = string ? string.cents : (note?.cents ?? 0);
  const shown = string ? noteFromFreq(midiToFreq(string.midi, a4.value), a4.value) : note;
  const clamped = Math.max(-50, Math.min(50, cents));
  const good = reading !== null && inTune(cents);
  // Letter names as the main name (German ones in German: H for B), solfège under it in French.
  const letters = pick<"en" | "de">({ en: "en", fr: "en", de: "de" });
  const solfege = pick({ en: false, fr: true, de: false });

  return (
    <div class="stack">
      <div class="row">
        <Button variant={on ? "secondary" : "primary"} onClick={on ? stop : start}>
          🎙️ {tr(on ? T.stop : T.start)}
        </Button>
        <Segmented<Mode>
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "chromatic", label: tr(T.chromatic) },
            { value: "guitar", label: tr(T.guitar) },
          ]}
        />
        <span class="spacer" />
        <div class="tuner-a4">
          <NumberField
            label={tr(T.a4)}
            value={a4.value}
            min={400}
            max={480}
            step={1}
            suffix="Hz"
            onChange={(v) => {
              a4.value = v;
            }}
          />
        </div>
      </div>
      <ErrorNote error={error} />
      <div class={`panel tuner-face ${fresh ? "" : "tuner-stale"} ${good ? "tuner-good" : ""}`}>
        {!on && !reading ? (
          <p class="muted">{tr(T.idle)}</p>
        ) : !reading || !shown ? (
          <p class="muted tuner-wait">{tr(T.listening)}</p>
        ) : (
          <>
            <div class="tuner-note">
              <span class="tuner-name">{noteName(shown, letters)}</span>
              {solfege && <span class="tuner-solfege muted">{noteName(shown, "fr")}</span>}
            </div>
            <svg
              class="tuner-gauge"
              viewBox="0 0 240 130"
              role="img"
              aria-label={`${fmt(cents, { maximumFractionDigits: 0 })} ${tr(T.cents)}`}
            >
              <path class="tuner-arc" d="M 20 120 A 100 100 0 0 1 220 120" />
              <path class="tuner-zone" d="M 104.4 21.2 A 100 100 0 0 1 135.6 21.2" />
              {[-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50].map((c) => {
                const a = ((c / 50) * 90 * Math.PI) / 180;
                const r1 = c % 50 === 0 || c === 0 ? 86 : 92;
                return (
                  <line
                    key={c}
                    class="tuner-tick"
                    x1={120 + Math.sin(a) * r1}
                    y1={120 - Math.cos(a) * r1}
                    x2={120 + Math.sin(a) * 100}
                    y2={120 - Math.cos(a) * 100}
                  />
                );
              })}
              <line
                class="tuner-needle"
                x1="120"
                y1="120"
                x2="120"
                y2="28"
                transform={`rotate(${(clamped / 50) * 90} 120 120)`}
              />
              <circle class="tuner-hub" cx="120" cy="120" r="5" />
            </svg>
            <div class="tuner-readout">
              <span class="mono">
                {cents > 0 ? "+" : ""}
                {fmt(cents, { maximumFractionDigits: 0 })} {tr(T.cents)}
              </span>
              <span class={`badge ${good ? "badge-ok" : "badge-warn"}`}>
                {good ? tr(T.ok) : cents < 0 ? `▲ ${tr(T.flat)}` : `▼ ${tr(T.sharp)}`}
              </span>
              <span class="muted mono">{fmt(freq, { maximumFractionDigits: 1 })} Hz</span>
            </div>
          </>
        )}
      </div>
      {mode.value === "guitar" && (
        <div class="panel">
          <span class="muted small">{tr(T.strings)}</span>
          <div class="tuner-strings">
            {GUITAR.map((midi, i) => {
              const n = noteFromFreq(midiToFreq(midi, a4.value), a4.value);
              return (
                <button
                  key={midi}
                  type="button"
                  class={`tuner-string ${string?.index === i && fresh ? "on" : ""}`}
                  onClick={() => play(midi)}
                >
                  <strong>{n ? noteName(n, lang.value) : ""}</strong>
                  <small class="mono">
                    {fmt(midiToFreq(midi, a4.value), { maximumFractionDigits: 1 })} Hz
                  </small>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
