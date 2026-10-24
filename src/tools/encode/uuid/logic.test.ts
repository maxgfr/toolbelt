import { describe, expect, it } from "bun:test";
import { EncodeError } from "../_shared";
import {
  bytesToUlid,
  checkAlphabet,
  generateIds,
  inspectId,
  NANOID_ALPHABETS,
  nanoid,
  nanoidBits,
  ulid,
  uuidV4,
  uuidV7,
} from "./logic";

const OPTS = { uppercase: false, dashes: true, size: 21, alphabet: NANOID_ALPHABETS.url };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuid generation", () => {
  it("sets the version and variant bits of v4", () => {
    expect(uuidV4(new Uint8Array(16))).toBe("00000000-0000-4000-8000-000000000000");
    expect(uuidV4(new Uint8Array(16).fill(255))).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    const id = uuidV4();
    expect(id).toMatch(UUID_RE);
    expect(id[14]).toBe("4");
  });

  it("embeds the millisecond time in v7 and reads it back", () => {
    const ms = 1645557742000;
    const id = uuidV7(ms, new Uint8Array(10));
    expect(id).toBe("017f22e2-79b0-7000-8000-000000000000");
    expect(inspectId(id)?.timestamp).toBe(ms);
    const now = Date.now();
    expect(inspectId(uuidV7(now))?.timestamp).toBe(now);
  });

  it("encodes a ULID's time in its first 10 characters", () => {
    // The ulid README's example: decodeTime("01ARYZ6S41TSV4RRFFQ69G5FAV") === 1469918176385.
    expect(ulid(1469918176385, new Uint8Array(10)).slice(0, 10)).toBe("01ARYZ6S41");
    expect(ulid(0, new Uint8Array(10))).toBe("00000000000000000000000000");
    expect(bytesToUlid(new Uint8Array(16).fill(255))).toBe("7ZZZZZZZZZZZZZZZZZZZZZZZZZ");
  });

  it("generates sorted, unique batches with the formatting options", () => {
    const v7 = generateIds("v7", 200, OPTS);
    expect(new Set(v7).size).toBe(200);
    expect([...v7].sort()).toEqual(v7);
    const loud = generateIds("v4", 3, { ...OPTS, uppercase: true, dashes: false });
    for (const id of loud) expect(id).toMatch(/^[0-9A-F]{32}$/);
    expect(generateIds("ulid", 2, { ...OPTS, uppercase: false })[0]).toMatch(/^[0-9a-z]{26}$/);
    expect(generateIds("v4", 5000, OPTS)).toHaveLength(1000);
    expect(generateIds("v4", 0, OPTS)).toHaveLength(1);
  });
});

describe("nanoid", () => {
  it("respects the size and alphabet", () => {
    expect(nanoid()).toHaveLength(21);
    const id = nanoid(64, "ab");
    expect(id).toHaveLength(64);
    expect(id).toMatch(/^[ab]+$/);
    expect(nanoid(10, "é😀")).toMatch(/^(é|😀){10}$/u);
  });

  it("rejects bad alphabets", () => {
    expect(() => checkAlphabet("a")).toThrow(EncodeError);
    expect(() => checkAlphabet("abca")).toThrow(EncodeError);
    expect(() => nanoid(0)).toThrow(EncodeError);
  });

  it("computes the random bits", () => {
    expect(nanoidBits(21, NANOID_ALPHABETS.url)).toBe(126);
    expect(nanoidBits(8, NANOID_ALPHABETS.hex)).toBe(32);
  });
});

describe("inspectId", () => {
  it("reads the RFC 9562 examples", () => {
    const ts = Date.UTC(2022, 1, 22, 19, 22, 22);
    const v1 = inspectId("C232AB00-9414-11EC-B3C8-9F6BDECED846");
    expect(v1).toMatchObject({ version: 1, variant: "rfc", timestamp: ts, clockSeq: 0x33c8 });
    expect(v1?.node).toBe("9f:6b:de:ce:d8:46");
    expect(inspectId("1EC9414C-232A-6B00-B3C8-9F6BDECED846")?.timestamp).toBe(ts);
    expect(inspectId("017F22E2-79B0-7CC3-98C4-DC0C0C07398F")).toMatchObject({
      version: 7,
      timestamp: ts,
      canonical: "017f22e2-79b0-7cc3-98c4-dc0c0c07398f",
    });
    const v4 = inspectId("{919108f7-52d1-4320-9bac-f847db4148a8}");
    expect(v4).toMatchObject({ version: 4, variant: "rfc" });
    expect(v4?.timestamp).toBeUndefined();
  });

  it("accepts urn and dashless forms, and detects nil / max / other variants", () => {
    expect(inspectId("urn:uuid:919108f752d143209bacf847db4148a8")?.version).toBe(4);
    expect(inspectId("00000000-0000-0000-0000-000000000000")?.special).toBe("nil");
    expect(inspectId("FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF")?.special).toBe("max");
    expect(inspectId("00000000-0000-0000-c000-000000000001")?.variant).toBe("microsoft");
    expect(inspectId("00000000-0000-0000-0000-000000000001")?.variant).toBe("ncs");
  });

  it("decodes a ULID's timestamp and converts it to a UUID and back", () => {
    expect(inspectId("01ARYZ6S41TSV4RRFFQ69G5FAV")?.timestamp).toBe(1469918176385);
    const info = inspectId("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(info?.kind).toBe("ulid");
    expect(info?.timestamp).toBe(1469922850259);
    expect(inspectId("01arz3ndektsv4rrffq69g5fav")?.canonical).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    const back = inspectId(info?.other ?? "");
    expect(back?.other).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
  });

  it("returns null for empty input and throws on garbage", () => {
    expect(inspectId("  ")).toBeNull();
    expect(() => inspectId("not-an-id")).toThrow(EncodeError);
    expect(() => inspectId("81ARZ3NDEKTSV4RRFFQ69G5FAV")).toThrow(EncodeError);
  });
});
