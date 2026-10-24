import { useComputed } from "@preact/signals";
import { useRef } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, IconButton, Panel, Segmented } from "../../../app/ui";
import { type L10n, l, pick, tr } from "../../../i18n";
import { Formula, formatNumber, plain } from "../_ui";
import { type Angle, type ErrorCode, evaluateSheet, type LineResult } from "./logic";

const T = {
  sheet: l("Calculations, one per line", "Calculs, un par ligne", "Rechnungen, eine pro Zeile"),
  results: l("Results", "Résultats", "Ergebnisse"),
  angle: l("Angles", "Angles", "Winkel"),
  deg: l("Degrees", "Degrés", "Grad"),
  rad: l("Radians", "Radians", "Bogenmaß"),
  clear: l("Clear", "Effacer", "Leeren"),
  example: l("Example", "Exemple", "Beispiel"),
  copyAll: l("Copy results", "Copier les résultats", "Ergebnisse kopieren"),
  history: l("History", "Historique", "Verlauf"),
  historyHint: l(
    "Press Enter after a line to keep its result here. Click one to reuse it.",
    "Appuie sur Entrée après une ligne pour garder son résultat ici. Clique pour le réutiliser.",
    "Drück nach einer Zeile Enter, um ihr Ergebnis hier zu behalten. Klick darauf, um es wiederzuverwenden.",
  ),
  clearHistory: l("Clear history", "Effacer l'historique", "Verlauf leeren"),
  emptyHistory: l("Nothing yet.", "Rien pour l'instant.", "Noch nichts."),
  help: l("What you can type", "Ce que tu peux écrire", "Was du eingeben kannst"),
  decimals: l(
    "Decimal separator: “.” — thousands: spaces or commas (1,000).",
    "Séparateur décimal : « , » ou « . » — milliers : espaces (1 000). Entre les valeurs d'une fonction : « ; » ou « , » suivi d'une espace.",
    "Dezimaltrennzeichen: „,“ oder „.“ – Tausender: Leerzeichen (1 000). Zwischen den Werten einer Funktion: „;“ oder „,“ mit Leerzeichen danach.",
  ),
};

const HELP: L10n[] = [
  l(
    "Operations: + − × ÷ (or * /), ^ for powers, ! for factorials, mod for remainders, parentheses.",
    "Opérations : + − × ÷ (ou * /), ^ pour les puissances, ! pour les factorielles, mod pour le reste, parenthèses.",
    "Rechenarten: + − × ÷ (oder * /), ^ für Potenzen, ! für Fakultäten, mod für den Rest, Klammern.",
  ),
  l(
    "Percentages: 20% is 0.2; 200 + 10% gives 220 and 200 − 25% gives 150, like a desk calculator.",
    "Pourcentages : 20% vaut 0,2 ; 200 + 10% donne 220 et 200 − 25% donne 150, comme une calculatrice de bureau.",
    "Prozente: 20% ist 0,2; 200 + 10% ergibt 220 und 200 − 25% ergibt 150, wie bei einem Tischrechner.",
  ),
  l(
    "Functions: sqrt, sin, cos, tan, asin, acos, atan, log (base 10, or log(x; base)), ln, exp, abs, round(x; decimals), floor, ceil, min, max, avg. Constants: pi (π), e.",
    "Fonctions : sqrt (racine), sin, cos, tan, asin, acos, atan, log (base 10, ou log(x; base)), ln, exp, abs, round(x; décimales), floor, ceil, min, max, avg (moy). Constantes : pi (π), e.",
    "Funktionen: sqrt (wurzel), sin, cos, tan, asin, acos, atan, log (Basis 10, oder log(x; Basis)), ln, exp, abs, round(x; Stellen) (runden), floor, ceil, min, max, avg (mittel). Konstanten: pi (π), e.",
  ),
  l(
    "Variables: “price = 12.5” on one line, then use price below. ans is the previous result; total (or sum) adds the results above, up to the last blank line.",
    "Variables : « prix = 12,5 » sur une ligne, puis prix plus bas. ans est le résultat précédent ; total (ou somme) additionne les résultats au-dessus, jusqu'à la dernière ligne vide.",
    "Variablen: „preis = 12,5“ in eine Zeile, dann preis weiter unten verwenden. ans ist das vorige Ergebnis; summe (oder total) addiert die Ergebnisse darüber, bis zur letzten Leerzeile.",
  ),
  l(
    "Notes: “Rent: 850” shows a label; anything after # or // is ignored.",
    "Notes : « Loyer : 850 » affiche un libellé ; tout ce qui suit # ou // est ignoré.",
    "Notizen: „Miete: 850“ zeigt eine Beschriftung; alles nach # oder // wird ignoriert.",
  ),
];

const EXAMPLE: L10n = l(
  "Rent: 850\nFood: 12 × 30\nPhone: 19.99\ntotal\n\nprice = 49.90\nprice - 20%\nsqrt(2) * 10\n2^10",
  "Loyer : 850\nCourses : 12 × 30\nTéléphone : 19,99\ntotal\n\nprix = 49,90\nprix - 20%\nracine(2) * 10\n2^10",
  "Miete: 850\nEinkauf: 12 × 30\nHandy: 19,99\nsumme\n\npreis = 49,90\npreis - 20%\nwurzel(2) * 10\n2^10",
);

