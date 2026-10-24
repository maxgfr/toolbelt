/** Time & numbers tools. Each command imports its tool's logic lazily. */
import { locale } from "../../src/i18n";
import { kv, num, table } from "../format";
import { CliError, type CommandGroup, type Ctx, UsageError } from "../types";

const shared = () => import("../../src/tools/convert/_shared");

/** A number from a positional or an option value ("1 234,5" and "1,234.5" both work). */
async function readNumber(raw: string | undefined, what: string): Promise<number> {
  if (raw === undefined) throw new UsageError(`missing ${what}`);
  const { parseNumber } = await shared();
  const n = parseNumber(raw);
  if (n === null) throw new CliError(`${what} is not a number: "${raw}"`);
  return n;
}

/** A valid IANA zone: an exact name, else the best match of a search ("paris", "est", "tokyo"). */
async function readZone(raw: string): Promise<string> {
  const { isValidZone, searchZones, timeZones } = await shared();
  // IANA names ("Europe/Paris") and UTC as is; "est", "paris", "tokyo" through the zone search.
  if (isValidZone(raw) && (raw.includes("/") || /^(utc|gmt)$/i.test(raw)))
    return /^(utc|gmt)$/i.test(raw) ? "UTC" : raw;
  const found = searchZones(raw, timeZones())[0] ?? (isValidZone(raw) ? raw : undefined);
  if (!found) throw new CliError(`unknown time zone "${raw}" (use an IANA name like Europe/Paris)`);
  return found;
}

const zoneOption = {
  name: "zone",
  alias: "z",
  type: "string",
  arg: "<zone>",
  desc: "Time zone (IANA name, or a city/abbreviation like paris, est).",
  default: "UTC",
} as const;

/** A converted value with 10 significant digits (tiny and huge ones in exponent notation). */
function sig(n: number): string {
  return String(Number(n.toPrecision(10)));
}

/** "1 d 2 h 3 min 4 s" from seconds. */
async function duration(seconds: number): Promise<string> {
  if (!Number.isFinite(seconds)) return "never";
  const { splitSeconds } = await shared();
  const s = splitSeconds(Math.abs(seconds));
  const parts = [
    s.days && `${s.days} d`,
    s.hours && `${s.hours} h`,
    s.minutes && `${s.minutes} min`,
    (s.seconds || (!s.days && !s.hours && !s.minutes)) && `${num(s.seconds, 3)} s`,
  ].filter(Boolean);
  return parts.join(" ");
}

async function timestamp(ctx: Ctx) {
  const input = (await ctx.text({ required: false })).trim();
  const zone = await readZone(ctx.str("zone", "UTC"));
  const { parseInput, breakdown } = await import("../../src/tools/convert/timestamp/logic");
  const { relative } = await shared();
  const now = ctx.now.getTime();
  const p = input
    ? parseInput(input, ctx.str("unit", "auto") as "auto", zone)
    : ({ ok: true, ms: now, kind: "date", format: "now" } as const);
  if (!p.ok) {
    if (p.error === "range") throw new CliError("this timestamp is out of the range of dates");
    throw new CliError(
      `cannot read "${input}": give a Unix timestamp (s, ms, µs or ns) or a date (ISO 8601, RFC 2822)`,
    );
  }
  const b = breakdown(p.ms, zone, p.kind === "number" ? p.subMs : 0);
  const read =
    p.kind === "number"
      ? `timestamp in ${{ s: "seconds", ms: "milliseconds", us: "microseconds", ns: "nanoseconds" }[p.unit]}`
      : p.format;
  const rel = relative(p.ms, now, locale());
  return {
    text: kv([
      ["Read as", read],
      ["ISO 8601 (UTC)", b.isoUtc],
      [`ISO 8601 (${zone})`, zone === "UTC" ? undefined : b.isoZone],
      ["RFC 2822", b.rfc2822],
      ["Unix seconds", b.seconds],
      ["Unix milliseconds", b.millis],
      ["Unix microseconds", b.micros],
      ["Unix nanoseconds", b.nanos],
      ["Day of year", b.dayOfYear],
      ["ISO week", `${b.week.year}-W${String(b.week.week).padStart(2, "0")}`],
      ["Relative", rel],
    ]),
    json: { input: input || null, readAs: read, zone, ...b, relative: rel },
  };
}

