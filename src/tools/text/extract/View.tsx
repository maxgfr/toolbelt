import { useComputed } from "@preact/signals";
import { Badge } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, downloadText, Panel, TextBox, Toggle } from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { extractAll, KINDS, type Kind, toCsv } from "./logic";

const T = {
  text: l("Text", "Texte"),
  placeholder: l(
    "Paste any text: an email thread, a log, a web page, a CSV…",
    "Colle n'importe quel texte : un fil d'e-mails, un journal, une page web, un CSV…",
  ),
  find: l("What to extract", "Quoi extraire"),
  all: l("All", "Tout"),
  none: l("None", "Aucun"),
  dedupe: l("Remove duplicates", "Supprimer les doublons"),
  sort: l("Sort", "Trier"),
  copyAll: l("Copy all", "Tout copier"),
  csv: l("Export CSV", "Exporter en CSV"),
  results: l("Results", "Résultats"),
  nothing: l(
    "Nothing found for the selected kinds.",
    "Rien de trouvé pour les types sélectionnés.",
  ),
  empty: l("Paste a text above to extract from it.", "Colle un texte ci-dessus pour en extraire."),
  cardNote: l(
    "Card-like numbers are only checked with the Luhn checksum: this says nothing about a real card.",
    "Les numéros de type carte sont seulement vérifiés par la clé de Luhn : cela ne dit rien d'une vraie carte.",
  ),
};

const NAMES: Record<Kind, L10n> = {
  email: l("Emails", "E-mails"),
  url: l("URLs", "URL"),
  domain: l("Domains", "Domaines"),
  ipv4: l("IPv4 addresses", "Adresses IPv4"),
  ipv6: l("IPv6 addresses", "Adresses IPv6"),
  phone: l("Phone numbers", "Numéros de téléphone"),
  hashtag: l("Hashtags", "Hashtags"),
  mention: l("@mentions", "@mentions"),
  number: l("Numbers", "Nombres"),
  date: l("Dates", "Dates"),
  color: l("Colors", "Couleurs"),
  card: l("Card-like numbers", "Numéros de type carte"),
};

export default function Extract() {
  const text = useToolState("text", "");
  const kinds = useToolState<string[]>("kinds", [...KINDS]);
  const dedupe = useToolState("dedupe", true);
  const sort = useToolState("sort", false);

  const selected = useComputed(() => KINDS.filter((k) => kinds.value.includes(k)));
  // Every kind is extracted (for the counts next to the checkboxes); only selected ones are shown.
  const all = useComputed(() =>
    extractAll(text.value, KINDS, { dedupe: dedupe.value, sort: sort.value }),
  );
  const results = useComputed(() => {
    const r = { ...all.value };
    for (const k of KINDS) if (!selected.value.includes(k)) r[k] = [];
    return r;
  });
  const found = useComputed(() => selected.value.filter((k) => results.value[k].length > 0));
  const allText = () =>
    found.value.map((k) => `# ${tr(NAMES[k])}\n${results.value[k].join("\n")}`).join("\n\n");

  const setKind = (k: Kind, on: boolean) => {
    const set = new Set(kinds.value);
    if (on) set.add(k);
    else set.delete(k);
    kinds.value = KINDS.filter((x) => set.has(x));
  };

  return (
    <>
      <TextBox
        label={tr(T.text)}
        value={text.value}
        onInput={(v) => {
          text.value = v;
        }}
        placeholder={tr(T.placeholder)}
        rows={10}
      />
      <Panel
        title={tr(T.find)}
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                kinds.value = [...KINDS];
              }}
            >
              {tr(T.all)}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                kinds.value = [];
              }}
            >
              {tr(T.none)}
            </Button>
          </>
        }
      >
        <div class="extract-kinds">
          {KINDS.map((k) => (
            <label key={k} class="toggle extract-kind">
              <input
                type="checkbox"
                checked={kinds.value.includes(k)}
                onChange={(e) => setKind(k, (e.currentTarget as HTMLInputElement).checked)}
              />
              <span>{tr(NAMES[k])}</span>
              {all.value[k].length > 0 && <Badge kind="info">{fmt(all.value[k].length)}</Badge>}
            </label>
          ))}
        </div>
        <div class="row">
          <Toggle
            checked={dedupe.value}
            onChange={(v) => {
              dedupe.value = v;
            }}
            label={tr(T.dedupe)}
          />
          <Toggle
            checked={sort.value}
            onChange={(v) => {
              sort.value = v;
            }}
            label={tr(T.sort)}
          />
          <span class="spacer" />
          {found.value.length > 0 && (
            <>
              <CopyButton text={allText} label={tr(T.copyAll)} />
              <Button
                size="sm"
                variant="ghost"
                icon="download"
                onClick={() => downloadText(toCsv(results.value), "extracted.csv", "text/csv")}
              >
                {tr(T.csv)}
              </Button>
            </>
          )}
        </div>
      </Panel>
      {!text.value.trim() ? (
        <p class="muted">{tr(T.empty)}</p>
      ) : found.value.length === 0 ? (
        <p class="muted">{tr(T.nothing)}</p>
      ) : (
        <div class="grid-2">
          {found.value.map((k) => (
            <TextBox
              key={k}
              label={`${tr(NAMES[k])} · ${fmt(results.value[k].length)}`}
              value={results.value[k].join("\n")}
              readOnly
              rows={Math.min(10, Math.max(3, results.value[k].length))}
              wrap={false}
              downloadName={`${k}.txt`}
              {...(k === "card" ? { note: <span class="muted small">{tr(T.cardNote)}</span> } : {})}
            />
          ))}
        </div>
      )}
    </>
  );
}
