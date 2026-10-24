/** UI pieces shared by the data tools: a located-error note and a sortable table preview. */
import { useMemo, useState } from "preact/hooks";
import { fmt, l, tr } from "../../i18n";
import { type Located, sortOrder } from "./_shared";

const T = {
  at: l("line {line}, column {col}", "ligne {line}, colonne {col}", "Zeile {line}, Spalte {col}"),
  sortBy: l("Sort by {col}", "Trier par {col}", "Nach {col} sortieren"),
  capped: l(
    "Showing the first {shown} rows of {total}.",
    "Affichage des {shown} premières lignes sur {total}.",
    "Die ersten {shown} von {total} Zeilen werden angezeigt.",
  ),
  rows: l("{n} rows", "{n} lignes", "{n} Zeilen"),
};

/** "line 3, column 7" in the current language. */
export function atText(line: number, column: number): string {
  return tr(T.at).replace("{line}", fmt(line)).replace("{col}", fmt(column));
}

/** The note under an input: ✓ and a label when valid, the located error otherwise. */
export function ParseNote({ error, ok }: { error: Located | null; ok?: string | undefined }) {
  if (error)
    return (
      <span class="error">
        {atText(error.line, error.column)} — {error.message}
      </span>
    );
  return ok ? <span class="success">✓ {ok}</span> : null;
}

/**
 * A table of text cells with sortable columns (click a header: ascending, descending, off).
 * Renders at most `max` rows and says so.
 */
export function DataTable({
  header,
  rows,
  max = 500,
}: {
  header: string[];
  rows: string[][];
  max?: number;
}) {
  const [sort, setSort] = useState<{ col: number; dir: "asc" | "desc" } | null>(null);
  const order = useMemo(
    () =>
      sort && sort.col < header.length
        ? sortOrder(rows, sort.col, sort.dir).slice(0, max)
        : rows.slice(0, max).map((_, i) => i),
    [rows, sort, header.length, max],
  );
  return (
    <div class="stack data-table">
      <div class="table-wrap data-table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th class="num data-table-idx">#</th>
              {header.map((h, i) => {
                const dir = sort?.col === i ? sort.dir : null;
                return (
                  <th
                    key={i}
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                  >
                    <button
                      type="button"
                      class="data-table-sort"
                      title={tr(T.sortBy).replace("{col}", h)}
                      onClick={() =>
                        setSort(
                          dir === null
                            ? { col: i, dir: "asc" }
                            : dir === "asc"
                              ? { col: i, dir: "desc" }
                              : null,
                        )
                      }
                    >
                      <span>{h}</span>
                      <span class="data-table-arrow" aria-hidden="true">
                        {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {order.map((i) => (
              <tr key={i}>
                <td class="num muted data-table-idx">{fmt(i + 1)}</td>
                {header.map((_, j) => (
                  <td key={j}>{rows[i]?.[j] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="muted small">
        {rows.length > max
          ? tr(T.capped).replace("{shown}", fmt(max)).replace("{total}", fmt(rows.length))
          : tr(T.rows).replace("{n}", fmt(rows.length))}
      </p>
    </div>
  );
}
