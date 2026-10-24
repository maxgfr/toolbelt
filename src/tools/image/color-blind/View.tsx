import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { Button, downloadBlob, ErrorNote, FileDrop, Segmented, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, lang, tr } from "../../../i18n";
import { ctx2d, decodeImage, drawScaled, encodeCanvas, makeCanvas } from "../_dom";
import { fitWithin, stem } from "../_shared";
import { errText, UI, usePasteImage } from "../_ui";
import { type Deficiency, PREVALENCE, SAMPLE_PAIRS, simulate } from "./logic";

type Source = "sample" | "image";

const T = {
  sample: l("Built-in sample", "Exemple intégré"),
  image: l("My image", "Mon image"),
  anomalous: l("Show the milder (anomalous) forms", "Afficher les formes atténuées (anomalies)"),
  original: l("Normal vision", "Vision normale"),
  download: l("Download PNG", "Télécharger en PNG"),
  men: l("men", "hommes"),
  women: l("women", "femmes"),
  note: l(
    "Simulation with the Machado et al. (2009) model; real perception varies from person to person.",
    "Simulation selon le modèle de Machado et al. (2009) ; la perception réelle varie d'une personne à l'autre.",
  ),
  empty: l("Choose an image to simulate.", "Choisis une image à simuler."),
  sampleTitle: l("Can you tell these apart?", "Arrives-tu à les distinguer ?"),
};

const INFO: Record<Deficiency, { name: L10n; desc: L10n }> = {
  protanopia: {
    name: l("Protanopia", "Protanopie"),
    desc: l("No red cones", "Pas de cônes rouges"),
  },
  deuteranopia: {
    name: l("Deuteranopia", "Deutéranopie"),
    desc: l("No green cones", "Pas de cônes verts"),
  },
  tritanopia: {
    name: l("Tritanopia", "Tritanopie"),
    desc: l("No blue cones", "Pas de cônes bleus"),
  },
  achromatopsia: {
    name: l("Achromatopsia", "Achromatopsie"),
    desc: l("No color at all", "Aucune couleur"),
  },
  protanomaly: {
    name: l("Protanomaly", "Protanomalie"),
    desc: l("Weak red cones", "Cônes rouges affaiblis"),
  },
  deuteranomaly: {
    name: l("Deuteranomaly", "Deutéranomalie"),
    desc: l("Weak green cones (most common)", "Cônes verts affaiblis (le plus fréquent)"),
  },
  tritanomaly: {
    name: l("Tritanomaly", "Tritanomalie"),
    desc: l("Weak blue cones", "Cônes bleus affaiblis"),
  },
  achromatomaly: {
    name: l("Achromatomaly", "Achromatomalie"),
    desc: l("Faded colors", "Couleurs ternes"),
  },
};

const MAIN: Deficiency[] = ["protanopia", "deuteranopia", "tritanopia", "achromatopsia"];
const MILD: Deficiency[] = ["protanomaly", "deuteranomaly", "tritanomaly", "achromatomaly"];

/** Longest side of the simulated images. */
const WORK_MAX = 900;

/** Draws the built-in sample: a hue band, confusable pairs, a small chart and a traffic light. */
function drawSample(title: string): ImageData {
  const W = 720;
  const H = 440;
  const c = makeCanvas(W, H);
  const ctx = ctx2d(c, true);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const band = ctx.createLinearGradient(20, 0, W - 20, 0);
  for (let i = 0; i <= 12; i++) band.addColorStop(i / 12, `hsl(${i * 30} 90% 50%)`);
  ctx.fillStyle = band;
  ctx.fillRect(20, 20, W - 40, 50);
  ctx.fillStyle = "#222222";
  ctx.font = "600 20px system-ui, sans-serif";
  ctx.fillText(title, 20, 108);
  SAMPLE_PAIRS.forEach(([a, b], i) => {
    const x = 20 + (i % 3) * 140;
    const y = 128 + Math.floor(i / 3) * 110;
    ctx.fillStyle = a;
    ctx.beginPath();
    ctx.arc(x + 40, y + 45, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.arc(x + 92, y + 45, 38, 0, Math.PI * 2);
    ctx.fill();
  });
  // Bar chart.
  const bars = ["#d62728", "#2ca02c", "#ff7f0e", "#1f77b4", "#9467bd"];
  bars.forEach((col, i) => {
    const h = [120, 90, 150, 70, 110][i] as number;
    ctx.fillStyle = col;
    ctx.fillRect(460 + i * 38, 350 - h, 30, h);
  });
  ctx.fillStyle = "#999999";
  ctx.fillRect(455, 350, 195, 2);
  // Traffic light.
  ctx.fillStyle = "#333333";
  ctx.fillRect(670, 120, 34, 96);
  ["#e53935", "#fdd835", "#43a047"].forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(687, 137 + i * 31, 12, 0, Math.PI * 2);
    ctx.fill();
  });
  // Red text on green.
  ctx.fillStyle = "#4caf50";
  ctx.fillRect(20, 370, 400, 50);
  ctx.fillStyle = "#e53935";
  ctx.font = "700 24px system-ui, sans-serif";
  ctx.fillText("Error / Erreur — OK", 34, 404);
  return ctx.getImageData(0, 0, W, H);
}

