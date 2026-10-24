/** Everyday calculators. Each command imports its tool's logic lazily. */
import { kv, money, num, table } from "../format";
import { CliError, type CommandGroup, type Ctx, UsageError } from "../types";

/** A number from a positional or option ("1 234,5" and "1,234.5" both work). */
async function readNumber(raw: string | undefined, what: string): Promise<number> {
  if (raw === undefined) throw new UsageError(`missing ${what}`);
  const { parseNumber } = await import("../../src/tools/calc/_shared");
  const n = parseNumber(raw);
  if (n === null) throw new CliError(`${what} is not a number: "${raw}"`);
  return n;
}

/** The single positional number of a command, else the value of an option. */
async function mainNumber(ctx: Ctx, what: string, option?: string): Promise<number> {
  if (ctx.args.length > 1) throw new UsageError(`unexpected argument "${ctx.args[1]}"`);
  const fromOpt = option ? ctx.num(option) : undefined;
  if (ctx.args[0] === undefined && fromOpt !== undefined) return fromOpt;
  return readNumber(ctx.args[0], what);
}

const CALC_ERRORS: Record<string, string> = {
  char: "unknown character",
  syntax: "syntax error",
  paren: "missing parenthesis",
  name: "unknown variable",
  func: "unknown function",
  args: "wrong number of arguments",
  divZero: "division by zero",
  domain: "outside the function's domain",
  overflow: "the result is too large",
  reserved: "this name is reserved",
};

async function calculator(ctx: Ctx) {
  const text = await ctx.text({ join: " " });
  const { evaluateSheet } = await import("../../src/tools/calc/calculator/logic");
  const { clean } = await import("../../src/tools/calc/_shared");
  const opts = { angle: ctx.str("angle", "deg") as "deg", decimalComma: ctx.bool("decimal-comma") };
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  const res = evaluateSheet(lines.join("\n"), opts);
  const message = (r: { code: string; detail: string }) =>
    `${CALC_ERRORS[r.code] ?? r.code}${r.detail ? `: ${r.detail}` : ""}`;
  const values = res.filter((r) => r.kind !== "blank");
  if (values.length === 1) {
    const r = values[0];
    if (r?.kind === "error") throw new CliError(message(r));
    if (r?.kind === "value") {
      const v = clean(r.value);
      return { text: String(v), json: { expression: text.trim(), result: v } };
    }
  }
  if (!values.length) throw new UsageError("missing expression");
  const out = lines.map((line, i) => {
    const r = res[i];
    if (!r || r.kind === "blank") return { line, result: null, error: null };
    if (r.kind === "error") return { line, result: null, error: message(r) };
    return { line, result: clean(r.value), error: null };
  });
  const hasError = out.some((o) => o.error);
  return {
    text: out
      .map((o) =>
        o.error
          ? `${o.line}  → error: ${o.error}`
          : o.result === null
            ? o.line
            : `${o.line}  = ${o.result}`,
      )
      .join("\n"),
    json: out,
    code: hasError ? 1 : 0,
  };
}

async function vat(ctx: Ctx) {
  const { COUNTRIES, fromNet, fromGross, fromVat, rateFrom, totals } = await import(
    "../../src/tools/calc/vat/logic"
  );
  const { roundTo } = await import("../../src/tools/calc/_shared");
  if (ctx.bool("rates")) {
    return {
      text: COUNTRIES.map(
        (c) =>
          `${c.id}  ${c.name.en}: ${c.rates.map((r) => `${num(r.rate)} % (${r.en})`).join(", ")}`,
      ).join("\n"),
      json: COUNTRIES,
    };
  }
  const countryId = ctx.str("country");
  const country =
    countryId === undefined ? undefined : COUNTRIES.find((c) => c.id === countryId.toLowerCase());
  if (countryId !== undefined && !country)
    throw new UsageError(
      `unknown country "${countryId}" (countries: ${COUNTRIES.map((c) => c.id).join(", ")})`,
    );
  const netOpt = ctx.num("net");
  const grossOpt = ctx.num("gross");
  if (netOpt !== undefined && grossOpt !== undefined) {
    const r = rateFrom(netOpt, grossOpt);
    if (r === null) throw new CliError("the price before tax must not be 0");
    return { text: `VAT rate: ${num(r, 4)} %`, json: { net: netOpt, gross: grossOpt, rate: r } };
  }
  const rate = ctx.num("rate") ?? (country ?? COUNTRIES[0])?.rates[0]?.rate ?? 20;
  const rateNote =
    ctx.num("rate") !== undefined
      ? `${num(rate)} %`
      : `${num(rate)} % (${(country ?? COUNTRIES[0])?.name.en} standard rate)`;
  const from = ctx.str("from", "net");
  const withTax = from === "gross";
  if (ctx.bool("invoice")) {
    const text = await ctx.text();
    const lines = [];
    for (const raw of text.split("\n")) {
      const parts = raw.split(/[;\t]|\s+/).filter(Boolean);
      if (!parts.length || raw.trim().startsWith("#")) continue;
      if (parts.length < 2 || parts.length > 3)
        throw new CliError(`invoice line "${raw.trim()}": expected "quantity price [rate]"`);
      lines.push({
        qty: await readNumber(parts[0], "quantity"),
        price: await readNumber(parts[1], "price"),
        rate: parts[2] === undefined ? rate : await readNumber(parts[2].replace("%", ""), "rate"),
      });
    }
    if (!lines.length) throw new UsageError("missing invoice lines");
    const t = totals(lines, withTax);
    return {
      text: [
        table(
          t.lines.map((l, i) => [
            i + 1,
            `${num(l.rate)} %`,
            money(l.net),
            money(l.vat),
            money(l.gross),
          ]),
          ["#", "RATE", "NET", "VAT", "GROSS"],
        ),
        "",
        ...t.byRate.map((r) => `VAT ${num(r.rate)} %: ${money(r.vat)} on ${money(r.net)}`),
        kv([
          ["Total net", money(t.net)],
          ["Total VAT", money(t.vat)],
          ["Total gross", money(t.gross)],
        ]),
      ].join("\n"),
      json: t,
    };
  }
  const amount = await mainNumber(ctx, "amount");
  const split =
    from === "gross"
      ? fromGross(amount, rate)
      : from === "vat"
        ? fromVat(amount, rate)
        : fromNet(amount, rate);
  if (!split)
    throw new CliError(
      from === "vat" ? "the rate must not be 0 to start from the VAT" : "invalid rate",
    );
  const r = { net: roundTo(split.net), vat: roundTo(split.vat), gross: roundTo(split.gross) };
  return {
    text: kv([
      ["Rate", rateNote],
      ["Net (before tax)", money(r.net)],
      ["VAT", money(r.vat)],
      ["Gross (with tax)", money(r.gross)],
    ]),
    json: { rate, from, ...split, rounded: r },
  };
}

