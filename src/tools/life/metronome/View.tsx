import { useEffect, useRef, useState } from "preact/hooks";
import { Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, Field, Segmented, Toggle, toast } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { makeAudio } from "../_audio";
import { useKeys } from "../_ui";
import {
  type Cursor,
  clampBpm,
  MAX_BPM,
  type Meter,
  MIN_BPM,
  SIGNATURES,
  schedule,
  type Tick,
  type TickKind,
  tapTempo,
  tempoName,
} from "./logic";

const T = {
  start: l("Start", "Démarrer"),
  stop: l("Stop", "Arrêter"),
  tap: l("Tap tempo", "Taper le tempo"),
  bpm: l("BPM", "BPM"),
  signature: l("Time signature", "Mesure"),
  sub: l("Subdivision", "Subdivision"),
  none: l("Beats", "Temps"),
  eighths: l("Eighths", "Croches"),
  triplets: l("Triplets", "Triolets"),
  sixteenths: l("Sixteenths", "Doubles"),
  accent: l("Accent on beat 1", "Accent sur le 1er temps"),
  volume: l("Volume", "Volume"),
  noAudio: l(
    "Audio is not available in this browser.",
    "L'audio n'est pas disponible dans ce navigateur.",
  ),
  keys: l(
    "Space start / stop · T tap · ← → −1 / +1 BPM (Shift: ±10). Clicks are scheduled on the audio clock, so the beat stays steady.",
    "Espace démarrer / arrêter · T taper · ← → −1 / +1 BPM (Maj : ±10). Les clics sont programmés sur l'horloge audio : le tempo reste stable.",
  ),
  slower: l("Slower", "Plus lent"),
  faster: l("Faster", "Plus rapide"),
};

const FREQ: Record<TickKind, number> = { accent: 1760, medium: 1320, beat: 1000, sub: 660 };
const LOUD: Record<TickKind, number> = { accent: 1, medium: 0.8, beat: 0.7, sub: 0.4 };

