/** The messages of the XML parser's errors (shared by the xml and json-xml tools). */
import { atText } from "../_ui";
import { type XmlError, xmlErrorMessage } from "./logic";

/** "line 3, column 7 — <message>" for an XML error, in the current language. */
export function xmlErrorText(e: XmlError): string {
  return `${atText(e.line, e.column)} — ${xmlErrorMessage(e)}`;
}