const STATUS: Record<string, "nonCadre" | "cadre" | "public" | "portage"> = {
  "non-cadre": "nonCadre",
  cadre: "cadre",
  public: "public",
  portage: "portage",
};

async function salary(ctx: Ctx) {
  const L = await import("../../src/tools/calc/salary/logic");
  const amount = await mainNumber(ctx, "amount");
  const pay = ctx.str("pay-period");
  if (pay !== undefined) {
    const t = L.convertPay(amount, pay as "hour", {
      hoursPerWeek: ctx.num("hours-per-week", 40),
      daysPerWeek: ctx.num("days-per-week", 5),
      weeksPerYear: ctx.num("weeks-per-year", 52),
    });
    if (!t) throw new CliError("hours, days and weeks must be positive");
    return {
      text: kv([
        ["Per hour", money(t.hour)],
        ["Per day", money(t.day)],
        ["Per week", money(t.week)],
        ["Per month", money(t.month)],
        ["Per year", money(t.year)],
      ]),
      json: t,
    };
  }
  const status = STATUS[ctx.str("status", "non-cadre")] ?? "nonCadre";
  const preset = L.PRESETS[status];
  const rates = {
    ...preset,
    employee: ctx.num("employee-rate", preset.employee),
    fee: status === "portage" ? ctx.num("fee", preset.fee) : 0,
  };
  const months = ctx.num("months", 12);
  const r = L.salary({
    amount,
    period: ctx.str("period", "month") as "month",
    kind: ctx.str("from", "gross") as "gross",
    rates,
    partTime: ctx.num("part-time", 100),
    monthsPerYear: months,
    taxRate: ctx.num("tax", 0),
  });
  if (!r)
    throw new CliError(
      "check the rates, the part-time share and the months (they must be positive)",
    );
  const row = (label: string, a: { hour: number; month: number; year: number } | null) =>
    a ? [label, money(a.hour), money(a.month), money(a.year)] : null;
  const rows = [
    row("Gross", r.gross),
    row("Net", r.net),
    row("Taxable net", r.taxableNet),
    row("Net after tax", r.afterTax),
    row("Employer cost", r.employerCost),
    row("Revenue (portage)", r.revenue),
  ].filter((x): x is string[] => x !== null);
  return {
    text: [
      table(rows, ["", "HOUR", "MONTH", "YEAR"]),
      "",
      `Estimate (France, ${status}): employee contributions ${num(rates.employee)} %${rates.employer === null ? "" : `, employer ${num(rates.employer)} %`}${rates.fee ? `, management fee ${num(rates.fee)} %` : ""}; ${num(r.hours, 2)} h/month, ${num(months)} months/year.`,
    ].join("\n"),
    json: { status, rates, ...r },
  };
}

async function loanCmd(ctx: Ctx) {
  const { loan, borrowingCapacity, MAX_DEBT_RATIO } = await import(
    "../../src/tools/calc/loan/logic"
  );
  const rate = ctx.num("rate");
  if (rate === undefined) throw new UsageError("missing --rate (annual rate, %)");
  const months = ctx.num("months") ?? Math.round(ctx.num("years", 20) * 12);
  const insurance = ctx.num("insurance", 0);
  const income = ctx.num("income");
  const budgetOpt = ctx.num("budget");
  if (budgetOpt !== undefined || (income !== undefined && !ctx.args.length)) {
    const budget = budgetOpt ?? ((income ?? 0) * MAX_DEBT_RATIO) / 100;
    const cap = borrowingCapacity(budget, rate, months, insurance);
    if (cap === null) throw new CliError("check the budget, the rate and the duration");
    return {
      text: kv([
        [
          "Monthly budget",
          `${money(budget)}${budgetOpt === undefined ? ` (${MAX_DEBT_RATIO} % of income)` : ""}`,
        ],
        ["Duration", `${months} months`],
        ["You can borrow", money(cap)],
      ]),
      json: { budget, rate, months, insurance, capacity: cap },
    };
  }
  const principal = await mainNumber(ctx, "amount");
  const r = loan({ principal, rate, months, insuranceRate: insurance, fees: ctx.num("fees", 0) });
  if (!r) throw new CliError("check the duration (1 to 1200 months) and the amounts");
  const lines = [
    kv([
      ["Monthly payment", money(r.payment)],
      ["Insurance / month", money(r.insurance)],
      ["Total / month", money(r.total)],
      ["Total interest", money(r.totalInterest)],
      ["Total insurance", money(r.totalInsurance)],
      ["Total cost (with fees)", money(r.totalCost)],
      ["Total paid", money(r.totalPaid)],
    ]),
  ];
  if (ctx.bool("schedule"))
    lines.push(
      "",
      table(
        r.years.map((y) => [
          y.year,
          money(y.payment),
          money(y.interest),
          money(y.principal),
          money(y.insurance),
          money(y.balance),
        ]),
        ["YEAR", "PAYMENTS", "INTEREST", "PRINCIPAL", "INSURANCE", "BALANCE"],
      ),
    );
  const { schedule: _s, years, ...summary } = r;
  return {
    text: lines.join("\n"),
    json: { principal, rate, months, ...summary, years: years.map(({ months: _m, ...y }) => y) },
  };
}

async function savingsCmd(ctx: Ctx) {
  const { savings, doublingYears } = await import("../../src/tools/calc/savings/logic");
  const initial = ctx.args.length ? await mainNumber(ctx, "initial amount") : ctx.num("initial", 0);
  const r = savings({
    initial,
    monthly: ctx.num("monthly", 0),
    rate: ctx.num("rate", 3),
    years: ctx.num("years", 10),
    compounding: ctx.str("compounding", "yearly") as "yearly",
    startOfMonth: ctx.bool("start-of-month"),
    inflation: ctx.num("inflation", 0),
  });
  if (!r) throw new CliError("check the duration (up to 100 years) and the rates");
  const dbl = doublingYears(ctx.num("rate", 3));
  return {
    text: [
      kv([
        ["Final balance", money(r.final)],
        ["Contributed", money(r.contributed)],
        ["Interest", money(r.interest)],
        ["In today's money", money(r.real)],
        ["Doubling time", dbl === null ? "never" : `${num(dbl, 1)} years`],
      ]),
      "",
      table(
        r.points.map((p) => [
          num(p.year, 2),
          money(p.contributed),
          money(p.interest),
          money(p.balance),
        ]),
        ["YEAR", "CONTRIBUTED", "INTEREST", "BALANCE"],
      ),
    ].join("\n"),
    json: { ...r, doublingYears: dbl },
  };
}

