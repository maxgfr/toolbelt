import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pngChunk } from "../../src/tools/image/exif/logic";
import { tb } from "../test-utils";

/** A big-endian TIFF with one ASCII tag (Make). */
function tiffMake(make: string): Uint8Array {
  const text = new TextEncoder().encode(`${make}\0`);
  const out = new Uint8Array(26 + text.length);
  const dv = new DataView(out.buffer);
  out.set([0x4d, 0x4d, 0, 42]);
  dv.setUint32(4, 8);
  dv.setUint16(8, 1);
  dv.setUint16(10, 0x010f);
  dv.setUint16(12, 2);
  dv.setUint32(14, text.length);
  dv.setUint32(18, 26);
  dv.setUint32(22, 0);
  out.set(text, 26);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** A 3×2 PNG (header only) with an eXIf chunk and a tEXt comment. */
function png(): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, 3);
  dv.setUint32(4, 2);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("eXIf", tiffMake("Canon")),
    pngChunk("tEXt", new TextEncoder().encode("Comment\0hello")),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

let dir = "";
let photo = "";
let text = "";

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "toolbelt-image-"));
  photo = join(dir, "photo.png");
  text = join(dir, "note.txt");
  await writeFile(photo, png());
  await writeFile(text, "not an image");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("browser-only image tools", () => {
  for (const id of ["image-convert", "image-resize", "favicon", "image-colors"])
    it(`${id} prints its link`, async () => {
      const r = await tb([id]);
      expect(r.code).toBe(0);
      expect(r.stdout).toContain(`https://maxgfr.github.io/toolbelt/#/${id}`);
      expect(r.stdout).toContain("browser only");
      const bad = await tb([id, "--bogus"]);
      expect(bad.code).toBe(2);
      expect(bad.stderr).toContain("unknown option");
    });
});

describe("exif", () => {
  it("reads metadata", async () => {
    const r = await tb(["exif", photo, "--all"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Format:");
    expect(r.stdout).toContain("PNG");
    expect(r.stdout).toContain("Canon");
    expect(r.stdout).toContain("tEXt");
    const j = await tb(["exif", "--file", photo, "--json"]);
    expect(JSON.parse(j.stdout).summary.camera).toBe("Canon");
  });
  it("strips metadata to a file", async () => {
    const out = join(dir, "clean.png");
    const r = await tb(["exif", photo, "--strip", "--out", out]);
    expect(r.code).toBe(0);
    const again = await tb(["exif", out, "--json"]);
    const meta = JSON.parse(again.stdout);
    expect(meta.tags).toHaveLength(0);
    expect(meta.blocks).toHaveLength(0);
    expect((await readFile(out)).length).toBeLessThan(png().length);
  });
  it("rejects other files and missing ones", async () => {
    const r = await tb(["exif", text]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("not a JPEG, PNG or WebP");
    const m = await tb(["exif", join(dir, "missing.jpg")]);
    expect(m.code).toBe(1);
    expect(m.stderr).toContain("file not found");
  });
});

describe("image-base64", () => {
  it("encodes a file as a data URI with its size", async () => {
    const r = await tb(["image-base64", photo]);
    expect(r.stdout.startsWith("data:image/png;base64,iVBORw0KGgo")).toBe(true);
    const h = await tb(["image-base64", photo, "--format", "html", "--alt", "Pic"]);
    expect(h.stdout).toContain('width="3" height="2" alt="Pic"');
  });
  it("decodes back to the same bytes", async () => {
    const uri = (await tb(["image-base64", photo])).stdout.trim();
    const r = await tb(["image-base64", "--decode", uri]);
    expect(r.code).toBe(0);
    expect(r.bytes).toEqual(png());
    const j = await tb(["image-base64", "--decode", uri, "--json"]);
    expect(JSON.parse(j.stdout)).toMatchObject({ mime: "image/png", width: 3, height: 2 });
  });
  it("rejects non-images and bad Base64", async () => {
    const r = await tb(["image-base64", text]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("not a recognized image");
    const d = await tb(["image-base64", "--decode", "@@@"]);
    expect(d.code).toBe(1);
    expect(d.stderr).toContain("not valid Base64");
  });
});

describe("svg-to-png", () => {
  const svg = '<svg width="10" height="20"><!-- c --><rect x="1.23456" y="0"/></svg>';
  it("shows the size and the PNG link", async () => {
    const r = await tb(["svg-to-png", svg, "--scale", "4"]);
    expect(r.stdout).toContain("10 × 20 px");
    expect(r.stdout).toContain("40 × 80 px");
    expect(r.stdout).toContain("#/svg-to-png");
  });
  it("cleans", async () => {
    const r = await tb(["svg-to-png", svg, "--clean"]);
    expect(r.stdout.trim()).toBe('<svg width="10" height="20"><rect x="1.23" y="0"/></svg>');
  });
  it("rejects text without <svg>, localized", async () => {
    const r = await tb(["svg-to-png", "hello"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("No <svg> element found.");
    const fr = await tb(["svg-to-png", "hello", "--lang", "fr"]);
    expect(fr.stderr).toContain("Aucun élément <svg> trouvé.");
  });
});

describe("color-blind", () => {
  it("simulates two colors with their distance", async () => {
    const r = await tb(["color-blind", "#d62728", "#2ca02c"]);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("deuteranopia");
    expect(r.stdout).toContain("DISTANCE");
    const j = await tb(["color-blind", "ff7f0e", "--mild", "--json"]);
    expect(JSON.parse(j.stdout)).toHaveLength(9);
  });
  it("rejects a bad color", async () => {
    const r = await tb(["color-blind", "zz"]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("not a hex color");
  });
});