async function timezones(ctx: Ctx) {
  const { convertZones, nowIn, splitDiff } = await import(
    "../../src/tools/convert/timezones/logic"
  );
  const { timeZones, searchZones, formatOffset } = await shared();
  const search = ctx.str("search");
  if (search !== undefined) {
    const found = searchZones(search, timeZones(), ctx.now).slice(0, 20);
    if (!found.length) throw new CliError(`no time zone matches "${search}"`);
    return { text: found.join("\n"), json: found };
  }
  const from = await readZone(ctx.str("from", "UTC"));
  const targets: string[] = [];
  for (const t of ctx
    .list("to")
    .flatMap((x) => x.split(","))
    .map((x) => x.trim())
    .filter(Boolean))
    targets.push(await readZone(t));
  if (!targets.length)
    targets.push(
      ...["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"].filter((z) => z !== from),
    );
  const now = nowIn(from, ctx.now);
  let [date, time] = ctx.args;
  if (ctx.args.length > 2)
    throw new UsageError("give at most a date and a time: [YYYY-MM-DD] [HH:mm]");
  const t = ctx.args.length === 1 && date && /^\d{1,2}:\d{2}/.test(date) ? date : time;
  if (t === date) date = undefined;
  const r = convertZones(date ?? now.date, t ?? now.time, from, targets);
  if (!r.ok)
    throw new CliError(
      r.error === "date"
        ? `invalid date "${date}" (use YYYY-MM-DD)`
        : r.error === "time"
          ? `invalid time "${t}" (use HH:mm)`
          : `invalid zone "${from}"`,
    );
  const diff = (m: number) => {
    const s = splitDiff(m);
    return s.sign ? `${s.sign}${s.hours} h${s.minutes ? ` ${s.minutes} min` : ""}` : "same";
  };
  const shift = (d: number) => (d > 0 ? ` (+${d} day)` : d < 0 ? ` (${d} day)` : "");
  const rows = [r.source, ...r.rows];
  return {
    text: [
      ...(r.shifted
        ? ["Note: that time does not exist in the source zone (DST gap); moved forward.", ""]
        : []),
      table(
        rows.map((x, i) => [
          x.zone,
          `${x.date} ${x.time}${shift(x.dayShift)}`,
          `UTC${formatOffset(x.offset)}`,
          i === 0 ? "(source)" : diff(x.diff),
        ]),
      ),
    ].join("\n"),
    json: {
      instant: r.instant.toISOString(),
      shifted: r.shifted,
      source: r.source,
      targets: r.rows,
    },
  };
}

const DURATION_UNITS = ["years", "months", "weeks", "days", "hours", "minutes"] as const;

async function dateCalc(ctx: Ctx) {
  const { readDateTime, difference, addDuration, addBusinessDays, formatDateTime, weekday } =
    await import("../../src/tools/convert/date-calc/logic");
  const { isoDate, wallClock } = await shared();
  const today = isoDate(wallClock(ctx.now, "UTC"));
  const read = (s: string) => {
    const [d = "", t = ""] = s.trim().split(/[T\s]+/);
    const r = readDateTime(d, t);
    if (r === "date")
      throw new CliError(`invalid date "${s}" (use YYYY-MM-DD or YYYY-MM-DDTHH:mm)`);
    if (r === "time") throw new CliError(`invalid time in "${s}" (use HH:mm)`);
    return r;
  };
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const adding =
    DURATION_UNITS.some((u) => ctx.num(u) !== undefined) || ctx.num("workdays") !== undefined;
  if (adding) {
    if (ctx.args.length > 1) throw new UsageError("add mode takes one start date");
    const start = read(ctx.args[0] ?? today);
    const dur = { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0 };
    for (const u of DURATION_UNITS) {
      const v = ctx.num(u, 0);
      if (!Number.isInteger(v)) throw new CliError(`--${u} must be a whole number`);
      dur[u] = v;
    }
    const w = ctx.num("workdays", 0);
    if (!Number.isInteger(w)) throw new CliError("--workdays must be a whole number");
    const sign = ctx.bool("subtract") ? -1 : 1;
    let res = addDuration(start, dur, sign);
    if (w) res = addBusinessDays(res, sign * w);
    const iso =
      res.hour || res.minute || /[T\s]\d/.test(ctx.args[0] ?? "")
        ? formatDateTime(res)
        : formatDateTime(res).slice(0, 10);
    return {
      text: `${iso} (${DAYS[weekday(res)]})`,
      json: { start: formatDateTime(start), result: iso, weekday: DAYS[weekday(res)] },
    };
  }
  if (ctx.args.length > 2) throw new UsageError("give two dates: <start> [end]");
  const [a, b] = ctx.args;
  if (!a) throw new UsageError("missing date (see: toolbelt help date-calc)");
  const start = b === undefined ? read(today) : read(a);
  const end = read(b ?? a);
  const r = difference(start, end, ctx.bool("include-end"));
  const head = [
    r.years && `${r.years} year${r.years > 1 ? "s" : ""}`,
    r.months && `${r.months} month${r.months > 1 ? "s" : ""}`,
    (r.days || (!r.years && !r.months && !r.hours && !r.minutes)) &&
      `${r.days} day${r.days === 1 ? "" : "s"}`,
    r.hours && `${r.hours} h`,
    r.minutes && `${r.minutes} min`,
  ]
    .filter(Boolean)
    .join(", ");
  return {
    text: [
      `${formatDateTime(start)} → ${formatDateTime(end)}: ${head}${r.sign < 0 ? " (the end is before the start)" : ""}`,
      kv([
        ["Total days", r.totalDays],
        ["Weeks", r.weekDays ? `${r.weeks} + ${r.weekDays} d` : r.weeks],
        ["Months", r.totalMonths],
        ["Hours", r.totalHours],
        ["Minutes", r.totalMinutes],
        ["Business days (Mon–Fri)", r.businessDays],
      ]),
    ].join("\n"),
    json: { start: formatDateTime(start), end: formatDateTime(end), ...r },
  };
}

