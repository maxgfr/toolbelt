import { useEffect, useRef, useState } from "preact/hooks";
import { NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, Field, Segmented, toast } from "../../../app/ui";
import { fmt, l, lang, tr } from "../../../i18n";
import { makeAudio } from "../_audio";
import { formatRemaining } from "../_shared";
import { useNow, useTitle } from "../_ui";
import { noteFromFreq, noteName } from "../tuner/logic";
import {
  clampFreq,
  freqToSlider,
  type NoiseKind,
  noiseSamples,
  roundFreq,
  sleepLeft,
  sliderToFreq,
  smoothLoop,
  volumeToGain,
} from "./logic";

type Source = "tone" | "noise";

const T = {
  tone: l("Tone", "Son pur", "Ton"),
  noise: l("Noise", "Bruit", "Rauschen"),
  play: l("Play", "Lecture", "Abspielen"),
  stop: l("Stop", "Arrêter", "Stopp"),
  frequency: l("Frequency", "Fréquence", "Frequenz"),
  waveform: l("Waveform", "Forme d'onde", "Wellenform"),
  sine: l("Sine", "Sinus", "Sinus"),
  square: l("Square", "Carré", "Rechteck"),
  sawtooth: l("Sawtooth", "Dent de scie", "Sägezahn"),
  triangle: l("Triangle", "Triangle", "Dreieck"),
  white: l("White", "Blanc", "Weiß"),
  pink: l("Pink", "Rose", "Rosa"),
  brown: l("Brown", "Brun", "Braun"),
  noiseHint: l(
    "White: hiss, all frequencies. Pink: softer, like rain. Brown: deep, like a waterfall or wind.",
    "Blanc : souffle, toutes les fréquences. Rose : plus doux, comme la pluie. Brun : grave, comme une cascade ou le vent.",
    "Weiß: Rauschen über alle Frequenzen. Rosa: weicher, wie Regen. Braun: tief, wie ein Wasserfall oder Wind.",
  ),
  volume: l("Volume", "Volume", "Lautstärke"),
  fade: l("Fade in / out", "Fondu d'entrée / sortie", "Ein- / Ausblenden"),
  sleep: l("Sleep timer", "Arrêt automatique", "Schlaftimer"),
  off: l("Off", "Désactivé", "Aus"),
  minutes: l("{n} min", "{n} min", "{n} Min."),
  stopsIn: l("Stops in {t}", "Arrêt dans {t}", "Stoppt in {t}"),
  loud: l(
    "Careful: start low, especially with headphones. Very high and very low tones can be loud without seeming so.",
    "Attention : commence bas, surtout au casque. Les sons très aigus ou très graves peuvent être forts sans en avoir l'air.",
    "Vorsicht: Fang leise an, besonders mit Kopfhörern. Sehr hohe und sehr tiefe Töne können laut sein, ohne dass es so wirkt.",
  ),
  noAudio: l(
    "Audio is not available in this browser.",
    "L'audio n'est pas disponible dans ce navigateur.",
    "Audio ist in diesem Browser nicht verfügbar.",
  ),
  octDown: l("Octave down", "Octave en dessous", "Eine Oktave tiefer"),
  octUp: l("Octave up", "Octave au-dessus", "Eine Oktave höher"),
};

const PRESETS = [100, 261.63, 440, 1000, 4000, 10_000];
const SLEEP = [0, 5, 10, 15, 30, 45, 60, 90, 120];

interface Live {
  ac: AudioContext;
  master: GainNode;
  osc: OscillatorNode | null;
  noise: AudioBufferSourceNode | null;
  kind: string;
}

