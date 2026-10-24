/** Strings of the shell and the shared components. Tools keep their own next to them. */
import { l } from "./index";

export const S = {
  tagline: l(
    "Everyday utilities that run in your browser. Nothing leaves your device.",
    "Des petits outils du quotidien, dans ton navigateur. Rien ne quitte ton appareil.",
  ),
  search: l("Search a tool…", "Chercher un outil…"),
  searchHint: l("Search tools (⌘K)", "Chercher (⌘K)"),
  noResult: l("No tool matches.", "Aucun outil ne correspond."),
  favorites: l("Favorites", "Favoris"),
  recent: l("Recent", "Récents"),
  all: l("All tools", "Tous les outils"),
  home: l("All tools", "Tous les outils"),
  addFavorite: l("Add to favorites", "Ajouter aux favoris"),
  removeFavorite: l("Remove from favorites", "Retirer des favoris"),
  share: l("Copy a link with this input", "Copier un lien avec cette saisie"),
  shareCopied: l(
    "Link copied: the input is in the link, not on a server.",
    "Lien copié : la saisie est dans le lien, pas sur un serveur.",
  ),
  shareTooLong: l(
    "The input is too large to fit in a link.",
    "La saisie est trop grande pour tenir dans un lien.",
  ),
  reset: l("Reset this tool", "Réinitialiser l'outil"),
  notFound: l("This tool does not exist.", "Cet outil n'existe pas."),
  loading: l("Loading…", "Chargement…"),
  loadFailed: l("This tool failed to load.", "Impossible de charger cet outil."),
  language: l("Français", "English"),
  theme: l("Switch theme", "Changer de thème"),
  source: l("Source code on GitHub", "Code source sur GitHub"),
  privacy: l(
    "No server, no tracking, works offline. Your input stays in this tab (and in your browser's storage, to find it again).",
    "Pas de serveur, pas de pistage, fonctionne hors ligne. Ta saisie reste dans cet onglet (et dans le stockage du navigateur, pour la retrouver).",
  ),
  tools: l("tools", "outils"),
  copy: l("Copy", "Copier"),
  copied: l("Copied", "Copié"),
  copyFailed: l("Could not copy.", "Copie impossible."),
  download: l("Download", "Télécharger"),
  open: l("Open a file", "Ouvrir un fichier"),
  clear: l("Clear", "Effacer"),
  swap: l("Swap", "Inverser"),
  dropHere: l(
    "Drop a file here, or click to choose",
    "Dépose un fichier ici, ou clique pour choisir",
  ),
  input: l("Input", "Entrée"),
  output: l("Output", "Sortie"),
  error: l("Error", "Erreur"),
  close: l("Close", "Fermer"),
};
