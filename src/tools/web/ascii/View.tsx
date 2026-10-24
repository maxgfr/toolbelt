import { useComputed } from "@preact/signals";
import { useState } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { copyText, Panel, Segmented, toast } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { S } from "../../../i18n/strings";
import { Empty, SearchBox } from "../_ui";
import {
  type AsciiFilter,
  type AsciiRow,
  combo,
  type KeyInfo,
  keyLabel,
  LOCATIONS,
  searchAscii,
} from "./logic";

const T = {
  inspector: l("Key inspector", "Inspecteur de touches", "Tasten-Inspektor"),
  press: l(
    "Click here, then press any key",
    "Clique ici, puis appuie sur une touche",
    "Klicke hier und drücke dann eine Taste",
  ),
  modifiers: l("Modifiers", "Modificateurs", "Modifikatoren"),
  location: l("Location", "Emplacement", "Position"),
  repeat: l("Repeat", "Répétition", "Wiederholung"),
  yes: l("yes", "oui", "ja"),
  no: l("no", "non", "nein"),
  history: l("Last keys:", "Dernières touches :", "Letzte Tasten:"),
  deprecated: l("deprecated", "obsolète", "veraltet"),
  tabNote: l(
    "Tab still moves the focus, so it is not captured.",
    "Tab déplace toujours le focus, il n'est donc pas capturé.",
    "Tab verschiebt weiterhin den Fokus und wird daher nicht erfasst.",
  ),
  table: l("ASCII table", "Table ASCII", "ASCII-Tabelle"),
  search: l(
    "Search a character, a code (65, 0x41) or a name…",
    "Chercher un caractère, un code (65, 0x41) ou un nom…",
    "Zeichen, Code (65, 0x41) oder Namen suchen…",
  ),
  all: l("All", "Tout", "Alle"),
  control: l("Control", "Contrôle", "Steuerzeichen"),
  printable: l("Printable", "Imprimables", "Druckbar"),
  letters: l("Letters", "Lettres", "Buchstaben"),
  digits: l("Digits", "Chiffres", "Ziffern"),
  symbols: l("Symbols", "Symboles", "Symbole"),
  dec: l("Dec", "Déc", "Dez"),
  hex: l("Hex", "Hex", "Hex"),
  oct: l("Oct", "Oct", "Okt"),
  bin: l("Binary", "Binaire", "Binär"),
  char: l("Char", "Car.", "Zeichen"),
  html: l("HTML", "HTML", "HTML"),
  other: l("Caret / escape", "Caret / échappement", "Caret / Escape"),
  name: l("Name", "Nom", "Name"),
  none: l("No character matches.", "Aucun caractère ne correspond.", "Kein Zeichen gefunden."),
  copyChar: l("Copy the character", "Copier le caractère", "Zeichen kopieren"),
};

