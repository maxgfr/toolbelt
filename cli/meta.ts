/** The site's tool index (titles, descriptions, keywords), shared with the web app. */
import { type L10n, tr } from "../src/i18n";
import { CATEGORIES, findTool, searchTools, TOOLS } from "../src/tools/registry";
import type { ToolMeta } from "../src/tools/types";

export const SITE = "https://maxgfr.github.io/toolbelt/";

export type { ToolMeta };
export { CATEGORIES, findTool, searchTools, TOOLS };

export function toolUrl(id: string): string {
  return `${SITE}#/${id}`;
}

/** The current language's text (English when a translation is missing). */
export function t(s: L10n): string {
  return tr(s);
}

export function categoryOf(id: string) {
  return CATEGORIES.find((c) => c.tools.some((x) => x.id === id));
}
