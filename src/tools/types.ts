import type { ComponentType } from "preact";
import type { L10n } from "../i18n";

export type CategoryId =
  | "text"
  | "encode"
  | "data"
  | "convert"
  | "web"
  | "design"
  | "image"
  | "calc"
  | "life";

export interface ToolMeta {
  /** URL id: #/<id>. Lowercase, dashes. */
  id: string;
  category: CategoryId;
  /** A 24×24 stroke path (lucide-like), drawn with stroke-width 1.8. */
  icon: string;
  title: L10n;
  /** One sentence, shown on the card and under the title. */
  desc: L10n;
  /** Extra search words, any language (synonyms, formats, algorithm names). */
  keywords: string[];
  /** Loads the tool's view (a default export) only when it is opened. */
  load: () => Promise<{ default: ComponentType }>;
}
