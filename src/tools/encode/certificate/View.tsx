import { useComputed } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { Badge } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, CopyButton, ErrorNote, Output, Panel, pickFiles, TextBox } from "../../../app/ui";
import { fmt, l, lang, tr } from "../../../i18n";
import { useAsync } from "../_ui";
import {
  type Decoded,
  type Entry,
  fingerprints,
  formatName,
  issuerLinks,
  KEY_USAGES,
  keyLabel,
  lifetimeDays,
  parseFile,
  parseText,
  shortName,
  toPem,
  validity,
} from "./logic";

const T = {
  input: l("Certificate (PEM)", "Certificat (PEM)"),
  placeholder: l(
    "Paste one or more PEM blocks (-----BEGIN CERTIFICATE-----…), a whole chain, or a certificate request (CSR)…",
    "Colle un ou plusieurs blocs PEM (-----BEGIN CERTIFICATE-----…), une chaîne entière, ou une demande de certificat (CSR)…",
  ),
  open: l("Open a file", "Ouvrir un fichier"),
  found: l("{n} item(s) found", "{n} élément(s) trouvé(s)"),
  certificate: l("Certificate", "Certificat"),
  csr: l("Certificate request (CSR)", "Demande de certificat (CSR)"),
  root: l("Self-signed", "Auto-signé"),
  ca: l("CA", "AC"),
  subject: l("Subject", "Sujet"),
  issuer: l("Issuer", "Émetteur"),
  issuedBy: l("issued by #{n} above", "émis par le n°{n} ci-dessus"),
  serial: l("Serial number", "Numéro de série"),
  version: l("Version", "Version"),
  notBefore: l("Valid from", "Valide à partir du"),
  notAfter: l("Valid until", "Valide jusqu'au"),
  status: l("Status", "État"),
  validFor: l("Valid · expires in {n} days", "Valide · expire dans {n} jours"),
  validToday: l("Valid · expires within a day", "Valide · expire dans moins d'un jour"),
  expired: l("Expired {n} days ago", "Expiré depuis {n} jours"),
  expiredToday: l("Expired less than a day ago", "Expiré depuis moins d'un jour"),
  notYet: l("Not valid yet (starts in {n} days)", "Pas encore valide (commence dans {n} jours)"),
  lifetime: l("Lifetime", "Durée de validité"),
  days: l("{n} days", "{n} jours"),
  key: l("Public key", "Clé publique"),
  bits: l("bits", "bits"),
  exponent: l("exponent", "exposant"),
  sigAlg: l("Signature algorithm", "Algorithme de signature"),
  san: l("Alternative names (SAN)", "Noms alternatifs (SAN)"),
  ku: l("Key usage", "Utilisation de la clé"),
  eku: l("Extended key usage", "Utilisation étendue"),
  bc: l("Basic constraints", "Contraintes de base"),
  isCa: l("CA: yes", "AC : oui"),
  notCa: l("CA: no (end entity)", "AC : non (entité finale)"),
  pathLen: l("path length ≤ {n}", "longueur de chaîne ≤ {n}"),
  ski: l("Subject key ID", "ID de clé du sujet"),
  aki: l("Authority key ID", "ID de clé de l'autorité"),
  ocsp: l("OCSP", "OCSP"),
  caIssuers: l("CA issuers", "Émetteurs de l'AC"),
  crl: l("CRL", "CRL"),
  policies: l("Policies", "Politiques"),
  extensions: l("Extensions", "Extensions"),
  critical: l("critical", "critique"),
  none: l("none", "aucune"),
  fingerprints: l("Fingerprints", "Empreintes"),
  copyPem: l("Copy PEM", "Copier le PEM"),
  empty: l(
    "Paste a certificate or open a .pem / .crt / .cer / .der / .csr file. Nothing leaves your device.",
    "Colle un certificat ou ouvre un fichier .pem / .crt / .cer / .der / .csr. Rien ne quitte ton appareil.",
  ),
};

function locale(): string {
  return lang.value === "fr" ? "fr-FR" : "en-US";
}

function utc(d: Date): string {
  return `${new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(d)} UTC`;
}

