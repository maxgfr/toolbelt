import { useComputed } from "@preact/signals";
import { Badge } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { CopyButton, Stats, TextBox, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { cleanText } from "./logic";

const T = {
  input: l("Links or text", "Liens ou texte", "Links oder Text"),
  inputPh: l(
    "Paste a link, or a whole email or message: every link in it is cleaned.\nhttps://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com…",
    "Colle un lien, ou tout un e-mail ou message : chaque lien est nettoyé.\nhttps://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com…",
    "Füge einen Link ein, oder eine ganze E-Mail oder Nachricht: Jeder Link darin wird bereinigt.\nhttps://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com…",
  ),
  unwrap: l(
    "Unwrap redirects and safe links",
    "Déballer redirections et liens protégés",
    "Weiterleitungen und Safe Links auspacken",
  ),
  strip: l(
    "Remove tracking parameters",
    "Retirer les paramètres de suivi",
    "Tracking-Parameter entfernen",
  ),
  output: l("Cleaned", "Nettoyé", "Bereinigt"),
  links: l("Links found", "Liens trouvés", "Gefundene Links"),
  changed: l("Changed", "Modifiés", "Geändert"),
  params: l("Parameters removed", "Paramètres retirés", "Entfernte Parameter"),
  details: l("Details", "Détails", "Details"),
  via: l("unwrapped: {list}", "déballé : {list}", "ausgepackt: {list}"),
  removed: l("removed: {list}", "retiré : {list}", "entfernt: {list}"),
  unchanged: l("unchanged", "inchangé", "unverändert"),
  opaque: l(
    "{name} link: its target is stored on the service and cannot be read offline.",
    "Lien {name} : sa cible est stockée chez le service et ne peut pas être lue hors ligne.",
    "{name}-Link: Sein Ziel ist beim Dienst gespeichert und kann offline nicht gelesen werden.",
  ),
  none: l(
    "No http(s) link found in the text.",
    "Aucun lien http(s) trouvé dans le texte.",
    "Kein http(s)-Link im Text gefunden.",
  ),
  about: l(
    "Decodes Microsoft Safe Links (Outlook, Teams), Google, Facebook / Instagram, Proofpoint URL Defense, Slack, LinkedIn, YouTube, Bing, DuckDuckGo, Yahoo, Steam, Reddit, VK and similar redirects, then strips utm_*, fbclid, gclid, mc_eid and other trackers. Nothing is fetched: links are decoded, not visited.",
    "Décode les Safe Links Microsoft (Outlook, Teams), les redirections Google, Facebook / Instagram, Proofpoint URL Defense, Slack, LinkedIn, YouTube, Bing, DuckDuckGo, Yahoo, Steam, Reddit, VK et similaires, puis retire utm_*, fbclid, gclid, mc_eid et autres traceurs. Rien n'est chargé : les liens sont décodés, pas visités.",
    "Dekodiert Microsoft Safe Links (Outlook, Teams) sowie Weiterleitungen von Google, Facebook / Instagram, Proofpoint URL Defense, Slack, LinkedIn, YouTube, Bing, DuckDuckGo, Yahoo, Steam, Reddit, VK und ähnlichen, und entfernt dann utm_*, fbclid, gclid, mc_eid und andere Tracker. Nichts wird abgerufen: Links werden dekodiert, nicht besucht.",
  ),
};

export default function Safelink() {
  // Pasted mails can hold private addresses (Safe Links embed the recipient): never shared.
  const input = useToolState("text", "", { share: false });
  const unwrap = useToolState("unwrap", true);
  const strip = useToolState("strip", true);
  const result = useComputed(() =>
    cleanText(input.value, { unwrap: unwrap.value, strip: strip.value }),
  );

  const r = result.value;
  const changed = r.links.filter((c) => c.result !== c.original);
  const removedCount = r.links.reduce((n, c) => n + c.removed.length, 0);

  return (
    <>
      <TextBox
        label={tr(T.input)}
        value={input.value}
        onInput={(v) => {
          input.value = v;
        }}
        placeholder={tr(T.inputPh)}
        rows={6}
      />
      <div class="row">
        <Toggle
          checked={unwrap.value}
          onChange={(v) => {
            unwrap.value = v;
          }}
          label={tr(T.unwrap)}
        />
        <Toggle
          checked={strip.value}
          onChange={(v) => {
            strip.value = v;
          }}
          label={tr(T.strip)}
        />
      </div>

      {input.value.trim() &&
        (r.links.length === 0 ? (
          <p class="muted small">{tr(T.none)}</p>
        ) : (
          <>
            <Stats
              items={[
                { label: tr(T.links), value: fmt(r.links.length) },
                { label: tr(T.changed), value: fmt(changed.length) },
                { label: tr(T.params), value: fmt(removedCount) },
              ]}
            />
            <TextBox label={tr(T.output)} value={r.text} readOnly rows={6} />
            <section class="stack safelink-list" aria-label={tr(T.details)}>
              {r.links.map((c, i) => (
                <div key={i} class="safelink-item">
                  <div class="row">
                    <code class="safelink-url mono">{c.result}</code>
                    <span class="spacer" />
                    <CopyButton text={c.result} />
                  </div>
                  <div class="row safelink-tags">
                    {c.unwrapped.length > 0 && (
                      <Badge kind="ok">
                        {tr(T.via).replace("{list}", c.unwrapped.join(" → "))}
                      </Badge>
                    )}
                    {c.removed.length > 0 && (
                      <Badge kind="info">
                        {tr(T.removed).replace("{list}", c.removed.join(", "))}
                      </Badge>
                    )}
                    {c.result === c.original && !c.opaque && (
                      <span class="muted small">{tr(T.unchanged)}</span>
                    )}
                    {c.opaque && (
                      <Badge kind="warn">{tr(T.opaque).replace("{name}", c.opaque)}</Badge>
                    )}
                  </div>
                  {c.result !== c.original && (
                    <div class="safelink-original muted small mono">{c.original}</div>
                  )}
                </div>
              ))}
            </section>
          </>
        ))}

      <p class="muted small">{tr(T.about)}</p>
    </>
  );
}