const ERR: Record<ErrorCode, L10n> = {
  char: l("Unknown character “{d}”", "Caractère inconnu « {d} »", "Unbekanntes Zeichen „{d}“"),
  syntax: l("Can't read this near “{d}”", "Illisible près de « {d} »", "Unverständlich bei „{d}“"),
  paren: l(
    "A parenthesis is missing or extra",
    "Une parenthèse manque ou est en trop",
    "Eine Klammer fehlt oder ist zu viel",
  ),
  name: l("Unknown name “{d}”", "Nom inconnu « {d} »", "Unbekannter Name „{d}“"),
  func: l("Unknown function “{d}”", "Fonction inconnue « {d} »", "Unbekannte Funktion „{d}“"),
  args: l(
    "Wrong number of values for {d}()",
    "Mauvais nombre de valeurs pour {d}()",
    "Falsche Anzahl an Werten für {d}()",
  ),
  divZero: l("Division by zero", "Division par zéro", "Division durch null"),
  domain: l(
    "No result (e.g. √ of a negative number)",
    "Pas de résultat (ex. √ d'un nombre négatif)",
    "Kein Ergebnis (z. B. √ einer negativen Zahl)",
  ),
  overflow: l("Number too large", "Nombre trop grand", "Zahl zu groß"),
  reserved: l(
    "“{d}” is a built-in name, pick another",
    "« {d} » est un nom réservé, choisis-en un autre",
    "„{d}“ ist ein reservierter Name, nimm einen anderen",
  ),
};
const INCOMPLETE = l("Incomplete expression", "Expression incomplète", "Unvollständiger Ausdruck");

function errorText(r: Extract<LineResult, { kind: "error" }>): string {
  if (r.code === "syntax" && (r.detail === "end" || !r.detail)) return tr(INCOMPLETE);
  return tr(ERR[r.code]).replace("{d}", r.detail);
}

type HistoryItem = {
  expr: string;
  value: number;
};

export default function Calculator() {
  const text = useToolState("text", tr(EXAMPLE));
  const angle = useToolState<Angle>("angle", "deg");
  const history = useToolState<HistoryItem[]>("history", []);
  const area = useRef<HTMLTextAreaElement>(null);
  const side = useRef<HTMLElement>(null);

  const results = useComputed(() =>
    evaluateSheet(text.value, {
      angle: angle.value,
      decimalComma: pick({ en: false, fr: true, de: true }),
    }),
  );
  const lines = results.value;

  function remember() {
    const el = area.current;
    if (!el) return;
    const idx = el.value.slice(0, el.selectionStart).split("\n").length - 1;
    const r = results.value[idx];
    const expr = (el.value.split("\n")[idx] ?? "").trim();
    if (r?.kind !== "value" || !expr) return;
    const last = history.value[0];
    if (last && last.expr === expr && last.value === r.value) return;
    history.value = [{ expr, value: r.value }, ...history.value].slice(0, 30);
  }

  return (
    <>
      <div class="row">
        <Segmented<Angle>
          label={tr(T.angle)}
          value={angle.value}
          onChange={(v) => {
            angle.value = v;
          }}
          options={[
            { value: "deg", label: tr(T.deg) },
            { value: "rad", label: tr(T.rad) },
          ]}
        />
        <span class="spacer" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            text.value = tr(EXAMPLE);
          }}
        >
          {tr(T.example)}
        </Button>
        <CopyButton
          label={tr(T.copyAll)}
          text={() =>
            text.value
              .split("\n")
              .map((line, i) => {
                const r = results.value[i];
                return r?.kind === "value" ? `${line.trimEnd()} = ${plain(r.value, 10)}` : line;
              })
              .join("\n")
          }
        />
        <IconButton
          icon="trash"
          label={tr(T.clear)}
          onClick={() => {
            text.value = "";
            area.current?.focus();
          }}
        />
      </div>

      <div class="calculator-sheet">
        <textarea
          ref={area}
          class="input textarea mono nowrap calculator-input"
          aria-label={tr(T.sheet)}
          value={text.value}
          rows={12}
          spellcheck={false}
          onInput={(e) => {
            text.value = (e.currentTarget as HTMLTextAreaElement).value;
          }}
          onScroll={(e) => {
            if (side.current) side.current.scrollTop = (e.currentTarget as HTMLElement).scrollTop;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) remember();
          }}
        />
        <section class="calculator-results mono" ref={side} aria-label={tr(T.results)}>
          {lines.map((r, i) => (
            <div key={i} class={`calculator-line ${r.kind === "error" ? "error" : ""}`}>
              {r.kind === "value" && (
                <span title={plain(r.value, 12)}>
                  {r.name ? <span class="muted">{r.name} = </span> : "= "}
                  {formatNumber(r.value)}
                </span>
              )}
              {r.kind === "error" && <span title={errorText(r)}>⚠ {errorText(r)}</span>}
            </div>
          ))}
        </section>
      </div>
      <p class="muted small">{tr(T.decimals)}</p>

      <Panel
        title={tr(T.history)}
        actions={
          history.value.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              icon="trash"
              onClick={() => {
                history.value = [];
              }}
            >
              {tr(T.clearHistory)}
            </Button>
          )
        }
      >
        <p class="muted small">{tr(T.historyHint)}</p>
        {history.value.length === 0 ? (
          <p class="muted small">{tr(T.emptyHistory)}</p>
        ) : (
          <ul class="calculator-history">
            {history.value.map((h, i) => (
              <li key={i}>
                <button
                  type="button"
                  class="calculator-history-item mono"
                  onClick={() => {
                    const t = text.value;
                    text.value = `${t}${t && !t.endsWith("\n") ? "\n" : ""}${h.expr}`;
                    area.current?.focus();
                  }}
                >
                  <span>{h.expr}</span>
                  <strong>= {formatNumber(h.value)}</strong>
                </button>
                <CopyButton text={plain(h.value, 12)} label="" />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Formula title={tr(T.help)}>
        {HELP.map((h) => (
          <p key={h.en}>{tr(h)}</p>
        ))}
      </Formula>
    </>
  );
}
