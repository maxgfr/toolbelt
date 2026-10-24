/**
 * HTTP Basic authentication (RFC 7617): "user:password" in Base64 (UTF-8) behind
 * `Authorization: Basic`, the matching curl forms, and the reverse. Pure: no DOM, no Preact.
 */
import { attempt, fail, fromBase64, fromUtf8, type Result, toBase64, utf8 } from "../_shared";

export interface Credentials {
  user: string;
  password: string;
}

/** The Base64 token: base64(utf8(user ":" password)). */
export function token(c: Credentials): string {
  return toBase64(utf8(`${c.user}:${c.password}`));
}

export function headerValue(c: Credentials): string {
  return `Basic ${token(c)}`;
}

export function header(c: Credentials): string {
  return `Authorization: ${headerValue(c)}`;
}

/** Quotes a word for a POSIX shell: 'it'\''s'. */
export function shellQuote(s: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

export function curlUser(c: Credentials, url: string): string {
  return `curl -u ${shellQuote(`${c.user}:${c.password}`)} ${shellQuote(url || "https://example.com/")}`;
}

export function curlHeader(c: Credentials, url: string): string {
  return `curl -H ${shellQuote(header(c))} ${shellQuote(url || "https://example.com/")}`;
}

/** Problems worth a warning (RFC 7617 forbids ":" in the user id and control characters). */
export function warnings(c: Credentials): ("colon" | "control")[] {
  const out: ("colon" | "control")[] = [];
  if (c.user.includes(":")) out.push("colon");
  // biome-ignore lint/suspicious/noControlCharactersInRegex: that is what is being detected
  if (/[\u0000-\u001f\u007f]/.test(c.user + c.password)) out.push("control");
  return out;
}

export type Source = "header" | "token" | "curl" | "url";

export interface Decoded extends Credentials {
  source: Source;
}

function splitPair(pair: string): Credentials {
  const i = pair.indexOf(":");
  if (i < 0)
    fail(
      'The decoded value has no ":" between user and password.',
      "La valeur décodée n'a pas de « : » entre utilisateur et mot de passe.",
      "Der dekodierte Wert hat kein „:“ zwischen Benutzername und Passwort.",
    );
  return { user: pair.slice(0, i), password: pair.slice(i + 1) };
}

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && (t[0] === "'" || t[0] === '"') && t.at(-1) === t[0]) {
    const inner = t.slice(1, -1);
    return t[0] === '"' ? inner.replace(/\\(["\\$`])/g, "$1") : inner;
  }
  return t.replace(/\\(.)/g, "$1");
}

function decodeToken(t: string): Credentials {
  const bytes = fromBase64(t);
  return splitPair(fromUtf8(bytes, false));
}

/**
 * Reads credentials from any of: `Authorization: Basic …`, `Basic …`, the bare Base64 token,
 * a curl command with `-u` / `--user` (or `-H "Authorization: Basic …"`), or a URL with
 * `user:password@`.
 */
export function decode(input: string): Decoded {
  const text = input.trim();
  if (!text)
    fail(
      "Paste a header, a token or a curl command.",
      "Colle un en-tête, un jeton ou une commande curl.",
      "Füge einen Header, ein Token oder einen curl-Befehl ein.",
    );

  const basic = /(?:^|[\s"'])(?:authorization\s*:\s*)?basic\s+([A-Za-z0-9+/=_-]+)/i.exec(text);
  if (basic?.[1]) return { ...decodeToken(basic[1]), source: "header" };

  if (/^curl\b/.test(text) || /\s(-u|--user)[\s=]/.test(text)) {
    const m = /(?:^|\s)(?:-u|--user)(?:\s+|=)('(?:[^']|'\\'')*'|"(?:[^"\\]|\\.)*"|\S+)/.exec(text);
    if (m?.[1]) {
      const raw = m[1].startsWith("'") ? m[1].slice(1, -1).replace(/'\\''/g, "'") : unquote(m[1]);
      const i = raw.indexOf(":");
      return i < 0
        ? { user: raw, password: "", source: "curl" }
        : { user: raw.slice(0, i), password: raw.slice(i + 1), source: "curl" };
    }
  }

  const url = /\b[a-z][a-z0-9+.-]*:\/\/([^\s/@:]*)(?::([^\s/@]*))?@/i.exec(text);
  if (url) {
    const dec = (s: string) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    };
    return { user: dec(url[1] ?? ""), password: dec(url[2] ?? ""), source: "url" };
  }

  if (/^[A-Za-z0-9+/=_-]+$/.test(text)) return { ...decodeToken(text), source: "token" };

  return fail(
    "No Basic credentials found: paste an Authorization header, a Base64 token, a curl -u command or a URL with user:password@.",
    "Aucun identifiant Basic trouvé : colle un en-tête Authorization, un jeton Base64, une commande curl -u ou une URL avec utilisateur:motdepasse@.",
    "Keine Basic-Zugangsdaten gefunden: Füge einen Authorization-Header, ein Base64-Token, einen curl -u-Befehl oder eine URL mit benutzer:passwort@ ein.",
  );
}

export function tryDecode(input: string): Result<Decoded> | null {
  return input.trim() ? attempt(() => decode(input)) : null;
}
