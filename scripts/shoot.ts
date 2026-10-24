/** Headless screenshots of a few pages (dev helper, not shipped): bun scripts/shoot.ts <outdir> [hash...] */

import { join } from "node:path";
import { chromium } from "@playwright/test";
import { serveApp } from "./serve";

const [out = "shots", ...hashes] = process.argv.slice(2);
const server = serveApp({ port: 4199, dir: join(import.meta.dir, "../dist") });
const browser = await chromium.launch();
const errors: string[] = [];
for (const scheme of ["light", "dark"] as const) {
  const page = await browser.newPage({
    viewport: { width: Number(process.env.W ?? 1280), height: 900 },
    colorScheme: scheme,
  });
  const seed = process.env.SEED;
  if (seed)
    await page.addInitScript((s) => {
      for (const [k, v] of Object.entries(JSON.parse(s)))
        localStorage.setItem(k, k === "toolbelt:lang" ? String(v) : JSON.stringify(v));
    }, seed);
  page.on("console", (m) => m.type() === "error" && errors.push(`${m.text()}`));
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const h of hashes.length ? hashes : ["#/"]) {
    await page.goto(`http://localhost:4199/toolbelt/${h}`);
    await page.waitForTimeout(400);
    const name = `${scheme}-${h.replace(/[^a-z0-9]+/gi, "_") || "home"}.png`;
    await page.screenshot({ path: join(out, name), fullPage: !process.env.TOP });
  }
  await page.close();
}
await browser.close();
server.stop();
console.log(errors.length ? `errors:\n${errors.join("\n")}` : "no console errors");
