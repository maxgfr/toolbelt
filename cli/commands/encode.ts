/** Encoding & crypto tools. Each command imports its tool's logic lazily. */
import type { Format as ZipFormat } from "../../src/tools/encode/compress/logic";
import type { Matrix } from "../../src/tools/encode/qr/logic";
import { kv, num, table } from "../format";
import { CliError, type CommandGroup, type Ctx, type Output, UsageError } from "../types";

const shared = () => import("../../src/tools/encode/_shared");

/** Decoded bytes: printed as text when they are UTF-8 text, else written raw (use --out). */
async function textOrBytes(bytes: Uint8Array, json: Record<string, unknown>): Promise<Output> {
  const { isUtf8, toHex } = await shared();
  // Control bytes other than tab / newline / CR / FF mean binary data.
  const binary = bytes.some((b) => b < 0x20 && b !== 9 && b !== 10 && b !== 13 && b !== 12);
  if (isUtf8(bytes) && !binary) {
    const text = new TextDecoder().decode(bytes);
    return { text, json: { ...json, text, size: bytes.length } };
  }
  return { bytes, json: { ...json, text: null, hex: toHex(bytes), size: bytes.length } };
}

/** A time given as Unix seconds or an ISO date, else `ctx.now`. */
function timeOpt(ctx: Ctx, name: string): Date {
  const v = ctx.str(name);
  if (v === undefined) return ctx.now;
  const d = /^-?\d+(\.\d+)?$/.test(v.trim()) ? new Date(Number(v) * 1000) : new Date(v);
  if (Number.isNaN(d.getTime()))
    throw new UsageError(`--${name} expects Unix seconds or an ISO date, got "${v}"`);
  return d;
}

/** Two QR rows per line with half blocks; dark modules are drawn (for light backgrounds). */
function qrText(m: Matrix, margin: number, invert: boolean): string {
  const n = m.length + margin * 2;
  const dark = (r: number, c: number) => {
    const v = m[r - margin]?.[c - margin] ?? false;
    return invert ? !v : v;
  };
  const lines: string[] = [];
  for (let r = 0; r < n; r += 2) {
    let line = "";
    for (let c = 0; c < n; c++) {
      const top = dark(r, c);
      const bottom = r + 1 < n ? dark(r + 1, c) : invert;
      line += top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " ";
    }
    lines.push(line.trimEnd());
  }
  return lines.join("\n");
}

/** CompressionStream without deflate-raw (Node < 20.12): node:zlib does the same. */
function streamSupports(format: ZipFormat): boolean {
  try {
    new CompressionStream(format);
    return true;
  } catch {
    return false;
  }
}

async function zlib(data: Uint8Array, format: ZipFormat, inflate: boolean): Promise<Uint8Array> {
  const z = await import("node:zlib");
  const fn = inflate
    ? { gzip: z.gunzipSync, deflate: z.inflateSync, "deflate-raw": z.inflateRawSync }[format]
    : { gzip: z.gzipSync, deflate: z.deflateSync, "deflate-raw": z.deflateRawSync }[format];
  try {
    return new Uint8Array(fn(data));
  } catch {
    throw new CliError(`This is not valid ${format} data (or it is truncated or corrupted).`);
  }
}

const ALGO_IDS = [
  "md5",
  "sha1",
  "sha256",
  "sha384",
  "sha512",
  "sha3-256",
  "sha3-512",
  "blake3",
  "crc32",
] as const;

