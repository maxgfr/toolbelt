/** Text tools. Each command imports its tool's logic lazily, so only what runs gets loaded. */
import { kv, table } from "../format";
import { CliError, type CommandGroup, UsageError } from "../types";

export const group: CommandGroup = {
  category: "text",
  commands: [
    {
      name: "counter",
      tool: "counter",
      aliases: ["count", "wc"],
      summary: "Count characters, words, lines, sentences, bytes, tokens and reading time.",
      usage: "toolbelt counter [text] [--top <n>] [--min-length <n>]",
      options: [
        { name: "top", type: "number", desc: "Also list the n most frequent words.", default: 0 },
        {
          name: "min-length",
          type: "number",
          desc: "Ignore words shorter than this in --top.",
          default: 1,
        },
      ],
      examples: [
        { cmd: 'toolbelt counter "Hello world. How are you?"' },
        { cmd: "toolbelt counter --file README.md --top 10 --min-length 4 --json" },
      ],
      async run(ctx) {
        const text = await ctx.text();
        const { textStats, wordFrequency, formatDuration, LIMITS } = await import(
          "../../src/tools/text/counter/logic"
        );
        const s = textStats(text);
        const top = ctx.num("top", 0);
        const freq = top > 0 ? wordFrequency(text, top, ctx.num("min-length", 1)) : [];
        const limits = LIMITS.map((l) => ({
          id: l.id,
          label: l.label,
          max: l.max,
          fits: s.graphemes <= l.max,
        }));
        const lines = [
          kv([
            ["Characters", s.characters],
            ["Graphemes", s.graphemes],
            ["Without spaces", s.noSpaces],
            ["Words", s.words],
            ["Lines", s.lines],
            ["Sentences", s.sentences],
            ["Paragraphs", s.paragraphs],
            ["Bytes (UTF-8)", s.bytes],
            ["Tokens (approx.)", s.tokens],
            ["Reading time", formatDuration(s.readingMinutes)],
            ["Speaking time", formatDuration(s.speakingMinutes)],
          ]),
        ];
        if (freq.length) lines.push("", "Top words:", table(freq.map((f) => [f.count, f.word])));
        return { text: lines.join("\n"), json: { ...s, topWords: freq, limits } };
      },
    },
    {
      name: "diff",
      tool: "diff",
      summary: "Compare two texts or files: unified patch, line summary, or word/character diff.",
      usage:
        "toolbelt diff <old-file> <new-file> [--format unified|lines|words|chars|summary] [--a <text>] [--b <text>]",
      options: [
        {
          name: "format",
          type: "string",
          values: ["unified", "lines", "words", "chars", "summary"],
          desc: "Output: a unified patch, changed lines (- / +), an inline word or character diff ([-old-]{+new+}), or counts.",
          default: "unified",
        },
        {
          name: "a",
          type: "string",
          arg: "<text>",
          desc: "The old text, inline (instead of a file).",
        },
        {
          name: "b",
          type: "string",
          arg: "<text>",
          desc: "The new text, inline (instead of a file).",
        },
        {
          name: "context",
          alias: "U",
          type: "number",
          desc: "Context lines in the patch.",
          default: 3,
        },
        {
          name: "ignore-whitespace",
          alias: "w",
          type: "boolean",
          desc: "Ignore whitespace changes.",
        },
        { name: "ignore-case", alias: "i", type: "boolean", desc: "Ignore case." },
        {
          name: "exit-code",
          type: "boolean",
          desc: "Exit with 1 when the inputs differ (like diff/git diff).",
        },
      ],
      examples: [
        { cmd: "toolbelt diff old.txt new.txt", desc: "A unified patch (git apply compatible)." },
        { cmd: 'toolbelt diff --a "the quick fox" --b "the slow fox" --format words' },
        { cmd: "toolbelt diff a.json b.json --format summary --json" },
      ],
      async run(ctx) {
        const files = [...ctx.args];
        const side = async (inline: string | undefined, name: string) => {
          if (inline !== undefined) return { text: inline, name };
          const f = files.shift();
          return f === undefined ? undefined : { text: await ctx.readTextFile(f), name: f };
        };
        const A = await side(ctx.str("a"), "a");
        const B = await side(ctx.str("b"), "b");
        if (!A || !B)
          throw new UsageError("diff needs two inputs: two files, or --a <text> --b <text>");
        if (files.length)
          throw new UsageError(`unexpected argument "${files[0]}" (diff takes two inputs)`);
        const a = A.text;
        const b = B.text;
        const { lineRows, summarize, inlineDiff, unifiedPatch } = await import(
          "../../src/tools/text/diff/logic"
        );
        const o = {
          ignoreWhitespace: ctx.bool("ignore-whitespace"),
          ignoreCase: ctx.bool("ignore-case"),
        };
        const rows = lineRows(a, b, o);
        const sum = summarize(rows);
        const differs = sum.added + sum.removed + sum.changed > 0;
        const code = ctx.bool("exit-code") && differs ? 1 : 0;
        const format = ctx.str("format", "unified");
        if (format === "words" || format === "chars") {
          const parts = inlineDiff(a, b, format === "words" ? "word" : "char", o);
          const text = parts
            .map((p) =>
              p.kind === "add" ? `{+${p.text}+}` : p.kind === "del" ? `[-${p.text}-]` : p.text,
            )
            .join("");
          return { text, json: { identical: !differs, parts }, code };
        }
        if (format === "summary")
          return {
            text: differs
              ? kv([
                  ["Added lines", sum.added],
                  ["Removed lines", sum.removed],
                  ["Changed lines", sum.changed],
                  ["Unchanged lines", sum.same],
                ])
              : "The inputs are identical.",
            json: { identical: !differs, ...sum },
            code,
          };
        if (format === "lines") {
          const text = rows
            .flatMap((r) => {
              const l = r.left?.pieces.map((p) => p.text).join("") ?? "";
              const rr = r.right?.pieces.map((p) => p.text).join("") ?? "";
              if (r.kind === "same") return [`  ${l}`];
              if (r.kind === "del") return [`- ${l}`];
              if (r.kind === "add") return [`+ ${rr}`];
              return [`- ${l}`, `+ ${rr}`];
            })
            .join("\n");
          return { text, json: { identical: !differs, summary: sum, rows }, code };
        }
        const patch = differs ? unifiedPatch(a, b, A.name, B.name, ctx.num("context", 3)) : "";
        return {
          text: differs ? patch : "The inputs are identical.",
          json: { identical: !differs, summary: sum, patch },
          code,
        };
      },
    },
    {
      name: "case",
      tool: "case",
      summary:
        "Convert case: camel, pascal, snake, kebab, constant, dot, path, train, title, sentence, lower, upper.",
      usage: "toolbelt case [text] [--to <case>]",
      options: [
        {
          name: "to",
          alias: "t",
          type: "string",
          arg: "<case>",
          values: [
            "camel",
            "pascal",
            "snake",
            "kebab",
            "constant",
            "dot",
            "path",
            "train",
            "title",
            "sentence",
            "lower",
            "upper",
            "alternating",
          ],
          desc: "The case to convert to (without it: every case).",
        },
      ],
      examples: [
        { cmd: 'toolbelt case "XMLHttpRequest handler" --to snake' },
        { cmd: 'toolbelt case "hello world"', desc: "Every case at once." },
      ],
      async run(ctx) {
        const text = await ctx.text();
        const { convertCase, CASES } = await import("../../src/tools/text/case/logic");
        const to = ctx.str("to") as (typeof CASES)[number] | undefined;
        if (to)
          return { text: convertCase(text, to), json: { case: to, result: convertCase(text, to) } };
        const all = Object.fromEntries(CASES.map((c) => [c, convertCase(text, c)]));
        return { text: table(CASES.map((c) => [c, all[c] ?? ""])), json: all };
      },
    },
    {
      name: "ascii-art",
      tool: "ascii-art",
      aliases: ["figlet"],
      summary: "Draw text as a FIGlet ASCII-art banner, optionally in a box frame.",
      usage:
        "toolbelt ascii-art [text] [--font <font>] [--width <n>] [--align left|center|right] [--frame] [--style <style>]",
      options: [
        {
          name: "font",
          type: "string",
          values: ["standard", "small", "big", "slant", "banner3"],
          desc: "FIGlet font.",
          default: "standard",
        },
        {
          name: "layout",
          type: "string",
          values: ["font", "full", "fit", "smush"],
          desc: "Letter spacing: the font's own, full width, fitted, or smushed.",
          default: "font",
        },
        {
          name: "width",
          type: "number",
          desc: "Wrap at this many columns (0: no wrap).",
          default: 80,
        },
        {
          name: "align",
          type: "string",
          values: ["left", "center", "right"],
          desc: "Alignment of the lines.",
          default: "left",
        },
        { name: "no-banner", type: "boolean", desc: "Keep the text as is (only frame it)." },
        { name: "frame", type: "boolean", desc: "Draw a box around the result." },
        {
          name: "style",
          type: "string",
          values: ["single", "double", "rounded", "heavy", "ascii", "stars", "hash"],
          desc: "Frame style.",
          default: "single",
        },
        {
          name: "pad-x",
          type: "number",
          desc: "Spaces left and right inside the frame.",
          default: 1,
        },
        {
          name: "pad-y",
          type: "number",
          desc: "Empty lines above and below inside the frame.",
          default: 0,
        },
      ],
      examples: [
        { cmd: 'toolbelt ascii-art "Hello"' },
        { cmd: 'toolbelt ascii-art "Deploy done" --font small --frame --style rounded' },
        { cmd: 'toolbelt ascii-art "Note" --no-banner --frame --style double' },
      ],
      async run(ctx) {
        const text = await ctx.text();
        const { banner, box, parseFont } = await import("../../src/tools/text/ascii-art/logic");
        const { FONTS } = await import("../../src/tools/text/ascii-art/fonts");
        const align = ctx.str("align", "left") as "left" | "center" | "right";
        let out = text;
        if (!ctx.bool("no-banner"))
          out = banner(text, parseFont(FONTS[ctx.str("font", "standard") as keyof typeof FONTS]), {
            layout: ctx.str("layout", "font") as "font" | "full" | "fit" | "smush",
            width: Math.max(0, Math.round(ctx.num("width", 80))),
            align,
          });
        if (out.trim() === "") throw new CliError("nothing to draw: the text is empty");
        if (ctx.bool("frame"))
          out = box(out, {
            style: ctx.str("style", "single") as "single",
            padX: Math.max(0, Math.round(ctx.num("pad-x", 1))),
            padY: Math.max(0, Math.round(ctx.num("pad-y", 0))),
            align,
          });
        return { text: out, json: { result: out } };
      },
    },
    {
      name: "cipher",
      tool: "cipher",
      aliases: ["rot13"],
      summary: "ROT13, ROT47, Caesar and Atbash ciphers, with a Caesar brute force.",
      usage:
        "toolbelt cipher [text] [--cipher rot13|rot47|caesar|atbash] [--shift <n>] [--decode] [--brute-force]",
      options: [
        {
          name: "cipher",
          alias: "c",
          type: "string",
          values: ["rot13", "rot47", "caesar", "atbash"],
          desc: "The cipher.",
          default: "rot13",
        },
        { name: "shift", type: "number", desc: "Caesar shift.", default: 3 },
        { name: "decode", alias: "d", type: "boolean", desc: "Decode instead of encode." },
        {
          name: "brute-force",
          type: "boolean",
          desc: "Try the 25 Caesar shifts, the most readable first.",
        },
      ],
      examples: [
        { cmd: 'toolbelt cipher "Hello"', desc: "ROT13: Uryyb." },
        { cmd: 'toolbelt cipher "Khoor" --cipher caesar --shift 3 --decode' },
        { cmd: 'toolbelt cipher "Wkh fdw vdw" --brute-force' },
      ],
      async run(ctx) {
        const text = await ctx.text();
        const { applyCipher, bruteForce } = await import("../../src/tools/text/cipher/logic");
        if (ctx.bool("brute-force")) {
          const all = bruteForce(text.slice(0, 2000));
          return {
            text: table(
              all.map((r) => [r.shift, r.score, r.text]),
              ["SHIFT", "SCORE", "TEXT"],
            ),
            json: all,
          };
        }
        const cipher = ctx.str("cipher", "rot13") as "rot13" | "rot47" | "caesar" | "atbash";
        const shift = ctx.num("shift", 3);
        if (!Number.isInteger(shift))
          throw new CliError(`--shift must be a whole number, got ${shift}`);
        const out = applyCipher(text, cipher, shift, ctx.bool("decode"));
        return { text: out, json: { cipher, shift, decode: ctx.bool("decode"), result: out } };
      },
    },
    {
      name: "columns",
      tool: "columns",
      aliases: ["cut"],
      summary: "Extract or reorder columns of delimited text (CSV, TSV, pipes, spaces).",
      usage:
        "toolbelt columns [text] [--columns <spec>] [--delimiter auto|comma|tab|semicolon|pipe|spaces|<chars>] [--out-delimiter <d>]",
      options: [
        {
          name: "columns",
          alias: "c",
          type: "string",
          arg: "<spec>",
          desc: 'Columns to keep, 1-based, in order: "1,3", "2-4", "3-" , "4-1" (reversed). Default: all.',
        },
        {
          name: "delimiter",
          alias: "d",
          type: "string",
          arg: "<d>",
          desc: "Input delimiter: auto, comma, tab, semicolon, pipe, spaces, or any characters.",
          default: "auto",
        },
        {
          name: "out-delimiter",
          type: "string",
          arg: "<d>",
          desc: "Output delimiter: same, comma, tab, semicolon, pipe, space, or any characters.",
          default: "same",
        },
        { name: "no-quotes", type: "boolean", desc: 'Treat " as a plain character.' },
        { name: "no-trim", type: "boolean", desc: "Keep spaces around fields." },
      ],
      examples: [
        { cmd: "toolbelt columns --file data.csv --columns 1,3", desc: "Columns 1 and 3." },
        { cmd: "ps aux | toolbelt columns --delimiter spaces --columns 2,11-" },
        { cmd: "toolbelt columns --file data.tsv --columns 3-1 --out-delimiter comma" },
      ],
      async run(ctx) {
        const text = await ctx.text();
        const { delimiterString, detectDelimiter, extract, parse, parseSpec, resolveSpec } =
          await import("../../src/tools/text/columns/logic");
        const NAMED = ["comma", "tab", "semicolon", "pipe", "spaces"] as const;
        type Named = (typeof NAMED)[number];
        const d = ctx.str("delimiter", "auto");
        const named = (NAMED as readonly string[]).includes(d) ? (d as Named) : null;
        const actual = d === "auto" ? detectDelimiter(text) : (named ?? "custom");
        if (actual === "custom" && d === "") throw new UsageError("--delimiter cannot be empty");
        const sep = delimiterString(actual, d);
        const quotes = !ctx.bool("no-quotes");
        const rows = parse(text, sep, quotes);
        const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
        const spec = parseSpec(ctx.str("columns", ""));
        if (!spec.ok)
          throw new CliError(`invalid column spec "${spec.token}" (use e.g. 1,3 or 2-4 or 3-)`);
        const cols = resolveSpec(spec.items, width);
        const o = ctx.str("out-delimiter", "same");
        const OUT: Record<string, string> = {
          comma: ",",
          tab: "\t",
          semicolon: ";",
          pipe: "|",
          space: " ",
        };
        const outSep = o === "same" ? (sep === "spaces" ? " " : sep) : (OUT[o] ?? o);
        const out = extract(rows, cols, outSep, { trim: !ctx.bool("no-trim"), quote: quotes });
        return {
          text: out,
          json: { delimiter: actual, columns: cols.map((c) => c + 1), width, result: out },
        };
      },
    },
    {
      name: "emoji",
      tool: "emoji",
      summary: "Search emojis by name or keyword (English, French, German), with code points.",
      usage: "toolbelt emoji <words> [--tone 0-5] [--limit <n>] [--group <group>]",
      options: [
        {
          name: "tone",
          type: "number",
          desc: "Skin tone: 0 default, 1 light … 5 dark.",
          default: 0,
        },
        {
          name: "limit",
          alias: "n",
          type: "number",
          desc: "At most this many results.",
          default: 20,
        },
        {
          name: "group",
          alias: "g",
          type: "string",
          values: [
            "smileys",
            "people",
            "animals",
            "food",
            "travel",
            "activities",
            "objects",
            "symbols",
            "flags",
          ],
          desc: "Only this group (alone: list the group).",
        },
      ],
      examples: [
        { cmd: "toolbelt emoji rocket" },
        { cmd: "toolbelt emoji thumbs up --tone 3 --limit 1" },
        { cmd: "toolbelt emoji --group flags --limit 300 --json" },
      ],
      async run(ctx) {
        const q = ctx.args.join(" ").trim();
        const g = ctx.str("group");
        if (!q && !g) throw new UsageError("missing search words, e.g. toolbelt emoji rocket");
        const tone = ctx.num("tone", 0);
        if (!Number.isInteger(tone) || tone < 0 || tone > 5)
          throw new UsageError("--tone must be 0 to 5");
        const limit = Math.max(1, Math.floor(ctx.num("limit", 20)));
        const { EMOJI_DATA } = await import("../../src/tools/text/emoji/data");
        const { buildIndex, codePoints, parseCatalog, search, shortcode, withTone } = await import(
          "../../src/tools/text/emoji/logic"
        );
        const groups = parseCatalog(EMOJI_DATA);
        let found = q
          ? search(buildIndex(groups), q, 5000)
          : groups.flatMap((x) => (x.id === g ? x.items : []));
        if (g) found = found.filter((e) => e.group === g);
        found = found.slice(0, limit);
        if (!found.length) return { text: `No emoji matches "${q}".`, json: [], code: 1 };
        const rows = found.map((e) => {
          const emoji = e.tones ? withTone(e.e, tone) : e.e;
          return {
            emoji,
            name: e[ctx.lang],
            shortcode: shortcode(e.en),
            codePoints: codePoints(emoji),
            group: e.group,
          };
        });
        return {
          text: table(rows.map((r) => [r.emoji, r.name, r.shortcode, r.codePoints])),
          json: rows,
        };
      },
    },
    {
      name: "escape",
      tool: "escape",
      summary:
        "Escape or unescape a string for JSON, JavaScript, HTML, XML, SQL, CSV, regex or shell.",
      usage: "toolbelt escape [text] [--format <format>] [--unescape] [--ascii]",
      options: [
        {
          name: "format",
          alias: "t",
          type: "string",
          values: ["json", "js", "html", "xml", "sql", "csv", "regex", "shell"],
          desc: "The syntax to escape for.",
          default: "json",
        },
        { name: "unescape", alias: "u", type: "boolean", desc: "Unescape instead of escape." },
        {
          name: "ascii",
          type: "boolean",
          desc: "js/html/xml: escape every non-ASCII character too.",
        },
      ],
      examples: [
        { cmd: "toolbelt escape 'He said \"hi\"' --format json" },
        { cmd: 'toolbelt escape "it\'s" --format shell' },
        { cmd: "toolbelt escape '&lt;b&gt;' --format html --unescape" },
      ],
      async run(ctx) {
        const text = await ctx.text();
        const { escapeAs, unescapeAs } = await import("../../src/tools/text/escape/logic");
        type Format = Parameters<typeof escapeAs>[0];
        const format = ctx.str("format", "json") as Format;
        if (!ctx.bool("unescape")) {
          const out = escapeAs(format, text, { asciiOnly: ctx.bool("ascii") });
          return { text: out, json: { format, result: out } };
        }
        const r = unescapeAs(format, text);
        if (!r.ok) {
          const MESSAGES: Record<typeof r.code, string> = {
            "trailing-backslash": "the text ends with a lone backslash",
            "bad-escape": `invalid escape sequence: ${r.detail}`,
            unterminated: `a ${r.detail} quote is never closed`,
            "stray-quote": 'a quote inside the field is not doubled ("")',
            json: `invalid JSON string: ${r.detail}`,
          };
          throw new CliError(MESSAGES[r.code]);
        }
        return { text: r.value, json: { format, result: r.value } };
      },
    },
    {
      name: "extract",
      tool: "extract",
      summary:
        "Extract emails, URLs, domains, IPs, phone numbers, hashtags, mentions, numbers, dates, colors, card numbers.",
      usage: "toolbelt extract [text] [--kind <kind> ...] [--sort] [--no-dedupe] [--csv]",
      options: [
        {
          name: "kind",
          alias: "k",
          type: "list",
          values: [
            "email",
            "url",
            "domain",
            "ipv4",
            "ipv6",
            "phone",
            "hashtag",
            "mention",
            "number",
            "date",
            "color",
            "card",
          ],
          desc: "What to extract (repeatable). Default: everything.",
        },
        { name: "sort", type: "boolean", desc: "Sort each list." },
        { name: "no-dedupe", type: "boolean", desc: "Keep duplicates." },
        { name: "csv", type: "boolean", desc: "Output CSV (kind,value)." },
      ],
      notes: "Exits with 1 when nothing is found.",
      examples: [
        { cmd: "toolbelt extract --file page.html --kind email" },
        { cmd: "toolbelt extract --file log.txt --kind ipv4 --kind url --sort --json" },
      ],
      async run(ctx) {
        const text = await ctx.text();
        const { extractAll, KINDS, toCsv } = await import("../../src/tools/text/extract/logic");
        type Kind = (typeof KINDS)[number];
        const asked = ctx.list("kind") as Kind[];
        const kinds = asked.length ? KINDS.filter((k) => asked.includes(k)) : [...KINDS];
        const res = extractAll(text, kinds, {
          dedupe: !ctx.bool("no-dedupe"),
          sort: ctx.bool("sort"),
        });
        const found = Object.fromEntries(
          kinds.filter((k) => res[k]?.length).map((k) => [k, res[k]]),
        );
        const total = Object.values(found).reduce((n, l) => n + l.length, 0);
        if (!total) return { text: "Nothing found.", json: {}, code: 1 };
        if (ctx.bool("csv")) return { text: toCsv(found), json: found };
        const single = kinds.length === 1;
        const text2 = Object.entries(found)
          .map(([k, l]) => (single ? l.join("\n") : `${k}:\n${l.map((v) => `  ${v}`).join("\n")}`))
          .join("\n");
        return { text: text2, json: found };
      },
    },
    {
      name: "html-to-markdown",
      tool: "html-to-markdown",
      aliases: ["html2md"],
      summary: "Convert HTML to Markdown (GitHub tables, strikethrough and task lists included).",
      usage:
        "toolbelt html-to-markdown [html] [--heading atx|setext] [--bullet -|*|+] [--code backticks|tildes|indented] [--no-gfm]",
      options: [
        {
          name: "heading",
          type: "string",
          values: ["atx", "setext"],
          desc: "Heading style (# or underlined).",
          default: "atx",
        },
        {
          name: "bullet",
          type: "string",
          values: ["-", "*", "+"],
          desc: "List bullet.",
          default: "-",
        },
        {
          name: "code",
          type: "string",
          values: ["backticks", "tildes", "indented"],
          desc: "Code block style.",
          default: "backticks",
        },
        {
          name: "em",
          type: "string",
          values: ["_", "*"],
          desc: "Emphasis delimiter.",
          default: "_",
        },
        {
          name: "links",
          type: "string",
          values: ["inlined", "referenced"],
          desc: "Inline links or reference links at the end.",
          default: "inlined",
        },
        {
          name: "no-gfm",
          type: "boolean",
          desc: "Plain Markdown (no tables, strikethrough, task lists).",
        },
      ],
      examples: [
        { cmd: "toolbelt html-to-markdown '<h1>Title</h1><p>Some <b>bold</b> text</p>'" },
        { cmd: "toolbelt html-to-markdown --file page.html --out page.md" },
      ],
      async run(ctx) {
        const html = await ctx.text();
        const { htmlToMarkdown } = await import("../../src/tools/text/html-to-markdown/logic");
        const code = ctx.str("code", "backticks");
        const md = htmlToMarkdown(html, {
          headingStyle: ctx.str("heading", "atx") as "atx" | "setext",
          bullet: ctx.str("bullet", "-") as "-" | "*" | "+",
          codeBlockStyle: code === "indented" ? "indented" : "fenced",
          fence: code === "tildes" ? "~~~" : "```",
          emDelimiter: ctx.str("em", "_") as "_" | "*",
          linkStyle: ctx.str("links", "inlined") as "inlined" | "referenced",
          gfm: !ctx.bool("no-gfm"),
        });
        return { text: md, json: { markdown: md } };
      },
    },
    {
      name: "lines",
      tool: "lines",
      summary: "Sort, dedupe, trim, reverse, shuffle, number, prefix or suffix lines.",
      usage:
        "toolbelt lines [text] [--sort az|za|natural|length] [--dedupe] [--trim] [--remove-empty] [--reverse] [--shuffle] [--number]",
      options: [
        { name: "trim", type: "boolean", desc: "Trim spaces around each line." },
        { name: "remove-empty", type: "boolean", desc: "Remove empty lines." },
        {
          name: "dedupe",
          alias: "u",
          type: "boolean",
          desc: "Remove duplicate lines (first kept).",
        },
        {
          name: "sort",
          alias: "s",
          type: "string",
          values: ["none", "az", "za", "natural", "length"],
          desc: "Sort order.",
          default: "none",
        },
        { name: "ignore-case", alias: "i", type: "boolean", desc: "Dedupe ignoring case." },
        { name: "case-sensitive", type: "boolean", desc: "Sort with case (default: ignore case)." },
        { name: "reverse", alias: "r", type: "boolean", desc: "Reverse the order." },
        { name: "shuffle", type: "boolean", desc: "Shuffle (seeded)." },
        { name: "seed", type: "number", desc: "Shuffle seed.", default: 1 },
        { name: "number", alias: "n", type: "boolean", desc: "Number the lines." },
        { name: "number-start", type: "number", desc: "First number.", default: 1 },
        {
          name: "number-sep",
          type: "string",
          arg: "<text>",
          desc: "Text after the number.",
          default: '". "',
        },
        { name: "prefix", type: "string", arg: "<text>", desc: "Add before each line." },
        { name: "suffix", type: "string", arg: "<text>", desc: "Add after each line." },
      ],
      notes:
        "Steps run in a fixed order: trim, remove empty, dedupe, sort, reverse, shuffle, number, prefix/suffix.",
      examples: [
        { cmd: "toolbelt lines --file names.txt --sort natural --dedupe" },
        { cmd: "toolbelt lines --file list.txt --trim --remove-empty --number" },
        { cmd: 'toolbelt lines --file ids.txt --prefix "\'" --suffix "\',"' },
      ],
      async run(ctx) {
        const text = await ctx.text();
        const { DEFAULTS, processLines } = await import("../../src/tools/text/lines/logic");
        const out = processLines(text, {
          ...DEFAULTS,
          trim: ctx.bool("trim"),
          removeEmpty: ctx.bool("remove-empty"),
          dedupe: ctx.bool("dedupe"),
          dedupeIgnoreCase: ctx.bool("ignore-case"),
          sort: ctx.str("sort", "none") as typeof DEFAULTS.sort,
          sortIgnoreCase: !ctx.bool("case-sensitive"),
          reverse: ctx.bool("reverse"),
          shuffle: ctx.bool("shuffle"),
          seed: ctx.num("seed", 1),
          number: ctx.bool("number"),
          numberStart: ctx.num("number-start", 1),
          numberSep: ctx.str("number-sep", ". "),
          prefix: ctx.str("prefix", ""),
          suffix: ctx.str("suffix", ""),
        });
        return { text: out.join("\n"), json: out };
      },
    },
    {
      name: "list-compare",
      tool: "list-compare",
      summary: "Compare two lists: items only in A, only in B, in both, and the union.",
      usage:
        "toolbelt list-compare <file-a> <file-b> [--a <text>] [--b <text>] [--show <part>] [--ignore-case]",
      options: [
        { name: "a", type: "string", arg: "<text>", desc: "List A inline (one item per line)." },
        { name: "b", type: "string", arg: "<text>", desc: "List B inline." },
        {
          name: "show",
          type: "string",
          values: ["all", "only-a", "only-b", "both", "union"],
          desc: "Which result to print.",
          default: "all",
        },
        { name: "ignore-case", alias: "i", type: "boolean", desc: "Compare ignoring case." },
        { name: "commas", type: "boolean", desc: "Also split items on commas and semicolons." },
        { name: "no-trim", type: "boolean", desc: "Keep spaces around items." },
        { name: "sort", type: "boolean", desc: "Sort the results." },
      ],
      examples: [
        { cmd: "toolbelt list-compare before.txt after.txt" },
        { cmd: "toolbelt list-compare --a $'a\\nb\\nc' --b $'b\\nc\\nd' --show only-a" },
        { cmd: 'toolbelt list-compare --a "x, y" --b "y, z" --commas --json' },
      ],
      async run(ctx) {
        const files = [...ctx.args];
        const side = async (inline: string | undefined) => {
          if (inline !== undefined) return inline;
          const f = files.shift();
          return f === undefined ? undefined : ctx.readTextFile(f);
        };
        const a = await side(ctx.str("a"));
        const b = await side(ctx.str("b"));
        if (a === undefined || b === undefined)
          throw new UsageError("list-compare needs two lists: two files, or --a <text> --b <text>");
        if (files.length)
          throw new UsageError(`unexpected argument "${files[0]}" (two lists expected)`);
        const { compareLists } = await import("../../src/tools/text/list-compare/logic");
        const c = compareLists(a, b, {
          trim: !ctx.bool("no-trim"),
          ignoreCase: ctx.bool("ignore-case"),
          splitCommas: ctx.bool("commas"),
          sort: ctx.bool("sort"),
        });
        const parts = { "only-a": c.onlyA, "only-b": c.onlyB, both: c.both, union: c.union };
        const show = ctx.str("show", "all");
        const json = { onlyA: c.onlyA, onlyB: c.onlyB, both: c.both, union: c.union };
        if (show !== "all") return { text: parts[show as keyof typeof parts].join("\n"), json };
        const section = (title: string, l: string[]) =>
          `${title} (${l.length}):${l.length ? `\n${l.map((x) => `  ${x}`).join("\n")}` : ""}`;
        return {
          text: [
            section("Only in A", c.onlyA),
            section("Only in B", c.onlyB),
            section("In both", c.both),
          ].join("\n"),
          json,
        };
      },
    },
    {
      name: "lorem",
      tool: "lorem",
      aliases: ["lipsum"],
      summary: "Generate lorem ipsum placeholder text (paragraphs, sentences or words; seeded).",
      usage: "toolbelt lorem [count] [--unit paragraphs|sentences|words] [--html] [--seed <n>]",
      options: [
        {
          name: "unit",
          type: "string",
          values: ["paragraphs", "sentences", "words"],
          desc: "What to count.",
          default: "paragraphs",
        },
        {
          name: "count",
          alias: "n",
          type: "number",
          desc: "How many (also as the argument).",
          default: 3,
        },
        { name: "html", type: "boolean", desc: "Wrap paragraphs in <p>." },
        {
          name: "no-lorem",
          type: "boolean",
          desc: 'Do not start with "Lorem ipsum dolor sit amet".',
        },
        { name: "seed", type: "number", desc: "Random seed (same seed, same text).", default: 1 },
      ],
      examples: [
        { cmd: "toolbelt lorem" },
        { cmd: "toolbelt lorem 50 --unit words" },
        { cmd: "toolbelt lorem 2 --html --seed 7" },
      ],
      async run(ctx) {
        const { lorem, MAX } = await import("../../src/tools/text/lorem/logic");
        if (ctx.args.length > 1) throw new UsageError(`unexpected argument "${ctx.args[1]}"`);
        const raw = ctx.args[0];
        const count = raw !== undefined ? Number(raw) : ctx.num("count", 3);
        if (!Number.isInteger(count))
          throw new UsageError(`the count must be a whole number, got "${raw}"`);
        const unit = ctx.str("unit", "paragraphs") as keyof typeof MAX;
        if (count < 1 || count > MAX[unit])
          throw new CliError(`the count must be between 1 and ${MAX[unit]} ${unit}`);
        const out = lorem({
          unit,
          count,
          startWithLorem: !ctx.bool("no-lorem"),
          html: ctx.bool("html"),
          seed: ctx.num("seed", 1),
        });
        return { text: out, json: { result: out } };
      },
    },
    {
      name: "markdown",
      tool: "markdown",
      aliases: ["md"],
      summary: "Render Markdown to HTML, or list its headings / table of contents.",
      usage: "toolbelt markdown [text] [--toc] [--headings] [--no-gfm] [--breaks]",
      options: [
        { name: "toc", type: "boolean", desc: "Print a Markdown table of contents instead." },
        {
          name: "headings",
          type: "boolean",
          desc: "List the headings (depth, text, anchor slug).",
        },
        {
          name: "no-gfm",
          type: "boolean",
          desc: "Plain CommonMark (no GitHub tables, task lists…).",
        },
        { name: "breaks", type: "boolean", desc: "Single line breaks become <br>." },
      ],
      notes:
        "The HTML is not sanitized (the site sanitizes it in the browser): do not serve untrusted input as is.",
      examples: [
        { cmd: "toolbelt markdown --file README.md --out README.html" },
        { cmd: "toolbelt markdown --file README.md --toc" },
      ],
      async run(ctx) {
        const md = await ctx.text();
        const { headings, renderMarkdown, tableOfContents } = await import(
          "../../src/tools/text/markdown/logic"
        );
        if (ctx.bool("headings")) {
          const hs = headings(md);
          return {
            text: hs.map((h) => `${"  ".repeat(h.depth - 1)}${h.text}  #${h.slug}`).join("\n"),
            json: hs,
          };
        }
        if (ctx.bool("toc")) {
          const toc = tableOfContents(md);
          if (!toc.trim())
            return { text: "No headings in this document.", json: { toc: "" }, code: 1 };
          return { text: toc, json: { toc } };
        }
        const html = renderMarkdown(md, { gfm: !ctx.bool("no-gfm"), breaks: ctx.bool("breaks") });
        return { text: html, json: { html } };
      },
    },
    {
      name: "morse",
      tool: "morse",
      summary: "Translate text to Morse code and back (direction detected automatically).",
      usage: "toolbelt morse [text] [--mode auto|encode|decode]",
      options: [
        {
          name: "mode",
          alias: "m",
          type: "string",
          values: ["auto", "encode", "decode"],
          desc: "Direction (auto: Morse input is decoded).",
          default: "auto",
        },
      ],
      examples: [
        { cmd: 'toolbelt morse "SOS"', desc: "... --- ..." },
        { cmd: 'toolbelt morse "... --- ..."', desc: "SOS" },
      ],
      async run(ctx) {
        const input = await ctx.text();
        const { decode, encode, looksLikeMorse } = await import("../../src/tools/text/morse/logic");
        const mode = ctx.str("mode", "auto");
        const decoding = mode === "auto" ? looksLikeMorse(input) : mode === "decode";
        const r = decoding ? decode(input) : null;
        const e = decoding ? null : encode(input);
        const output = r ? r.text : (e?.morse ?? "");
        const unknown = r ? r.unknown : (e?.unknown ?? []);
        if (!output.trim() && unknown.length)
          throw new CliError(
            decoding
              ? `no valid Morse code in the input (unknown: ${unknown.join(" ")})`
              : `nothing to translate: no Morse code for ${unknown.join(" ")}`,
          );
        return {
          text: output,
          json: { mode: decoding ? "decode" : "encode", result: output, unknown },
        };
      },
    },
    {
      name: "nato",
      tool: "nato",
      aliases: ["spell"],
      summary: "Spell text with a spelling alphabet (NATO, French, German DIN 5009).",
      usage: "toolbelt nato [text] [--alphabet nato|fr|de|deNames] [--mark-case] [--table]",
      options: [
        {
          name: "alphabet",
          alias: "a",
          type: "string",
          values: ["nato", "fr", "de", "deNames"],
          desc: "Spelling alphabet (default: nato, or the --lang one).",
        },
        { name: "mark-case", type: "boolean", desc: "Mark upper and lower case letters." },
        { name: "table", type: "boolean", desc: "Print the whole alphabet." },
      ],
      examples: [
        { cmd: 'toolbelt nato "AB12"', desc: "Alfa Bravo One Two" },
        { cmd: "toolbelt nato --table --alphabet de" },
      ],
      async run(ctx) {
        const { alphabetTable, spell, spellText } = await import("../../src/tools/text/nato/logic");
        const alphabet = (ctx.str("alphabet") ?? { en: "nato", fr: "fr", de: "de" }[ctx.lang]) as
          | "nato"
          | "fr"
          | "de"
          | "deNames";
        if (ctx.bool("table")) {
          const t = alphabetTable(alphabet);
          return { text: table(t.map((r) => [r.char, r.word])), json: t };
        }
        const items = spell(await ctx.text(), alphabet, ctx.bool("mark-case"));
        const out = spellText(items);
        if (!out.trim()) throw new CliError("nothing to spell");
        return { text: out, json: { alphabet, result: out, items } };
      },
    },
    {
      name: "numeronym",
      tool: "numeronym",
      summary: "Make numeronyms (internationalization → i18n), or expand known ones (a11y, k8s…).",
      usage: "toolbelt numeronym [text] [--min-length <n>] [--lowercase] [--expand]",
      options: [
        {
          name: "min-length",
          type: "number",
          desc: "Leave shorter words as they are.",
          default: 4,
        },
        { name: "lowercase", type: "boolean", desc: "Lowercase the result." },
        {
          name: "expand",
          alias: "x",
          type: "boolean",
          desc: "Look up the numeronyms in the text instead.",
        },
      ],
      examples: [
        { cmd: 'toolbelt numeronym "internationalization localization"', desc: "i18n l10n" },
        { cmd: 'toolbelt numeronym "a11y and k8s" --expand' },
      ],
      async run(ctx) {
        const text = await ctx.text();
        const { lookupAll, numeronymize } = await import("../../src/tools/text/numeronym/logic");
        if (ctx.bool("expand")) {
          const found = lookupAll(text);
          if (!found.length) return { text: "No numeronym found.", json: [], code: 1 };
          return {
            text: found
              .map(
                (f) =>
                  `${f.token}: ${f.matches.length ? f.matches.map((m) => m.word).join(", ") : "(unknown)"}`,
              )
              .join("\n"),
            json: found,
          };
        }
        const min = ctx.num("min-length", 4);
        if (!Number.isInteger(min) || min < 3)
          throw new UsageError("--min-length must be a whole number ≥ 3");
        const out = numeronymize(text, { minLength: min, lowercase: ctx.bool("lowercase") });
        return { text: out, json: { result: out } };
      },
    },
    {
      name: "readability",
      tool: "readability",
      summary:
        "Readability scores (Flesch, Flesch-Kincaid, Fog, SMOG, Coleman-Liau, ARI, LIX…) in English, French or German.",
      usage: "toolbelt readability [text] [--language auto|en|fr|de] [--long-from <words>]",
      options: [
        {
          name: "language",
          type: "string",
          values: ["auto", "en", "fr", "de"],
          desc: "The text's language (auto-detected by default).",
          default: "auto",
        },
        {
          name: "long-from",
          type: "number",
          desc: "Count sentences of at least this many words as long.",
          default: 25,
        },
      ],
      examples: [
        { cmd: "toolbelt readability --file article.md" },
        { cmd: "toolbelt readability --file texte.txt --language fr --json" },
      ],
      async run(ctx) {
        const text = await ctx.text();
        const { analyze, detectLang, SCORE_NAMES } = await import(
          "../../src/tools/text/readability/logic"
        );
        const asked = ctx.str("language", "auto");
        const lang = asked === "auto" ? detectLang(text) : (asked as "en" | "fr" | "de");
        const a = analyze(text, lang);
        if (!a.words) throw new CliError("no words to analyze");
        const LEVELS = ["very easy", "easy", "fairly difficult", "difficult", "very difficult"];
        const longFrom = ctx.num("long-from", 25);
        const long = a.sentences.filter((s) => s.words >= longFrom).length;
        const scores = a.scores.map((s) => ({
          id: s.id,
          name: SCORE_NAMES[s.id],
          value: Number(s.value.toFixed(1)),
          grade: s.grade == null ? null : Number(s.grade.toFixed(1)),
          level: LEVELS[s.level],
          shaky: s.shaky,
        }));
        const head = kv([
          ["Language", lang],
          ["Words", a.words],
          ["Sentences", a.sentences.length],
          ["Syllables", a.syllables],
          ["Words per sentence", a.sentences.length ? a.words / a.sentences.length : 0],
          [`Long sentences (≥ ${longFrom} words)`, long],
        ]);
        const body = table(
          scores.map((s) => [
            s.name,
            String(s.value),
            s.grade == null ? "" : String(s.grade),
            `${s.level}${s.shaky ? " (short text)" : ""}`,
          ]),
          ["SCORE", "VALUE", "GRADE", "LEVEL"],
        );
        return {
          text: `${head}\n\n${body}`,
          json: {
            language: lang,
            words: a.words,
            sentences: a.sentences.length,
            syllables: a.syllables,
            complexWords: a.complex,
            longSentences: long,
            scores,
          },
        };
      },
    },
    {
      name: "regex",
      tool: "regex",
      summary:
        "Test a regular expression (JavaScript syntax) against a text: matches, positions and groups.",
      usage: "toolbelt regex <pattern> [text] [--flags gimsu]",
      options: [
        {
          name: "flags",
          type: "string",
          arg: "<flags>",
          desc: "Any of g, i, m, s, u.",
          default: "g",
        },
        {
          name: "pattern",
          alias: "p",
          type: "string",
          arg: "<regex>",
          desc: "The pattern (then the argument is the text).",
        },
      ],
      notes:
        "The text is the rest of the arguments, else --file, else stdin. Exits with 1 when nothing matches.",
      examples: [
        { cmd: "toolbelt regex '\\d+' 'order 66 and 42'" },
        { cmd: "toolbelt regex '(?<user>\\w+)@(?<host>[\\w.]+)' --file emails.txt --json" },
        { cmd: "toolbelt regex '^error' --flags gim --file app.log" },
      ],
      async run(ctx) {
        let pattern = ctx.str("pattern");
        let text: string;
        if (pattern !== undefined) text = await ctx.text();
        else {
          pattern = ctx.args[0];
          if (pattern === undefined)
            throw new UsageError("missing pattern, e.g. toolbelt regex '\\d+' 'abc 123'");
          const rest = ctx.args.slice(1);
          const file = ctx.str("file");
          text = rest.length ? rest.join(" ") : await ctx.readTextFile(file ?? "-");
        }
        const { testRegex, toLiteral } = await import("../../src/tools/text/regex/logic");
        const flags = ctx.str("flags", "g");
        const r = testRegex(pattern, flags, text, 1000);
        if (!r.ok) throw new CliError(`invalid regular expression: ${r.message}`);
        const matches = r.matches.map((m) => ({
          index: m.index,
          end: m.end,
          text: m.text,
          groups: m.groups.map((g) => ({ n: g.n, name: g.name, value: g.value ?? null })),
        }));
        const json = {
          literal: toLiteral(pattern, flags),
          count: matches.length,
          truncated: r.truncated,
          matches,
        };
        if (!matches.length) return { text: "No match.", json, code: 1 };
        const lines = matches.map((m) => {
          const groups = m.groups
            .map((g) => `${g.name ?? g.n}=${g.value === null ? "(none)" : JSON.stringify(g.value)}`)
            .join(" ");
          return `${m.index}-${m.end}: ${JSON.stringify(m.text)}${groups ? `  ${groups}` : ""}`;
        });
        lines.unshift(
          `${matches.length}${r.truncated ? "+" : ""} match${matches.length === 1 ? "" : "es"}`,
        );
        return { text: lines.join("\n"), json };
      },
    },
    {
      name: "replace",
      tool: "replace",
      summary:
        "Find and replace in a text, plain or with a regular expression ($1, $<name> in the replacement).",
      usage:
        "toolbelt replace [text] --find <s> --with <s> [--regex] [--flags gimsu] [--whole-word] [--escapes]",
      options: [
        { name: "find", type: "string", arg: "<text>", desc: "What to find (required)." },
        {
          name: "with",
          alias: "w",
          type: "string",
          arg: "<text>",
          desc: "The replacement (default: empty).",
          default: '""',
        },
        { name: "regex", alias: "r", type: "boolean", desc: "--find is a regular expression." },
        {
          name: "flags",
          type: "string",
          arg: "<flags>",
          desc: "Any of g, i, m, s, u.",
          default: "g",
        },
        { name: "whole-word", type: "boolean", desc: "Plain mode: whole words only." },
        {
          name: "escapes",
          type: "boolean",
          desc: "Read \\n, \\t, \\r and \\\\ in --find and --with.",
        },
      ],
      examples: [
        { cmd: "toolbelt replace --file notes.txt --find foo --with bar" },
        {
          cmd: "toolbelt replace '2024-05-01' --regex --find '(\\d+)-(\\d+)-(\\d+)' --with '$3/$2/$1'",
        },
        { cmd: "toolbelt replace --file list.txt --find ', ' --with '\\n' --escapes" },
      ],
      async run(ctx) {
        const find = ctx.str("find");
        if (find === undefined || find === "") throw new UsageError("missing --find <text>");
        const text = await ctx.text();
        const { findReplace, linesTouched } = await import("../../src/tools/text/replace/logic");
        const r = findReplace(text, find, ctx.str("with", ""), {
          regex: ctx.bool("regex"),
          flags: ctx.str("flags", "g"),
          wholeWord: ctx.bool("whole-word"),
          escapes: ctx.bool("escapes"),
        });
        if (!r.ok) throw new CliError(`invalid regular expression: ${r.message}`);
        return {
          text: r.output,
          json: {
            result: r.output,
            replacements: r.hits.length,
            lines: linesTouched(text, r.hits),
          },
        };
      },
    },
    {
      name: "slugify",
      tool: "slugify",
      aliases: ["slug"],
      summary: "Turn text into a URL slug (one per line): accents removed, lowercase, dashes.",
      usage:
        "toolbelt slugify [text] [--separator <s>] [--keep-case] [--max-length <n>] [--keep-unicode] [--umlauts]",
      options: [
        {
          name: "separator",
          alias: "s",
          type: "string",
          arg: "<s>",
          desc: "Word separator.",
          default: "-",
        },
        { name: "keep-case", type: "boolean", desc: "Do not lowercase." },
        {
          name: "max-length",
          type: "number",
          desc: "Cut at a word boundary (0: no limit).",
          default: 0,
        },
        {
          name: "keep-unicode",
          type: "boolean",
          desc: "Keep letters with no ASCII form (Cyrillic, CJK…).",
        },
        {
          name: "umlauts",
          type: "boolean",
          desc: "ä → ae, ö → oe, ü → ue (default with --lang de).",
        },
        { name: "no-umlauts", type: "boolean", desc: "ä → a even with --lang de." },
      ],
      examples: [
        { cmd: 'toolbelt slugify "Héllo Wörld: a guide!"', desc: "hello-world-a-guide" },
        { cmd: 'toolbelt slugify "Grüße aus Köln" --umlauts --separator _' },
      ],
      async run(ctx) {
        const text = await ctx.text();
        const { slugifyLines } = await import("../../src/tools/text/slugify/logic");
        const max = ctx.num("max-length", 0);
        if (!Number.isInteger(max) || max < 0)
          throw new UsageError("--max-length must be a whole number ≥ 0");
        const out = slugifyLines(text, {
          separator: ctx.str("separator", "-"),
          lowercase: !ctx.bool("keep-case"),
          asciiOnly: !ctx.bool("keep-unicode"),
          umlauts: ctx.bool("no-umlauts") ? false : ctx.bool("umlauts", ctx.lang === "de"),
          maxLength: max,
        });
        if (!out.replace(/\n/g, "")) throw new CliError("nothing left to make a slug from");
        return { text: out, json: { result: out } };
      },
    },
    {
      name: "speech",
      tool: "speech",
      summary: "Read text aloud with the system's voices.",
      usage: "toolbelt speech",
      browserOnly: true,
      browserReason: "the browser's speech synthesis (Web Speech API)",
      examples: [
        { cmd: "toolbelt speech" },
        { cmd: 'toolbelt link speech --set text="Hello there"' },
      ],
    },
    {
      name: "unicode",
      tool: "unicode",
      summary:
        "Inspect every code point (name, category, script, UTF-8/UTF-16), find invisible characters, normalize.",
      usage:
        "toolbelt unicode [text] [--normalize NFC|NFD|NFKC|NFKD] [--remove-invisible] [--normalize-spaces] [--limit <n>]",
      options: [
        {
          name: "normalize",
          type: "string",
          values: ["NFC", "NFD", "NFKC", "NFKD"],
          desc: "Print the text in this normalization form.",
        },
        {
          name: "remove-invisible",
          type: "boolean",
          desc: "Print the text without zero-width, bidi and other invisible characters.",
        },
        {
          name: "normalize-spaces",
          type: "boolean",
          desc: "Print the text with unusual spaces made plain.",
        },
        {
          name: "limit",
          alias: "n",
          type: "number",
          desc: "At most this many code points in the table.",
          default: 500,
        },
      ],
      examples: [
        { cmd: "toolbelt unicode 'café ☕'" },
        { cmd: "toolbelt unicode --file suspicious.txt --remove-invisible --out clean.txt" },
        { cmd: "toolbelt unicode 'é' --normalize NFD --json" },
      ],
      async run(ctx) {
        const text = await ctx.text();
        const { inspect, normalizeSpaces, removeInvisible, summarize } = await import(
          "../../src/tools/text/unicode/logic"
        );
        const form = ctx.str("normalize") as "NFC" | "NFD" | "NFKC" | "NFKD" | undefined;
        if (form || ctx.bool("remove-invisible") || ctx.bool("normalize-spaces")) {
          let out = text;
          if (ctx.bool("remove-invisible")) out = removeInvisible(out);
          if (ctx.bool("normalize-spaces")) out = normalizeSpaces(out);
          if (form) out = out.normalize(form);
          return { text: out, json: { result: out, changed: out !== text } };
        }
        const limit = Math.max(1, Math.floor(ctx.num("limit", 500)));
        const rows = inspect(text, limit);
        const sum = summarize(text);
        const flagged = Object.entries(sum.flagged).filter(([, n]) => n > 0);
        const head = kv([
          ["Code points", sum.codePoints],
          ["Graphemes", sum.graphemes],
          ["UTF-16 units", sum.utf16],
          ["UTF-8 bytes", sum.utf8],
          ["Flagged", flagged.length ? flagged.map(([k, n]) => `${n} ${k}`).join(", ") : "none"],
        ]);
        const show = (c: string, flag: string | null) => (flag ? "" : c);
        const body = table(
          rows.map((r) => [
            show(r.char, r.flag),
            r.hex,
            r.name,
            r.category,
            r.script,
            r.utf8,
            r.flag ?? "",
          ]),
          ["CHAR", "CODE", "NAME", "CAT", "SCRIPT", "UTF-8", "FLAG"],
        );
        const more = sum.codePoints > rows.length ? `\n(${sum.codePoints - rows.length} more)` : "";
        return { text: `${head}\n\n${body}${more}`, json: { summary: sum, codePoints: rows } };
      },
    },
    {
      name: "whitespace",
      tool: "whitespace",
      aliases: ["clean"],
      summary:
        "Clean text: invisible characters, odd spaces, trailing spaces, blank lines, tabs, quotes, dashes, accents…",
      usage:
        "toolbelt whitespace [text] [--blank-lines keep|collapse|remove] [--quotes straight|smart|german] [--inspect] [...]",
      options: [
        {
          name: "inspect",
          type: "boolean",
          desc: "Only report what the text contains (no cleaning).",
        },
        {
          name: "keep-zero-width",
          type: "boolean",
          desc: "Keep zero-width and invisible characters.",
        },
        {
          name: "keep-odd-spaces",
          type: "boolean",
          desc: "Keep no-break and other unusual spaces.",
        },
        { name: "keep-spaces", type: "boolean", desc: "Do not collapse runs of spaces." },
        { name: "keep-trailing", type: "boolean", desc: "Keep spaces at line ends." },
        { name: "trim-leading", type: "boolean", desc: "Remove indentation." },
        { name: "trim", type: "boolean", desc: "Trim the whole text." },
        {
          name: "blank-lines",
          type: "string",
          values: ["keep", "collapse", "remove"],
          desc: "Blank lines.",
          default: "keep",
        },
        {
          name: "line-endings",
          type: "string",
          values: ["keep", "lf", "crlf"],
          desc: "Line endings.",
          default: "keep",
        },
        {
          name: "tabs",
          type: "string",
          values: ["keep", "spaces", "tabs"],
          desc: "Tabs to spaces or back.",
          default: "keep",
        },
        { name: "tab-size", type: "number", desc: "Tab width.", default: 4 },
        {
          name: "quotes",
          type: "string",
          values: ["keep", "straight", "smart", "german"],
          desc: "Quotes.",
          default: "keep",
        },
        {
          name: "dashes",
          type: "string",
          values: ["keep", "ascii", "smart"],
          desc: "Dashes.",
          default: "keep",
        },
        {
          name: "ellipsis",
          type: "string",
          values: ["keep", "ascii", "smart"],
          desc: "Ellipsis.",
          default: "keep",
        },
        { name: "remove-accents", type: "boolean", desc: "é → e." },
        { name: "remove-punctuation", type: "boolean", desc: "Remove punctuation." },
        { name: "remove-digits", type: "boolean", desc: "Remove digits." },
        { name: "remove-emoji", type: "boolean", desc: "Remove emoji." },
      ],
      notes:
        "By default: removes invisible characters, makes unusual spaces plain, collapses runs of spaces and trims line ends.",
      examples: [
        { cmd: "toolbelt whitespace --file pasted.txt --blank-lines collapse --quotes straight" },
        { cmd: "toolbelt whitespace --file pasted.txt --inspect" },
      ],
      async run(ctx) {
        const text = await ctx.text();
        const { clean, DEFAULTS, inspect } = await import("../../src/tools/text/whitespace/logic");
        if (ctx.bool("inspect")) {
          const f = inspect(text);
          return {
            text: kv([
              ["Unusual spaces", f.oddSpaces],
              ["Invisible characters", f.invisible],
              ["Tabs", f.tabs],
              ["CRLF line endings", f.crlf],
              ["Lines with trailing spaces", f.trailing],
              ["Smart quotes", f.smartQuotes],
              ["Non-ASCII characters", f.nonAscii],
            ]),
            json: f,
          };
        }
        const tabSize = ctx.num("tab-size", 4);
        if (!Number.isInteger(tabSize) || tabSize < 1 || tabSize > 16)
          throw new UsageError("--tab-size must be 1 to 16");
        type O = typeof DEFAULTS;
        const r = clean(text, {
          ...DEFAULTS,
          zeroWidth: !ctx.bool("keep-zero-width"),
          oddSpaces: !ctx.bool("keep-odd-spaces"),
          collapseSpaces: !ctx.bool("keep-spaces"),
          trimTrailing: !ctx.bool("keep-trailing"),
          trimLeading: ctx.bool("trim-leading"),
          trimText: ctx.bool("trim"),
          blankLines: ctx.str("blank-lines", "keep") as O["blankLines"],
          lineEndings: ctx.str("line-endings", "keep") as O["lineEndings"],
          tabs: ctx.str("tabs", "keep") as O["tabs"],
          tabSize,
          quotes: ctx.str("quotes", "keep") as O["quotes"],
          dashes: ctx.str("dashes", "keep") as O["dashes"],
          ellipsis: ctx.str("ellipsis", "keep") as O["ellipsis"],
          removeAccents: ctx.bool("remove-accents"),
          removePunctuation: ctx.bool("remove-punctuation"),
          removeDigits: ctx.bool("remove-digits"),
          removeEmoji: ctx.bool("remove-emoji"),
        });
        return { text: r.text, json: { result: r.text, changes: r.changes } };
      },
    },
    {
      name: "wrap",
      tool: "wrap",
      summary: 'Hard-wrap text at a width (with an optional prefix such as "> "), or unwrap it.',
      usage:
        "toolbelt wrap [text] [--width <n>] [--prefix <s>] [--no-reflow] [--break-long] [--unwrap]",
      options: [
        { name: "width", alias: "w", type: "number", desc: "Maximum line width.", default: 80 },
        {
          name: "prefix",
          type: "string",
          arg: "<text>",
          desc: 'Added to every line, e.g. "> " or "// ".',
        },
        {
          name: "no-reflow",
          type: "boolean",
          desc: "Wrap each line on its own (do not join paragraphs first).",
        },
        { name: "break-long", type: "boolean", desc: "Cut words longer than the width." },
        {
          name: "unwrap",
          type: "boolean",
          desc: "Join wrapped lines back into paragraphs (removing --prefix).",
        },
      ],
      examples: [
        { cmd: "toolbelt wrap --file message.txt --width 72" },
        { cmd: 'toolbelt wrap --file quote.txt --width 60 --prefix "> "' },
        { cmd: "toolbelt wrap --file wrapped.txt --unwrap" },
      ],
      async run(ctx) {
        const text = await ctx.text();
        const { unwrapText, wrapText } = await import("../../src/tools/text/wrap/logic");
        const prefix = ctx.str("prefix", "");
        if (ctx.bool("unwrap")) {
          const out = unwrapText(text, prefix);
          return { text: out, json: { result: out } };
        }
        const width = ctx.num("width", 80);
        if (!Number.isInteger(width) || width < 1)
          throw new UsageError("--width must be a whole number ≥ 1");
        if (prefix.length >= width) throw new CliError("the prefix is as long as the width");
        const out = wrapText(text, {
          width,
          prefix,
          reflow: !ctx.bool("no-reflow"),
          breakLongWords: ctx.bool("break-long"),
        });
        return { text: out, json: { result: out } };
      },
    },
  ],
};
