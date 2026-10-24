/** ⌘K / Ctrl+K: jump to any tool from anywhere. */
import { signal, useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { tr } from "../i18n";
import { S } from "../i18n/strings";
import { CATEGORIES, searchTools } from "../tools/registry";
import { Icon } from "./ui";

export const paletteOpen = signal(false);

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      paletteOpen.value = !paletteOpen.value;
    }
  });
}

const catTitle = new Map(CATEGORIES.map((c) => [c.id, c.title]));

export function Palette() {
  const q = useSignal("");
  const active = useSignal(0);
  const ref = useRef<HTMLDialogElement>(null);
  const list = searchTools(q.value).slice(0, 12);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  function close() {
    paletteOpen.value = false;
  }
  function open(i: number) {
    const t = list[i];
    if (!t) return;
    close();
    location.hash = `#/${t.id}`;
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes through the cancel event
    <dialog
      ref={ref}
      class="palette"
      aria-label={tr(S.searchHint)}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div class="palette-search">
        <Icon name="search" />
        <input
          type="search"
          placeholder={tr(S.search)}
          aria-label={tr(S.search)}
          value={q.value}
          autoFocus
          onInput={(e) => {
            q.value = (e.currentTarget as HTMLInputElement).value;
            active.value = 0;
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              active.value = Math.min(active.value + 1, list.length - 1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              active.value = Math.max(active.value - 1, 0);
            } else if (e.key === "Enter") {
              e.preventDefault();
              open(active.value);
            }
          }}
        />
      </div>
      <ul class="palette-list">
        {list.length === 0 && <li class="muted palette-empty">{tr(S.noResult)}</li>}
        {list.map((t, i) => (
          <li key={t.id}>
            <a
              href={`#/${t.id}`}
              class={i === active.value ? "active" : ""}
              onClick={close}
              onMouseEnter={() => {
                active.value = i;
              }}
            >
              <Icon d={t.icon} />
              <span class="palette-title">{tr(t.title)}</span>
              <span class="palette-cat muted small">{tr(catTitle.get(t.category) ?? t.title)}</span>
            </a>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
