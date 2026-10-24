import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Segmented, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, pick, tr } from "../../../i18n";
import { Empty, SearchBox } from "../_ui";
import type { Status } from "./data";
import { groupByClass, type StatusClass, searchStatuses } from "./logic";

const T = {
  search: l(
    "Search a code, a name or a word…",
    "Chercher un code, un nom ou un mot…",
    "Code, Namen oder Begriff suchen…",
  ),
  all: l("All", "Tous", "Alle"),
  rare: l(
    "Show rare and obsolete codes",
    "Afficher les codes rares et obsolètes",
    "Seltene und veraltete Codes anzeigen",
  ),
  none: l("No status code matches.", "Aucun code ne correspond.", "Kein Statuscode gefunden."),
  count: l("{n} codes", "{n} codes", "{n} Codes"),
  rareTag: l("rare", "rare", "selten"),
};

const CLASS_L: Record<StatusClass, L10n> = {
  1: l("1xx · Informational", "1xx · Information", "1xx · Information"),
  2: l("2xx · Success", "2xx · Succès", "2xx · Erfolg"),
  3: l("3xx · Redirection", "3xx · Redirection", "3xx · Weiterleitung"),
  4: l("4xx · Client errors", "4xx · Erreurs du client", "4xx · Client-Fehler"),
  5: l("5xx · Server errors", "5xx · Erreurs du serveur", "5xx · Server-Fehler"),
};

/** The reason phrase in the current language (the standard English one in English). */
const localName = (s: Status) => pick({ en: s.name, fr: s.nameFr, de: s.nameDe });

type Filter = "0" | "1" | "2" | "3" | "4" | "5";

export default function HttpStatus() {
  const query = useToolState("q", "");
  const filter = useToolState<Filter>("class", "0");
  const rare = useToolState("rare", true);
  const groups = useComputed(() =>
    groupByClass(searchStatuses(query.value, Number(filter.value) as StatusClass | 0, rare.value)),
  );
  const total = groups.value.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <SearchBox
        value={query.value}
        onInput={(v) => {
          query.value = v;
        }}
        placeholder={tr(T.search)}
      />
      <div class="row">
        <Segmented<Filter>
          value={filter.value}
          onChange={(v) => {
            filter.value = v;
          }}
          options={[
            { value: "0", label: tr(T.all) },
            ...(["1", "2", "3", "4", "5"] as const).map((c) => ({ value: c, label: `${c}xx` })),
          ]}
        />
        <Toggle
          checked={rare.value}
          onChange={(v) => {
            rare.value = v;
          }}
          label={tr(T.rare)}
        />
        <span class="spacer" />
        <span class="muted small">{tr(T.count).replace("{n}", fmt(total))}</span>
      </div>
      {total === 0 && <Empty>{tr(T.none)}</Empty>}
      {groups.value.map((g) => (
        <section key={g.cls} class="stack http-status-group">
          <h2 class="panel-title">{tr(CLASS_L[g.cls])}</h2>
          <ul class="http-status-list">
            {g.items.map((s) => (
              <li key={s.code} class={`http-status-item http-status-${g.cls}xx`}>
                <span class="http-status-code mono">{s.code}</span>
                <div class="http-status-body">
                  <div class="http-status-title">
                    <strong>{s.name}</strong>
                    {localName(s) !== s.name && <span class="muted"> · {localName(s)}</span>}
                    {s.rare && <span class="http-status-rare small">{tr(T.rareTag)}</span>}
                  </div>
                  <p class="small">{pick(s)}</p>
                  <span class="muted small">{s.ref}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
