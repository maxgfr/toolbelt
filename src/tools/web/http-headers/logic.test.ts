import { describe, expect, it } from "bun:test";
import { HEADERS } from "./data";
import { checkSecurity, type FindingCode, parseHeaders, searchHeaders, tally } from "./logic";

const codes = (raw: string): FindingCode[] => checkSecurity(parseHeaders(raw)).map((f) => f.code);

const GOOD = `HTTP/2 200
strict-transport-security: max-age=63072000; includeSubDomains; preload
content-security-policy: default-src 'self'; script-src 'self' 'nonce-abc'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
x-content-type-options: nosniff
referrer-policy: strict-origin-when-cross-origin
permissions-policy: camera=(), geolocation=()
cross-origin-opener-policy: same-origin
set-cookie: __Host-sid=1; Path=/; Secure; HttpOnly; SameSite=Lax`;

describe("http-headers — reference", () => {
  it("has about 100 complete, unique entries", () => {
    expect(HEADERS.length).toBeGreaterThanOrEqual(95);
    const names = HEADERS.map((h) => h.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    for (const h of HEADERS) expect(h.en && h.fr && h.example).toBeTruthy();
  });

  it("searches names and both languages, and filters", () => {
    expect(searchHeaders("hsts").map((h) => h.name)).toContain("Strict-Transport-Security");
    expect(searchHeaders("cadre clickjacking").map((h) => h.name)).toContain("X-Frame-Options");
    expect(searchHeaders("", "request").every((h) => h.kind !== "response")).toBe(true);
    expect(searchHeaders("", "all", "cors").every((h) => h.cat === "cors")).toBe(true);
    expect(searchHeaders("qwertyuiop")).toEqual([]);
  });
});

describe("http-headers — parsing", () => {
  it("reads curl output, status lines and folded lines", () => {
    const p = parseHeaders(
      "< HTTP/1.1 301 Moved\r\n< Location: /x\r\n< Set-Cookie: a=1\r\n< Set-Cookie: b=2\r\n< X-Long: one\r\n<   two\r\nnonsense line\r\n",
    );
    expect(p.status).toBe("HTTP/1.1 301 Moved");
    expect(p.map.get("location")).toEqual(["/x"]);
    expect(p.map.get("set-cookie")).toEqual(["a=1", "b=2"]);
    expect(p.map.get("x-long")).toEqual(["one two"]);
    expect(p.bad).toEqual(["nonsense line"]);
    expect(parseHeaders("").map.size).toBe(0);
  });
});

describe("http-headers — security check", () => {
  it("passes a well-configured response", () => {
    const t = tally(checkSecurity(parseHeaders(GOOD)));
    expect(t.bad).toBe(0);
    expect(t.warn).toBe(0);
    expect(codes(GOOD)).toContain("frame-csp");
    expect(codes(GOOD)).toContain("hsts-ok");
    expect(codes(GOOD)).toContain("csp-ok");
  });

  it("flags everything missing on a bare response", () => {
    const c = codes("Content-Type: text/html");
    for (const code of [
      "hsts-missing",
      "csp-missing",
      "xfo-missing",
      "xcto-missing",
      "referrer-missing",
      "pp-missing",
      "coop-missing",
    ] as const)
      expect(c).toContain(code);
    // Worst first.
    expect(checkSecurity(parseHeaders(""))[0]?.level).toBe("bad");
  });

  it("checks HSTS values", () => {
    expect(codes("Strict-Transport-Security: max-age=300")).toContain("hsts-short");
    expect(codes("Strict-Transport-Security: max-age=31536000")).toContain("hsts-subdomains");
    expect(codes("Strict-Transport-Security: includeSubDomains")).toContain("hsts-invalid");
    expect(
      codes("Strict-Transport-Security: max-age=20000000; includeSubDomains; preload"),
    ).toContain("hsts-preload");
  });

  it("checks CSP weaknesses", () => {
    const c = codes(
      "Content-Security-Policy: script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    );
    expect(c).toContain("csp-unsafe-inline");
    expect(c).toContain("csp-unsafe-eval");
    expect(c).toContain("csp-wildcard");
    expect(c).toContain("csp-object-src");
    expect(c).toContain("csp-base-uri");
    // A nonce makes 'unsafe-inline' ignored by modern browsers.
    expect(codes("Content-Security-Policy: script-src 'nonce-x' 'unsafe-inline'")).not.toContain(
      "csp-unsafe-inline",
    );
    expect(codes("Content-Security-Policy-Report-Only: default-src 'self'")).toContain(
      "csp-report-only",
    );
  });

  it("checks framing, nosniff, referrer and the old XSS filter", () => {
    expect(codes("X-Frame-Options: SAMEORIGIN")).toContain("xfo-ok");
    expect(codes("X-Frame-Options: ALLOW-FROM https://a.com")).toContain("xfo-allow-from");
    expect(codes("X-Frame-Options: yes")).toContain("xfo-invalid");
    expect(codes("X-Content-Type-Options: sniff")).toContain("xcto-invalid");
    expect(codes("Referrer-Policy: unsafe-url")).toContain("referrer-unsafe");
    expect(codes("Referrer-Policy: unsafe-url, no-referrer")).toContain("referrer-ok");
    expect(codes("X-XSS-Protection: 1; mode=block")).toContain("xxss-enabled");
    expect(codes("X-XSS-Protection: 0")).toContain("xxss-ok");
    expect(codes("Feature-Policy: camera 'none'")).toContain("fp-deprecated");
  });

  it("checks banners, CORS and cookies", () => {
    expect(codes("Server: Apache/2.4.1")).toContain("server-version");
    expect(codes("Server: cloudflare")).not.toContain("server-version");
    const pb = checkSecurity(parseHeaders("X-Powered-By: PHP/8.1")).find(
      (f) => f.code === "powered-by",
    );
    expect(pb).toMatchObject({ header: "X-Powered-By", detail: "PHP/8.1" });
    expect(
      codes("Access-Control-Allow-Origin: *\nAccess-Control-Allow-Credentials: true"),
    ).toContain("cors-credentials-wildcard");
    expect(codes("Access-Control-Allow-Origin: null")).toContain("cors-null");
    const cookie = checkSecurity(parseHeaders("Set-Cookie: sid=1; Path=/"));
    expect(cookie.filter((f) => f.header === "Set-Cookie").map((f) => f.code)).toEqual([
      "cookie-secure",
      "cookie-httponly",
      "cookie-samesite",
    ]);
    expect(codes("Set-Cookie: sid=1; SameSite=None; HttpOnly")).toContain("cookie-samesite-none");
  });
});
