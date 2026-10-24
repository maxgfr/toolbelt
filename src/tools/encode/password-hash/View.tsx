import { useSignal } from "@preact/signals";
import { useRef } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { Button, ErrorNote, Field, Output, Segmented, Toggle } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { errMsg, NumberField } from "../_ui";
import {
  ARGON2_DEFAULTS,
  argon2Hash,
  bcryptHash,
  bcryptTruncates,
  describeHash,
  verifyPassword,
} from "./logic";

type Mode = "hash" | "verify";
type Algo = "bcrypt" | "argon2id";

const T = {
  mode: l("Mode", "Mode"),
  hash: l("Hash a password", "Hacher un mot de passe"),
  verify: l("Verify a password", "Vérifier un mot de passe"),
  algo: l("Algorithm", "Algorithme"),
  password: l("Password", "Mot de passe"),
  passwordPh: l("The password to hash", "Le mot de passe à hacher"),
  show: l("Show", "Afficher"),
  notSaved: l(
    "Passwords and hashes here are never saved nor put in share links.",
    "Les mots de passe et hashes saisis ici ne sont jamais enregistrés ni partagés.",
  ),
  cost: l("Cost: {c} (2^{c} = {r} rounds)", "Coût : {c} (2^{c} = {r} tours)"),
  slow: l(
    "Above 12, hashing can take several seconds in a browser.",
    "Au-delà de 12, le calcul peut prendre plusieurs secondes dans un navigateur.",
  ),
  truncated: l(
    "This password is longer than 72 bytes: bcrypt ignores everything after that.",
    "Ce mot de passe dépasse 72 octets : bcrypt ignore tout ce qui suit.",
  ),
  memory: l("Memory (MiB)", "Mémoire (Mio)"),
  iterations: l("Iterations", "Itérations"),
  parallelism: l("Parallelism", "Parallélisme"),
  parallelHint: l(
    "Changes the hash; the browser still computes on one thread.",
    "Change le hash ; le navigateur calcule quand même sur un seul fil.",
  ),
  presets: l("Presets", "Préréglages"),
  owasp: l("OWASP minimum", "Minimum OWASP"),
  rfc: l("RFC 9106 (64 MiB)", "RFC 9106 (64 Mio)"),
  run: l("Hash", "Hacher"),
  running: l("Hashing…", "Calcul…"),
  result: l("Hash", "Hash"),
  took: l("Computed in {t}", "Calculé en {t}"),
  useToVerify: l("Verify against this hash", "Vérifier avec ce hash"),
  hashInput: l("Hash", "Hash"),
  hashPh: l("$2b$10$… or $argon2id$v=19$…", "$2b$10$… ou $argon2id$v=19$…"),
  verifyPh: l("The password to check", "Le mot de passe à vérifier"),
  check: l("Verify", "Vérifier"),
  checking: l("Verifying…", "Vérification…"),
  match: l("The password matches this hash.", "Le mot de passe correspond à ce hash."),
  noMatch: l("The password does not match.", "Le mot de passe ne correspond pas."),
  unknown: l(
    "Not a bcrypt ($2b$…) or Argon2 ($argon2id$…) hash.",
    "Ce n'est pas un hash bcrypt ($2b$…) ni Argon2 ($argon2id$…).",
  ),
  bcryptInfo: l("bcrypt {v}, cost {c}", "bcrypt {v}, coût {c}"),
  argonInfo: l(
    "{v}, version {ver}, {m} memory, {t} iterations, parallelism {p}",
    "{v}, version {ver}, mémoire {m}, {t} itérations, parallélisme {p}",
  ),
};

