/**
 * Hash routes, so every page works from GitHub Pages without a server:
 *   #/              home
 *   #/<tool>        a tool
 *   #/<tool>?s=…    a tool with a shared input (see share.ts)
 */
import { signal } from "@preact/signals";

export type Route = { name: "home" } | { name: "tool"; id: string; shared: string | null };

export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#\/?/, "");
  const [path = "", query = ""] = h.split("?");
  const id = path.split("/")[0] ?? "";
  if (!id) return { name: "home" };
  return { name: "tool", id, shared: new URLSearchParams(query).get("s") };
}

export const route = signal<Route>(
  typeof location === "undefined" ? { name: "home" } : parseRoute(location.hash),
);

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    route.value = parseRoute(location.hash);
  });
}

export function go(hash: string): void {
  if (location.hash === hash) route.value = parseRoute(hash);
  else location.hash = hash;
}

/** Drops the ?s= part once a shared input has been read, so a reload keeps the user's edits. */
export function clearShared(id: string): void {
  history.replaceState(null, "", `#/${id}`);
}
