import { useComputed } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { Button, Field, FileDrop, Panel, TextBox } from "../../../app/ui";
import { type L10n, l, pick, tr } from "../../../i18n";
import { Badge } from "../_ui";
import {
  buildTags,
  checkMeta,
  DESCRIPTION_MAX,
  displayHost,
  type MetaInput,
  TITLE_MAX,
  truncate,
  type Warning,
} from "./logic";

const T = {
  page: l("Page", "Page", "Seite"),
  title: l("Title", "Titre", "Titel"),
  description: l("Description", "Description", "Beschreibung"),
  url: l("Canonical URL", "URL canonique", "Kanonische URL"),
  image: l("Image URL (1200 × 630)", "URL de l'image (1200 × 630)", "Bild-URL (1200 × 630)"),
  imageAlt: l("Image description (alt)", "Description de l'image (alt)", "Bildbeschreibung (alt)"),
  siteName: l("Site name", "Nom du site", "Name der Website"),
  type: l("Type", "Type", "Typ"),
  locale: l("Locale", "Langue (locale)", "Gebietsschema (locale)"),
  twitter: l("X / Twitter account", "Compte X / Twitter", "X-/Twitter-Konto"),
  themeColor: l("Theme color", "Couleur du thème", "Designfarbe"),
  preview: l("Preview", "Aperçu", "Vorschau"),
  previewNote: l(
    "Remote images cannot load in this offline tool. Drop a local copy to see it in the card.",
    "Les images distantes ne se chargent pas dans cet outil hors ligne. Dépose une copie locale pour la voir dans la carte.",
    "Externe Bilder können in diesem Offline-Werkzeug nicht geladen werden. Zieh eine lokale Kopie hierher, um sie in der Karte zu sehen.",
  ),
  dropImage: l(
    "Drop an image to preview it",
    "Dépose une image pour l'aperçu",
    "Bild hierher ziehen für die Vorschau",
  ),
  removeImage: l("Remove the preview image", "Retirer l'image d'aperçu", "Vorschaubild entfernen"),
  noImage: l("No image", "Pas d'image", "Kein Bild"),
  tags: l("HTML for the <head>", "HTML pour le <head>", "HTML für den <head>"),
  allGood: l(
    "Ready for search engines and link previews",
    "Prêt pour les moteurs et les aperçus de liens",
    "Bereit für Suchmaschinen und Link-Vorschauen",
  ),
  chars: l("{n}/{max} characters", "{n}/{max} caractères", "{n}/{max} Zeichen"),
};

const TYPES = ["website", "article", "product", "profile", "book", "video.movie", "music.song"];

const WARN: Record<Warning, L10n> = {
  noTitle: l("Add a title.", "Ajoute un titre.", "Füge einen Titel hinzu."),
  titleLong: l(
    "The title is over 60 characters: search results will cut it.",
    "Le titre dépasse 60 caractères : les résultats de recherche le couperont.",
    "Der Titel ist länger als 60 Zeichen: Suchergebnisse schneiden ihn ab.",
  ),
  noDescription: l(
    "Add a description.",
    "Ajoute une description.",
    "Füge eine Beschreibung hinzu.",
  ),
  descriptionLong: l(
    "The description is over 160 characters: it will be cut.",
    "La description dépasse 160 caractères : elle sera coupée.",
    "Die Beschreibung ist länger als 160 Zeichen: Sie wird abgeschnitten.",
  ),
  descriptionShort: l(
    "The description is short: aim for 50 to 160 characters.",
    "La description est courte : vise 50 à 160 caractères.",
    "Die Beschreibung ist kurz: Ziel sind 50 bis 160 Zeichen.",
  ),
  urlRelative: l(
    "The URL must be absolute (https://…).",
    "L'URL doit être absolue (https://…).",
    "Die URL muss absolut sein (https://…).",
  ),
  imageRelative: l(
    "The image URL must be absolute (https://…), or previews will not show it.",
    "L'URL de l'image doit être absolue (https://…), sinon les aperçus ne l'afficheront pas.",
    "Die Bild-URL muss absolut sein (https://…), sonst zeigen Vorschauen sie nicht an.",
  ),
  noImage: l(
    "No image: links will show a small card without picture.",
    "Pas d'image : les liens s'afficheront en petite carte sans visuel.",
    "Kein Bild: Links erscheinen als kleine Karte ohne Bild.",
  ),
  badHandle: l(
    "Not an X / Twitter handle (letters, digits, _; 15 max).",
    "Ce n'est pas un compte X / Twitter (lettres, chiffres, _ ; 15 max).",
    "Kein gültiges X-/Twitter-Konto (Buchstaben, Ziffern, _; höchstens 15).",
  ),
  badColor: l("Not a CSS color.", "Ce n'est pas une couleur CSS.", "Keine CSS-Farbe."),
};

const isColor = (s: string) =>
  typeof CSS !== "undefined" && typeof CSS.supports === "function"
    ? CSS.supports("color", s)
    : true;

