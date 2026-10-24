import { describe, expect, it } from "bun:test";
import {
  cleanText,
  cleanUrl,
  findUrls,
  isTracking,
  proofpointV2,
  proofpointV3,
  stripTracking,
  unwrapOnce,
} from "./logic";

const ALL = { unwrap: true, strip: true };
const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("unwrap", () => {
  it("decodes Microsoft Safe Links", () => {
    const wrapped =
      "https://nam12.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fpage%3Fid%3D1%26utm_source%3Dnewsletter&data=05%7C02%7Cbob%40corp.test%7C0123456789abcdef%7C0&sdata=AbCdEf%3D&reserved=0";
    const c = cleanUrl(wrapped, ALL);
    expect(c.result).toBe("https://example.com/page?id=1");
    expect(c.unwrapped).toEqual(["Microsoft Safe Links"]);
    expect(c.removed).toEqual(["utm_source"]);
    expect(cleanUrl(wrapped, { unwrap: true, strip: false }).result).toBe(
      "https://example.com/page?id=1&utm_source=newsletter",
    );
  });

  it("decodes Google, Facebook, YouTube, Slack, LinkedIn, Steam, VK and DuckDuckGo", () => {
    const cases: [string, string, string][] = [
      [
        "https://www.google.com/url?sa=t&rct=j&q=&esrc=s&url=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FURL&ved=2ah",
        "https://en.wikipedia.org/wiki/URL",
        "Google",
      ],
      [
        "https://www.google.fr/url?q=https://example.org/a%3Fb%3Dc&sa=D&ust=1",
        "https://example.org/a?b=c",
        "Google",
      ],
      ["https://www.google.co.uk/url?q=https://example.org/", "https://example.org/", "Google"],
      [
        "https://www.google.com/amp/s/example.com/article",
        "https://example.com/article",
        "Google AMP",
      ],
      [
        "https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com%2F&h=AT0abc",
        "https://example.com/",
        "Facebook",
      ],
      [
        "https://lm.facebook.com/l.php?u=http%3A%2F%2Fexample.net%2Fx",
        "http://example.net/x",
        "Facebook",
      ],
      [
        "https://l.instagram.com/?u=https%3A%2F%2Fshop.test%2F&e=AT1",
        "https://shop.test/",
        "Facebook",
      ],
      [
        "https://www.youtube.com/redirect?event=video_description&redir_token=abc&q=https%3A%2F%2Fexample.com%2F",
        "https://example.com/",
        "YouTube",
      ],
      [
        "https://slack-redir.net/link?url=https%3A%2F%2Fexample.com",
        "https://example.com",
        "Slack",
      ],
      [
        "https://www.linkedin.com/redir/redirect?url=https%3A%2F%2Fexample%2Ecom&urlhash=x",
        "https://example.com",
        "LinkedIn",
      ],
      [
        "https://steamcommunity.com/linkfilter/?url=https://example.com/",
        "https://example.com/",
        "Steam",
      ],
      [
        "https://vk.com/away.php?to=https%3A%2F%2Fexample.com%2F&cc_key=",
        "https://example.com/",
        "VK",
      ],
      [
        "https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F&rut=abc",
        "https://example.com/",
        "DuckDuckGo",
      ],
      [
        "https://out.reddit.com/t3_abc?url=https%3A%2F%2Fexample.com%2F&token=x",
        "https://example.com/",
        "Reddit",
      ],
    ];
    for (const [input, want, via] of cases) {
      const c = cleanUrl(input, ALL);
      expect([c.result, c.unwrapped]).toEqual([want, [via]]);
    }
  });

  it("decodes Bing's base64 parameter", () => {
    const url = `https://www.bing.com/ck/a?!&&p=abc&ptn=3&u=a1${b64url("https://example.com/a?b=1")}&ntb=1`;
    expect(cleanUrl(url, ALL).result).toBe("https://example.com/a?b=1");
  });

  it("decodes Proofpoint URL Defense v2 and v3", () => {
    expect(proofpointV2("https-3A__www.example.com_path-3Fa-3D1-26b-3D2")).toBe(
      "https://www.example.com/path?a=1&b=2",
    );
    const v2 =
      "https://urldefense.proofpoint.com/v2/url?u=https-3A__www.example.com_path-3Fa-3D1&d=DwMFaQ&c=abc&r=def&m=ghi&s=jkl&e=";
    expect(cleanUrl(v2, ALL)).toMatchObject({
      result: "https://www.example.com/path?a=1",
      unwrapped: ["Proofpoint URL Defense"],
    });
    // "*" are replaced by the characters of base64url("&#") = "JiM", in order.
    const v3 = "https://urldefense.com/v3/__https://www.example.com/a?x=1*y=2*top__;JiM!!AbC!dEf$";
    expect(proofpointV3(v3)).toBe("https://www.example.com/a?x=1&y=2#top");
    expect(cleanUrl(v3, ALL).result).toBe("https://www.example.com/a?x=1&y=2#top");
    // "**A" is a run of 2 characters.
    expect(
      proofpointV3(`https://urldefense.com/v3/__https://e.test/**A__;${b64url("%7")}!!x`),
    ).toBe("https://e.test/%7");
  });

  it("unwraps nested wrappers, outermost first", () => {
    const inner = "https://www.google.com/url?q=https%3A%2F%2Fexample.com%2F%3Ffbclid%3DXYZ";
    const outer = `https://eur01.safelinks.protection.outlook.com/?url=${encodeURIComponent(inner)}&data=1`;
    const c = cleanUrl(outer, ALL);
    expect(c.result).toBe("https://example.com/");
    expect(c.unwrapped).toEqual(["Microsoft Safe Links", "Google"]);
    expect(c.removed).toEqual(["fbclid"]);
  });

  it("uses a generic rule for redirect endpoints only", () => {
    expect(unwrapOnce("https://click.mail.test/track?u=https%3A%2F%2Fshop.test%2F")).toEqual({
      url: "https://shop.test/",
      via: "click.mail.test",
    });
    expect(unwrapOnce("https://news.test/redirect?url=https://x.test/")?.url).toBe(
      "https://x.test/",
    );
    // A login page's return URL is not a tracking wrapper.
    expect(
      unwrapOnce("https://accounts.test/login?redirect=https://accounts.test/home"),
    ).toBeNull();
    expect(unwrapOnce("https://www.google.com/search?q=https://x.test")).toBeNull();
    expect(unwrapOnce("not a url")).toBeNull();
    // A wrapper whose parameter is not a URL stays as is.
    expect(unwrapOnce("https://www.google.com/url?q=hello")).toBeNull();
  });

  it("flags links that cannot be decoded offline", () => {
    expect(cleanUrl("https://t.co/AbCdEf", ALL).opaque).toBe("X / Twitter (t.co)");
    expect(cleanUrl("https://protect-eu.mimecast.com/s/abc", ALL).opaque).toBe("Mimecast");
    expect(cleanUrl("https://example.com/", ALL).opaque).toBeNull();
  });
});

