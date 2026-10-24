import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Segmented, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { Group, NumberInput } from "../_ui";
import { longestLine, unwrapText, wrapText } from "./logic";

type Mode = "wrap" | "unwrap";

const PREFIXES = ["> ", "# ", "// ", "    "];

const T = {
  wrap: l("Wrap", "Couper"),
  unwrap: l("Unwrap", "Recoller"),
  width: l("Width (columns)", "Largeur (colonnes)"),
  prefix: l("Prefix on each line", "Préfixe de chaque ligne"),
  strip: l("Prefix to remove", "Préfixe à retirer"),
  indent: l("Indent", "Retrait"),
  none: l("None", "Aucun"),
  reflow: l("Join the lines of a paragraph first", "Recoller d'abord les lignes d'un paragraphe"),
  breakLong: l("Cut words longer than the width", "Couper les mots plus longs que la largeur"),
  input: l("Text", "Texte"),
  placeholder: l(
    "Paste text: paragraphs are separated by blank lines…",
    "Colle du texte : les paragraphes sont séparés par des lignes vides…",
  ),
  output: l("Result", "Résultat"),
  longest: l("Longest line: {n} characters", "Ligne la plus longue : {n} caractères"),
};

export default function Wrap() {
  const text = useToolState("text", "");
  const mode = useToolState<Mode>("mode", "wrap");
  const width = useToolState("width", 80);
  const prefix = useToolState("prefix", "");
  const reflow = useToolState("reflow", true);
  const breakLong = useToolState("breakLong", false);
  const output = useComputed(() =>
    mode.value === "wrap"
      ? wrapText(text.value, {
          width: width.value,
          prefix: prefix.value,
          reflow: reflow.value,
          breakLongWords: breakLong.value,
        })
      : unwrapText(text.value, prefix.value),
  );

  return (
    <>
      <div class="row tx-options">
        <Segmented<Mode>
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "wrap", label: tr(T.wrap) },
            { value: "unwrap", label: tr(T.unwrap) },
          ]}
        />
        {mode.value === "wrap" && (
          <Group label={tr(T.width)}>
            <div class="row">
              <NumberInput
                class="wrap-width"
                value={width.value}
                min={4}
                max={1000}
                label={tr(T.width)}
                onChange={(v) => {
                  width.value = v;
                }}
              />
              {[72, 80, 100].map((w) => (
                <Button
                  key={w}
                  size="sm"
                  variant={width.value === w ? "primary" : "secondary"}
                  onClick={() => {
                    width.value = w;
                  }}
                >
                  {w}
                </Button>
              ))}
            </div>
          </Group>
        )}
        <Group label={tr(mode.value === "wrap" ? T.prefix : T.strip)}>
          <div class="row">
            <input
              class="input mono wrap-prefix"
              value={prefix.value}
              aria-label={tr(mode.value === "wrap" ? T.prefix : T.strip)}
              onInput={(e) => {
                prefix.value = e.currentTarget.value;
              }}
            />
            {["", ...PREFIXES].map((p) => (
              <Button
                key={p || "none"}
                size="sm"
                variant={prefix.value === p ? "primary" : "secondary"}
                onClick={() => {
                  prefix.value = p;
                }}
              >
                {p === "" ? tr(T.none) : p.trim() ? <code>{p.trim()}</code> : tr(T.indent)}
              </Button>
            ))}
          </div>
        </Group>
      </div>
      {mode.value === "wrap" && (
        <div class="row">
          <Toggle
            checked={reflow.value}
            onChange={(v) => {
              reflow.value = v;
            }}
            label={tr(T.reflow)}
          />
          <Toggle
            checked={breakLong.value}
            onChange={(v) => {
              breakLong.value = v;
            }}
            label={tr(T.breakLong)}
          />
        </div>
      )}
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={text.value}
          onInput={(v) => {
            text.value = v;
          }}
          placeholder={tr(T.placeholder)}
          rows={18}
          wrap={false}
        />
        <TextBox
          label={tr(T.output)}
          value={output.value}
          readOnly
          rows={18}
          wrap={false}
          downloadName="wrapped.txt"
          note={
            output.value && (
              <span class="muted">
                {tr(T.longest).replace("{n}", fmt(longestLine(output.value)))}
              </span>
            )
          }
        />
      </div>
    </>
  );
}
