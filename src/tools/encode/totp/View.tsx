import { useComputed, useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import qrcode from "qrcode-generator";
import { useToolState } from "../../../app/state";
import {
  Button,
  CopyButton,
  downloadText,
  ErrorNote,
  Field,
  Output,
  Panel,
  Segmented,
} from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { attempt } from "../_shared";
import { NumberField, Select, useAsync } from "../_ui";
import {
  type Algorithm,
  buildOtpauth,
  counterAt,
  DEFAULTS,
  generateSecret,
  hotp,
  readSource,
  secondsLeft,
} from "./logic";

const T = {
  current: l("Current code", "Code actuel"),
  secret: l("Secret (Base32) or otpauth:// link", "Secret (Base32) ou lien otpauth://"),
  secretPh: l(
    "e.g. JBSWY3DPEHPK3PXP or otpauth://totp/…",
    "par ex. JBSWY3DPEHPK3PXP ou otpauth://totp/…",
  ),
  secretHint: l(
    "Never stored or put in share links. Codes are computed in this tab.",
    "Jamais enregistré ni mis dans les liens de partage. Les codes sont calculés dans cet onglet.",
  ),
  algorithm: l("Algorithm", "Algorithme"),
  digits: l("Digits", "Chiffres"),
  period: l("Period (seconds)", "Période (secondes)"),
  fromLink: l("From the link", "D'après le lien"),
  issuer: l("Issuer", "Émetteur"),
  account: l("Account", "Compte"),
  left: l("{n} s left", "encore {n} s"),
  previous: l("Previous", "Précédent"),
  next: l("Next", "Suivant"),
  empty: l(
    "Paste a 2FA secret or an otpauth:// link to see its codes.",
    "Colle un secret 2FA ou un lien otpauth:// pour voir ses codes.",
  ),
  create: l("New secret", "Nouveau secret"),
  issuerPh: l("e.g. My App", "par ex. Mon appli"),
  accountPh: l("e.g. alice@example.com", "par ex. alice@example.com"),
  newSecret: l("Secret", "Secret"),
  uri: l("otpauth link", "Lien otpauth"),
  regenerate: l("New secret", "Nouveau secret"),
  test: l("Use above", "Utiliser ci-dessus"),
  svg: l("Download SVG", "Télécharger le SVG"),
  qrLabel: l("QR code of the otpauth link", "QR code du lien otpauth"),
  createNote: l(
    "160-bit random secret, SHA-1, 6 digits, 30 seconds: the settings every authenticator app supports. Scan the QR code, then check that both show the same code.",
    "Secret aléatoire de 160 bits, SHA-1, 6 chiffres, 30 secondes : les réglages que toutes les applis d'authentification acceptent. Scanne le QR code, puis vérifie que les deux affichent le même code.",
  ),
};

/** "123456" → "123 456", "12345678" → "1234 5678". */
function group(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)} ${code.slice(half)}`;
}

/** The QR modules as one SVG path (with a 4-module quiet zone), or null if it cannot fit. */
function qrPath(text: string): { size: number; d: string } | null {
  try {
    const q = qrcode(0, "M");
    q.addData(text, "Byte");
    q.make();
    const n = q.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return { size: n + 8, d };
  } catch {
    return null;
  }
}

function qrSvg(qr: { size: number; d: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.size} ${qr.size}" width="${qr.size * 8}" height="${qr.size * 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${qr.d}" fill="#000"/></svg>`;
}

