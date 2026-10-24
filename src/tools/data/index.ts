import { l } from "../../i18n";
import type { ToolMeta } from "../types";

export const tools: ToolMeta[] = [
  {
    id: "json",
    category: "data",
    icon: "M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1",
    title: l("JSON formatter & validator", "Formateur et validateur JSON"),
    desc: l(
      "Format, minify, sort keys and find the exact line of a syntax error.",
      "Formate, minifie, trie les clés et trouve la ligne exacte d'une erreur.",
    ),
    keywords: ["json", "pretty", "beautify", "minify", "lint", "validate", "valider", "indenter"],
    load: () => import("./json/View"),
  },
];
