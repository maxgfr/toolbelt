import { useComputed } from "@preact/signals";
import { NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { ErrorNote, Panel, Segmented, TextBox, Toggle } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { FONTS } from "./fonts";
import {
  type Align,
  BOX_STYLES,
  type BoxStyle,
  banner,
  box,
  type Font,
  type LayoutChoice,
  parseFont,
} from "./logic";

type FontId = keyof typeof FONTS;

const FONT_NAMES: Record<FontId, string> = {
  standard: "Standard",
  small: "Small",
  big: "Big",
  slant: "Slant",
  banner3: "Banner3",
};

const T = {
  text: l("Text", "Texte"),
  placeholder: l("Type a word or a short line…", "Tape un mot ou une courte ligne…"),
  banner: l("FIGlet banner", "Bannière FIGlet"),
  font: l("Font", "Police"),
  layout: l("Letter spacing", "Espacement des lettres"),
  layoutFont: l("Font default", "Celui de la police"),
  full: l("Full width", "Pleine largeur"),
  fit: l("Fitted", "Ajusté"),
  smush: l("Smushed", "Fusionné"),
  width: l("Max width", "Largeur max"),
  widthHint: l("0 = no wrapping", "0 = pas de retour à la ligne"),
  cols: l("cols", "col."),
  align: l("Alignment", "Alignement"),
  left: l("Left", "Gauche"),
  center: l("Center", "Centre"),
  right: l("Right", "Droite"),
  frame: l("Frame", "Cadre"),
  on: l("On", "Activé"),
  style: l("Border", "Bordure"),
  padX: l("Side padding", "Marge latérale"),
  padY: l("Top & bottom padding", "Marge haut et bas"),
  result: l("Result", "Résultat"),
  styles: {
    single: l("Single line", "Trait simple"),
    double: l("Double line", "Trait double"),
    rounded: l("Rounded", "Arrondi"),
    heavy: l("Heavy", "Épais"),
    ascii: l("ASCII (+-|)", "ASCII (+-|)"),
    stars: l("Stars", "Étoiles"),
    hash: l("Hashes", "Dièses"),
  } satisfies Record<BoxStyle, unknown>,
  credits: l(
    "FIGlet fonts by Glenn Chappell & Ian Chai (Standard, Small, Big, Slant) and Merlin Greywolf (Banner3). Characters a font lacks lose their accents or become “?”.",
    "Polices FIGlet de Glenn Chappell et Ian Chai (Standard, Small, Big, Slant) et Merlin Greywolf (Banner3). Les caractères absents d'une police perdent leurs accents ou deviennent « ? ».",
  ),
};

const cache = new Map<FontId, Font>();
function font(id: FontId): Font {
  let f = cache.get(id);
  if (!f) {
    f = parseFont(FONTS[id]);
    cache.set(id, f);
  }
  return f;
}

export default function AsciiArt() {
  const text = useToolState("text", "Hello");
  const useBanner = useToolState("banner", true);
  const fontId = useToolState<string>("font", "standard");
  const layout = useToolState<string>("layout", "font");
  const width = useToolState("width", 80);
  const align = useToolState<string>("align", "left");
  const useFrame = useToolState("frame", false);
  const style = useToolState<string>("style", "single");
  const padX = useToolState("padX", 1);
  const padY = useToolState("padY", 0);

  const fid = useComputed<FontId>(() =>
    fontId.value in FONTS ? (fontId.value as FontId) : "standard",
  );
  const al = useComputed<Align>(() =>
    align.value === "center" || align.value === "right" ? align.value : "left",
  );
  const st = useComputed<BoxStyle>(() =>
    style.value in BOX_STYLES ? (style.value as BoxStyle) : "single",
  );

  const result = useComputed<{ out: string; error: string | null }>(() => {
    try {
      let out = text.value;
      if (useBanner.value)
        out = banner(out, font(fid.value), {
          layout: (["font", "full", "fit", "smush"].includes(layout.value)
            ? layout.value
            : "font") as LayoutChoice,
          width: Math.max(0, Math.round(width.value) || 0),
          align: al.value,
        });
      if (useFrame.value && out !== "")
        out = box(out, { style: st.value, padX: padX.value, padY: padY.value, align: al.value });
      return { out, error: null };
    } catch (err) {
      return { out: "", error: err instanceof Error ? err.message : String(err) };
    }
  });

  return (
    <>
      <TextBox
        label={tr(T.text)}
        value={text.value}
        onInput={(v) => {
          text.value = v;
        }}
        placeholder={tr(T.placeholder)}
        rows={3}
        files={false}
      />
      <div class="grid-2">
        <Panel
          title={tr(T.banner)}
          actions={
            <Toggle
              checked={useBanner.value}
              onChange={(v) => {
                useBanner.value = v;
              }}
              label={tr(T.on)}
            />
          }
        >
          <div class={`ascii-art-opts ${useBanner.value ? "" : "ascii-art-off"}`}>
            <Select
              label={tr(T.font)}
              value={fid.value}
              onChange={(v) => {
                fontId.value = v;
              }}
              options={(Object.keys(FONTS) as FontId[]).map((id) => ({
                value: id,
                label: FONT_NAMES[id],
              }))}
            />
            <Select
              label={tr(T.layout)}
              value={layout.value}
              onChange={(v) => {
                layout.value = v;
              }}
              options={[
                { value: "font", label: tr(T.layoutFont) },
                { value: "full", label: tr(T.full) },
                { value: "fit", label: tr(T.fit) },
                { value: "smush", label: tr(T.smush) },
              ]}
            />
            <NumberField
              label={tr(T.width)}
              hint={tr(T.widthHint)}
              value={width.value}
              min={0}
              max={1000}
              integer
              suffix={tr(T.cols)}
              onChange={(v) => {
                width.value = v;
              }}
            />
          </div>
        </Panel>
        <Panel
          title={tr(T.frame)}
          actions={
            <Toggle
              checked={useFrame.value}
              onChange={(v) => {
                useFrame.value = v;
              }}
              label={tr(T.on)}
            />
          }
        >
          <div class={`ascii-art-opts ${useFrame.value ? "" : "ascii-art-off"}`}>
            <Select
              label={tr(T.style)}
              value={st.value}
              onChange={(v) => {
                style.value = v;
              }}
              options={(Object.keys(BOX_STYLES) as BoxStyle[]).map((s) => ({
                value: s,
                label: `${BOX_STYLES[s].slice(0, 3)}  ${tr(T.styles[s])}`,
              }))}
            />
            <NumberField
              label={tr(T.padX)}
              value={padX.value}
              min={0}
              max={20}
              integer
              onChange={(v) => {
                padX.value = v;
              }}
            />
            <NumberField
              label={tr(T.padY)}
              value={padY.value}
              min={0}
              max={10}
              integer
              onChange={(v) => {
                padY.value = v;
              }}
            />
          </div>
        </Panel>
      </div>
      <div class="row">
        <Segmented<string>
          label={tr(T.align)}
          value={al.value}
          onChange={(v) => {
            align.value = v;
          }}
          options={[
            { value: "left", label: tr(T.left) },
            { value: "center", label: tr(T.center) },
            { value: "right", label: tr(T.right) },
          ]}
        />
      </div>
      <ErrorNote error={result.value.error} />
      <div class="ascii-art-result">
        <TextBox
          label={tr(T.result)}
          value={result.value.out}
          readOnly
          rows={Math.min(30, Math.max(6, result.value.out.split("\n").length + 1))}
          wrap={false}
          downloadName="ascii-art.txt"
        />
      </div>
      <p class="muted small">{tr(T.credits)}</p>
    </>
  );
}
