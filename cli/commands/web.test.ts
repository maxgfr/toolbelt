import { describe, expect, it } from "bun:test";
import { tb } from "../test-utils";

/** Runs a command and checks it succeeded. */
async function ok(argv: string[], io?: Parameters<typeof tb>[1]) {
  const r = await tb(argv, io);
  if (r.code !== 0) throw new Error(`exit ${r.code}: ${r.stderr}${r.stdout}`);
  return r;
}

async function fails(argv: string[], code = 1) {
  const r = await tb(argv);
  expect(r.code).toBe(code);
  return r;
}

describe("color", () => {
  it("converts a color and checks contrast", async () => {
    const r = await ok(["color", "#ff0000"]);
    expect(r.stdout).toContain("rgb(255 0 0)");
    expect(r.stdout).toContain("red");
    const c = await ok(["color", "#777", "--bg", "white", "--json"]);
    const j = JSON.parse(c.stdout);
    expect(j.contrast.ratio).toBeCloseTo(4.48, 1);
    expect(j.contrast.wcag.aaNormal).toBe(false);
    expect((await ok(["color", "white", "--fg", "black"])).stdout).toContain("21:1");
    expect((await ok(["color", "ff8800", "--scale"])).stdout).toContain("Shades");
  });
  it("rejects an invalid color", async () => {
    const r = await fails(["color", "notacolor"]);
    expect(r.stderr).toContain("not a CSS color");
    await fails(["color", "red", "--bg", "white", "--fg", "black"], 2);
  });
});

describe("css-units", () => {
  it("converts lengths", async () => {
    expect((await ok(["css-units", "1.5rem", "--to", "px"])).stdout.trim()).toBe("24px");
    const all = await ok(["css-units", "24px"]);
    expect(all.stdout).toContain("1.5rem");
    expect((await ok(["css-units", "50vw", "--to", "px", "--vw", "1280"])).stdout.trim()).toBe(
      "640px",
    );
  });
  it("rejects bad lengths and units", async () => {
    expect((await fails(["css-units", "12furlongs"])).stderr).toContain("not a CSS length");
    await fails(["css-units", "12px", "--to", "parsec"], 2);
  });
});

describe("chmod", () => {
  it("reads octal and symbolic modes", async () => {
    const r = await ok(["chmod", "755"]);
    expect(r.stdout).toContain("rwxr-xr-x");
    expect(r.stdout).toContain("chmod 755 file");
    const s = await ok(["chmod", "rw-r--r--", "--json"]);
    expect(JSON.parse(s.stdout).octal).toBe("0644");
    expect((await ok(["chmod", "4755", "--path", "a b", "--symbolic"])).stdout).toContain(
      "chmod u=rwx,g=rx,o=rx,u+s 'a b'",
    );
  });
  it("rejects an invalid mode", async () => {
    expect((await fails(["chmod", "999"])).stderr).toContain("not a permission mode");
  });
});

describe("cidr", () => {
  it("computes IPv4 and IPv6 subnets", async () => {
    const r = await ok(["cidr", "192.168.1.10/24"]);
    expect(r.stdout).toContain("192.168.1.255");
    expect(r.stdout).toContain("254");
    const sp = await ok(["cidr", "10.0.0.0/16", "--split", "4", "--json"]);
    const j = JSON.parse(sp.stdout);
    expect(j.split.prefix).toBe(18);
    expect(j.split.subnets[1].cidr).toBe("10.0.64.0/18");
    const v6 = await ok(["cidr", "2001:db8:abcd:12::1/48", "--json"]);
    expect(JSON.parse(v6.stdout).network).toBe("2001:db8:abcd::/48");
  });
  it("rejects invalid blocks", async () => {
    expect((await fails(["cidr", "300.1.1.1/24"])).stderr).toContain("not a valid address");
    await fails(["cidr", "2001:db8::/48", "--split", "2"], 2);
  });
});

