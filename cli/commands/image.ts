/**
 * Image tools. Those that decode pixels (canvas) stay in the browser; metadata, Base64 and SVG
 * text work on bytes and run here.
 */
import type { Rgb } from "../../src/tools/image/_shared";
import { kv, num, table } from "../format";
import { CliError, type CommandGroup, type Ctx, UsageError } from "../types";

/** A binary input: a file path as the argument, `--file`, or stdin. */
async function fileBytes(ctx: Ctx): Promise<{ bytes: Uint8Array; name: string }> {
  if (ctx.args.length > 1)
    throw new UsageError(`unexpected argument "${ctx.args[1]}" (one file at a time)`);
  const path = ctx.args[0];
  if (path !== undefined) return { bytes: await ctx.readFile(path), name: path };
  const file = ctx.str("file");
  return { bytes: await ctx.bytes(), name: file ?? "stdin" };
}

function sizeText(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${num(bytes / 1024, 1)} KiB (${bytes} B)`;
}

export const group: CommandGroup = {
  category: "image",
  commands: [
    {
      name: "image-convert",
      tool: "image-convert",
      summary: "Convert and compress images (PNG, JPEG, WebP, AVIF) in batch.",
      usage: "toolbelt image-convert",
      browserOnly: true,
      browserReason: "it decodes and re-encodes pixels with a canvas",
      examples: [{ cmd: "toolbelt image-convert" }],
    },
    {
      name: "image-resize",
      tool: "image-resize",
      summary: "Resize, crop, rotate and flip an image.",
      usage: "toolbelt image-resize",
      browserOnly: true,
      browserReason: "it draws the image on a canvas",
      examples: [{ cmd: "toolbelt image-resize" }],
    },
    {
      name: "favicon",
      tool: "favicon",
      summary: "Generate favicons (ICO, PNG sizes, manifest) from an image, text or emoji.",
      usage: "toolbelt favicon",
      browserOnly: true,
      browserReason: "it rasterizes the icon with a canvas",
      examples: [{ cmd: "toolbelt favicon" }],
    },
    {
      name: "image-colors",
      tool: "image-colors",
      summary: "Pick colors and extract a palette from an image.",
      usage: "toolbelt image-colors",
      browserOnly: true,
      browserReason: "it reads the image's pixels with a canvas",
      examples: [{ cmd: "toolbelt image-colors" }],
    },
    {
      name: "exif",
      tool: "exif",
      summary:
        "Read the metadata of a JPEG, PNG or WebP (camera, date, GPS, all EXIF tags), or strip it losslessly.",
      usage:
        "toolbelt exif <image-file> [--strip --out <clean-file>] [--no-keep-orientation] [--all]",
      options: [
        {
          name: "strip",
          type: "boolean",
          desc: "Write a copy without metadata (to --out, or stdout).",
        },
        {
          name: "keep-orientation",
          type: "boolean",
          desc: "When stripping a JPEG, keep the orientation tag so photos stay upright.",
          default: true,
        },
        { name: "all", alias: "a", type: "boolean", desc: "List every tag, not only the summary." },
      ],
      examples: [
        { cmd: "toolbelt exif photo.jpg" },
        { cmd: "toolbelt exif photo.jpg --all --json" },
        { cmd: "toolbelt exif photo.jpg --strip --out photo-clean.jpg" },
      ],
      async run(ctx) {
        const { bytes } = await fileBytes(ctx);
        const m = await import("../../src/tools/image/exif/logic");
        const meta = m.readMeta(bytes);
        if (meta.format === "other") throw new CliError("not a JPEG, PNG or WebP image");
        const local = (x: { en: string; fr: string; de?: string }) => x[ctx.lang] ?? x.en;
        if (ctx.bool("strip")) {
          const out = m.stripMeta(bytes, ctx.bool("keep-orientation", true));
          if (!out) throw new CliError("cannot strip metadata from this format");
          if (ctx.json)
            return {
              json: {
                format: meta.format,
                removed: out.removed,
                before: bytes.length,
                after: out.bytes.length,
              },
            };
          return { bytes: out.bytes };
        }
        const summary = m.summarize(meta.tags);
        const tags = meta.tags.map((t) => ({
          ifd: t.ifd,
          name: t.name,
          value: local(m.formatTag(t)),
        }));
        const lines = [
          kv([
            ["Format", meta.format.toUpperCase()],
            ["Metadata", sizeText(meta.metaBytes)],
            ["Camera", summary.camera],
            ["Lens", summary.lens],
            ["Date", summary.date],
            ["Exposure", summary.exposure],
            ["Aperture", summary.aperture],
            ["ISO", summary.iso],
            ["Focal length", summary.focal],
            [
              "Orientation",
              summary.orientation === undefined
                ? undefined
                : local(m.orientationText(summary.orientation)),
            ],
            ["Software", summary.software],
            ["Artist", summary.artist],
            ["Copyright", summary.copyright],
            [
              "GPS",
              summary.gps
                ? `${num(summary.gps.lat, 6)}, ${num(summary.gps.lon, 6)}${summary.gps.alt !== undefined ? ` (${num(summary.gps.alt, 1)} m)` : ""}`
                : undefined,
            ],
          ]),
        ];
        if (meta.blocks.length)
          lines.push("", "Blocks:", table(meta.blocks.map((b) => [b.label, sizeText(b.size)])));
        if (ctx.bool("all") && tags.length)
          lines.push("", "Tags:", table(tags.map((t) => [t.ifd, t.name, t.value])));
        else if (tags.length) lines.push("", `${tags.length} tags (--all to list them).`);
        if (!meta.tags.length && !meta.blocks.length) lines.push("", "No metadata found.");
        return {
          text: lines.join("\n"),
          json: {
            format: meta.format,
            metaBytes: meta.metaBytes,
            summary,
            blocks: meta.blocks.map((b) => ({ kind: b.kind, label: b.label, size: b.size })),
            tags,
          },
        };
      },
    },
    {
      name: "image-base64",
      tool: "image-base64",
      summary:
        "Encode an image file as a data URI / Base64 (with CSS, HTML, Markdown snippets), or decode one back to a file.",
      usage:
        "toolbelt image-base64 <image-file> [--format data-uri|base64|css|html|markdown] [--alt <text>]\n       toolbelt image-base64 --decode <data-uri|base64> --out <file>",
      options: [
        {
          name: "format",
          type: "string",
          values: ["data-uri", "base64", "css", "html", "markdown"],
          desc: "What to print when encoding.",
          default: "data-uri",
        },
        {
          name: "alt",
          type: "string",
          desc: "Alt text for the HTML and Markdown snippets.",
          default: "",
        },
        {
          name: "decode",
          alias: "d",
          type: "boolean",
          desc: "Decode a data URI or Base64 text to image bytes.",
        },
      ],
      examples: [
        { cmd: "toolbelt image-base64 logo.png" },
        { cmd: 'toolbelt image-base64 icon.svg --format html --alt "Logo"' },
        { cmd: "toolbelt image-base64 --decode --file uri.txt --out image.png" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/image/image-base64/logic");
        const { sniffImage, imageDims } = await import("../../src/tools/image/_shared");
        if (ctx.bool("decode")) {
          const img = m.parseImageInput(await ctx.text());
          const dims = imageDims(img.bytes);
          const info = {
            mime: img.mime,
            format: m.formatName(img.mime),
            extension: m.extFor(img.mime),
            bytes: img.bytes.length,
            width: dims?.w ?? null,
            height: dims?.h ?? null,
          };
          if (ctx.json) return { json: info };
          return { bytes: img.bytes };
        }
        const { bytes } = await fileBytes(ctx);
        if (!bytes.length) throw new CliError("the file is empty");
        const mime = sniffImage(bytes);
        if (!mime)
          throw new CliError(
            "not a recognized image (PNG, JPEG, GIF, WebP, AVIF, SVG, BMP, ICO, TIFF)",
          );
        const dims = imageDims(bytes);
        const uri = m.toDataUri(bytes, mime);
        const alt = ctx.str("alt", "");
        const out = {
          "data-uri": uri,
          base64: m.bytesToBase64(bytes),
          css: m.cssSnippet(uri),
          html: m.imgSnippet(uri, dims?.w ?? null, dims?.h ?? null, alt),
          markdown: m.markdownSnippet(uri, alt),
        };
        const f = ctx.str("format", "data-uri") as keyof typeof out;
        return {
          text: out[f],
          json: {
            mime,
            format: m.formatName(mime),
            bytes: bytes.length,
            width: dims?.w ?? null,
            height: dims?.h ?? null,
            overhead: m.overhead(bytes.length, uri.length),
            dataUri: uri,
            base64: out.base64,
          },
        };
      },
    },
    {
      name: "svg-to-png",
      tool: "svg-to-png",
      aliases: ["svg"],
      summary:
        "SVG size info and a safe SVG cleanup/minify. (PNG export needs the browser: it renders with a canvas.)",
      usage:
        "toolbelt svg-to-png [svg-markup] [--file <svg>] [--clean] [--decimals <n>] [--scale <k> | --width <px>]",
      options: [
        { name: "clean", alias: "c", type: "boolean", desc: "Print the cleaned, minified SVG." },
        {
          name: "decimals",
          type: "number",
          desc: "Decimals kept in geometry when cleaning (-1 keeps numbers as they are).",
          default: 2,
        },
        { name: "scale", type: "number", desc: "Show the PNG size at this scale." },
        { name: "width", type: "number", desc: "Show the PNG size at this width (px)." },
      ],
      notes: "Rendering to PNG (or WebP/JPEG) runs in the browser only: open the printed link.",
      examples: [
        { cmd: "toolbelt svg-to-png --file icon.svg" },
        {
          cmd: "toolbelt svg-to-png --file drawing.svg --clean --decimals 1 --out drawing.min.svg",
        },
      ],
      async run(ctx) {
        const svg = await ctx.text();
        const m = await import("../../src/tools/image/svg-to-png/logic");
        const info = m.svgInfo(svg);
        const before = m.byteLength(svg);
        const decimals = ctx.num("decimals", 2);
        if (!Number.isInteger(decimals) || decimals < -1 || decimals > 10)
          throw new CliError("--decimals must be an integer from -1 to 10");
        if (ctx.bool("clean")) {
          const cleaned = m.cleanSvg(svg, { decimals });
          return {
            text: cleaned,
            json: { svg: cleaned, before, after: m.byteLength(cleaned) },
          };
        }
        const scale = ctx.num("scale");
        const width = ctx.num("width");
        if (scale !== undefined && !(scale > 0)) throw new CliError("--scale must be positive");
        if (width !== undefined && !(width > 0)) throw new CliError("--width must be positive");
        const render =
          width !== undefined
            ? m.renderSize(info, "width", 1, width)
            : m.renderSize(info, "scale", scale ?? 1, 0);
        const cleaned = m.cleanSvg(svg, { decimals });
        const after = m.byteLength(cleaned);
        const lines = kv([
          [
            "Size",
            `${num(info.width, 3)} × ${num(info.height, 3)} px${info.known ? "" : " (default 300×150)"}`,
          ],
          ["viewBox", info.viewBox ? info.viewBox.join(" ") : "none"],
          ["PNG size", `${render.w} × ${render.h} px`],
          ["Bytes", before],
          ["Cleaned", `${after} (--clean to print it)`],
        ]);
        return {
          text: `${lines}\n\nPNG export runs in the browser: https://maxgfr.github.io/toolbelt/#/svg-to-png`,
          json: { ...info, png: render, bytes: before, cleanedBytes: after },
        };
      },
    },
    {
      name: "color-blind",
      tool: "color-blind",
      summary:
        "How colors look with each color vision deficiency. (Simulating a whole image needs the browser.)",
      usage: "toolbelt color-blind <hex> [hex …] [--mild]",
      options: [{ name: "mild", type: "boolean", desc: "Also the milder (anomalous) forms." }],
      notes:
        "With two colors, the distance column shows how far apart they stay (under ~40 they are easily confused).",
      examples: [
        { cmd: 'toolbelt color-blind "#d62728" "#2ca02c"' },
        { cmd: "toolbelt color-blind ff7f0e --mild --json" },
      ],
      async run(ctx) {
        if (!ctx.args.length)
          throw new UsageError(
            'give one or more hex colors, e.g. toolbelt color-blind "#d62728" "#2ca02c"',
          );
        const { parseHex, toHex } = await import("../../src/tools/image/_shared");
        const m = await import("../../src/tools/image/color-blind/logic");
        const colors = ctx.args.map((a) => {
          const c = parseHex(a);
          if (!c) throw new CliError(`"${a}" is not a hex color (#rgb or #rrggbb)`);
          return c;
        });
        type D = import("../../src/tools/image/color-blind/logic").Deficiency;
        const main: D[] = ["protanopia", "deuteranopia", "tritanopia", "achromatopsia"];
        const mild: D[] = ["protanomaly", "deuteranomaly", "tritanomaly", "achromatomaly"];
        const kinds = ctx.bool("mild") ? [...main, ...mild] : main;
        const pair = colors.length === 2;
        const dist = ([a, b]: Rgb[]) => (a && b ? m.distance(a, b) : 0);
        const rows = [
          {
            kind: "normal",
            colors: colors.map(toHex),
            distance: pair ? dist(colors) : null,
          },
          ...kinds.map((k) => {
            const sim = colors.map((c) => m.simulateRgb(c, k));
            return {
              kind: k,
              colors: sim.map(toHex),
              distance: pair ? dist(sim) : null,
              prevalence: m.PREVALENCE[k],
            };
          }),
        ];
        return {
          text: table(
            rows.map((r) => [r.kind, ...r.colors, ...(pair ? [num(r.distance ?? 0, 1)] : [])]),
            ["VISION", ...colors.map((_, i) => `COLOR ${i + 1}`), ...(pair ? ["DISTANCE"] : [])],
          ),
          json: rows,
        };
      },
    },
  ],
};
