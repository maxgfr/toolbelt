/** The home page: favorites, recent tools, then every tool by category, filtered by the search box. */
import { useSignal } from "@preact/signals";
import { fmt, tr } from "../i18n";
import { S } from "../i18n/strings";
import { CATEGORIES, findTool, searchTools, TOOLS } from "../tools/registry";
import type { ToolMeta } from "../tools/types";
import { favorites, recents, toggleFavorite } from "./state";
import { Icon } from "./ui";

export function ToolCard({ tool }: { tool: ToolMeta }) {
  const fav = favorites.value.includes(tool.id);
  return (
    <div class="card">
      <a class="card-link" href={`#/${tool.id}`}>
        <span class="card-icon">
          <Icon d={tool.icon} size={20} />
        </span>
        <span class="card-text">
          <strong>{tr(tool.title)}</strong>
          <span>{tr(tool.desc)}</span>
        </span>
      </a>
      <button
        type="button"
        class={`card-fav ${fav ? "on" : ""}`}
        aria-pressed={fav}
        aria-label={tr(fav ? S.removeFavorite : S.addFavorite)}
        title={tr(fav ? S.removeFavorite : S.addFavorite)}
        onClick={() => toggleFavorite(tool.id)}
      >
        <Icon name="star" size={16} class={fav ? "filled" : ""} />
      </button>
    </div>
  );
}

function Grid({ tools }: { tools: ToolMeta[] }) {
  return (
    <div class="cards">
      {tools.map((t) => (
        <ToolCard key={t.id} tool={t} />
      ))}
    </div>
  );
}

function pick(ids: string[]): ToolMeta[] {
  return ids.map(findTool).filter((t): t is ToolMeta => !!t);
}

export function Home() {
  const q = useSignal("");
  const query = q.value.trim();
  const favs = pick(favorites.value);
  const recent = pick(recents.value).filter((t) => !favorites.value.includes(t.id));

  return (
    <main class="home">
      <section class="hero">
        <h1>{tr(S.tagline)}</h1>
        <div class="home-search">
          <Icon name="search" />
          <input
            class="input"
            type="search"
            placeholder={tr(S.search)}
            aria-label={tr(S.search)}
            value={q.value}
            // biome-ignore lint/a11y/noAutofocus: the search is the page's main action
            autoFocus
            onInput={(e) => {
              q.value = (e.currentTarget as HTMLInputElement).value;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const first = searchTools(query)[0];
                if (first) location.hash = `#/${first.id}`;
              }
            }}
          />
          <span class="muted small">
            {fmt(TOOLS.length)} {tr(S.tools)}
          </span>
        </div>
      </section>

      {query ? (
        <section class="home-section">
          {searchTools(query).length ? (
            <Grid tools={searchTools(query)} />
          ) : (
            <p class="muted">{tr(S.noResult)}</p>
          )}
        </section>
      ) : (
        <>
          {favs.length > 0 && (
            <section class="home-section">
              <h2>{tr(S.favorites)}</h2>
              <Grid tools={favs} />
            </section>
          )}
          {recent.length > 0 && (
            <section class="home-section">
              <h2>{tr(S.recent)}</h2>
              <Grid tools={recent.slice(0, 4)} />
            </section>
          )}
          {CATEGORIES.filter((c) => c.tools.length).map((c) => (
            <section class="home-section" key={c.id} id={`cat-${c.id}`}>
              <h2>
                {tr(c.title)} <span class="count">{c.tools.length}</span>
              </h2>
              <Grid tools={c.tools} />
            </section>
          ))}
        </>
      )}
      <p class="privacy muted small">{tr(S.privacy)}</p>
    </main>
  );
}