async function cron(ctx: Ctx) {
  const expr = await ctx.text();
  const { parseCron, describeCron, nextRuns } = await import("../../src/tools/convert/cron/logic");
  const { isoInZone } = await import("../../src/tools/convert/timestamp/logic");
  const p = parseCron(expr);
  if (!p.ok) {
    if (p.error === "empty") throw new UsageError('missing cron expression, e.g. "0 9 * * 1-5"');
    if (p.error === "count")
      throw new CliError(`a cron expression has 5 fields (or 6 with seconds): found ${p.count}`);
    throw new CliError(`this expression is not valid: ${"detail" in p ? p.detail : ""}`);
  }
  const zone = await readZone(ctx.str("zone", "UTC"));
  const n = ctx.num("next", 5);
  if (!Number.isInteger(n) || n < 0 || n > 100) throw new UsageError("--next must be 0 to 100");
  let from = ctx.now;
  const fromRaw = ctx.str("from");
  if (fromRaw !== undefined) {
    const { parseInput } = await import("../../src/tools/convert/timestamp/logic");
    const f = parseInput(fromRaw, "auto", zone);
    if (!f.ok) throw new CliError(`invalid --from date "${fromRaw}"`);
    from = new Date(f.ms);
  }
  const description = describeCron(p.expr, ctx.lang);
  const runs = n ? nextRuns(p.expr, n, from, zone).map((d) => isoInZone(d.getTime(), zone)) : [];
  return {
    text: [
      description ?? p.expr,
      "",
      table(p.fields.map((f) => [f.name, f.value])),
      ...(n ? ["", `Next ${n} runs (${zone}):`, ...(runs.length ? runs : ["(none)"])] : []),
    ].join("\n"),
    json: { expr: p.expr, description, fields: p.fields, zone, next: runs },
  };
}

async function numberBase(ctx: Ctx) {
  const input = (await ctx.text()).trim();
  const { parseInBase, toBase, groupDigits, groupSize, twosComplement, bitLength } = await import(
    "../../src/tools/convert/number-base/logic"
  );
  let from = ctx.num("from");
  if (from === undefined) {
    const m = /^[+\-−]?0([xbo])/i.exec(input);
    from = m ? { x: 16, b: 2, o: 8 }[m[1]?.toLowerCase() as "x"] : 10;
  }
  const p = parseInBase(input, from);
  if (!p.ok) {
    if (p.error === "base") throw new UsageError("--from must be a base from 2 to 36");
    if (p.error === "digit") throw new CliError(`"${p.char}" is not a digit in base ${from}`);
    throw new UsageError("missing number");
  }
  const upper = !ctx.bool("lower");
  const show = (base: number) => {
    const s = toBase(p.value, base, upper);
    return ctx.bool("group") ? groupDigits(s, groupSize(base)) : s;
  };
  const to = ctx.num("to");
  if (to !== undefined && !(Number.isInteger(to) && to >= 2 && to <= 36))
    throw new UsageError("--to must be a base from 2 to 36");
  const bases: [string, number][] = [
    ["Binary (2)", 2],
    ["Octal (8)", 8],
    ["Decimal (10)", 10],
    ["Hexadecimal (16)", 16],
    ["Base 36", 36],
  ];
  const bits = ctx.num("bits");
  const tc = bits === undefined ? null : twosComplement(p.value, bits);
  if (bits !== undefined && ![8, 16, 32, 64, 128].includes(bits))
    throw new UsageError("--bits must be 8, 16, 32, 64 or 128");
  if (to !== undefined) return { text: show(to), json: { input, from, to, result: show(to) } };
  const pairs: [string, string | number][] = bases.map(([label, b]) => [label, show(b)]);
  pairs.push(["Bits", bitLength(p.value)]);
  if (tc)
    pairs.push(
      [`${bits}-bit binary`, ctx.bool("group") ? groupDigits(tc.binary, 4) : tc.binary],
      [`${bits}-bit hex`, tc.hex],
      [`${bits}-bit signed`, tc.signed.toString()],
      [`${bits}-bit unsigned`, tc.unsigned.toString()],
      ["Fits", tc.fits ? "yes" : "no (truncated)"],
    );
  return {
    text: kv(pairs),
    json: {
      input,
      from,
      binary: show(2),
      octal: show(8),
      decimal: show(10),
      hex: show(16),
      base36: show(36),
      bits: bitLength(p.value),
      twosComplement: tc,
    },
  };
}

