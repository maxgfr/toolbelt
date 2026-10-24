import { useSignal, useSignalEffect } from "@preact/signals";
import { NumberField, Select } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import {
  Button,
  downloadBlob,
  ErrorNote,
  Field,
  FileDrop,
  Segmented,
  Stats,
  TextBox,
  Toggle,
} from "../../../app/ui";
import { fmt, l, lang, tr } from "../../../i18n";
import { formatSize, fromUtf8, isUtf8 } from "../_shared";
import { errMsg } from "../_ui";
import {
  ARGON2_DEFAULT,
  armor,
  dearmor,
  decrypt,
  encName,
  encrypt,
  type Header,
  isContainer,
  type Kdf,
  kdfLabel,
  type Payload,
} from "./logic";

type Mode = "encrypt" | "decrypt";
type Source = "text" | "file";
type KdfKind = Kdf["kind"];

/** Decrypted text above this size is offered as a download instead of shown. */
const SHOW_MAX = 1_000_000;

const T = {
  encrypt: l("Encrypt", "Chiffrer"),
  decrypt: l("Decrypt", "Déchiffrer"),
  mode: l("Mode", "Mode"),
  source: l("Source", "Source"),
  text: l("Text", "Texte"),
  file: l("File", "Fichier"),
  plain: l("Text to encrypt", "Texte à chiffrer"),
  plainPh: l("Type or paste the secret text…", "Tape ou colle le texte secret…"),
  cipher: l("Encrypted text (Base64)", "Texte chiffré (Base64)"),
  cipherPh: l(
    "Paste text encrypted by this tool (it starts with VEJFTg…)",
    "Colle un texte chiffré par cet outil (il commence par VEJFTg…)",
  ),
  dropEnc: l(
    "Drop a file to encrypt, or click to choose",
    "Dépose un fichier à chiffrer, ou clique pour choisir",
  ),
  dropDec: l(
    "Drop an .enc file (or a text file with the Base64), or click to choose",
    "Dépose un fichier .enc (ou un fichier texte avec le Base64), ou clique pour choisir",
  ),
  password: l("Password", "Mot de passe"),
  passwordNote: l(
    "Never saved nor shared. Lost password = lost data: there is no recovery.",
    "Jamais enregistré ni partagé. Mot de passe perdu = données perdues : aucune récupération.",
  ),
  show: l("Show", "Afficher"),
  kdf: l("Key derivation", "Dérivation de clé"),
  pbkdf2: l("PBKDF2-SHA256 (WebCrypto)", "PBKDF2-SHA256 (WebCrypto)"),
  argon2: l("Argon2id (memory-hard, slower)", "Argon2id (gourmand en mémoire, plus lent)"),
  iterations: l("PBKDF2 iterations", "Itérations PBKDF2"),
  iterHint: l(
    "600,000 is OWASP's recommendation; more is slower for you and for an attacker.",
    "600 000 est la recommandation de l'OWASP ; plus, c'est plus lent pour toi comme pour un attaquant.",
  ),
  argonInfo: l("Argon2id parameters", "Paramètres Argon2id"),
  busyEnc: l("Deriving the key and encrypting…", "Dérivation de la clé et chiffrement…"),
  busyDec: l("Deriving the key and decrypting…", "Dérivation de la clé et déchiffrement…"),
  result: l("Encrypted (Base64)", "Chiffré (Base64)"),
  decrypted: l("Decrypted text", "Texte déchiffré"),
  downloadEnc: l("Download {name}", "Télécharger {name}"),
  downloadBin: l("Download as .enc file", "Télécharger en fichier .enc"),
  usedKdf: l("Key derivation used", "Dérivation de clé utilisée"),
  original: l("Original", "Original"),
  encrypted: l("Encrypted", "Chiffré"),
  size: l("Size", "Taille"),
  algo: l("Cipher", "Chiffrement"),
  tooBig: l(
    "The decrypted text is large: download it instead.",
    "Le texte déchiffré est volumineux : télécharge-le plutôt.",
  ),
  fileInText: l("This contains the file {name}.", "Cela contient le fichier {name}."),
  needPassword: l("Enter a password first.", "Saisis d'abord un mot de passe."),
  about: l(
    "AES-256-GCM with a random salt and IV, in a versioned format that records the key derivation settings. Everything happens in this tab.",
    "AES-256-GCM avec sel et IV aléatoires, dans un format versionné qui garde les réglages de dérivation de clé. Tout se passe dans cet onglet.",
  ),
};

interface Loaded {
  name: string;
  bytes: Uint8Array;
}

type Done =
  | { mode: "encrypt"; bytes: Uint8Array; name: string; inSize: number }
  | { mode: "decrypt"; payload: Payload; header: Header };

