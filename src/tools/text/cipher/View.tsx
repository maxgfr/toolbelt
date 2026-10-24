import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, Field, Panel, Segmented, TextBox } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { applyCipher, bruteForce, type Cipher } from "./logic";

type Dir = "encode" | "decode";

const T = {
  input: l("Text", "Texte"),
  placeholder: l(
    "Type or paste text to encode or decode…",
    "Tape ou colle le texte à chiffrer ou déchiffrer…",
  ),
  output: l("Result", "Résultat"),
  caesar: l("Caesar", "César"),
  encode: l("Encode", "Chiffrer"),
  decode: l("Decode", "Déchiffrer"),
  shift: l("Shift: {n}", "Décalage : {n}"),
  rot13: l(
    "Each letter moves 13 places: applying it twice gives the text back.",
    "Chaque lettre avance de 13 places : l'appliquer deux fois redonne le texte.",
  ),
  rot47: l(
    "Rotates every printable ASCII character (letters, digits, punctuation) by 47; its own inverse.",
    "Fait tourner chaque caractère ASCII imprimable (lettres, chiffres, ponctuation) de 47 ; son propre inverse.",
  ),
  atbash: l(
    "Mirrors the alphabet: A ↔ Z, B ↔ Y…; its own inverse.",
    "Inverse l'alphabet : A ↔ Z, B ↔ Y… ; son propre inverse.",
  ),
  caesarHint: l(
    "Each letter moves by the shift. Accented letters, digits and symbols do not change.",
    "Chaque lettre avance du décalage. Les lettres accentuées, chiffres et symboles ne changent pas.",
  ),
  all: l("All 25 shifts (most readable first)", "Les 25 décalages (les plus lisibles d'abord)"),
  use: l("Use", "Utiliser"),
  swap: l("Use as input", "Reprendre en entrée"),
};

export default function CipherView() {
  const text = useToolState("text", "");
  const cipher = useToolState<Cipher>("cipher", "rot13");
  const shift = useToolState("shift", 3);
  const dir = useToolState<Dir>("dir", "encode");
  const output = useComputed(() =>
    applyCipher(text.value, cipher.value, shift.value, dir.value === "decode"),
  );
  const shifts = useComputed(() =>
    cipher.value === "caesar" && dir.value === "decode" && text.value.trim()
      ? bruteForce(text.value.slice(0, 2000))
      : [],
  );
  const hint = { rot13: T.rot13, rot47: T.rot47, atbash: T.atbash, caesar: T.caesarHint }[
    cipher.value
  ];

  return (
    <>
      <div class="row tx-options">
        <Segmented<Cipher>
          value={cipher.value}
          onChange={(v) => {
            cipher.value = v;
          }}
          options={[
            { value: "rot13", label: "ROT13" },
            { value: "rot47", label: "ROT47" },
            { value: "caesar", label: tr(T.caesar) },
            { value: "atbash", label: "Atbash" },
          ]}
        />
        {cipher.value === "caesar" && (
          <>
            <Segmented<Dir>
              value={dir.value}
              onChange={(v) => {
                dir.value = v;
              }}
              options={[
                { value: "encode", label: tr(T.encode) },
                { value: "decode", label: tr(T.decode) },
              ]}
            />
            <Field label={tr(T.shift).replace("{n}", String(shift.value))} class="cipher-shift">
              <input
                type="range"
                min={1}
                max={25}
                value={shift.value}
                onInput={(e) => {
                  shift.value = Number(e.currentTarget.value);
                }}
              />
            </Field>
          </>
        )}
      </div>
      <p class="muted small">{tr(hint)}</p>
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={text.value}
          onInput={(v) => {
            text.value = v;
          }}
          placeholder={tr(T.placeholder)}
          rows={12}
          mono={false}
        />
        <TextBox
          label={tr(T.output)}
          value={output.value}
          readOnly
          rows={12}
          mono={false}
          actions={
            output.value ? (
              <Button
                size="sm"
                variant="ghost"
                icon="swap"
                onClick={() => {
                  text.value = output.value;
                }}
              >
                {tr(T.swap)}
              </Button>
            ) : null
          }
        />
      </div>
      {shifts.value.length > 0 && (
        <Panel title={tr(T.all)}>
          <div class="table-wrap cipher-shifts">
            <table class="table">
              <tbody>
                {shifts.value.map((s) => (
                  <tr key={s.shift} class={s.shift === shift.value ? "cipher-current" : ""}>
                    <td class="num mono">{fmt(s.shift)}</td>
                    <td class="cipher-preview">{s.text.slice(0, 140)}</td>
                    <td class="num">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          shift.value = s.shift;
                        }}
                      >
                        {tr(T.use)}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
