import { describe, expect, it } from "bun:test";
import {
  type CurlRequest,
  GENERATORS,
  NOTE_MESSAGES,
  PARSE_ERRORS,
  parseCurl,
  pyLiteral,
  TARGETS,
  toAxios,
  toFetch,
  toGo,
  toHttpie,
  tokenize,
  toPhp,
  toPython,
  toWget,
  warningMessage,
} from "./logic";

const req = (cmd: string): CurlRequest => {
  const r = parseCurl(cmd);
  if (!r.ok) throw new Error(r.error);
  return r.request;
};

describe("curl-convert — tokenizer", () => {
  it("handles quotes, escapes and continuations", () => {
    expect(tokenize(`curl 'a b' "c \\"d\\" $x" e\\ f`)).toEqual({
      ok: true,
      tokens: ["curl", "a b", 'c "d" $x', "e f"],
    });
    expect(tokenize("curl \\\n  -X POST \\\r\n  url")).toEqual({
      ok: true,
      tokens: ["curl", "-X", "POST", "url"],
    });
    expect(tokenize("curl ^\n -v ^\n url").ok && tokenize("curl ^\n -v ^\n url")).toMatchObject({
      tokens: ["curl", "-v", "url"],
    });
    expect(tokenize("curl `\n url")).toMatchObject({ tokens: ["curl", "url"] });
    expect(tokenize("curl $'a\\nb\\x41\\u00e9\\''")).toEqual({
      ok: true,
      tokens: ["curl", "a\nbAé'"],
    });
    expect(tokenize(`curl ''  ""`)).toEqual({ ok: true, tokens: ["curl", "", ""] });
    expect(tokenize("curl url # a comment")).toEqual({ ok: true, tokens: ["curl", "url"] });
  });

  it("reports unclosed quotes", () => {
    expect(tokenize("curl 'abc")).toEqual({ ok: false, error: "quote" });
    expect(tokenize('curl "abc')).toEqual({ ok: false, error: "quote" });
    expect(tokenize("curl $'abc")).toEqual({ ok: false, error: "quote" });
  });
});

