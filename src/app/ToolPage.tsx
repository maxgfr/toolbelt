/** A tool's page: header (title, favorite, share, reset), then the tool, loaded on demand. */
import type { ComponentType } from "preact";
import { useEffect, useState } from "preact/hooks";
import { tr } from "../i18n";
import { S } from "../i18n/strings";
import { CATEGORIES, findTool } from "../tools/registry";
import type { ToolMeta } from "../tools/types";
import { clearShared } from "./router";
import { decodeShare, encodeShare, MAX_LINK } from "./share";
import { beginTool, favorites, markRecent, resetTool, snapshot, toggleFavorite } from "./state";
import { copyText, Icon, IconButton, toast } from "./ui";

type Loaded = { id: string; View: ComponentType } | { id: string; error: true };

export function ToolPage({ id, shared }: { id: string; shared: string | null }) {
  const tool = findTool(id);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (!tool) return;
    let live = true;
    setLoaded(null);
    markRecent(tool.id);
    document.title = `${tr(tool.title)} · toolbelt`;
    (async () => {
      const state = shared ? await decodeShare(shared) : null;
      try {
        const mod = await tool.load();
        if (!live) return;
        beginTool(tool.id, state);
        if (shared) clearShared(tool.id);
        setLoaded({ id: tool.id, View: mod.default });
      } catch (err) {
        console.error(err);
        if (live) setLoaded({ id: tool.id, error: true });
      }
    })();
    return () => {
      live = false;
    };
  }, [tool, shared]);

  if (!tool)
    return (
      <main class="tool-page">
        <p class="muted">{tr(S.notFound)}</p>
        <a href="#/">{tr(S.home)}</a>
      </main>
    );

  return (
    <main class="tool-page">
      <ToolHeader
        tool={tool}
        onReset={() => {
          resetTool();
          beginTool(tool.id, null);
          setEpoch((e) => e + 1);
        }}
      />
      <div class="tool-body">
        {!loaded || loaded.id !== tool.id ? (
          <p class="muted">{tr(S.loading)}</p>
        ) : "error" in loaded ? (
          <p class="error-note">{tr(S.loadFailed)}</p>
        ) : (
          <loaded.View key={`${tool.id}-${epoch}`} />
        )}
      </div>
    </main>
  );
}

function ToolHeader({ tool, onReset }: { tool: ToolMeta; onReset: () => void }) {
  const fav = favorites.value.includes(tool.id);
  const cat = CATEGORIES.find((c) => c.id === tool.category);
  return (
    <header class="tool-head">
      <span class="tool-icon">
        <Icon d={tool.icon} size={24} />
      </span>
      <div class="tool-titles">
        <nav class="crumbs small">
          <a href="#/">{tr(S.home)}</a>
          {cat && (
            <>
              <span aria-hidden="true"> / </span>
              <a href={`#/`}>{tr(cat.title)}</a>
            </>
          )}
        </nav>
        <h1>{tr(tool.title)}</h1>
        <p class="muted">{tr(tool.desc)}</p>
      </div>
      <div class="tool-actions">
        <IconButton
          icon="star"
          class={fav ? "filled fav-on" : ""}
          label={tr(fav ? S.removeFavorite : S.addFavorite)}
          aria-pressed={fav}
          onClick={() => toggleFavorite(tool.id)}
        />
        <IconButton icon="reset" label={tr(S.reset)} onClick={onReset} />
        <IconButton
          icon="link"
          label={tr(S.share)}
          onClick={async () => {
            const state = snapshot();
            const base = `${location.origin}${location.pathname}#/${tool.id}`;
            const url = Object.keys(state).length ? `${base}?s=${await encodeShare(state)}` : base;
            if (url.length > MAX_LINK) return toast(tr(S.shareTooLong), "error");
            if (await copyText(url)) toast(tr(S.shareCopied), "success");
            else toast(tr(S.copyFailed), "error");
          }}
        />
      </div>
    </header>
  );
}
