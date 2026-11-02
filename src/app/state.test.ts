import { afterEach, describe, expect, it } from "bun:test";
import { favorites, MAX_PERSISTED, persistPlan, toggleFavorite } from "./state";

const realStorage = globalThis.localStorage;

function useStorage(setItem: (k: string, v: string) => void): Map<string, string> {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        setItem(k, v);
        data.set(k, v);
      },
      removeItem: (k: string) => data.delete(k),
    },
  });
  return data;
}

afterEach(() => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: realStorage });
  favorites.value = [];
});

describe("what an input leaves in the shared localStorage", () => {
  it("removes a value back to its default", () => {
    expect(persistPlan("", "")).toEqual({ kind: "remove" });
  });

  it("stores an ordinary value", () => {
    expect(persistPlan("hello", "")).toEqual({ kind: "set", json: '"hello"' });
  });

  it("does not store a value larger than the cap", () => {
    expect(persistPlan("x".repeat(MAX_PERSISTED), "")).toEqual({ kind: "large" });
    expect(persistPlan("x".repeat(MAX_PERSISTED - 2), "").kind).toBe("set");
  });
});

describe("favorites", () => {
  it("are stored under toolbelt's own key", () => {
    const data = useStorage(() => {});
    expect(toggleFavorite("base64")).toBe(true);
    expect(data.get("toolbelt:favorites")).toBe('["base64"]');
  });

  it("report a write the browser refused, and still change for this page", () => {
    useStorage(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });
    expect(toggleFavorite("base64")).toBe(false);
    expect(favorites.value).toEqual(["base64"]);
  });
});