export const group: CommandGroup = {
  category: "encode",
  commands: [
    {
      name: "base64",
      tool: "base64",
      aliases: ["b64"],
      summary:
        "Encode text or a file to Base64, or decode Base64 (standard or URL-safe, data: URIs too).",
      usage: "toolbelt base64 [text] [--decode] [--url-safe] [--wrap]",
      options: [
        { name: "decode", alias: "d", type: "boolean", desc: "Decode instead of encode." },
        { name: "url-safe", type: "boolean", desc: "URL-safe alphabet (- _), no padding." },
        { name: "wrap", type: "boolean", desc: "Wrap the output at 76 characters (MIME)." },
      ],
      notes:
        "Encoding reads --file as raw bytes. Decoded text is printed; decoded binary data is written raw (use --out <path>).",
      examples: [
        { cmd: 'toolbelt base64 "hello world"' },
        { cmd: "toolbelt base64 -d aGVsbG8gd29ybGQ=" },
        { cmd: "toolbelt base64 --file logo.png", desc: "Encode a file." },
        { cmd: "toolbelt base64 -d --file logo.b64 --out logo.png", desc: "Decode to a file." },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/base64/logic");
        if (ctx.bool("decode")) {
          const d = m.decode(await ctx.text());
          return textOrBytes(d.bytes, { mime: d.mime });
        }
        const b64 = m.encodeBytes(await ctx.bytes(), {
          urlSafe: ctx.bool("url-safe"),
          wrap: ctx.bool("wrap"),
        });
        return { text: b64, json: { base64: b64 } };
      },
    },
    {
      name: "base-encodings",
      tool: "base-encodings",
      summary: "Text or bytes to and from hex, binary, octal, decimal, Base32, Base58 and Ascii85.",
      usage: "toolbelt base-encodings [text] [--to <enc>] [--from <enc>] [--separator <sep>]",
      options: [
        {
          name: "to",
          type: "string",
          values: ["hex", "binary", "octal", "decimal", "base32", "base58", "ascii85"],
          arg: "<encoding>",
          desc: "Encode into this encoding (without --to or --from: every encoding).",
        },
        {
          name: "from",
          type: "string",
          values: ["hex", "binary", "octal", "decimal", "base32", "base58", "ascii85"],
          arg: "<encoding>",
          desc: "Decode from this encoding.",
        },
        {
          name: "separator",
          type: "string",
          values: ["space", "none", "comma", "newline"],
          desc: "Between bytes, for hex / binary / octal / decimal.",
          default: "space",
        },
        { name: "upper", type: "boolean", desc: "Upper-case hex." },
        {
          name: "padding",
          type: "boolean",
          desc: "Base32 = padding (--no-padding to drop).",
          default: true,
        },
        { name: "delimiters", type: "boolean", desc: "Ascii85 <~ ~> delimiters." },
      ],
      examples: [
        { cmd: 'toolbelt base-encodings "Hi" --to binary' },
        { cmd: 'toolbelt base-encodings "48 69" --from hex' },
        { cmd: 'toolbelt base-encodings "hello"', desc: "Every encoding at once." },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/base-encodings/logic");
        type Enc = (typeof m.ENCODINGS)[number];
        const from = ctx.str("from") as Enc | undefined;
        if (from) return textOrBytes(m.decode(await ctx.text(), from), { encoding: from });
        const o = {
          separator: m.SEPARATORS[ctx.str("separator", "space") as keyof typeof m.SEPARATORS],
          upper: ctx.bool("upper"),
          padding: ctx.bool("padding", true),
          delimiters: ctx.bool("delimiters"),
        };
        const bytes = await ctx.bytes();
        const to = ctx.str("to") as Enc | undefined;
        if (to) {
          const out = m.encode(bytes, to, o);
          return { text: out, json: { encoding: to, result: out } };
        }
        const all = Object.fromEntries(m.ENCODINGS.map((e) => [e, m.encode(bytes, e, o)]));
        return { text: table(m.ENCODINGS.map((e) => [e, all[e] ?? ""])), json: all };
      },
    },
    {
      name: "url-encode",
      tool: "url-encode",
      aliases: ["urlencode"],
      summary: "Percent-encode or decode text as a URL component, a whole URL, or form data.",
      usage: "toolbelt url-encode [text] [--decode] [--mode component|uri|form] [--strict]",
      options: [
        { name: "decode", alias: "d", type: "boolean", desc: "Decode instead of encode." },
        {
          name: "mode",
          alias: "m",
          type: "string",
          values: ["component", "uri", "form"],
          desc: "component (encodeURIComponent), uri (encodeURI) or form (spaces as +).",
          default: "component",
        },
        { name: "strict", type: "boolean", desc: "Also escape ! ' ( ) * (RFC 3986)." },
      ],
      examples: [
        { cmd: 'toolbelt url-encode "a b&c=d/é"' },
        { cmd: "toolbelt url-encode -d 'a%20b%26c'" },
        { cmd: 'toolbelt url-encode "q=hello world" --mode form' },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/url-encode/logic");
        const mode = ctx.str("mode", "component") as "component" | "uri" | "form";
        const text = await ctx.text();
        const out = ctx.bool("decode")
          ? m.decodeUrl(text, mode)
          : m.encodeUrl(text, mode, ctx.bool("strict"));
        return { text: out, json: { result: out, mode } };
      },
    },
    {
      name: "url-parser",
      tool: "url-parser",
      aliases: ["url"],
      summary: "Split a URL into its parts and decoded query parameters; query string <-> JSON.",
      usage: "toolbelt url-parser <url> [--query-json] [--from-json]",
      options: [
        {
          name: "query-json",
          type: "boolean",
          desc: "Print the query string as JSON (repeated keys become arrays, a[b] nests).",
        },
        {
          name: "from-json",
          type: "boolean",
          desc: "The input is a JSON object: print it as a query string.",
        },
      ],
      examples: [
        { cmd: "toolbelt url-parser 'https://user@example.com:8080/a/b?q=1&q=2#top'" },
        { cmd: "toolbelt url-parser '?a=1&b[c]=x' --query-json" },
        { cmd: 'toolbelt url-parser \'{"q":"search","page":2}\' --from-json' },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/url-parser/logic");
        const text = await ctx.text();
        if (ctx.bool("from-json")) {
          const q = m.jsonToQuery(text);
          return { text: q, json: { query: q } };
        }
        if (ctx.bool("query-json")) {
          const obj = m.queryToJson(text);
          return { text: JSON.stringify(obj, null, 2), json: obj };
        }
        const u = m.parseUrl(text);
        const lines = [
          kv([
            ["URL", u.href],
            ["Protocol", u.protocol || undefined],
            ["Username", u.username || undefined],
            ["Password", u.password || undefined],
            ["Host", u.hostname || undefined],
            ["Port", u.port || undefined],
            ["Origin", u.origin || undefined],
            ["Path", u.pathname],
            ["Query", u.search || undefined],
            ["Fragment", u.hash || undefined],
          ]),
        ];
        if (u.assumedScheme) lines.push("(https:// was assumed: the input had no scheme)");
        if (u.params.length) lines.push("", "Parameters:", table(u.params.map(([k, v]) => [k, v])));
        return { text: lines.join("\n"), json: u };
      },
    },
    {
      name: "html-entities",
      tool: "html-entities",
      aliases: ["entities"],
      summary:
        "Escape text as HTML entities (unsafe characters, named or numeric), or decode them.",
      usage: "toolbelt html-entities [text] [--decode] [--mode unsafe|named|numeric] [--hex]",
      options: [
        {
          name: "decode",
          alias: "d",
          type: "boolean",
          desc: "Decode entities instead of encoding.",
        },
        {
          name: "mode",
          alias: "m",
          type: "string",
          values: ["unsafe", "named", "numeric"],
          desc: "unsafe: only & < > \" '; named: also &eacute;…; numeric: &#233;…",
          default: "unsafe",
        },
        { name: "hex", type: "boolean", desc: "Numeric references in hex (&#xE9;)." },
      ],
      examples: [
        { cmd: "toolbelt html-entities '<a href=\"x\">café</a>'" },
        { cmd: "toolbelt html-entities 'café' --mode named" },
        { cmd: "toolbelt html-entities -d '&lt;p&gt; &eacute; &#x1F600;'" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/html-entities/logic");
        const text = await ctx.text();
        if (ctx.bool("decode")) {
          const d = m.decodeEntities(text);
          return { text: d.text, json: d };
        }
        const out = m.encodeEntities(text, {
          mode: ctx.str("mode", "unsafe") as "unsafe" | "named" | "numeric",
          hex: ctx.bool("hex"),
        });
        return { text: out, json: { result: out } };
      },
    },
    {
      name: "jwt",
      tool: "jwt",
      summary: "Decode a JWT: header, payload, time claims and validity; verify an HMAC signature.",
      usage: "toolbelt jwt <token> [--secret <secret>] [--secret-encoding text|base64]",
      options: [
        {
          name: "secret",
          type: "string",
          arg: "<secret>",
          desc: "Verify an HS256/384/512 signature with this secret (exit 1 when invalid).",
        },
        {
          name: "secret-encoding",
          type: "string",
          values: ["text", "base64"],
          desc: "How the secret is written.",
          default: "text",
        },
      ],
      notes:
        "Decoding needs no key: a JWT payload is only Base64URL. The validity is computed against the current time.",
      examples: [
        { cmd: "toolbelt jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig" },
        { cmd: 'toolbelt jwt "$TOKEN" --secret my-secret --json' },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/jwt/logic");
        const jwt = m.decodeJwt(await ctx.text());
        const nowSec = Math.floor(ctx.now.getTime() / 1000);
        const v = m.validity(jwt.payload, nowSec);
        const claims = m.timeClaims(jwt.payload).map((c) => ({
          claim: c.claim,
          seconds: c.seconds,
          date: c.date.toISOString(),
        }));
        const dur = (s: number) => m.humanDuration(s, ctx.lang);
        const status =
          v.state === "none"
            ? "no exp / nbf claim"
            : v.state === "expired"
              ? `expired ${dur(v.since)} ago`
              : v.state === "early"
                ? `not valid yet (in ${dur(v.in)})`
                : v.left === null
                  ? "valid (no expiry)"
                  : `valid, expires in ${dur(v.left)}`;
        let signature: boolean | null = null;
        const secret = ctx.str("secret");
        if (secret !== undefined)
          signature = await m.verifyHmac(
            jwt,
            secret,
            ctx.str("secret-encoding", "text") as "text" | "base64",
          );
        const alg = jwt.alg
          ? `${jwt.alg}${m.algName(jwt.alg) ? ` (${m.algName(jwt.alg)})` : ""}`
          : "none";
        const lines = [
          kv([
            ["Algorithm", alg],
            ["Validity", status],
            ["Signature", signature === null ? undefined : signature ? "valid" : "INVALID"],
          ]),
          "",
          "Header:",
          JSON.stringify(jwt.header, null, 2),
          "",
          "Payload:",
          jwt.payload === null ? jwt.payloadText : JSON.stringify(jwt.payload, null, 2),
        ];
        if (claims.length)
          lines.push("", "Time claims:", table(claims.map((c) => [c.claim, c.date, c.seconds])));
        return {
          text: lines.join("\n"),
          json: {
            header: jwt.header,
            payload: jwt.payload ?? jwt.payloadText,
            alg: jwt.alg,
            signature: jwt.signature,
            validity: v,
            timeClaims: claims,
            signatureValid: signature,
          },
          code: signature === false ? 1 : 0,
        };
      },
    },
    {
      name: "hash",
      tool: "hash",
      summary:
        "Checksums of a text or file: MD5, SHA-1/256/384/512, SHA3, BLAKE3, CRC32; check one.",
      usage: "toolbelt hash [text] [--algo <algo>] [--check <expected>] [--format hex|base64]",
      options: [
        {
          name: "algo",
          alias: "a",
          type: "string",
          values: ALGO_IDS,
          arg: "<algo>",
          desc: `One algorithm (${ALGO_IDS.join(", ")}); every one by default.`,
        },
        {
          name: "check",
          alias: "c",
          type: "string",
          arg: "<checksum>",
          desc: "Compare with an expected checksum (hex, Base64, sha256sum line); exit 1 on mismatch.",
        },
        {
          name: "format",
          type: "string",
          values: ["hex", "base64"],
          desc: "Digest format.",
          default: "hex",
        },
        { name: "upper", type: "boolean", desc: "Upper-case hex." },
      ],
      notes:
        "Text is hashed as UTF-8, exactly as given (stdin keeps its trailing newline). --file hashes the raw bytes.",
      examples: [
        { cmd: 'toolbelt hash "abc"' },
        { cmd: "toolbelt hash --file release.zip --algo sha256" },
        {
          cmd: "toolbelt hash --file release.zip --check 9f86d081884c7d65…",
          desc: "Which algorithm matches.",
        },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/hash/logic");
        const digests = await m.hashAll(await ctx.bytes());
        const format = ctx.str("format", "hex") as "hex" | "base64";
        const fmt = (id: (typeof ALGO_IDS)[number]) =>
          m.formatDigest(digests[id], format, ctx.bool("upper"));
        const expected = ctx.str("check");
        if (expected !== undefined) {
          const match = m.findMatch(expected, digests);
          const algo = ctx.str("algo");
          const ok = match !== null && (!algo || match === algo);
          const label = m.ALGOS.find((a) => a.id === match)?.label;
          return {
            text: ok ? `OK: matches ${label}` : "MISMATCH: no algorithm gives this checksum",
            json: { match: ok, algorithm: match },
            code: ok ? 0 : 1,
          };
        }
        const algo = ctx.str("algo") as (typeof ALGO_IDS)[number] | undefined;
        if (algo) return { text: fmt(algo), json: { algorithm: algo, digest: fmt(algo) } };
        const all = Object.fromEntries(m.ALGOS.map((a) => [a.id, fmt(a.id)]));
        return {
          text: table(m.ALGOS.map((a) => [a.label, fmt(a.id)])),
          json: all,
        };
      },
    },
    {
      name: "hmac",
      tool: "hmac",
      summary:
        "HMAC-SHA1/256/384/512 of a message with a key (text, hex or Base64); check a signature.",
      usage: "toolbelt hmac [message] --key <key> [--algo sha256] [--format hex|base64|base64url]",
      options: [
        {
          name: "key",
          alias: "k",
          type: "string",
          arg: "<key>",
          desc: "The secret key (required).",
        },
        {
          name: "algo",
          alias: "a",
          type: "string",
          values: ["sha1", "sha256", "sha384", "sha512"],
          desc: "Hash function.",
          default: "sha256",
        },
        {
          name: "key-encoding",
          type: "string",
          values: ["text", "hex", "base64"],
          desc: "How the key is written.",
          default: "text",
        },
        {
          name: "message-encoding",
          type: "string",
          values: ["text", "hex", "base64"],
          desc: "How the message is written.",
          default: "text",
        },
        {
          name: "format",
          type: "string",
          values: ["hex", "base64", "base64url"],
          desc: "Output format.",
          default: "hex",
        },
        { name: "upper", type: "boolean", desc: "Upper-case hex." },
        {
          name: "check",
          alias: "c",
          type: "string",
          arg: "<signature>",
          desc: "Compare with an expected signature (hex/Base64, sha256= prefix ok); exit 1 on mismatch.",
        },
      ],
      examples: [
        { cmd: 'toolbelt hmac "hello" --key secret' },
        { cmd: "toolbelt hmac --file body.json --key \"$WEBHOOK_SECRET\" --check 'sha256=…'" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/hmac/logic");
        const key = ctx.str("key");
        if (key === undefined) throw new UsageError("--key <key> is required");
        type Enc = "text" | "hex" | "base64";
        const msgEnc = ctx.str("message-encoding", "text") as Enc;
        const message =
          msgEnc === "text" ? await ctx.bytes() : m.parseInput((await ctx.text()).trim(), msgEnc);
        const algo = `SHA-${ctx.str("algo", "sha256").slice(3)}` as (typeof m.HMAC_ALGOS)[number];
        const mac = await m.hmac(
          algo,
          m.parseInput(key, ctx.str("key-encoding", "text") as Enc),
          message,
        );
        const out = m.formatMac(
          mac,
          ctx.str("format", "hex") as "hex" | "base64" | "base64url",
          ctx.bool("upper"),
        );
        const expected = ctx.str("check");
        if (expected !== undefined) {
          const ok = m.sameMac(expected, mac);
          return {
            text: ok ? "OK: the signature matches" : `MISMATCH: expected ${out}`,
            json: { match: ok, hmac: out },
            code: ok ? 0 : 1,
          };
        }
        return { text: out, json: { algorithm: algo, hmac: out } };
      },
    },
    {
      name: "password-hash",
      tool: "password-hash",
      aliases: ["bcrypt", "argon2"],
      summary:
        "Hash a password with bcrypt or Argon2id, verify a password against a hash, or read a hash's parameters.",
      usage:
        "toolbelt password-hash <password> [--algo bcrypt|argon2id] [--verify <hash>] [--inspect]",
      options: [
        {
          name: "algo",
          alias: "a",
          type: "string",
          values: ["bcrypt", "argon2id"],
          desc: "Algorithm.",
          default: "bcrypt",
        },
        { name: "cost", type: "number", desc: "bcrypt cost (4–31).", default: 10 },
        { name: "memory", type: "number", desc: "Argon2 memory in MiB.", default: 19 },
        { name: "iterations", type: "number", desc: "Argon2 iterations.", default: 2 },
        { name: "parallelism", type: "number", desc: "Argon2 lanes.", default: 1 },
        {
          name: "verify",
          type: "string",
          arg: "<hash>",
          desc: "Check the password against this bcrypt/Argon2 hash (exit 1 when it does not match).",
        },
        {
          name: "inspect",
          type: "boolean",
          desc: "The input is a hash: print its algorithm and parameters.",
        },
      ],
      examples: [
        { cmd: 'toolbelt password-hash "correct horse" --cost 12' },
        { cmd: "toolbelt password-hash 'correct horse' --verify '$2b$12$…'" },
        { cmd: "toolbelt password-hash '$argon2id$v=19$m=19456,t=2,p=1$…' --inspect" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/password-hash/logic");
        const input = await ctx.text();
        if (ctx.bool("inspect")) {
          const info = m.describeHash(input);
          if (!info) throw new CliError("Not a bcrypt ($2b$…) or Argon2 ($argon2id$…) hash.");
          const text =
            info.kind === "bcrypt"
              ? kv([
                  ["Algorithm", `bcrypt (${info.variant})`],
                  ["Cost", info.cost],
                ])
              : kv([
                  ["Algorithm", info.variant],
                  ["Version", info.version],
                  ["Memory", `${info.memory} KiB`],
                  ["Iterations", info.iterations],
                  ["Parallelism", info.parallelism],
                ]);
          return { text, json: info };
        }
        const hash = ctx.str("verify");
        if (hash !== undefined) {
          const ok = await m.verifyPassword(input, hash);
          return {
            text: ok ? "OK: the password matches" : "MISMATCH: wrong password",
            json: { match: ok },
            code: ok ? 0 : 1,
          };
        }
        const out =
          ctx.str("algo", "bcrypt") === "argon2id"
            ? await m.argon2Hash(input, {
                memory: Math.round(ctx.num("memory", 19) * 1024),
                iterations: ctx.num("iterations", 2),
                parallelism: ctx.num("parallelism", 1),
              })
            : await m.bcryptHash(input, ctx.num("cost", 10));
        return {
          text: out,
          json: { hash: out, truncated: m.bcryptTruncates(input) && !out.startsWith("$argon2") },
        };
      },
    },
    {
      name: "uuid",
      tool: "uuid",
      aliases: ["ulid", "nanoid"],
      summary: "Generate UUID v4 / v7, ULID or nanoid; or inspect a UUID / ULID (version, time).",
      usage: "toolbelt uuid [id-to-inspect] [--kind v4|v7|ulid|nanoid] [--count <n>]",
      options: [
        {
          name: "kind",
          alias: "k",
          type: "string",
          values: ["v4", "v7", "ulid", "nanoid"],
          desc: "What to generate.",
          default: "v4",
        },
        { name: "count", alias: "n", type: "number", desc: "How many (1–1000).", default: 1 },
        { name: "upper", type: "boolean", desc: "Upper case." },
        {
          name: "dashes",
          type: "boolean",
          desc: "UUID dashes (--no-dashes to drop).",
          default: true,
        },
        { name: "size", type: "number", desc: "nanoid length.", default: 21 },
        {
          name: "alphabet",
          type: "string",
          arg: "<name|chars>",
          desc: "nanoid alphabet: url, alnum, lower, hex, digits, nolookalikes, or your own characters.",
          default: "url",
        },
      ],
      notes:
        "With an argument, inspects it instead: version, variant, embedded timestamp, the ULID/UUID form.",
      examples: [
        { cmd: "toolbelt uuid" },
        { cmd: "toolbelt uuid --kind v7 -n 5" },
        { cmd: "toolbelt uuid --kind nanoid --size 12 --alphabet alnum" },
        { cmd: "toolbelt uuid 0190b3a2-7c4e-7d3a-9f1e-123456789abc", desc: "Inspect an id." },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/uuid/logic");
        const input = ctx.args.length
          ? ctx.args.join(" ")
          : typeof ctx.opts.file === "string"
            ? await ctx.text()
            : "";
        if (input.trim()) {
          const info = m.inspectId(input);
          if (!info) throw new CliError("Nothing to inspect.");
          return {
            text: kv([
              ["Kind", info.kind === "uuid" ? "UUID" : "ULID"],
              ["Canonical", info.canonical],
              ["Hex", info.hex],
              [info.kind === "uuid" ? "As ULID" : "As UUID", info.other],
              ["Version", info.version],
              ["Variant", info.variant],
              ["Special", info.special],
              [
                "Timestamp",
                info.timestamp === undefined ? undefined : new Date(info.timestamp).toISOString(),
              ],
              ["Node", info.node],
              ["Clock sequence", info.clockSeq],
            ]),
            json: info,
          };
        }
        const kind = ctx.str("kind", "v4") as "v4" | "v7" | "ulid" | "nanoid";
        const alpha = ctx.str("alphabet", "url");
        const alphabet = m.NANOID_ALPHABETS[alpha as keyof typeof m.NANOID_ALPHABETS] ?? alpha;
        if (kind === "nanoid") m.checkAlphabet(alphabet);
        const count = ctx.num("count", 1);
        if (!Number.isInteger(count) || count < 1 || count > 1000)
          throw new UsageError("--count must be between 1 and 1000");
        const ids = m.generateIds(
          kind,
          count,
          {
            uppercase: ctx.bool("upper"),
            dashes: ctx.bool("dashes", true),
            size: ctx.num("size", 21),
            alphabet,
          },
          ctx.now.getTime(),
        );
        return { text: ids.join("\n"), json: ids };
      },
    },
    {
      name: "password",
      tool: "password",
      aliases: ["passphrase"],
      summary:
        "Generate secure passwords or passphrases (with their entropy), or rate a password's strength.",
      usage: "toolbelt password [--length <n>] [--passphrase] [--count <n>] [--check <password>]",
      options: [
        {
          name: "length",
          alias: "l",
          type: "number",
          desc: "Password length (4–128).",
          default: 20,
        },
        { name: "count", alias: "n", type: "number", desc: "How many.", default: 1 },
        {
          name: "lower",
          type: "boolean",
          desc: "Lowercase letters (--no-lower to drop).",
          default: true,
        },
        {
          name: "upper",
          type: "boolean",
          desc: "Uppercase letters (--no-upper to drop).",
          default: true,
        },
        { name: "digits", type: "boolean", desc: "Digits (--no-digits to drop).", default: true },
        {
          name: "symbols",
          type: "boolean",
          desc: "Symbols (--no-symbols to drop).",
          default: true,
        },
        { name: "exclude-ambiguous", type: "boolean", desc: "Leave out I l 1 | O 0 o and quotes." },
        {
          name: "each-class",
          type: "boolean",
          desc: "At least one character of each kind (--no-each-class to drop).",
          default: true,
        },
        {
          name: "passphrase",
          alias: "p",
          type: "boolean",
          desc: "A passphrase of random words instead.",
        },
        { name: "words", alias: "w", type: "number", desc: "Passphrase words (3–20).", default: 5 },
        { name: "separator", type: "string", desc: "Between passphrase words.", default: "-" },
        { name: "capitalize", type: "boolean", desc: "Capitalize passphrase words." },
        { name: "digit", type: "boolean", desc: "Add a digit to one passphrase word." },
        {
          name: "check",
          alias: "c",
          type: "string",
          arg: "<password>",
          desc: "Estimate this password's strength instead (bits, score 0–4, time to crack).",
        },
      ],
      examples: [
        { cmd: "toolbelt password" },
        { cmd: "toolbelt password --length 32 --no-symbols -n 3" },
        { cmd: "toolbelt password --passphrase --words 6 --capitalize" },
        { cmd: "toolbelt password --check 'P@ssw0rd'" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/password/logic");
        const typed = ctx.str("check");
        if (typed !== undefined) {
          if (!typed) throw new UsageError("--check needs a password");
          const s = m.estimateStrength(typed);
          const t = m.timeUnit(m.crackSeconds(s.bits));
          const names = ["very weak", "weak", "fair", "strong", "very strong"];
          const crack =
            t.unit === "instant" ? "instant" : t.unit === "ages" ? "ages" : `${t.value} ${t.unit}`;
          return {
            text: kv([
              ["Strength", `${names[s.score]} (${s.score}/4)`],
              ["Entropy", `${num(s.bits, 1)} bits`],
              ["Time to crack", `${crack} (offline, 10^10 guesses/s)`],
              ["Warnings", s.warnings.join(", ") || undefined],
            ]),
            json: { ...s, crackTime: t },
          };
        }
        const count = ctx.num("count", 1);
        if (!Number.isInteger(count) || count < 1 || count > 1000)
          throw new UsageError("--count must be between 1 and 1000");
        let list: string[];
        let bits: number;
        if (ctx.bool("passphrase")) {
          const words = ctx.num("words", 5);
          if (words < m.MIN_WORDS || words > m.MAX_WORDS)
            throw new CliError(`--words must be between ${m.MIN_WORDS} and ${m.MAX_WORDS}.`);
          const o = {
            words,
            separator: ctx.str("separator", "-"),
            capitalize: ctx.bool("capitalize"),
            digit: ctx.bool("digit"),
          };
          list = Array.from({ length: count }, () => m.generatePassphrase(o));
          bits = m.passphraseEntropy(o);
        } else {
          const o = {
            length: ctx.num("length", 20),
            lower: ctx.bool("lower", true),
            upper: ctx.bool("upper", true),
            digits: ctx.bool("digits", true),
            symbols: ctx.bool("symbols", true),
            excludeAmbiguous: ctx.bool("exclude-ambiguous"),
            eachClass: ctx.bool("each-class", true),
          };
          list = Array.from({ length: count }, () => m.generatePassword(o));
          bits = m.passwordEntropy(o);
        }
        return {
          text: list.join("\n"),
          json: { passwords: list, entropyBits: Number(num(bits, 2)) },
        };
      },
    },
    {
      name: "totp",
      tool: "totp",
      aliases: ["2fa", "otp"],
      summary:
        "The current TOTP (2FA) code of a Base32 secret or otpauth:// link; or a new secret.",
      usage:
        "toolbelt totp <secret|otpauth-uri> [--digits 6] [--period 30] [--algorithm SHA1] [--at <time>]",
      options: [
        {
          name: "algorithm",
          type: "string",
          values: ["SHA1", "SHA256", "SHA512"],
          desc: "HMAC algorithm (an otpauth link's own parameters win).",
          default: "SHA1",
        },
        { name: "digits", type: "number", desc: "Code length (6–10).", default: 6 },
        { name: "period", type: "number", desc: "Seconds per code.", default: 30 },
        {
          name: "at",
          type: "string",
          arg: "<time>",
          desc: "Unix seconds or ISO date (default: now).",
        },
        {
          name: "generate",
          alias: "g",
          type: "boolean",
          desc: "Create a new random secret and its otpauth link.",
        },
        { name: "issuer", type: "string", desc: "Issuer for --generate." },
        { name: "account", type: "string", desc: "Account name for --generate." },
      ],
      examples: [
        { cmd: "toolbelt totp JBSWY3DPEHPK3PXP" },
        { cmd: "toolbelt totp 'otpauth://totp/ACME:me@x.com?secret=JBSWY3DPEHPK3PXP&issuer=ACME'" },
        { cmd: "toolbelt totp --generate --issuer ACME --account me@example.com" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/totp/logic");
        const params = {
          algorithm: ctx.str("algorithm", "SHA1") as "SHA1" | "SHA256" | "SHA512",
          digits: ctx.num("digits", 6),
          period: ctx.num("period", 30),
        };
        if (ctx.bool("generate")) {
          const secret = m.generateSecret();
          const link = m.buildOtpauth({
            ...params,
            secret,
            issuer: ctx.str("issuer", ""),
            account: ctx.str("account", "user"),
          });
          return {
            text: kv([
              ["Secret", secret],
              ["Link", link],
            ]),
            json: { secret, link },
          };
        }
        const src = m.readSource(await ctx.text(), params);
        if (!src) throw new UsageError("missing secret: a Base32 secret or an otpauth:// link");
        const t = timeOpt(ctx, "at").getTime() / 1000;
        const code = await m.totp(src.key, t, src.params);
        const next = await m.totp(src.key, t + src.params.period, src.params);
        const left = m.secondsLeft(t, src.params.period);
        return {
          text: kv([
            ["Code", code],
            ["Valid for", `${left} s`],
            ["Next", next],
          ]),
          json: {
            code,
            secondsLeft: left,
            next,
            ...src.params,
            issuer: src.link?.issuer,
            account: src.link?.account,
          },
        };
      },
    },
    {
      name: "keypair",
      tool: "keypair",
      summary:
        "Generate a key pair (ECDSA, Ed25519, RSA-OAEP, RSA-PSS) as PEM or JWK, with its fingerprint.",
      usage:
        "toolbelt keypair [--algo ecdsa|ed25519|rsa-oaep|rsa-pss] [--curve P-256] [--bits 3072] [--format pem|jwk]",
      options: [
        {
          name: "algo",
          alias: "a",
          type: "string",
          values: ["ecdsa", "ed25519", "rsa-oaep", "rsa-pss"],
          desc: "Key type.",
          default: "ecdsa",
        },
        {
          name: "curve",
          type: "string",
          values: ["P-256", "P-384", "P-521"],
          desc: "ECDSA curve.",
          default: "P-256",
        },
        {
          name: "bits",
          type: "string",
          values: ["2048", "3072", "4096"],
          desc: "RSA modulus size.",
          default: "3072",
        },
        {
          name: "format",
          type: "string",
          values: ["pem", "jwk"],
          desc: "Output format.",
          default: "pem",
        },
      ],
      notes: "The private key is printed: write it to a file with --out and keep it secret.",
      examples: [
        { cmd: "toolbelt keypair" },
        { cmd: "toolbelt keypair --algo ed25519 --out key.pem" },
        { cmd: "toolbelt keypair --algo rsa-pss --bits 4096 --format jwk" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/keypair/logic");
        const algos = {
          ecdsa: "ECDSA",
          ed25519: "Ed25519",
          "rsa-oaep": "RSA-OAEP",
          "rsa-pss": "RSA-PSS",
        } as const;
        const spec = {
          algo: algos[ctx.str("algo", "ecdsa") as keyof typeof algos],
          curve: ctx.str("curve", "P-256") as "P-256" | "P-384" | "P-521",
          bits: ctx.str("bits", "3072") as "2048" | "3072" | "4096",
        };
        const k = await m.generateKeyPair(spec);
        const jwk = ctx.str("format", "pem") === "jwk";
        const text = jwk
          ? `${k.privateJwk}\n${k.publicJwk}`
          : `${k.privatePem}${k.publicPem}# ${k.label}, SHA-256 fingerprint ${k.fingerprint}`;
        return {
          text,
          json: {
            algorithm: k.label,
            privateKey: jwk ? JSON.parse(k.privateJwk) : k.privatePem,
            publicKey: jwk ? JSON.parse(k.publicJwk) : k.publicPem,
            fingerprint: k.fingerprint,
            fingerprintBase64: k.fingerprintB64,
          },
        };
      },
    },
    {
      name: "qr",
      tool: "qr",
      aliases: ["qrcode"],
      summary:
        "Make a QR code (text, URL or Wi-Fi) as terminal text or SVG. Reading QR images is browser-only.",
      usage:
        "toolbelt qr [text] [--format text|svg] [--ecc L|M|Q|H] [--wifi-ssid <name> --wifi-password <pw>]",
      options: [
        {
          name: "format",
          type: "string",
          values: ["text", "svg"],
          desc: "Output.",
          default: "text",
        },
        {
          name: "ecc",
          type: "string",
          values: ["L", "M", "Q", "H"],
          desc: "Error correction level.",
          default: "M",
        },
        { name: "margin", type: "number", desc: "Quiet zone, in modules.", default: 4 },
        { name: "size", type: "number", desc: "SVG width and height in pixels.", default: 512 },
        { name: "fg", type: "string", desc: "SVG dark color.", default: "#000000" },
        {
          name: "bg",
          type: "string",
          desc: "SVG background (empty for transparent).",
          default: "#ffffff",
        },
        {
          name: "invert",
          type: "boolean",
          desc: "Text output for a dark terminal (light modules drawn).",
        },
        {
          name: "wifi-ssid",
          type: "string",
          desc: "Make a Wi-Fi QR code for this network instead of text.",
        },
        { name: "wifi-password", type: "string", desc: "Wi-Fi password." },
        {
          name: "wifi-security",
          type: "string",
          values: ["WPA", "WEP", "nopass"],
          desc: "Wi-Fi security.",
          default: "WPA",
        },
        { name: "wifi-hidden", type: "boolean", desc: "Hidden network." },
      ],
      notes:
        "Scanning a QR code from an image or the camera needs the browser: https://maxgfr.github.io/toolbelt/#/qr",
      examples: [
        { cmd: "toolbelt qr https://example.com" },
        { cmd: "toolbelt qr https://example.com --format svg --out qr.svg" },
        {
          cmd: "toolbelt qr --wifi-ssid Home --wifi-password 's3cret' --format svg --out wifi.svg",
        },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/qr/logic");
        const ssid = ctx.str("wifi-ssid");
        const payload =
          ssid !== undefined
            ? m.wifiPayload({
                ssid,
                password: ctx.str("wifi-password", ""),
                security: ctx.str("wifi-security", "WPA") as "WPA" | "WEP" | "nopass",
                hidden: ctx.bool("wifi-hidden"),
              })
            : await ctx.text();
        const matrix = m.qrMatrix(payload, ctx.str("ecc", "M") as "L" | "M" | "Q" | "H");
        const margin = Math.max(0, Math.floor(ctx.num("margin", 4)));
        const info = { payload, version: m.qrVersion(matrix), modules: matrix.length };
        if (ctx.str("format", "text") === "svg") {
          const svg = m.qrSvg(matrix, {
            fg: ctx.str("fg", "#000000"),
            bg: ctx.str("bg", "#ffffff"),
            margin,
            size: ctx.num("size", 512),
          });
          return { text: svg, json: { ...info, svg } };
        }
        const text = qrText(matrix, margin, ctx.bool("invert"));
        return { text, json: { ...info, text } };
      },
    },
    {
      name: "data-uri",
      tool: "data-uri",
      summary: "Turn text or a file into a data: URI (Base64 or percent), or decode a data: URI.",
      usage: "toolbelt data-uri [text] [--mime <type>] [--encoding base64|percent] [--decode]",
      options: [
        {
          name: "decode",
          alias: "d",
          type: "boolean",
          desc: "Decode a data: URI (text printed, binary written raw).",
        },
        {
          name: "mime",
          type: "string",
          arg: "<type>",
          desc: "MIME type (default: from the --file name, else text/plain).",
        },
        {
          name: "encoding",
          type: "string",
          values: ["base64", "percent"],
          desc: "Body encoding.",
          default: "base64",
        },
      ],
      examples: [
        {
          cmd: "toolbelt data-uri \"<svg xmlns='http://www.w3.org/2000/svg'/>\" --mime image/svg+xml --encoding percent",
        },
        { cmd: "toolbelt data-uri --file icon.png" },
        { cmd: "toolbelt data-uri -d 'data:text/plain;base64,aGk='" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/data-uri/logic");
        if (ctx.bool("decode")) {
          const d = m.parseDataUri(await ctx.text());
          return textOrBytes(d.bytes, { mime: d.mime, charset: d.charset, base64: d.base64 });
        }
        const file = typeof ctx.opts.file === "string" && !ctx.args.length ? ctx.opts.file : null;
        const mime = ctx.str("mime") ?? (file ? m.mimeFromName(file) : "text/plain");
        const uri = m.buildDataUri(
          await ctx.bytes(),
          mime,
          ctx.str("encoding", "base64") as "base64" | "percent",
        );
        return { text: uri, json: { uri, mime } };
      },
    },
    {
      name: "encrypt",
      tool: "encrypt",
      summary:
        "Encrypt or decrypt text or a file with a password (AES-256-GCM, PBKDF2 or Argon2id), site-compatible.",
      usage: "toolbelt encrypt [text] --password <pw> [--decrypt] [--kdf pbkdf2|argon2id]",
      options: [
        {
          name: "password",
          alias: "p",
          type: "string",
          arg: "<password>",
          desc: "The password (or set TOOLBELT_PASSWORD, which keeps it out of the shell history).",
        },
        { name: "decrypt", alias: "d", type: "boolean", desc: "Decrypt instead of encrypt." },
        {
          name: "kdf",
          type: "string",
          values: ["pbkdf2", "argon2id"],
          desc: "Key derivation.",
          default: "pbkdf2",
        },
        { name: "iterations", type: "number", desc: "PBKDF2 iterations.", default: 600000 },
        { name: "wrap", type: "boolean", desc: "Wrap the Base64 output at 76 characters." },
      ],
      notes:
        "The output is the site's container as Base64 (starts with VEJFTg): the browser tool decrypts it and vice versa. " +
        "With --file, the file is encrypted with its name; decrypting a file writes its bytes (use --out).",
      examples: [
        { cmd: 'toolbelt encrypt "meet at noon" --password hunter2' },
        { cmd: "TOOLBELT_PASSWORD=hunter2 toolbelt encrypt -d VEJFTgEB…" },
        { cmd: "toolbelt encrypt --file report.pdf -p hunter2 --out report.pdf.enc" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/encrypt/logic");
        const password = ctx.str("password") ?? ctx.env.TOOLBELT_PASSWORD;
        if (!password) throw new UsageError("--password <pw> (or TOOLBELT_PASSWORD) is required");
        if (ctx.bool("decrypt")) {
          const { payload, header } = await m.decrypt(m.dearmor(await ctx.text()), password);
          const kdf = m.kdfLabel(header.kdf, String, ctx.lang);
          if (payload.kind === "text")
            return { text: payload.text, json: { kind: "text", text: payload.text, kdf } };
          return {
            bytes: payload.data,
            json: { kind: "file", name: payload.name, size: payload.data.length, kdf },
          };
        }
        const kdf =
          ctx.str("kdf", "pbkdf2") === "argon2id"
            ? m.ARGON2_DEFAULT
            : { kind: "pbkdf2" as const, iterations: ctx.num("iterations", 600000) };
        const file = typeof ctx.opts.file === "string" && !ctx.args.length ? ctx.opts.file : null;
        const payload = file
          ? { kind: "file" as const, name: file.replace(/^.*[\\/]/, ""), data: await ctx.bytes() }
          : { kind: "text" as const, text: await ctx.text() };
        const out = m.armor(await m.encrypt(payload, password, kdf), ctx.bool("wrap"));
        return { text: out, json: { encrypted: out, kdf: m.kdfLabel(kdf, String, ctx.lang) } };
      },
    },
    {
      name: "compress",
      tool: "compress",
      aliases: ["gzip"],
      summary:
        "Compress text or a file with gzip, zlib (deflate) or raw deflate, or decompress (format detected).",
      usage:
        "toolbelt compress [text] [--format gzip|deflate|deflate-raw] [--decompress] [--encoding base64|hex|raw]",
      options: [
        { name: "decompress", alias: "d", type: "boolean", desc: "Decompress instead." },
        {
          name: "format",
          type: "string",
          values: ["gzip", "deflate", "deflate-raw", "auto"],
          desc: "Format (auto: detected, when decompressing).",
          default: "gzip / auto",
        },
        {
          name: "encoding",
          type: "string",
          values: ["base64", "hex", "raw"],
          desc: "Compressed output as Base64, hex or raw bytes (use --out).",
          default: "base64",
        },
      ],
      notes:
        "Decompressing reads an argument or stdin as Base64/hex text, and --file as raw compressed bytes. Binary results are written raw (use --out).",
      examples: [
        { cmd: 'toolbelt compress "hello hello hello"' },
        { cmd: "toolbelt compress --file data.json --encoding raw --out data.json.gz" },
        { cmd: "toolbelt compress -d --file data.json.gz" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/compress/logic");
        const fmt = ctx.str("format");
        if (ctx.bool("decompress")) {
          const fromFile = typeof ctx.opts.file === "string" && !ctx.args.length;
          const data = fromFile ? await ctx.bytes() : m.textToBytes(await ctx.text(), "auto");
          const format = !fmt || fmt === "auto" ? m.detectFormat(data) : (fmt as ZipFormat);
          let bytes: Uint8Array;
          let used = format;
          if (!streamSupports(format)) bytes = await zlib(data, format, true);
          else if (!fmt || fmt === "auto") ({ format: used, bytes } = await m.decompressAuto(data));
          else bytes = await m.decompress(data, format);
          return textOrBytes(bytes, { format: used, inSize: data.length, outSize: bytes.length });
        }
        if (fmt === "auto") throw new UsageError("--format auto is only for --decompress");
        const format = (fmt ?? "gzip") as ZipFormat;
        const input = await ctx.bytes();
        const out = streamSupports(format)
          ? await m.compress(input, format)
          : await zlib(input, format, false);
        const enc = ctx.str("encoding", "base64");
        const info = {
          format,
          inSize: input.length,
          outSize: out.length,
          ratio: m.ratio(input.length, out.length),
        };
        if (enc === "raw") return { bytes: out, json: info };
        const text = m.bytesToText(out, enc as "base64" | "hex");
        return { text, json: { ...info, data: text } };
      },
    },
    {
      name: "certificate",
      tool: "certificate",
      aliases: ["cert", "x509"],
      summary:
        "Decode X.509 certificates and CSRs (PEM chain or DER): subject, issuer, validity, SAN, key, fingerprints.",
      usage: "toolbelt certificate [pem] [--file cert.pem]",
      examples: [
        { cmd: "toolbelt certificate --file cert.pem" },
        {
          cmd: "openssl s_client -connect example.com:443 -showcerts </dev/null | toolbelt certificate --json",
        },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/certificate/logic");
        const entries = m.parseFile(await ctx.bytes());
        const ok = entries.flatMap((e) => (e.result.ok ? [e.result.value] : []));
        const failed = entries.filter((e) => !e.result.ok);
        if (!ok.length) {
          const first = failed[0]?.result;
          throw first && !first.ok
            ? new CliError(first.error)
            : new CliError("No certificate found.");
        }
        const blocks: string[] = [];
        const json: unknown[] = [];
        for (const d of ok) {
          const fp = await m.fingerprints(d.der);
          const v = d.notBefore && d.notAfter ? m.validity(d.notBefore, d.notAfter, ctx.now) : null;
          const status = !v
            ? undefined
            : v.state === "valid"
              ? `valid, ${v.daysLeft} days left`
              : v.state === "expired"
                ? `EXPIRED ${v.daysAgo} days ago`
                : `not valid yet (in ${v.daysUntil} days)`;
          blocks.push(
            kv([
              [
                "Type",
                d.kind === "csr" ? "Certificate request (CSR)" : `Certificate v${d.version}`,
              ],
              ["Subject", m.formatName(d.subject)],
              [
                "Issuer",
                d.issuer
                  ? `${m.formatName(d.issuer)}${d.selfSigned ? " (self-signed)" : ""}`
                  : undefined,
              ],
              ["Not before", d.notBefore?.toISOString()],
              ["Not after", d.notAfter?.toISOString()],
              ["Status", status],
              ["Serial", d.serialHex ?? undefined],
              ["Public key", m.keyLabel(d.publicKey, "bits")],
              ["Signature", d.signatureAlgorithm],
              ["SAN", d.san.map((s) => `${s.type}:${s.value}`).join(", ") || undefined],
              ["Key usage", d.keyUsage?.join(", ")],
              ["Extended key usage", d.extKeyUsage?.map((e) => e.name?.en ?? e.oid).join(", ")],
              ["CA", d.basicConstraints ? String(d.basicConstraints.ca) : undefined],
              ["SHA-256", fp.sha256],
              ["SHA-1", fp.sha1],
            ]),
          );
          const { der: _der, ...rest } = d;
          json.push({ ...rest, validity: v, fingerprints: fp, pem: m.toPem(d) });
        }
        return { text: blocks.join("\n\n"), json };
      },
    },
    {
      name: "basic-auth",
      tool: "basic-auth",
      summary:
        "Build an HTTP Basic Authorization header (and curl commands), or decode one back to user and password.",
      usage:
        "toolbelt basic-auth --user <user> --password <pw> [--url <url>] | toolbelt basic-auth <header|token|curl|url>",
      options: [
        { name: "user", alias: "u", type: "string", desc: "User name (encode)." },
        { name: "password", alias: "p", type: "string", desc: "Password (encode)." },
        { name: "url", type: "string", desc: "URL for the curl examples." },
      ],
      notes:
        "Without --user, decodes the input: an Authorization header, a Base64 token, a curl -u command or a URL with user:password@.",
      examples: [
        { cmd: "toolbelt basic-auth --user alice --password 's3cret'" },
        { cmd: "toolbelt basic-auth 'Authorization: Basic YWxpY2U6czNjcmV0'" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/basic-auth/logic");
        const user = ctx.str("user");
        if (user !== undefined) {
          const c = { user, password: ctx.str("password", "") };
          const url = ctx.str("url", "");
          const warn = m.warnings(c);
          const text = [
            m.header(c),
            "",
            m.curlUser(c, url),
            m.curlHeader(c, url),
            ...(warn.includes("colon")
              ? ["", 'Warning: RFC 7617 forbids ":" in the user name.']
              : []),
            ...(warn.includes("control")
              ? ["", "Warning: control characters in the credentials."]
              : []),
          ].join("\n");
          return {
            text,
            json: {
              header: m.header(c),
              token: m.token(c),
              curl: m.curlUser(c, url),
              warnings: warn,
            },
          };
        }
        const d = m.decode(await ctx.text());
        return {
          text: kv([
            ["User", d.user],
            ["Password", d.password],
            ["Found in", d.source],
          ]),
          json: d,
        };
      },
    },
    {
      name: "bip39",
      tool: "bip39",
      summary:
        "Generate a BIP39 mnemonic, validate one (checksum, typos), or convert entropy <-> words and get the seed.",
      usage: "toolbelt bip39 [mnemonic] [--words 12] [--entropy <hex>] [--seed] [--passphrase <p>]",
      options: [
        {
          name: "words",
          alias: "w",
          type: "string",
          values: ["12", "15", "18", "21", "24"],
          desc: "Words to generate.",
          default: "12",
        },
        {
          name: "entropy",
          type: "string",
          arg: "<hex>",
          desc: "Turn this entropy (32–64 hex digits) into words.",
        },
        {
          name: "seed",
          type: "boolean",
          desc: "Also print the 64-byte seed (PBKDF2-HMAC-SHA512).",
        },
        { name: "passphrase", type: "string", desc: "Optional BIP39 passphrase for the seed." },
      ],
      notes:
        "With a mnemonic as input, validates it (exit 1 when invalid). Only the English word list.",
      examples: [
        { cmd: "toolbelt bip39 --words 24" },
        { cmd: "toolbelt bip39 'abandon abandon … about' --seed" },
        { cmd: "toolbelt bip39 --entropy 00000000000000000000000000000000" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/bip39/logic");
        const { fromHex, toHex } = await shared();
        const hex = ctx.str("entropy");
        const typed = ctx.args.length || typeof ctx.opts.file === "string" ? await ctx.text() : "";
        let mnemonic: string;
        let validated = false;
        if (hex !== undefined) mnemonic = m.entropyToMnemonic(fromHex(hex));
        else if (typed.trim()) {
          m.mnemonicToEntropy(typed);
          mnemonic = m.splitWords(typed).join(" ");
          validated = true;
        } else
          mnemonic = m.generateMnemonic(Number(ctx.str("words", "12")) as 12 | 15 | 18 | 21 | 24);
        const entropy = toHex(m.mnemonicToEntropy(mnemonic));
        const seed = ctx.bool("seed")
          ? toHex(await m.mnemonicToSeed(mnemonic, ctx.str("passphrase", "")))
          : undefined;
        const words = mnemonic.split(" ").length;
        return {
          text: kv([
            ["Mnemonic", mnemonic],
            ["Valid", validated ? "yes (checksum ok)" : undefined],
            ["Words", words],
            ["Entropy", `${entropy} (${m.entropyBits(words)} bits)`],
            ["Seed", seed],
          ]),
          json: { mnemonic, words, entropy, valid: true, seed },
        };
      },
    },
    {
      name: "safelink",
      tool: "safelink",
      aliases: ["clean-url"],
      summary:
        "Unwrap Outlook Safe Links / Proofpoint / Google redirects and strip tracking parameters (utm_…).",
      usage: "toolbelt safelink [text-or-url] [--no-unwrap] [--no-strip]",
      options: [
        {
          name: "unwrap",
          type: "boolean",
          desc: "Unwrap redirect wrappers (--no-unwrap to keep).",
          default: true,
        },
        {
          name: "strip",
          type: "boolean",
          desc: "Remove tracking parameters (--no-strip to keep).",
          default: true,
        },
      ],
      notes: "Every URL in the input is cleaned in place; the rest of the text is kept.",
      examples: [
        { cmd: "toolbelt safelink 'https://example.com/?utm_source=x&id=3'" },
        { cmd: "toolbelt safelink --file email.txt" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/encode/safelink/logic");
        const res = m.cleanText(await ctx.text(), {
          unwrap: ctx.bool("unwrap", true),
          strip: ctx.bool("strip", true),
        });
        if (!res.links.length) throw new CliError("No http(s) URL found in the input.");
        return { text: res.text, json: res };
      },
    },
  ],
};
