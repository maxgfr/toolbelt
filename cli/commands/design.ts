/** CSS & design generators. Each command imports its tool's logic lazily. */
import { num, table } from "../format";
import { CliError, type CommandGroup, type Ctx, type OptionSpec, UsageError } from "../types";

type Fmt = "css" | "tailwind" | "value";

const FORMAT: OptionSpec = {
  name: "format",
  type: "string",
  values: ["css", "tailwind", "value"],
  desc: "Output: a CSS declaration, Tailwind classes, or the bare value.",
  default: "css",
};

function noArgs(ctx: Ctx): void {
  if (ctx.args.length)
    throw new UsageError(
      `unexpected argument "${ctx.args[0]}" (see: toolbelt help ${ctx.command})`,
    );
}

async function checkColor(value: string | undefined, flag: string): Promise<void> {
  if (value === undefined) return;
  const { parseColor } = await import("../../src/tools/design/_shared");
  if (!parseColor(value)) throw new CliError(`${flag}: "${value}" is not a CSS color`);
}

function pick(ctx: Ctx, out: { css: string; tailwind: string; value: string }, json: object) {
  const f = ctx.str("format", "css") as Fmt;
  return {
    text: out[f],
    json: { ...json, css: out.css, tailwind: out.tailwind, value: out.value },
  };
}

function presetIds(list: { id: string }[]): string {
  return list.map((p) => p.id).join(", ");
}

/** Numbers given on the command line must survive the logic's clamping unchanged. */
function checkRange(
  given: Record<string, number | undefined>,
  cleaned: Record<string, unknown>,
  flags: Record<string, string>,
): void {
  for (const [k, v] of Object.entries(given))
    if (v !== undefined && cleaned[k] !== v)
      throw new CliError(
        `--${flags[k] ?? k} ${v} is out of range (nearest allowed: ${cleaned[k]})`,
      );
}

