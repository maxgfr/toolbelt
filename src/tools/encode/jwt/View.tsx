import { useComputed, useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { CopyButton, ErrorNote, Field, Panel, Segmented, TextBox, Toggle } from "../../../app/ui";
import { type L10n, l, lang, locale, tr } from "../../../i18n";
import { attempt } from "../_shared";
import { useAsync } from "../_ui";
import {
  algName,
  CLAIM_NAMES,
  decodeJwt,
  humanDuration,
  isHmacAlg,
  type SecretEncoding,
  timeClaims,
  validity,
  verifyHmac,
} from "./logic";

const T = {
  token: l("Token", "Jeton", "Token"),
  placeholder: l(
    "Paste a JWT (eyJhbGciOi…), with or without “Bearer ”",
    "Colle un JWT (eyJhbGciOi…), avec ou sans « Bearer »",
    "JWT einfügen (eyJhbGciOi…), mit oder ohne „Bearer “",
  ),
  notSaved: l(
    "Tokens are credentials: this one is not saved nor put in share links.",
    "Un jeton est un identifiant : celui-ci n'est ni enregistré ni mis dans les liens de partage.",
    "Tokens sind Zugangsdaten: Dieses wird weder gespeichert noch in Teilen-Links übernommen.",
  ),
  header: l("Header", "En-tête", "Header"),
  payload: l("Payload", "Contenu", "Payload"),
  signature: l("Signature", "Signature", "Signatur"),
  claims: l("Dates", "Dates", "Daten"),
  claim: l("Claim", "Claim", "Claim"),
  value: l("Value", "Valeur", "Wert"),
  date: l("Date", "Date", "Datum"),
  relative: l("Relative", "Relatif", "Relativ"),
  ago: l("{d} ago", "il y a {d}", "vor {d}"),
  in: l("in {d}", "dans {d}", "in {d}"),
  validFor: l("Valid, expires in {d}", "Valide, expire dans {d}", "Gültig, läuft in {d} ab"),
  validForever: l(
    "Valid, no expiry date",
    "Valide, sans date d'expiration",
    "Gültig, ohne Ablaufdatum",
  ),
  expired: l("Expired {d} ago", "Expiré depuis {d}", "Seit {d} abgelaufen"),
  early: l(
    "Not valid yet, starts in {d}",
    "Pas encore valide, commence dans {d}",
    "Noch nicht gültig, beginnt in {d}",
  ),
  noDates: l("No exp / nbf claim", "Pas de claim exp / nbf", "Kein exp-/nbf-Claim"),
  unsigned: l(
    "Unsigned token (alg “none”): anyone can forge it.",
    "Jeton non signé (alg « none ») : n'importe qui peut le forger.",
    "Unsigniertes Token (alg „none“): Jeder kann es fälschen.",
  ),
  verify: l("Verify the signature", "Vérifier la signature", "Signatur prüfen"),
  secret: l("Secret", "Secret", "Secret"),
  secretPh: l(
    "The HMAC secret the token was signed with",
    "Le secret HMAC qui a signé le jeton",
    "Das HMAC-Secret, mit dem das Token signiert wurde",
  ),
  show: l("Show", "Afficher", "Anzeigen"),
  encoding: l("Secret format", "Format du secret", "Secret-Format"),
  text: l("Text", "Texte", "Text"),
  b64: l("Base64", "Base64", "Base64"),
  verified: l("Signature verified", "Signature vérifiée", "Signatur verifiziert"),
  invalidSig: l("Invalid signature", "Signature invalide", "Ungültige Signatur"),
  checking: l("Checking…", "Vérification…", "Wird geprüft…"),
  asymmetric: l(
    "This token uses {alg}: checking it needs the issuer's public key, which this tool does not handle.",
    "Ce jeton utilise {alg} : le vérifier demande la clé publique de l'émetteur, non gérée ici.",
    "Dieses Token nutzt {alg}: Zur Prüfung braucht es den öffentlichen Schlüssel des Ausstellers, den dieses Werkzeug nicht unterstützt.",
  ),
  notJson: l(
    "The payload is not JSON:",
    "Le contenu n'est pas du JSON :",
    "Die Payload ist kein JSON:",
  ),
  secretNote: l("Never saved.", "Jamais enregistré.", "Wird nie gespeichert."),
};

function fill(s: L10n, vars: Record<string, string>): string {
  let out = tr(s);
  for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, v);
  return out;
}

function Json({ value }: { value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <div class="jwt-json-wrap">
      <pre class="jwt-json mono">{text}</pre>
      <div class="jwt-json-copy">
        <CopyButton text={text} />
      </div>
    </div>
  );
}

