/**
 * Shared UI pieces every tool builds on: icons, buttons, fields, text boxes
 * with file open / copy / download, stats, segmented controls, toasts.
 */
import { signal } from "@preact/signals";
import type { ComponentChildren, JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { tr } from "../i18n";
import { S } from "../i18n/strings";

const PATHS = {
  search: "M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M21 21l-5-5",
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z",
  share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  download: "M12 3v12M7 10l5 5 5-5M4 19h16",
  print: "M7 9V3h10v6M7 17H4v-7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v7h-3M7 14h10v7H7z",
  upload: "M12 21V9M7 14l5-5 5 5M4 5h16",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5",
  close: "M6 6l12 12M18 6L6 18",
  back: "M15 18l-6-6 6-6",
  trash: "M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3",
  reset: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
  swap: "M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
  check: "M5 12l5 5L20 7",
  sun: "M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  github:
    "M9 19c-4 1.3-4-2-6-2.5M15 21v-3.5a3 3 0 0 0-.9-2.4c3-.3 6-1.5 6-6.6a5 5 0 0 0-1.4-3.6 4.7 4.7 0 0 0-.1-3.5s-1.1-.3-3.6 1.4a12.4 12.4 0 0 0-6.5 0C6 1.1 4.9 1.4 4.9 1.4a4.7 4.7 0 0 0-.1 3.5A5 5 0 0 0 3.4 8.5c0 5.1 3 6.3 6 6.6a3 3 0 0 0-.9 2.3V21",
  plus: "M12 5v14M5 12h14",
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
  globe:
    "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
} as const;

export type IconName = keyof typeof PATHS;

/** An icon by name, or any 24×24 stroke path passed as `d` (the tools' own icons). */
export function Icon({
  name,
  d,
  size = 18,
  class: cls,
}: {
  name?: IconName;
  d?: string;
  size?: number;
  class?: string;
}) {
  return (
    <svg
      class={`icon ${cls ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={name === "star" && cls?.includes("filled") ? "currentColor" : "none"}
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={d ?? (name ? PATHS[name] : "")} />
    </svg>
  );
}

type ButtonProps = JSX.HTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: IconName;
  disabled?: boolean;
  type?: "button" | "submit";
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  children,
  class: cls,
  type,
  ...rest
}: ButtonProps) {
  return (
    <button type={type ?? "button"} class={`btn btn-${variant} btn-${size} ${cls ?? ""}`} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  class: cls,
  ...rest
}: { icon: IconName; label: string; class?: string } & Omit<
  JSX.HTMLAttributes<HTMLButtonElement>,
  "icon" | "label"
> & { disabled?: boolean }) {
  return (
    <button
      type="button"
      class={`icon-btn ${cls ?? ""}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} class={cls ?? ""} />
    </button>
  );
}

/* --- Printing ---------------------------------------------------------- */

let printSource: (() => Node | null) | null = null;

/**
 * While the calling view is mounted, printing (the header button or Ctrl+P) prints the node
 * `source` returns instead of the whole page; returning null prints the page.
 */
export function usePrintSource(source: () => Node | null) {
  const latest = useRef(source);
  latest.current = source;
  useEffect(() => {
    const get = () => latest.current();
    printSource = get;
    return () => {
      if (printSource === get) printSource = null;
    };
  }, []);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeprint", () => {
    const node = printSource?.();
    if (!node) return;
    const root = document.createElement("div");
    root.id = "print-root";
    root.append(node);
    document.body.append(root);
    document.body.classList.add("print-custom");
  });
  window.addEventListener("afterprint", () => {
    document.getElementById("print-root")?.remove();
    document.body.classList.remove("print-custom");
  });
}

/* --- Toasts ------------------------------------------------------------ */

interface Toast {
  id: number;
  text: string;
  kind: "info" | "error" | "success";
}
export const toasts = signal<Toast[]>([]);
let toastId = 0;

export function toast(text: string, kind: Toast["kind"] = "info", ms = 3200): void {
  const id = ++toastId;
  toasts.value = [...toasts.value, { id, text, kind }];
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, ms);
}