async function tipCmd(ctx: Ctx) {
  const { splitEven, splitUneven } = await import("../../src/tools/calc/tip/logic");
  const bill = await mainNumber(ctx, "bill");
  const tipPct = ctx.num("tip", 10);
  const own = ctx.list("own");
  if (own.length) {
    const people = [];
    for (const [i, o] of own.entries()) {
      const eq = o.lastIndexOf("=");
      people.push({
        name: eq > 0 ? o.slice(0, eq) : `Person ${i + 1}`,
        own: await readNumber(eq > 0 ? o.slice(eq + 1) : o, "--own amount"),
      });
    }
    const r = splitUneven(bill, tipPct, people);
    if (!r) throw new CliError("the bill, the tip and every amount must be positive");
    return {
      text: [
        table(
          r.shares.map((s) => [
            s.name,
            money(s.own),
            money(s.shared),
            money(s.tip),
            money(s.total),
          ]),
          ["WHO", "OWN", "SHARED", "TIP", "TOTAL"],
        ),
        "",
        kv([
          ["Tip", money(r.tip)],
          ["Total", money(r.total)],
          ["Unclaimed", money(r.unclaimed)],
        ]),
      ].join("\n"),
      json: r,
    };
  }
  const r = splitEven({ bill, tipPct, people: ctx.num("people", 1), roundTo: ctx.num("round", 0) });
  if (!r) throw new CliError("the bill and the tip must be positive, with at least 1 person");
  return {
    text: kv([
      ["Tip", money(r.tip)],
      ["Total", money(r.total)],
      ["Per person", money(r.perPerson)],
      ["Rounded per person", r.rounded !== r.perPerson ? money(r.rounded) : undefined],
      ["Rounded total", r.rounded !== r.perPerson ? money(r.roundedTotal) : undefined],
      [
        "Actual tip",
        r.rounded !== r.perPerson
          ? `${money(r.actualTip)} (${num(r.actualTipPct, 1)} %)`
          : undefined,
      ],
    ]),
    json: r,
  };
}

async function discountCmd(ctx: Ctx) {
  const L = await import("../../src/tools/calc/discount/logic");
  const compare = ctx.list("compare");
  if (compare.length) {
    const products = [];
    for (const c of compare) {
      const m = /^\s*([\d.,]+)\s+(?:(\d+)\s*[x×*]\s*)?([\d.,]+)\s*([a-zA-Z ]+?)\s*$/.exec(c);
      const unit = m?.[4] && L.UNITS.find((u) => u.id.toLowerCase() === m[4]?.toLowerCase());
      if (!m || !unit)
        throw new CliError(
          `cannot read "${c}": expected "price [packs x]quantity unit", e.g. "2.49 500g" or "4.20 6x33cl" (units: ${L.UNITS.map((u) => u.id).join(", ")})`,
        );
      products.push({
        price: await readNumber(m[1], "price"),
        packs: m[2] ? Number(m[2]) : 1,
        quantity: await readNumber(m[3], "quantity"),
        unit: unit.id,
      });
    }
    const { results, dim } = L.comparePrices(products);
    const per = { mass: "kg", volume: "L", count: "item" } as const;
    return {
      text: table(
        results.map((r, i) => [
          compare[i] ?? "",
          r.perBase === null ? "n/a" : `${money(r.perBase)} / ${per[r.dim]}`,
          r.best ? "best" : r.overBest !== null && r.overBest > 0 ? `+${num(r.overBest, 1)} %` : "",
        ]),
      ),
      json: { dimension: dim, results: results.map((r, i) => ({ product: compare[i], ...r })) },
    };
  }
  const offs: number[] = [];
  for (const o of ctx.list("off")) offs.push(await readNumber(o.replace("%", ""), "--off"));
  const sale = ctx.num("sale");
  if (sale !== undefined && !ctx.args.length) {
    if (!offs.length) throw new UsageError("give --off <percent> to find the original price");
    const p = L.originalPrice(sale, offs);
    if (p === null) throw new CliError("a 100 % discount has no original price");
    return { text: `Original price: ${money(p)}`, json: { sale, discounts: offs, original: p } };
  }
  const price = await mainNumber(ctx, "price");
  if (sale !== undefined) {
    const pct = L.discountPercent(price, sale);
    if (pct === null) throw new CliError("the original price must be positive");
    return {
      text: `Discount: ${num(pct, 2)} % (saved ${money(price - sale)})`,
      json: { original: price, sale, percent: pct },
    };
  }
  if (!offs.length)
    throw new UsageError("give --off <percent> (repeatable), --sale <price> or --compare");
  const r = L.applyDiscounts(price, offs);
  return {
    text: kv([
      ["Final price", money(r.final)],
      ["Saved", money(r.saved)],
      ["Equivalent discount", `${num(r.equivalent, 2)} %`],
      ["Steps", r.steps.map((s) => money(s)).join(" → ")],
    ]),
    json: { price, discounts: offs, ...r },
  };
}

const BMI_CATEGORY: Record<string, string> = {
  under: "underweight",
  normal: "normal weight",
  over: "overweight",
  obese1: "obesity (class I)",
  obese2: "obesity (class II)",
  obese3: "obesity (class III)",
};

async function bmiCmd(ctx: Ctx) {
  const L = await import("../../src/tools/calc/bmi/logic");
  const [w, h, extra] = ctx.args;
  if (extra !== undefined) throw new UsageError("give a weight and a height");
  const imperial = ctx.bool("imperial");
  let kg = w !== undefined ? await readNumber(w, "weight") : ctx.num("weight");
  let cm = h !== undefined ? await readNumber(h, "height") : ctx.num("height");
  if (imperial) {
    if (kg !== undefined) kg = L.lbToKg(kg);
    const ft = ctx.num("feet");
    if (ft !== undefined) cm = L.feetInchesToCm(ft, ctx.num("inches", 0));
    else if (cm !== undefined) cm = cm * L.INCH;
  }
  if (kg === undefined || cm === undefined)
    throw new UsageError("give the weight (kg) and the height (cm), e.g. toolbelt bmi 70 175");
  const value = L.bmi(kg, cm);
  if (value === null) throw new CliError("weight and height must be positive");
  const cat = L.category(value);
  const range = L.healthyRange(cm);
  const pairs: [string, string | number | undefined][] = [
    ["BMI", num(value, 1)],
    ["Category", BMI_CATEGORY[cat] ?? cat],
    ["Healthy weight", range ? `${num(range.min, 1)}–${num(range.max, 1)} kg` : undefined],
  ];
  const age = ctx.num("age");
  let bmr: number | null = null;
  let calories: number | null = null;
  if (age !== undefined) {
    bmr = L.bmr(kg, cm, age, ctx.str("sex", "female") as "female");
    if (bmr === null) throw new CliError("age must be positive");
    calories = L.dailyCalories(bmr, ctx.str("activity", "light") as "light");
    pairs.push(
      ["BMR", `${Math.round(bmr)} kcal/day`],
      ["Daily calories", `${Math.round(calories)} kcal/day`],
    );
  }
  return {
    text: kv(pairs),
    json: { kg, cm, bmi: value, category: cat, healthyRange: range, bmr, calories },
  };
}