describe("tracking parameters", () => {
  it("removes known parameters and keeps the rest byte for byte", () => {
    const r = stripTracking(
      "https://shop.test/p?id=42&utm_source=news&UTM_Medium=mail&q=a+b%20c&fbclid=IwAR0&gclid=x&mc_eid=1#frag",
    );
    expect(r.url).toBe("https://shop.test/p?id=42&q=a+b%20c#frag");
    expect(r.removed).toEqual(["utm_source", "UTM_Medium", "fbclid", "gclid", "mc_eid"]);
  });

  it("drops the ? when nothing is left and leaves clean URLs untouched", () => {
    expect(stripTracking("https://a.test/?utm_campaign=x&utm_content=y").url).toBe(
      "https://a.test/",
    );
    const clean = "https://a.test/path?page=2&sort=price";
    expect(stripTracking(clean)).toEqual({ url: clean, removed: [] });
    expect(stripTracking("https://a.test/")).toEqual({ url: "https://a.test/", removed: [] });
  });

  it("knows site-specific parameters", () => {
    expect(stripTracking("https://youtu.be/dQw4w9WgXcQ?si=abc123&t=42").url).toBe(
      "https://youtu.be/dQw4w9WgXcQ?t=42",
    );
    expect(stripTracking("https://x.com/user/status/1?s=20&t=abc").url).toBe(
      "https://x.com/user/status/1",
    );
    // "si" or "t" elsewhere may be meaningful.
    expect(isTracking("si", "example.com")).toBe(false);
    expect(isTracking("t", "example.com")).toBe(false);
    expect(isTracking("utm_term")).toBe(true);
    expect(isTracking("pk_campaign")).toBe(true);
  });
});

describe("text", () => {
  it("finds links without the punctuation around them", () => {
    const text =
      "See (https://a.test/x_(y)) and https://b.test/?q=1, or <https://c.test/>. Also https://d.test/a.";
    expect(findUrls(text).map((f) => f.url)).toEqual([
      "https://a.test/x_(y)",
      "https://b.test/?q=1",
      "https://c.test/",
      "https://d.test/a",
    ]);
  });

  it("cleans every link of a text and keeps the rest", () => {
    const text = [
      "Hi Bob,",
      "the report: https://nam02.safelinks.protection.outlook.com/?url=https%3A%2F%2Fdocs.test%2Freport%3Futm_source%3Dmail&data=x&reserved=0",
      "and the shop https://shop.test/item?id=7&fbclid=abc.",
      "Thanks!",
    ].join("\n");
    const r = cleanText(text, ALL);
    expect(r.text).toBe(
      "Hi Bob,\nthe report: https://docs.test/report\nand the shop https://shop.test/item?id=7.\nThanks!",
    );
    expect(r.links).toHaveLength(2);
    expect(r.links[1]?.removed).toEqual(["fbclid"]);
  });

  it("returns the text unchanged when there is nothing to do", () => {
    expect(cleanText("", ALL)).toEqual({ text: "", links: [] });
    expect(cleanText("no links here", ALL).text).toBe("no links here");
    const t = "https://www.google.com/url?q=https://x.test/&utm_source=a";
    expect(cleanText(t, { unwrap: false, strip: false }).text).toBe(t);
  });
});
