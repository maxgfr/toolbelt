import { useComputed, useSignal } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { ErrorNote, Field, Output, Segmented, TextBox, Toggle } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import {
  curlHeader,
  curlUser,
  header,
  headerValue,
  type Source,
  token,
  tryDecode,
  warnings,
} from "./logic";

type Mode = "encode" | "decode";

const T = {
  mode: l("Mode", "Mode"),
  encode: l("Generate", "Générer"),
  decode: l("Decode", "Décoder"),
  user: l("Username", "Nom d'utilisateur"),
  password: l("Password", "Mot de passe"),
  show: l("Show", "Afficher"),
  url: l("URL for the curl commands (optional)", "URL des commandes curl (facultative)"),
  secretNote: l(
    "Nothing here is saved nor put in share links.",
    "Rien ici n'est enregistré ni mis dans les liens de partage.",
  ),
  header: l("Header", "En-tête"),
  value: l("Header value", "Valeur de l'en-tête"),
  token: l("Token", "Jeton"),
  curlU: l("curl -u", "curl -u"),
  curlH: l("curl -H", "curl -H"),
  colon: l(
    'A username cannot contain ":" in Basic auth: the server will split at the first one.',
    "Un nom d'utilisateur ne peut pas contenir « : » en Basic auth : le serveur coupera au premier.",
  ),
  control: l(
    "Control characters (line breaks, tabs…) are not allowed in Basic credentials.",
    "Les caractères de contrôle (retours à la ligne, tabulations…) sont interdits en Basic auth.",
  ),
  input: l("Header, token, curl command or URL", "En-tête, jeton, commande curl ou URL"),
  inputPh: l(
    "Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==\nor curl -u user:password https://…",
    "Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==\nou curl -u utilisateur:motdepasse https://…",
  ),
  from: l("Read from", "Lu depuis"),
  srcHeader: l("an Authorization header", "un en-tête Authorization"),
  srcToken: l("a bare Base64 token", "un jeton Base64 seul"),
  srcCurl: l("a curl -u option", "une option curl -u"),
  srcUrl: l("a URL with user:password@", "une URL avec utilisateur:motdepasse@"),
  warn: l(
    "Basic auth is only an encoding, not encryption: anyone who sees the header has the password. Use it over HTTPS only.",
    "Le Basic auth n'est qu'un encodage, pas un chiffrement : qui voit l'en-tête a le mot de passe. Uniquement en HTTPS.",
  ),
};

const SOURCES: Record<Source, keyof typeof T> = {
  header: "srcHeader",
  token: "srcToken",
  curl: "srcCurl",
  url: "srcUrl",
};

const SECRET = { persist: false, share: false } as const;

export default function BasicAuth() {
  const mode = useToolState<Mode>("mode", "encode");
  const user = useToolState("user", "", SECRET);
  const password = useToolState("password", "", SECRET);
  const url = useToolState("url", "", SECRET);
  const input = useToolState("input", "", SECRET);
  const showPw = useSignal(false);

  const creds = useComputed(() => ({ user: user.value, password: password.value }));
  const decoded = useComputed(() => tryDecode(input.value));

  const c = creds.value;
  const has = !!(c.user || c.password);
  const warns = warnings(c);
  const d = decoded.value;

  return (
    <>
      <Segmented<Mode>
        label={tr(T.mode)}
        value={mode.value}
        onChange={(v) => {
          mode.value = v;
        }}
        options={[
          { value: "encode", label: tr(T.encode) },
          { value: "decode", label: tr(T.decode) },
        ]}
      />

      {mode.value === "encode" ? (
        <>
          <div class="grid-2">
            <Field label={tr(T.user)}>
              <input
                class="input mono"
                autocomplete="off"
                spellcheck={false}
                value={user.value}
                onInput={(e) => {
                  user.value = (e.currentTarget as HTMLInputElement).value;
                }}
              />
            </Field>
            <Field label={tr(T.password)}>
              <input
                class="input mono"
                type={showPw.value ? "text" : "password"}
                autocomplete="off"
                spellcheck={false}
                value={password.value}
                onInput={(e) => {
                  password.value = (e.currentTarget as HTMLInputElement).value;
                }}
              />
            </Field>
          </div>
          <div class="row">
            <Toggle
              checked={showPw.value}
              onChange={(v) => {
                showPw.value = v;
              }}
              label={tr(T.show)}
            />
            <span class="muted small">{tr(T.secretNote)}</span>
          </div>
          <Field label={tr(T.url)}>
            <input
              class="input mono"
              type="url"
              spellcheck={false}
              placeholder="https://api.example.com/"
              value={url.value}
              onInput={(e) => {
                url.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
          {warns.map((w) => (
            <p key={w} class="basic-auth-warn small" role="status">
              {tr(T[w])}
            </p>
          ))}
          <div class="stack basic-auth-out">
            <Output label={tr(T.header)} value={has ? header(c) : ""} />
            <Output label={tr(T.value)} value={has ? headerValue(c) : ""} />
            <Output label={tr(T.token)} value={has ? token(c) : ""} />
            <Output label={tr(T.curlU)} value={has ? curlUser(c, url.value.trim()) : ""} />
            <Output label={tr(T.curlH)} value={has ? curlHeader(c, url.value.trim()) : ""} />
          </div>
        </>
      ) : (
        <>
          <TextBox
            label={tr(T.input)}
            value={input.value}
            onInput={(v) => {
              input.value = v;
            }}
            placeholder={tr(T.inputPh)}
            rows={4}
            files={false}
            invalid={d?.ok === false}
          />
          {d && !d.ok && <ErrorNote error={tr(d.error)} />}
          {d?.ok && (
            <div class="stack basic-auth-out">
              <p class="muted small">
                {tr(T.from)} {tr(T[SOURCES[d.value.source]])}
              </p>
              <Output label={tr(T.user)} value={d.value.user} />
              <Output label={tr(T.password)} value={d.value.password} />
            </div>
          )}
        </>
      )}

      <p class="muted small">{tr(T.warn)}</p>
    </>
  );
}
