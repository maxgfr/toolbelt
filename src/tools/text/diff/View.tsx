import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, downloadText, Segmented, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import {
  foldRows,
  inlineDiff,
  lineRows,
  type Piece,
  type Row,
  summarize,
  unifiedPatch,
} from "./logic";

type Mode = "split" | "unified" | "word" | "char";

const T = {
  original: l("Original", "Original", "Original"),
  modified: l("Modified", "Modifié", "Geändert"),
  phA: l(
    "Paste the first text, or open / drop a file…",
    "Colle le premier texte, ou ouvre / dépose un fichier…",
    "Füge den ersten Text ein oder öffne / ziehe eine Datei hierher…",
  ),
  phB: l(
    "Paste the second text, or open / drop a file…",
    "Colle le second texte, ou ouvre / dépose un fichier…",
    "Füge den zweiten Text ein oder öffne / ziehe eine Datei hierher…",
  ),
  split: l("Side by side", "Côte à côte", "Nebeneinander"),
  unified: l("Unified", "Unifié", "Einheitlich"),
  word: l("Words", "Mots", "Wörter"),
  char: l("Characters", "Caractères", "Zeichen"),
  ignoreWs: l("Ignore whitespace", "Ignorer les espaces", "Leerzeichen ignorieren"),
  ignoreCase: l("Ignore case", "Ignorer la casse", "Groß-/Kleinschreibung ignorieren"),
  onlyChanges: l("Only changes", "Seulement les changements", "Nur Änderungen"),
  swap: l("Swap", "Inverser", "Tauschen"),
  patch: l("Download .patch", "Télécharger le .patch", ".patch herunterladen"),
  identical: l(
    "The two texts are identical.",
    "Les deux textes sont identiques.",
    "Die beiden Texte sind identisch.",
  ),
  empty: l(
    "Paste two texts to compare them.",
    "Colle deux textes pour les comparer.",
    "Füge zwei Texte ein, um sie zu vergleichen.",
  ),
  added: l("added", "ajoutées", "hinzugefügt"),
  removed: l("removed", "supprimées", "entfernt"),
  changed: l("changed", "modifiées", "geändert"),
  lines: l("lines", "lignes", "Zeilen"),
  hidden: l("unchanged lines", "lignes identiques", "unveränderte Zeilen"),
};

