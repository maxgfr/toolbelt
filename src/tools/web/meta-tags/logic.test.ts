import { describe, expect, it } from "bun:test";
import {
  buildTags,
  checkMeta,
  displayHost,
  escapeHtml,
  isAbsoluteUrl,
  type MetaInput,
  truncate,
  twitterHandle,
} from "./logic";

const empty: MetaInput = {
  title: "",
  description: "",
  url: "",
  image: "",
  imageAlt: "",
  siteName: "",
  type: "website",
  locale: "",
  twitter: "",
  themeColor: "",
};
const full: MetaInput = {
  title: "Toolbelt — everyday utilities",
  description: "Small tools that run in your browser: counters, diffs, JSON, colors and more.",
  url: "https://example.com/toolbelt/",
  image: "https://example.com/og.png",
  imageAlt: "The toolbelt home page",
  siteName: "Toolbelt",
  type: "website",
  locale: "en_US",
  twitter: "@toolbelt",
  themeColor: "#0f766e",
};

describe("meta-tags", () => {
  it("escapes attribute values", () => {
    expect(escapeHtml(`Tom & "Jerry" <3`)).toBe("Tom &amp; &quot;Jerry&quot; &lt;3");
    const tags = buildTags({ ...empty, title: 'A "quoted" <title>' });
    expect(tags).toContain("<title>A &quot;quoted&quot; &lt;title&gt;</title>");
    expect(tags).toContain('content="A &quot;quoted&quot; &lt;title&gt;"');
  });

  it("writes every tag when everything is filled in", () => {
    const tags = buildTags(full);
    for (const t of [
      "<title>Toolbelt — everyday utilities</title>",
      '<meta name="description" content="Small tools',
      '<link rel="canonical" href="https://example.com/toolbelt/" />',
      '<meta name="theme-color" content="#0f766e" />',
      '<meta property="og:type" content="website" />',
      '<meta property="og:image" content="https://example.com/og.png" />',
      '<meta property="og:image:alt" content="The toolbelt home page" />',
      '<meta property="og:site_name" content="Toolbelt" />',
      '<meta property="og:locale" content="en_US" />',
      '<meta name="twitter:card" content="summary_large_image" />',
      '<meta name="twitter:site" content="@toolbelt" />',
    ])
      expect(tags).toContain(t);
  });

  it("skips empty fields and uses a small card without image", () => {
    const tags = buildTags({ ...empty, title: "Hi" });
    expect(tags).not.toContain("og:image");
    expect(tags).not.toContain("description");
    expect(tags).toContain('<meta name="twitter:card" content="summary" />');
    expect(tags).not.toContain("og:image:alt");
  });

  it("collapses whitespace", () => {
    expect(buildTags({ ...empty, title: "  a \n b  " })).toContain("<title>a b</title>");
  });

  it("normalizes Twitter handles", () => {
    expect(twitterHandle("toolbelt")).toBe("@toolbelt");
    expect(twitterHandle("https://x.com/toolbelt")).toBe("@toolbelt");
    expect(twitterHandle("@way_too_long_handle_here")).toBe("");
    expect(twitterHandle("not a handle")).toBe("");
  });

  it("warns about what hurts previews", () => {
    expect(checkMeta(full)).toEqual([]);
    expect(checkMeta(empty)).toEqual(["noTitle", "noDescription", "noImage"]);
    const w = checkMeta(
      {
        ...full,
        title: "x".repeat(61),
        description: "short",
        url: "/relative",
        image: "og.png",
        twitter: "a b",
        themeColor: "nope",
      },
      (s) => s.startsWith("#"),
    );
    expect(w).toEqual([
      "titleLong",
      "descriptionShort",
      "urlRelative",
      "imageRelative",
      "badHandle",
      "badColor",
    ]);
    expect(checkMeta({ ...full, description: "y".repeat(161) })).toEqual(["descriptionLong"]);
  });

  it("has helpers for the preview card", () => {
    expect(isAbsoluteUrl("https://a.b/c")).toBe(true);
    expect(isAbsoluteUrl("javascript:alert(1)")).toBe(false);
    expect(displayHost("https://www.example.com/a")).toBe("example.com");
    expect(displayHost("nope")).toBe("");
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(truncate("abc", 4)).toBe("abc");
  });
});