function Card({ data, kind, name }: { data: ImageData; kind: Deficiency | null; name: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    // Each simulation runs in its own task so the page stays responsive.
    const t = setTimeout(() => {
      c.width = data.width;
      c.height = data.height;
      const px = kind ? simulate(data.data, kind) : data.data;
      ctx2d(c).putImageData(
        new ImageData(new Uint8ClampedArray(px), data.width, data.height),
        0,
        0,
      );
    }, 0);
    return () => clearTimeout(t);
  }, [data, kind]);

  const info = kind ? INFO[kind] : null;
  const prev = kind ? PREVALENCE[kind] : null;
  const pct = (v: number) => fmt(v, { style: "percent", maximumSignificantDigits: 2 });
  return (
    <figure class="color-blind-card">
      <canvas
        ref={ref}
        class="color-blind-canvas"
        role="img"
        aria-label={info ? tr(info.name) : tr(T.original)}
      />
      <figcaption>
        <div class="row">
          <strong>{info ? tr(info.name) : tr(T.original)}</strong>
          <span class="spacer" />
          <Button
            size="sm"
            variant="ghost"
            icon="download"
            aria-label={tr(T.download)}
            title={tr(T.download)}
            onClick={async () => {
              if (!ref.current) return;
              const blob = await encodeCanvas(ref.current, "png");
              downloadBlob(blob, `${stem(name)}-${kind ?? "original"}.png`);
            }}
          />
        </div>
        {info && prev && (
          <span class="muted small">
            {tr(info.desc)} · {pct(prev.men)} {tr(T.men)}, {pct(prev.women)} {tr(T.women)}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

export default function ColorBlind() {
  const source = useToolState<Source>("source", "sample");
  const mild = useToolState("mild", false);
  const image = useSignal<ImageData | null>(null);
  const name = useSignal("sample");
  const error = useSignal<string | null>(null);
  const sample = useSignal<ImageData | null>(null);

  useEffect(() => {
    try {
      sample.value = drawSample(tr(T.sampleTitle));
    } catch (err) {
      error.value = errText(err);
    }
  }, [lang.value]);

  async function load(f: File) {
    error.value = null;
    try {
      const img = await decodeImage(f, f.name);
      const { w, h } = fitWithin(img.width, img.height, WORK_MAX, WORK_MAX);
      const c = drawScaled(img.source, img.width, img.height, w, h);
      img.close();
      image.value = ctx2d(c, true).getImageData(0, 0, w, h);
      name.value = f.name;
      source.value = "image";
    } catch (err) {
      error.value = errText(err);
    }
  }
  usePasteImage(load);

  const data = source.value === "sample" ? sample.value : image.value;
  const kinds = mild.value ? [...MAIN, ...MILD] : MAIN;

  return (
    <div class="stack">
      <div class="row">
        <Segmented<Source>
          value={source.value}
          onChange={(v) => {
            source.value = v;
          }}
          options={[
            { value: "sample", label: tr(T.sample) },
            { value: "image", label: tr(T.image) },
          ]}
        />
        <Toggle
          checked={mild.value}
          onChange={(v) => {
            mild.value = v;
          }}
          label={tr(T.anomalous)}
        />
      </div>
      {source.value === "image" && (
        <FileDrop
          accept="image/*,.svg"
          label={image.value ? name.value : tr(UI.drop)}
          onFiles={(f) => f[0] && load(f[0])}
        />
      )}
      <ErrorNote error={error.value} />
      {!data ? (
        source.value === "image" && (
          <p class="muted">
            {tr(T.empty)} {tr(UI.local)}
          </p>
        )
      ) : (
        <>
          <div class="color-blind-grid">
            <Card
              data={data}
              kind={null}
              name={source.value === "sample" ? "sample" : name.value}
            />
            {kinds.map((k) => (
              <Card
                key={k}
                data={data}
                kind={k}
                name={source.value === "sample" ? "sample" : name.value}
              />
            ))}
          </div>
          <p class="muted small">{tr(T.note)}</p>
        </>
      )}
    </div>
  );
}