async function ageCmd(ctx: Ctx) {
  const { parseYmd, ymdString, dayNumber } = await import("../../src/tools/calc/_shared");
  const L = await import("../../src/tools/calc/age/logic");
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const raw = ctx.args[0];
  if (!raw) throw new UsageError("missing birth date (YYYY-MM-DD)");
  if (ctx.args.length > 1) throw new UsageError(`unexpected argument "${ctx.args[1]}"`);
  const birth = parseYmd(raw);
  if (!birth) throw new CliError(`invalid date "${raw}" (use YYYY-MM-DD)`);
  const onRaw = ctx.str("on");
  const on = onRaw === undefined ? parseYmd(ctx.now.toISOString().slice(0, 10)) : parseYmd(onRaw);
  if (!on) throw new CliError(`invalid --on date "${onRaw}" (use YYYY-MM-DD)`);
  const at = ctx.num("at");
  if (at !== undefined) {
    const unit = ctx.str("unit", "days") as "days";
    const d = L.dateAtAge(birth, at, unit);
    if (!d) throw new CliError("--at must be a whole number");
    return {
      text: `${num(at)} ${unit} old on ${ymdString(d)} (${DAYS[(((dayNumber(d) + 4) % 7) + 7) % 7]})`,
      json: { birth: raw, at, unit, date: ymdString(d) },
    };
  }
  const a = L.age(birth, on);
  if (!a) throw new CliError("the birth date is after the reference date");
  const next = L.nextBirthday(birth, on);
  const miles = L.nextMilestones(birth, on, 3);
  return {
    text: kv([
      ["Age", `${a.years} years, ${a.months} months, ${a.days} days`],
      ["Born on a", DAYS[(((dayNumber(birth) + 4) % 7) + 7) % 7]],
      ["Total months", a.totalMonths],
      ["Total weeks", `${a.totalWeeks}${a.weekDays ? ` + ${a.weekDays} d` : ""}`],
      ["Total days", a.totalDays],
      ["Total hours", a.totalHours],
      [
        "Next birthday",
        next
          ? `${ymdString(next.date)} (${DAYS[next.weekday]}), turning ${next.turning}, in ${next.daysLeft} days`
          : undefined,
      ],
      ["Next milestones", miles.map((m) => `${m.days} days on ${ymdString(m.date)}`).join(", ")],
    ]),
    json: {
      birth: raw,
      on: ymdString(on),
      ...a,
      nextBirthday: next && { ...next, date: ymdString(next.date) },
      milestones: miles.map((m) => ({ days: m.days, date: ymdString(m.date) })),
    },
  };
}

async function fuelCmd(ctx: Ctx) {
  const L = await import("../../src/tools/calc/fuel/logic");
  const liters = ctx.num("liters");
  const km = ctx.num("km");
  if (liters !== undefined || km !== undefined) {
    if (liters === undefined || km === undefined)
      throw new UsageError("give both --liters and --km");
    const l100 = L.measured(liters, km);
    if (l100 === null) throw new CliError("liters and km must be positive");
    const units = ["l100", "mpgUS", "mpgUK", "kmL"] as const;
    const all = Object.fromEntries(units.map((u) => [u, L.fromL100(l100, u)]));
    return {
      text: kv([
        ["L/100 km", num(l100, 2)],
        ["mpg (US)", num(all.mpgUS ?? 0, 2)],
        ["mpg (UK)", num(all.mpgUK ?? 0, 2)],
        ["km/L", num(all.kmL ?? 0, 2)],
      ]),
      json: { liters, km, consumption: all },
    };
  }
  const ev = ctx.bool("ev");
  const distance = await mainNumber(ctx, "distance", "distance");
  const km2 = ctx.str("distance-unit", "km") === "mi" ? distance * L.KM_PER_MILE : distance;
  const cons = ctx.num("consumption", ev ? 17 : 6.5);
  const unit = ctx.str("unit", ev ? "kwh100" : "l100");
  const per100 = ev ? L.toKwh100(cons, unit as "kwh100") : L.toL100(cons, unit as "l100");
  if (per100 === null || per100 === undefined)
    throw new CliError(
      `the consumption must be positive (and --unit one of ${ev ? "kwh100, whkm, miKwh, kwh100mi" : "l100, mpgUS, mpgUK, kmL"})`,
    );
  const price = ev
    ? ctx.num("price", 0.25)
    : L.pricePerBase(ctx.num("price", 1.85), ctx.str("price-unit", "L") as "L");
  const r = L.trip({
    distance: km2,
    per100,
    price,
    people: ctx.num("people", 1),
    roundTrip: ctx.bool("round-trip"),
  });
  if (!r) throw new CliError("check the distance, the price and the number of people");
  const e = ev ? "kWh" : "L";
  return {
    text: kv([
      ["Distance", `${num(r.km, 1)} km`],
      [ev ? "Energy" : "Fuel", `${num(r.energy, 2)} ${e}`],
      ["Cost", money(r.cost)],
      ["Per person", money(r.perPerson)],
      ["Per km", money(r.perKm, 3)],
    ]),
    json: { ...r, per100, unit: ev ? "kWh/100km" : "L/100km" },
  };
}

async function cookingCmd(ctx: Ctx) {
  const L = await import("../../src/tools/calc/cooking/logic");
  if (ctx.bool("list")) {
    return {
      text: [
        `Units: ${L.KITCHEN_UNITS.map((u) => u.id).join(", ")}`,
        `Ingredients: ${L.INGREDIENTS.map((i) => `${i.id} (${i.density} g/ml)`).join(", ")}`,
      ].join("\n"),
      json: { units: L.KITCHEN_UNITS, ingredients: L.INGREDIENTS },
    };
  }
  const temp = ctx.num("temp");
  if (temp !== undefined) {
    const from = ctx.str("temp-unit", "c");
    const c = from === "f" ? L.fToC(temp) : from === "gas" ? L.fToC(L.gasToF(temp)) : temp;
    const gas = L.gasMark(c);
    return {
      text: kv([
        ["Celsius", `${Math.round(c)} °C`],
        ["Fahrenheit", `${Math.round(L.cToF(c))} °F`],
        ["Gas mark", gas === null ? "n/a" : num(gas, 2)],
        ["Thermostat", num(L.thermostat(c), 1)],
      ]),
      json: { celsius: c, fahrenheit: L.cToF(c), gasMark: gas, thermostat: L.thermostat(c) },
    };
  }
  const servings = ctx.str("servings");
  if (servings !== undefined || ctx.num("factor") !== undefined) {
    let factor = ctx.num("factor");
    if (servings !== undefined) {
      const m = /^\s*([\d.,]+)\s*[:→>-]+\s*([\d.,]+)\s*$/.exec(servings);
      if (!m) throw new UsageError('--servings expects "from:to", e.g. 4:6');
      const a = await readNumber(m[1], "servings");
      const b = await readNumber(m[2], "servings");
      if (!(a > 0)) throw new CliError("servings must be positive");
      factor = b / a;
    }
    const recipe = await ctx.text();
    const lines = L.scaleRecipe(recipe, factor as number, ctx.bool("decimal-comma"));
    return { text: lines.map((l) => l.text).join("\n"), json: { factor, lines } };
  }
  const [amountRaw, from, to, extra] = ctx.args;
  if (extra !== undefined || to === undefined)
    throw new UsageError(
      "give an amount, a unit and a target unit, e.g. toolbelt cooking 1 cup g --ingredient flour",
    );
  const amount = await readNumber(amountRaw, "amount");
  const unit = (id: string) => L.KITCHEN_UNITS.find((u) => u.id.toLowerCase() === id.toLowerCase());
  const a = unit(from as string);
  const b = unit(to);
  if (!a || !b)
    throw new CliError(
      `unknown unit "${a ? to : from}" (units: ${L.KITCHEN_UNITS.map((u) => u.id).join(", ")})`,
    );
  const ingredient = ctx.str("ingredient", "water");
  if (!L.INGREDIENTS.some((i) => i.id === ingredient))
    throw new CliError(`unknown ingredient "${ingredient}" (see: toolbelt cooking --list)`);
  const v = L.convertKitchen(amount, a.id, b.id, ingredient);
  return {
    text: `${num(amount)} ${a.id} = ${num(v, 2)} ${b.id}${a.dim !== b.dim ? ` (${ingredient})` : ""}`,
    json: { amount, from: a.id, to: b.id, ingredient, result: v },
  };
}

