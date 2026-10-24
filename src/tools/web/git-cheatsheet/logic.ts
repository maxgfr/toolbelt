/**
 * Searching the git memo with plain sentences ("I want to undo my last commit", "annuler le
 * dernier commit", "letzten Commit rückgängig machen"): filler words are dropped, a few
 * synonyms are expanded, and tips are ranked by how many of the remaining words they contain.
 */
import { fold } from "../_shared";
import { type GitTip, type GroupId, TIPS } from "./data";

const STOP = new Set(
  (
    "i want wanna need to the a an my me how do does can could would like of on in into it this " +
    "that from with for and or is are be some all just git " +
    "je veux voudrais dois comment faire le la les l un une des du de d mon ma mes au aux en " +
    "dans sur pour et ou est sont avec ce cette ces tout tous qui que " +
    "ich will mochte muss kann wie den die das der dem des ein eine einen einem einer eines mein " +
    "meine meinen meinem meiner und oder ist sind mit fur von vom zu zum zur auf im am alle alles " +
    "es dieser diese diesen dieses machen mache"
  ).split(" "),
);

/** Words that mean the same thing in a git task. Each word also matches the others. */
const SYNONYMS: string[][] = [
  [
    "undo",
    "cancel",
    "revert",
    "annuler",
    "defaire",
    "reset",
    "restore",
    "rollback",
    "ruckgangig",
    "zurucksetzen",
    "zurucknehmen",
    "umkehren",
  ],
  [
    "delete",
    "remove",
    "drop",
    "erase",
    "supprimer",
    "effacer",
    "retirer",
    "jeter",
    "throw",
    "loschen",
    "entfernen",
    "wegwerfen",
  ],
  ["discard", "throw", "jeter", "annuler", "perdre", "verwerfen", "wegwerfen", "verlieren"],
  ["rename", "renommer", "move", "deplacer", "umbenennen", "verschieben"],
  ["branch", "branche", "zweig", "zweige"],
  ["commit", "commits", "committen"],
  ["stash", "aside", "cote", "remise", "shelve", "beiseite", "beiseitelegen", "parken"],
  ["merge", "fusion", "fusionner", "mergen", "zusammenfuhren"],
  ["squash", "fusionner", "combine", "regrouper", "zusammenfassen", "kombinieren"],
  ["history", "log", "historique", "verlauf", "historie"],
  ["find", "search", "chercher", "trouver", "grep", "finden", "suchen", "durchsuchen"],
  ["remote", "distant", "origin", "upstream", "remotes"],
  ["push", "pousser", "publish", "publier", "pushen", "hochladen", "veroffentlichen"],
  [
    "pull",
    "fetch",
    "update",
    "sync",
    "synchroniser",
    "jour",
    "pullen",
    "fetchen",
    "aktualisieren",
    "synchronisieren",
  ],
  ["tag", "release", "version"],
  ["bug", "regression", "bisect", "fehler"],
  ["clean", "nettoyer", "cleanup", "untracked", "aufraumen", "bereinigen", "unversioniert"],
  ["conflict", "conflit", "conflits", "konflikt", "konflikte", "konflikten"],
  ["message", "reword", "amend", "corriger", "fix", "nachricht", "korrigieren", "andern"],
  ["file", "fichier", "fichiers", "datei", "dateien"],
  [
    "last",
    "dernier",
    "derniers",
    "previous",
    "precedent",
    "letzte",
    "letzter",
    "letzten",
    "letztes",
    "vorherige",
    "vorherigen",
  ],
  ["lost", "perdu", "perdus", "reflog", "verloren", "verlorene", "verlorenen"],
  ["recover", "recuperer", "rescue", "sauver", "wiederherstellen", "retten", "zuruckholen"],
  [
    "diff",
    "changes",
    "modifications",
    "changements",
    "compare",
    "comparer",
    "anderungen",
    "unterschiede",
    "vergleichen",
  ],
  ["worktree", "worktrees", "folder", "dossier", "ordner", "verzeichnis"],
];

function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  // German infinitives and plurals: "stashen", "pushen", "dateien".
  if (w.length > 5 && w.endsWith("en")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s")) return w.slice(0, -1);
  return w;
}

/** The meaningful words of a query, each with its alternatives. */
export function queryTerms(query: string): string[][] {
  const words = fold(query)
    .replace(/[^\p{L}\p{N}<>@{}~^./-]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
  return words.map((w) => {
    const s = stem(w);
    const alts = new Set([w, s]);
    for (const group of SYNONYMS)
      if (group.includes(w) || group.includes(s)) for (const g of group) alts.add(g);
    return [...alts];
  });
}

function haystack(t: GitTip): string {
  return fold([t.en, t.fr, t.de, t.cmd, t.noteEn, t.noteFr, t.noteDe, t.group].join(" "));
}

/**
 * Tips matching `query`, best first. A tip matches when it contains at least 60 % of the
 * query's meaningful words (or a synonym). Optional `group` and `dangerOnly` filters.
 */
export function searchTips(
  query: string,
  group: GroupId | "all" = "all",
  dangerOnly = false,
): GitTip[] {
  const list = TIPS.filter(
    (t) => (group === "all" || t.group === group) && (!dangerOnly || t.danger),
  );
  const terms = queryTerms(query);
  if (!terms.length) return list;
  const need = Math.max(1, Math.ceil(terms.length * 0.6));
  return list
    .map((t, i) => {
      const hay = haystack(t);
      const title = fold(`${t.en} ${t.fr} ${t.de}`);
      let score = 0;
      for (const alts of terms) {
        if (alts.some((a) => title.includes(a))) score += 1.2;
        else if (alts.some((a) => hay.includes(a))) score += 1;
      }
      return {
        t,
        i,
        score,
        hits: terms.filter((alts) => alts.some((a) => hay.includes(a))).length,
      };
    })
    .filter((x) => x.hits >= need)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.t);
}

/** Tips grouped in the data's order, keeping only non-empty groups. */
export function groupTips(tips: GitTip[]): { group: GroupId; items: GitTip[] }[] {
  const order: GroupId[] = [];
  for (const t of TIPS) if (!order.includes(t.group)) order.push(t.group);
  return order
    .map((group) => ({ group, items: tips.filter((t) => t.group === group) }))
    .filter((g) => g.items.length);
}
