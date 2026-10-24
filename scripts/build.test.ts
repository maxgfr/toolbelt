import { describe, expect, it } from "bun:test";
import { TOOLS } from "../src/tools/registry";
import { auditHtml, CSP, llmsTxt, serviceWorker } from "./build";

describe("build audit", () => {
  it("refuses inline scripts, handlers, styles and external URLs", () => {
    expect(() => auditHtml("<script>alert(1)</script>")).toThrow("inline <script>");
    expect(() => auditHtml('<img src="x.png" onerror="x()">')).toThrow("inline event handler");
    expect(() => auditHtml("<style>a{}</style>")).toThrow("inline <style>");
    expect(() => auditHtml('<script src="https://cdn.example/x.js"></script>')).toThrow(
      "external URL",
    );
    expect(() => auditHtml('<link href="/abs.css">')).toThrow("absolute path");
    expect(() => auditHtml('<script type="module" src="./index.js"></script>')).not.toThrow();
  });

  it("allows no eval, no inline code and no network beyond the site", () => {
    expect(CSP).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(CSP).not.toContain("'unsafe-eval'");
    expect(CSP).not.toContain("unsafe-inline");
    expect(CSP).toContain("connect-src 'self';");
  });

  it("writes a service worker that precaches the files", () => {
    const sw = serviceWorker(["assets/a.js", "icon.svg"], "abc");
    expect(sw).toContain('"toolbelt-abc"');
    expect(sw).toContain('"./assets/a.js"');
    expect(sw).toContain('"./"');
  });

  it("lists every tool in llms.txt", () => {
    const txt = llmsTxt();
    for (const t of TOOLS) expect(txt).toContain(`#/${t.id})`);
  });
});