async function bytes(ctx: Ctx) {
  const { SIZE_UNITS, RATE_UNITS, convertSize, humanSize, transferSeconds } = await import(
    "../../src/tools/convert/bytes/logic"
  );
  const raw = ctx.args.join(" ").trim() || (await ctx.text()).trim();
  const m = /^(.*?)\s*([a-zA-Z]+)$/.exec(raw);
  const findUnit = (u: string) =>
    SIZE_UNITS.find((x) => x.id === u) ??
    SIZE_UNITS.find((x) => x.id.toLowerCase() === u.toLowerCase());
  let unitId = ctx.str("unit");
  let valueText = raw;
  if (m?.[2] && findUnit(m[2]) && m[1]) {
    unitId ??= findUnit(m[2])?.id;
    valueText = m[1];
  }
  const unit = findUnit(unitId ?? "B");
  if (!unit)
    throw new CliError(
      `unknown unit "${unitId}" (units: ${SIZE_UNITS.map((u) => u.id).join(", ")})`,
    );
  const value = await readNumber(valueText, "size");
  const all = convertSize(value, unit.id);
  const to = ctx.str("to");
  if (to !== undefined) {
    const t = findUnit(to);
    if (!t) throw new CliError(`unknown unit "${to}"`);
    const v = all.find((x) => x.id === t.id)?.value ?? 0;
    return { text: `${sig(v)} ${t.id}`, json: { value, unit: unit.id, to: t.id, result: v } };
  }
  const bytesValue = all.find((x) => x.id === "B")?.value ?? 0;
  const si = humanSize(bytesValue, "si");
  const iec = humanSize(bytesValue, "iec");
  const lines = [
    kv([
      ["SI (1000)", `${num(si.value, 3)} ${si.id}`],
      ["IEC (1024)", `${num(iec.value, 3)} ${iec.id}`],
    ]),
    "",
    table(all.map((x) => [x.id, sig(x.value)])),
  ];
  let transfer: number | null = null;
  const rate = ctx.str("rate");
  if (rate !== undefined) {
    const rm = /^\s*([\d.,\s]+)\s*([a-zA-Z/]+)?\s*$/.exec(rate);
    const rateUnit = rm?.[2] ?? "Mbit/s";
    if (!RATE_UNITS.some((r) => r.id === rateUnit))
      throw new CliError(
        `unknown rate unit "${rateUnit}" (units: ${RATE_UNITS.map((r) => r.id).join(", ")})`,
      );
    const rv = await readNumber(rm?.[1], "rate");
    transfer = transferSeconds(value, unit.id, rv, rateUnit);
    if (transfer === null) throw new CliError("the rate must be positive");
    lines.unshift(`Transfer time at ${num(rv)} ${rateUnit}: ${await duration(transfer)}`, "");
  }
  return {
    text: lines.join("\n"),
    json: { value, unit: unit.id, si, iec, units: all, transferSeconds: transfer },
  };
}

async function roman(ctx: Ctx) {
  const input = await ctx.text();
  const { convert, romanParts, MAX } = await import("../../src/tools/convert/roman/logic");
  const r = convert(input);
  if (r.kind === "empty") throw new UsageError("missing number or numeral");
  if (r.kind === "number") {
    if (r.roman === null)
      throw new CliError(`Roman numerals go from 1 to ${MAX}: ${r.value} is out of range`);
    return { text: r.roman, json: { number: r.value, roman: r.roman, parts: romanParts(r.value) } };
  }
  const res = r.result;
  if (res.ok)
    return {
      text: String(res.value),
      json: { roman: input.trim().toUpperCase(), number: res.value },
    };
  if (res.error === "char")
    throw new CliError(`"${res.char}" is not a Roman numeral (I V X L C D M)`);
  if (res.error === "form")
    throw new CliError(
      `"${input.trim()}" is not a standard numeral${res.canonical ? `; read leniently it is ${res.value}, written ${res.canonical}` : ""}`,
    );
  throw new UsageError("missing numeral");
}

