import { useEffect, useRef, useState } from "preact/hooks";
import { Badge } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, Panel, Segmented } from "../../../app/ui";
import { fmt, l, lang, tr } from "../../../i18n";
import { aspectRatio } from "../devices/logic";
import {
  cycle,
  defaultLayout,
  estimateRefresh,
  LAYOUTS,
  type Layout,
  layoutCodes,
  physicalPixels,
  TEST_COLORS,
} from "./logic";

type Tab = "info" | "pixels" | "keyboard";

const T = {
  info: l("Screen info", "Infos écran", "Bildschirminfos"),
  pixels: l("Dead pixels", "Pixels morts", "Pixelfehler"),
  keyboard: l("Keyboard", "Clavier", "Tastatur"),
  screen: l("Screen", "Écran", "Bildschirm"),
  available: l("Available area", "Zone disponible", "Verfügbarer Bereich"),
  window: l("Browser window", "Fenêtre du navigateur", "Browserfenster"),
  dpr: l("Device pixel ratio", "Densité de pixels (DPR)", "Pixeldichte (DPR)"),
  physical: l("Physical pixels", "Pixels physiques", "Physische Pixel"),
  depth: l("Color depth", "Profondeur de couleur", "Farbtiefe"),
  bits: l("{n} bits", "{n} bits", "{n} Bit"),
  refresh: l("Refresh rate (estimate)", "Fréquence (estimation)", "Bildwiederholrate (geschätzt)"),
  measuring: l("measuring…", "mesure…", "wird gemessen…"),
  measure: l("Measure again", "Mesurer à nouveau", "Erneut messen"),
  orientation: l("Orientation", "Orientation", "Ausrichtung"),
  touch: l("Touch points", "Points tactiles", "Touchpunkte"),
  features: l("Display features", "Capacités d'affichage", "Anzeigefunktionen"),
  gamut: l("Color gamut", "Gamut de couleurs", "Farbraum"),
  hdr: l("HDR (high dynamic range)", "HDR (grande plage dynamique)", "HDR (hoher Dynamikumfang)"),
  yes: l("yes", "oui", "ja"),
  no: l("no", "non", "nein"),
  dark: l("Prefers dark mode", "Préfère le mode sombre", "Bevorzugt dunkles Design"),
  motion: l("Prefers reduced motion", "Préfère moins d'animations", "Bevorzugt weniger Bewegung"),
  contrast: l("Prefers more contrast", "Préfère plus de contraste", "Bevorzugt mehr Kontrast"),
  pointer: l("Main pointer", "Pointeur principal", "Hauptzeiger"),
  fine: l("fine (mouse, trackpad)", "précis (souris, pavé)", "fein (Maus, Trackpad)"),
  coarse: l("coarse (finger)", "grossier (doigt)", "grob (Finger)"),
  none: l("none", "aucun", "keiner"),
  pixelsHelp: l(
    "Fills the screen with solid colors, one after another. Look closely for dots that stay black (dead) or stay lit in one color (stuck). Click, Space or → for the next color, ← to go back, Esc to leave.",
    "Remplit l'écran de couleurs unies, l'une après l'autre. Cherche de près les points qui restent noirs (morts) ou allumés d'une couleur (bloqués). Clic, Espace ou → pour la couleur suivante, ← pour revenir, Échap pour sortir.",
    "Füllt den Bildschirm nacheinander mit Vollfarben. Achte genau auf Punkte, die schwarz bleiben (tot) oder in einer Farbe leuchten (hängend). Klick, Leertaste oder → für die nächste Farbe, ← zurück, Esc zum Beenden.",
  ),
  startTest: l("Start full-screen test", "Lancer le test plein écran", "Vollbildtest starten"),
  hint: l(
    "Click or → next · ← back · Esc exit",
    "Clic ou → suivant · ← retour · Échap sortir",
    "Klick oder → weiter · ← zurück · Esc beenden",
  ),
  keysHelp: l(
    "Press keys: each one lights up while held, and stays marked once tested. Shortcuts with Ctrl or ⌘ still go to the browser.",
    "Appuie sur des touches : chacune s'allume pendant l'appui et reste marquée une fois testée. Les raccourcis avec Ctrl ou ⌘ vont toujours au navigateur.",
    "Drück Tasten: Jede leuchtet, solange sie gedrückt ist, und bleibt markiert, sobald sie getestet wurde. Tastenkürzel mit Strg oder ⌘ gehen weiterhin an den Browser.",
  ),
  tested: l("{n} of {m} keys tested", "{n} touches testées sur {m}", "{n} von {m} Tasten getestet"),
  last: l("Last key", "Dernière touche", "Letzte Taste"),
  others: l("Other keys pressed", "Autres touches appuyées", "Andere gedrückte Tasten"),
  reset: l("Reset", "Réinitialiser", "Zurücksetzen"),
  colon: l(": ", " : ", ": "),
};

