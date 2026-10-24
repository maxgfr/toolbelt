import type { Signal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useToolState } from "../../../app/state";
import { Output, Panel } from "../../../app/ui";
import { type L10n, l, tr } from "../../../i18n";
import { Badge } from "../_ui";
import { checkCard, checkGtin, checkIban, checkIsbn } from "./logic";

const T = {
  card: l("Payment card (Luhn)", "Carte bancaire (Luhn)"),
  cardNote: l(
    "Checked here only, never stored or shared. A valid checksum does not mean the card exists.",
    "Vérifiée ici seulement, jamais enregistrée ni partagée. Une clé valide ne veut pas dire que la carte existe.",
  ),
  iban: l("IBAN", "IBAN"),
  ibanNote: l(
    "Not stored nor put in share links.",
    "Ni enregistré ni mis dans les liens de partage.",
  ),
  gtin: l("Barcode (EAN-13, UPC-A, EAN-8, GTIN-14)", "Code-barres (EAN-13, UPC-A, EAN-8, GTIN-14)"),
  isbn: l("ISBN-10 / ISBN-13", "ISBN-10 / ISBN-13"),
  valid: l("Valid", "Valide"),
  invalid: l("Invalid", "Invalide"),
  brand: l("Brand", "Réseau"),
  unknownBrand: l("unknown brand", "réseau inconnu"),
  formatted: l("Formatted", "Formaté"),
  luhn: l("Luhn checksum", "Clé de Luhn"),
  length: l("Length", "Longueur"),
  ok: l("correct", "correcte"),
  wrong: l("wrong", "incorrecte"),
  expectedDigit: l("The last digit should be {d}.", "Le dernier chiffre devrait être {d}."),
  badLength: l("{n} digits: unusual for this brand.", "{n} chiffres : inhabituel pour ce réseau."),
  country: l("Country", "Pays"),
  unknownCountry: l("{c}: not a country that uses IBAN.", "{c} : pays sans IBAN."),
  ibanLength: l("{n} characters, {c} IBANs have {e}.", "{n} caractères, les IBAN {c} en ont {e}."),
  ibanCheck: l(
    "Check digits fail (mod 97). For this account they would be {e}.",
    "Les chiffres de contrôle sont faux (mod 97). Pour ce compte, ce serait {e}.",
  ),
  bban: l("BBAN (national number)", "BBAN (numéro national)"),
  type: l("Type", "Type"),
  bookland: l("Starts with 978/979: it is an ISBN.", "Commence par 978/979 : c'est un ISBN."),
  isbn10: l("ISBN-10", "ISBN-10"),
  isbn13: l("ISBN-13", "ISBN-13"),
  no10: l("979 ISBNs have no ISBN-10 form.", "Les ISBN en 979 n'ont pas de forme ISBN-10."),
  expectedCheck: l("The check digit should be {d}.", "La clé devrait être {d}."),
};

const ERR: Record<string, L10n> = {
  chars: l("Only digits, spaces and hyphens.", "Seulement des chiffres, espaces et tirets."),
  short: l("Too short for a card number.", "Trop court pour un numéro de carte."),
  country: l(
    "An IBAN starts with a country code and two digits, e.g. FR76…",
    "Un IBAN commence par un code pays et deux chiffres, par ex. FR76…",
  ),
  length: l("Wrong number of digits.", "Mauvais nombre de chiffres."),
  prefix: l("An ISBN-13 starts with 978 or 979.", "Un ISBN-13 commence par 978 ou 979."),
};
const IBAN_CHARS = l(
  "Only letters, digits and spaces.",
  "Seulement des lettres, chiffres et espaces.",
);

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
        placeholder="FR76 3000 6000 0112 3456 7890 189"
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
            <Output label={tr(T.country)} value={i.country} />
            <Output label={tr(T.bban)} value={i.bban} />
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
