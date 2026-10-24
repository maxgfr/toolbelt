import type { Signal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useToolState } from "../../../app/state";
import { Output, Panel } from "../../../app/ui";
import { type L10n, l, locale, pick, tr } from "../../../i18n";
import { Badge } from "../_ui";
import { checkCard, checkGtin, checkIban, checkIsbn, ibanBankParts } from "./logic";

const T = {
  bankCode: l("Bank code", "Code banque", "Bankleitzahl"),
  account: l("Account number", "Numéro de compte", "Kontonummer"),
  card: l("Payment card (Luhn)", "Carte bancaire (Luhn)", "Zahlungskarte (Luhn)"),
  cardNote: l(
    "Checked here only, never stored or shared. A valid checksum does not mean the card exists.",
    "Vérifiée ici seulement, jamais enregistrée ni partagée. Une clé valide ne veut pas dire que la carte existe.",
    "Nur hier geprüft, nie gespeichert oder geteilt. Eine gültige Prüfsumme heißt nicht, dass die Karte existiert.",
  ),
  iban: l("IBAN", "IBAN", "IBAN"),
  ibanNote: l(
    "Not stored nor put in share links.",
    "Ni enregistré ni mis dans les liens de partage.",
    "Wird weder gespeichert noch in Teilen-Links übernommen.",
  ),
  gtin: l(
    "Barcode (EAN-13, UPC-A, EAN-8, GTIN-14)",
    "Code-barres (EAN-13, UPC-A, EAN-8, GTIN-14)",
    "Barcode (EAN-13, UPC-A, EAN-8, GTIN-14)",
  ),
  isbn: l("ISBN-10 / ISBN-13", "ISBN-10 / ISBN-13", "ISBN-10 / ISBN-13"),
  valid: l("Valid", "Valide", "Gültig"),
  invalid: l("Invalid", "Invalide", "Ungültig"),
  brand: l("Brand", "Réseau", "Kartennetz"),
  unknownBrand: l("unknown brand", "réseau inconnu", "unbekanntes Kartennetz"),
  formatted: l("Formatted", "Formaté", "Formatiert"),
  luhn: l("Luhn checksum", "Clé de Luhn", "Luhn-Prüfsumme"),
  length: l("Length", "Longueur", "Länge"),
  ok: l("correct", "correcte", "korrekt"),
  wrong: l("wrong", "incorrecte", "falsch"),
  expectedDigit: l(
    "The last digit should be {d}.",
    "Le dernier chiffre devrait être {d}.",
    "Die letzte Ziffer müsste {d} sein.",
  ),
  badLength: l(
    "{n} digits: unusual for this brand.",
    "{n} chiffres : inhabituel pour ce réseau.",
    "{n} Ziffern: ungewöhnlich für dieses Kartennetz.",
  ),
  country: l("Country", "Pays", "Land"),
  unknownCountry: l(
    "{c}: not a country that uses IBAN.",
    "{c} : pays sans IBAN.",
    "{c}: kein Land, das IBAN verwendet.",
  ),
  ibanLength: l(
    "{n} characters, {c} IBANs have {e}.",
    "{n} caractères, les IBAN {c} en ont {e}.",
    "{n} Zeichen, IBANs aus {c} haben {e}.",
  ),
  ibanCheck: l(
    "Check digits fail (mod 97). For this account they would be {e}.",
    "Les chiffres de contrôle sont faux (mod 97). Pour ce compte, ce serait {e}.",
    "Die Prüfziffern stimmen nicht (mod 97). Für dieses Konto wären es {e}.",
  ),
  bban: l("BBAN (national number)", "BBAN (numéro national)", "BBAN (nationale Kontokennung)"),
  type: l("Type", "Type", "Typ"),
  bookland: l(
    "Starts with 978/979: it is an ISBN.",
    "Commence par 978/979 : c'est un ISBN.",
    "Beginnt mit 978/979: Das ist eine ISBN.",
  ),
  isbn10: l("ISBN-10", "ISBN-10", "ISBN-10"),
  isbn13: l("ISBN-13", "ISBN-13", "ISBN-13"),
  no10: l(
    "979 ISBNs have no ISBN-10 form.",
    "Les ISBN en 979 n'ont pas de forme ISBN-10.",
    "ISBNs mit 979 haben keine ISBN-10-Form.",
  ),
  expectedCheck: l(
    "The check digit should be {d}.",
    "La clé devrait être {d}.",
    "Die Prüfziffer müsste {d} sein.",
  ),
};

const ERR: Record<string, L10n> = {
  chars: l(
    "Only digits, spaces and hyphens.",
    "Seulement des chiffres, espaces et tirets.",
    "Nur Ziffern, Leerzeichen und Bindestriche.",
  ),
  short: l(
    "Too short for a card number.",
    "Trop court pour un numéro de carte.",
    "Zu kurz für eine Kartennummer.",
  ),
  country: l(
    "An IBAN starts with a country code and two digits, e.g. FR76…",
    "Un IBAN commence par un code pays et deux chiffres, par ex. FR76…",
    "Eine IBAN beginnt mit einem Ländercode und zwei Ziffern, z. B. DE89…",
  ),
  length: l("Wrong number of digits.", "Mauvais nombre de chiffres.", "Falsche Anzahl an Ziffern."),
  prefix: l(
    "An ISBN-13 starts with 978 or 979.",
    "Un ISBN-13 commence par 978 ou 979.",
    "Eine ISBN-13 beginnt mit 978 oder 979.",
  ),
};
const IBAN_CHARS = l(
  "Only letters, digits and spaces.",
  "Seulement des lettres, chiffres et espaces.",
  "Nur Buchstaben, Ziffern und Leerzeichen.",
);

