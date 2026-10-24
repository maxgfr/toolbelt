/**
 * Every tool opens in English and in French without an error and without a
 * single request outside the site; then a few real round trips.
 */
import { expect, type Page, test } from "@playwright/test";
import { TOOLS } from "../src/tools/registry";

function watch(page: Page, origin: string) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console error: ${m.text()}`);
  });
  page.on("request", (r) => {
    const url = r.url();
    if (!url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:"))
      problems.push(`external request: ${url}`);
  });
  return problems;
}

async function openTool(page: Page, id: string, lang: "en" | "fr" | "de") {
  await page.addInitScript((l) => localStorage.setItem("toolbelt:lang", l), lang);
  await page.goto(`./#/${id}`);
  await expect(page.locator(".tool-head h1")).toBeVisible();
  await expect(page.locator(".tool-body > p.muted", { hasText: /Loading|Chargement/ })).toHaveCount(
    0,
  );
  await expect(page.locator(".tool-body .error-note", { hasText: /failed to load/ })).toHaveCount(
    0,
  );
}

for (const lang of ["en", "fr", "de"] as const) {
  test.describe(`every tool opens (${lang})`, () => {
    for (const tool of TOOLS) {
      test(tool.id, async ({ page, baseURL }) => {
        const problems = watch(page, new URL(baseURL ?? "").origin);
        await openTool(page, tool.id, lang);
        await expect(page.locator(".tool-head h1")).toHaveText(tool.title[lang] ?? tool.title.en);
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await page.waitForTimeout(150);
        expect(problems).toEqual([]);
      });
    }
  });
}

test("the home page lists and filters the tools", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator(".card")).toHaveCount(TOOLS.length);
  await page.getByRole("searchbox").first().fill("diff");
  await expect(page.locator(".card").first()).toContainText(/diff/i);
  await page.getByRole("searchbox").first().press("Enter");
  await expect(page).toHaveURL(/#\/diff$/);
});

test("the palette jumps to a tool", async ({ page }) => {
  await page.goto("./");
  await page.keyboard.press("ControlOrMeta+k");
  const dialog = page.locator("dialog.palette");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox").fill("json");
  await dialog.getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/#\/json$/);
});

test("the counter counts", async ({ page }) => {
  await page.goto("./#/counter");
  await page.locator("textarea").fill("Hello world. How are you?\n\nFine!");
  const stat = (label: string) =>
    page.locator(".stat", { has: page.locator("dt", { hasText: new RegExp(`^${label}$`) }) });
  await expect(stat("Words").locator("dd")).toHaveText("6");
  await expect(stat("Paragraphs").locator("dd")).toHaveText("2");
});

test("the diff compares two files", async ({ page }) => {
  await page.goto("./#/diff");
  const [a, b] = [page.locator("textarea").nth(0), page.locator("textarea").nth(1)];
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open a file" }).first().click();
  await (await chooser).setFiles({
    name: "a.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("one\ntwo\nthree\n"),
  });
  await expect(a).toHaveValue("one\ntwo\nthree\n");
  await b.fill("one\n2\nthree\nfour\n");
  await expect(page.locator(".diff-summary")).toContainText("+1");
  await expect(page.locator(".diff-split .hl-add")).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .patch" }).click();
  expect((await download).suggestedFilename()).toBe("modified.patch");
});

test("a share link carries the input", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(baseURL ?? "").origin,
  });
  await page.goto("./#/json");
  await page.locator("textarea").first().fill('{"shared":true}');
  await page.getByRole("button", { name: "Copy a link with this input" }).click();
  await expect(page.locator(".toast-success")).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toContain("#/json?s=");

  const other = await context.newPage();
  await other.addInitScript(() => localStorage.clear());
  await other.goto(url);
  await expect(other.locator("textarea").first()).toHaveValue('{"shared":true}');
  await expect(other).toHaveURL(/#\/json$/);
});

test("the language list translates the page, and the choice stays", async ({ page }) => {
  const counter = TOOLS.find((t) => t.id === "counter");
  await page.goto("./#/counter");
  await page.evaluate(() => localStorage.removeItem("toolbelt:lang"));
  await page.reload();
  await expect(page.locator(".tool-head h1")).toHaveText(counter?.title.en ?? "");
  await page.locator(".lang-select select").selectOption("de");
  await expect(page.locator(".tool-head h1")).toHaveText(counter?.title.de ?? "");
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await page.reload();
  await expect(page.locator(".tool-head h1")).toHaveText(counter?.title.de ?? "");
  await page.locator(".lang-select select").selectOption("fr");
  await expect(page.locator(".tool-head h1")).toHaveText(counter?.title.fr ?? "");
});

for (const [browser, expected] of [
  ["de-DE", "de"],
  ["fr-CA", "fr"],
  ["es-ES", "en"],
] as const) {
  test.describe(`a ${browser} browser`, () => {
    test.use({ locale: browser });
    test(`starts in ${expected}`, async ({ page }) => {
      await page.goto("./");
      await expect(page.locator("html")).toHaveAttribute("lang", expected);
      await expect(page.locator(".lang-select select")).toHaveValue(expected);
    });
  });
}
