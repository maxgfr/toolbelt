import { describe, expect, it } from "bun:test";
import { tb } from "../test-utils";

describe("box-shadow", () => {
  it("builds one layer from flags", async () => {
    const r = await tb(["box-shadow", "--y", "8", "--blur", "24", "--alpha", "0.2"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("box-shadow: 0 8px 24px rgb(0 0 0 / 0.2);\n");
  });
  it("uses a preset, as Tailwind", async () => {
    const r = await tb(["box-shadow", "--preset", "sharp", "--format", "tailwind"]);
    expect(r.stdout.trim()).toBe("shadow-[6px_6px_0_#111827]");
  });
  it("rejects a bad color and an unknown preset", async () => {
    const a = await tb(["box-shadow", "--color", "notacolor"]);
    expect(a.code).toBe(1);
    expect(a.stderr).toContain("not a CSS color");
    const b = await tb(["box-shadow", "--preset", "nope"]);
    expect(b.code).toBe(1);
    expect(b.stderr).toContain("unknown preset");
  });
});

describe("gradient", () => {
  it("spreads colors evenly", async () => {
    const r = await tb(["gradient", "#0f766e", "#f59e0b", "--angle", "90", "--space", "none"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toBe("background-image: linear-gradient(90deg, #0f766e 0%, #f59e0b 100%);\n");
  });
  it("reads positions and a preset", async () => {
    const r = await tb([
      "gradient",
      "red 0",
      "blue 40",
      "--type",
      "radial",
      "--format",
      "value",
      "--space",
      "none",
    ]);
    expect(r.stdout.trim()).toBe("radial-gradient(#ff0000 0%, #0000ff 40%)");
    const p = await tb(["gradient", "--preset", "mint", "--json"]);
    expect(JSON.parse(p.stdout).gradient.stops).toHaveLength(2);
  });
  it("needs two colors", async () => {
    const r = await tb(["gradient", "red"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("at least two colors");
  });
});

describe("border-radius", () => {
  it("shortens a value", async () => {
    const r = await tb(["border-radius", "10px 10px 10px 10px"]);
    expect(r.stdout).toBe("border-radius: 10px;\n");
  });
  it("draws a reproducible blob", async () => {
    const a = await tb(["border-radius", "--random", "--seed", "7", "--format", "value"]);
    const b = await tb(["border-radius", "--random", "--seed", "7", "--format", "value"]);
    expect(a.stdout).toBe(b.stdout);
    expect(a.stdout).toContain("%");
  });
  it("rejects garbage", async () => {
    const r = await tb(["border-radius", "10em"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("cannot read");
  });
});

describe("cubic-bezier", () => {
  it("parses four numbers", async () => {
    const r = await tb(["cubic-bezier", "0.34", "1.56", "0.64", "1", "--format", "value"]);
    expect(r.stdout.trim()).toBe("cubic-bezier(0.34, 1.56, 0.64, 1)");
  });
  it("prints CSS with samples, and keywords", async () => {
    const r = await tb(["cubic-bezier", "ease-in-out"]);
    expect(r.stdout).toContain("transition-timing-function: ease-in-out;");
    expect(r.stdout).toContain("progress at t");
    const p = await tb(["cubic-bezier", "--preset", "out-back", "--json"]);
    expect(JSON.parse(p.stdout).bezier).toEqual([0.34, 1.56, 0.64, 1]);
  });
  it("rejects x outside 0–1", async () => {
    const r = await tb(["cubic-bezier", "1.5", "0", "0", "1"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("cannot read");
  });
});

describe("clip-path", () => {
  it("uses a preset and shapes", async () => {
    const r = await tb(["clip-path", "--preset", "triangle"]);
    expect(r.stdout).toBe("clip-path: polygon(50% 0, 100% 100%, 0 100%);\n");
    const c = await tb(["clip-path", "--shape", "circle", "--r", "40", "--format", "value"]);
    expect(c.stdout.trim()).toBe("circle(40% at 50% 50%)");
    const s = await tb(["clip-path", "--sides", "4", "--format", "value"]);
    expect(s.stdout).toContain("polygon(");
  });
  it("reads points", async () => {
    const r = await tb(["clip-path", "--points", "0 0, 100 0, 50 100", "--format", "value"]);
    expect(r.stdout.trim()).toBe("polygon(0 0, 100% 0, 50% 100%)");
  });
  it("rejects bad points", async () => {
    const r = await tb(["clip-path", "--points", "0 0, 200 0"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("--points");
  });
});

describe("glassmorphism", () => {
  it("prints the CSS rule", async () => {
    const r = await tb(["glassmorphism"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(".glass {");
    expect(r.stdout).toContain("backdrop-filter: blur(16px) saturate(180%);");
  });
  it("uses a preset as Tailwind", async () => {
    const r = await tb(["glassmorphism", "--preset", "clear", "--format", "tailwind"]);
    expect(r.stdout).toContain("backdrop-blur-[6px]");
  });
  it("rejects out-of-range values", async () => {
    const r = await tb(["glassmorphism", "--blur", "500"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("out of range");
  });
});

describe("css-triangle", () => {
  it("builds a border triangle", async () => {
    const r = await tb(["css-triangle", "--direction", "right", "--width", "20", "--height", "30"]);
    expect(r.stdout).toContain("border-left: 20px solid #0f766e;");
    expect(r.stdout).toContain("border-top: 15px solid transparent;");
  });
  it("builds a clip-path triangle", async () => {
    const r = await tb(["css-triangle", "--method", "clip", "--format", "tailwind"]);
    expect(r.stdout).toContain("[clip-path:polygon(50%_0,100%_100%,0_100%)]");
  });
  it("rejects a bad direction", async () => {
    const r = await tb(["css-triangle", "--direction", "north"]);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("--direction must be one of");
  });
});

describe("svg-placeholder", () => {
  it("makes an SVG", async () => {
    const r = await tb(["svg-placeholder", "400x200"]);
    expect(r.stdout).toContain('width="400" height="200"');
    expect(r.stdout).toContain("400×200</text>");
  });
  it("makes a data URI", async () => {
    const r = await tb(["svg-placeholder", "10x10", "--text", "Hi", "--format", "data-uri"]);
    expect(r.stdout.startsWith("data:image/svg+xml,")).toBe(true);
  });
  it("rejects a bad size", async () => {
    const r = await tb(["svg-placeholder", "big"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("not a size");
  });
});

describe("type-scale", () => {
  it("prints a static scale", async () => {
    const r = await tb([
      "type-scale",
      "--base",
      "16",
      "--ratio",
      "1.5",
      "--static",
      "--up",
      "1",
      "--down",
      "0",
    ]);
    expect(r.stdout).toContain("--step-1: 1.5rem;");
    expect(r.stdout).toContain("--step-0: 1rem;");
  });
  it("prints a fluid table", async () => {
    const r = await tb(["type-scale", "--format", "table"]);
    expect(r.stdout).toContain("clamp(");
  });
  it("rejects an out-of-range ratio", async () => {
    const r = await tb(["type-scale", "--ratio", "9"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("--ratio 9 is out of range");
  });
});

describe("palette", () => {
  it("prints CSS variables with the base color kept", async () => {
    const r = await tb(["palette", "#3b82f6"]);
    expect(r.stdout).toContain("--color-primary-500: #3b82f6;");
    expect(r.stdout).toContain("--color-primary-950:");
  });
  it("prints a table with WCAG hints, and JSON", async () => {
    const r = await tb(["palette", "#3b82f6", "--format", "table", "--harmony", "triadic"]);
    expect(r.stdout).toContain("AAA");
    expect(r.stdout).toContain("Harmony (triadic)");
    const j = await tb(["palette", "teal", "--name", "brand", "--json"]);
    expect(JSON.parse(j.stdout).scale).toHaveLength(11);
  });
  it("rejects a bad color", async () => {
    const r = await tb(["palette", "nope"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("not a CSS color");
  });
});