async function numberWords(ctx: Ctx) {
  const input = await ctx.text();
  const { parseDecimal, numberToWords, moneyToWords, enOrdinal, frOrdinal, deOrdinal } =
    await import("../../src/tools/convert/number-words/logic");
  const p = parseDecimal(input);
  if (!p.ok) {
    if (p.error === "big") throw new CliError("the number is too large (up to 10^36 − 1)");
    if (p.error === "empty") throw new UsageError("missing number");
    throw new CliError(`"${input.trim()}" is not a number`);
  }
  const language = (ctx.str("language") ?? ctx.lang) as "en" | "fr" | "de";
  const o = { reform: ctx.bool("reform"), variant: ctx.str("variant", "fr") as "fr" };
  const currency = ctx.str("currency") as "eur" | "usd" | undefined;
  if (ctx.bool("ordinal")) {
    if (p.negative || p.frac.replace(/0+$/, ""))
      throw new CliError("ordinals need a positive whole number");
    const ord =
      language === "fr"
        ? frOrdinal(p.int, o)
        : language === "de"
          ? deOrdinal(p.int)
          : enOrdinal(p.int);
    if (ord === null) throw new CliError("ordinals start at 1");
    return { text: ord, json: { input: input.trim(), language, ordinal: ord } };
  }
  const words = currency ? moneyToWords(p, currency, language, o) : numberToWords(p, language, o);
  return {
    text: words,
    json: { input: input.trim(), language, currency: currency ?? null, words },
  };
}

const PERCENT_OPS = ["of", "what", "change", "add", "reverse", "diff"] as const;

async function percentage(ctx: Ctx) {
  const [op, x, y, extra] = ctx.args;
  if (!op || !PERCENT_OPS.includes(op as (typeof PERCENT_OPS)[number]))
    throw new UsageError(
      `start with one of: ${PERCENT_OPS.join(", ")} (see: toolbelt help percentage)`,
    );
  if (extra !== undefined || y === undefined) throw new UsageError(`"${op}" takes two numbers`);
  const a = await readNumber(x, "the first number");
  const b = await readNumber(y, "the second number");
  const L = await import("../../src/tools/convert/percentage/logic");
  const [value, text] = (() => {
    switch (op) {
      case "of":
        return [L.percentOf(a, b), (v: number) => `${num(a)} % of ${num(b)} = ${num(v, 10)}`];
      case "what":
        return [L.whatPercent(a, b), (v: number) => `${num(a)} is ${num(v, 10)} % of ${num(b)}`];
      case "change":
        return [
          L.percentChange(a, b),
          (v: number) => `${num(a)} → ${num(b)}: ${v >= 0 ? "+" : ""}${num(v, 10)} %`,
        ];
      case "add":
        return [
          L.addPercent(b, a),
          (v: number) => `${num(b)} ${a >= 0 ? "+" : "−"} ${num(Math.abs(a))} % = ${num(v, 10)}`,
        ];
      case "reverse":
        return [
          L.reversePercent(b, a),
          (v: number) =>
            `${num(b)} after ${a >= 0 ? "+" : "−"}${num(Math.abs(a))} % was ${num(v, 10)}`,
        ];
      default:
        return [
          L.percentDifference(a, b),
          (v: number) => `difference between ${num(a)} and ${num(b)}: ${num(v, 10)} %`,
        ];
    }
  })();
  if (value === null) throw new CliError("undefined (division by zero)");
  const v = L.clean(value);
  return { text: text(v), json: { op, a, b, result: v } };
}

async function units(ctx: Ctx) {
  const { CATEGORIES, convert, convertAll, belowAbsoluteZero, findUnit } = await import(
    "../../src/tools/convert/units/logic"
  );
  const { t } = await import("../meta");
  const catId = ctx.str("category");
  if (catId !== undefined && !CATEGORIES.some((c) => c.id === catId))
    throw new UsageError(
      `unknown category "${catId}" (categories: ${CATEGORIES.map((c) => c.id).join(", ")})`,
    );
  if (ctx.bool("list")) {
    const cats = CATEGORIES.filter((c) => !catId || c.id === catId);
    return {
      text: cats
        .map(
          (c) =>
            `${c.id}: ${c.units.map((u) => (u.id === u.symbol ? u.id : `${u.id} (${u.symbol})`)).join(", ")}`,
        )
        .join("\n"),
      json: cats.map((c) => ({
        id: c.id,
        name: t(c.name),
        units: c.units.map((u) => ({ id: u.id, symbol: u.symbol, name: t(u.name) })),
      })),
    };
  }
  const words = ctx.args.filter((w) => !/^(to|in|en|nach)$/i.test(w));
  if (!words.length) throw new UsageError("missing value and unit, e.g. toolbelt units 5 km mi");
  const first = /^(-?[\d.,_\s]+)([^\d\s].*)$/.exec(words[0] ?? "");
  if (first) words.splice(0, 1, first[1] as string, first[2] as string);
  const [valueText, fromRaw, toRaw] = words;
  const value = await readNumber(valueText, "value");
  if (!fromRaw) throw new UsageError("missing unit, e.g. toolbelt units 5 km mi");
  const pick = (raw: string, cats: typeof CATEGORIES) => {
    for (const c of cats) {
      const u =
        findUnit(c, raw) ??
        c.units.find((x) => x.symbol === raw) ??
        c.units.find(
          (x) =>
            x.id.toLowerCase() === raw.toLowerCase() ||
            x.symbol.toLowerCase() === raw.toLowerCase(),
        );
      if (u) return { cat: c, unit: u };
    }
    return null;
  };
  const scope = CATEGORIES.filter((c) => !catId || c.id === catId);
  const from = toRaw
    ? (scope.map((c) => ({ c, a: pick(fromRaw, [c]), b: pick(toRaw, [c]) })).find((x) => x.a && x.b)
        ?.a ?? pick(fromRaw, scope))
    : pick(fromRaw, scope);
  if (!from) throw new CliError(`unknown unit "${fromRaw}" (see: toolbelt units --list)`);
  if (belowAbsoluteZero(value, from.cat.id, from.unit.id))
    throw new CliError("below absolute zero");
  if (toRaw) {
    const to = pick(toRaw, [from.cat]);
    if (!to)
      throw new CliError(
        `"${toRaw}" is not a ${from.cat.id} unit (see: toolbelt units --list --category ${from.cat.id})`,
      );
    const v = convert(value, from.cat.id, from.unit.id, to.unit.id) as number;
    return {
      text: `${sig(value)} ${from.unit.symbol} = ${sig(v)} ${to.unit.symbol}`,
      json: { category: from.cat.id, value, from: from.unit.id, to: to.unit.id, result: v },
    };
  }
  const all = convertAll(value, from.cat.id, from.unit.id);
  return {
    text: table(all.map((x) => [sig(x.value), x.unit.symbol, t(x.unit.name)])),
    json: {
      category: from.cat.id,
      value,
      from: from.unit.id,
      results: all.map((x) => ({ unit: x.unit.id, value: x.value })),
    },
  };
}