describe("curl-convert — parsing", () => {
  it("reads method, headers, data and flags", () => {
    const r = req(
      `curl -sSL -X put 'https://api.test/items/1' -H 'Accept: application/json' -H "X-Empty;" -d '{"a":1}' -H 'Content-Type: application/json' -k --compressed -m 2.5 --max-redirs 3`,
    );
    expect(r.method).toBe("PUT");
    expect(r.url).toBe("https://api.test/items/1");
    expect(r.headers).toEqual([
      ["Accept", "application/json"],
      ["X-Empty", ""],
      ["Content-Type", "application/json"],
    ]);
    expect(r.body).toEqual({ kind: "json", text: '{"a":1}', value: { a: 1 } });
    expect(r).toMatchObject({
      follow: true,
      insecure: true,
      compressed: true,
      timeout: 2.5,
      maxRedirects: 3,
      warnings: [],
    });
  });

  it("infers the method and the content type", () => {
    expect(req("curl https://x.test").method).toBe("GET");
    expect(req("curl -I https://x.test").method).toBe("HEAD");
    const post = req("curl https://x.test -d a=1 -d b=2");
    expect(post.method).toBe("POST");
    expect(post.body).toEqual({
      kind: "urlencoded",
      text: "a=1&b=2",
      pairs: [
        ["a", "1"],
        ["b", "2"],
      ],
    });
    expect(post.headers).toEqual([["Content-Type", "application/x-www-form-urlencoded"]]);
    const json = req(`curl https://x.test --json '{"k":[1,2]}'`);
    expect(json.method).toBe("POST");
    expect(json.headers).toEqual([
      ["Content-Type", "application/json"],
      ["Accept", "application/json"],
    ]);
    expect(json.body.kind).toBe("json");
  });

  it("moves data to the query with -G, and url-encodes", () => {
    const r = req("curl -G https://x.test/s?a=1 -d q=hi --data-urlencode 'name=J Doe&co'");
    expect(r.method).toBe("GET");
    expect(r.url).toBe("https://x.test/s?a=1&q=hi&name=J%20Doe%26co");
    expect(r.body.kind).toBe("none");
  });

  it("reads attached and combined short options", () => {
    const r = req("curl -XPOST -HAccept:text/plain -d@body.json -uadmin https://x.test");
    expect(r.method).toBe("POST");
    expect(r.headers[0]).toEqual(["Accept", "text/plain"]);
    expect(r.body).toEqual({ kind: "file", path: "body.json" });
    expect(r.auth).toEqual({ user: "admin", pass: "" });
    expect(r.warnings.map((w) => w.code)).toEqual(["file-data", "no-password"]);
  });

  it("reads multipart forms", () => {
    const r = req(
      `curl -F name=Ann -F 'pic=@a/b.png;type=image/png;filename=me.png' -F 'bio=<bio.txt' --form-string 'raw=@x' https://x.test`,
    );
    expect(r.method).toBe("POST");
    expect(r.body).toEqual({
      kind: "multipart",
      parts: [
        { name: "name", value: "Ann" },
        { name: "pic", value: "", file: "a/b.png", type: "image/png", filename: "me.png" },
        { name: "bio", value: "", file: "bio.txt", fileAsText: true },
        { name: "raw", value: "@x" },
      ],
    });
  });

  it("turns -u, -A, -e, -b and --oauth2-bearer into the request", () => {
    const r = req(
      "curl -u a:b:c -A 'Bot/1' -e https://ref.test -b 'sid=1; t=2' --oauth2-bearer TOKEN https://x.test",
    );
    expect(r.auth).toEqual({ user: "a", pass: "b:c" });
    expect(r.headers).toEqual([
      ["User-Agent", "Bot/1"],
      ["Referer", "https://ref.test"],
      ["Cookie", "sid=1; t=2"],
      ["Authorization", "Bearer TOKEN"],
    ]);
  });

  it("warns about what cannot be converted", () => {
    const r = req("curl --frobnicate -o out.bin -b cookies.txt -v --cert c.pem x.test other.test");
    expect(r.url).toBe("http://x.test");
    expect(r.warnings).toEqual([
      { code: "unknown-option", detail: "--frobnicate" },
      { code: "unsupported-option", detail: "-o out.bin" },
      { code: "cookie-file", detail: "cookies.txt" },
      { code: "unsupported-option", detail: "--cert c.pem" },
      { code: "multiple-urls", detail: "other.test" },
      { code: "no-scheme" },
    ]);
    expect(req("curl https://x.test -H").warnings).toEqual([{ code: "missing-arg", detail: "-H" }]);
  });

  it("rejects what is not a curl command", () => {
    expect(parseCurl("")).toEqual({ ok: false, error: "empty" });
    expect(parseCurl("wget https://x.test")).toEqual({ ok: false, error: "not-curl" });
    expect(parseCurl("curl -v")).toEqual({ ok: false, error: "no-url" });
    expect(parseCurl("curl 'oops")).toEqual({ ok: false, error: "quote" });
    expect(parseCurl("$ curl https://x.test").ok).toBe(true);
    expect(parseCurl("/usr/bin/curl https://x.test").ok).toBe(true);
  });
});

