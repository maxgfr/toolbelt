import { render } from "preact";
import { Home } from "./app/Home";
import { Palette, paletteOpen } from "./app/Palette";
import { route } from "./app/router";
import { ToolPage } from "./app/ToolPage";
import { theme, toggleTheme } from "./app/theme";
import { Icon, IconButton, Toasts } from "./app/ui";
import { LANGS, type Lang, lang, setLang, tr } from "./i18n";
import { S } from "./i18n/strings";

function Brand() {
  return (
    <a class="brand" href="#/" aria-label="toolbelt">
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--accent)" />
        <path
          d="M7 13h18v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zM12 13v-2.5a4 4 0 0 1 8 0V13M7 17.5h18"
          fill="none"
          stroke="var(--accent-ink)"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span>toolbelt</span>
    </a>
  );
}

function App() {
  const r = route.value;
  if (r.name === "home") document.title = "toolbelt · everyday utilities in your browser";
  return (
    <>
      <header class="topbar">
        <div class="topbar-inner">
          <Brand />
          <button type="button" class="topbar-search" onClick={() => (paletteOpen.value = true)}>
            <Icon name="search" size={16} />
            <span>{tr(S.search)}</span>
            <kbd>⌘K</kbd>
          </button>
          <div class="topbar-actions">
            <label class="lang-select" title={tr(S.language)}>
              <Icon name="globe" size={16} />
              <span class="sr-only">{tr(S.language)}</span>
              <span class="lang-code" aria-hidden="true">
                {lang.value.toUpperCase()}
              </span>
              <select
                value={lang.value}
                onChange={(e) => setLang((e.currentTarget as HTMLSelectElement).value as Lang)}
              >
                {LANGS.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            <IconButton
              icon={theme.value === "dark" ? "sun" : "moon"}
              label={tr(S.theme)}
              onClick={toggleTheme}
            />
            <a
              class="icon-btn"
              href="https://github.com/maxgfr/toolbelt"
              target="_blank"
              rel="noopener"
              aria-label={tr(S.source)}
              title={tr(S.source)}
            >
              <Icon name="github" />
            </a>
          </div>
        </div>
      </header>
      {r.name === "home" ? <Home /> : <ToolPage id={r.id} shared={r.shared} />}
      {paletteOpen.value && <Palette />}
      <Toasts />
    </>
  );
}

const root = document.getElementById("app");
if (root) render(<App />, root);

if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