function locale(): string {
  return lang.value === "fr" ? "fr-FR" : "en-US";
}

export default function Encrypt() {
  const mode = useToolState<Mode>("mode", "encrypt");
  const source = useToolState<Source>("source", "text");
  const kdfKind = useToolState<KdfKind>("kdf", "pbkdf2");
  const iterations = useToolState("iterations", 600_000);
  // Secrets and plaintext stay in memory only.
  const password = useToolState("password", "", { persist: false, share: false });
  const plain = useToolState("plain", "", { persist: false, share: false });
  const cipher = useToolState("cipher", "", { share: false });
  const showPw = useSignal(false);
  const file = useSignal<Loaded | null>(null);
  const busy = useSignal(false);
  const error = useSignal<string | null>(null);
  const done = useSignal<Done | null>(null);

  // Any change of input or settings makes the previous result stale.
  useSignalEffect(() => {
    void [mode.value, source.value, kdfKind.value, iterations.value, password.value];
    void [plain.value, cipher.value, file.value];
    done.value = null;
    error.value = null;
  });

  const kdf: Kdf =
    kdfKind.value === "pbkdf2" ? { kind: "pbkdf2", iterations: iterations.value } : ARGON2_DEFAULT;
  const fr = lang.value === "fr";
  const nf = (n: number) => fmt(n);

  async function run() {
    if (!password.value) {
      error.value = tr(T.needPassword);
      return;
    }
    busy.value = true;
    error.value = null;
    done.value = null;
    // Let the busy state paint before the key derivation blocks for a moment.
    await new Promise((r) => setTimeout(r, 30));
    try {
      if (mode.value === "encrypt") {
        const f = file.value;
        const payload: Payload =
          source.value === "file" && f
            ? { kind: "file", name: f.name, data: f.bytes }
            : { kind: "text", text: plain.value };
        const bytes = await encrypt(payload, password.value, kdf);
        const inSize = payload.kind === "file" ? payload.data.length : bytes.length;
        done.value = { mode: "encrypt", bytes, name: f?.name ?? "text.txt", inSize };
      } else {
        const f = file.value;
        let bytes: Uint8Array;
        if (source.value === "file" && f)
          bytes = isContainer(f.bytes) || !isUtf8(f.bytes) ? f.bytes : dearmor(fromUtf8(f.bytes));
        else bytes = dearmor(cipher.value);
        const r = await decrypt(bytes, password.value);
        done.value = { mode: "decrypt", payload: r.payload, header: r.header };
      }
    } catch (err) {
      error.value = errMsg(err);
    } finally {
      busy.value = false;
    }
  }

  const isEnc = mode.value === "encrypt";
  const f = file.value;
  const ready = source.value === "file" ? !!f : isEnc ? true : cipher.value.trim().length > 0;
  const d = done.value;

  return (
    <>
      <div class="row">
        <Segmented<Mode>
          label={tr(T.mode)}
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
            file.value = null;
          }}
          options={[
            { value: "encrypt", label: tr(T.encrypt) },
            { value: "decrypt", label: tr(T.decrypt) },
          ]}
        />
        <Segmented<Source>
          label={tr(T.source)}
          value={source.value}
          onChange={(v) => {
            source.value = v;
          }}
          options={[
            { value: "text", label: tr(T.text) },
            { value: "file", label: tr(T.file) },
          ]}
        />
      </div>

      {source.value === "file" ? (
        <FileDrop
          label={
            f
              ? `${f.name} · ${formatSize(f.bytes.length, locale())}`
              : tr(isEnc ? T.dropEnc : T.dropDec)
          }
          onFiles={async (list) => {
            const x = list[0];
            if (x) file.value = { name: x.name, bytes: new Uint8Array(await x.arrayBuffer()) };
          }}
        />
      ) : isEnc ? (
        <TextBox
          label={tr(T.plain)}
          value={plain.value}
          onInput={(v) => {
            plain.value = v;
          }}
          placeholder={tr(T.plainPh)}
          rows={6}
          mono={false}
        />
      ) : (
        <TextBox
          label={tr(T.cipher)}
          value={cipher.value}
          onInput={(v) => {
            cipher.value = v;
          }}
          placeholder={tr(T.cipherPh)}
          rows={6}
        />
      )}

      <div class="encrypt-key">
        <Field label={tr(T.password)} hint={tr(T.passwordNote)}>
          <input
            class="input"
            type={showPw.value ? "text" : "password"}
            autocomplete={isEnc ? "new-password" : "current-password"}
            spellcheck={false}
            value={password.value}
            onInput={(e) => {
              password.value = (e.currentTarget as HTMLInputElement).value;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ready && !busy.value) run();
            }}
          />
        </Field>
        <div class="row">
          <Toggle
            checked={showPw.value}
            onChange={(v) => {
              showPw.value = v;
            }}
            label={tr(T.show)}
          />
        </div>
      </div>

      {isEnc && (
        <div class="grid-2">
          <Select<KdfKind>
            label={tr(T.kdf)}
            value={kdfKind.value}
            onChange={(v) => {
              kdfKind.value = v;
            }}
            options={[
              { value: "pbkdf2", label: tr(T.pbkdf2) },
              { value: "argon2id", label: tr(T.argon2) },
            ]}
          />
          {kdfKind.value === "pbkdf2" ? (
            <NumberField
              label={tr(T.iterations)}
              value={iterations.value}
              min={100_000}
              max={10_000_000}
              step={100_000}
              integer
              hint={tr(T.iterHint)}
              onChange={(v) => {
                iterations.value = v;
              }}
            />
          ) : (
            <Field label={tr(T.argonInfo)}>
              <span class="encrypt-params mono small">{kdfLabel(ARGON2_DEFAULT, nf, fr)}</span>
            </Field>
          )}
        </div>
      )}

      <div class="row">
        <Button
          variant="primary"
          icon={isEnc ? "check" : "eye"}
          disabled={busy.value || !ready}
          onClick={run}
        >
          {busy.value ? tr(isEnc ? T.busyEnc : T.busyDec) : tr(isEnc ? T.encrypt : T.decrypt)}
        </Button>
        {isEnc && <span class="muted small">{kdfLabel(kdf, nf, fr)} · AES-256-GCM</span>}
      </div>

      <ErrorNote error={error.value} />

      {d?.mode === "encrypt" && <EncryptResult d={d} file={source.value === "file"} />}
      {d?.mode === "decrypt" && <DecryptResult d={d} />}

      <p class="muted small">{tr(T.about)}</p>
    </>
  );
}