function KeyInspector() {
  const [last, setLast] = useState<KeyInfo | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Tab" && !e.ctrlKey && !e.altKey && !e.metaKey) return;
    e.preventDefault();
    const info: KeyInfo = {
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      which: e.which,
      location: e.location,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      repeat: e.repeat,
    };
    setLast(info);
    if (!e.repeat) setHistory((h) => [combo(info, mac), ...h].slice(0, 12));
  }

  const mods = last
    ? [
        ["Ctrl", last.ctrlKey],
        ["Shift", last.shiftKey],
        ["Alt", last.altKey],
        ["Meta", last.metaKey],
      ]
    : [];

  return (
    <Panel title={tr(T.inspector)}>
      <button type="button" class="ascii-keyzone" aria-live="polite" onKeyDown={onKeyDown}>
        {last ? (
          <>
            <span class="ascii-bigkey">{keyLabel(last.key)}</span>
            <span class="mono muted">{combo(last, mac)}</span>
          </>
        ) : (
          <span class="muted">{tr(T.press)}</span>
        )}
      </button>
      {last && (
        <dl class="stats ascii-keyinfo">
          <div class="stat">
            <dt>event.key</dt>
            <dd class="mono">{JSON.stringify(last.key)}</dd>
          </div>
          <div class="stat">
            <dt>event.code</dt>
            <dd class="mono">{last.code || "—"}</dd>
          </div>
          <div class="stat">
            <dt>
              event.keyCode <span class="muted">({tr(T.deprecated)})</span>
            </dt>
            <dd class="mono">{last.keyCode}</dd>
          </div>
          <div class="stat">
            <dt>
              event.which <span class="muted">({tr(T.deprecated)})</span>
            </dt>
            <dd class="mono">{last.which}</dd>
          </div>
          <div class="stat">
            <dt>event.location</dt>
            <dd>
              <span class="mono">{last.location}</span>{" "}
              <span class="small muted">
                {tr(LOCATIONS[last.location] ?? LOCATIONS[0] ?? T.no)}
              </span>
            </dd>
          </div>
          <div class="stat">
            <dt>{tr(T.modifiers)}</dt>
            <dd class="ascii-mods">
              {mods.map(([name, on]) => (
                <kbd key={String(name)} class={on ? "on" : ""}>
                  {name}
                </kbd>
              ))}
            </dd>
          </div>
          <div class="stat">
            <dt>{tr(T.repeat)}</dt>
            <dd>{tr(last.repeat ? T.yes : T.no)}</dd>
          </div>
        </dl>
      )}
      {history.length > 0 && (
        <p class="small ascii-history">
          <span class="muted">{tr(T.history)}</span>{" "}
          {history.map((h, i) => (
            <kbd key={`${h}-${i}`}>{h}</kbd>
          ))}
        </p>
      )}
      <p class="muted small">{tr(T.tabNote)}</p>
    </Panel>
  );
}

function Row({ r }: { r: AsciiRow }) {
  return (
    <tr class={r.control ? "ascii-control" : ""}>
      <td class="num mono">{r.code}</td>
      <td class="num mono">{r.hex}</td>
      <td class="num mono">{r.oct}</td>
      <td class="mono muted">{r.bin}</td>
      <td>
        <button
          type="button"
          class="ascii-char mono"
          title={tr(T.copyChar)}
          onClick={async () => {
            const ok = await copyText(String.fromCharCode(r.code));
            toast(tr(ok ? S.copied : S.copyFailed), ok ? "success" : "error", 1200);
          }}
        >
          {r.control ? r.char : r.code === 32 ? "␠" : r.char}
        </button>
      </td>
      <td class="mono small">
        {r.html}
        {r.htmlNamed && <span class="muted"> {r.htmlNamed}</span>}
      </td>
      <td class="mono small">{[r.caret, r.escape].filter(Boolean).join("  ")}</td>
      <td class="small">{tr(r.name)}</td>
    </tr>
  );
}

export default function Ascii() {
  const query = useToolState("q", "");
  const filter = useToolState<AsciiFilter>("filter", "all");
  const rows = useComputed(() => searchAscii(query.value, filter.value));

  return (
    <>
      <KeyInspector />
      <Panel title={tr(T.table)}>
        <SearchBox
          value={query.value}
          onInput={(v) => {
            query.value = v;
          }}
          placeholder={tr(T.search)}
        />
        <div class="row">
          <Segmented<AsciiFilter>
            value={filter.value}
            onChange={(v) => {
              filter.value = v;
            }}
            options={[
              { value: "all", label: tr(T.all) },
              { value: "control", label: tr(T.control) },
              { value: "printable", label: tr(T.printable) },
              { value: "letters", label: tr(T.letters) },
              { value: "digits", label: tr(T.digits) },
              { value: "symbols", label: tr(T.symbols) },
            ]}
          />
          <span class="spacer" />
          <span class="muted small">{fmt(rows.value.length)} / 128</span>
        </div>
        {rows.value.length === 0 ? (
          <Empty>{tr(T.none)}</Empty>
        ) : (
          <div class="table-wrap ascii-table">
            <table class="table">
              <thead>
                <tr>
                  <th class="num">{tr(T.dec)}</th>
                  <th class="num">{tr(T.hex)}</th>
                  <th class="num">{tr(T.oct)}</th>
                  <th>{tr(T.bin)}</th>
                  <th>{tr(T.char)}</th>
                  <th>{tr(T.html)}</th>
                  <th>{tr(T.other)}</th>
                  <th>{tr(T.name)}</th>
                </tr>
              </thead>
              <tbody>
                {rows.value.map((r) => (
                  <Row key={r.code} r={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
