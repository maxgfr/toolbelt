/** Light / dark, following the system until the user picks one. */
import { effect, signal } from "@preact/signals";

type Theme = "light" | "dark";
const KEY = "toolbelt:theme";

function saved(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

const media = typeof matchMedia === "undefined" ? null : matchMedia("(prefers-color-scheme: dark)");
export const theme = signal<Theme>(saved() ?? (media?.matches ? "dark" : "light"));

media?.addEventListener("change", (e) => {
  if (!saved()) theme.value = e.matches ? "dark" : "light";
});

if (typeof document !== "undefined") {
  effect(() => {
    document.documentElement.dataset.theme = theme.value;
  });
}

export function toggleTheme(): void {
  theme.value = theme.value === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(KEY, theme.value);
  } catch {}
}