export default function Metronome() {
  const bpm = useToolState("bpm", 100);
  const sig = useToolState("signature", "4/4");
  const sub = useToolState("sub", 1);
  const accent = useToolState("accent", true);
  const volume = useToolState("volume", 60);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState<{ beat: number; sub: number } | null>(null);

  const [beatsStr, unitStr] = sig.value.split("/");
  const meter: Meter = {
    bpm: clampBpm(bpm.value),
    beats: Math.max(1, Math.min(16, Number(beatsStr) || 4)),
    unit: Number(unitStr) === 8 ? 8 : 4,
    sub: [1, 2, 3, 4].includes(sub.value) ? sub.value : 1,
    accent: accent.value,
  };
  const meterRef = useRef(meter);
  meterRef.current = meter;
  const volRef = useRef(volume.value);
  volRef.current = volume.value;

  const audio = useRef<{
    ac: AudioContext;
    cursor: Cursor;
    queue: Tick[];
    timer: ReturnType<typeof setInterval> | undefined;
    raf: number;
  } | null>(null);
  const taps = useRef<number[]>([]);

  const click = (ac: AudioContext, t: Tick) => {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.frequency.value = FREQ[t.kind];
    const peak = LOUD[t.kind] * (volRef.current / 100) ** 2 * 0.9;
    g.gain.setValueAtTime(0.0001, t.time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t.time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t.time + 0.045);
    osc.connect(g).connect(ac.destination);
    osc.start(t.time);
    osc.stop(t.time + 0.05);
  };

  const stop = () => {
    const a = audio.current;
    if (!a) return;
    clearInterval(a.timer);
    cancelAnimationFrame(a.raf);
    a.ac.close().catch(() => {});
    audio.current = null;
    setPlaying(false);
    setPos(null);
  };

  const start = () => {
    stop();
    const ac = makeAudio();
    if (!ac) {
      toast(tr(T.noAudio), "error");
      return;
    }
    ac.resume().catch(() => {});
    const state: NonNullable<typeof audio.current> = {
      ac,
      cursor: { next: ac.currentTime + 0.08, index: 0 },
      queue: [],
      timer: undefined,
      raf: 0,
    };
    // Background tabs wake timers about once a second: schedule further ahead there.
    const pump = () => {
      const ahead = document.hidden ? 1.6 : 0.12;
      const r = schedule(state.cursor, ac.currentTime + ahead, meterRef.current);
      state.cursor = r.cursor;
      for (const t of r.ticks) click(ac, t);
      state.queue.push(...r.ticks);
    };
    const draw = () => {
      const now = ac.currentTime;
      let cur: Tick | undefined;
      while (state.queue.length && (state.queue[0] as Tick).time <= now) cur = state.queue.shift();
      if (cur) setPos({ beat: cur.beat, sub: cur.sub });
      state.raf = requestAnimationFrame(draw);
    };
    pump();
    state.timer = setInterval(pump, 25);
    state.raf = requestAnimationFrame(draw);
    audio.current = state;
    setPlaying(true);
  };

  useEffect(() => stop, []);

  const setBpm = (v: number) => {
    bpm.value = clampBpm(v);
  };
  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current, now].slice(-12);
    const t = tapTempo(taps.current);
    if (t !== null) setBpm(t);
  };

  useKeys((e) => {
    if (e.key === " ") {
      e.preventDefault();
      if (playing) stop();
      else start();
    } else if (e.key.toLowerCase() === "t") tap();
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setBpm(meter.bpm + (e.shiftKey ? 10 : 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setBpm(meter.bpm - (e.shiftKey ? 10 : 1));
    }
  });

  return (
    <div class="stack">
      <div class="panel metronome-main">
        <div class="metronome-beats" aria-hidden="true">
          {Array.from({ length: meter.beats }, (_, b) => (
            <span
              key={b}
              class={`metronome-beat ${pos?.beat === b ? (pos.sub === 0 ? "on" : "sub-on") : ""} ${
                meter.accent && b === 0 ? "metronome-first" : ""
              }`}
            >
              {b + 1}
            </span>
          ))}
        </div>
        <div class="row metronome-tempo">
          <Button variant="ghost" aria-label={tr(T.slower)} onClick={() => setBpm(meter.bpm - 1)}>
            −
          </Button>
          <div class="metronome-bpm">
            <span class="metronome-number">{meter.bpm}</span>
            <small class="muted">
              {tr(T.bpm)} · {tempoName(meter.bpm)}
            </small>
          </div>
          <Button variant="ghost" aria-label={tr(T.faster)} onClick={() => setBpm(meter.bpm + 1)}>
            +
          </Button>
        </div>
        <input
          class="metronome-slider"
          type="range"
          min={MIN_BPM}
          max={MAX_BPM}
          value={meter.bpm}
          aria-label={tr(T.bpm)}
          onInput={(e) => setBpm(Number(e.currentTarget.value))}
        />
        <div class="row metronome-buttons">
          <Button variant={playing ? "secondary" : "primary"} onClick={playing ? stop : start}>
            {tr(playing ? T.stop : T.start)}
          </Button>
          <Button onClick={tap}>👆 {tr(T.tap)}</Button>
        </div>
      </div>
      <div class="panel">
        <div class="grid-2">
          <Select
            label={tr(T.signature)}
            value={sig.value}
            onChange={(v) => {
              sig.value = v;
            }}
            options={SIGNATURES.map(([b, u]) => ({ value: `${b}/${u}`, label: `${b}/${u}` }))}
          />
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
        </div>
        <Segmented<string>
          label={tr(T.sub)}
          value={String(meter.sub)}
          onChange={(v) => {
            sub.value = Number(v);
          }}
          options={[
            { value: "1", label: `♩ ${tr(T.none)}` },
            { value: "2", label: `♫ ${tr(T.eighths)}` },
            { value: "3", label: `3 ${tr(T.triplets)}` },
            { value: "4", label: `♬ ${tr(T.sixteenths)}` },
          ]}
        />
        <Toggle
          label={tr(T.accent)}
          checked={accent.value}
          onChange={(v) => {
            accent.value = v;
          }}
        />
        <p class="muted small">{tr(T.keys)}</p>
      </div>
    </div>
  );
}