const MENTION: Record<string, string> = {
  tb: "très bien",
  b: "bien",
  ab: "assez bien",
  pass: "passable",
  fail: "fail (below 10/20)",
};

async function gradesCmd(ctx: Ctx) {
  const L = await import("../../src/tools/calc/grades/logic");
  const text = await ctx.text({ join: "\n" });
  const de = ctx.str("system", "scale") === "de";
  const scale = de ? L.DE_WORST : ctx.num("scale", 20);
  if (!(scale > 0)) throw new UsageError("--scale must be positive");
  const grades = [];
  for (const raw of text
    .split(/[\n;]/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    const m = /^(.+?)(?:\s*\/\s*([\d.,]+))?(?:\s*[x×*]\s*([\d.,]+))?$/.exec(raw);
    const value = de ? L.parseGermanGrade(m?.[1] ?? "") : Number((m?.[1] ?? "").replace(",", "."));
    if (!m || value === null || !Number.isFinite(value))
      throw new CliError(
        `cannot read the grade "${raw}" (expected e.g. "15/20 x2"${de ? ' or "2+ x2"' : ""})`,
      );
    grades.push({
      value,
      outOf: de ? L.DE_WORST : m[2] ? Number(m[2].replace(",", ".")) : scale,
      coef: m[3] ? Number(m[3].replace(",", ".")) : 1,
    });
  }
  if (!grades.length) throw new UsageError("missing grades");
  if (de) {
    // German grades: the average of the grades themselves (1 best … 6 worst).
    const avg = L.weightedAverage(
      grades.map((g) => ({ ...g, outOf: L.DE_WORST })),
      L.DE_WORST,
    );
    if (avg === null) throw new CliError("no valid grade (coefficients must be positive)");
    const target = ctx.num("target");
    const need =
      target === undefined ? null : L.neededGermanGrade(grades, target, ctx.num("next-coef", 1));
    return {
      text: kv([
        ["Average", num(L.truncate1(avg), 1)],
        ["Grade band", L.germanBand(avg)],
        ["Points (0–15)", num(L.pointsFromGrade(avg), 1)],
        ["Needed next", need ? `${num(need.grade, 2)} (${need.status})` : undefined],
      ]),
      json: { system: "de", average: avg, band: L.germanBand(avg), needed: need },
    };
  }
  const avg = L.weightedAverage(grades, scale);
  if (avg === null)
    throw new CliError("no valid grade (out-of values and coefficients must be positive)");
  const pct = (avg / scale) * 100;
  const letter = L.letterGrade(pct);
  const on20 = (avg / scale) * 20;
  const target = ctx.num("target");
  const need =
    target === undefined ? null : L.neededGrade(grades, scale, target, ctx.num("next-coef", 1));
  return {
    text: kv([
      ["Average", `${num(avg, 2)} / ${num(scale)}`],
      ["Percent", `${num(pct, 1)} %`],
      ["Letter (US)", `${letter.letter} (GPA ${num(letter.gpa, 1)})`],
      ["Mention (FR)", MENTION[L.mention(on20)]],
      ["Needed next", need ? `${num(need.grade, 2)} / ${num(scale)} (${need.status})` : undefined],
    ]),
    json: {
      system: "scale",
      scale,
      average: avg,
      percent: pct,
      letter,
      mention: L.mention(on20),
      needed: need,
    },
  };
}

async function etaCmd(ctx: Ctx) {
  const L = await import("../../src/tools/calc/eta/logic");
  const { parseInput, isoInZone } = await import("../../src/tools/convert/timestamp/logic");
  const zone = ctx.str("zone", "UTC");
  const { isValidZone } = await import("../../src/tools/convert/_shared");
  if (!isValidZone(zone)) throw new CliError(`unknown time zone "${zone}"`);
  const dur = (ms: number) => {
    if (!Number.isFinite(ms)) return "never at this pace";
    const s = L.splitDuration(ms);
    return [s.d && `${s.d} d`, s.h && `${s.h} h`, `${s.m} min`].filter(Boolean).join(" ");
  };
  const readDate = (raw: string, what: string) => {
    const p = parseInput(raw, "auto", zone);
    if (!p.ok)
      throw new CliError(`invalid ${what} "${raw}" (use an ISO date like 2026-01-15T09:00)`);
    return p.ms;
  };
  const now = ctx.now.getTime();
  const left = ctx.num("left");
  if (left !== undefined) {
    const speed = ctx.num("speed");
    if (speed === undefined) throw new UsageError("give --speed with --left");
    const ms = L.timeAtPace(
      left,
      speed * L.PER_HOUR[ctx.str("per", "hour") as keyof typeof L.PER_HOUR],
    );
    if (ms === null) throw new CliError("the speed must be positive and what is left not negative");
    return {
      text: kv([
        ["Time needed", dur(ms)],
        ["Done at", isoInZone(Math.round(now + ms), zone)],
      ]),
      json: { left, speed, ms, finish: isoInZone(Math.round(now + ms), zone) },
    };
  }
  const total = ctx.num("total");
  const done = ctx.num("done");
  if (total === undefined || done === undefined)
    throw new UsageError(
      "give --total and --done (with --start or --elapsed), or --left and --speed",
    );
  const elapsed = ctx.num("elapsed");
  const startRaw = ctx.str("start");
  if (elapsed === undefined && startRaw === undefined)
    throw new UsageError("give --start <date> or --elapsed <hours>");
  const startMs =
    elapsed !== undefined ? now - elapsed * 3600000 : readDate(startRaw as string, "--start");
  const r = L.eta({ total, done, startMs, nowMs: now });
  if (typeof r === "string")
    throw new CliError(
      r === "total"
        ? "--total must be positive"
        : r === "done"
          ? "--done must be between 0 and --total"
          : "the start must be in the past",
    );
  const deadlineRaw = ctx.str("deadline");
  const need =
    deadlineRaw === undefined
      ? null
      : L.requiredPace(r.remaining, now, readDate(deadlineRaw, "--deadline"));
  if (deadlineRaw !== undefined && need === null)
    throw new CliError("the deadline must be in the future");
  return {
    text: kv([
      ["Progress", `${num(r.percent, 1)} %`],
      ["Pace", `${num(r.perHour, 2)} per hour`],
      ["Remaining", `${num(r.remaining)} (${dur(r.remainingMs)})`],
      [
        "Done at",
        r.finishMs === null
          ? "unknown (nothing done yet)"
          : isoInZone(Math.round(r.finishMs), zone),
      ],
      [
        "Needed pace",
        need === null ? undefined : `${num(need, 2)} per hour to finish by the deadline`,
      ],
    ]),
    json: {
      ...r,
      finish: r.finishMs === null ? null : isoInZone(Math.round(r.finishMs), zone),
      requiredPerHour: need,
    },
  };
}

export const group: CommandGroup = {
  category: "calc",
  commands: [
    {
      name: "calculator",
      tool: "calculator",
      aliases: ["calc"],
      summary:
        "Evaluate expressions (no eval): functions, %, variables, ans, sum; one expression per line.",
      usage: 'toolbelt calculator "<expression>" [--angle deg|rad] [--decimal-comma]',
      options: [
        {
          name: "angle",
          type: "string",
          values: ["deg", "rad"],
          desc: "Angle unit for trigonometry.",
          default: "deg",
        },
        {
          name: "decimal-comma",
          type: "boolean",
          desc: 'Read "1,5" as one and a half (use ";" between arguments).',
        },
      ],
      notes:
        "A file or stdin is a sheet: one expression per line, `x = 3` defines a variable, `ans` is the last result, `sum`/`total` add the lines above, `# comments`. Exit code 1 when a line fails.",
      examples: [
        { cmd: 'toolbelt calculator "2 * (3 + 4)^2 / sqrt(16)"' },
        { cmd: 'toolbelt calculator "200 + 10%"' },
        { cmd: "toolbelt calculator --file budget.txt" },
      ],
      run: calculator,
    },
    {
      name: "vat",
      tool: "vat",
      summary:
        "VAT: from the net price, the gross price or the tax; the rate from two prices; invoice totals.",
      usage:
        "toolbelt vat <amount> [--from net|gross|vat] [--rate <r> | --country <id>] | toolbelt vat --net <n> --gross <g> | toolbelt vat --invoice [--file lines.txt] | toolbelt vat --rates",
      options: [
        {
          name: "from",
          type: "string",
          values: ["net", "gross", "vat"],
          desc: "What the amount is.",
          default: "net",
        },
        { name: "rate", alias: "r", type: "number", desc: "VAT rate, %." },
        {
          name: "country",
          alias: "c",
          type: "string",
          arg: "<id>",
          desc: "Use this country's standard rate (fr, be, ch, lu, de, es, it, pt, nl, at, ie, uk, ca, ma).",
          default: "fr",
        },
        { name: "net", type: "number", desc: "With --gross: find the rate." },
        { name: "gross", type: "number", desc: "With --net: find the rate." },
        {
          name: "invoice",
          type: "boolean",
          desc: 'Invoice lines from the input: "quantity price [rate]" per line (prices before tax, or with tax with --from gross).',
        },
        { name: "rates", type: "boolean", desc: "List the countries and their rates." },
      ],
      examples: [
        { cmd: "toolbelt vat 100 --rate 20" },
        { cmd: "toolbelt vat 120 --from gross --country fr" },
        { cmd: "toolbelt vat --net 100 --gross 119" },
        { cmd: 'printf "2 49.90 20\\n1 12 5.5\\n" | toolbelt vat --invoice' },
      ],
      run: vat,
    },
    {
      name: "salary",
      tool: "salary",
      summary:
        "French gross ↔ net salary estimate (status presets, part time, 13th month, withholding tax), or pay per hour/day/week/month/year.",
      usage:
        "toolbelt salary <amount> [--from gross|net] [--period hour|month|year] [--status non-cadre|cadre|public|portage] [--tax <r>] | toolbelt salary <amount> --pay-period hour|day|week|month|year",
      options: [
        {
          name: "from",
          type: "string",
          values: ["gross", "net"],
          desc: "Whether the amount is gross or net.",
          default: "gross",
        },
        {
          name: "period",
          type: "string",
          values: ["hour", "month", "year"],
          desc: "Period of the amount.",
          default: "month",
        },
        {
          name: "status",
          type: "string",
          values: ["non-cadre", "cadre", "public", "portage"],
          desc: "Contribution preset.",
          default: "non-cadre",
        },
        {
          name: "employee-rate",
          type: "number",
          desc: "Employee contributions, % of gross (overrides the preset).",
        },
        { name: "fee", type: "number", desc: "Portage management fee, %.", default: 8 },
        { name: "part-time", type: "number", desc: "Part-time share, %.", default: 100 },
        {
          name: "months",
          type: "number",
          desc: "Salaries per year (13 with a 13th month).",
          default: 12,
        },
        { name: "tax", type: "number", desc: "Withholding tax rate, %.", default: 0 },
        {
          name: "pay-period",
          type: "string",
          values: ["hour", "day", "week", "month", "year"],
          desc: "Any country: convert pay from this period.",
        },
        { name: "hours-per-week", type: "number", desc: "With --pay-period.", default: 40 },
        { name: "days-per-week", type: "number", desc: "With --pay-period.", default: 5 },
        {
          name: "weeks-per-year",
          type: "number",
          desc: "With --pay-period (paid weeks).",
          default: 52,
        },
      ],
      notes: "The French estimate uses flat average contribution rates: it is not a payslip.",
      examples: [
        { cmd: "toolbelt salary 3000 --status cadre" },
        { cmd: "toolbelt salary 2000 --from net --months 13 --tax 5" },
        { cmd: "toolbelt salary 25 --pay-period hour --hours-per-week 35" },
      ],
      run: salary,
    },
    {
      name: "loan",
      tool: "loan",
      aliases: ["mortgage"],
      summary:
        "Loan or mortgage: monthly payment, insurance, total cost, yearly amortization; or how much you can borrow.",
      usage:
        "toolbelt loan <amount> --rate <r> [--years n | --months n] [--insurance r] [--fees n] [--schedule] | toolbelt loan --budget <monthly> --rate <r> [--years n]",
      options: [
        { name: "rate", alias: "r", type: "number", desc: "Nominal annual rate, %." },
        { name: "years", alias: "y", type: "number", desc: "Duration in years.", default: 20 },
        { name: "months", type: "number", desc: "Duration in months (instead of --years)." },
        {
          name: "insurance",
          type: "number",
          desc: "Annual insurance rate on the initial capital, %.",
          default: 0,
        },
        { name: "fees", type: "number", desc: "One-off fees.", default: 0 },
        { name: "schedule", type: "boolean", desc: "Print the amortization by year." },
        {
          name: "budget",
          type: "number",
          desc: "Monthly budget (insurance included): print the borrowing capacity.",
        },
        {
          name: "income",
          type: "number",
          desc: "Net monthly income: capacity at a 35 % debt ratio (without --budget).",
        },
      ],
      examples: [
        { cmd: "toolbelt loan 200000 --rate 3.5 --years 20 --insurance 0.3" },
        { cmd: "toolbelt loan 15000 --rate 5 --months 48 --schedule" },
        { cmd: "toolbelt loan --budget 1200 --rate 3.5 --years 25" },
      ],
      run: loanCmd,
    },
    {
      name: "savings",
      tool: "savings",
      aliases: ["compound"],
      summary: "Compound interest with monthly contributions, inflation and a yearly table.",
      usage:
        "toolbelt savings [initial] [--monthly n] [--rate r] [--years n] [--compounding yearly|quarterly|monthly|daily] [--start-of-month] [--inflation r]",
      options: [
        { name: "initial", type: "number", desc: "Starting amount.", default: 0 },
        { name: "monthly", alias: "m", type: "number", desc: "Monthly contribution.", default: 0 },
        { name: "rate", alias: "r", type: "number", desc: "Nominal annual rate, %.", default: 3 },
        { name: "years", alias: "y", type: "number", desc: "Duration in years.", default: 10 },
        {
          name: "compounding",
          type: "string",
          values: ["yearly", "quarterly", "monthly", "daily"],
          desc: "Compounding frequency.",
          default: "yearly",
        },
        {
          name: "start-of-month",
          type: "boolean",
          desc: "Contributions at the start of each month.",
        },
        {
          name: "inflation",
          type: "number",
          desc: "Yearly inflation, % (result in today's money).",
          default: 0,
        },
      ],
      examples: [
        { cmd: "toolbelt savings 1000 --monthly 100 --rate 3 --years 10" },
        {
          cmd: "toolbelt savings --monthly 200 --rate 5 --years 30 --compounding monthly --inflation 2 --json",
        },
      ],
      run: savingsCmd,
    },
    {
      name: "tip",
      tool: "tip",
      summary:
        "Tip and bill splitting: even split with rounding, or uneven by what each person ordered.",
      usage:
        "toolbelt tip <bill> [--tip %] [--people n] [--round step] | toolbelt tip <bill> --own name=amount ...",
      options: [
        { name: "tip", alias: "t", type: "number", desc: "Tip, % of the bill.", default: 10 },
        { name: "people", alias: "p", type: "number", desc: "Number of people.", default: 1 },
        {
          name: "round",
          type: "number",
          desc: "Round each share up to a multiple of this (0 = no rounding).",
          default: 0,
        },
        {
          name: "own",
          type: "list",
          arg: "<name=amount>",
          desc: "What one person ordered (repeatable): uneven split; the rest is shared.",
        },
      ],
      examples: [
        { cmd: "toolbelt tip 84 --tip 10 --people 4" },
        { cmd: "toolbelt tip 84 --people 4 --round 5" },
        { cmd: "toolbelt tip 100 --tip 15 --own Ann=30 --own Bob=25 --own Cy=20" },
      ],
      run: tipCmd,
    },
    {
      name: "discount",
      tool: "discount",
      summary:
        "Discounts: final price after stacked discounts, discount %, original price; compare unit prices.",
      usage:
        'toolbelt discount <price> --off <%> [--off <%> ...] | toolbelt discount <price> --sale <price> | toolbelt discount --sale <price> --off <%> | toolbelt discount --compare "<price> <qty><unit>" ...',
      options: [
        {
          name: "off",
          type: "list",
          arg: "<percent>",
          desc: "A discount, % (repeatable, applied one after the other).",
        },
        { name: "sale", type: "number", desc: "The sale price." },
        {
          name: "compare",
          type: "list",
          arg: '"<price> [packs x]<qty> <unit>"',
          desc: 'A product to compare by unit price (repeatable), e.g. "2.49 500g", "4.20 6x33cl".',
        },
      ],
      examples: [
        { cmd: "toolbelt discount 80 --off 30 --off 10" },
        { cmd: "toolbelt discount 80 --sale 60" },
        { cmd: 'toolbelt discount --compare "2.49 500g" --compare "4.20 1kg"' },
      ],
      run: discountCmd,
    },
    {
      name: "bmi",
      tool: "bmi",
      summary:
        "Body mass index, category, healthy weight range; basal metabolic rate and daily calories.",
      usage:
        "toolbelt bmi <kg> <cm> [--age n --sex male|female --activity <level>] | toolbelt bmi <lb> --imperial --feet n --inches n",
      options: [
        { name: "weight", type: "number", desc: "Weight (kg, or lb with --imperial)." },
        { name: "height", type: "number", desc: "Height (cm, or inches with --imperial)." },
        { name: "imperial", type: "boolean", desc: "Pounds and feet/inches." },
        { name: "feet", type: "number", desc: "Height, feet (with --imperial)." },
        { name: "inches", type: "number", desc: "Height, extra inches (with --imperial)." },
        { name: "age", type: "number", desc: "Age, for BMR and calories." },
        {
          name: "sex",
          type: "string",
          values: ["male", "female"],
          desc: "For BMR.",
          default: "female",
        },
        {
          name: "activity",
          type: "string",
          values: ["sedentary", "light", "moderate", "active", "very"],
          desc: "Activity level.",
          default: "light",
        },
      ],
      examples: [
        { cmd: "toolbelt bmi 70 175" },
        { cmd: "toolbelt bmi 70 175 --age 30 --sex male --activity moderate" },
        { cmd: "toolbelt bmi 154 --imperial --feet 5 --inches 9" },
      ],
      run: bmiCmd,
    },
    {
      name: "age",
      tool: "age",
      summary:
        "Exact age from a birth date, totals in months/weeks/days, next birthday, day milestones; the date at a given age.",
      usage:
        "toolbelt age <YYYY-MM-DD> [--on <YYYY-MM-DD>] | toolbelt age <YYYY-MM-DD> --at <n> [--unit days|weeks|months|years]",
      options: [
        {
          name: "on",
          type: "string",
          arg: "<date>",
          desc: "Reference date (default: today, UTC).",
        },
        { name: "at", type: "number", desc: "Print the date at this age." },
        {
          name: "unit",
          type: "string",
          values: ["days", "weeks", "months", "years"],
          desc: "Unit of --at.",
          default: "days",
        },
      ],
      examples: [
        { cmd: "toolbelt age 1990-05-15" },
        { cmd: "toolbelt age 1990-05-15 --at 10000 --unit days" },
      ],
      run: ageCmd,
    },
    {
      name: "fuel",
      tool: "fuel",
      summary:
        "Trip fuel or charging cost (L/100 km, mpg, kWh), per person; or consumption from liters and km.",
      usage:
        "toolbelt fuel <distance> [--consumption n] [--unit l100|mpgUS|mpgUK|kmL] [--price n] [--people n] [--round-trip] [--ev] | toolbelt fuel --liters n --km n",
      options: [
        { name: "distance", type: "number", desc: "Trip distance." },
        {
          name: "distance-unit",
          type: "string",
          values: ["km", "mi"],
          desc: "Unit of the distance.",
          default: "km",
        },
        {
          name: "consumption",
          type: "number",
          desc: "Consumption (default 6.5 L/100 km, or 17 kWh/100 km with --ev).",
        },
        {
          name: "unit",
          type: "string",
          values: ["l100", "mpgUS", "mpgUK", "kmL", "kwh100", "whkm", "miKwh", "kwh100mi"],
          desc: "Unit of the consumption.",
        },
        {
          name: "price",
          type: "number",
          desc: "Price per liter (or per kWh with --ev).",
          default: 1.85,
        },
        {
          name: "price-unit",
          type: "string",
          values: ["L", "galUS", "galUK"],
          desc: "Unit of the fuel price.",
          default: "L",
        },
        {
          name: "people",
          type: "number",
          desc: "Split the cost between this many people.",
          default: 1,
        },
        { name: "round-trip", type: "boolean", desc: "Double the distance." },
        { name: "ev", type: "boolean", desc: "Electric vehicle (kWh)." },
        { name: "liters", type: "number", desc: "With --km: measured consumption." },
        { name: "km", type: "number", desc: "With --liters: measured consumption." },
      ],
      examples: [
        { cmd: "toolbelt fuel 450 --consumption 6.5 --price 1.85 --people 2" },
        { cmd: "toolbelt fuel 300 --ev --consumption 17 --price 0.25 --round-trip" },
        { cmd: "toolbelt fuel --liters 42 --km 700" },
      ],
      run: fuelCmd,
    },
    {
      name: "cooking",
      tool: "cooking",
      summary:
        "Kitchen conversions (cups, spoons, grams by ingredient), oven temperatures and recipe scaling.",
      usage:
        "toolbelt cooking <amount> <from> <to> [--ingredient id] | toolbelt cooking --temp <n> [--temp-unit c|f|gas] | toolbelt cooking --servings 4:6 [recipe] | toolbelt cooking --list",
      options: [
        {
          name: "ingredient",
          alias: "i",
          type: "string",
          arg: "<id>",
          desc: "Ingredient, for volume ↔ mass (see --list).",
          default: "water",
        },
        { name: "temp", type: "number", desc: "Oven temperature to convert." },
        {
          name: "temp-unit",
          type: "string",
          values: ["c", "f", "gas"],
          desc: "Unit of --temp.",
          default: "c",
        },
        {
          name: "servings",
          type: "string",
          arg: "<from:to>",
          desc: "Scale the recipe (input) from this many servings to that many.",
        },
        { name: "factor", type: "number", desc: "Scale the recipe (input) by this factor." },
        { name: "decimal-comma", type: "boolean", desc: "Write scaled decimals with a comma." },
        { name: "list", type: "boolean", desc: "List the units and ingredients." },
      ],
      examples: [
        { cmd: "toolbelt cooking 1 cup g --ingredient flour" },
        { cmd: "toolbelt cooking --temp 180" },
        { cmd: "toolbelt cooking --servings 4:6 --file recipe.txt" },
      ],
      run: cookingCmd,
    },
    {
      name: "grades",
      tool: "grades",
      aliases: ["gpa"],
      summary:
        "Weighted grade average (any scale, or German 1–6), percent, letter/GPA, and the grade needed next.",
      usage:
        'toolbelt grades "<grade>[/<out of>] [x<coef>]; ..." [--scale 20] [--target n --next-coef n] [--system scale|de]',
      options: [
        {
          name: "scale",
          type: "number",
          desc: "Scale of the average (20, 10, 100…).",
          default: 20,
        },
        {
          name: "system",
          type: "string",
          values: ["scale", "de"],
          desc: "de: German grades 1 (best) to 6, with + and −.",
          default: "scale",
        },
        { name: "target", type: "number", desc: "Target average: print the grade needed next." },
        { name: "next-coef", type: "number", desc: "Coefficient of the next grade.", default: 1 },
      ],
      notes:
        'One grade per line or separated by ";": "15", "15/20", "8/10 x2" (out of 10, coefficient 2).',
      examples: [
        { cmd: 'toolbelt grades "15/20 x2; 12; 8/10 x3"' },
        { cmd: 'toolbelt grades "12; 9; 14" --target 12 --next-coef 2' },
        { cmd: 'toolbelt grades "2+; 3; 1-" --system de' },
      ],
      run: gradesCmd,
    },
    {
      name: "eta",
      tool: "eta",
      summary:
        "When will it be done: progress, pace and finish time; the pace needed for a deadline; time at a given pace.",
      usage:
        "toolbelt eta --total n --done n (--start <date> | --elapsed <hours>) [--deadline <date>] [--zone z] | toolbelt eta --left n --speed n [--per minute|hour|day]",
      options: [
        { name: "total", type: "number", desc: "Total amount of work." },
        { name: "done", type: "number", desc: "Amount done so far." },
        {
          name: "start",
          type: "string",
          arg: "<date>",
          desc: "When it started (ISO date, read in --zone).",
        },
        { name: "elapsed", type: "number", desc: "Hours since the start (instead of --start)." },
        {
          name: "deadline",
          type: "string",
          arg: "<date>",
          desc: "Print the pace needed to finish by then.",
        },
        { name: "left", type: "number", desc: "What is left (pace mode)." },
        { name: "speed", type: "number", desc: "Items per --per (pace mode)." },
        {
          name: "per",
          type: "string",
          values: ["minute", "hour", "day"],
          desc: "Unit of --speed.",
          default: "hour",
        },
        {
          name: "zone",
          alias: "z",
          type: "string",
          arg: "<zone>",
          desc: "Time zone of dates.",
          default: "UTC",
        },
      ],
      examples: [
        { cmd: "toolbelt eta --total 120 --done 30 --elapsed 2" },
        {
          cmd: "toolbelt eta --total 500 --done 120 --start 2026-01-15T08:00 --deadline 2030-12-31T18:00",
        },
        { cmd: "toolbelt eta --left 90 --speed 20 --per hour" },
      ],
      run: etaCmd,
    },
  ],
};
