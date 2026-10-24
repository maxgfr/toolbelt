import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Segmented, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, lang, tr } from "../../../i18n";
import { Empty, SearchBox } from "../_ui";
import { groupByClass, type StatusClass, searchStatuses } from "./logic";

const T = {
  search: l("Search a code, a name or a word…", "Chercher un code, un nom ou un mot…"),
  all: l("All", "Tous"),
  rare: l("Show rare and obsolete codes", "Afficher les codes rares et obsolètes"),
  none: l("No status code matches.", "Aucun code ne correspond."),
  count: l("{n} codes", "{n} codes"),
  rareTag: l("rare", "rare"),
};

const CLASS_L: Record<StatusClass, L10n> = {
  1: l("1xx · Informational", "1xx · Information"),
  2: l("2xx · Success", "2xx · Succès"),
  3: l("3xx · Redirection", "3xx · Redirection"),
  4: l("4xx · Client errors", "4xx · Erreurs du client"),
  5: l("5xx · Server errors", "5xx · Erreurs du serveur"),
};

type Filter = "0" | "1" | "2" | "3" | "4" | "5";

export default function HttpStatus() {
  const query = useToolState("q", "");
  const filter = useToolState<Filter>("class", "0");
  const rare = useToolState("rare", true);
  const groups = useComputed(() =>
    groupByClass(searchStatuses(query.value, Number(filter.value) as StatusClass | 0, rare.value)),
  );
  const total = groups.value.reduce((n, g) => n + g.items.length, 0);
  const fr = lang.value === "fr";

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
                    {fr && s.nameFr !== s.name && <span class="muted"> · {s.nameFr}</span>}
                    {s.rare && <span class="http-status-rare small">{tr(T.rareTag)}</span>}
                  </div>
                  <p class="small">{fr ? s.fr : s.en}</p>
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