function EncryptResult({ d, file }: { d: Extract<Done, { mode: "encrypt" }>; file: boolean }) {
  const name = file ? encName(d.name) : "encrypted.enc";
  const download = () =>
    downloadBlob(new Blob([new Uint8Array(d.bytes)], { type: "application/octet-stream" }), name);
  return (
    <>
      {file ? (
        <>
          <Stats
            items={[
              { label: tr(T.original), value: formatSize(d.inSize, locale()) },
              { label: tr(T.encrypted), value: formatSize(d.bytes.length, locale()) },
            ]}
          />
          <div class="row">
            <Button variant="primary" icon="download" onClick={download}>
              {tr(T.downloadEnc).replace("{name}", name)}
            </Button>
          </div>
        </>
      ) : (
        <>
          <TextBox
            label={tr(T.result)}
            value={armor(d.bytes, true)}
            readOnly
            rows={6}
            downloadName="encrypted.txt"
          />
          <div class="row">
            <Button size="sm" variant="ghost" icon="download" onClick={download}>
              {tr(T.downloadBin)}
            </Button>
          </div>
        </>
      )}
    </>
  );
}

function DecryptResult({ d }: { d: Extract<Done, { mode: "decrypt" }> }) {
  const p = d.payload;
  const nf = (n: number) => fmt(n);
  return (
    <>
      <Stats
        items={[
          { label: tr(T.algo), value: "AES-256-GCM" },
          { label: tr(T.usedKdf), value: kdfLabel(d.header.kdf, nf, lang.value === "fr") },
          {
            label: tr(T.size),
            value: formatSize(
              p.kind === "file" ? p.data.length : new TextEncoder().encode(p.text).length,
              locale(),
            ),
          },
        ]}
      />
      {p.kind === "text" ? (
        p.text.length <= SHOW_MAX ? (
          <TextBox
            label={tr(T.decrypted)}
            value={p.text}
            readOnly
            rows={8}
            mono={false}
            downloadName="decrypted.txt"
          />
        ) : (
          <>
            <p class="muted small">{tr(T.tooBig)}</p>
            <Button
              variant="primary"
              icon="download"
              onClick={() =>
                downloadBlob(new Blob([p.text], { type: "text/plain" }), "decrypted.txt")
              }
            >
              {tr(T.downloadEnc).replace("{name}", "decrypted.txt")}
            </Button>
          </>
        )
      ) : (
        <>
          <p class="small">{tr(T.fileInText).replace("{name}", p.name)}</p>
          <div class="row">
            <Button
              variant="primary"
              icon="download"
              onClick={() =>
                downloadBlob(
                  new Blob([new Uint8Array(p.data)], { type: "application/octet-stream" }),
                  p.name,
                )
              }
            >
              {tr(T.downloadEnc).replace("{name}", p.name)}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