/** "DE — Germany", in the current language (just the code if Intl does not know it). */
function countryName(code: string): string {
  try {
    const name = new Intl.DisplayNames(locale(), { type: "region" }).of(code);
    return name && name !== code ? `${code} — ${name}` : code;
  } catch {
    return code;
  }
}

function Box({
  title,
  value,
  placeholder,
  verdict,
  children,
  note,
}: {
  title: string;
  value: Signal<string>;
  placeholder: string;
  verdict: boolean | null;
  children?: ComponentChildren;
  note?: string;
}) {
  return (
    <Panel
      title={title}
      actions={
        verdict !== null && (
          <Badge kind={verdict ? "ok" : "bad"}>{tr(verdict ? T.valid : T.invalid)}</Badge>
        )
      }
    >
      <input
        class="input mono validators-input"
        value={value.value}
        placeholder={placeholder}
        aria-label={title}
        aria-invalid={verdict === false}
        spellcheck={false}
        autocomplete="off"
        inputMode="text"
        onInput={(e) => {
          value.value = (e.currentTarget as HTMLInputElement).value;
        }}
      />
      {children}
      {note && <p class="muted small">{note}</p>}
    </Panel>
  );
}

const fill = (s: L10n, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), tr(s));

export default function Validators() {
  const card = useToolState("card", "", { persist: false, share: false });
  const iban = useToolState("iban", "", { persist: false, share: false });
  const gtin = useToolState("gtin", "");
  const isbn = useToolState("isbn", "");

  const c = checkCard(card.value);
  const i = checkIban(iban.value);
  const parts = i.ok && i.valid ? ibanBankParts(i.country, i.bban) : null;
  const g = checkGtin(gtin.value);
  const b = checkIsbn(isbn.value);

  return (
    <div class="grid-2 validators">
      <Box
        title={tr(T.card)}
        value={card}
        placeholder="4111 1111 1111 1111"
        verdict={c.ok ? c.valid : c.error === "empty" ? null : false}
        note={tr(T.cardNote)}
      >
        {!c.ok && c.error !== "empty" && <p class="error small">{tr(ERR[c.error] ?? T.invalid)}</p>}
        {c.ok && (
          <div class="stack validators-out">
            <Output label={tr(T.brand)} value={c.brand?.name ?? tr(T.unknownBrand)} mono={false} />
            <Output label={tr(T.formatted)} value={c.formatted} />
            <Output label={tr(T.luhn)} value={tr(c.luhn ? T.ok : T.wrong)} mono={false} />
            {!c.luhn && <p class="error small">{fill(T.expectedDigit, { d: c.expected })}</p>}
            {!c.lengthOk && <p class="error small">{fill(T.badLength, { n: c.digits.length })}</p>}
          </div>
        )}
      </Box>

      <Box
        title={tr(T.iban)}
        value={iban}
        placeholder={pick({
          en: "FR76 3000 6000 0112 3456 7890 189",
          fr: "FR76 3000 6000 0112 3456 7890 189",
          de: "DE89 3704 0044 0532 0130 00",
        })}
        verdict={i.ok ? i.valid : i.error === "empty" ? null : false}
        note={tr(T.ibanNote)}
      >
        {!i.ok && i.error !== "empty" && (
          <p class="error small">
            {tr(i.error === "chars" ? IBAN_CHARS : (ERR[i.error] ?? T.invalid))}
          </p>
        )}
        {i.ok && (
          <div class="stack validators-out">
            <Output label={tr(T.formatted)} value={i.formatted} />
            <Output label={tr(T.country)} value={countryName(i.country)} />
            <Output label={tr(T.bban)} value={i.bban} />
            {parts && (
              <div class="grid-2">
                <Output label={tr(T.bankCode)} value={parts.bank} />
                <Output label={tr(T.account)} value={parts.account} />
              </div>
            )}
            {!i.known && <p class="error small">{fill(T.unknownCountry, { c: i.country })}</p>}
            {i.known && !i.lengthOk && (
              <p class="error small">
                {fill(T.ibanLength, { n: i.iban.length, c: i.country, e: i.expectedLength ?? "?" })}
              </p>
            )}
            {!i.checkOk && <p class="error small">{fill(T.ibanCheck, { e: i.expectedCheck })}</p>}
          </div>
        )}
      </Box>

      <Box
        title={tr(T.gtin)}
        value={gtin}
        placeholder="4006381333931"
        verdict={g.ok ? g.valid : g.error === "empty" ? null : false}
      >
        {!g.ok && g.error !== "empty" && <p class="error small">{tr(ERR[g.error] ?? T.invalid)}</p>}
        {g.ok && (
          <div class="stack validators-out">
            <Output label={tr(T.type)} value={g.kind} />
            {!g.valid && <p class="error small">{fill(T.expectedCheck, { d: g.expected })}</p>}
            {g.isbn && <p class="muted small">{tr(T.bookland)}</p>}
          </div>
        )}
      </Box>

      <Box
        title={tr(T.isbn)}
        value={isbn}
        placeholder="978-0-306-40615-7"
        verdict={b.ok ? b.valid : b.error === "empty" ? null : false}
      >
        {!b.ok && b.error !== "empty" && <p class="error small">{tr(ERR[b.error] ?? T.invalid)}</p>}
        {b.ok && (
          <div class="stack validators-out">
            <Output label={tr(T.type)} value={b.kind} />
            {!b.valid && <p class="error small">{fill(T.expectedCheck, { d: b.expected })}</p>}
            {b.valid && <Output label={tr(T.isbn13)} value={b.isbn13} />}
            {b.valid &&
              (b.isbn10 ? (
                <Output label={tr(T.isbn10)} value={b.isbn10} />
              ) : (
                <p class="muted small">{tr(T.no10)}</p>
              ))}
          </div>
        )}
      </Box>
    </div>
  );
}
