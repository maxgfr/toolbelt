import { useComputed } from "@preact/signals";
import DOMPurify from "dompurify";
import { useEffect, useRef } from "preact/hooks";
import { useToolState } from "../../../app/state";
import { Segmented, TextBox, Toggle } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { renderMarkdown, tableOfContents } from "./logic";

type Tab = "preview" | "html" | "toc";

const T = {
  input: l("Markdown", "Markdown", "Markdown"),
  placeholder: l(
    "# Title\n\nWrite **Markdown** here: lists, links, tables, code…",
    "# Titre\n\nÉcris du **Markdown** ici : listes, liens, tableaux, code…",
    "# Titel\n\nSchreib hier **Markdown**: Listen, Links, Tabellen, Code…",
  ),
  preview: l("Preview", "Aperçu", "Vorschau"),
  html: l("HTML", "HTML", "HTML"),
  toc: l("Table of contents", "Table des matières", "Inhaltsverzeichnis"),
  gfm: l(
    "GitHub-flavored (tables, task lists, ~~strike~~)",
    "Style GitHub (tableaux, cases, ~~barré~~)",
    "GitHub-Stil (Tabellen, Aufgabenlisten, ~~durchgestrichen~~)",
  ),
  breaks: l("Line breaks as <br>", "Retours à la ligne en <br>", "Zeilenumbrüche als <br>"),
  empty: l("The preview shows up here.", "L'aperçu s'affiche ici.", "Hier erscheint die Vorschau."),
  noHeadings: l(
    "No headings in this document.",
    "Aucun titre dans ce document.",
    "Keine Überschriften in diesem Dokument.",
  ),
  sanitized: l(
    "Scripts, event handlers and inline styles are removed (DOMPurify). External images are not loaded.",
    "Les scripts, gestionnaires d'événements et styles en ligne sont retirés (DOMPurify). Les images externes ne sont pas chargées.",
    "Skripte, Event-Handler und Inline-Styles werden entfernt (DOMPurify). Externe Bilder werden nicht geladen.",
  ),
};

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, { FORBID_TAGS: ["style"], FORBID_ATTR: ["style"] });
}

export default function Markdown() {
  const md = useToolState("md", "");
  const tab = useToolState<Tab>("tab", "preview");
  const gfm = useToolState("gfm", true);
  const breaks = useToolState("breaks", false);
  const html = useComputed(() => {
    try {
      return sanitize(renderMarkdown(md.value, { gfm: gfm.value, breaks: breaks.value }));
    } catch {
      return "";
    }
  });
  const toc = useComputed(() => {
    try {
      return tableOfContents(md.value);
    } catch {
      return "";
    }
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html.value;
  }, [html.value, tab.value]);

  return (
    <>
      <div class="row">
        <Segmented<Tab>
          value={tab.value}
          onChange={(v) => {
            tab.value = v;
          }}
          options={[
            { value: "preview", label: tr(T.preview) },
            { value: "html", label: tr(T.html) },
            { value: "toc", label: tr(T.toc) },
          ]}
        />
        <Toggle
          checked={gfm.value}
          onChange={(v) => {
            gfm.value = v;
          }}
          label={tr(T.gfm)}
        />
        <Toggle
          checked={breaks.value}
          onChange={(v) => {
            breaks.value = v;
          }}
          label={tr(T.breaks)}
        />
      </div>
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={md.value}
          onInput={(v) => {
            md.value = v;
          }}
          placeholder={tr(T.placeholder)}
          accept=".md,.markdown,text/markdown,text/plain"
          rows={24}
          downloadName="document.md"
        />
        {tab.value === "preview" && (
          <div class="textbox">
            <div class="textbox-head">
              <span class="textbox-label">{tr(T.preview)}</span>
            </div>
            {html.value ? (
              // biome-ignore lint/a11y/useKeyWithClickEvents: only intercepts clicks on links, which keep their own keyboard behavior
              // biome-ignore lint/a11y/noStaticElementInteractions: same as above
              <div
                class="markdown-preview"
                ref={ref}
                onClick={(e) => {
                  const a = (e.target as HTMLElement).closest("a");
                  if (!a) return;
                  // Links must not replace the app (or its #/route): open them in a new tab.
                  e.preventDefault();
                  const href = a.getAttribute("href") ?? "";
                  if (/^(https?:|mailto:)/i.test(href))
                    window.open(href, "_blank", "noopener,noreferrer");
                }}
              />
            ) : (
              <p class="markdown-preview muted">{tr(T.empty)}</p>
            )}
            <p class="textbox-note muted small">{tr(T.sanitized)}</p>
          </div>
        )}
        {tab.value === "html" && (
          <TextBox
            label={tr(T.html)}
            value={html.value}
            readOnly
            rows={24}
            downloadName="document.html"
          />
        )}
        {tab.value === "toc" && (
          <TextBox
            label={tr(T.toc)}
            value={toc.value}
            readOnly
            rows={24}
            note={
              md.value && !toc.value ? <span class="muted">{tr(T.noHeadings)}</span> : undefined
            }
          />
        )}
      </div>
    </>
  );
}
