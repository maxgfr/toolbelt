/** HTML <head> tags for SEO and link previews: title, description, canonical, Open Graph, Twitter. */

export interface MetaInput {
  title: string;
  description: string;
  url: string;
  image: string;
  imageAlt: string;
  siteName: string;
  /** og:type: website, article, product, profile… */
  type: string;
  /** e.g. en_US, fr_FR. */
  locale: string;
  /** @handle of the site on X / Twitter. */
  twitter: string;
  themeColor: string;
}

/** Escapes text for a double-quoted attribute or element content. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

export function isAbsoluteUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** "@toolbelt", "toolbelt", "https://x.com/toolbelt" → "@toolbelt"; "" when not a handle. */
export function twitterHandle(s: string): string {
  const m = /^(?:https?:\/\/(?:www\.)?(?:twitter|x)\.com\/)?@?([A-Za-z0-9_]{1,15})\/?$/.exec(
    s.trim(),
  );
  return m ? `@${m[1]}` : "";
}

/** The tags, one per line, only for the fields that are filled in. */
export function buildTags(m: MetaInput): string {
  const title = clean(m.title);
  const desc = clean(m.description);
  const url = m.url.trim();
  const image = m.image.trim();
  const alt = clean(m.imageAlt);
  const site = clean(m.siteName);
  const handle = twitterHandle(m.twitter);
  const color = m.themeColor.trim();
  const out: string[] = [];
  const meta = (attr: "name" | "property", key: string, value: string) => {
    if (value) out.push(`<meta ${attr}="${key}" content="${escapeHtml(value)}" />`);
  };

  out.push('<meta charset="utf-8" />');
  out.push('<meta name="viewport" content="width=device-width, initial-scale=1" />');
  if (title) out.push(`<title>${escapeHtml(title)}</title>`);
  meta("name", "description", desc);
  if (url) out.push(`<link rel="canonical" href="${escapeHtml(url)}" />`);
  meta("name", "theme-color", color);

  const og = out.length;
  meta("property", "og:type", clean(m.type) || "website");
  meta("property", "og:url", url);
  meta("property", "og:title", title);
  meta("property", "og:description", desc);
  meta("property", "og:image", image);
  meta("property", "og:image:alt", image ? alt : "");
  meta("property", "og:site_name", site);
  meta("property", "og:locale", clean(m.locale));

  const tw = out.length;
  meta("name", "twitter:card", image ? "summary_large_image" : "summary");
  meta("name", "twitter:site", handle);
  meta("name", "twitter:title", title);
  meta("name", "twitter:description", desc);
  meta("name", "twitter:image", image);
  meta("name", "twitter:image:alt", image ? alt : "");

  const lines = [...out.slice(0, og), "", "<!-- Open Graph -->", ...out.slice(og, tw)];
  lines.push("", "<!-- Twitter / X -->", ...out.slice(tw));
  return lines.join("\n");
}

export type Warning =
  | "noTitle"
  | "titleLong"
  | "noDescription"
  | "descriptionLong"
  | "descriptionShort"
  | "urlRelative"
  | "imageRelative"
  | "noImage"
  | "badHandle"
  | "badColor";

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** What would hurt search results or link previews. */
export function checkMeta(m: MetaInput, isColor: (s: string) => boolean = () => true): Warning[] {
  const w: Warning[] = [];
  const title = clean(m.title);
  const desc = clean(m.description);
  if (!title) w.push("noTitle");
  else if ([...title].length > TITLE_MAX) w.push("titleLong");
  if (!desc) w.push("noDescription");
  else if ([...desc].length > DESCRIPTION_MAX) w.push("descriptionLong");
  else if ([...desc].length < 50) w.push("descriptionShort");
  if (m.url.trim() && !isAbsoluteUrl(m.url.trim())) w.push("urlRelative");
  if (!m.image.trim()) w.push("noImage");
  else if (!isAbsoluteUrl(m.image.trim())) w.push("imageRelative");
  if (m.twitter.trim() && !twitterHandle(m.twitter)) w.push("badHandle");
  if (m.themeColor.trim() && !isColor(m.themeColor.trim())) w.push("badColor");
  return w;
}

/** "https://www.example.com/a/b" → "example.com", for the preview card. */
export function displayHost(url: string): string {
  try {
    return new URL(url.trim()).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Text cut at `max` characters with an ellipsis, as previews do. */
export function truncate(s: string, max: number): string {
  const chars = [...clean(s)];
  return chars.length > max
    ? `${chars
        .slice(0, max - 1)
        .join("")
        .trimEnd()}…`
    : chars.join("");
}