describe("curl-convert — generators", () => {
  const json = req(
    `curl -X POST https://api.test/v1 -H 'Content-Type: application/json' -H 'X-Key: k' -d '{"name":"Ann","n":1,"ok":true,"tags":["a"],"x":null}'`,
  );

  it("never throws, whatever the request", () => {
    const cmds = [
      "curl x.test",
      "curl -I -k -x http://p:8080 -m 1 --connect-timeout 1 https://x.test",
      "curl -F f=@a.bin -F g=<b.txt -u u:p https://x.test",
      "curl -d @file.bin --data-binary @other -X PATCH https://x.test",
      "curl -X CUSTOM -H 'Host: other.test' https://x.test",
    ];
    for (const c of cmds)
      for (const t of TARGETS) expect(GENERATORS[t](req(c)).code.length).toBeGreaterThan(0);
  });

  it("writes fetch", () => {
    const g = toFetch(json);
    expect(g.code).toContain('await fetch("https://api.test/v1", {');
    expect(g.code).toContain('method: "POST"');
    expect(g.code).toContain('"X-Key": "k"');
    expect(g.code).toContain("body: JSON.stringify({");
    expect(g.notes).toEqual([]);
    expect(toFetch(req("curl -k https://x.test")).notes).toEqual(["insecure-unsupported"]);
    expect(toFetch(req("curl https://x.test")).code).toContain('await fetch("https://x.test");');
    expect(toFetch(req("curl -u a:b https://x.test")).code).toContain('btoa("a:b")');
  });

  it("writes axios", () => {
    const g = toAxios(req("curl -k -u a:b -x http://u:p@proxy:3128 https://x.test"));
    expect(g.code).toContain('import https from "node:https";');
    expect(g.code).toContain('auth: { username: "a", password: "b" }');
    expect(g.code).toContain('proxy: { protocol: "http", host: "proxy", port: 3128');
    expect(g.code).toContain("rejectUnauthorized: false");
  });

  it("writes Python requests", () => {
    const g = toPython(json);
    expect(g.code).toContain("json_data = {");
    expect(g.code).toContain('"ok": True,');
    expect(g.code).toContain('"x": None,');
    expect(g.code).not.toContain('"Content-Type"');
    expect(g.code).toContain("requests.post(");
    const form = toPython(req("curl -d a=1 -d b=2 -m 5 --connect-timeout 2 https://x.test"));
    expect(form.code).toContain('data = {\n    "a": "1",\n    "b": "2",\n}');
    expect(form.code).toContain("timeout=(2, 5)");
    expect(toPython(req("curl -X PURGE https://x.test")).code).toContain(
      'requests.request("PURGE", ',
    );
    expect(pyLiteral({ a: [1, { b: false }] })).toBe(
      '{\n    "a": [\n        1,\n        {\n            "b": False,\n        },\n    ],\n}',
    );
  });

  it("writes Go", () => {
    const g = toGo(json);
    expect(g.code).toContain("package main");
    expect(g.code).toContain(
      'http.NewRequest("POST", "https://api.test/v1", strings.NewReader(`{"name":"Ann"',
    );
    expect(g.code).toContain('req.Header.Add("X-Key", "k")');
    expect(toGo(req("curl -H 'Host: h.test' https://x.test")).code).toContain(
      'req.Host = "h.test"',
    );
    expect(toGo(req("curl -k https://x.test")).code).toContain("InsecureSkipVerify: true");
  });

  it("writes PHP", () => {
    const g = toPhp(json);
    expect(g.code).toContain('CURLOPT_POSTFIELDS => \'{"name":"Ann"');
    expect(g.code).not.toContain("CURLOPT_CUSTOMREQUEST");
    expect(toPhp(req("curl -X DELETE https://x.test")).code).toContain(
      "CURLOPT_CUSTOMREQUEST => 'DELETE'",
    );
    expect(toPhp(req("curl -L https://x.test")).code).toContain("CURLOPT_FOLLOWLOCATION => true");
    expect(toPhp(req('curl -d "it\'s" https://x.test')).code).toContain("'it\\'s'");
  });

  it("writes wget and HTTPie", () => {
    const w = toWget(req("curl -d 'a=1' -u u:p https://x.test"));
    expect(w.code).toContain("--post-data=a=1");
    expect(w.code).toContain("--auth-no-challenge");
    expect(toWget(req("curl -F a=b https://x.test")).notes).toEqual(["multipart-unsupported"]);
    const h = toHttpie(json);
    expect(h.code).toContain("POST");
    expect(h.code).toContain("name=Ann");
    expect(h.code).toContain("n:=1");
    expect(h.code).toContain("'tags:=[\"a\"]'");
    expect(h.code).not.toContain("Content-Type");
    expect(toHttpie(req("curl -L -d a=1 https://x.test")).code).toContain("--form");
  });
});

describe("messages", () => {
  it("explains warnings with their detail, notes and parse errors in every language", () => {
    const p = parseCurl("curl --bogus example.com");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.request.warnings.length).toBeGreaterThan(0);
    for (const w of p.request.warnings) {
      const m = warningMessage(w);
      for (const s of [m.en, m.fr, m.de]) expect(s).not.toContain("{d}");
    }
    expect(warningMessage({ code: "unknown-option", detail: "--bogus" }).en).toBe(
      "Unknown option ignored: --bogus",
    );
    expect(NOTE_MESSAGES["proxy-unsupported"].en).toContain("proxy");
    expect(PARSE_ERRORS["no-url"].fr).toContain("URL");
  });
});
