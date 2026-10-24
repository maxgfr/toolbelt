import { l } from "../../i18n";
import type { ToolMeta } from "../types";

export const tools: ToolMeta[] = [
  {
    id: "counter",
    category: "text",
    icon: "M4 7V5h16v2M9 19h6M12 5v14",
    title: l("Character & word counter", "Compteur de caractères et de mots"),
    desc: l(
      "Characters, words, lines, sentences, bytes, reading time and frequent words.",
      "Caractères, mots, lignes, phrases, octets, temps de lecture et mots fréquents.",
    ),
    keywords: [
      "count",
      "length",
      "compter",
      "longueur",
      "words",
      "letters",
      "lettres",
      "tokens",
      "reading time",
    ],
    load: () => import("./counter/View"),
  },
  {
    id: "diff",
    category: "text",
    icon: "M6 3v12M18 9v12M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM15 6H9a3 3 0 0 0-3 3",
    title: l("Text & file diff", "Diff de textes et de fichiers"),
    desc: l(
      "Compare two texts or files side by side, by line, word or character, and export a patch.",
      "Compare deux textes ou fichiers côte à côte, par ligne, mot ou caractère, et exporte un patch.",
    ),
    keywords: ["compare", "comparer", "difference", "différence", "git diff", "patch", "merge"],
    load: () => import("./diff/View"),
  },
];