export default function Totp() {
  // The secret is what logs in: neither stored nor shared.
  const secret = useToolState("secret", "", { persist: false, share: false });
  const algorithm = useToolState<Algorithm>("algorithm", DEFAULTS.algorithm);
  const digits = useToolState("digits", DEFAULTS.digits);
  const period = useToolState("period", DEFAULTS.period);
  const issuer = useToolState("issuer", "");
  const account = useToolState("account", "");
  const fresh = useSignal(generateSecret());
  const now = useSignal(Date.now() / 1000);

  useEffect(() => {
    const id = setInterval(() => {
      now.value = Date.now() / 1000;
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const source = useComputed(() =>
    attempt(() =>
      readSource(secret.value, {
        algorithm: algorithm.value,
        digits: digits.value,
        period: period.value,
      }),
    ),
  );
  const counter = useComputed(() => {
    const s = source.value;
    return s.ok && s.value ? counterAt(now.value, s.value.params.period) : 0;
  });
  const codes = useAsync(() => {
    const s = source.value;
    if (!s.ok || !s.value) return null;
    const { key, params } = s.value;
    const c = counter.value;
    return Promise.all(
      [c - 1, c, c + 1].map((n) => hotp(key, Math.max(0, n), params.digits, params.algorithm)),
    );
  });
  const uri = useComputed(() =>
    buildOtpauth({
      ...DEFAULTS,
      secret: fresh.value,
      issuer: issuer.value.trim(),
      account: account.value.trim() || "user",
    }),
  );
  const qr = useComputed(() => qrPath(uri.value));

  const src = source.value;
  const info = src.ok ? src.value : null;
  const per = info?.params.period ?? 30;
  const left = secondsLeft(now.value, per);
  const cs = codes.value;
  const [prev, code, next] = cs.value ?? [];

  return (
    <>
      <Panel title={tr(T.current)}>
        <Field label={tr(T.secret)} hint={tr(T.secretHint)}>
          <input
            class="input mono"
            value={secret.value}
            placeholder={tr(T.secretPh)}
            autocomplete="off"
            spellcheck={false}
            aria-invalid={!src.ok}
            onInput={(e) => {
              secret.value = (e.currentTarget as HTMLInputElement).value;
            }}
          />
        </Field>
        {info?.link ? (
          <p class="small muted">
            {tr(T.fromLink)} ·{" "}
            {[
              info.link.issuer,
              info.link.account,
              info.link.algorithm,
              `${info.link.digits} ${tr(T.digits).toLowerCase()}`,
              `${info.link.period} s`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : (
          <div class="totp-params">
            <Select<Algorithm>
              label={tr(T.algorithm)}
              value={algorithm.value}
              onChange={(v) => {
                algorithm.value = v;
              }}
              options={[
                { value: "SHA1", label: "SHA-1" },
                { value: "SHA256", label: "SHA-256" },
                { value: "SHA512", label: "SHA-512" },
              ]}
            />
            <Field label={tr(T.digits)}>
              <Segmented<"6" | "8">
                label={tr(T.digits)}
                value={digits.value === 8 ? "8" : "6"}
                onChange={(v) => {
                  digits.value = Number(v);
                }}
                options={[
                  { value: "6", label: "6" },
                  { value: "8", label: "8" },
                ]}
              />
            </Field>
            <NumberField
              label={tr(T.period)}
              value={period.value}
              min={1}
              max={3600}
              onChange={(v) => {
                period.value = v;
              }}
            />
          </div>
        )}
        {!src.ok && <ErrorNote error={tr(src.error)} />}
        {cs.error && <ErrorNote error={cs.error} />}
        {src.ok && !info && <p class="muted">{tr(T.empty)}</p>}
        {info && code && (
          <div class="totp-display">
            <div class="totp-main">
              <output class="totp-code mono" aria-live="polite">
                {group(code)}
              </output>
              <CopyButton text={code} size="md" />
            </div>
            <div
              class={`totp-bar ${left <= 5 ? "totp-bar-low" : ""}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={per}
              aria-valuenow={left}
            >
              <span style={{ width: `${(left / per) * 100}%` }} />
            </div>
            <p class="small muted">
              {tr(T.left).replace("{n}", fmt(left))} · {tr(T.previous)}{" "}
              <span class="mono">{prev}</span> · {tr(T.next)} <span class="mono">{next}</span>
            </p>
          </div>
        )}
      </Panel>

      <Panel
        title={tr(T.create)}
        actions={
          <Button
            size="sm"
            icon="refresh"
            onClick={() => {
              fresh.value = generateSecret();
            }}
          >
            {tr(T.regenerate)}
          </Button>
        }
      >
        <div class="grid-2">
          <Field label={tr(T.issuer)}>
            <input
              class="input"
              value={issuer.value}
              placeholder={tr(T.issuerPh)}
              onInput={(e) => {
                issuer.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
          <Field label={tr(T.account)}>
            <input
              class="input"
              value={account.value}
              placeholder={tr(T.accountPh)}
              onInput={(e) => {
                account.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
        </div>
        <div class="totp-new">
          {qr.value && (
            <svg
              class="totp-qr"
              viewBox={`0 0 ${qr.value.size} ${qr.value.size}`}
              shape-rendering="crispEdges"
              role="img"
              aria-label={tr(T.qrLabel)}
            >
              <path d={qr.value.d} fill="currentColor" />
            </svg>
          )}
          <div class="stack totp-new-text">
            <Output label={tr(T.newSecret)} value={fresh.value} />
            <Output label={tr(T.uri)} value={uri.value} />
            <div class="row">
              <Button
                size="sm"
                icon="check"
                onClick={() => {
                  secret.value = uri.value;
                }}
              >
                {tr(T.test)}
              </Button>
              {qr.value && (
                <Button
                  size="sm"
                  icon="download"
                  onClick={() => {
                    if (qr.value) downloadText(qrSvg(qr.value), "totp-qr.svg", "image/svg+xml");
                  }}
                >
                  {tr(T.svg)}
                </Button>
              )}
            </div>
            <p class="small muted">{tr(T.createNote)}</p>
          </div>
        </div>
      </Panel>
    </>
  );
}