describe("semver", () => {
  it("parses, compares, checks ranges and bumps", async () => {
    expect((await ok(["semver", "1.4.2-beta.3+exp.sha"])).stdout).toContain("beta.3");
    expect((await ok(["semver", "1.10.0", "--compare", "1.9.3"])).stdout).toContain(
      "1.10.0 > 1.9.3 (minor difference)",
    );
    const r = await ok(["semver", "1.2.0", "1.8.3", "2.0.0", "--range", "^1.2.0"]);
    expect(r.stdout).toContain("Max satisfying: 1.8.3");
    expect(
      (await ok(["semver", "1.2.3", "--inc", "prerelease", "--preid", "beta"])).stdout.trim(),
    ).toBe("1.2.4-beta.0");
  });
  it("rejects invalid versions and unmatched ranges", async () => {
    expect((await fails(["semver", "1.2"])).stderr).toContain("not a valid semantic version");
    await fails(["semver", "3.0.0", "--range", "^1.0.0"]);
  });
});

describe("user-agent", () => {
  it("parses a user agent", async () => {
    const r = await ok([
      "user-agent",
      "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
    ]);
    expect(r.stdout).toContain("Firefox 133.0");
    expect(r.stdout).toContain("Linux");
    expect(JSON.parse((await ok(["user-agent", "Googlebot/2.1", "--json"])).stdout).bot).toBe(true);
  });
  it("needs a user agent", async () => {
    expect((await fails(["user-agent"], 2)).stderr).toContain("missing input");
  });
});

describe("http-status", () => {
  it("looks up codes, classes and words", async () => {
    expect((await ok(["http-status", "418"])).stdout).toContain("418 I'm a teapot");
    expect((await ok(["http-status", "404", "--lang", "fr"])).stdout).toContain("404");
    expect((await ok(["http-status", "4xx"])).stdout).toContain("429");
    expect((await ok(["http-status", "too", "many", "requests"])).stdout).toContain("429");
  });
  it("reports no match", async () => {
    expect((await fails(["http-status", "999"])).stdout).toContain("No status matches");
  });
});

describe("mime", () => {
  it("maps extensions and types", async () => {
    expect((await ok(["mime", "photo.webp"])).stdout).toContain("image/webp");
    expect((await ok(["mime", "application/json"])).stdout).toContain(".json");
    expect((await ok(["mime", "--group", "font", "--json"])).stdout).toContain("font/woff2");
  });
  it("errors without input or on no match", async () => {
    await fails(["mime"], 2);
    expect((await fails(["mime", "zzzqqq"])).stdout).toContain("No MIME type");
  });
});

describe("ascii", () => {
  it("looks up characters", async () => {
    const r = await ok(["ascii", "A"]);
    expect(r.stdout).toContain("65");
    expect(r.stdout).toContain("0x41");
    expect(r.stdout).toContain("Latin capital letter A");
    expect((await ok(["ascii", "0x1b"])).stdout).toContain("ESC");
    expect(JSON.parse((await ok(["ascii", "--filter", "control", "--json"])).stdout)).toHaveLength(
      33,
    );
  });
  it("reports no match and bad filters", async () => {
    await fails(["ascii", "nothing-like-this"]);
    await fails(["ascii", "--filter", "emoji"], 2);
  });
});

describe("gitignore", () => {
  it("builds a .gitignore and lists templates", async () => {
    const r = await ok(["gitignore", "node", "macos"]);
    expect(r.stdout).toContain("# --- Node.js ---");
    expect(r.stdout).toContain("node_modules/");
    expect(r.stdout).toContain(".DS_Store");
    expect((await ok(["gitignore", "--list"])).stdout).toContain("python");
    expect((await ok(["gitignore", "--search", "python"])).code).toBe(0);
  });
  it("rejects unknown templates", async () => {
    expect((await fails(["gitignore", "cobol-on-mars"])).stderr).toContain("unknown template");
    await fails(["gitignore"], 2);
  });
});

describe("commit", () => {
  it("builds a conventional commit", async () => {
    const r = await ok(["commit", "add dark mode", "--type", "feat", "--scope", "ui"]);
    expect(r.stdout.trim()).toBe("feat(ui): add dark mode");
    const b = await ok([
      "commit",
      "drop node 18",
      "--type",
      "build",
      "--breaking",
      "--breaking-note",
      "Node 20 is required",
      "--closes",
      "42",
      "--command",
    ]);
    expect(b.stdout).toContain("git commit -m 'build!: drop node 18'");
    expect(b.stdout).toContain("Closes #42");
    const w = await ok(["commit", "Added things.", "--type", "fix"]);
    expect(w.stderr).toContain("warning:");
  });
  it("fails on errors", async () => {
    expect((await fails(["commit", "--type", "feat"])).stderr).toContain(
      "Write a short description",
    );
  });
});

