/** The messages of the XML parser's errors (shared by the xml and json-xml tools). */
import { type L10n, l, tr } from "../../../i18n";
import { atText } from "../_ui";
import type { XmlError, XmlErrorCode } from "./logic";

const E: Record<XmlErrorCode, L10n> = {
  unterminated: l("“{name}” is never closed.", "« {name} » n'est jamais fermé."),
  mismatch: l(
    "Closing tag </{name}> does not match the open <{expected}>.",
    "La balise fermante </{name}> ne correspond pas à <{expected}> ouverte.",
  ),
  "unexpected-close": l(
    "Closing tag </{name}> without an opening tag.",
    "Balise fermante </{name}> sans balise ouvrante.",
  ),
  unclosed: l("<{name}> is never closed.", "<{name}> n'est jamais fermée."),
  "text-outside": l("Text outside the root element.", "Du texte en dehors de l'élément racine."),
  "multiple-roots": l(
    "A second root element <{name}>: XML allows only one.",
    "Un second élément racine <{name}> : le XML n'en permet qu'un.",
  ),
  "no-root": l("No root element.", "Aucun élément racine."),
  "bad-tag": l("Invalid tag.", "Balise invalide."),
  "bad-attr": l(
    'Invalid attribute “{name}”: it needs a quoted value, like name="value".',
    'Attribut « {name} » invalide : il faut une valeur entre guillemets, comme nom="valeur".',
  ),
  "dup-attr": l("Attribute “{name}” appears twice.", "L'attribut « {name} » apparaît deux fois."),
  "missing-space": l(
    "Attributes must be separated by a space.",
    "Les attributs doivent être séparés par une espace.",
  ),
  "lt-in-attr": l(
    "“<” is not allowed in the value of “{name}”: write &lt;.",
    "« < » est interdit dans la valeur de « {name} » : écris &lt;.",
  ),
  "bad-entity": l(
    "Invalid or unknown entity “{name}” (write & as &amp;).",
    "Entité invalide ou inconnue « {name} » (écris & sous la forme &amp;).",
  ),
  "cdata-outside": l(
    "A CDATA section outside the root element.",
    "Une section CDATA en dehors de l'élément racine.",
  ),
  "decl-position": l(
    "The <?xml …?> declaration must come first.",
    "La déclaration <?xml …?> doit être au tout début.",
  ),
};

/** Names of the constructs an "unterminated" error can be about. */
const WHAT: Record<string, L10n> = {
  comment: l("comment", "commentaire"),
  cdata: l("CDATA section", "section CDATA"),
  pi: l("<?…?>", "<?…?>"),
  doctype: l("DOCTYPE", "DOCTYPE"),
};

/** "line 3, column 7 — <message>" for an XML error, in the current language. */
export function xmlErrorText(e: XmlError): string {
  const what = e.code === "unterminated" && e.name ? WHAT[e.name] : undefined;
  const name = what ? tr(what) : (e.name ?? "");
  return `${atText(e.line, e.column)} — ${tr(E[e.code])
    .replace("{name}", name)
    .replace("{expected}", e.expected ?? "")}`;
}