function Row({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{children}</td>
    </tr>
  );
}

function ValidityBadge({ d }: { d: Decoded }) {
  if (!d.notBefore || !d.notAfter) return null;
  const v = validity(d.notBefore, d.notAfter, new Date());
  if (v.state === "expired")
    return (
      <Badge kind="bad">
        {v.daysAgo ? tr(T.expired).replace("{n}", fmt(v.daysAgo)) : tr(T.expiredToday)}
      </Badge>
    );
  if (v.state === "not-yet")
    return <Badge kind="warn">{tr(T.notYet).replace("{n}", fmt(v.daysUntil))}</Badge>;
  return (
    <Badge kind={v.daysLeft < 30 ? "warn" : "ok"}>
      {v.daysLeft ? tr(T.validFor).replace("{n}", fmt(v.daysLeft)) : tr(T.validToday)}
    </Badge>
  );
}

function List({ items }: { items: string[] }) {
  if (!items.length) return <span class="muted">{tr(T.none)}</span>;
  return (
    <ul class="certificate-list">
      {items.map((s, i) => (
        <li key={i} class="mono">
          {s}
        </li>
      ))}
    </ul>
  );
}

function Card({
  d,
  index,
  issuerIndex,
  prints,
}: {
  d: Decoded;
  index: number;
  issuerIndex: number | null;
  prints: { sha1: string; sha256: string } | undefined;
}) {
  const kuNames = d.keyUsage?.map((id) => {
    const k = KEY_USAGES.find((x) => x.id === id);
    return k ? tr(k.name) : id;
  });
  const isCert = d.kind === "certificate";
  return (
    <Panel
      title={`#${index + 1} · ${shortName(d.subject)}`}
      class="certificate-card"
      actions={
        <>
          <Badge kind="info">{tr(isCert ? T.certificate : T.csr)}</Badge>
          {d.basicConstraints?.ca && <Badge kind="info">{tr(T.ca)}</Badge>}
          {isCert && d.selfSigned && <Badge kind="info">{tr(T.root)}</Badge>}
          <ValidityBadge d={d} />
          <CopyButton text={() => toPem(d)} label={tr(T.copyPem)} />
        </>
      }
    >
      <div class="table-wrap">
        <table class="table certificate-table">
          <tbody>
            <Row label={tr(T.subject)}>
              <span class="mono">{formatName(d.subject) || "—"}</span>
            </Row>
            {d.issuer && (
              <Row label={tr(T.issuer)}>
                <span class="mono">{formatName(d.issuer) || "—"}</span>
                {issuerIndex !== null && issuerIndex !== index && (
                  <span class="muted small">
                    {" "}
                    · {tr(T.issuedBy).replace("{n}", String(issuerIndex + 1))}
                  </span>
                )}
              </Row>
            )}
            {d.serialHex !== null && (
              <Row label={tr(T.serial)}>
                <span class="mono">{d.serialHex}</span>
                {d.serialDec && d.serialDec.length <= 40 && (
                  <span class="muted small"> ({d.serialDec})</span>
                )}
              </Row>
            )}
            <Row label={tr(T.version)}>v{d.version}</Row>
            {d.notBefore && <Row label={tr(T.notBefore)}>{utc(d.notBefore)}</Row>}
            {d.notAfter && <Row label={tr(T.notAfter)}>{utc(d.notAfter)}</Row>}
            {d.notBefore && d.notAfter && (
              <Row label={tr(T.lifetime)}>
                {tr(T.days).replace("{n}", fmt(lifetimeDays(d.notBefore, d.notAfter)))}
              </Row>
            )}
            <Row label={tr(T.key)}>
              {keyLabel(d.publicKey, tr(T.bits))}
              {d.publicKey.exponent !== null && (
                <span class="muted small">
                  {" "}
                  ({tr(T.exponent)} {fmt(d.publicKey.exponent)})
                </span>
              )}
            </Row>
            <Row label={tr(T.sigAlg)}>{d.signatureAlgorithm}</Row>
            <Row label={tr(T.san)}>
              <List items={d.san.map((s) => `${s.type}: ${s.value}`)} />
            </Row>
            {kuNames && (
              <Row label={tr(T.ku)}>
                <List items={kuNames} />
              </Row>
            )}
            {d.extKeyUsage && (
              <Row label={tr(T.eku)}>
                <List items={d.extKeyUsage.map((e) => (e.name ? tr(e.name) : e.oid))} />
              </Row>
            )}
            {d.basicConstraints && (
              <Row label={tr(T.bc)}>
                {tr(d.basicConstraints.ca ? T.isCa : T.notCa)}
                {d.basicConstraints.pathLen !== null &&
                  `, ${tr(T.pathLen).replace("{n}", String(d.basicConstraints.pathLen))}`}
              </Row>
            )}
            {d.subjectKeyId && (
              <Row label={tr(T.ski)}>
                <span class="mono small">{d.subjectKeyId}</span>
              </Row>
            )}
            {d.authorityKeyId && (
              <Row label={tr(T.aki)}>
                <span class="mono small">{d.authorityKeyId}</span>
              </Row>
            )}
            {d.ocsp.length > 0 && (
              <Row label={tr(T.ocsp)}>
                <List items={d.ocsp} />
              </Row>
            )}
            {d.caIssuers.length > 0 && (
              <Row label={tr(T.caIssuers)}>
                <List items={d.caIssuers} />
              </Row>
            )}
            {d.crl.length > 0 && (
              <Row label={tr(T.crl)}>
                <List items={d.crl} />
              </Row>
            )}
            {d.policies.length > 0 && (
              <Row label={tr(T.policies)}>
                <List items={d.policies} />
              </Row>
            )}
            <Row label={tr(T.extensions)}>
              <List
                items={d.extensions.map(
                  (e) =>
                    `${e.name ? tr(e.name) : e.oid}${e.critical ? ` (${tr(T.critical)})` : ""}`,
                )}
              />
            </Row>
          </tbody>
        </table>
      </div>
      <div class="stack certificate-prints">
        <Output label="SHA-256" value={prints?.sha256 ?? ""} />
        <Output label="SHA-1" value={prints?.sha1 ?? ""} />
      </div>
    </Panel>
  );
}