export default function ToneTool() {
  const source = useToolState<Source>("source", "tone");
  const freq = useToolState("freq", 440);
  const wave = useToolState<OscillatorType>("wave", "sine");
  const color = useToolState<NoiseKind>("color", "pink");
  const volume = useToolState("volume", 20);
  const fade = useToolState("fade", 1);
  const sleepMin = useToolState("sleep", 0);
  const [playing, setPlaying] = useState(false);
  const [sleepAt, setSleepAt] = useState<number | null>(null);
  const live = useRef<Live | null>(null);
  const stopping = useRef<ReturnType<typeof setTimeout> | null>(null);

  const f = clampFreq(freq.value);
  const gain = volumeToGain(volume.value);
  const fadeS = Math.max(0.03, Math.min(10, fade.value));

  const attach = (lv: Live) => {
    const { ac } = lv;
    const kind = source.value === "tone" ? `tone` : `noise-${color.value}`;
    if (lv.kind === kind) return;
    // Swap the source with a short crossfade-free switch under the master fade.
    lv.osc?.stop();
    lv.noise?.stop();
    lv.osc = null;
    lv.noise = null;
    if (source.value === "tone") {
      const osc = ac.createOscillator();
      osc.type = wave.value;
      osc.frequency.value = f;
      osc.connect(lv.master);
      osc.start();
      lv.osc = osc;
    } else {
      const sr = ac.sampleRate;
      const raw = noiseSamples(color.value, sr * 8 + 4800, Math.random);
      const data = smoothLoop(raw, 4800);
      const buf = ac.createBuffer(1, data.length, sr);
      buf.getChannelData(0).set(data);
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(lv.master);
      src.start();
      lv.noise = src;
    }
    lv.kind = kind;
  };

  const kill = () => {
    if (stopping.current) clearTimeout(stopping.current);
    stopping.current = null;
    live.current?.ac.close().catch(() => {});
    live.current = null;
  };

  const start = () => {
    kill();
    const ac = makeAudio();
    if (!ac) {
      toast(tr(T.noAudio), "error");
      return;
    }
    ac.resume().catch(() => {});
    const master = ac.createGain();
    master.gain.setValueAtTime(0, ac.currentTime);
    master.gain.linearRampToValueAtTime(gain, ac.currentTime + fadeS);
    master.connect(ac.destination);
    const lv: Live = { ac, master, osc: null, noise: null, kind: "" };
    attach(lv);
    live.current = lv;
    setPlaying(true);
    setSleepAt(sleepMin.value > 0 ? Date.now() + sleepMin.value * 60_000 : null);
  };

  const stop = () => {
    const lv = live.current;
    setPlaying(false);
    setSleepAt(null);
    if (!lv) return;
    const now = lv.ac.currentTime;
    lv.master.gain.cancelScheduledValues(now);
    lv.master.gain.setValueAtTime(lv.master.gain.value, now);
    lv.master.gain.linearRampToValueAtTime(0, now + fadeS);
    if (stopping.current) clearTimeout(stopping.current);
    stopping.current = setTimeout(
      () => {
        stopping.current = null;
        if (live.current === lv) kill();
        else lv.ac.close().catch(() => {});
      },
      fadeS * 1000 + 100,
    );
  };

  useEffect(() => kill, []);

  // Live changes while playing.
  useEffect(() => {
    const lv = live.current;
    if (!lv || !playing) return;
    attach(lv);
    const t = lv.ac.currentTime;
    if (lv.osc) {
      lv.osc.type = wave.value;
      lv.osc.frequency.setTargetAtTime(f, t, 0.02);
    }
    lv.master.gain.cancelScheduledValues(t);
    lv.master.gain.setTargetAtTime(gain, t, 0.05);
  }, [f, wave.value, color.value, source.value, gain]);

  const now = useNow(sleepAt !== null, 500);
  const left = sleepLeft(sleepAt, now);
  useEffect(() => {
    if (left === 0 && playing) stop();
  }, [left]);
  useTitle(playing && left !== null ? `🌙 ${formatRemaining(left)} · toolbelt` : null);

  const note = noteFromFreq(f);

  return (
    <div class="stack">
      <div class="row">
        <Segmented<Source>
          value={source.value}
          onChange={(v) => {
            source.value = v;
          }}
          options={[
            { value: "tone", label: tr(T.tone) },
            { value: "noise", label: tr(T.noise) },
          ]}
        />
        <Button variant={playing ? "secondary" : "primary"} onClick={playing ? stop : start}>
          {playing ? `■ ${tr(T.stop)}` : `▶ ${tr(T.play)}`}
        </Button>
        {playing && left !== null && (
          <span class="badge badge-info">
            {tr(T.stopsIn).replace("{t}", formatRemaining(left))}
          </span>
        )}
      </div>

      <div class="panel">
        {source.value === "tone" ? (
          <>
            <div class="row tone-freq">
              <div class="tone-big">
                {fmt(roundFreq(f))} <small>Hz</small>
              </div>
              {note && (
                <span class="muted">
                  ≈ {noteName(note, lang.value)}{" "}
                  {Math.abs(note.cents) >= 1 &&
                    `(${note.cents > 0 ? "+" : ""}${fmt(note.cents, { maximumFractionDigits: 0 })} cents)`}
                </span>
              )}
            </div>
            <input
              type="range"
              class="tone-slider"
              min={0}
              max={1000}
              step={1}
              value={freqToSlider(f)}
              aria-label={tr(T.frequency)}
              onInput={(e) => {
                freq.value = roundFreq(sliderToFreq(Number(e.currentTarget.value)));
              }}
            />
            <div class="row">
              <Button
                size="sm"
                aria-label={tr(T.octDown)}
                onClick={() => (freq.value = roundFreq(clampFreq(f / 2)))}
              >
                ÷2
              </Button>
              <Button
                size="sm"
                aria-label={tr(T.octUp)}
                onClick={() => (freq.value = roundFreq(clampFreq(f * 2)))}
              >
                ×2
              </Button>
              {PRESETS.map((p) => (
                <Button key={p} size="sm" variant="ghost" onClick={() => (freq.value = p)}>
                  {p >= 1000 ? `${p / 1000} kHz` : `${fmt(p)} Hz`}
                </Button>
              ))}
            </div>
            <div class="grid-2">
              <NumberField
                label={tr(T.frequency)}
                value={f}
                min={20}
                max={20_000}
                step="any"
                suffix="Hz"
                onChange={(v) => {
                  freq.value = v;
                }}
              />
              <Select<OscillatorType>
                label={tr(T.waveform)}
                value={wave.value}
                onChange={(v) => {
                  wave.value = v;
                }}
                options={[
                  { value: "sine", label: tr(T.sine) },
                  { value: "triangle", label: tr(T.triangle) },
                  { value: "square", label: tr(T.square) },
                  { value: "sawtooth", label: tr(T.sawtooth) },
                ]}
              />
            </div>
          </>
        ) : (
          <>
            <Segmented<NoiseKind>
              value={color.value}
              onChange={(v) => {
                color.value = v;
              }}
              options={[
                { value: "white", label: tr(T.white) },
                { value: "pink", label: tr(T.pink) },
                { value: "brown", label: tr(T.brown) },
              ]}
            />
            <p class="muted small">{tr(T.noiseHint)}</p>
          </>
        )}
      </div>

      <div class="panel">
        <div class="grid-3">
          <Field label={`${tr(T.volume)} · ${volume.value} %`}>
            <input
              type="range"
              min={0}
              max={100}
              value={volume.value}
              onInput={(e) => {
                volume.value = Number(e.currentTarget.value);
              }}
            />
          </Field>
          <NumberField
            label={tr(T.fade)}
            value={fade.value}
            min={0}
            max={10}
            step={0.5}
            suffix="s"
            onChange={(v) => {
              fade.value = v;
            }}
          />
          <Select<string>
            label={tr(T.sleep)}
            value={String(sleepMin.value)}
            onChange={(v) => {
              sleepMin.value = Number(v);
              if (playing) setSleepAt(Number(v) > 0 ? Date.now() + Number(v) * 60_000 : null);
            }}
            options={SLEEP.map((m) => ({
              value: String(m),
              label: m === 0 ? tr(T.off) : tr(T.minutes).replace("{n}", String(m)),
            }))}
          />
        </div>
        {volume.value > 50 && <p class="badge badge-warn">{tr(T.loud)}</p>}
        {volume.value <= 50 && <p class="muted small">{tr(T.loud)}</p>}
      </div>
    </div>
  );
}