export function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.map((t) => (
        <div key={t.id} class={`toast toast-${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* --- Clipboard & files -------------------------------------------------- */

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, name: string, type = "text/plain"): void {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), name);
}

/** Opens the system file picker; resolves with the chosen files (empty if cancelled). */
export function pickFiles(accept = "", multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener("change", () => resolve([...(input.files ?? [])]));
    input.addEventListener("cancel", () => resolve([]));
    input.click();
  });
}

export function CopyButton({
  text,
  label,
  size = "sm",
}: {
  text: string | (() => string);
  label?: string;
  size?: "sm" | "md";
}) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size={size}
      variant="ghost"
      icon={done ? "check" : "copy"}
      onClick={async () => {
        const ok = await copyText(typeof text === "function" ? text() : text);
        if (!ok) return toast(tr(S.copyFailed), "error");
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? tr(S.copied) : (label ?? tr(S.copy))}
    </Button>
  );
}

/* --- Layout & fields ----------------------------------------------------- */

export function Field({
  label,
  hint,
  children,
  class: cls,
}: {
  label: string;
  hint?: string;
  children: ComponentChildren;
  class?: string;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as a child
    <label class={`field ${cls ?? ""}`}>
      <span class="field-label">{label}</span>
      {children}
      {hint && <span class="field-hint">{hint}</span>}
    </label>
  );
}

/** A titled block inside a tool. */
export function Panel({
  title,
  actions,
  children,
  class: cls,
}: {
  title?: string;
  actions?: ComponentChildren;
  children: ComponentChildren;
  class?: string;
}) {
  return (
    <section class={`panel ${cls ?? ""}`}>
      {(title || actions) && (
        <header class="panel-head">
          {title && <h2>{title}</h2>}
          {actions && <div class="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export interface TextBoxProps {
  value: string;
  onInput?: (v: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  readOnly?: boolean;
  /** Monospace (default true). */
  mono?: boolean;
  /** Show "Open a file" and accept dropped files (default: true when editable). */
  files?: boolean;
  accept?: string;
  /** Called with the name of a file opened or dropped into the box. */
  onFileName?: (name: string) => void;
  /** File name for the Download button; no button when unset. */
  downloadName?: string;
  /** Extra buttons in the header. */
  actions?: ComponentChildren;
  /** Text shown under the box (e.g. an error). */
  note?: ComponentChildren;
  invalid?: boolean;
  wrap?: boolean;
  spellcheck?: boolean;
}

/** A labelled textarea with copy, clear, open-file (and drop), download. */
export function TextBox(p: TextBoxProps) {
  const editable = !p.readOnly && !!p.onInput;
  const files = p.files ?? editable;
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  async function load(list: File[]) {
    const f = list[0];
    if (!f || !p.onInput) return;
    p.onInput(await f.text());
    p.onFileName?.(f.name);
  }

  return (
    <div class={`textbox ${over ? "drop-over" : ""} ${p.invalid ? "invalid" : ""}`}>
      <div class="textbox-head">
        {p.label && <span class="textbox-label">{p.label}</span>}
        <div class="textbox-actions">
          {p.actions}
          {files && (
            <Button
              size="sm"
              variant="ghost"
              icon="upload"
              onClick={async () => load(await pickFiles(p.accept ?? ""))}
            >
              {tr(S.open)}
            </Button>
          )}
          {p.downloadName && p.value && (
            <Button
              size="sm"
              variant="ghost"
              icon="download"
              onClick={() => downloadText(p.value, p.downloadName ?? "output.txt")}
            >
              {tr(S.download)}
            </Button>
          )}
          {p.value && <CopyButton text={p.value} />}
          {editable && p.value && (
            <IconButton
              icon="close"
              label={tr(S.clear)}
              onClick={() => {
                p.onInput?.("");
                ref.current?.focus();
              }}
            />
          )}
        </div>
      </div>
      <textarea
        ref={ref}
        class={`input textarea ${p.mono === false ? "" : "mono"} ${p.wrap === false ? "nowrap" : ""}`}
        value={p.value}
        rows={p.rows ?? 10}
        placeholder={p.placeholder}
        readOnly={!editable}
        spellcheck={p.spellcheck ?? false}
        aria-label={p.label}
        aria-invalid={p.invalid}
        onInput={(e) => p.onInput?.((e.currentTarget as HTMLTextAreaElement).value)}
        onDragOver={
          files
            ? (e) => {
                e.preventDefault();
                setOver(true);
              }
            : undefined
        }
        onDragLeave={files ? () => setOver(false) : undefined}
        onDrop={
          files
            ? (e) => {
                e.preventDefault();
                setOver(false);
                load([...(e.dataTransfer?.files ?? [])]);
              }
            : undefined
        }
      />
      {p.note && <div class="textbox-note">{p.note}</div>}
    </div>
  );
}

/** A zone to drop or pick binary files. */
export function FileDrop({
  onFiles,
  accept,
  multiple,
  label,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <button
      type="button"
      class={`filedrop ${over ? "drop-over" : ""}`}
      onClick={async () => {
        const f = await pickFiles(accept ?? "", multiple);
        if (f.length) onFiles(f);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = [...(e.dataTransfer?.files ?? [])];
        if (f.length) onFiles(multiple ? f : f.slice(0, 1));
      }}
    >
      <Icon name="upload" size={22} />
      <span>{label ?? tr(S.dropHere)}</span>
    </button>
  );
}

/** A one-line read-only value with a copy button. */
export function Output({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div class="output">
      <span class="output-label">{label}</span>
      <code class={`output-value ${mono ? "mono" : ""}`}>{value || "—"}</code>
      {value && <CopyButton text={value} />}
    </div>
  );
}

export function Stats({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <dl class="stats">
      {items.map((it) => (
        <div class="stat" key={it.label}>
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <fieldset class="segmented">
      {label && <legend class="sr-only">{label}</legend>}
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          aria-pressed={o.value === value}
          class={o.value === value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label class="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)}
      />
      <span>{label}</span>
    </label>
  );
}

export function ErrorNote({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return (
    <p class="error-note" role="alert">
      {error}
    </p>
  );
}
