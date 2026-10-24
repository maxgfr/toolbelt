import { useComputed } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { Button, Field, Segmented, TextBox, toast } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { CHART, decode, dotMs, encode, looksLikeMorse, timings } from "./logic";

type Mode = "auto" | "encode" | "decode";

const T = {
  auto: l("Auto", "Auto"),
  encode: l("Text → Morse", "Texte → Morse"),
  decode: l("Morse → Text", "Morse → Texte"),
  input: l("Input", "Entrée"),
  placeholder: l(
    "Type text, or paste Morse code (. - with / between words)…",
    "Tape du texte, ou colle du morse (. - avec / entre les mots)…",
  ),
  morse: l("Morse", "Morse"),
  text: l("Text", "Texte"),
  detected: l("Detected: {m}", "Détecté : {m}"),
  unknownChars: l("No Morse code for: {c}", "Pas de code morse pour : {c}"),
  unknownCodes: l("Unknown codes (shown as ?): {c}", "Codes inconnus (affichés ?) : {c}"),
  play: l("Play", "Écouter"),
  stop: l("Stop", "Arrêter"),
  speed: l("Speed: {n} WPM", "Vitesse : {n} mots/min"),
  tone: l("Tone: {n} Hz", "Tonalité : {n} Hz"),
  noAudio: l(
    "Audio is not available in this browser.",
    "L'audio n'est pas disponible dans ce navigateur.",
  ),
  chart: l("Morse alphabet", "Alphabet morse"),
};

export default function Morse() {
  const input = useToolState("input", "");
  const mode = useToolState<Mode>("mode", "auto");
  const wpm = useToolState("wpm", 18);
  const hz = useToolState("hz", 600);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<AudioContext | null>(null);

  const decoding = useComputed(() =>
    mode.value === "auto" ? looksLikeMorse(input.value) : mode.value === "decode",
  );
  const result = useComputed(() => {
    if (decoding.value) {
      const d = decode(input.value);
      return { output: d.text, morse: input.value, unknown: d.unknown };
    }
    const e = encode(input.value);
    return { output: e.morse, morse: e.morse, unknown: e.unknown };
  });
  const r = result.value;

  const stop = () => {
    audio.current?.close().catch(() => {});
    audio.current = null;
    setPlaying(false);
  };
  // Silence any playback when leaving the tool.
  useEffect(
    () => () => {
      audio.current?.close().catch(() => {});
    },
    [],
  );

  const play = () => {
    stop();
    let ac: AudioContext;
    try {
      ac = new AudioContext();
    } catch {
      toast(tr(T.noAudio), "error");
      return;
    }
    audio.current = ac;
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = hz.value;
    const gain = ac.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(ac.destination);
    const dot = dotMs(wpm.value) / 1000;
    const ramp = Math.min(0.005, dot / 4);
    let t = ac.currentTime + 0.05;
    for (const seg of timings(r.morse)) {
      const d = seg.units * dot;
      if (seg.on) {
        // Short ramps avoid clicks at each start and end of a tone.
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + ramp);
        gain.gain.setValueAtTime(0.4, t + d - ramp);
        gain.gain.linearRampToValueAtTime(0, t + d);
      }
      t += d;
    }
    osc.onended = () => {
      if (audio.current === ac) stop();
    };
    osc.start();
    osc.stop(t + 0.05);
    setPlaying(true);
  };

  return (
    <>
      <div class="row">
        <Segmented<Mode>
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "auto", label: tr(T.auto) },
            { value: "encode", label: tr(T.encode) },
            { value: "decode", label: tr(T.decode) },
          ]}
        />
        {mode.value === "auto" && input.value.trim() && (
          <span class="muted small">
            {tr(T.detected).replace("{m}", tr(decoding.value ? T.morse : T.text))}
          </span>
        )}
      </div>
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(T.placeholder)}
          rows={10}
          note={
            r.unknown.length > 0 && (
              <span class="error">
                {tr(decoding.value ? T.unknownCodes : T.unknownChars).replace(
                  "{c}",
                  r.unknown.join("  "),
                )}
              </span>
            )
          }
        />
        <TextBox
          label={tr(decoding.value ? T.text : T.morse)}
          value={r.output}
          readOnly
          rows={10}
        />
      </div>
      <div class="row tx-options">
        <Button
          variant={playing ? "secondary" : "primary"}
          disabled={!playing && !/[.-]/.test(r.morse)}
          onClick={playing ? stop : play}
        >
          {tr(playing ? T.stop : T.play)}
        </Button>
        <Field label={tr(T.speed).replace("{n}", String(wpm.value))} class="morse-slider">
          <input
            type="range"
            min={5}
            max={40}
            value={wpm.value}
            onInput={(e) => {
              wpm.value = Number(e.currentTarget.value);
            }}
          />
        </Field>
        <Field label={tr(T.tone).replace("{n}", String(hz.value))} class="morse-slider">
          <input
            type="range"
            min={300}
            max={1200}
            step={10}
            value={hz.value}
            onInput={(e) => {
              hz.value = Number(e.currentTarget.value);
            }}
          />
        </Field>
      </div>
      <details class="morse-chart">
        <summary>{tr(T.chart)}</summary>
        <dl>
          {CHART.map(([ch, code]) => (
            <div key={ch}>
              <dt>{ch}</dt>
              <dd class="mono">{code}</dd>
            </div>
          ))}
        </dl>
      </details>
    </>
  );
}
