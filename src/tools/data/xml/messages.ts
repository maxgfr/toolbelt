/** The messages of the XML parser's errors (shared by the xml and json-xml tools). */
import { type L10n, l, tr } from "../../../i18n";
import { atText } from "../_ui";
import type { XmlError, XmlErrorCode } from "./logic";

const E: Record<XmlErrorCode, L10n> = {
  unterminated: l(
    "“{name}” is never closed.",
    "« {name} » n'est jamais fermé.",
    "„{name}“ wird nie geschlossen.",
  ),
  mismatch: l(
    "Closing tag </{name}> does not match the open <{expected}>.",
    "La balise fermante </{name}> ne correspond pas à <{expected}> ouverte.",
    "Schließendes Tag </{name}> passt nicht zum offenen <{expected}>.",
  ),
  "unexpected-close": l(
    "Closing tag </{name}> without an opening tag.",
    "Balise fermante </{name}> sans balise ouvrante.",
    "Schließendes Tag </{name}> ohne öffnendes Tag.",
  ),
  unclosed: l(
    "<{name}> is never closed.",
    "<{name}> n'est jamais fermée.",
    "<{name}> wird nie geschlossen.",
  ),
  "text-outside": l(
    "Text outside the root element.",
    "Du texte en dehors de l'élément racine.",
    "Text außerhalb des Wurzelelements.",
  ),
  "multiple-roots": l(
    "A second root element <{name}>: XML allows only one.",
    "Un second élément racine <{name}> : le XML n'en permet qu'un.",
    "Ein zweites Wurzelelement <{name}>: XML erlaubt nur eines.",
  ),
  "no-root": l("No root element.", "Aucun élément racine.", "Kein Wurzelelement."),
  "bad-tag": l("Invalid tag.", "Balise invalide.", "Ungültiges Tag."),
  "bad-attr": l(
    'Invalid attribute “{name}”: it needs a quoted value, like name="value".',
    'Attribut « {name} » invalide : il faut une valeur entre guillemets, comme nom="valeur".',
    'Ungültiges Attribut „{name}“: Es braucht einen Wert in Anführungszeichen, wie name="wert".',
  ),
  "dup-attr": l(
    "Attribute “{name}” appears twice.",
    "L'attribut « {name} » apparaît deux fois.",
    "Attribut „{name}“ kommt doppelt vor.",
  ),
  "missing-space": l(
    "Attributes must be separated by a space.",
    "Les attributs doivent être séparés par une espace.",
    "Attribute müssen durch ein Leerzeichen getrennt sein.",
  ),
  "lt-in-attr": l(
    "“<” is not allowed in the value of “{name}”: write &lt;.",
    "« < » est interdit dans la valeur de « {name} » : écris &lt;.",
    "„<“ ist im Wert von „{name}“ nicht erlaubt: Schreibe &lt;.",
  ),
  "bad-entity": l(
    "Invalid or unknown entity “{name}” (write & as &amp;).",
    "Entité invalide ou inconnue « {name} » (écris & sous la forme &amp;).",
    "Ungültige oder unbekannte Entität „{name}“ (schreibe & als &amp;).",
  ),
  "cdata-outside": l(
    "A CDATA section outside the root element.",
    "Une section CDATA en dehors de l'élément racine.",
    "Ein CDATA-Abschnitt außerhalb des Wurzelelements.",
  ),
  "decl-position": l(
    "The <?xml …?> declaration must come first.",
    "La déclaration <?xml …?> doit être au tout début.",
    "Die Deklaration <?xml …?> muss ganz am Anfang stehen.",
  ),
};

/** Names of the constructs an "unterminated" error can be about. */
const WHAT: Record<string, L10n> = {
  comment: l("comment", "commentaire", "Kommentar"),
  cdata: l("CDATA section", "section CDATA", "CDATA-Abschnitt"),
  pi: l("<?…?>", "<?…?>", "<?…?>"),
  doctype: l("DOCTYPE", "DOCTYPE", "DOCTYPE"),
};

/** "line 3, column 7 — <message>" for an XML error, in the current language. */
export function xmlErrorText(e: XmlError): string {
  const what = e.code === "unterminated" && e.name ? WHAT[e.name] : undefined;
  const name = what ? tr(what) : (e.name ?? "");
  return `${atText(e.line, e.column)} — ${tr(E[e.code])
    .replace("{name}", name)
    .replace("{expected}", e.expected ?? "")}`;
}