export const group: CommandGroup = {
  category: "design",
  commands: [
    {
      name: "box-shadow",
      tool: "box-shadow",
      summary: "Generate a CSS box-shadow (one layer from flags, a preset, or layers as JSON).",
      usage:
        "toolbelt box-shadow [--x <px>] [--y <px>] [--blur <px>] [--spread <px>] [--color <c>] [--alpha <0-1>] [--inset] [--preset <id>] [--layers <json>] [--format css|tailwind|value]",
      options: [
        { name: "x", type: "number", desc: "Horizontal offset (px).", default: 0 },
        { name: "y", type: "number", desc: "Vertical offset (px).", default: 4 },
        { name: "blur", type: "number", desc: "Blur radius (px).", default: 12 },
        { name: "spread", type: "number", desc: "Spread (px).", default: 0 },
        {
          name: "color",
          type: "string",
          arg: "<color>",
          desc: "Shadow color.",
          default: "#000000",
        },
        { name: "alpha", type: "number", desc: "Opacity, 0 to 1.", default: 0.15 },
        { name: "inset", type: "boolean", desc: "Inner shadow." },
        {
          name: "preset",
          type: "string",
          arg: "<id>",
          desc: "soft, elevated, floating, sharp, neumorphism, pressed, glow, ring, layered.",
        },
        {
          name: "layers",
          type: "string",
          arg: "<json>",
          desc: 'Several layers: [{"x":0,"y":4,"blur":12,"spread":0,"color":"#000","alpha":0.2,"inset":false}, …].',
        },
        FORMAT,
      ],
      examples: [
        { cmd: "toolbelt box-shadow --y 8 --blur 24 --alpha 0.2" },
        { cmd: "toolbelt box-shadow --preset neumorphism --format tailwind" },
      ],
      async run(ctx) {
        noArgs(ctx);
        const m = await import("../../src/tools/design/box-shadow/logic");
        let layers: ReturnType<typeof m.cleanLayers>;
        const preset = ctx.str("preset");
        const raw = ctx.str("layers");
        if (preset !== undefined) {
          const p = m.PRESETS.find((x) => x.id === preset);
          if (!p)
            throw new CliError(`unknown preset "${preset}" (presets: ${presetIds(m.PRESETS)})`);
          layers = p.layers;
        } else if (raw !== undefined) {
          let v: unknown;
          try {
            v = JSON.parse(raw);
          } catch {
            throw new CliError("--layers must be a JSON array of layers");
          }
          if (!Array.isArray(v) || !v.length)
            throw new CliError("--layers must be a non-empty JSON array");
          layers = m.cleanLayers(v);
          for (const l of layers) await checkColor(l.color, "--layers color");
        } else {
          await checkColor(ctx.str("color"), "--color");
          const given = {
            x: ctx.num("x"),
            y: ctx.num("y"),
            blur: ctx.num("blur"),
            spread: ctx.num("spread"),
            alpha: ctx.num("alpha"),
          };
          const layer = m.cleanLayer({
            ...m.newLayer(),
            ...Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined)),
            ...(ctx.str("color") !== undefined ? { color: ctx.str("color") } : {}),
            inset: ctx.bool("inset"),
          });
          checkRange(given, layer, {});
          layers = [layer];
        }
        return pick(
          ctx,
          {
            css: m.shadowCss(layers),
            tailwind: m.shadowTailwind(layers),
            value: m.shadowValue(layers),
          },
          { layers },
        );
      },
    },
    {
      name: "gradient",
      tool: "gradient",
      summary: "Generate a CSS gradient (linear, radial, conic) from colors or a preset.",
      usage:
        "toolbelt gradient <color[ pos%]>... [--type linear|radial|conic] [--angle <deg>] [--space oklch|oklab|srgb|hsl|none] [--preset <id>] [--format css|tailwind|value]",
      options: [
        {
          name: "type",
          type: "string",
          values: ["linear", "radial", "conic"],
          desc: "Gradient type.",
          default: "linear",
        },
        {
          name: "angle",
          type: "number",
          desc: "Angle in degrees (linear; start angle for conic).",
          default: 135,
        },
        {
          name: "shape",
          type: "string",
          values: ["ellipse", "circle"],
          desc: "Radial shape.",
          default: "ellipse",
        },
        { name: "x", type: "number", desc: "Center x in % (radial, conic).", default: 50 },
        { name: "y", type: "number", desc: "Center y in % (radial, conic).", default: 50 },
        { name: "repeating", type: "boolean", desc: "repeating-*-gradient." },
        {
          name: "space",
          type: "string",
          values: ["oklch", "oklab", "srgb", "hsl", "none"],
          desc: "Interpolation color space (none = browser default, no `in …`).",
          default: "oklch",
        },
        {
          name: "hue",
          type: "string",
          values: ["shorter", "longer"],
          desc: "Hue path for oklch/hsl.",
          default: "shorter",
        },
        {
          name: "preset",
          type: "string",
          arg: "<id>",
          desc: "sunset, ocean, mint, aurora, spotlight, rainbow, stripes, pie.",
        },
        FORMAT,
      ],
      notes:
        'Stops are colors, optionally followed by a position in %: "#f97316 0" "#db2777 55". Without positions they are spread evenly.',
      examples: [
        { cmd: 'toolbelt gradient "#0f766e" "#f59e0b" --angle 90' },
        { cmd: 'toolbelt gradient "red 0" "gold 40" "blue 100" --type radial --space none' },
        { cmd: "toolbelt gradient --preset sunset --format tailwind" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/design/gradient/logic");
        const preset = ctx.str("preset");
        let base: Partial<import("../../src/tools/design/gradient/logic").Gradient> = {};
        if (preset !== undefined) {
          const p = m.PRESETS.find((x) => x.id === preset);
          if (!p)
            throw new CliError(`unknown preset "${preset}" (presets: ${presetIds(m.PRESETS)})`);
          base = m.fromPreset(p);
        }
        let stops = base.stops;
        if (ctx.args.length) {
          const parsed = ctx.args.map((a) => {
            const mm = /^(.*?)(?:\s+(-?\d*\.?\d+)%?)?$/.exec(a.trim());
            return {
              color: (mm?.[1] ?? a).trim(),
              pos: mm?.[2] === undefined ? undefined : Number(mm[2]),
            };
          });
          for (const s of parsed) await checkColor(s.color, "stop");
          const n = parsed.length;
          stops = parsed.map((s, i) => ({
            color: s.color,
            pos: s.pos ?? (n === 1 ? 0 : (i * 100) / (n - 1)),
          }));
        }
        if (!stops || stops.length < 2)
          throw new UsageError(
            'a gradient needs at least two colors, e.g. toolbelt gradient "#0f766e" "#f59e0b"',
          );
        const space = ctx.str("space");
        const raw = {
          ...m.DEFAULT,
          ...base,
          stops,
          ...(ctx.str("type") !== undefined ? { type: ctx.str("type") } : {}),
          ...(ctx.num("angle") !== undefined ? { angle: ctx.num("angle") } : {}),
          ...(ctx.str("shape") !== undefined ? { shape: ctx.str("shape") } : {}),
          ...(ctx.num("x") !== undefined ? { x: ctx.num("x") } : {}),
          ...(ctx.num("y") !== undefined ? { y: ctx.num("y") } : {}),
          ...(ctx.opts.repeating !== undefined ? { repeating: ctx.bool("repeating") } : {}),
          ...(space !== undefined ? { space: space === "none" ? "" : space } : {}),
          ...(ctx.str("hue") !== undefined ? { hue: ctx.str("hue") } : {}),
        };
        const g = m.cleanGradient(raw);
        checkRange({ angle: ctx.num("angle"), x: ctx.num("x"), y: ctx.num("y") }, g, {});
        if (g.stops.some((s, i) => s.pos !== stops[i]?.pos))
          throw new CliError("stop positions must be between 0 and 100");
        return pick(
          ctx,
          { css: m.gradientCss(g), tailwind: m.gradientTailwind(g), value: m.gradientValue(g) },
          { gradient: g },
        );
      },
    },
    {
      name: "border-radius",
      tool: "border-radius",
      aliases: ["blob"],
      summary:
        "Normalize a border-radius (up to 8 values), use a blob preset, or draw a random blob.",
      usage:
        "toolbelt border-radius [value] [--preset <id>] [--random] [--seed <n>] [--format css|tailwind|value]",
      options: [
        {
          name: "preset",
          type: "string",
          arg: "<id>",
          desc: "blob, pebble, circle, egg, leaf, drop, tab, rounded.",
        },
        { name: "random", type: "boolean", desc: "A random organic blob." },
        { name: "seed", type: "number", desc: "Seed for --random (reproducible)." },
        FORMAT,
      ],
      examples: [
        { cmd: 'toolbelt border-radius "30% 70% 70% 30% / 30% 30% 70% 70%"' },
        { cmd: "toolbelt border-radius --preset egg --format tailwind" },
        { cmd: "toolbelt border-radius --random --seed 7" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/design/border-radius/logic");
        let r: import("../../src/tools/design/border-radius/logic").Radius;
        const preset = ctx.str("preset");
        if (preset !== undefined) {
          const p = m.PRESETS.find((x) => x.id === preset);
          if (!p)
            throw new CliError(`unknown preset "${preset}" (presets: ${presetIds(m.PRESETS)})`);
          r = p.r;
        } else if (ctx.bool("random")) {
          const seed = ctx.num("seed");
          const { rng } = await import("../../src/tools/text/_shared");
          r = m.randomBlob(seed === undefined ? Math.random : rng(seed));
        } else {
          const input = await ctx.text();
          const parsed = m.parseRadius(input);
          if (!parsed)
            throw new CliError(
              `cannot read "${input.trim()}" as a border-radius (1 to 4 lengths in px or %, optionally "/ " and 1 to 4 more)`,
            );
          r = parsed;
        }
        return pick(
          ctx,
          { css: m.radiusCss(r), tailwind: m.radiusTailwind(r), value: m.radiusValue(r) },
          { radius: r },
        );
      },
    },
    {
      name: "cubic-bezier",
      tool: "cubic-bezier",
      aliases: ["easing"],
      summary:
        "Parse or pick a cubic-bezier() easing and print its CSS, with sampled progress values.",
      usage:
        "toolbelt cubic-bezier [value] [--preset <id>] [--duration <ms>] [--format css|tailwind|value]",
      options: [
        {
          name: "preset",
          type: "string",
          arg: "<id>",
          desc: "ease, linear, ease-in, ease-out, ease-in-out, in-sine … in-out-back (easings.net names).",
        },
        {
          name: "duration",
          type: "number",
          desc: "Transition duration in ms (CSS output).",
          default: 1000,
        },
        FORMAT,
      ],
      notes: "The value can be a keyword (ease-in-out), cubic-bezier(a, b, c, d), or four numbers.",
      examples: [
        { cmd: "toolbelt cubic-bezier 0.34 1.56 0.64 1" },
        { cmd: 'toolbelt cubic-bezier "ease-in-out" --format tailwind' },
        { cmd: "toolbelt cubic-bezier --preset out-back --json" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/design/cubic-bezier/logic");
        let b: import("../../src/tools/design/cubic-bezier/logic").Bezier;
        const preset = ctx.str("preset");
        if (preset !== undefined) {
          const p = m.PRESETS.find((x) => x.id === preset);
          if (!p)
            throw new CliError(`unknown preset "${preset}" (presets: ${presetIds(m.PRESETS)})`);
          b = p.b;
        } else {
          const input = await ctx.text();
          const parsed = m.parseBezier(input);
          if (!parsed)
            throw new CliError(
              `cannot read "${input.trim()}" as an easing (x values must be within 0–1, y within ${m.Y_MIN}–${m.Y_MAX})`,
            );
          b = parsed;
        }
        const duration = ctx.num("duration", 1000);
        if (!(duration >= 0)) throw new CliError("--duration must be positive");
        const samples = [0, 0.25, 0.5, 0.75, 1].map((x) => ({
          time: x,
          progress: Number(num(m.ease(b, x), 4)),
        }));
        const out = {
          css: m.bezierCss(b, duration),
          tailwind: m.bezierTailwind(b),
          value: m.bezierValue(b),
        };
        const f = ctx.str("format", "css") as Fmt;
        const text =
          f === "css"
            ? `${out.css}\n\n/* progress at t = ${samples.map((s) => `${s.time}: ${s.progress}`).join(", ")} */`
            : out[f];
        return { text, json: { bezier: b, ...out, samples } };
      },
    },
    {
      name: "clip-path",
      tool: "clip-path",
      summary:
        "Generate a CSS clip-path: polygon (points, regular polygon, star, preset), circle, ellipse or inset.",
      usage:
        "toolbelt clip-path [--shape polygon|circle|ellipse|inset] [--points <list>] [--sides <n>] [--star <n>] [--preset <id>] [--format css|tailwind|value]",
      options: [
        {
          name: "shape",
          type: "string",
          values: ["polygon", "circle", "ellipse", "inset"],
          desc: "Shape kind.",
          default: "polygon",
        },
        {
          name: "points",
          type: "string",
          arg: "<x y, x y, …>",
          desc: 'Polygon points in %: "50 0, 100 100, 0 100".',
        },
        { name: "sides", type: "number", desc: "A regular polygon with n sides (3–64)." },
        { name: "star", type: "number", desc: "A star with n branches (3–32)." },
        {
          name: "preset",
          type: "string",
          arg: "<id>",
          desc: "triangle, trapezoid, parallelogram, rhombus, pentagon, hexagon, octagon, star, cross, arrow-right, chevron, message, frame.",
        },
        { name: "r", type: "number", desc: "Circle radius (%).", default: 50 },
        { name: "rx", type: "number", desc: "Ellipse x radius (%).", default: 50 },
        { name: "ry", type: "number", desc: "Ellipse y radius (%).", default: 35 },
        { name: "cx", type: "number", desc: "Center x (%).", default: 50 },
        { name: "cy", type: "number", desc: "Center y (%).", default: 50 },
        {
          name: "inset",
          type: "string",
          arg: "<t r b l>",
          desc: "Inset in % (1 to 4 values).",
          default: "10 10 10 10",
        },
        { name: "round", type: "number", desc: "Inset corner radius (px).", default: 16 },
        FORMAT,
      ],
      examples: [
        { cmd: "toolbelt clip-path --preset hexagon" },
        { cmd: "toolbelt clip-path --sides 6" },
        { cmd: "toolbelt clip-path --shape circle --r 40 --format tailwind" },
        { cmd: 'toolbelt clip-path --points "50 0, 100 100, 0 100"' },
      ],
      async run(ctx) {
        noArgs(ctx);
        const m = await import("../../src/tools/design/clip-path/logic");
        type Pt = import("../../src/tools/design/clip-path/logic").Pt;
        let points: Pt[] | undefined;
        const preset = ctx.str("preset");
        if (preset !== undefined) {
          const p = m.PRESETS.find((x) => x.id === preset);
          if (!p)
            throw new CliError(`unknown preset "${preset}" (presets: ${presetIds(m.PRESETS)})`);
          points = p.points;
        }
        const sides = ctx.num("sides");
        if (sides !== undefined) {
          if (!(sides >= 3 && sides <= 64)) throw new CliError("--sides must be between 3 and 64");
          points = m.regularPolygon(sides);
        }
        const star = ctx.num("star");
        if (star !== undefined) {
          if (!(star >= 3 && star <= 32)) throw new CliError("--star must be between 3 and 32");
          points = m.star(star);
        }
        const rawPts = ctx.str("points");
        if (rawPts !== undefined) {
          const pts = rawPts
            .split(/\s*,\s*/)
            .filter(Boolean)
            .map((p) => p.replace(/%/g, "").trim().split(/\s+/).map(Number));
          if (
            pts.length < 3 ||
            pts.some((p) => p.length !== 2 || p.some((n) => !(n >= 0 && n <= 100)))
          )
            throw new CliError(
              '--points needs at least 3 "x y" pairs in % (0–100), separated by commas',
            );
          points = pts as Pt[];
        }
        const insetRaw = ctx.str("inset");
        let inset: number[] | undefined;
        if (insetRaw !== undefined) {
          const v = insetRaw
            .replace(/%/g, "")
            .trim()
            .split(/[\s,]+/)
            .map(Number);
          if (v.length < 1 || v.length > 4 || v.some((n) => !(n >= 0 && n <= 100)))
            throw new CliError("--inset takes 1 to 4 values in % (0–100)");
          const [t = 0, r = t, b = t, l = r] = v;
          inset = [t, r, b, l];
        }
        const nums = {
          r: ctx.num("r"),
          rx: ctx.num("rx"),
          ry: ctx.num("ry"),
          cx: ctx.num("cx"),
          cy: ctx.num("cy"),
          round: ctx.num("round"),
        };
        const c = m.cleanClip({
          ...m.DEFAULT,
          kind: ctx.str("shape", "polygon"),
          ...(points ? { points } : {}),
          ...(inset ? { inset } : {}),
          ...Object.fromEntries(Object.entries(nums).filter(([, v]) => v !== undefined)),
        });
        checkRange(nums, c, {});
        return pick(
          ctx,
          { css: m.clipCss(c), tailwind: m.clipTailwind(c), value: m.clipValue(c) },
          { clip: c },
        );
      },
    },
    {
      name: "glassmorphism",
      tool: "glassmorphism",
      aliases: ["glass"],
      summary: "Generate a frosted-glass card (background, backdrop-filter, border, shadow).",
      usage:
        "toolbelt glassmorphism [--preset <id>] [--blur <px>] [--alpha <0-1>] [--saturation <%>] [--tint <color>] [--border <0-1>] [--radius <px>] [--shadow <0-1>] [--format css|tailwind]",
      options: [
        {
          name: "preset",
          type: "string",
          arg: "<id>",
          desc: "frosted, clear, milky, dark, tinted.",
        },
        { name: "blur", type: "number", desc: "Backdrop blur (px, 0–64).", default: 16 },
        { name: "alpha", type: "number", desc: "Fill opacity (0–1).", default: 0.18 },
        { name: "saturation", type: "number", desc: "Backdrop saturate (%, 0–400).", default: 180 },
        { name: "tint", type: "string", arg: "<color>", desc: "Fill color.", default: "#ffffff" },
        { name: "border", type: "number", desc: "Border opacity (0–1, 0 = none).", default: 0.3 },
        { name: "radius", type: "number", desc: "Corner radius (px, 0–100).", default: 20 },
        { name: "shadow", type: "number", desc: "Shadow opacity (0–1, 0 = none).", default: 0.2 },
        {
          name: "format",
          type: "string",
          values: ["css", "tailwind"],
          desc: "CSS rule or Tailwind classes.",
          default: "css",
        },
      ],
      examples: [
        { cmd: "toolbelt glassmorphism" },
        { cmd: "toolbelt glassmorphism --preset dark --format tailwind" },
        { cmd: 'toolbelt glassmorphism --blur 24 --tint "#f0abfc" --alpha 0.3' },
      ],
      async run(ctx) {
        noArgs(ctx);
        const m = await import("../../src/tools/design/glassmorphism/logic");
        let base: Partial<import("../../src/tools/design/glassmorphism/logic").Glass> = {};
        const preset = ctx.str("preset");
        if (preset !== undefined) {
          const p = m.PRESETS.find((x) => x.id === preset);
          if (!p)
            throw new CliError(`unknown preset "${preset}" (presets: ${presetIds(m.PRESETS)})`);
          base = p.g;
        }
        await checkColor(ctx.str("tint"), "--tint");
        const nums = {
          blur: ctx.num("blur"),
          alpha: ctx.num("alpha"),
          saturation: ctx.num("saturation"),
          border: ctx.num("border"),
          radius: ctx.num("radius"),
          shadow: ctx.num("shadow"),
        };
        const g = m.cleanGlass({
          ...m.DEFAULT,
          ...base,
          ...Object.fromEntries(Object.entries(nums).filter(([, v]) => v !== undefined)),
          ...(ctx.str("tint") !== undefined ? { tint: ctx.str("tint") } : {}),
        });
        checkRange(nums, g, {});
        const css = m.glassCss(g);
        const tailwind = m.glassTailwind(g);
        return {
          text: ctx.str("format", "css") === "tailwind" ? tailwind : css,
          json: { glass: g, css, tailwind },
        };
      },
    },
    {
      name: "css-triangle",
      tool: "css-triangle",
      aliases: ["triangle"],
      summary: "Generate a CSS triangle, with transparent borders or clip-path.",
      usage:
        "toolbelt css-triangle [--direction <dir>] [--width <px>] [--height <px>] [--color <c>] [--method border|clip] [--format css|tailwind]",
      options: [
        {
          name: "direction",
          alias: "d",
          type: "string",
          values: ["up", "down", "left", "right", "up-left", "up-right", "down-left", "down-right"],
          arg: "<dir>",
          desc: "Where the triangle points: up, down, left, right, up-left, up-right, down-left, down-right.",
          default: "up",
        },
        { name: "width", type: "number", desc: "Width (px, 1–1000).", default: 80 },
        { name: "height", type: "number", desc: "Height (px, 1–1000).", default: 60 },
        {
          name: "equilateral",
          type: "boolean",
          desc: "Set the height (or width for left/right) for an equilateral triangle.",
        },
        { name: "color", type: "string", arg: "<color>", desc: "Fill color.", default: "#0f766e" },
        {
          name: "method",
          type: "string",
          values: ["border", "clip"],
          desc: "Borders trick or clip-path.",
          default: "border",
        },
        {
          name: "format",
          type: "string",
          values: ["css", "tailwind"],
          desc: "CSS rule or Tailwind classes.",
          default: "css",
        },
      ],
      examples: [
        { cmd: "toolbelt css-triangle --direction right --width 20 --height 30" },
        { cmd: "toolbelt css-triangle --method clip --format tailwind --equilateral" },
      ],
      async run(ctx) {
        noArgs(ctx);
        const m = await import("../../src/tools/design/css-triangle/logic");
        await checkColor(ctx.str("color"), "--color");
        const dir = ctx.str("direction", "up");
        const nums = { w: ctx.num("width"), h: ctx.num("height") };
        let t = m.cleanTriangle({
          ...m.DEFAULT,
          dir,
          ...(nums.w !== undefined ? { w: nums.w } : {}),
          ...(nums.h !== undefined ? { h: nums.h } : {}),
          ...(ctx.str("color") !== undefined ? { color: ctx.str("color") } : {}),
        });
        checkRange(nums, t, { w: "width", h: "height" });
        if (ctx.bool("equilateral"))
          t =
            dir === "left" || dir === "right"
              ? { ...t, w: m.equilateral(t.h) }
              : { ...t, h: m.equilateral(t.w) };
        const clip = ctx.str("method", "border") === "clip";
        const css = clip ? m.clipCss(t) : m.borderCss(t);
        const tailwind = clip ? m.clipTailwind(t) : m.borderTailwind(t);
        return {
          text: ctx.str("format", "css") === "tailwind" ? tailwind : css,
          json: { triangle: t, css, tailwind },
        };
      },
    },
    {
      name: "svg-placeholder",
      tool: "svg-placeholder",
      aliases: ["placeholder"],
      summary: "Generate a placeholder image as SVG markup or a data URI.",
      usage:
        "toolbelt svg-placeholder [WxH] [--text <t>] [--bg <color>] [--fg <color>] [--font sans|serif|mono] [--size <px>] [--no-bold] [--format svg|data-uri|base64]",
      options: [
        { name: "text", type: "string", desc: 'Label (default: "W×H").' },
        {
          name: "bg",
          type: "string",
          arg: "<color>",
          desc: "Background color.",
          default: "#e2e8f0",
        },
        { name: "fg", type: "string", arg: "<color>", desc: "Text color.", default: "#64748b" },
        {
          name: "font",
          type: "string",
          values: ["sans", "serif", "mono"],
          desc: "Font family.",
          default: "sans",
        },
        { name: "size", type: "number", desc: "Font size in px (0 = fit).", default: 0 },
        {
          name: "bold",
          type: "boolean",
          desc: "Semi-bold text (--no-bold to turn off).",
          default: true,
        },
        {
          name: "format",
          type: "string",
          values: ["svg", "data-uri", "base64"],
          desc: "SVG markup, a compact data URI, or a Base64 data URI.",
          default: "svg",
        },
      ],
      examples: [
        { cmd: 'toolbelt svg-placeholder 1200x630 --text "Open Graph"' },
        { cmd: "toolbelt svg-placeholder 400x400 --format data-uri --out placeholder.txt" },
      ],
      async run(ctx) {
        const m = await import("../../src/tools/design/svg-placeholder/logic");
        let w = m.DEFAULT.w;
        let h = m.DEFAULT.h;
        if (ctx.args.length > 1) throw new UsageError(`unexpected argument "${ctx.args[1]}"`);
        const dims = ctx.args[0];
        if (dims !== undefined) {
          const mm = /^(\d+)\s*[x×*]\s*(\d+)$/i.exec(dims.trim());
          if (!mm) throw new CliError(`"${dims}" is not a size like 640x360`);
          w = Number(mm[1]);
          h = Number(mm[2]);
          if (w < 1 || h < 1 || w > m.MAX_SIDE || h > m.MAX_SIDE)
            throw new CliError(`width and height must be between 1 and ${m.MAX_SIDE}`);
        }
        await checkColor(ctx.str("bg"), "--bg");
        await checkColor(ctx.str("fg"), "--fg");
        const p = m.cleanPlaceholder({
          ...m.DEFAULT,
          w,
          h,
          ...(ctx.str("bg") !== undefined ? { bg: ctx.str("bg") } : {}),
          ...(ctx.str("fg") !== undefined ? { fg: ctx.str("fg") } : {}),
          text: ctx.str("text", ""),
          size: ctx.num("size", 0),
          font: ctx.str("font", "sans"),
          bold: ctx.bool("bold", true),
        });
        checkRange({ size: ctx.num("size") }, p, {});
        const svg = m.placeholderSvg(p);
        const dataUri = m.svgDataUri(svg);
        const base64 = m.svgBase64Uri(svg);
        const f = ctx.str("format", "svg");
        return {
          text: f === "data-uri" ? dataUri : f === "base64" ? base64 : svg,
          json: { placeholder: p, svg, dataUri, base64 },
        };
      },
    },
    {
      name: "type-scale",
      tool: "type-scale",
      summary:
        "Generate a modular type scale (fluid clamp() or static rem) as CSS variables or Tailwind.",
      usage:
        "toolbelt type-scale [--base <px>] [--ratio <r>] [--min-base <px>] [--min-ratio <r>] [--up <n>] [--down <n>] [--static] [--format css|tailwind4|tailwind3|table]",
      options: [
        {
          name: "base",
          type: "number",
          desc: "Base size at the large viewport (px).",
          default: 18,
        },
        {
          name: "ratio",
          type: "number",
          desc: "Ratio at the large viewport (1.2 minor third, 1.25 major third, 1.333, 1.5, 1.618…).",
          default: 1.25,
        },
        {
          name: "min-base",
          type: "number",
          desc: "Base size at the small viewport (px, fluid).",
          default: 16,
        },
        {
          name: "min-ratio",
          type: "number",
          desc: "Ratio at the small viewport (fluid).",
          default: 1.2,
        },
        { name: "up", type: "number", desc: "Steps above the base (0–12).", default: 5 },
        { name: "down", type: "number", desc: "Steps below the base (0–6).", default: 2 },
        { name: "root", type: "number", desc: "Root font size (px) for rem.", default: 16 },
        { name: "min-vw", type: "number", desc: "Small viewport width (px).", default: 360 },
        { name: "max-vw", type: "number", desc: "Large viewport width (px).", default: 1280 },
        {
          name: "prefix",
          type: "string",
          desc: "Variable prefix (--<prefix>-<n>).",
          default: "step",
        },
        { name: "static", type: "boolean", desc: "One size per step (no clamp())." },
        {
          name: "format",
          type: "string",
          values: ["css", "tailwind4", "tailwind3", "table"],
          desc: "CSS variables, Tailwind v4 @theme, Tailwind v3 config, or a table of sizes.",
          default: "css",
        },
      ],
      examples: [
        { cmd: "toolbelt type-scale --base 16 --ratio 1.333 --static" },
        { cmd: "toolbelt type-scale --format tailwind4" },
        { cmd: "toolbelt type-scale --format table" },
      ],
      async run(ctx) {
        noArgs(ctx);
        const m = await import("../../src/tools/design/type-scale/logic");
        const nums = {
          base: ctx.num("base"),
          ratio: ctx.num("ratio"),
          minBase: ctx.num("min-base"),
          minRatio: ctx.num("min-ratio"),
          up: ctx.num("up"),
          down: ctx.num("down"),
          root: ctx.num("root"),
          minVw: ctx.num("min-vw"),
          maxVw: ctx.num("max-vw"),
        };
        const s = m.cleanScale({
          ...m.DEFAULT,
          ...Object.fromEntries(Object.entries(nums).filter(([, v]) => v !== undefined)),
          prefix: ctx.str("prefix", m.DEFAULT.prefix),
          fluid: !ctx.bool("static"),
        });
        checkRange(nums, s, {
          minBase: "min-base",
          minRatio: "min-ratio",
          minVw: "min-vw",
          maxVw: "max-vw",
        });
        const steps = m.steps(s);
        const f = ctx.str("format", "css");
        const text =
          f === "tailwind4"
            ? m.scaleTailwind4(s)
            : f === "tailwind3"
              ? m.scaleTailwind3(s)
              : f === "table"
                ? table(
                    steps.map((st) => [
                      st.step,
                      st.name,
                      num(st.minPx, 2),
                      num(st.maxPx, 2),
                      st.value,
                    ]),
                    ["STEP", "VARIABLE", "MIN PX", "MAX PX", "VALUE"],
                  )
                : m.scaleCss(s);
        return { text, json: { scale: s, steps } };
      },
    },
    {
      name: "palette",
      tool: "palette",
      summary:
        "A 50–950 color scale and harmonies from one color, as CSS variables, Tailwind or JSON, with WCAG hints.",
      usage:
        "toolbelt palette <color> [--harmony <kind>] [--name <n>] [--color-format hex|oklch] [--no-keep-base] [--format css|tailwind4|tailwind3|json|table]",
      options: [
        {
          name: "harmony",
          type: "string",
          values: ["complementary", "analogous", "triadic", "split", "tetradic", "monochrome"],
          desc: "Harmony to compute.",
          default: "complementary",
        },
        { name: "name", type: "string", desc: "Color name for variables.", default: "primary" },
        {
          name: "color-format",
          type: "string",
          values: ["hex", "oklch"],
          desc: "How colors are written.",
          default: "hex",
        },
        {
          name: "keep-base",
          type: "boolean",
          desc: "The nearest step is the base color itself (--no-keep-base to compute it).",
          default: true,
        },
        {
          name: "format",
          type: "string",
          values: ["css", "tailwind4", "tailwind3", "json", "table"],
          desc: "CSS variables, Tailwind v4/v3, JSON, or a table with contrast (WCAG) hints.",
          default: "css",
        },
      ],
      examples: [
        { cmd: 'toolbelt palette "#3b82f6"' },
        { cmd: 'toolbelt palette "#0f766e" --name brand --format tailwind4' },
        { cmd: "toolbelt palette tomato --harmony triadic --format table" },
      ],
      async run(ctx) {
        const input = (await ctx.text()).trim();
        const { parseColor } = await import("../../src/tools/design/_shared");
        const m = await import("../../src/tools/design/palette/logic");
        const c = parseColor(input);
        if (!c) throw new CliError(`"${input}" is not a CSS color`);
        const name = m.cleanName(ctx.str("name", "primary"));
        const kind = ctx.str(
          "harmony",
          "complementary",
        ) as import("../../src/tools/design/palette/logic").Harmony;
        const cf = ctx.str(
          "color-format",
          "hex",
        ) as import("../../src/tools/design/palette/logic").ColorFormat;
        const steps = m.scale(c, ctx.bool("keep-base", true));
        const harmony = m.harmony(c, kind);
        const f = ctx.str("format", "css");
        let text: string;
        if (f === "tailwind4") text = m.tailwind4(name, steps, cf);
        else if (f === "tailwind3") text = m.tailwind3(name, steps, cf);
        else if (f === "json") text = m.toJson(name, steps, harmony, kind, cf);
        else if (f === "table") {
          const rows = steps.map((s) => {
            const h = m.contrastHint(s.hex);
            return [
              `${s.step}${s.base ? "*" : ""}`,
              s.hex,
              s.oklch,
              `${num(h.white, 2)} ${h.whiteLevel}`,
              `${num(h.black, 2)} ${h.blackLevel}`,
              h.text,
            ];
          });
          text = [
            table(rows, ["STEP", "HEX", "OKLCH", "WHITE TEXT", "BLACK TEXT", "BEST TEXT"]),
            "",
            `Harmony (${kind}): ${harmony.map((s) => (cf === "hex" ? s.hex : s.oklch)).join(", ")}`,
            "* = the base color",
          ].join("\n");
        } else text = m.cssVars(name, steps, cf);
        return {
          text,
          json: {
            name,
            scale: steps.map((s) => ({ ...s, contrast: m.contrastHint(s.hex) })),
            harmony: { type: kind, colors: harmony },
          },
        };
      },
    },
  ],
};
