# toolbelt — notes for contributors and agents

Bun + TypeScript + Preact (signals). Static site on GitHub Pages under `/toolbelt/`. No server,
no network request at all (CSP `connect-src 'self'`), works offline (service worker).

## Commands

- `bun run dev` — rebuild on change, serve on http://localhost:5173/toolbelt/
- `bun run typecheck` · `bun run lint` (Biome) · `bun run format` · `bun run test` · `bun run build`
- `bun run test:e2e` — Playwright: opens every tool in English and French

## Adding a tool

1. `src/tools/<category>/<id>/logic.ts` — pure functions, no DOM, no Preact. Everything that can
   be wrong goes here.
2. `src/tools/<category>/<id>/logic.test.ts` — `bun:test` tests for that logic (edge cases:
   empty input, invalid input, Unicode).
3. `src/tools/<category>/<id>/View.tsx` — `export default function X()`, the interface only.
4. An entry in `src/tools/<category>/index.ts` (`ToolMeta`: id, icon path, title/desc in EN and
   FR, keywords in both languages, `load: () => import("./<id>/View")`).
5. Styles, if the shared classes are not enough, in `src/tools/<category>/styles.css`, prefixed
   with the tool id.

Categories: `text`, `encode` (encoding & crypto), `data` (data & formats), `convert` (time &
numbers), `web` (web & dev).

## Conventions

- **Strings**: every visible string is EN + FR. Declare them at the top of the view:
  `const T = { label: l("English", "Français") }` and render with `tr(T.label)`. Format numbers
  with `fmt()` from `src/i18n`. Never hardcode English in JSX.
- **State**: `useToolState(key, initial, { persist?, share? })` from `src/app/state.ts` instead
  of `useState` for anything the user typed or chose: it survives reloads and goes into share
  links. Use `{ persist: false, share: false }` for secrets (passwords, keys, HMAC secrets).
  Derive outputs with `useComputed`.
- **Shared UI** (`src/app/ui.tsx`): `TextBox` (label, open/drop file, copy, download, clear),
  `Output` (one value + copy), `Stats`, `Segmented`, `Toggle`, `Field`, `Panel`, `FileDrop`,
  `Button`, `CopyButton`, `ErrorNote`, `toast`, `downloadText`, `downloadBlob`.
  Layout classes: `stack`, `row`, `spacer`, `grid-2`, `grid-3`, `input` (inputs, selects),
  `table` in `table-wrap`, `panel`, `mono`, `muted`, `small`.
  Colors only through the CSS variables in `src/styles/app.css` (they handle dark mode).
- **Errors**: invalid input shows a message (`ErrorNote`, or `TextBox` `invalid` + `note`), never
  throws out of a render.
- **Heavy libraries** are imported from the tool's own files only, so they land in that tool's
  chunk. No network access: anything a tool needs is bundled.
- No `dangerouslySetInnerHTML` (lint error). For sanitized HTML, set `innerHTML` on a ref after
  DOMPurify.
- Biome formatting (double quotes, semicolons, 100 columns); run `bun run format`.