async function aspectRatio(ctx: Ctx) {
  const raw = ctx.args.join(" ").trim() || (await ctx.text()).trim();
  const parts = raw.split(/\s*[x×:*/\s]\s*/).filter(Boolean);
  if (parts.length !== 2) throw new UsageError("give a size like 1920x1080 (or 16:9)");
  const w = await readNumber(parts[0], "width");
  const h = await readNumber(parts[1], "height");
  const { simplify, nearestCommon, scale, exactSizes } = await import(
    "../../src/tools/convert/aspect-ratio/logic"
  );
  const r = simplify(w, h);
  if (!r) throw new CliError("width and height must be positive numbers");
  const near = nearestCommon(r.value);
  const pairs: [string, string | number][] = [
    ["Ratio", `${r.w}:${r.h}`],
    ["Decimal", num(r.value, 4)],
    [
      "Nearest common",
      `${near.w}:${near.h}${near.off > 1e-9 ? ` (${num(near.off * 100, 2)} % off)` : ""}`,
    ],
  ];
  const tw = ctx.num("width");
  const th = ctx.num("height");
  let resized: { width: number; height: number } | null = null;
  if (tw !== undefined || th !== undefined) {
    const side = tw !== undefined ? "width" : "height";
    const size = (tw ?? th) as number;
    const other = scale(r.value, side, size);
    if (other === null) throw new CliError("the target size must be positive");
    resized = side === "width" ? { width: size, height: other } : { width: other, height: size };
    pairs.push(["Resized", `${num(resized.width, 2)} × ${num(resized.height, 2)}`]);
  }
  const exact = exactSizes(w, h);
  if (exact.length) pairs.push(["Exact sizes", exact.map((s) => `${s.w}×${s.h}`).join(", ")]);
  return {
    text: kv(pairs),
    json: {
      width: w,
      height: h,
      ratio: `${r.w}:${r.h}`,
      value: r.value,
      nearestCommon: near,
      resized,
      exactSizes: exact,
    },
  };
}