export default function ScreenTest() {
  const tab = useToolState<Tab>("tab", "info");
  return (
    <div class="stack">
      <Segmented<Tab>
        value={tab.value}
        onChange={(v) => {
          tab.value = v;
        }}
        options={[
          { value: "info", label: tr(T.info) },
          { value: "pixels", label: tr(T.pixels) },
          { value: "keyboard", label: tr(T.keyboard) },
        ]}
      />
      {tab.value === "info" && <Info />}
      {tab.value === "pixels" && <Pixels />}
      {tab.value === "keyboard" && <Keyboard />}
    </div>
  );
}

function mq(q: string): boolean {
  return typeof matchMedia !== "undefined" && matchMedia(q).matches;
}

function readInfo() {
  const s = window.screen;
  return {
    sw: s.width,
    sh: s.height,
    aw: s.availWidth,
    ah: s.availHeight,
    iw: window.innerWidth,
    ih: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    depth: s.colorDepth,
    orientation: s.orientation?.type ?? (s.width >= s.height ? "landscape" : "portrait"),
    touch: navigator.maxTouchPoints ?? 0,
    gamut: mq("(color-gamut: rec2020)")
      ? "Rec. 2020"
      : mq("(color-gamut: p3)")
        ? "Display P3"
        : mq("(color-gamut: srgb)")
          ? "sRGB"
          : "–",
    hdr: mq("(dynamic-range: high)") || mq("(video-dynamic-range: high)"),
    dark: mq("(prefers-color-scheme: dark)"),
    motion: mq("(prefers-reduced-motion: reduce)"),
    contrast: mq("(prefers-contrast: more)"),
    pointer: mq("(pointer: fine)") ? "fine" : mq("(pointer: coarse)") ? "coarse" : "none",
  };
}