function Pieces({ pieces, cls }: { pieces: Piece[]; cls: string }) {
  return (
    <>
      {pieces.map((p, i) =>
        p.changed ? (
          <mark key={i} class={cls}>
            {p.text}
          </mark>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

type Item = Row | { kind: "fold"; count: number };

function SplitView({ items }: { items: Item[] }) {
  return (
    <table class="diff diff-split">
      <tbody>
        {items.map((r, i) =>
          r.kind === "fold" ? (
            <tr key={i} class="diff-fold">
              <td colSpan={4}>
                ⋯ {fmt(r.count)} {tr(T.hidden)}
              </td>
            </tr>
          ) : (
            <tr key={i} class={`diff-${r.kind}`}>
              <td class="diff-num">{r.left?.num ?? ""}</td>
              <td class={`diff-code ${r.left && r.kind !== "same" ? "side-del" : ""}`}>
                {r.left && <Pieces pieces={r.left.pieces} cls="hl-del" />}
              </td>
              <td class="diff-num">{r.right?.num ?? ""}</td>
              <td class={`diff-code ${r.right && r.kind !== "same" ? "side-add" : ""}`}>
                {r.right && <Pieces pieces={r.right.pieces} cls="hl-add" />}
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}

function UnifiedView({ items }: { items: Item[] }) {
  const lines: preact.JSX.Element[] = [];
  items.forEach((r, i) => {
    if (r.kind === "fold") {
      lines.push(
        <tr key={`f${i}`} class="diff-fold">
          <td colSpan={4}>
            ⋯ {fmt(r.count)} {tr(T.hidden)}
          </td>
        </tr>,
      );
      return;
    }
    if (r.kind === "same" && r.left && r.right)
      lines.push(
        <tr key={`s${i}`}>
          <td class="diff-num">{r.left.num}</td>
          <td class="diff-num">{r.right.num}</td>
          <td class="diff-sign"> </td>
          <td class="diff-code">
            <Pieces pieces={r.left.pieces} cls="" />
          </td>
        </tr>,
      );
    if (r.kind !== "same" && r.left)
      lines.push(
        <tr key={`d${i}`} class="diff-del">
          <td class="diff-num">{r.left.num}</td>
          <td class="diff-num" />
          <td class="diff-sign">−</td>
          <td class="diff-code side-del">
            <Pieces pieces={r.left.pieces} cls="hl-del" />
          </td>
        </tr>,
      );
    if (r.kind !== "same" && r.right)
      lines.push(
        <tr key={`a${i}`} class="diff-add">
          <td class="diff-num" />
          <td class="diff-num">{r.right.num}</td>
          <td class="diff-sign">+</td>
          <td class="diff-code side-add">
            <Pieces pieces={r.right.pieces} cls="hl-add" />
          </td>
        </tr>,
      );
  });
  return (
    <table class="diff diff-unified">
      <tbody>{lines}</tbody>
    </table>
  );
}

export default function Diff() {
  const a = useToolState("a", "");
  const b = useToolState("b", "");
  const nameA = useToolState("nameA", "original.txt", { share: false });
  const nameB = useToolState("nameB", "modified.txt", { share: false });
  const mode = useToolState<Mode>("mode", "split");
  const ignoreWhitespace = useToolState("ignoreWhitespace", false);
  const ignoreCase = useToolState("ignoreCase", false);
  const onlyChanges = useToolState("onlyChanges", true);

  const opts = useComputed(() => ({
    ignoreWhitespace: ignoreWhitespace.value,
    ignoreCase: ignoreCase.value,
  }));
  const rows = useComputed(() => lineRows(a.value, b.value, opts.value));
  const sum = useComputed(() => summarize(rows.value));
  const inline = useComputed(() =>
    mode.value === "word" || mode.value === "char"
      ? inlineDiff(a.value, b.value, mode.value, opts.value)
      : [],
  );
  const items = useComputed<Item[]>(() =>
    onlyChanges.value ? foldRows(rows.value, 3) : rows.value,
  );

  const s = sum.value;
  const identical = s.added + s.removed + s.changed === 0;
  const empty = !a.value && !b.value;

  return (
    <>
      <div class="grid-2">
        <TextBox
          label={`${tr(T.original)} · ${nameA.value}`}
          value={a.value}
          onInput={(v) => {
            a.value = v;
          }}
          onFileName={(n) => {
            nameA.value = n;
          }}
          placeholder={tr(T.phA)}
          rows={10}
          wrap={false}
        />
        <TextBox
          label={`${tr(T.modified)} · ${nameB.value}`}
          value={b.value}
          onInput={(v) => {
            b.value = v;
          }}
          onFileName={(n) => {
            nameB.value = n;
          }}
          placeholder={tr(T.phB)}
          rows={10}
          wrap={false}
        />
      </div>

      <div class="row">
        <Segmented<Mode>
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
          }}
          options={[
            { value: "split", label: tr(T.split) },
            { value: "unified", label: tr(T.unified) },
            { value: "word", label: tr(T.word) },
            { value: "char", label: tr(T.char) },
          ]}
        />
        <Toggle
          checked={ignoreWhitespace.value}
          onChange={(v) => {
            ignoreWhitespace.value = v;
          }}
          label={tr(T.ignoreWs)}
        />
        <Toggle
          checked={ignoreCase.value}
          onChange={(v) => {
            ignoreCase.value = v;
          }}
          label={tr(T.ignoreCase)}
        />
        {(mode.value === "split" || mode.value === "unified") && (
          <Toggle
            checked={onlyChanges.value}
            onChange={(v) => {
              onlyChanges.value = v;
            }}
            label={tr(T.onlyChanges)}
          />
        )}
        <span class="spacer" />
        <Button
          size="sm"
          icon="swap"
          onClick={() => {
            [a.value, b.value] = [b.value, a.value];
            [nameA.value, nameB.value] = [nameB.value, nameA.value];
          }}
        >
          {tr(T.swap)}
        </Button>
        <Button
          size="sm"
          icon="download"
          disabled={identical}
          onClick={() =>
            downloadText(
              unifiedPatch(a.value, b.value, nameA.value, nameB.value),
              `${nameB.value.replace(/\.[^.]+$/, "")}.patch`,
              "text/x-diff",
            )
          }
        >
          {tr(T.patch)}
        </Button>
      </div>

      {empty ? (
        <p class="muted">{tr(T.empty)}</p>
      ) : identical ? (
        <p class="diff-same-note">{tr(T.identical)}</p>
      ) : (
        <>
          <p class="diff-summary small">
            <span class="add-text">
              +{fmt(s.added)} {tr(T.added)}
            </span>
            <span class="del-text">
              −{fmt(s.removed)} {tr(T.removed)}
            </span>
            <span class="muted">
              ~{fmt(s.changed)} {tr(T.changed)}
            </span>
          </p>
          {mode.value === "split" && (
            <div class="diff-wrap">
              <SplitView items={items.value} />
            </div>
          )}
          {mode.value === "unified" && (
            <div class="diff-wrap">
              <UnifiedView items={items.value} />
            </div>
          )}
          {(mode.value === "word" || mode.value === "char") && (
            <pre class="diff-inline">
              {inline.value.map((p, i) =>
                p.kind === "same" ? (
                  p.text
                ) : (
                  <mark key={i} class={p.kind === "add" ? "hl-add" : "hl-del"}>
                    {p.text}
                  </mark>
                ),
              )}
            </pre>
          )}
        </>
      )}
    </>
  );
}
