import { useEffect, useRef, useState } from "preact/hooks";
import { Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, ErrorNote, Panel, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { makeAudio, playTones } from "../_audio";
import { chime } from "../_shared";
import { useNow } from "../_ui";
import { rms } from "../tuner/logic";
import {
  aspectRatio,
  deviceLabel,
  measuredFps,
  meterFraction,
  nextPeak,
  pickMime,
  resolutionName,
  toDb,
} from "./logic";

const T = {
  privacy: l(
    "Everything stays on this device: the camera image and the microphone sound are only shown and played here, never recorded on a server or sent anywhere. Leaving the page turns them off.",
    "Tout reste sur cet appareil : l'image de la caméra et le son du micro sont seulement affichés et joués ici, jamais enregistrés sur un serveur ni envoyés. Quitter la page les éteint.",
  ),
  camera: l("Camera", "Caméra"),
  mic: l("Microphone", "Micro"),
  speakers: l("Speakers", "Haut-parleurs"),
  startCam: l("Turn on the camera", "Allumer la caméra"),
  startMic: l("Turn on the microphone", "Allumer le micro"),
  off: l("Turn off", "Éteindre"),
  device: l("Device", "Appareil"),
  quality: l("Requested size", "Taille demandée"),
  auto: l("Automatic", "Automatique"),
  mirror: l("Mirror", "Effet miroir"),
  resolution: l("Resolution", "Résolution"),
  ratio: l("Aspect ratio", "Format"),
  fps: l("Frame rate", "Images/s"),
  measured: l("measured", "mesuré"),
  level: l("Level", "Niveau"),
  levelIs: l("Level: {v}", "Niveau : {v}"),
  peakIs: l("Peak: {v}", "Crête : {v}"),
  speak: l(
    "Speak or clap: the bar should move.",
    "Parle ou tape dans tes mains : la barre doit bouger.",
  ),
  record: l("Record 5 s", "Enregistrer 5 s"),
  recording: l("Recording… {n} s", "Enregistrement… {n} s"),
  playback: l(
    "Your recording (kept only in this page)",
    "Ton enregistrement (gardé seulement dans cette page)",
  ),
  noRecorder: l(
    "This browser cannot record audio.",
    "Ce navigateur ne peut pas enregistrer de son.",
  ),
  left: l("Left", "Gauche"),
  right: l("Right", "Droite"),
  both: l("Both", "Les deux"),
  speakerHint: l(
    "Each button plays a short chime on one side: check that it comes out of the right speaker or earphone.",
    "Chaque bouton joue un petit carillon d'un côté : vérifie qu'il sort du bon haut-parleur ou de la bonne oreillette.",
  ),
  denied: l(
    "Access was refused. Allow it in the browser's site settings, then try again.",
    "L'accès a été refusé. Autorise-le dans les réglages du site du navigateur, puis réessaie.",
  ),
  notFound: l("No such device was found.", "Aucun appareil de ce type n'a été trouvé."),
  busy: l(
    "The device is busy (used by another app?) or could not start.",
    "L'appareil est occupé (utilisé par une autre application ?) ou n'a pas pu démarrer.",
  ),
  unsupported: l(
    "This browser cannot access cameras and microphones here.",
    "Ce navigateur ne peut pas accéder aux caméras et micros ici.",
  ),
};

function mediaError(e: unknown): string {
  const name = (e as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return tr(T.denied);
  if (name === "NotFoundError" || name === "OverconstrainedError") return tr(T.notFound);
  return tr(T.busy);
}

function dbText(db: number): string {
  return Number.isFinite(db) ? `${fmt(db, { maximumFractionDigits: 0 })} dBFS` : "–";
}

function stopStream(s: MediaStream | null): void {
  if (s) for (const t of s.getTracks()) t.stop();
}

/** Devices of one kind, refreshed when devices are plugged or unplugged. */
function useDevices(kind: MediaDeviceKind): [MediaDeviceInfo[], () => void] {
  const [list, setList] = useState<MediaDeviceInfo[]>([]);
  const refresh = () => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((all) => setList(all.filter((d) => d.kind === kind && d.deviceId)))
      .catch(() => {});
  };
  useEffect(() => {
    refresh();
    const md = navigator.mediaDevices;
    md?.addEventListener("devicechange", refresh);
    return () => md?.removeEventListener("devicechange", refresh);
  }, []);
  return [list, refresh];
}

export default function Devices() {
  const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  return (
    <div class="stack">
      <p class="muted small">🔒 {tr(T.privacy)}</p>
      {!supported && <ErrorNote error={tr(T.unsupported)} />}
      <div class="grid-2">
        <Camera />
        <Microphone />
      </div>
      <Speakers />
    </div>
  );
}

const QUALITIES: Record<string, { width: number; height: number } | null> = {
  auto: null,
  "480": { width: 640, height: 480 },
  "720": { width: 1280, height: 720 },
  "1080": { width: 1920, height: 1080 },
  "2160": { width: 3840, height: 2160 },
};

function Camera() {
  const mirror = useToolState("mirror", true);
  const quality = useToolState("quality", "auto");
  const [devices, refresh] = useDevices("videoinput");
  const [deviceId, setDeviceId] = useState("");
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [fps, setFps] = useState<{ set: number | null; real: number | null }>({
    set: null,
    real: null,
  });
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frames = useRef<{ times: number[]; handle: number }>({ times: [], handle: 0 });

  const stop = () => {
    stopStream(stream.current);
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setOn(false);
    setSize({ w: 0, h: 0 });
    setFps({ set: null, real: null });
  };
  useEffect(() => stop, []);

  const start = async (id = deviceId, q = quality.value) => {
    setError(null);
    stop();
    const dims = QUALITIES[q] ?? null;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(id ? { deviceId: { exact: id } } : {}),
          ...(dims ? { width: { ideal: dims.width }, height: { ideal: dims.height } } : {}),
        },
      });
      stream.current = s;
      const track = s.getVideoTracks()[0];
      const settings = track?.getSettings();
      setDeviceId(settings?.deviceId ?? id);
      setFps({ set: settings?.frameRate ?? null, real: null });
      if (video.current) {
        video.current.srcObject = s;
        video.current.play().catch(() => {});
      }
      setOn(true);
      refresh();
    } catch (e) {
      setError(mediaError(e));
    }
  };

  // Measured frame rate, from the frames the video element actually presents.
  useEffect(() => {
    const v = video.current as
      | (HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number) => void) => number })
      | null;
    if (!on || !v?.requestVideoFrameCallback) return;
    let alive = true;
    let lastShown = 0;
    const tick = (now: number) => {
      if (!alive) return;
      const f = frames.current;
      f.times.push(now);
      if (f.times.length > 120) f.times.shift();
      if (now - lastShown > 500) {
        lastShown = now;
        const real = measuredFps(f.times);
        setFps((p) => ({ ...p, real }));
      }
      f.handle = v.requestVideoFrameCallback?.(tick) ?? 0;
    };
    frames.current = { times: [], handle: v.requestVideoFrameCallback(tick) };
    return () => {
      alive = false;
    };
  }, [on]);

  const name = resolutionName(size.w, size.h);
  return (
    <Panel title={`📷 ${tr(T.camera)}`}>
      <div class="row">
        <Button variant={on ? "secondary" : "primary"} onClick={() => (on ? stop() : start())}>
          {tr(on ? T.off : T.startCam)}
        </Button>
        <Toggle label={tr(T.mirror)} checked={mirror.value} onChange={(v) => (mirror.value = v)} />
      </div>
      <div class="grid-2">
        {devices.length > 0 && (
          <Select
            label={tr(T.device)}
            value={deviceId}
            onChange={(v) => {
              setDeviceId(v);
              if (on) start(v);
            }}
            options={devices.map((d, i) => ({
              value: d.deviceId,
              label: deviceLabel(d.label, i, tr(T.camera)),
            }))}
          />
        )}
        <Select
          label={tr(T.quality)}
          value={quality.value}
          onChange={(v) => {
            quality.value = v;
            if (on) start(deviceId, v);
          }}
          options={[
            { value: "auto", label: tr(T.auto) },
            { value: "480", label: "480p" },
            { value: "720", label: "720p" },
            { value: "1080", label: "1080p" },
            { value: "2160", label: "4K" },
          ]}
        />
      </div>
      <ErrorNote error={error} />
      <div class={`devices-video ${on ? "" : "devices-off"}`}>
        <video
          ref={video}
          class={mirror.value ? "devices-mirror" : ""}
          muted
          playsInline
          autoPlay
          onLoadedMetadata={(e) =>
            setSize({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })
          }
          onResize={(e) =>
            setSize({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })
          }
        />
      </div>
      {on && size.w > 0 && (
        <dl class="stats">
          <div class="stat">
            <dt>{tr(T.resolution)}</dt>
            <dd>
              {size.w}×{size.h}
              {name && <small class="muted"> {name}</small>}
            </dd>
          </div>
          <div class="stat">
            <dt>{tr(T.ratio)}</dt>
            <dd>{aspectRatio(size.w, size.h)}</dd>
          </div>
          <div class="stat">
            <dt>{tr(T.fps)}</dt>
            <dd>
              {fps.set ? fmt(fps.set, { maximumFractionDigits: 1 }) : "–"}
              {fps.real !== null && (
                <small class="muted">
                  {" "}
                  ({tr(T.measured)} {fmt(fps.real, { maximumFractionDigits: 0 })})
                </small>
              )}
            </dd>
          </div>
        </dl>
      )}
    </Panel>
  );
}

