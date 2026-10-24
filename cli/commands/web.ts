/** Web & dev tools. Each command imports its tool's logic lazily, so only what runs gets loaded. */
import { pick, tr } from "../../src/i18n";
import { kv, num, table } from "../format";
import { CliError, type CommandGroup, type Ctx, UsageError } from "../types";

const random = (a: Uint8Array) => {
  crypto.getRandomValues(a);
};

/** The positional words, joined (lookup commands never wait on stdin). */
const query = (ctx: Ctx) => ctx.args.join(" ").trim();

/** Positional text, else --file (no stdin): for commands that generate when given nothing. */
async function optionalInput(ctx: Ctx): Promise<string> {
  if (ctx.args.length) return ctx.args.join(" ");
  const file = ctx.str("file");
  return file !== undefined ? ctx.readTextFile(file) : "";
}

const yes = (b: boolean) => (b ? "yes" : "no");

const CIDR_ERRORS: Record<string, string> = {
  empty: "missing address",
  address: "not a valid address",
  prefix: "not a valid prefix length",
  mask: "the netmask is not contiguous (e.g. 255.255.255.0)",
};

const COMMIT_ISSUES: Record<string, string> = {
  noType: "Choose a type.",
  badType: "The type must be a single word.",
  badScope: "The scope must be a noun without spaces or parentheses (commas allowed).",
  noDescription: "Write a short description.",
  headerTooLong: "The header is longer than 72 characters: it gets cut in many tools.",
  headerLong: "Over 50 characters: fine, but shorter headers read better in git log.",
  capitalized: "Conventional descriptions usually start in lowercase.",
  period: "No period at the end of the header.",
  notImperative: "Use the imperative mood: “{v}”, not a past or -ing form.",
  breakingNoNote: "Describe the breaking change so users know how to migrate.",
  badFooter: "Footers look like “Token: value” or “Token #value”: {v}",
};

const META_WARNINGS: Record<string, string> = {
  noTitle: "Add a title.",
  titleLong: "The title is over 60 characters: search results will cut it.",
  noDescription: "Add a description.",
  descriptionLong: "The description is over 160 characters: it will be cut.",
  descriptionShort: "The description is short: aim for 50 to 160 characters.",
  urlRelative: "The URL must be absolute (https://…).",
  imageRelative: "The image URL must be absolute (https://…), or previews will not show it.",
  noImage: "No image: links will show a small card without picture.",
  badHandle: "Not an X / Twitter handle (letters, digits, _; 15 max).",
  badColor: "Not a CSS color.",
};