describe("validators", () => {
  it("checks cards, IBANs, barcodes and ISBNs", async () => {
    expect((await ok(["validators", "4111111111111111"])).stdout).toContain("Visa");
    const iban = await ok(["validators", "DE89 3704 0044 0532 0130 00"]);
    expect(iban.stdout).toContain("valid");
    expect(iban.stdout).toContain("37040044");
    expect((await ok(["validators", "978-0-306-40615-7"])).stdout).toContain("ISBN-13");
    expect((await ok(["validators", "4006381333931", "--kind", "gtin"])).stdout).toContain(
      "EAN-13",
    );
  });
  it("exits 1 on invalid numbers", async () => {
    const r = await fails(["validators", "4111111111111112"]);
    expect(r.stdout).toContain("INVALID");
    expect((await fails(["validators", "abc", "--kind", "card"])).stderr).toContain(
      "not a valid card",
    );
  });
});

describe("meta-tags", () => {
  it("generates tags with warnings on stderr", async () => {
    const r = await ok([
      "meta-tags",
      "--title",
      "toolbelt",
      "--description",
      "Everyday utilities that run in your browser, offline and private.",
      "--url",
      "https://example.com/",
    ]);
    expect(r.stdout).toContain("<title>toolbelt</title>");
    expect(r.stdout).toContain('<meta property="og:url" content="https://example.com/" />');
    expect(r.stderr).toContain("No image");
  });
  it("needs a title or description", async () => {
    await fails(["meta-tags"], 2);
  });
});

describe("ip-tools", () => {
  it("converts notations, ranges and checks membership", async () => {
    const n = await ok(["ip-tools", "3232235777"]);
    expect(n.stdout).toContain("192.168.1.1");
    expect(n.stdout).toContain("0xC0A80101");
    const r = await ok(["ip-tools", "10.0.0.5 - 10.0.0.20", "--json"]);
    expect(JSON.parse(r.stdout).cidrs).toEqual([
      "10.0.0.5/32",
      "10.0.0.6/31",
      "10.0.0.8/29",
      "10.0.0.16/30",
      "10.0.0.20/32",
    ]);
    const m = await ok(["ip-tools", "10.1.2.3", "--in", "10.0.0.0/8,192.168.0.0/16"]);
    expect(m.stdout).toContain("inside");
  });
  it("fails on invalid input or no matching block", async () => {
    await fails(["ip-tools", "10.0.0.20 - 10.0.0.5"]);
    await fails(["ip-tools", "8.8.8.8", "--in", "10.0.0.0/8"]);
  });
});

describe("mac-address", () => {
  it("generates and inspects addresses", async () => {
    const g = await ok(["mac-address", "--count", "3", "--json"]);
    const macs: string[] = JSON.parse(g.stdout);
    expect(macs).toHaveLength(3);
    for (const m of macs) expect(m).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/);
    // Locally administered, unicast by default: second hex digit is 2, 6, a or e.
    expect(macs[0]?.[1]).toMatch(/[26ae]/);
    const p = await ok(["mac-address", "--prefix", "00:1A:2B", "--upper", "--format", "dash"]);
    expect(p.stdout).toMatch(/^00-1A-2B-/);
    const i = await ok(["mac-address", "00:1A:2B:3C:4D:5E"]);
    expect(i.stdout).toContain("unicast");
    expect(i.stdout).toContain("fe80::21a:2bff:fe3c:4d5e");
  });
  it("rejects invalid input", async () => {
    await fails(["mac-address", "zz:zz"]);
    await fails(["mac-address", "--prefix", "xyz"]);
  });
});

describe("ipv6-ula", () => {
  it("generates or inspects a prefix", async () => {
    const r = await ok(["ipv6-ula", "fd12:3456:789a::/48", "--subnets", "2"]);
    expect(r.stdout).toContain("fd12:3456:789a::/48");
    expect(r.stdout).toContain("fd12:3456:789a:1::/64");
    const g = JSON.parse((await ok(["ipv6-ula", "--json"])).stdout);
    expect(g.prefix).toMatch(/^fd[0-9a-f]{2}:[0-9a-f]{1,4}:[0-9a-f]{1,4}::\/48$/);
  });
  it("rejects non-ULA addresses", async () => {
    expect((await fails(["ipv6-ula", "2001:db8::1"])).stderr).toContain("not a unique local");
  });
});