export default function Certificate() {
  const input = useToolState("pem", "");
  const entries = useComputed<Entry[]>(() => parseText(input.value));
  const decoded = useComputed(() =>
    entries.value.map((e) => (e.result.ok ? e.result.value : null)),
  );
  const prints = useAsync(() => {
    const list = decoded.value;
    if (!list.some(Boolean)) return null;
    return Promise.all(list.map((d) => (d ? fingerprints(d.der) : Promise.resolve(null))));
  });

  const list = decoded.value;
  const links = issuerLinks(list);
  const ok = list.filter(Boolean).length;

  async function openFile() {
    const [f] = await pickFiles(".pem,.crt,.cer,.der,.csr,.req,.p10,.txt");
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    const parsed = parseFile(bytes);
    const first = parsed[0];
    // A binary DER file is turned into PEM text so it can be read, copied and shared.
    input.value =
      first?.label === "DER" && first.result.ok
        ? toPem(first.result.value)
        : new TextDecoder().decode(bytes);
  }

  return (
    <>
      <TextBox
        label={tr(T.input)}
        value={input.value}
        onInput={(v) => {
          input.value = v;
        }}
        placeholder={tr(T.placeholder)}
        rows={8}
        files={false}
        actions={
          <Button size="sm" variant="ghost" icon="upload" onClick={openFile}>
            {tr(T.open)}
          </Button>
        }
      />

      {!input.value.trim() && <p class="muted small">{tr(T.empty)}</p>}
      {ok > 1 && <p class="muted small">{tr(T.found).replace("{n}", String(ok))}</p>}

      {entries.value.map((e, i) =>
        e.result.ok ? (
          <Card
            key={`${i}-${e.label}`}
            d={e.result.value}
            index={i}
            issuerIndex={links[i] ?? null}
            prints={prints.value.value?.[i] ?? undefined}
          />
        ) : (
          <ErrorNote key={i} error={`${e.label ? `#${i + 1} · ` : ""}${tr(e.result.error)}`} />
        ),
      )}
    </>
  );
}
