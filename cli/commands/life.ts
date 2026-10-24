/**
 * Timers, chance & devices. Random draws and countdowns run here; live timers, sound,
 * microphone, camera and drawing tools need the browser.
 */
import type { L10n } from "../../src/i18n";
import { kv, table } from "../format";
import { CliError, type CommandGroup, type CommandSpec, type Ctx, UsageError } from "../types";

function browser(id: string, summary: string, reason: string): CommandSpec {
  return {
    name: id,
    tool: id,
    summary,
    usage: `toolbelt ${id}`,
    browserOnly: true,
    browserReason: reason,
    examples: [{ cmd: `toolbelt ${id}` }],
  };
}

type Res<T> = { ok: true; value: T } | { ok: false; error: L10n };

/** The value of a logic Result, or its (translated by the runner) error. */
function unwrap<T>(r: Res<T>): T {
  if (!r.ok) throw new CliError(r.error);
  return r.value;
}

const MODES = ["number", "dice", "coin", "shuffle", "pick", "teams", "santa"] as const;
type Mode = (typeof MODES)[number];

/** List items: the arguments, else one per line from --file or stdin. */
async function listItems(ctx: Ctx, rest: string[]): Promise<string[]> {
  const { parseList } = await import("../../src/tools/life/random/logic");
  if (rest.length) return rest.map((s) => s.trim()).filter(Boolean);
  const file = ctx.str("file");
  const text = await ctx.readTextFile(file ?? "-");
  return parseList(text);
}