describe("random-port", () => {
  it("picks ports and looks up common ones", async () => {
    const ports: number[] = JSON.parse(
      (await ok(["random-port", "--count", "5", "--json"])).stdout,
    );
    expect(ports).toHaveLength(5);
    for (const p of ports) expect(p >= 1024 && p <= 49151).toBe(true);
    expect((await ok(["random-port", "5432"])).stdout).toContain("PostgreSQL");
    const r = await ok(["random-port", "--min", "40000", "--max", "40010", "--count", "2"]);
    for (const p of r.stdout.trim().split("\n")) expect(Number(p)).toBeGreaterThanOrEqual(40000);
  });
  it("rejects bad ranges", async () => {
    await fails(["random-port", "--min", "5000", "--max", "10"], 2);
    await fails(["random-port", "--range", "huge"], 2);
  });
});

describe("git-cheatsheet", () => {
  it("finds git commands from plain words", async () => {
    const r = await ok(["git-cheatsheet", "undo", "the", "last", "commit"]);
    expect(r.stdout).toContain("git reset");
    expect((await ok(["git-cheatsheet", "--group", "stash", "--json"])).stdout).toContain(
      "git stash",
    );
  });
  it("errors without words and on no match", async () => {
    await fails(["git-cheatsheet"], 2);
    await fails(["git-cheatsheet", "bake a sourdough bread"]);
  });
});

describe("email-normalize", () => {
  it("normalizes and dedupes addresses", async () => {
    const r = await ok([
      "email-normalize",
      "John.Doe+news@GoogleMail.com, johndoe@gmail.com",
      "--json",
    ]);
    const rows = JSON.parse(r.stdout);
    expect(rows[0].normalized).toBe("johndoe@gmail.com");
    expect(rows[1].duplicateOf).toBe(0);
    const u = await ok(["email-normalize", "A@Example.com; a@example.com", "--unique"]);
    expect(u.stdout.trim()).toBe("a@example.com");
  });
  it("exits 1 on invalid addresses", async () => {
    const r = await fails(["email-normalize", "not-an-email"]);
    expect(r.stdout).toContain("INVALID");
    expect(r.stdout).toContain("no-at");
  });
});

describe("http-headers", () => {
  it("searches the reference and checks response headers", async () => {
    expect((await ok(["http-headers", "cache"])).stdout).toContain("Cache-Control");
    const good = [
      "HTTP/2 200",
      "strict-transport-security: max-age=63072000; includeSubDomains; preload",
      "content-security-policy: default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      "x-content-type-options: nosniff",
      "referrer-policy: strict-origin-when-cross-origin",
      "permissions-policy: camera=()",
      "cross-origin-opener-policy: same-origin",
    ].join("\n");
    const r = await ok(["http-headers", "--check"], { stdin: good });
    expect(r.stdout).toContain("0 problem(s)");
  });
  it("flags problems and bad input", async () => {
    const r = await fails(["http-headers", "--check", "Server: Apache/2.4.1"]);
    expect(r.stdout).toContain("[bad] Strict-Transport-Security");
    expect(r.stdout).toContain("Apache/2.4.1");
    await fails(["http-headers", "--check", "this is not a header"]);
    await fails(["http-headers"], 2);
  });
});

describe("curl-convert", () => {
  it("converts curl to code", async () => {
    const r = await ok([
      "curl-convert",
      `curl -X POST https://api.example.com/items -H "Content-Type: application/json" -d '{"a":1}'`,
      "--to",
      "python",
    ]);
    expect(r.stdout).toContain("import requests");
    expect(r.stdout).toContain("https://api.example.com/items");
    const f = await ok(["curl-convert", "--", "curl", "-H", "X-Token: abc", "https://x.test"]);
    expect(f.stdout).toContain("fetch(");
    expect(f.stdout).toContain('"X-Token": "abc"');
    const w = await ok(["curl-convert", "curl --bogus https://x.test"]);
    expect(w.stderr).toContain("Unknown option ignored: --bogus");
  });
  it("rejects what is not a curl command", async () => {
    expect((await fails(["curl-convert", "wget https://x.test"])).stderr).toContain(
      "must start with curl",
    );
    expect((await fails(["curl-convert", "curl -X GET", "--lang", "fr"])).stderr).toContain(
      "Aucune URL",
    );
  });
});
