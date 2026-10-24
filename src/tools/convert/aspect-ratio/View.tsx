import { useToolState } from "../../../app/state";
import { Button, CopyButton, ErrorNote, Field, IconButton, Panel, Stats } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { parseNumber } from "../_shared";
import { exactSizes, nearestCommon, scale, simplify } from "./logic";

const T = {
  size: l("Size", "Dimensions"),
  width: l("Width", "Largeur"),
  height: l("Height", "Hauteur"),
  swap: l("Swap width and height", "Inverser largeur et hauteur"),
  presets: l("Presets", "Formats courants"),
  invalid: l(
    "Width and height must be numbers above zero.",
    "Largeur et hauteur doivent être des nombres positifs.",
  ),
  ratio: l("Ratio", "Ratio"),
  decimal: l("Decimal", "Décimal"),
  nearest: l("Closest common", "Format courant proche"),
  exact: l("exact", "exact"),
  off: l("{p} off", "écart {p}"),
  shape: l("Shape", "Forme"),
  landscape: l("Landscape", "Paysage"),
  portrait: l("Portrait", "Portrait"),
  square: l("Square", "Carré"),
  resize: l("Resize keeping the ratio", "Redimensionner en gardant le ratio"),
  newWidth: l("New width", "Nouvelle largeur"),
  newHeight: l("New height", "Nouvelle hauteur"),
  rounded: l("rounded: {n}", "arrondi : {n}"),
  sizes: l("Sizes with whole pixels", "Tailles en pixels entiers"),
};

const PRESETS = [
  [16, 9],
  [4, 3],
  [3, 2],
  [21, 9],
  [1, 1],
  [9, 16],
  [4, 5],
] as const;

type Side = "width" | "height";

export default function AspectRatio() {
  const width = useToolState("width", "1920");
  const height = useToolState("height", "1080");
  const side = useToolState<Side>("side", "width");
  const target = useToolState("target", "1280");

  const w = parseNumber(width.value);
  const h = parseNumber(height.value);
  const r = w !== null && h !== null ? simplify(w, h) : null;
  const near = r ? nearestCommon(r.value) : null;
  const t = parseNumber(target.value);
  const other = r && t !== null ? scale(r.value, side.value, t) : null;
  const ratioText = r
    ? `${fmt(r.w, { useGrouping: false })}:${fmt(r.h, { useGrouping: false })}`
    : "";

  const num = (sig: typeof width, label: string) => (
    <Field label={label}>
      <input
        class="input"
        type="text"
        inputMode="decimal"
        value={sig.value}
        aria-invalid={parseNumber(sig.value) === null || (parseNumber(sig.value) ?? 0) <= 0}
        onInput={(e) => {
          sig.value = (e.currentTarget as HTMLInputElement).value;
        }}
      />
    </Field>
  );

  const scaleField = (s: Side) => {
    const own = side.value === s;
    const shown = own ? target.value : other === null ? "" : String(Math.round(other * 100) / 100);
    return (
      <Field
        label={tr(s === "width" ? T.newWidth : T.newHeight)}
        hint={
          !own && other !== null && !Number.isInteger(other)
            ? tr(T.rounded).replace("{n}", fmt(Math.round(other)))
            : ""
        }
      >
        <input
          class="input"
          type="text"
          inputMode="decimal"
          value={shown}
          onInput={(e) => {
            side.value = s;
            target.value = (e.currentTarget as HTMLInputElement).value;
          }}
        />
      </Field>
    );
  };

  // The preview fits in a 220 × 160 box.
  const box = r
    ? r.value >= 220 / 160
      ? { width: 220, height: 220 / r.value }
      : { width: 160 * r.value, height: 160 }
    : null;

  return (
    <>
      <div class="grid-2">
        <Panel title={tr(T.size)}>
          <div class="ar-size">
            {num(width, tr(T.width))}
            <IconButton
              icon="swap"
              label={tr(T.swap)}
              onClick={() => {
                [width.value, height.value] = [height.value, width.value];
              }}
            />
            {num(height, tr(T.height))}
          </div>
          <div class="row">
            <span class="muted small">{tr(T.presets)}</span>
            {PRESETS.map(([a, b]) => (
              <Button
                key={`${a}:${b}`}
                size="sm"
                variant={r && r.w === a && r.h === b ? "primary" : "secondary"}
                onClick={() => {
                  width.value = String(a);
                  height.value = String(b);
                }}
              >
                {a}:{b}
              </Button>
            ))}
          </div>
          {!r && <ErrorNote error={tr(T.invalid)} />}
        </Panel>
        <Panel>
          <div class="ar-preview-wrap">
            {box && (
              <div
                class="ar-preview"
                style={{ width: `${box.width}px`, height: `${box.height}px` }}
              >
                <span class="mono">{ratioText}</span>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {r && near && (
        <>
          <div class="ar-ratio">
            <strong class="mono">{ratioText}</strong>
            <CopyButton text={ratioText.replace(/\s/g, "")} />
          </div>
          <Stats
            items={[
              { label: tr(T.decimal), value: fmt(r.value, { maximumFractionDigits: 4 }) },
              {
                label: tr(T.nearest),
                value:
                  near.off < 1e-9
                    ? `${near.w}:${near.h} · ${tr(T.exact)}`
                    : `${near.w}:${near.h} · ${tr(T.off).replace("{p}", fmt(near.off, { style: "percent", maximumFractionDigits: 1 }))}`,
              },
              {
                label: tr(T.shape),
                value: tr(r.value > 1 ? T.landscape : r.value < 1 ? T.portrait : T.square),
              },
            ]}
          />
          <Panel title={tr(T.resize)}>
            <div class="grid-2">
              {scaleField("width")}
              {scaleField("height")}
            </div>
          </Panel>
          {exactSizes(r.w, r.h).length > 0 && (
            <Panel title={tr(T.sizes)}>
              <div class="row">
                {exactSizes(r.w, r.h).map((s) => (
                  <Button
                    key={s.w}
                    size="sm"
                    variant="ghost"
                    class="mono"
                    onClick={() => {
                      side.value = "width";
                      target.value = String(s.w);
                    }}
                  >
                    {s.w}×{s.h}
                  </Button>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </>
  );
}