export const group: CommandGroup = {
  category: "web",
  commands: [
    {
      name: "color",
      tool: "color",
      summary:
        "Convert a CSS color to every format (hex, rgb, hsl, hwb, lab, lch, oklab, oklch) and check contrast (WCAG, APCA).",
      usage: "toolbelt color <color> [--bg <color> | --fg <color>] [--scale]",
      options: [
        {
          name: "bg",
          type: "string",
          arg: "<color>",
          desc: "Check the contrast of the color (as text) on this background.",
        },
        {
          name: "fg",
          type: "string",
          arg: "<color>",
          desc: "Check the contrast of this text color on the color (as background).",
        },
        { name: "scale", type: "boolean", desc: "Also list 5 shades and 5 tints." },
      ],
      examples: [
        { cmd: 'toolbelt color "#0f766e"' },
        {
          cmd: "toolbelt color '#777' --bg white",
          desc: "WCAG ratio and APCA Lc of gray text on white.",
        },
        { cmd: 'toolbelt color "oklch(70% 0.15 200)" --json' },
      ],
      async run(ctx) {
        const input = await ctx.text();
        const L = await import("../../src/tools/web/color/logic");
        const parse = (s: string, what: string) => {
          const c = L.parseColor(s);
          if (!c) throw new CliError(`not a CSS color (${what}): "${s.trim()}"`);
          return c;
        };
        const c = parse(input, "input");
        const formats = L.formats(c);
        const name = L.colorName(c);
        const lines = [
          table(formats.map((f) => [f.id, f.value])),
          "",
          kv([
            ["Name", `${name.name}${name.exact ? "" : " (nearest)"}`],
            ["In sRGB gamut", yes(L.inGamut(c))],
            ["Readable text on it", L.readableOn(c)],
          ]),
        ];
        const json: Record<string, unknown> = {
          formats: Object.fromEntries(formats.map((f) => [f.id, f.value])),
          name: name.name,
          exactName: name.exact,
          inGamut: L.inGamut(c),
          readableText: L.readableOn(c),
        };
        const bg = ctx.str("bg");
        const fgOpt = ctx.str("fg");
        if (bg !== undefined && fgOpt !== undefined)
          throw new UsageError("use --bg or --fg, not both");
        if (bg !== undefined || fgOpt !== undefined) {
          const fg = bg !== undefined ? c : parse(fgOpt as string, "--fg");
          const back = bg !== undefined ? parse(bg, "--bg") : c;
          const ratio = L.contrastRatio(fg, back);
          const w = L.wcagLevels(ratio);
          const lc = L.apcaContrast(fg, back);
          const pass = (b: boolean) => (b ? "pass" : "fail");
          lines.push(
            "",
            `Contrast of ${L.hex(fg)} on ${L.hex(back)}:`,
            kv([
              ["WCAG ratio", `${num(ratio, 2)}:1`],
              ["AA normal text", pass(w.aaNormal)],
              ["AA large text", pass(w.aaLarge)],
              ["AAA normal text", pass(w.aaaNormal)],
              ["AAA large text", pass(w.aaaLarge)],
              ["UI components", pass(w.ui)],
              ["APCA Lc", `${num(lc, 1)} (good for: ${L.apcaUse(lc)})`],
            ]),
          );
          json.contrast = {
            fg: L.hex(fg),
            bg: L.hex(back),
            ratio: Number(num(ratio, 2)),
            wcag: w,
            apca: Number(num(lc, 1)),
            apcaUse: L.apcaUse(lc),
          };
        }
        if (ctx.bool("scale")) {
          const scale = L.tintsAndShades(c);
          lines.push("", "Shades (-) and tints (+):", table(scale.map((s) => [s.step, s.hex])));
          json.scale = scale;
        }
        return { text: lines.join("\n"), json };
      },
    },
    {
      name: "css-units",
      tool: "css-units",
      summary:
        "Convert a CSS length between px, rem, em, %, pt, pc, in, cm, mm, Q, vw, vh, vmin, vmax.",
      usage:
        "toolbelt css-units <length> [--to <unit>] [--root <px>] [--parent <px>] [--vw <px>] [--vh <px>]",
      options: [
        { name: "to", alias: "t", type: "string", arg: "<unit>", desc: "Only this unit." },
        {
          name: "unit",
          alias: "u",
          type: "string",
          arg: "<unit>",
          desc: "Unit of a bare number.",
          default: "px",
        },
        { name: "root", type: "number", desc: "Root font size in px (1rem).", default: 16 },
        {
          name: "parent",
          type: "number",
          desc: "Parent font size in px (1em, 100%).",
          default: 16,
        },
        { name: "vw", type: "number", desc: "Viewport width in px.", default: 1440 },
        { name: "vh", type: "number", desc: "Viewport height in px.", default: 900 },
      ],
      examples: [
        { cmd: "toolbelt css-units 24px" },
        { cmd: "toolbelt css-units 1.5rem --to px" },
        { cmd: "toolbelt css-units 50vw --to px --vw 1280" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/css-units/logic");
        const unitOf = (s: string | undefined, what: string) => {
          if (s === undefined) return undefined;
          const u = L.UNITS.find((x) => x.toLowerCase() === s.toLowerCase());
          if (!u) throw new UsageError(`${what} must be one of: ${L.UNITS.join(", ")}`);
          return u;
        };
        const fallback = unitOf(ctx.str("unit"), "--unit") ?? "px";
        const to = unitOf(ctx.str("to"), "--to");
        const input = (await ctx.text()).trim();
        const len = L.parseLength(input, fallback);
        if (!len) throw new CliError(`not a CSS length: "${input}" (e.g. 24px, 1.5rem, 50%)`);
        const c = L.DEFAULT_CONTEXT;
        const context = {
          root: ctx.num("root", c.root),
          parent: ctx.num("parent", c.parent),
          vw: ctx.num("vw", c.vw),
          vh: ctx.num("vh", c.vh),
        };
        if (to) {
          const v = L.convert(len.value, len.unit, to, context);
          return {
            text: `${num(v, 4)}${to}`,
            json: { value: v, unit: to, css: `${num(v, 4)}${to}` },
          };
        }
        const all = L.convertAll(len.value, len.unit, context);
        return {
          text: table(all.map((r) => [r.unit, r.css])),
          json: { input: len, context, values: all },
        };
      },
    },
    {
      name: "chmod",
      tool: "chmod",
      summary: "Unix permissions: octal ↔ symbolic (rwxr-xr-x), and the chmod command.",
      usage: "toolbelt chmod <mode> [--path <file>] [--recursive] [--symbolic]",
      options: [
        {
          name: "path",
          type: "string",
          arg: "<file>",
          desc: "File for the chmod command.",
          default: "file",
        },
        { name: "recursive", alias: "R", type: "boolean", desc: "chmod -R in the command." },
        { name: "symbolic", type: "boolean", desc: "u=rwx,g=rx,o= form in the command." },
      ],
      examples: [
        { cmd: "toolbelt chmod 755" },
        { cmd: "toolbelt chmod rw-r--r--" },
        { cmd: "toolbelt chmod 4755 --path ./bin/tool --symbolic" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/chmod/logic");
        const input = (await ctx.text()).trim();
        const mode = L.parseOctal(input) ?? L.parseSymbolic(input);
        if (mode === null)
          throw new CliError(`not a permission mode: "${input}" (e.g. 755, 0644, rwxr-xr-x)`);
        const command = L.chmodCommand(mode, ctx.str("path", ""), {
          recursive: ctx.bool("recursive"),
          symbolic: ctx.bool("symbolic"),
        });
        const perms = (who: (typeof L.WHO)[number]) =>
          L.PERMS.filter((p) => mode & L.bit(who, p)).join("") || "-";
        const special = [
          mode & L.SETUID ? "setuid" : "",
          mode & L.SETGID ? "setgid" : "",
          mode & L.STICKY ? "sticky" : "",
        ].filter(Boolean);
        return {
          text: kv([
            ["Octal", L.toOctal(mode)],
            ["Symbolic", L.toSymbolic(mode)],
            ["chmod form", L.toChmodSymbolic(mode)],
            ["Owner", perms("owner")],
            ["Group", perms("group")],
            ["Others", perms("others")],
            ["Special", special.join(", ") || "none"],
            ["Command", command],
          ]),
          json: {
            mode,
            octal: L.toOctal(mode),
            short: L.shortOctal(mode),
            symbolic: L.toSymbolic(mode),
            chmodSymbolic: L.toChmodSymbolic(mode),
            owner: perms("owner"),
            group: perms("group"),
            others: perms("others"),
            special,
            command,
          },
        };
      },
    },
    {
      name: "cidr",
      tool: "cidr",
      aliases: ["subnet"],
      summary:
        "IPv4/IPv6 subnet calculator: network, broadcast, masks, host range, scope; split a block.",
      usage: "toolbelt cidr <address/prefix> [--split <n>]",
      options: [
        {
          name: "split",
          type: "number",
          arg: "<n>",
          desc: "IPv4: split the block into at least n equal subnets.",
        },
      ],
      examples: [
        { cmd: "toolbelt cidr 192.168.1.10/24" },
        { cmd: "toolbelt cidr 10.0.0.0/16 --split 4" },
        { cmd: "toolbelt cidr 2001:db8:abcd:12::1/48 --json" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/cidr/logic");
        const input = (await ctx.text()).trim();
        if (input.includes(":")) {
          const p = L.parseCidr6(input);
          if (!p.ok) throw new CliError(`${CIDR_ERRORS[p.error]}: "${input}"`);
          if (ctx.num("split") !== undefined)
            throw new UsageError("--split works on IPv4 blocks only");
          const s = L.subnet6(p.ip, p.prefix);
          return {
            text: kv([
              ["Address", s.compressed],
              ["Expanded", s.expanded],
              ["Network", s.network],
              ["First", s.first],
              ["Last", s.last],
              ["Addresses", L.powerLabel(s.total)],
              ["Scope", s.scope],
              ["Reverse DNS", s.reverse],
            ]),
            json: { version: 6, ...s, total: s.total.toString() },
          };
        }
        const p = L.parseCidr4(input);
        if (!p.ok) throw new CliError(`${CIDR_ERRORS[p.error]}: "${input}"`);
        const s = L.subnet4(p.ip, p.prefix);
        const lines = [
          kv([
            ["Address", s.ip],
            ["CIDR", s.cidr],
            ["Network", s.network],
            ["Broadcast", s.broadcast],
            ["Netmask", s.netmask],
            ["Wildcard", s.wildcard],
            ["First host", s.first],
            ["Last host", s.last],
            ["Addresses", s.total],
            ["Usable hosts", s.hosts],
            ["Class", s.ipClass],
            ["Scope", s.scopeRange ? `${s.scope} (${s.scopeRange})` : s.scope],
            ["Binary", s.binary],
            ["Hex", s.hex],
            ["Integer", s.integer],
          ]),
        ];
        const json: Record<string, unknown> = { version: 4, ...s };
        const n = ctx.num("split");
        if (n !== undefined) {
          const sp = L.split4(p.ip, p.prefix, n);
          if (!sp.ok) throw new CliError(`cannot split /${p.prefix} into ${n} subnets`);
          lines.push(
            "",
            `${sp.count} subnets of /${sp.prefix}${sp.subnets.length < sp.count ? ` (first ${sp.subnets.length})` : ""}:`,
            table(
              sp.subnets.map((x) => [x.cidr, `${x.first} - ${x.last}`, x.hosts]),
              ["SUBNET", "HOSTS RANGE", "HOSTS"],
            ),
          );
          json.split = {
            prefix: sp.prefix,
            count: sp.count,
            subnets: sp.subnets.map((x) => ({
              cidr: x.cidr,
              first: x.first,
              last: x.last,
              hosts: x.hosts,
            })),
          };
        }
        return { text: lines.join("\n"), json };
      },
    },
    {
      name: "semver",
      tool: "semver",
      summary:
        "Semantic versions (npm rules): parse, compare, check a range, max satisfying, bump.",
      usage:
        "toolbelt semver <version...> [--compare <v>] [--range <range>] [--inc <release>] [--preid <id>]",
      options: [
        {
          name: "compare",
          alias: "c",
          type: "string",
          arg: "<version>",
          desc: "Compare the version with this one.",
        },
        {
          name: "range",
          alias: "r",
          type: "string",
          arg: "<range>",
          desc: "Check each version against a range (^1.2.0 || ~2.1) and give the max satisfying.",
        },
        {
          name: "inc",
          alias: "i",
          type: "string",
          values: ["major", "minor", "patch", "premajor", "preminor", "prepatch", "prerelease"],
          desc: "Bump the version.",
        },
        {
          name: "preid",
          type: "string",
          arg: "<id>",
          desc: "Prerelease id for --inc (alpha, beta, rc…).",
        },
        {
          name: "include-prerelease",
          alias: "p",
          type: "boolean",
          desc: "Let ranges match prereleases of other versions.",
        },
      ],
      examples: [
        { cmd: "toolbelt semver 1.4.2-beta.3+exp.sha.5114f85" },
        { cmd: "toolbelt semver 1.10.0 --compare 1.9.3" },
        { cmd: 'toolbelt semver 1.2.0 1.8.3 2.0.0 --range "^1.2.0"' },
        { cmd: "toolbelt semver 1.2.3 --inc prerelease --preid beta" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/semver/logic");
        const raw = ctx.args.length
          ? ctx.args
          : (await ctx.text())
              .split(/[\s,]+/)
              .map((s) => s.trim())
              .filter(Boolean);
        if (!raw.length) throw new UsageError("missing version");
        const versions = raw.map((s) => {
          const v = L.parse(s);
          if (!v)
            throw new CliError(`not a valid semantic version: "${s}" (e.g. 1.4.2, 2.0.0-rc.1)`);
          return v;
        });
        const first = versions[0] as (typeof versions)[number];
        const includePre = ctx.bool("include-prerelease");
        const rangeText = ctx.str("range");
        if (rangeText !== undefined) {
          const range = L.parseRange(rangeText, includePre);
          if (!range) throw new CliError(`not a valid range: "${rangeText}"`);
          const rows = versions.map((v) => ({
            version: L.format(v, true),
            satisfies: L.satisfies(v, range, includePre),
          }));
          const max = L.maxSatisfying(versions, range, includePre);
          return {
            text: [
              `Range: ${L.formatRange(range)}`,
              table(rows.map((r) => [r.version, r.satisfies ? "satisfies" : "does not satisfy"])),
              `Max satisfying: ${max ? L.format(max, true) : "none"}`,
            ].join("\n"),
            json: {
              range: L.formatRange(range),
              versions: rows,
              maxSatisfying: max ? L.format(max, true) : null,
            },
            code: rows.some((r) => r.satisfies) ? 0 : 1,
          };
        }
        const other = ctx.str("compare");
        if (other !== undefined) {
          const b = L.parse(other);
          if (!b) throw new CliError(`not a valid semantic version: "${other}"`);
          const c = L.compare(first, b);
          const d = L.diff(first, b);
          const sign = c < 0 ? "<" : c > 0 ? ">" : "=";
          return {
            text: `${L.format(first, true)} ${sign} ${L.format(b, true)}${d ? ` (${d} difference)` : ""}`,
            json: { a: L.format(first, true), b: L.format(b, true), compare: c, diff: d },
          };
        }
        const release = ctx.str("inc") as (typeof L.RELEASES)[number] | undefined;
        if (release) {
          const id = ctx.str("preid", "");
          if (!L.validPreId(id)) throw new CliError(`not a valid prerelease id: "${id}"`);
          const next = L.format(L.inc(first, release, id));
          return { text: next, json: { from: L.format(first, true), release, version: next } };
        }
        const info = versions.map((v) => ({
          version: L.format(v, true),
          major: v.major,
          minor: v.minor,
          patch: v.patch,
          prerelease: v.prerelease,
          build: v.build,
          stable: v.major > 0 && !v.prerelease.length,
        }));
        const text = info
          .map((v) =>
            kv([
              ["Version", v.version],
              ["Major", v.major],
              ["Minor", v.minor],
              ["Patch", v.patch],
              ["Prerelease", v.prerelease.join(".") || "none"],
              ["Build", v.build.join(".") || "none"],
              ["Stable", yes(v.stable)],
            ]),
          )
          .join("\n\n");
        return { text, json: info.length === 1 ? info[0] : info };
      },
    },
    {
      name: "user-agent",
      tool: "user-agent",
      aliases: ["ua"],
      summary: "Parse a user-agent string: browser, engine, OS, device, CPU, bot.",
      usage: 'toolbelt user-agent "<user-agent string>"',
      examples: [
        {
          cmd: 'toolbelt user-agent "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0"',
        },
        { cmd: "toolbelt user-agent curl/8.7.1 --json" },
      ],
      async run(ctx) {
        const ua = (await ctx.text()).trim();
        if (!ua) throw new UsageError("missing user-agent string");
        const { parseUA } = await import("../../src/tools/web/user-agent/logic");
        const r = parseUA(ua);
        const join = (...p: string[]) => p.filter(Boolean).join(" ") || "unknown";
        return {
          text: kv([
            [
              "Browser",
              join(r.browser.name, r.browser.version, r.browser.type ? `(${r.browser.type})` : ""),
            ],
            ["Engine", join(r.engine.name, r.engine.version)],
            ["OS", join(r.os.name, r.os.version)],
            ["Device", join(r.device.type, r.device.vendor, r.device.model)],
            ["CPU", r.cpu.architecture || "unknown"],
            ["Bot", r.aiBot ? "yes (AI)" : yes(r.bot)],
            ["Frozen UA", yes(r.frozen)],
          ]),
          json: r,
        };
      },
    },
    {
      name: "http-status",
      tool: "http-status",
      summary: "HTTP status codes: look up a code, a class (4xx) or search by words.",
      usage: "toolbelt http-status <code|class|words> [--class <1-5>]",
      options: [
        {
          name: "class",
          type: "string",
          values: ["1", "2", "3", "4", "5"],
          desc: "Only this class.",
        },
      ],
      examples: [
        { cmd: "toolbelt http-status 418" },
        { cmd: "toolbelt http-status 4xx" },
        { cmd: "toolbelt http-status too many requests" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/http-status/logic");
        const q = query(ctx);
        const cls = ctx.str("class");
        const list = L.searchStatuses(q, cls ? (Number(cls) as 1 | 2 | 3 | 4 | 5) : 0);
        const name = (s: (typeof list)[number]) => pick({ en: s.name, fr: s.nameFr, de: s.nameDe });
        const desc = (s: (typeof list)[number]) => pick({ en: s.en, fr: s.fr, de: s.de });
        const json = list.map((s) => ({
          code: s.code,
          name: name(s),
          description: desc(s),
          ref: s.ref,
          rare: !!s.rare,
        }));
        if (!list.length) return { text: `No status matches "${q}".`, json, code: 1 };
        const exact = /^\d{3}$/.test(q) ? list.find((s) => String(s.code) === q) : undefined;
        if (exact)
          return {
            text: `${exact.code} ${name(exact)}\n${desc(exact)}\nRef: ${exact.ref}`,
            json: json.find((s) => s.code === exact.code),
          };
        return { text: table(list.map((s) => [s.code, name(s), desc(s)])), json };
      },
    },
    {
      name: "mime",
      tool: "mime",
      summary:
        "MIME types ↔ file extensions: the type of a file name, the extensions of a type, or search.",
      usage: "toolbelt mime <file|extension|type|words> [--group <group>]",
      options: [
        {
          name: "group",
          alias: "g",
          type: "string",
          values: [
            "application",
            "audio",
            "font",
            "image",
            "message",
            "model",
            "multipart",
            "text",
            "video",
          ],
          desc: "Only this top-level type.",
        },
      ],
      examples: [
        { cmd: "toolbelt mime photo.webp" },
        { cmd: "toolbelt mime application/json" },
        { cmd: "toolbelt mime --group font" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/mime/logic");
        const q = query(ctx);
        const group = ctx.str("group", "");
        if (!q && !group) throw new UsageError("missing file name, extension or type (or --group)");
        const list = L.searchMime(q, group);
        const json = list.map((e) => ({ type: e.type, group: e.group, extensions: e.extensions }));
        if (!list.length) return { text: `No MIME type matches "${q}".`, json, code: 1 };
        return {
          text: table(list.map((e) => [e.type, e.extensions.map((x) => `.${x}`).join(" ")])),
          json,
        };
      },
    },
    {
      name: "ascii",
      tool: "ascii",
      summary:
        "ASCII table (0-127): codes in decimal, hex, octal, binary, HTML, escapes and names.",
      usage: "toolbelt ascii [char|code|0x41|words] [--filter <kind>]",
      options: [
        {
          name: "filter",
          type: "string",
          values: ["all", "control", "printable", "letters", "digits", "symbols"],
          desc: "Only this kind of characters.",
          default: "all",
        },
      ],
      examples: [
        { cmd: "toolbelt ascii A" },
        { cmd: "toolbelt ascii 0x1b" },
        { cmd: "toolbelt ascii --filter control" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/ascii/logic");
        // A single space is a valid query: keep the raw argument when there is one.
        const q = ctx.args.length === 1 ? (ctx.args[0] as string) : query(ctx);
        const rows = L.searchAscii(
          q,
          ctx.str("filter", "all") as Parameters<typeof L.searchAscii>[1],
        );
        const json = rows.map((r) => ({
          code: r.code,
          hex: r.hex,
          oct: r.oct,
          bin: r.bin,
          char: r.char,
          name: tr(r.name),
          html: r.html,
          htmlNamed: r.htmlNamed,
          caret: r.caret,
          escape: r.escape,
          control: r.control,
        }));
        if (!rows.length) return { text: `No character matches "${q}".`, json, code: 1 };
        return {
          text: table(
            rows.map((r) => [
              r.code,
              `0x${r.hex}`,
              r.oct,
              r.bin,
              r.char === " " ? "SP" : r.char,
              r.htmlNamed || r.html,
              r.escape || r.caret,
              tr(r.name),
            ]),
            ["DEC", "HEX", "OCT", "BIN", "CHAR", "HTML", "ESC", "NAME"],
          ),
          json,
        };
      },
    },
    {
      name: "gitignore",
      tool: "gitignore",
      summary:
        "Build a .gitignore from templates (node, python, macos, vscode…), duplicates removed.",
      usage: "toolbelt gitignore <template...> [--custom <lines>] | --list | --search <words>",
      options: [
        { name: "custom", type: "string", arg: "<lines>", desc: "Extra lines, in a last section." },
        { name: "list", alias: "l", type: "boolean", desc: "List the templates." },
        {
          name: "search",
          alias: "s",
          type: "string",
          arg: "<words>",
          desc: "Search the templates.",
        },
      ],
      examples: [
        { cmd: "toolbelt gitignore node macos vscode" },
        { cmd: "toolbelt gitignore python jupyter -o .gitignore" },
        { cmd: "toolbelt gitignore --list" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/gitignore/logic");
        const { TEMPLATES } = await import("../../src/tools/web/gitignore/templates");
        const s = ctx.str("search");
        if (ctx.bool("list") || s !== undefined) {
          const list = s !== undefined ? L.searchTemplates(s) : TEMPLATES;
          const json = list.map((t) => ({ id: t.id, name: t.name, group: t.group }));
          if (!list.length) return { text: `No template matches "${s}".`, json, code: 1 };
          return { text: table(list.map((t) => [t.id, t.name, t.group])), json };
        }
        const ids = ctx.args
          .flatMap((a) => a.split(","))
          .map((a) => a.trim().toLowerCase())
          .filter(Boolean);
        if (!ids.length)
          throw new UsageError("missing template ids (see: toolbelt gitignore --list)");
        const resolved = ids.map((id) => {
          const t = L.findTemplate(id) ?? L.searchTemplates(id)[0];
          if (!t) throw new CliError(`unknown template "${id}" (see: toolbelt gitignore --list)`);
          return t.id;
        });
        const out = L.buildGitignore(resolved, ctx.str("custom", ""));
        return {
          text: out,
          json: { templates: [...new Set(resolved)], patterns: L.countPatterns(out), content: out },
        };
      },
    },
    {
      name: "commit",
      tool: "commit",
      summary: "Build a Conventional Commits message (and its git commit command), with checks.",
      usage:
        'toolbelt commit "<description>" [--type <type>] [--scope <scope>] [--body <text>] [--breaking [--breaking-note <text>]] [--closes <refs>] [--footer <line>...] [--command]',
      options: [
        {
          name: "type",
          alias: "t",
          type: "string",
          arg: "<type>",
          desc: "feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert…",
          default: "feat",
        },
        {
          name: "scope",
          alias: "s",
          type: "string",
          arg: "<scope>",
          desc: "What the change touches.",
        },
        { name: "body", alias: "b", type: "string", arg: "<text>", desc: "Longer explanation." },
        { name: "breaking", type: "boolean", desc: "A breaking change (adds ! to the header)." },
        {
          name: "breaking-note",
          type: "string",
          arg: "<text>",
          desc: "What breaks and how to migrate (BREAKING CHANGE footer).",
        },
        {
          name: "closes",
          type: "string",
          arg: "<refs>",
          desc: 'Issues closed: "12, #34, org/repo#5".',
        },
        { name: "footer", type: "list", arg: "<line>", desc: 'A footer ("Refs: #7"); repeatable.' },
        { name: "no-wrap", type: "boolean", desc: "Keep the body as typed (no wrap at 72)." },
        { name: "command", type: "boolean", desc: "Print the git commit command instead." },
      ],
      notes: "Errors (missing description, bad type…) exit with 1; warnings go to stderr.",
      examples: [
        { cmd: 'toolbelt commit "add dark mode" --type feat --scope ui' },
        {
          cmd: 'toolbelt commit "drop node 18" --type build --breaking --breaking-note "Node 20 is required" --closes 42 --command',
        },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/commit/logic");
        const description = (await ctx.text({ required: false })).trim();
        const input = {
          type: ctx.str("type", "feat"),
          scope: ctx.str("scope", ""),
          description,
          body: ctx.str("body", ""),
          breaking: ctx.bool("breaking"),
          breakingNote: ctx.str("breaking-note", ""),
          closes: ctx.str("closes", ""),
          footers: ctx.list("footer").join("\n"),
        };
        const issues = L.validate(input).map((i) => ({
          ...i,
          message: (COMMIT_ISSUES[i.code] ?? i.code).replace(/\{v\}/g, i.detail ?? ""),
        }));
        const errors = issues.filter((i) => i.level === "error");
        if (errors.length) throw new CliError(errors.map((e) => e.message).join(" "));
        const message = L.buildMessage(input, !ctx.bool("no-wrap"));
        const command = L.gitCommand(message);
        return {
          text: ctx.bool("command") ? command : message,
          json: { message, command, header: L.header(input), issues },
          warnings: issues.map((i) => i.message),
        };
      },
    },
    {
      name: "validators",
      tool: "validators",
      aliases: ["validate"],
      summary: "Check a card number (Luhn), an IBAN, a barcode (EAN/UPC/GTIN) or an ISBN.",
      usage: "toolbelt validators <number> [--kind card|iban|gtin|isbn]",
      options: [
        {
          name: "kind",
          alias: "k",
          type: "string",
          values: ["auto", "card", "iban", "gtin", "isbn"],
          desc: "What the number is.",
          default: "auto",
        },
      ],
      notes: "Exits with 1 when the number is invalid (the details are still printed).",
      examples: [
        { cmd: 'toolbelt validators "DE89 3704 0044 0532 0130 00"' },
        { cmd: "toolbelt validators 4111111111111111 --kind card" },
        { cmd: "toolbelt validators 978-0-306-40615-7" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/validators/logic");
        const input = (await ctx.text()).trim();
        let kind = ctx.str("kind", "auto");
        if (kind === "auto") {
          const compact = input.replace(/[\s-]/g, "");
          if (/^IBAN/i.test(input) || /^[A-Z]{2}\d{2}[A-Z0-9]+$/i.test(compact)) kind = "iban";
          else if (
            /^ISBN/i.test(input) ||
            /^\d{9}[\dX]$/i.test(compact) ||
            /^97[89]\d{10}$/.test(compact)
          )
            kind = "isbn";
          else if (
            /^(\d{8}|\d{12,14})$/.test(compact) &&
            !(compact.length >= 13 && L.cardBrand(compact))
          )
            kind = "gtin";
          else kind = "card";
        }
        const errors: Record<string, string> = {
          empty: "missing number",
          chars: "unexpected characters",
          short: "too short for a card number",
          country: "an IBAN starts with a country code and 2 check digits (e.g. DE89…)",
          length: "wrong number of digits",
          prefix: "an ISBN-13 starts with 978 or 979",
        };
        const fail = (e: string) => {
          throw new CliError(`not a valid ${kind} input: ${errors[e] ?? e}`);
        };
        const verdict = (v: boolean) => (v ? "valid" : "INVALID");
        if (kind === "iban") {
          const r = L.checkIban(input);
          if (!r.ok) return fail(r.error);
          const bank = L.ibanBankParts(r.country, r.bban);
          return {
            text: kv([
              ["IBAN", r.formatted],
              ["Result", verdict(r.valid)],
              ["Country", r.country + (r.known ? "" : " (unknown)")],
              [
                "Length",
                `${r.iban.length}${r.expectedLength ? ` (expected ${r.expectedLength})` : ""}`,
              ],
              ["Check digits", r.checkOk ? "ok" : `wrong (expected ${r.expectedCheck})`],
              ["BBAN", r.bban],
              ["Bank code", bank?.bank],
              ["Account", bank?.account],
            ]),
            json: { check: kind, ...r, bank },
            code: r.valid ? 0 : 1,
          };
        }
        if (kind === "isbn") {
          const r = L.checkIsbn(input);
          if (!r.ok) return fail(r.error);
          return {
            text: kv([
              ["ISBN", r.compact],
              ["Result", verdict(r.valid)],
              ["Kind", r.kind],
              ["Check digit", r.valid ? "ok" : `wrong (expected ${r.expected})`],
              ["ISBN-10", r.isbn10 ?? "none (979 prefix)"],
              ["ISBN-13", r.isbn13],
            ]),
            json: { check: kind, ...r },
            code: r.valid ? 0 : 1,
          };
        }
        if (kind === "gtin") {
          const r = L.checkGtin(input);
          if (!r.ok) return fail(r.error);
          return {
            text: kv([
              ["Barcode", r.digits],
              ["Result", verdict(r.valid)],
              ["Kind", r.kind + (r.isbn ? " (an ISBN)" : "")],
              ["Check digit", r.valid ? "ok" : `wrong (expected ${r.expected})`],
            ]),
            json: { check: kind, ...r },
            code: r.valid ? 0 : 1,
          };
        }
        const r = L.checkCard(input);
        if (!r.ok) return fail(r.error);
        return {
          text: kv([
            ["Card", r.formatted],
            ["Result", verdict(r.valid)],
            ["Brand", r.brand?.name ?? "unknown"],
            ["Luhn", r.luhn ? "ok" : `fails (check digit should be ${r.expected})`],
            ["Length", r.lengthOk ? "ok" : "unusual for this brand"],
          ]),
          json: { check: "card", ...r },
          code: r.valid ? 0 : 1,
        };
      },
    },
    {
      name: "meta-tags",
      tool: "meta-tags",
      summary:
        "Generate the <head> tags for SEO and link previews (Open Graph, Twitter), with checks.",
      usage:
        "toolbelt meta-tags --title <t> --description <d> [--url <u>] [--image <u>] [--image-alt <t>] [--site-name <n>] [--type <t>] [--locale <l>] [--twitter <@h>] [--theme-color <c>]",
      options: [
        { name: "title", type: "string", arg: "<text>", desc: "Page title (60 characters max)." },
        {
          name: "description",
          alias: "d",
          type: "string",
          arg: "<text>",
          desc: "50 to 160 characters.",
        },
        { name: "url", type: "string", arg: "<url>", desc: "Canonical URL (absolute)." },
        { name: "image", type: "string", arg: "<url>", desc: "Preview image URL (absolute)." },
        { name: "image-alt", type: "string", arg: "<text>", desc: "Alt text of the image." },
        { name: "site-name", type: "string", arg: "<name>", desc: "Site name." },
        { name: "type", type: "string", arg: "<type>", desc: "og:type.", default: "website" },
        { name: "locale", type: "string", arg: "<locale>", desc: "og:locale, e.g. en_US." },
        {
          name: "twitter",
          type: "string",
          arg: "<@handle>",
          desc: "The site's X / Twitter handle.",
        },
        { name: "theme-color", type: "string", arg: "<color>", desc: "Browser theme color." },
      ],
      notes: "Warnings (missing image, long title…) go to stderr.",
      examples: [
        {
          cmd: 'toolbelt meta-tags --title "toolbelt" --description "Everyday utilities that run in your browser, offline." --url https://maxgfr.github.io/toolbelt/ --image https://maxgfr.github.io/toolbelt/og.png',
        },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/meta-tags/logic");
        const { parseColor } = await import("../../src/tools/web/color/logic");
        const m = {
          title: ctx.str("title", ctx.args.join(" ")),
          description: ctx.str("description", ""),
          url: ctx.str("url", ""),
          image: ctx.str("image", ""),
          imageAlt: ctx.str("image-alt", ""),
          siteName: ctx.str("site-name", ""),
          type: ctx.str("type", "website"),
          locale: ctx.str("locale", ""),
          twitter: ctx.str("twitter", ""),
          themeColor: ctx.str("theme-color", ""),
        };
        if (!m.title.trim() && !m.description.trim())
          throw new UsageError("give at least --title or --description");
        const tags = L.buildTags(m);
        const warnings = L.checkMeta(m, (s) => !!parseColor(s)).map((w) => ({
          code: w,
          message: META_WARNINGS[w] ?? w,
        }));
        return { text: tags, json: { tags, warnings }, warnings: warnings.map((w) => w.message) };
      },
    },
    {
      name: "ip-tools",
      tool: "ip-tools",
      aliases: ["ip"],
      summary:
        "IPv4 in every notation (integer, hex, binary, mapped IPv6…), a range as CIDR blocks, or whether an address is in a list of blocks.",
      usage: "toolbelt ip-tools <address | start - end | cidr> [--list] [--in <block>...]",
      options: [
        {
          name: "in",
          type: "list",
          arg: "<cidr>",
          desc: "Check the address against these blocks (repeatable, or comma-separated).",
        },
        { name: "list", type: "boolean", desc: "For a range: also list its addresses." },
        { name: "cap", type: "number", desc: "Max addresses listed with --list.", default: 256 },
      ],
      examples: [
        { cmd: "toolbelt ip-tools 3232235777", desc: "192.168.1.1 in every notation." },
        {
          cmd: 'toolbelt ip-tools "10.0.0.5 - 10.0.0.20"',
          desc: "The smallest CIDR list for a range.",
        },
        { cmd: "toolbelt ip-tools 10.1.2.3 --in 10.0.0.0/8 --in 192.168.0.0/16" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/ip-tools/logic");
        const input = (await ctx.text()).trim();
        const blocks = ctx
          .list("in")
          .flatMap((b) => b.split(/[,\n]/))
          .map((b) => b.trim())
          .filter(Boolean);
        if (blocks.length) {
          if (!L.parseAddress(input)) throw new CliError(`not an IP address: "${input}"`);
          const res = L.checkMembership(input, blocks.join("\n"));
          const label: Record<string, string> = {
            in: "inside",
            out: "outside",
            "other-version": "other IP version",
            invalid: "invalid block",
            pending: "?",
          };
          const any = res.some((r) => r.status === "in");
          return {
            text: table(res.map((r) => [r.line, label[r.status] ?? r.status])),
            json: { address: input, inside: any, blocks: res },
            code: any ? 0 : 1,
          };
        }
        const single = L.parseAnyIPv4(input);
        if (single && !/\s-\s|\/|\bto\b/.test(input)) {
          const n = L.notations(single.ip);
          return {
            text: kv([
              ["Read as", single.kind],
              ["Dotted", n.dotted],
              ["Integer", n.decimal],
              ["Hex", n.hex],
              ["Hex dotted", n.hexDotted],
              ["Binary", n.binary],
              ["Octal", n.octal],
              ["Octal dotted", n.octalDotted],
              ["IPv4-mapped IPv6", n.mapped],
              ["Mapped (hex)", n.mappedHex],
              ["Mapped (full)", n.mappedFull],
              ["6to4 prefix", n.sixToFour],
              ["Reverse DNS", n.reverse],
            ]),
            json: { kind: single.kind, ...n },
          };
        }
        const r = L.parseRange(input);
        if (!r.ok) {
          const msg: Record<string, string> = {
            empty: "missing address or range",
            start: "the first address is not valid",
            end: "the last address is not valid",
            order: "the range ends before it starts",
            syntax: 'expected an address, "start - end" or a CIDR block',
          };
          throw new CliError(`${msg[r.error]}: "${input}"`);
        }
        const { formatIPv4 } = await import("../../src/tools/web/cidr/logic");
        const cidrs = L.rangeToCidrs(r.start, r.end);
        const lines = [
          `${formatIPv4(r.start)} - ${formatIPv4(r.end)} (${r.end - r.start + 1} addresses)`,
          "",
          ...cidrs,
        ];
        const json: Record<string, unknown> = {
          start: formatIPv4(r.start),
          end: formatIPv4(r.end),
          total: r.end - r.start + 1,
          cidrs,
        };
        if (ctx.bool("list")) {
          const l = L.listAddresses(r.start, r.end, ctx.num("cap", 256));
          lines.push("", ...l.addresses);
          if (l.truncated) lines.push(`… ${l.total - l.addresses.length} more (raise --cap)`);
          json.addresses = l.addresses;
          json.truncated = l.truncated;
        }
        return { text: lines.join("\n"), json };
      },
    },
    {
      name: "mac-address",
      tool: "mac-address",
      aliases: ["mac"],
      summary:
        "Generate random MAC addresses, or inspect ones (format, unicast/multicast, local, EUI-64).",
      usage:
        "toolbelt mac-address [mac...] | [--count <n>] [--prefix <oui>] [--universal] [--multicast] [--format <f>] [--upper]",
      options: [
        { name: "count", alias: "n", type: "number", desc: "How many to generate.", default: 1 },
        {
          name: "prefix",
          type: "string",
          arg: "<bytes>",
          desc: "Fixed first bytes (an OUI), e.g. 00:1A:2B.",
        },
        {
          name: "universal",
          type: "boolean",
          desc: "Clear the locally-administered bit (default: local).",
        },
        { name: "multicast", type: "boolean", desc: "Set the multicast bit (default: unicast)." },
        {
          name: "format",
          type: "string",
          values: ["colon", "dash", "dot", "none"],
          desc: "Notation.",
          default: "colon",
        },
        { name: "upper", type: "boolean", desc: "Uppercase hex." },
      ],
      examples: [
        { cmd: "toolbelt mac-address --count 3" },
        { cmd: "toolbelt mac-address 00:1A:2B:3C:4D:5E" },
        { cmd: "toolbelt mac-address --prefix 00:1A:2B --format dash --upper" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/mac-address/logic");
        const format = ctx.str("format", "colon") as "colon" | "dash" | "dot" | "none";
        const upper = ctx.bool("upper");
        const input = (await optionalInput(ctx)).trim();
        if (input) {
          const parsed = L.parseMacList(input.split(/[\n,]+|\s{2,}/).join("\n"));
          const rows = parsed.map((p) => {
            if (!p.bytes) return { input: p.line, valid: false as const };
            const info = L.macInfo(p.bytes);
            return {
              input: p.line,
              valid: true as const,
              formatted: L.formatMac(p.bytes, format, upper),
              ...info,
            };
          });
          const text = rows
            .map((r) =>
              r.valid
                ? kv([
                    ["MAC", r.formatted],
                    ["Cast", r.broadcast ? "broadcast" : r.group ? "multicast" : "unicast"],
                    [
                      "Administered",
                      r.local ? "locally (random or assigned)" : "universally (OUI)",
                    ],
                    ["OUI", r.oui],
                    ["NIC", r.nic],
                    ["EUI-64", r.eui64],
                    ["IPv6 link-local", r.linkLocal],
                  ])
                : `${r.input}: not a MAC address`,
            )
            .join("\n\n");
          return {
            text,
            json: rows.length === 1 ? rows[0] : rows,
            code: rows.every((r) => r.valid) ? 0 : 1,
          };
        }
        const prefixText = ctx.str("prefix", "");
        const prefix = L.parsePrefix(prefixText);
        if (!prefix) throw new CliError(`not a MAC prefix (1 to 5 bytes): "${prefixText}"`);
        const count = ctx.num("count", 1);
        if (!Number.isInteger(count) || count < 1 || count > 10000)
          throw new UsageError("--count must be between 1 and 10000");
        const macs = L.randomMacs(
          count,
          { prefix, local: !ctx.bool("universal"), unicast: !ctx.bool("multicast") },
          random,
        ).map((m) => L.formatMac(m, format, upper));
        return { text: macs.join("\n"), json: macs };
      },
    },
    {
      name: "ipv6-ula",
      tool: "ipv6-ula",
      aliases: ["ula"],
      summary:
        "IPv6 Unique Local Address prefix (RFC 4193): generate a random /48, or inspect one, with /64 subnets.",
      usage: "toolbelt ipv6-ula [global-id|address] [--subnets <n>] [--start <n>]",
      options: [
        { name: "subnets", type: "number", desc: "How many /64 subnets to list.", default: 4 },
        { name: "start", type: "number", desc: "First subnet id (0-65535).", default: 0 },
      ],
      examples: [
        { cmd: "toolbelt ipv6-ula", desc: "A new random prefix." },
        { cmd: "toolbelt ipv6-ula fd12:3456:789a::/48 --subnets 8" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/ipv6-ula/logic");
        const input = (await optionalInput(ctx)).trim();
        let id: string;
        let warning: string | null = null;
        if (input) {
          const p = L.parseUla(input);
          if (!p.ok)
            throw new CliError(
              p.error === "not-ula"
                ? `not a unique local address (fc00::/7): "${input}"`
                : `not a Global ID (10 hex digits) or a ULA address: "${input}"`,
            );
          id = p.id;
          if (p.warning === "fc") warning = "fc00::/8 is reserved: ULA prefixes use fd00::/8.";
        } else id = L.randomGlobalId(random);
        const info = L.ulaInfo(id);
        const count = ctx.num("subnets", 4);
        const start = ctx.num("start", 0);
        if (!Number.isInteger(start) || start < 0 || start > 0xffff)
          throw new UsageError("--start must be between 0 and 65535");
        const subs = L.subnets(id, start, Math.max(0, Math.min(count, 65536)));
        const lines = [
          kv([
            ["Prefix", info.prefix],
            ["Global ID", info.globalId],
            ["First", info.first],
            ["Last", info.last],
            ["Example host", L.exampleHost(id, start)],
          ]),
        ];
        if (subs.length) lines.push("", "Subnets /64:", ...subs);
        return {
          text: lines.join("\n"),
          json: { id, ...info, subnets: subs, warning },
          warnings: warning ? [warning] : [],
        };
      },
    },
    {
      name: "random-port",
      tool: "random-port",
      aliases: ["port"],
      summary:
        "Pick random free-looking ports (skipping well-known and common ones), or look up common ports.",
      usage:
        "toolbelt random-port [--count <n>] [--range registered|dynamic|unprivileged] [--min <p> --max <p>] | <port|words>",
      options: [
        { name: "count", alias: "n", type: "number", desc: "How many ports.", default: 1 },
        {
          name: "range",
          type: "string",
          values: ["registered", "dynamic", "unprivileged"],
          desc: "IANA range to pick from (1024-49151, 49152-65535, 1024-65535).",
          default: "registered",
        },
        { name: "min", type: "number", desc: "Custom range start." },
        { name: "max", type: "number", desc: "Custom range end." },
        { name: "allow-common", type: "boolean", desc: "Do not skip the commonly used ports." },
        { name: "allow-well-known", type: "boolean", desc: "Do not skip ports below 1024." },
        {
          name: "avoid-ephemeral",
          type: "boolean",
          desc: "Skip Linux's ephemeral range 32768-60999.",
        },
        {
          name: "proto",
          type: "string",
          values: ["all", "tcp", "udp"],
          desc: "Lookup: protocol.",
          default: "all",
        },
      ],
      examples: [
        { cmd: "toolbelt random-port --count 3" },
        { cmd: "toolbelt random-port 5432", desc: "What usually listens on 5432." },
        { cmd: "toolbelt random-port postgres" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/random-port/logic");
        const q = query(ctx);
        if (q) {
          const list = L.searchPorts(q, ctx.str("proto", "all") as "all" | "tcp" | "udp");
          const json = list.map((p) => ({
            port: p.port,
            proto: p.proto,
            name: p.name,
            description: pick({ en: p.en, fr: p.fr, de: p.de }),
            class: L.portClass(p.port),
          }));
          if (!list.length) return { text: `No common port matches "${q}".`, json, code: 1 };
          return { text: table(json.map((p) => [p.port, p.proto, p.name, p.description])), json };
        }
        const [rmin, rmax] = L.RANGES[ctx.str("range", "registered") as "registered"];
        const min = ctx.num("min", rmin);
        const max = ctx.num("max", rmax);
        if (min > max || min < 0 || max > 65535)
          throw new UsageError("--min/--max must be 0-65535, min ≤ max");
        const count = ctx.num("count", 1);
        if (!Number.isInteger(count) || count < 1)
          throw new UsageError("--count must be a positive integer");
        const ports = L.randomPorts(
          count,
          {
            min,
            max,
            skipWellKnown: !ctx.bool("allow-well-known"),
            skipCommon: !ctx.bool("allow-common"),
            skipEphemeral: ctx.bool("avoid-ephemeral"),
          },
          L.cryptoInt,
        );
        if (!ports.length) throw new CliError("no port left in that range with these filters");
        return { text: ports.join("\n"), json: ports };
      },
    },
    {
      name: "git-cheatsheet",
      tool: "git-cheatsheet",
      aliases: ["git"],
      summary:
        'Find the git command for a task, in plain words ("undo last commit", "rename a branch").',
      usage: "toolbelt git-cheatsheet <what you want to do> [--group <g>] [--danger] [--limit <n>]",
      options: [
        {
          name: "group",
          type: "string",
          values: [
            "setup",
            "commit",
            "inspect",
            "branches",
            "undo",
            "stash",
            "rebase",
            "remote",
            "tags",
            "worktrees",
            "bisect",
            "cleanup",
          ],
          desc: "Only this theme.",
        },
        {
          name: "danger",
          type: "boolean",
          desc: "Only commands that can lose work or rewrite history.",
        },
        {
          name: "limit",
          type: "number",
          desc: "Max tips shown (default 5 for a search, all otherwise).",
        },
      ],
      examples: [
        { cmd: 'toolbelt git-cheatsheet "undo the last commit"' },
        { cmd: "toolbelt git-cheatsheet --group stash" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/git-cheatsheet/logic");
        const q = query(ctx);
        const g = ctx.str("group");
        if (!q && !g && !ctx.bool("danger"))
          throw new UsageError('missing words, e.g. "undo the last commit"');
        const all = L.searchTips(
          q,
          (g ?? "all") as Parameters<typeof L.searchTips>[1],
          ctx.bool("danger"),
        );
        const tips = all.slice(0, ctx.num("limit", q ? 5 : all.length));
        const json = tips.map((t) => ({
          group: t.group,
          task: pick({ en: t.en, fr: t.fr, de: t.de }),
          command: t.cmd,
          note: pick({ en: t.noteEn, fr: t.noteFr, de: t.noteDe }),
          danger: !!t.danger,
        }));
        if (!tips.length) return { text: `No git tip matches "${q}".`, json, code: 1 };
        const text = json
          .map((t) =>
            [
              `# ${t.task}${t.danger ? " (careful: can lose work)" : ""}`,
              t.command,
              ...(t.note ? [`  ${t.note}`] : []),
            ].join("\n"),
          )
          .join("\n\n");
        return { text, json };
      },
    },
    {
      name: "email-normalize",
      tool: "email-normalize",
      aliases: ["email"],
      summary:
        "Validate and normalize email addresses (case, Gmail dots, +tags, IDN), and dedupe a list.",
      usage:
        "toolbelt email-normalize <addresses> [--keep-case] [--no-providers] [--plus-all] [--punycode] [--unique]",
      options: [
        { name: "keep-case", type: "boolean", desc: "Do not lowercase the local part." },
        {
          name: "providers",
          type: "boolean",
          desc: "Provider rules (Gmail dots, +tags at known providers).",
          default: true,
        },
        { name: "plus-all", type: "boolean", desc: "Drop +tags at every domain." },
        { name: "punycode", type: "boolean", desc: "Write domains in punycode (xn--…)." },
        {
          name: "unique",
          alias: "u",
          type: "boolean",
          desc: "Print only the unique valid normalized addresses.",
        },
      ],
      notes:
        "Addresses are separated by new lines, commas or semicolons; Name <addr> and mailto: are accepted. Exits with 1 if any address is invalid.",
      examples: [
        { cmd: 'toolbelt email-normalize "John.Doe+news@GoogleMail.com, jane@exämple.de"' },
        { cmd: "toolbelt email-normalize --file contacts.txt --unique" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/email-normalize/logic");
        const text = await ctx.text({ join: "\n" });
        const opts = {
          lowercase: !ctx.bool("keep-case"),
          providers: ctx.bool("providers", true),
          plusEverywhere: ctx.bool("plus-all"),
        };
        const punycode = ctx.bool("punycode");
        const rows = L.processList(text, opts);
        if (!rows.length) throw new UsageError("missing email addresses");
        const invalid = rows.some((r) => !r.validation.ok);
        const json = rows.map((r) => ({
          input: r.input,
          valid: r.validation.ok,
          issues: r.validation.issues,
          normalized: punycode ? r.ascii : r.normalized,
          changes: r.changes,
          duplicateOf: r.duplicateOf,
        }));
        if (ctx.bool("unique")) {
          const list = L.uniqueAddresses(rows, punycode);
          return { text: list.join("\n"), json: list, code: invalid ? 1 : 0 };
        }
        return {
          text: table(
            json.map((r) => [
              r.input,
              r.valid ? (r.duplicateOf !== null ? "duplicate" : "valid") : "INVALID",
              r.valid ? r.normalized : r.issues.join(", "),
              r.changes.join(", "),
            ]),
            ["INPUT", "STATUS", "NORMALIZED / ISSUES", "CHANGES"],
          ),
          json,
          code: invalid ? 1 : 0,
        };
      },
    },
    {
      name: "http-headers",
      tool: "http-headers",
      aliases: ["headers"],
      summary:
        "HTTP headers reference search, or a security check of raw response headers (curl -I output).",
      usage:
        "toolbelt http-headers <words> [--kind request|response] [--category <c>] | --check [headers]",
      options: [
        {
          name: "check",
          type: "boolean",
          desc: "Check response headers (argument, --file or stdin) against security recommendations.",
        },
        {
          name: "kind",
          type: "string",
          values: ["all", "request", "response"],
          desc: "Reference: only these.",
          default: "all",
        },
        {
          name: "category",
          type: "string",
          values: [
            "security",
            "cors",
            "caching",
            "conditional",
            "content",
            "auth",
            "cookies",
            "connection",
            "context",
            "misc",
          ],
          desc: "Reference: only this category.",
        },
      ],
      notes: "With --check, exits with 1 when a problem (level bad) is found.",
      examples: [
        { cmd: "toolbelt http-headers cache" },
        { cmd: "curl -sI https://example.com | toolbelt http-headers --check" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/http-headers/logic");
        if (ctx.bool("check")) {
          const raw = await ctx.text({ join: "\n" });
          const parsed = L.parseHeaders(raw);
          if (!parsed.map.size) throw new CliError('no "Name: value" header line found');
          const findings = L.checkSecurity(parsed).map((f) => ({
            ...f,
            message: tr(L.findingMessage(f)),
          }));
          const counts = L.tally(findings);
          const order = { bad: 0, warn: 1, info: 2, ok: 3 } as const;
          const sorted = [...findings].sort((a, b) => order[a.level] - order[b.level]);
          const text = [
            `${counts.bad} problem(s), ${counts.warn} warning(s), ${counts.info} note(s), ${counts.ok} good`,
            "",
            ...sorted.map((f) => `[${f.level}] ${f.header}: ${f.message}`),
            ...(parsed.bad.length
              ? ["", `${parsed.bad.length} line(s) ignored (not "name: value").`]
              : []),
          ].join("\n");
          return {
            text,
            json: { status: parsed.status, counts, findings: sorted, ignored: parsed.bad },
            code: counts.bad ? 1 : 0,
          };
        }
        const q = query(ctx);
        const cat = ctx.str("category");
        if (!q && !cat)
          throw new UsageError("missing words to search (or --check to check headers)");
        const list = L.searchHeaders(
          q,
          ctx.str("kind", "all") as "all" | "request" | "response",
          (cat ?? "all") as Parameters<typeof L.searchHeaders>[2],
        );
        const json = list.map((h) => ({
          name: h.name,
          kind: h.kind,
          category: h.cat,
          description: pick({ en: h.en, fr: h.fr, de: h.de }),
          example: h.example,
          deprecated: !!h.deprecated,
        }));
        if (!list.length) return { text: `No header matches "${q}".`, json, code: 1 };
        const text = json
          .map(
            (h) =>
              `${h.name} (${h.kind}, ${h.category}${h.deprecated ? ", deprecated" : ""})\n  ${h.description}\n  e.g. ${h.name}: ${h.example}`,
          )
          .join("\n\n");
        return { text, json };
      },
    },
    {
      name: "curl-convert",
      tool: "curl-convert",
      aliases: ["curl"],
      summary:
        "Convert a curl command to fetch, axios, Python requests, Go, PHP, wget or HTTPie code.",
      usage: "toolbelt curl-convert '<curl command>' [--to <target>]",
      options: [
        {
          name: "to",
          alias: "t",
          type: "string",
          values: ["fetch", "axios", "python", "go", "php", "wget", "httpie"],
          desc: "Target language.",
          default: "fetch",
        },
      ],
      notes:
        "Quote the curl command as one argument, or pass it after -- (each word is re-quoted), with --file, or on stdin. Warnings go to stderr.",
      examples: [
        {
          cmd: `toolbelt curl-convert 'curl -X POST https://api.example.com/items -H "Content-Type: application/json" -d "{\\"a\\":1}"' --to python`,
        },
        { cmd: "toolbelt curl-convert --to go -- curl -L https://example.com" },
      ],
      async run(ctx) {
        const L = await import("../../src/tools/web/curl-convert/logic");
        let cmd: string;
        if (ctx.args.length > 1) {
          const { shellQuote } = await import("../../src/tools/web/_shared");
          cmd = ctx.args.map(shellQuote).join(" ");
        } else cmd = await ctx.text();
        const p = L.parseCurl(cmd);
        if (!p.ok) {
          if (p.error === "empty") throw new UsageError("missing curl command");
          throw new CliError(tr(L.PARSE_ERRORS[p.error]));
        }
        const target = ctx.str("to", "fetch") as (typeof L.TARGETS)[number];
        const out = L.GENERATORS[target](p.request);
        const warnings = [
          ...p.request.warnings.map((w) => tr(L.warningMessage(w))),
          ...out.notes.map((n) => tr(L.NOTE_MESSAGES[n])),
        ];
        return {
          text: out.code,
          json: { target, code: out.code, warnings, request: p.request },
          warnings,
        };
      },
    },
  ],
};