export default function MetaTags() {
  const title = useToolState("title", "");
  const description = useToolState("description", "");
  const url = useToolState("url", "");
  const image = useToolState("image", "");
  const imageAlt = useToolState("imageAlt", "");
  const siteName = useToolState("siteName", "");
  const type = useToolState("type", "website");
  const locale = useToolState("locale", "");
  const twitter = useToolState("twitter", "");
  const themeColor = useToolState("themeColor", "");
  const [localImage, setLocalImage] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (localImage) URL.revokeObjectURL(localImage);
    },
    [localImage],
  );

  const input = useComputed<MetaInput>(() => ({
    title: title.value,
    description: description.value,
    url: url.value,
    image: image.value,
    imageAlt: imageAlt.value,
    siteName: siteName.value,
    type: type.value,
    locale: locale.value,
    twitter: twitter.value,
    themeColor: themeColor.value,
  }));
  const tags = useComputed(() => buildTags(input.value));
  const warnings = useComputed(() => checkMeta(input.value, isColor));

  const bind = (s: { value: string }) => (e: Event) => {
    s.value = (e.currentTarget as HTMLInputElement).value;
  };
  const count = (s: string, max: number) =>
    tr(T.chars)
      .replace("{n}", String([...s.trim()].length))
      .replace("{max}", String(max));
  const host = displayHost(url.value) || siteName.value.trim();

  return (
    <>
      <div class="grid-2">
        <Panel title={tr(T.page)}>
          <Field label={tr(T.title)} hint={count(title.value, TITLE_MAX)}>
            <input class="input" value={title.value} onInput={bind(title)} />
          </Field>
          <Field label={tr(T.description)} hint={count(description.value, DESCRIPTION_MAX)}>
            <textarea
              class="input textarea"
              rows={3}
              value={description.value}
              onInput={bind(description)}
              spellcheck
            />
          </Field>
          <Field label={tr(T.url)}>
            <input
              class="input mono"
              type="url"
              value={url.value}
              placeholder="https://example.com/page"
              onInput={bind(url)}
            />
          </Field>
          <div class="grid-2">
            <Field label={tr(T.image)}>
              <input
                class="input mono"
                type="url"
                value={image.value}
                placeholder="https://example.com/og.png"
                onInput={bind(image)}
              />
            </Field>
            <Field label={tr(T.imageAlt)}>
              <input class="input" value={imageAlt.value} onInput={bind(imageAlt)} />
            </Field>
            <Field label={tr(T.siteName)}>
              <input class="input" value={siteName.value} onInput={bind(siteName)} />
            </Field>
            <Field label={tr(T.type)}>
              <select class="input" value={type.value} onChange={bind(type)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tr(T.locale)}>
              <input
                class="input mono"
                value={locale.value}
                placeholder={pick({ en: "en_US", fr: "fr_FR", de: "de_DE" })}
                onInput={bind(locale)}
              />
            </Field>
            <Field label={tr(T.twitter)}>
              <input
                class="input mono"
                value={twitter.value}
                placeholder="@toolbelt"
                onInput={bind(twitter)}
              />
            </Field>
            <Field label={tr(T.themeColor)}>
              <div class="meta-tags-color">
                <input
                  type="color"
                  value={
                    /^#[0-9a-f]{6}$/i.test(themeColor.value.trim())
                      ? themeColor.value.trim()
                      : "#0f766e"
                  }
                  aria-label={tr(T.themeColor)}
                  onInput={bind(themeColor)}
                />
                <input
                  class="input mono"
                  value={themeColor.value}
                  placeholder="#0f766e"
                  onInput={bind(themeColor)}
                />
              </div>
            </Field>
          </div>
        </Panel>

        <div class="stack">
          <Panel title={tr(T.preview)}>
            <article class="meta-tags-card">
              <div class="meta-tags-image">
                {localImage ? (
                  <img src={localImage} alt={imageAlt.value} />
                ) : (
                  <span class="muted small mono">
                    {image.value.trim() ? truncate(image.value, 60) : tr(T.noImage)}
                  </span>
                )}
              </div>
              <div class="meta-tags-text">
                {host && <span class="meta-tags-host">{host}</span>}
                <strong>{truncate(title.value, 70) || "—"}</strong>
                <span class="meta-tags-desc">{truncate(description.value, 160)}</span>
              </div>
            </article>
            {localImage ? (
              <Button size="sm" variant="ghost" icon="close" onClick={() => setLocalImage(null)}>
                {tr(T.removeImage)}
              </Button>
            ) : (
              <FileDrop
                accept="image/*"
                label={tr(T.dropImage)}
                onFiles={(files) => {
                  const f = files[0];
                  if (f?.type.startsWith("image/")) setLocalImage(URL.createObjectURL(f));
                }}
              />
            )}
            <p class="muted small">{tr(T.previewNote)}</p>
          </Panel>
          <ul class="meta-tags-warnings">
            {warnings.value.length === 0 ? (
              <li>
                <Badge kind="ok">{tr(T.allGood)}</Badge>
              </li>
            ) : (
              warnings.value.map((w) => (
                <li key={w}>
                  <Badge kind={w === "noImage" || w === "descriptionShort" ? "info" : "warn"}>
                    {tr(WARN[w])}
                  </Badge>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      <TextBox
        label={tr(T.tags)}
        value={tags.value}
        readOnly
        rows={14}
        wrap={false}
        downloadName="meta-tags.html"
      />
    </>
  );
}