export const group: CommandGroup = {
  category: "life",
  commands: [
    browser("stopwatch", "Stopwatch with laps.", "it is a live timer"),
    browser(
      "timer",
      "Several named countdown timers with an end sound.",
      "it is a live timer with sound",
    ),
    browser("pomodoro", "Pomodoro focus sessions and breaks.", "it is a live timer with sound"),
    {
      name: "countdown",
      tool: "countdown",
      summary:
        "Time left until a date (days, hours, minutes), calendar days and working days left.",
      usage: "toolbelt countdown <YYYY-MM-DD[THH:mm] | MM-DD> [--holidays <dates>]",
      options: [
        {
          name: "holidays",
          type: "string",
          arg: "<dates>",
          desc: "Days off to skip in the working days, comma-separated YYYY-MM-DD.",
        },
      ],
      notes:
        "Dates are in local time. MM-DD means the next time that day comes (birthdays, holidays).",
      examples: [
        { cmd: "toolbelt countdown 2026-12-25" },
        { cmd: "toolbelt countdown 2026-07-14T18:00 --json" },
        { cmd: 'toolbelt countdown 2026-05-31 --holidays "2026-05-01,2026-05-08,2026-05-14"' },
        { cmd: "toolbelt countdown 12-25", desc: "Next Christmas." },
      ],
      async run(ctx) {
        const input = (await ctx.text()).trim();
        const m = await import("../../src/tools/life/countdown/logic");
        let date = input;
        const annual = /^(\d{1,2})-(\d{1,2})$/.exec(input);
        if (annual) date = m.nextAnnual(Number(annual[1]), Number(annual[2]), ctx.now);
        const target = m.parseLocal(date);
        if (!target)
          throw new CliError(`"${input}" is not a date like 2026-12-25, 2026-12-25T18:00 or 12-25`);
        const holidays = (ctx.str("holidays") ?? "").split(/[\s,;]+/).filter(Boolean);
        const bad = holidays.find((h) => !m.parseLocal(h));
        if (bad) throw new CliError(`--holidays: "${bad}" is not a date like 2026-05-01`);
        const p = m.breakdown(target.getTime(), ctx.now.getTime());
        const calendarDays = m.calendarDays(ctx.now, target);
        const workingDays = p.past ? 0 : m.workingDays(ctx.now, target, holidays);
        const span = `${p.days} d ${p.hours} h ${p.minutes} min ${p.seconds} s`;
        return {
          text: kv([
            ["Date", date],
            [p.past ? "Time since" : "Time left", span],
            ["Calendar days", calendarDays],
            ["Working days left", p.past ? undefined : workingDays],
          ]),
          json: { date, target: target.toISOString(), ...p, calendarDays, workingDays },
        };
      },
    },
    {
      name: "random",
      tool: "random",
      aliases: ["dice"],
      summary:
        "Random numbers, dice (2d6+3), coin flips, pick winners, shuffle, teams and Secret Santa.",
      usage:
        "toolbelt random [number] [--min <n>] [--max <n>] [--count <n>] [--decimals <n>] [--unique]\n" +
        "       toolbelt random dice <notation>      (or: toolbelt random 2d6+3)\n" +
        "       toolbelt random coin [--count <n>]\n" +
        "       toolbelt random shuffle|pick|teams|santa [items…] (else one per line from --file or stdin)",
      options: [
        { name: "min", type: "number", desc: "Smallest number (number mode).", default: 1 },
        { name: "max", type: "number", desc: "Largest number (number mode).", default: 100 },
        {
          name: "count",
          alias: "n",
          type: "number",
          desc: "How many numbers, flips or winners (pick).",
          default: 1,
        },
        { name: "decimals", type: "number", desc: "Decimal places (number mode).", default: 0 },
        { name: "unique", type: "boolean", desc: "No repeated numbers." },
        { name: "teams", type: "number", desc: "Number of teams (teams mode).", default: 2 },
        {
          name: "size",
          type: "number",
          desc: "Team size instead of a number of teams (teams mode).",
        },
        {
          name: "exclude",
          alias: "x",
          type: "list",
          arg: "<a,b | a>b>",
          desc: 'Secret Santa exclusion (repeatable): "Alice,Bob" both ways, "Alice>Bob" one way.',
        },
        {
          name: "seed",
          type: "number",
          desc: "Seed for a reproducible draw (default: crypto randomness).",
        },
      ],
      examples: [
        { cmd: "toolbelt random --min 1 --max 6 --count 3" },
        {
          cmd: "toolbelt random 4d6kh3+2",
          desc: "Dice notation: keep the 3 highest of 4d6, plus 2.",
        },
        { cmd: "toolbelt random coin --count 5" },
        { cmd: "toolbelt random pick Alice Bob Carol Dave --count 2" },
        { cmd: "toolbelt random teams --file names.txt --teams 3" },
        { cmd: 'toolbelt random santa Alice Bob Carol Dave --exclude "Alice,Bob"' },
      ],
      async run(ctx) {
        const r = await import("../../src/tools/life/random/logic");
        const { cryptoInt, seededInt } = await import("../../src/tools/life/_shared");
        const seed = ctx.num("seed");
        const rand = seed === undefined ? cryptoInt : seededInt(seed);
        const [first, ...rest] = ctx.args;
        let mode: Mode = "number";
        let args = ctx.args;
        if (first !== undefined && (MODES as readonly string[]).includes(first.toLowerCase())) {
          mode = first.toLowerCase() as Mode;
          args = rest;
        } else if (
          first !== undefined &&
          /^[\d\s+\-−–dwk%hl]+$/i.test(ctx.args.join("")) &&
          /[dw]/i.test(first)
        ) {
          mode = "dice";
        } else if (first !== undefined)
          throw new UsageError(
            `unknown mode "${first}" (modes: ${MODES.join(", ")}, or dice notation like 2d6)`,
          );
        const count = ctx.num("count", 1);

        if (mode === "number") {
          if (args.length) throw new UsageError(`unexpected argument "${args[0]}"`);
          const values = unwrap(
            r.randomNumbers(rand, {
              min: ctx.num("min", 1),
              max: ctx.num("max", 100),
              count,
              decimals: ctx.num("decimals", 0),
              unique: ctx.bool("unique"),
            }),
          );
          return { text: values.join("\n"), json: values };
        }
        if (mode === "dice") {
          const notation = args.join("");
          if (!notation)
            throw new UsageError("give dice notation, e.g. toolbelt random dice 2d6+3");
          const roll = r.rollDice(rand, unwrap(r.parseDice(notation)));
          const detail = roll.terms
            .map((t) =>
              t.term.count === 0
                ? `${t.term.sign < 0 ? "-" : "+"}${t.term.sides}`
                : `${t.term.sign < 0 ? "-" : "+"}${t.term.text} [${t.rolls.map((v, i) => (t.kept[i] ? String(v) : `(${v})`)).join(", ")}]`,
            )
            .join(" ")
            .replace(/^\+/, "");
          return {
            text: kv([
              ["Total", roll.total],
              ["Rolls", detail],
              ["Range", `${roll.min} to ${roll.max}`],
            ]),
            json: {
              notation: roll.notation,
              total: roll.total,
              min: roll.min,
              max: roll.max,
              terms: roll.terms.map((t) => ({
                term: t.term.text,
                sign: t.term.sign,
                rolls: t.rolls,
                kept: t.kept,
                subtotal: t.subtotal,
              })),
            },
          };
        }
        if (mode === "coin") {
          if (args.length) throw new UsageError(`unexpected argument "${args[0]}"`);
          if (!(Number.isInteger(count) && count >= 1 && count <= r.MAX_COUNT))
            throw new CliError(`--count must be between 1 and ${r.MAX_COUNT}`);
          const flips = Array.from({ length: count }, () => r.flipCoin(rand));
          return { text: flips.join("\n"), json: flips };
        }
        const items = await listItems(ctx, args);
        if (mode === "shuffle") {
          if (!items.length) throw new CliError("the list is empty");
          const out = r.shuffle(rand, items);
          return { text: out.join("\n"), json: out };
        }
        if (mode === "pick") {
          const out = unwrap(r.pick(rand, items, count));
          return { text: out.join("\n"), json: out };
        }
        if (mode === "teams") {
          const size = ctx.num("size");
          const teams = unwrap(
            size === undefined
              ? r.makeTeams(rand, items, ctx.num("teams", 2), "count")
              : r.makeTeams(rand, items, size, "size"),
          );
          return {
            text: teams.map((t, i) => `Team ${i + 1}: ${t.join(", ")}`).join("\n"),
            json: teams,
          };
        }
        const exclusions = r.parseExclusions(ctx.list("exclude").join("\n"));
        const pairs = unwrap(r.secretSanta(rand, items, exclusions));
        return {
          text: table(pairs.map((p) => [p.giver, "→", p.receiver])),
          json: pairs,
        };
      },
    },
    browser(
      "typing-test",
      "Typing speed test (words per minute, accuracy).",
      "it is an interactive keyboard test",
    ),
    browser("metronome", "Metronome with tap tempo, signatures and accents.", "it plays sound"),
    browser("tone", "Tone and noise generator.", "it plays sound"),
    browser("tuner", "Instrument tuner (chromatic and guitar).", "it needs a microphone"),
    browser(
      "devices",
      "Camera, microphone and speaker test.",
      "it needs a camera and a microphone",
    ),
    browser(
      "screen-test",
      "Screen colors, dead pixels, refresh rate and keyboard test.",
      "it tests the screen and keyboard",
    ),
    browser("tally", "Tally counter and scoreboard.", "it is an interactive counter"),
    browser(
      "signature",
      "Draw a signature and save it as PNG or SVG.",
      "it needs drawing with a mouse, finger or pen",
    ),
  ],
};
