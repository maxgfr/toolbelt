import { describe, expect, it } from "bun:test";
import { detectLang, fmt, l, lang, locale, pick, tr } from "./index";

describe("i18n", () => {
  it("follows the first browser language it speaks, English otherwise", () => {
    expect(detectLang(["de-CH", "en"])).toBe("de");
    expect(detectLang(["fr-BE"])).toBe("fr");
    expect(detectLang(["es-ES", "fr-FR", "en"])).toBe("fr");
    expect(detectLang(["es", "it"])).toBe("en");
    expect(detectLang([])).toBe("en");
  });

  it("translates, with English when a language is missing", () => {
    lang.value = "de";
    expect(tr(l("Copy", "Copier", "Kopieren"))).toBe("Kopieren");
    expect(tr({ en: "Copy", fr: "Copier" })).toBe("Copy");
    expect(pick({ en: 1, fr: 2, de: 3 })).toBe(3);
    expect(locale()).toBe("de-DE");
    expect(fmt(1234.5)).toBe("1.234,5");
    lang.value = "fr";
    expect(tr(l("Copy", "Copier", "Kopieren"))).toBe("Copier");
    expect(locale()).toBe("fr-FR");
    lang.value = "en";
    expect(fmt(1234.5)).toBe("1,234.5");
  });
});