const RECORD_MS = 5000;

function Microphone() {
  const [devices, refresh] = useDevices("audioinput");
  const [deviceId, setDeviceId] = useState("");
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState({
    db: Number.NEGATIVE_INFINITY,
    peak: Number.NEGATIVE_INFINITY,
  });
  const [recUntil, setRecUntil] = useState<number | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const live = useRef<{ stream: MediaStream; ac: AudioContext; raf: number } | null>(null);
  const rec = useRef<{ recorder: MediaRecorder; timer: ReturnType<typeof setTimeout> } | null>(
    null,
  );
  const urlRef = useRef<string | null>(null);
  const mounted = useRef(true);

  const stopRecording = () => {
    const r = rec.current;
    if (!r) return;
    clearTimeout(r.timer);
    if (r.recorder.state !== "inactive") r.recorder.stop();
    rec.current = null;
    setRecUntil(null);
  };

  const stop = () => {
    stopRecording();
    const s = live.current;
    if (s) {
      cancelAnimationFrame(s.raf);
      stopStream(s.stream);
      s.ac.close().catch(() => {});
    }
    live.current = null;
    setOn(false);
    setLevel({ db: Number.NEGATIVE_INFINITY, peak: Number.NEGATIVE_INFINITY });
  };

  useEffect(
    () => () => {
      mounted.current = false;
      stop();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const start = async (id = deviceId) => {
    setError(null);
    stop();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: id ? { deviceId: { exact: id } } : true,
      });
    } catch (e) {
      setError(mediaError(e));
      return;
    }
    const ac = makeAudio();
    if (!ac) {
      stopStream(stream);
      setError(tr(T.busy));
      return;
    }
    ac.resume().catch(() => {});
    const an = ac.createAnalyser();
    an.fftSize = 2048;
    ac.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    let peak = { db: Number.NEGATIVE_INFINITY, at: 0 };
    const state = { stream, ac, raf: 0 };
    const loop = () => {
      an.getFloatTimeDomainData(buf);
      const db = toDb(rms(buf));
      peak = nextPeak(peak, db, performance.now());
      setLevel({ db, peak: peak.db });
      state.raf = requestAnimationFrame(loop);
    };
    state.raf = requestAnimationFrame(loop);
    live.current = state;
    setDeviceId(stream.getAudioTracks()[0]?.getSettings().deviceId ?? id);
    setOn(true);
    refresh();
  };

  const record = () => {
    const s = live.current;
    if (!s) return;
    if (typeof MediaRecorder === "undefined") {
      setError(tr(T.noRecorder));
      return;
    }
    const mime = pickMime((t) => MediaRecorder.isTypeSupported(t));
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(s.stream, mime ? { mimeType: mime } : undefined);
    } catch {
      setError(tr(T.noRecorder));
      return;
    }
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      if (!chunks.length || !mounted.current) return;
      const blob = new Blob(chunks, { type: recorder.mimeType || mime || "audio/webm" });
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      setUrl(urlRef.current);
    };
    recorder.start();
    rec.current = { recorder, timer: setTimeout(stopRecording, RECORD_MS) };
    setRecUntil(Date.now() + RECORD_MS);
  };

  const now = useNow(recUntil !== null, 200);
  const frac = meterFraction(level.db);
  const peakFrac = meterFraction(level.peak);

  return (
    <Panel title={`🎙️ ${tr(T.mic)}`}>
      <div class="row">
        <Button variant={on ? "secondary" : "primary"} onClick={() => (on ? stop() : start())}>
          {tr(on ? T.off : T.startMic)}
        </Button>
        {on && (
          <Button
            onClick={recUntil ? stopRecording : record}
            variant={recUntil ? "danger" : "secondary"}
          >
            {recUntil
              ? tr(T.recording).replace(
                  "{n}",
                  String(Math.max(0, Math.ceil((recUntil - now) / 1000))),
                )
              : `⏺ ${tr(T.record)}`}
          </Button>
        )}
      </div>
      {devices.length > 0 && (
        <Select
          label={tr(T.device)}
          value={deviceId}
          onChange={(v) => {
            setDeviceId(v);
            if (on) start(v);
          }}
          options={devices.map((d, i) => ({
            value: d.deviceId,
            label: deviceLabel(d.label, i, tr(T.mic)),
          }))}
        />
      )}
      <ErrorNote error={error} />
      <div class="devices-meter" aria-hidden="true">
        <span
          class={`devices-meter-fill ${frac > 0.95 ? "devices-clip" : ""}`}
          style={{ width: `${frac * 100}%` }}
        />
        {peakFrac > 0 && <span class="devices-meter-peak" style={{ left: `${peakFrac * 100}%` }} />}
      </div>
      <div class="row small muted">
        <span>{tr(T.levelIs).replace("{v}", dbText(level.db))}</span>
        <span>{tr(T.peakIs).replace("{v}", dbText(level.peak))}</span>
      </div>
      {on && <p class="muted small">{tr(T.speak)}</p>}
      {url && (
        <div class="stack devices-playback">
          <span class="small muted">{tr(T.playback)}</span>
          <audio controls src={url} />
        </div>
      )}
    </Panel>
  );
}

function Speakers() {
  const ac = useRef<AudioContext | null>(null);
  useEffect(
    () => () => {
      ac.current?.close().catch(() => {});
    },
    [],
  );
  const play = (pan: number) => {
    if (!ac.current) ac.current = makeAudio();
    const a = ac.current;
    if (!a) return;
    a.resume().catch(() => {});
    const panner = a.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(a.destination);
    playTones(a, chime(pan >= 0), undefined, 0.3, panner);
  };
  return (
    <Panel title={`🔊 ${tr(T.speakers)}`}>
      <div class="row">
        <Button onClick={() => play(-1)}>◀ {tr(T.left)}</Button>
        <Button onClick={() => play(0)}>{tr(T.both)}</Button>
        <Button onClick={() => play(1)}>{tr(T.right)} ▶</Button>
      </div>
      <p class="muted small">{tr(T.speakerHint)}</p>
    </Panel>
  );
}