function Info() {
  const [info, setInfo] = useState(readInfo);
  const [rate, setRate] = useState<{ hz: number; snapped: number | null } | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const raf = useRef(0);

  const measure = () => {
    cancelAnimationFrame(raf.current);
    setMeasuring(true);
    const times: number[] = [];
    const step = (t: number) => {
      times.push(t);
      if (times.length < 2 || t - (times[0] as number) < 1200)
        raf.current = requestAnimationFrame(step);
      else {
        setRate(estimateRefresh(times.slice(5)));
        setMeasuring(false);
      }
    };
    raf.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    measure();
    const update = () => setInfo(readInfo());
    window.addEventListener("resize", update);
    const dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprQuery.addEventListener?.("change", update);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", update);
      dprQuery.removeEventListener?.("change", update);
    };
  }, []);

  const phys = physicalPixels(info.sw, info.sh, info.dpr);
  const yn = (b: boolean) => <Badge kind={b ? "ok" : "info"}>{tr(b ? T.yes : T.no)}</Badge>;
  return (
    <div class="grid-2">
      <Panel title={tr(T.screen)}>
        <dl class="stats">
          <div class="stat">
            <dt>{tr(T.screen)}</dt>
            <dd>
              {info.sw}×{info.sh} <small class="muted">{aspectRatio(info.sw, info.sh)}</small>
            </dd>
          </div>
          <div class="stat">
            <dt>{tr(T.physical)}</dt>
            <dd>
              {phys.w}×{phys.h}
            </dd>
          </div>
          <div class="stat">
            <dt>{tr(T.dpr)}</dt>
            <dd>{fmt(info.dpr, { maximumFractionDigits: 2 })}×</dd>
          </div>
          <div class="stat">
            <dt>{tr(T.refresh)}</dt>
            <dd>
              {measuring || !rate
                ? tr(T.measuring)
                : `${rate.snapped ?? fmt(rate.hz, { maximumFractionDigits: 0 })} Hz`}
            </dd>
          </div>
          <div class="stat">
            <dt>{tr(T.available)}</dt>
            <dd>
              {info.aw}×{info.ah}
            </dd>
          </div>
          <div class="stat">
            <dt>{tr(T.window)}</dt>
            <dd>
              {info.iw}×{info.ih}
            </dd>
          </div>
          <div class="stat">
            <dt>{tr(T.depth)}</dt>
            <dd>{tr(T.bits).replace("{n}", String(info.depth))}</dd>
          </div>
          <div class="stat">
            <dt>{tr(T.touch)}</dt>
            <dd>{info.touch}</dd>
          </div>
        </dl>
        <div class="row">
          <Button size="sm" icon="refresh" onClick={measure} disabled={measuring}>
            {tr(T.measure)}
          </Button>
          <span class="muted small">
            {tr(T.orientation)}
            {tr(T.colon)}
            {info.orientation}
          </span>
        </div>
      </Panel>
      <Panel title={tr(T.features)}>
        <table class="table screen-test-features">
          <tbody>
            <tr>
              <th>{tr(T.gamut)}</th>
              <td>
                <Badge kind="info">{info.gamut}</Badge>
              </td>
            </tr>
            <tr>
              <th>{tr(T.hdr)}</th>
              <td>{yn(info.hdr)}</td>
            </tr>
            <tr>
              <th>{tr(T.dark)}</th>
              <td>{yn(info.dark)}</td>
            </tr>
            <tr>
              <th>{tr(T.motion)}</th>
              <td>{yn(info.motion)}</td>
            </tr>
            <tr>
              <th>{tr(T.contrast)}</th>
              <td>{yn(info.contrast)}</td>
            </tr>
            <tr>
              <th>{tr(T.pointer)}</th>
              <td>
                {tr(
                  info.pointer === "fine" ? T.fine : info.pointer === "coarse" ? T.coarse : T.none,
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function Pixels() {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [hint, setHint] = useState(true);
  const ref = useRef<HTMLButtonElement>(null);

  const exit = () => {
    setActive(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    el?.focus();
    // Fullscreen when the browser allows it; otherwise the fixed overlay covers the page.
    el?.requestFullscreen?.().catch(() => {});
    const onFs = () => {
      if (!document.fullscreenElement) setActive(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        exit();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => cycle(i, TEST_COLORS.length, -1));
      } else if (e.key === "ArrowRight") {
        // Space and Enter "click" the focused full-screen button, which goes to the next color.
        e.preventDefault();
        setIndex((i) => cycle(i, TEST_COLORS.length, 1));
      }
    };
    const t = setTimeout(() => setHint(false), 2500);
    document.addEventListener("fullscreenchange", onFs);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("fullscreenchange", onFs);
      window.removeEventListener("keydown", onKey);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [active]);

  const color = TEST_COLORS[index] ?? TEST_COLORS[0];
  return (
    <Panel>
      <p class="muted">{tr(T.pixelsHelp)}</p>
      <div class="row">
        <Button
          variant="primary"
          onClick={() => {
            setIndex(0);
            setHint(true);
            setActive(true);
          }}
        >
          {tr(T.startTest)}
        </Button>
      </div>
      <div class="screen-test-swatches">
        {TEST_COLORS.map((c, i) => (
          <button
            key={c.css}
            type="button"
            class="screen-test-swatch"
            style={{ background: c.css }}
            title={tr(c)}
            aria-label={tr(c)}
            onClick={() => {
              setIndex(i);
              setHint(true);
              setActive(true);
            }}
          />
        ))}
      </div>
      {active && color && (
        <button
          ref={ref}
          type="button"
          class={`screen-test-full ${hint ? "" : "screen-test-nocursor"}`}
          style={{ background: color.css }}
          aria-label={tr(color)}
          onClick={() => setIndex((i) => cycle(i, TEST_COLORS.length, 1))}
          onContextMenu={(e) => {
            e.preventDefault();
            setIndex((i) => cycle(i, TEST_COLORS.length, -1));
          }}
          onMouseMove={() => setHint(true)}
        >
          {hint && (
            <span class="screen-test-hint">
              {tr(color)} · {index + 1}/{TEST_COLORS.length} · {tr(T.hint)}
            </span>
          )}
        </button>
      )}
    </Panel>
  );
}

function Keyboard() {
  const layout = useToolState<Layout>("layout", defaultLayout(lang.value));
  const [down, setDown] = useState<Set<string>>(new Set());
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [last, setLast] = useState<{ key: string; code: string } | null>(null);
  const known = layoutCodes(layout.value);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Let browser shortcuts through, but still show the modifier.
      } else if (e.code !== "Tab") e.preventDefault();
      const code = e.code || e.key;
      setDown((s) => new Set(s).add(code));
      setSeen((s) => (s.has(code) ? s : new Set(s).add(code)));
      setLast({ key: e.key, code });
    };
    const onUp = (e: KeyboardEvent) => {
      const code = e.code || e.key;
      setDown((s) => {
        const n = new Set(s);
        n.delete(code);
        return n;
      });
    };
    const clear = () => setDown(new Set());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
    };
  }, []);

  const tested = [...seen].filter((c) => known.has(c)).length;
  const others = [...seen].filter((c) => !known.has(c));

  return (
    <Panel>
      <div class="row">
        <Segmented<Layout>
          value={layout.value}
          onChange={(v) => {
            layout.value = v;
          }}
          options={[
            { value: "qwerty", label: "QWERTY" },
            { value: "azerty", label: "AZERTY" },
            { value: "qwertz", label: "QWERTZ" },
          ]}
        />
        <span class="muted small">
          {tr(T.tested).replace("{n}", String(tested)).replace("{m}", String(known.size))}
        </span>
        <span class="spacer" />
        <Button
          size="sm"
          variant="ghost"
          icon="reset"
          onClick={() => {
            setSeen(new Set());
            setDown(new Set());
            setLast(null);
          }}
        >
          {tr(T.reset)}
        </Button>
      </div>
      <p class="muted small">{tr(T.keysHelp)}</p>
      <div class="screen-test-keyboard" aria-hidden="true">
        {LAYOUTS[layout.value].map((row, r) => (
          <div
            key={r}
            class={`screen-test-row ${r === 0 || r === 6 ? "screen-test-row-small" : ""}`}
          >
            {row.map((k, i) =>
              k.code ? (
                <span
                  key={`${k.code}-${i}`}
                  class={`screen-test-key ${down.has(k.code) ? "down" : seen.has(k.code) ? "seen" : ""}`}
                  style={{ flexGrow: k.w, flexBasis: 0 }}
                >
                  {k.label}
                </span>
              ) : (
                <span
                  key={`gap-${i}`}
                  class="screen-test-gap"
                  style={{ flexGrow: k.w, flexBasis: 0 }}
                />
              ),
            )}
          </div>
        ))}
      </div>
      {last && (
        <p class="small">
          {tr(T.last)}
          {tr(T.colon)}
          <code class="mono">{JSON.stringify(last.key)}</code> ·{" "}
          <code class="mono">{last.code}</code>
        </p>
      )}
      {others.length > 0 && (
        <p class="small muted">
          {tr(T.others)}
          {tr(T.colon)}
          <span class="mono">{others.join(" ")}</span>
        </p>
      )}
    </Panel>
  );
}