export default function Jwt() {
  const token = useToolState("token", "", { persist: false, share: false });
  const secret = useToolState("secret", "", { persist: false, share: false });
  const encoding = useToolState<SecretEncoding>("encoding", "text", {
    persist: false,
    share: false,
  });
  const showSecret = useSignal(false);
  const now = useSignal(Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      now.value = Date.now();
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const decoded = useComputed(() =>
    token.value.trim() ? attempt(() => decodeJwt(token.value)) : null,
  );
  const check = useAsync(() => {
    const d = decoded.value;
    if (!d?.ok || !isHmacAlg(d.value.alg) || !secret.value) return null;
    return verifyHmac(d.value, secret.value, encoding.value);
  });

  const d = decoded.value;
  const jwt = d?.ok ? d.value : null;
  const nowSec = Math.floor(now.value / 1000);
  const v = jwt ? validity(jwt.payload, nowSec) : null;
  const dur = (s: number) => humanDuration(s, lang.value);
  const c = check.value;

  return (
    <>
      <TextBox
        label={tr(T.token)}
        value={token.value}
        onInput={(x) => {
          token.value = x;
        }}
        placeholder={tr(T.placeholder)}
        rows={5}
        files={false}
        invalid={d ? !d.ok : false}
        note={
          d && !d.ok ? (
            <span class="error">{tr(d.error)}</span>
          ) : v ? (
            <span class={`jwt-status jwt-${v.state}`} role="status">
              {v.state === "valid"
                ? v.left === null
                  ? tr(T.validForever)
                  : fill(T.validFor, { d: dur(v.left) })
                : v.state === "expired"
                  ? fill(T.expired, { d: dur(v.since) })
                  : v.state === "early"
                    ? fill(T.early, { d: dur(v.in) })
                    : tr(T.noDates)}
            </span>
          ) : (
            <span class="muted">{tr(T.notSaved)}</span>
          )
        }
      />

      {jwt && (
        <>
          <div class="grid-2">
            <Panel title={tr(T.header)} class="jwt-part jwt-part-header">
              <Json value={jwt.header} />
              {jwt.alg && (
                <p class="small muted">
                  <code>{jwt.alg}</code>
                  {algName(jwt.alg) && ` · ${algName(jwt.alg)}`}
                </p>
              )}
            </Panel>
            <Panel title={tr(T.payload)} class="jwt-part jwt-part-payload">
              {jwt.payload === null ? (
                <>
                  <p class="small muted">{tr(T.notJson)}</p>
                  <pre class="jwt-json mono">{jwt.payloadText}</pre>
                </>
              ) : (
                <Json value={jwt.payload} />
              )}
            </Panel>
          </div>

          {timeClaims(jwt.payload).length > 0 && (
            <Panel title={tr(T.claims)}>
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>{tr(T.claim)}</th>
                      <th class="num">{tr(T.value)}</th>
                      <th>{tr(T.date)}</th>
                      <th>{tr(T.relative)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeClaims(jwt.payload).map((t) => {
                      const diff = t.seconds - nowSec;
                      const name = CLAIM_NAMES[t.claim];
                      return (
                        <tr key={t.claim}>
                          <td>
                            <code>{t.claim}</code>
                            {name && <span class="muted"> · {tr(name)}</span>}
                          </td>
                          <td class="num mono">{t.seconds}</td>
                          <td>
                            {Number.isNaN(t.date.getTime())
                              ? "—"
                              : t.date.toLocaleString(locale(), {
                                  dateStyle: "medium",
                                  timeStyle: "medium",
                                })}
                          </td>
                          <td>
                            {diff >= 0
                              ? fill(T.in, { d: dur(diff) })
                              : fill(T.ago, { d: dur(-diff) })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          <Panel title={tr(T.signature)} class="jwt-part jwt-part-signature">
            <code class="jwt-sig mono">{jwt.signature || "—"}</code>
            {jwt.alg.toLowerCase() === "none" || !jwt.signature ? (
              <ErrorNote error={tr(T.unsigned)} />
            ) : isHmacAlg(jwt.alg) ? (
              <div class="stack">
                <div class="jwt-verify">
                  <Field label={tr(T.secret)} hint={tr(T.secretNote)}>
                    <input
                      class="input mono"
                      type={showSecret.value ? "text" : "password"}
                      autocomplete="off"
                      spellcheck={false}
                      value={secret.value}
                      placeholder={tr(T.secretPh)}
                      onInput={(e) => {
                        secret.value = (e.currentTarget as HTMLInputElement).value;
                      }}
                    />
                  </Field>
                  <div class="row">
                    <Segmented<SecretEncoding>
                      label={tr(T.encoding)}
                      value={encoding.value}
                      onChange={(x) => {
                        encoding.value = x;
                      }}
                      options={[
                        { value: "text", label: tr(T.text) },
                        { value: "base64", label: tr(T.b64) },
                      ]}
                    />
                    <Toggle
                      checked={showSecret.value}
                      onChange={(x) => {
                        showSecret.value = x;
                      }}
                      label={tr(T.show)}
                    />
                  </div>
                </div>
                {secret.value &&
                  (c.error ? (
                    <ErrorNote error={c.error} />
                  ) : (
                    <p
                      class={`jwt-verdict ${c.busy || c.value === null ? "" : c.value ? "ok" : "bad"}`}
                      role="status"
                    >
                      {c.busy || c.value === null
                        ? tr(T.checking)
                        : c.value
                          ? `✓ ${tr(T.verified)}`
                          : `✗ ${tr(T.invalidSig)}`}
                    </p>
                  ))}
              </div>
            ) : (
              <p class="small muted">{fill(T.asymmetric, { alg: jwt.alg })}</p>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