function fill(s: { en: string; fr: string }, vars: Record<string, string | number>): string {
  let out = tr(s);
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

function kib(n: number): string {
  return n >= 1024 ? `${fmt(n / 1024, { maximumFractionDigits: 1 })} MiB` : `${fmt(n)} KiB`;
}

function PasswordInput({
  label,
  value,
  placeholder,
  show,
  onInput,
}: {
  label: string;
  value: string;
  placeholder: string;
  show: boolean;
  onInput: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        class="input mono"
        type={show ? "text" : "password"}
        autocomplete="off"
        spellcheck={false}
        value={value}
        placeholder={placeholder}
        onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
      />
    </Field>
  );
}

export default function PasswordHash() {
  const secret = { persist: false, share: false };
  const mode = useToolState<Mode>("mode", "hash");
  const algo = useToolState<Algo>("algo", "bcrypt");
  const cost = useToolState("cost", 10);
  const memMiB = useToolState("memory", 19);
  const iterations = useToolState("iterations", ARGON2_DEFAULTS.iterations);
  const parallelism = useToolState("parallelism", ARGON2_DEFAULTS.parallelism);
  const password = useToolState("password", "", secret);
  const checkPassword = useToolState("checkPassword", "", secret);
  const hash = useToolState("hash", "", secret);
  const show = useSignal(false);

  const busy = useSignal(false);
  const result = useSignal<{ hash: string; ms: number } | null>(null);
  const verdict = useSignal<boolean | null>(null);
  const error = useSignal<string | null>(null);
  const seq = useRef(0);

  async function run<T>(job: () => Promise<T>, done: (v: T, ms: number) => void) {
    const id = ++seq.current;
    busy.value = true;
    error.value = null;
    // Let the busy state paint before the WASM call blocks the thread.
    await new Promise((r) => setTimeout(r, 30));
    const t0 = performance.now();
    try {
      const v = await job();
      if (id === seq.current) done(v, performance.now() - t0);
    } catch (err) {
      if (id === seq.current) error.value = errMsg(err);
    } finally {
      if (id === seq.current) busy.value = false;
    }
  }

  const resetOutputs = () => {
    seq.current++;
    busy.value = false;
    result.value = null;
    verdict.value = null;
    error.value = null;
  };

  const info = hash.value.trim() ? describeHash(hash.value) : null;
  const ms = result.value?.ms ?? 0;
  const took =
    ms >= 1000 ? `${fmt(ms / 1000, { maximumFractionDigits: 2 })} s` : `${fmt(Math.round(ms))} ms`;

  return (
    <>
      <div class="row">
        <Segmented<Mode>
          label={tr(T.mode)}
          value={mode.value}
          onChange={(v) => {
            mode.value = v;
            resetOutputs();
          }}
          options={[
            { value: "hash", label: tr(T.hash) },
            { value: "verify", label: tr(T.verify) },
          ]}
        />
        {mode.value === "hash" && (
          <Segmented<Algo>
            label={tr(T.algo)}
            value={algo.value}
            onChange={(v) => {
              algo.value = v;
              resetOutputs();
            }}
            options={[
              { value: "bcrypt", label: "bcrypt" },
              { value: "argon2id", label: "Argon2id" },
            ]}
          />
        )}
        <span class="spacer" />
        <Toggle
          checked={show.value}
          onChange={(v) => {
            show.value = v;
          }}
          label={tr(T.show)}
        />
      </div>

      {mode.value === "hash" ? (
        <form
          class="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const pw = password.value;
            run(
              () =>
                algo.value === "bcrypt"
                  ? bcryptHash(pw, cost.value)
                  : argon2Hash(pw, {
                      memory: memMiB.value * 1024,
                      iterations: iterations.value,
                      parallelism: parallelism.value,
                    }),
              (h, t) => {
                result.value = { hash: h, ms: t };
              },
            );
          }}
        >
          <PasswordInput
            label={tr(T.password)}
            value={password.value}
            placeholder={tr(T.passwordPh)}
            show={show.value}
            onInput={(v) => {
              password.value = v;
              resetOutputs();
            }}
          />
          {algo.value === "bcrypt" ? (
            <>
              <Field
                label={fill(T.cost, { c: cost.value, r: fmt(2 ** cost.value) })}
                {...(cost.value > 12 ? { hint: tr(T.slow) } : {})}
              >
                <input
                  type="range"
                  min={4}
                  max={15}
                  step={1}
                  value={cost.value}
                  onInput={(e) => {
                    cost.value = Number((e.currentTarget as HTMLInputElement).value);
                    resetOutputs();
                  }}
                />
              </Field>
              {bcryptTruncates(password.value) && (
                <p class="password-hash-warn small">{tr(T.truncated)}</p>
              )}
            </>
          ) : (
            <>
              <div class="grid-3">
                <NumberField
                  label={tr(T.memory)}
                  value={memMiB.value}
                  min={1}
                  max={1024}
                  onChange={(v) => {
                    memMiB.value = v;
                    resetOutputs();
                  }}
                />
                <NumberField
                  label={tr(T.iterations)}
                  value={iterations.value}
                  min={1}
                  max={50}
                  onChange={(v) => {
                    iterations.value = v;
                    resetOutputs();
                  }}
                />
                <NumberField
                  label={tr(T.parallelism)}
                  value={parallelism.value}
                  min={1}
                  max={16}
                  hint={tr(T.parallelHint)}
                  onChange={(v) => {
                    parallelism.value = v;
                    resetOutputs();
                  }}
                />
              </div>
              <div class="row">
                <span class="small muted">{tr(T.presets)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    memMiB.value = 19;
                    iterations.value = 2;
                    parallelism.value = 1;
                    resetOutputs();
                  }}
                >
                  {tr(T.owasp)}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    memMiB.value = 64;
                    iterations.value = 3;
                    parallelism.value = 4;
                    resetOutputs();
                  }}
                >
                  {tr(T.rfc)}
                </Button>
              </div>
            </>
          )}
          <div class="row">
            <Button type="submit" variant="primary" disabled={busy.value || !password.value}>
              {busy.value ? tr(T.running) : tr(T.run)}
            </Button>
            <span class="small muted">{tr(T.notSaved)}</span>
          </div>
          <ErrorNote error={error.value} />
          {result.value && (
            <div class="stack">
              <Output label={tr(T.result)} value={result.value.hash} />
              <div class="row">
                <span class="small muted">{fill(T.took, { t: took })}</span>
                <span class="spacer" />
                <Button
                  size="sm"
                  variant="ghost"
                  icon="check"
                  onClick={() => {
                    hash.value = result.value?.hash ?? "";
                    mode.value = "verify";
                    resetOutputs();
                  }}
                >
                  {tr(T.useToVerify)}
                </Button>
              </div>
            </div>
          )}
        </form>
      ) : (
        <form
          class="stack"
          onSubmit={(e) => {
            e.preventDefault();
            const pw = checkPassword.value;
            const h = hash.value;
            run(
              () => verifyPassword(pw, h),
              (ok) => {
                verdict.value = ok;
              },
            );
          }}
        >
          <Field label={tr(T.hashInput)}>
            <input
              class="input mono"
              value={hash.value}
              placeholder={tr(T.hashPh)}
              spellcheck={false}
              autocomplete="off"
              aria-invalid={!!hash.value.trim() && !info}
              onInput={(e) => {
                hash.value = (e.currentTarget as HTMLInputElement).value;
                resetOutputs();
              }}
            />
          </Field>
          <p class={`small ${hash.value.trim() && !info ? "error" : "muted"} password-hash-info`}>
            {!hash.value.trim()
              ? tr(T.notSaved)
              : !info
                ? tr(T.unknown)
                : info.kind === "bcrypt"
                  ? fill(T.bcryptInfo, { v: `$${info.variant}$`, c: info.cost })
                  : fill(T.argonInfo, {
                      v: info.variant,
                      ver: info.version === 19 ? "1.3" : "1.0",
                      m: kib(info.memory),
                      t: info.iterations,
                      p: info.parallelism,
                    })}
          </p>
          <PasswordInput
            label={tr(T.password)}
            value={checkPassword.value}
            placeholder={tr(T.verifyPh)}
            show={show.value}
            onInput={(v) => {
              checkPassword.value = v;
              resetOutputs();
            }}
          />
          <div class="row">
            <Button
              type="submit"
              variant="primary"
              disabled={busy.value || !info || !checkPassword.value}
            >
              {busy.value ? tr(T.checking) : tr(T.check)}
            </Button>
          </div>
          <ErrorNote error={error.value} />
          {verdict.value !== null && (
            <p class={`password-hash-verdict ${verdict.value ? "success" : "error"}`} role="status">
              {verdict.value ? `✓ ${tr(T.match)}` : `✗ ${tr(T.noMatch)}`}
            </p>
          )}
        </form>
      )}
    </>
  );
}
