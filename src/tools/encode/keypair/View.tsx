import { useSignal } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Button, ErrorNote, Output, Segmented, TextBox } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { errMsg, Select } from "../_ui";
import {
  type Algo,
  type Curve,
  fileStem,
  generateKeyPair,
  type KeyPairOut,
  type KeySpec,
  type RsaBits,
} from "./logic";

type Format = "pem" | "jwk";

const T = {
  algo: l("Algorithm", "Algorithme"),
  size: l("Key size", "Taille de clé"),
  curve: l("Curve", "Courbe"),
  bits: l("bits", "bits"),
  oaep: l("RSA-OAEP (encryption)", "RSA-OAEP (chiffrement)"),
  pss: l("RSA-PSS (signature)", "RSA-PSS (signature)"),
  ecdsa: l("ECDSA (signature)", "ECDSA (signature)"),
  ed: l("Ed25519 (signature)", "Ed25519 (signature)"),
  generate: l("Generate a key pair", "Générer une paire de clés"),
  regenerate: l("Generate again", "Générer à nouveau"),
  busy: l("Generating…", "Génération…"),
  slow: l(
    "A 4096-bit RSA key can take a few seconds.",
    "Une clé RSA de 4096 bits peut prendre quelques secondes.",
  ),
  format: l("Format", "Format"),
  publicKey: l("Public key", "Clé publique"),
  privateKey: l("Private key", "Clé privée"),
  fingerprint: l("SHA-256 fingerprint", "Empreinte SHA-256"),
  fingerprintB64: l("Fingerprint (Base64)", "Empreinte (Base64)"),
  empty: l(
    "Choose an algorithm and generate a pair. Keys are created in this tab and never stored.",
    "Choisis un algorithme et génère une paire. Les clés sont créées dans cet onglet et jamais enregistrées.",
  ),
  warn: l(
    "Keep the private key secret. It is not saved: copy or download it before leaving.",
    "Garde la clé privée secrète. Elle n'est pas enregistrée : copie-la ou télécharge-la avant de partir.",
  ),
};

export default function Keypair() {
  const algo = useToolState<Algo>("algo", "ECDSA");
  const bits = useToolState<RsaBits>("bits", "3072");
  const curve = useToolState<Curve>("curve", "P-256");
  const format = useToolState<Format>("format", "pem");
  // Generated keys stay in memory only: never persisted, never in a share link.
  const pair = useSignal<{ out: KeyPairOut; spec: KeySpec } | null>(null);
  const busy = useSignal(false);
  const error = useSignal<string | null>(null);

  const isRsa = algo.value === "RSA-OAEP" || algo.value === "RSA-PSS";

  async function generate() {
    const spec: KeySpec = { algo: algo.value, bits: bits.value, curve: curve.value };
    busy.value = true;
    error.value = null;
    try {
      pair.value = { out: await generateKeyPair(spec), spec };
    } catch (err) {
      pair.value = null;
      error.value = errMsg(err);
    } finally {
      busy.value = false;
    }
  }

  const p = pair.value;
  const stem = p ? fileStem(p.spec) : "key";
  const jwk = format.value === "jwk";

  return (
    <>
      <div class="grid-3">
        <Select<Algo>
          label={tr(T.algo)}
          value={algo.value}
          onChange={(v) => {
            algo.value = v;
          }}
          options={[
            { value: "ECDSA", label: tr(T.ecdsa) },
            { value: "Ed25519", label: tr(T.ed) },
            { value: "RSA-PSS", label: tr(T.pss) },
            { value: "RSA-OAEP", label: tr(T.oaep) },
          ]}
        />
        {isRsa && (
          <Select<RsaBits>
            label={tr(T.size)}
            value={bits.value}
            onChange={(v) => {
              bits.value = v;
            }}
            options={(["2048", "3072", "4096"] as const).map((b) => ({
              value: b,
              label: `${b} ${tr(T.bits)}`,
            }))}
            {...(bits.value === "4096" ? { hint: tr(T.slow) } : {})}
          />
        )}
        {algo.value === "ECDSA" && (
          <Select<Curve>
            label={tr(T.curve)}
            value={curve.value}
            onChange={(v) => {
              curve.value = v;
            }}
            options={(["P-256", "P-384", "P-521"] as const).map((c) => ({ value: c, label: c }))}
          />
        )}
      </div>

      <div class="row">
        <Button
          variant="primary"
          icon={p ? "refresh" : "plus"}
          disabled={busy.value}
          onClick={generate}
        >
          {busy.value ? tr(T.busy) : p ? tr(T.regenerate) : tr(T.generate)}
        </Button>
        <span class="spacer" />
        {p && (
          <Segmented<Format>
            label={tr(T.format)}
            value={format.value}
            onChange={(v) => {
              format.value = v;
            }}
            options={[
              { value: "pem", label: "PEM" },
              { value: "jwk", label: "JWK" },
            ]}
          />
        )}
      </div>

      <ErrorNote error={error.value} />

      {p ? (
        <>
          <p class="keypair-label small muted">
            {p.out.label} · <span class="keypair-warn">{tr(T.warn)}</span>
          </p>
          <div class="grid-2">
            <TextBox
              label={`${tr(T.publicKey)} · ${jwk ? "JWK" : "SPKI"}`}
              value={jwk ? p.out.publicJwk : p.out.publicPem}
              readOnly
              rows={jwk ? 12 : 9}
              wrap={false}
              downloadName={jwk ? `${stem}.public.jwk.json` : `${stem}.public.pem`}
            />
            <TextBox
              label={`${tr(T.privateKey)} · ${jwk ? "JWK" : "PKCS #8"}`}
              value={jwk ? p.out.privateJwk : p.out.privatePem}
              readOnly
              rows={jwk ? 12 : 9}
              wrap={false}
              downloadName={jwk ? `${stem}.private.jwk.json` : `${stem}.private.pem`}
            />
          </div>
          <Output label={tr(T.fingerprint)} value={p.out.fingerprint} />
          <Output label={tr(T.fingerprintB64)} value={p.out.fingerprintB64} />
        </>
      ) : (
        !error.value && <p class="muted">{tr(T.empty)}</p>
      )}
    </>
  );
}