export const group: CommandGroup = {
  category: "convert",
  commands: [
    {
      name: "timestamp",
      tool: "timestamp",
      aliases: ["epoch"],
      summary:
        "Unix timestamp ↔ date: ISO 8601, RFC 2822, every unit, day of year, ISO week, relative.",
      usage: "toolbelt timestamp [timestamp|date] [--unit auto|s|ms|us|ns] [--zone <zone>]",
      options: [
        {
          name: "unit",
          alias: "u",
          type: "string",
          values: ["auto", "s", "ms", "us", "ns"],
          desc: "Unit of a numeric timestamp.",
          default: "auto",
        },
        zoneOption,
      ],
      notes: "Without input: the current time. Dates without an offset are read in --zone.",
      examples: [
        { cmd: "toolbelt timestamp 1700000000" },
        { cmd: 'toolbelt timestamp "2024-01-31 12:00" --zone Europe/Paris' },
        { cmd: "toolbelt timestamp --json", desc: "Now, every format." },
      ],
      run: timestamp,
    },
    {
      name: "timezones",
      tool: "timezones",
      aliases: ["tz"],
      summary: "Convert a date and time from one time zone to others (DST-aware).",
      usage:
        "toolbelt timezones [YYYY-MM-DD] [HH:mm] [--from <zone>] [--to <zone> ...] [--search <query>]",
      options: [
        {
          name: "from",
          type: "string",
          arg: "<zone>",
          desc: "Source zone (IANA name or city).",
          default: "UTC",
        },
        {
          name: "to",
          alias: "t",
          type: "list",
          arg: "<zone>",
          desc: "Target zone(s), repeatable or comma-separated.",
        },
        {
          name: "search",
          type: "string",
          arg: "<query>",
          desc: "List zones matching a city, abbreviation or offset.",
        },
      ],
      notes: "Without a date or time: now in the source zone.",
      examples: [
        {
          cmd: "toolbelt timezones 2026-03-10 09:00 --from Europe/Paris --to America/New_York --to Asia/Tokyo",
        },
        { cmd: "toolbelt timezones 14:30 --from est --to paris,tokyo" },
        { cmd: "toolbelt timezones --search new york" },
      ],
      run: timezones,
    },
    {
      name: "date-calc",
      tool: "date-calc",
      aliases: ["dates"],
      summary:
        "Days, weeks, months and business days between dates; add or subtract a duration or working days.",
      usage:
        "toolbelt date-calc <start> [end] [--include-end] | toolbelt date-calc [start] [--years n] [--months n] [--weeks n] [--days n] [--hours n] [--minutes n] [--workdays n] [--subtract]",
      options: [
        { name: "include-end", type: "boolean", desc: "Count the end date as a whole day." },
        ...DURATION_UNITS.map((u) => ({
          name: u,
          type: "number" as const,
          desc: `Add this many ${u}.`,
        })),
        { name: "workdays", type: "number", desc: "Add this many working days (Mon–Fri)." },
        { name: "subtract", type: "boolean", desc: "Subtract the duration instead of adding it." },
      ],
      notes:
        "Dates are YYYY-MM-DD, optionally with a time (YYYY-MM-DDTHH:mm). With one date and no duration: from today (UTC) to that date.",
      examples: [
        { cmd: "toolbelt date-calc 2026-01-01 2026-12-31" },
        { cmd: "toolbelt date-calc 2026-03-01 --days 90" },
        { cmd: "toolbelt date-calc 2026-03-02 --workdays 10 --subtract" },
      ],
      run: dateCalc,
    },
    {
      name: "cron",
      tool: "cron",
      summary: "Explain a cron expression in plain language and list its next runs.",
      usage: 'toolbelt cron "<expression>" [--next <n>] [--zone <zone>] [--from <date>]',
      options: [
        {
          name: "next",
          alias: "n",
          type: "number",
          desc: "How many next runs to list (0 to 100).",
          default: 5,
        },
        zoneOption,
        {
          name: "from",
          type: "string",
          arg: "<date>",
          desc: "Start from this date instead of now.",
        },
      ],
      notes:
        "5 fields (minute hour day month weekday), 6 with seconds first, or a macro (@daily, @hourly…). The description follows --lang.",
      examples: [
        { cmd: 'toolbelt cron "0 9 * * 1-5"' },
        { cmd: 'toolbelt cron "*/15 * * * *" --next 3 --zone Europe/Paris --json' },
        { cmd: 'toolbelt cron "@weekly" --lang fr' },
      ],
      run: cron,
    },
    {
      name: "number-base",
      tool: "number-base",
      summary: "Convert integers between bases 2–36 (any size), with two's complement.",
      usage:
        "toolbelt number-base <number> [--from <base>] [--to <base>] [--bits 8|16|32|64|128] [--group] [--lower]",
      options: [
        {
          name: "from",
          type: "number",
          desc: "Base of the input (default 10, or from a 0x/0b/0o prefix).",
        },
        { name: "to", type: "number", desc: "Only print the number in this base." },
        { name: "bits", type: "number", desc: "Show the two's complement pattern in this width." },
        { name: "group", type: "boolean", desc: "Group digits (4 for binary/hex, 3 otherwise)." },
        { name: "lower", type: "boolean", desc: "Lowercase letters." },
      ],
      examples: [
        { cmd: "toolbelt number-base 255" },
        { cmd: "toolbelt number-base 0xff --to 2" },
        { cmd: "toolbelt number-base -1 --bits 16" },
      ],
      run: numberBase,
    },
    {
      name: "bytes",
      tool: "bytes",
      summary:
        "Convert data sizes (bits, SI kB/MB/GB, IEC KiB/MiB/GiB) and compute transfer times.",
      usage: "toolbelt bytes <value>[unit] [--unit <unit>] [--to <unit>] [--rate <n unit/s>]",
      options: [
        {
          name: "unit",
          type: "string",
          arg: "<unit>",
          desc: "Unit of the value (bit, kbit, Mbit, B, kB, MB, GB, TB, PB, KiB, MiB, GiB, TiB, PiB).",
          default: "B",
        },
        { name: "to", type: "string", arg: "<unit>", desc: "Only print the value in this unit." },
        {
          name: "rate",
          type: "string",
          arg: "<n unit>",
          desc: 'Transfer rate, e.g. "100 Mbit/s" (kbit/s, Mbit/s, Gbit/s, kB/s, MB/s, GB/s, KiB/s, MiB/s).',
        },
      ],
      examples: [
        { cmd: "toolbelt bytes 1.5GB" },
        { cmd: "toolbelt bytes 1 GiB --to MB" },
        { cmd: 'toolbelt bytes 4.7 GB --rate "100 Mbit/s"' },
      ],
      run: bytes,
    },
    {
      name: "roman",
      tool: "roman",
      summary: "Numbers ↔ Roman numerals (1 to 3999), with a strict check.",
      usage: "toolbelt roman <number|numeral>",
      examples: [{ cmd: "toolbelt roman 1990" }, { cmd: "toolbelt roman MMXXVI" }],
      run: roman,
    },
    {
      name: "number-words",
      tool: "number-words",
      summary:
        "Write a number out in words (English, French, German): cardinal, ordinal, or an amount of money.",
      usage:
        "toolbelt number-words <number> [--language en|fr|de] [--currency eur|usd] [--ordinal] [--variant fr|be|ch] [--reform]",
      options: [
        {
          name: "language",
          type: "string",
          values: ["en", "fr", "de"],
          desc: "Language of the words (default: --lang).",
        },
        {
          name: "currency",
          alias: "c",
          type: "string",
          values: ["eur", "usd"],
          desc: "Write an amount of money.",
        },
        { name: "ordinal", type: "boolean", desc: "Ordinal (first, premier, erste)." },
        {
          name: "variant",
          type: "string",
          values: ["fr", "be", "ch"],
          desc: "French tens: France, Belgium (septante, nonante), Switzerland (huitante).",
          default: "fr",
        },
        { name: "reform", type: "boolean", desc: "French 1990 spelling (hyphens everywhere)." },
      ],
      examples: [
        { cmd: "toolbelt number-words 1234.56" },
        { cmd: "toolbelt number-words 1234.56 --language fr --currency eur" },
        { cmd: "toolbelt number-words 21 --ordinal --language de" },
      ],
      run: numberWords,
    },
    {
      name: "percentage",
      tool: "percentage",
      aliases: ["percent"],
      summary:
        "Everyday percentages: X % of Y, X is what % of Y, change, add, reverse, difference.",
      usage: "toolbelt percentage <of|what|change|add|reverse|diff> <x> <y>",
      notes:
        "of X Y: X % of Y. what X Y: X is what % of Y. change X Y: % change from X to Y. add X Y: Y plus X % (negative X subtracts). reverse X Y: the value before a change of X % that gave Y. diff X Y: % difference (relative to the mean).",
      examples: [
        { cmd: "toolbelt percentage of 15 200" },
        { cmd: "toolbelt percentage change 80 100" },
        { cmd: "toolbelt percentage reverse 20 120", desc: "120 after +20 % was 100." },
      ],
      run: percentage,
    },
    {
      name: "units",
      tool: "units",
      summary:
        "Convert units: length, mass, temperature, volume, area, speed, time, energy, pressure, data rate.",
      usage:
        "toolbelt units <value> <from> [to] [--category <id>] | toolbelt units --list [--category <id>]",
      options: [
        {
          name: "category",
          type: "string",
          arg: "<id>",
          desc: "Category, when a unit id is ambiguous.",
        },
        { name: "list", alias: "l", type: "boolean", desc: "List the categories and their units." },
      ],
      notes: "Without a target unit: the value in every unit of its category.",
      examples: [
        { cmd: "toolbelt units 5 km mi" },
        { cmd: "toolbelt units 100 f c", desc: "Fahrenheit to Celsius." },
        { cmd: "toolbelt units 1 m", desc: "1 metre in every length unit." },
        { cmd: "toolbelt units --list --category temperature" },
      ],
      run: units,
    },
    {
      name: "aspect-ratio",
      tool: "aspect-ratio",
      aliases: ["ratio"],
      summary:
        "Simplify a width × height to its aspect ratio, find the nearest common one, resize keeping it.",
      usage: "toolbelt aspect-ratio <width>x<height> [--width <n> | --height <n>]",
      options: [
        { name: "width", type: "number", desc: "Resize to this width (prints the height)." },
        { name: "height", type: "number", desc: "Resize to this height (prints the width)." },
      ],
      examples: [
        { cmd: "toolbelt aspect-ratio 1920x1080" },
        { cmd: "toolbelt aspect-ratio 16:9 --width 1280" },
      ],
      run: aspectRatio,
    },
  ],
};
