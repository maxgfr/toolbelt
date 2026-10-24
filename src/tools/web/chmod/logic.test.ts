import { describe, expect, it } from "bun:test";
import {
  bit,
  chmodCommand,
  parseOctal,
  parseSymbolic,
  shortOctal,
  toChmodSymbolic,
  toOctal,
  toSymbolic,
} from "./logic";

describe("chmod", () => {
  it("maps classes and permissions to bits", () => {
    expect(bit("owner", "r")).toBe(0o400);
    expect(bit("group", "w")).toBe(0o020);
    expect(bit("others", "x")).toBe(0o001);
  });

  it("writes octal and symbolic forms", () => {
    expect(toOctal(0o755)).toBe("0755");
    expect(toSymbolic(0o755)).toBe("rwxr-xr-x");
    expect(toSymbolic(0o640)).toBe("rw-r-----");
    expect(toSymbolic(0)).toBe("---------");
  });

  it("shows special bits as s/S and t/T", () => {
    expect(toSymbolic(0o4755)).toBe("rwsr-xr-x");
    expect(toSymbolic(0o4644)).toBe("rwSr--r--");
    expect(toSymbolic(0o2775)).toBe("rwxrwsr-x");
    expect(toSymbolic(0o1777)).toBe("rwxrwxrwt");
    expect(toSymbolic(0o1776)).toBe("rwxrwxrwT");
  });

  it("parses octal in its usual spellings", () => {
    expect(parseOctal("755")).toBe(0o755);
    expect(parseOctal("0755")).toBe(0o755);
    expect(parseOctal("4755")).toBe(0o4755);
    expect(parseOctal("04755")).toBe(0o4755);
    expect(parseOctal("0o644")).toBe(0o644);
    expect(parseOctal("7")).toBe(0o7);
    expect(parseOctal("")).toBeNull();
    expect(parseOctal("789")).toBeNull();
    expect(parseOctal("14755")).toBeNull();
    expect(parseOctal("rwx")).toBeNull();
  });

  it("parses symbolic forms, with the ls -l file type", () => {
    expect(parseSymbolic("rwxr-xr-x")).toBe(0o755);
    expect(parseSymbolic("-rw-r--r--")).toBe(0o644);
    expect(parseSymbolic("drwxrwxrwt")).toBe(0o1777);
    expect(parseSymbolic("rwSr--r--")).toBe(0o4644);
    expect(parseSymbolic("rwxr-sr-x")).toBe(0o2755);
    expect(parseSymbolic("rwxr-xr-")).toBeNull();
    expect(parseSymbolic("rwxr-xr-s")).toBeNull();
    expect(parseSymbolic("abcdefghi")).toBeNull();
  });

  it("round-trips every mode", () => {
    for (let m = 0; m <= 0o7777; m += 7) {
      expect(parseSymbolic(toSymbolic(m))).toBe(m);
      expect(parseOctal(toOctal(m))).toBe(m);
    }
  });

  it("builds the chmod command, quoting the path", () => {
    expect(chmodCommand(0o755, "deploy.sh")).toBe("chmod 755 deploy.sh");
    expect(chmodCommand(0o4755, "bin/tool", { recursive: true })).toBe("chmod -R 4755 bin/tool");
    expect(chmodCommand(0o644, "my file's.txt")).toBe(`chmod 644 'my file'\\''s.txt'`);
    expect(chmodCommand(0o600, "")).toBe("chmod 600 file");
    expect(chmodCommand(0o750, "x", { symbolic: true })).toBe("chmod u=rwx,g=rx,o= x");
    expect(toChmodSymbolic(0o1777)).toBe("u=rwx,g=rwx,o=rwx,+t");
    expect(shortOctal(0o2775)).toBe("2775");
  });
});
