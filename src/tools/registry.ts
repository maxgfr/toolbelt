/** Every tool, by category. Each category lists its own tools in src/tools/<category>/index.ts. */
import { type L10n, l } from "../i18n";
import { tools as calc } from "./calc";
import { tools as convert } from "./convert";
import { tools as data } from "./data";
import { tools as design } from "./design";
import { tools as encode } from "./encode";
import { tools as image } from "./image";
import { tools as life } from "./life";
import { tools as text } from "./text";
import type { CategoryId, ToolMeta } from "./types";
import { tools as web } from "./web";

export interface Category {
  id: CategoryId;
  title: L10n;
  tools: ToolMeta[];
}

export const CATEGORIES: Category[] = [
  { id: "text", title: l("Text", "Texte", "Text"), tools: text },
  {
    id: "encode",
    title: l("Encoding & crypto", "Encodage & crypto", "Kodierung & Krypto"),
    tools: encode,
  },
  { id: "data", title: l("Data & formats", "Données & formats", "Daten & Formate"), tools: data },
  { id: "convert", title: l("Time & numbers", "Temps & nombres", "Zeit & Zahlen"), tools: convert },
  { id: "web", title: l("Web & dev", "Web & dev", "Web & Entwicklung"), tools: web },
  { id: "design", title: l("CSS & design", "CSS & design", "CSS & Design"), tools: design },
  { id: "image", title: l("Images", "Images", "Bilder"), tools: image },
  {
    id: "calc",
    title: l("Everyday calculators", "Calculs du quotidien", "Alltagsrechner"),
    tools: calc,
  },
  {
    id: "life",
    title: l("Timers, chance & devices", "Minuteurs, hasard & appareils", "Timer, Zufall & Geräte"),
    tools: life,
  },
];

export const TOOLS: ToolMeta[] = CATEGORIES.flatMap((c) => c.tools);

const BY_ID = new Map(TOOLS.map((t) => [t.id, t]));

export function findTool(id: string): ToolMeta | undefined {
  return BY_ID.get(id);
}

function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Ranks tools for a query, over titles, descriptions and keywords in both languages. */
export function searchTools(query: string): ToolMeta[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return TOOLS;
  const scored: { t: ToolMeta; score: number }[] = [];
  for (const t of TOOLS) {
    const title = fold(`${t.title.en} ${t.title.fr} ${t.title.de ?? ""}`);
    const rest = fold(
      `${t.id} ${t.keywords.join(" ")} ${t.desc.en} ${t.desc.fr} ${t.desc.de ?? ""}`,
    );
    let score = 0;
    for (const w of words) {
      if (title.split(/[\s&/,()-]+/).some((x) => x.startsWith(w))) score += 4;
      else if (title.includes(w)) score += 3;
      else if (rest.includes(w)) score += 1;
      else {
        score = 0;
        break;
      }
    }
    if (score > 0) scored.push({ t, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.t);
}
