/** Preact pieces shared by the image tools. */
import { type Signal, useSignal } from "@preact/signals";
import { useEffect, useMemo } from "preact/hooks";
import { Select } from "../../app/kit";
import { l, lang, tr } from "../../i18n";
import { canEncode } from "./_dom";
import { errorL10n, FORMATS, formatLabel, type OutFormat } from "./_shared";

export const UI = {
  format: l("Format", "Format"),
  quality: l("Quality", "Qualité"),
  unsupported: l("not supported by this browser", "non pris en charge par ce navigateur"),
  drop: l(
    "Drop an image here, click to choose, or paste one (⌘V / Ctrl+V)",
    "Dépose une image ici, clique pour choisir, ou colle-la (⌘V / Ctrl+V)",
  ),
  local: l(
    "Images are processed on your device and never uploaded.",
    "Les images sont traitées sur ton appareil et ne sont jamais envoyées.",
  ),
  working: l("Working…", "Traitement…"),
};

/** The error message of any thrown value, in the current language. */
export function errText(err: unknown): string {
  return tr(errorL10n(err));
}

export function locale(): string {
  return lang.value === "fr" ? "fr-FR" : "en-US";
}

/** An object URL for a blob, revoked when the blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

/** Calls `onImage` with an image pasted anywhere on the page (⌘V / Ctrl+V). */
export function usePasteImage(onImage: (f: File) => void): void {
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (!file) return;
      e.preventDefault();
      onImage(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);
}

/** Which output formats this browser can encode (JPEG and PNG are always there). */
export function useEncodable(): Signal<Record<OutFormat, boolean>> {
  const s = useSignal<Record<OutFormat, boolean>>({
    jpeg: true,
    png: true,
    webp: true,
    avif: false,
  });
  useEffect(() => {
    let live = true;
    Promise.all(FORMATS.map((f) => canEncode(f))).then((ok) => {
      if (!live) return;
      s.value = { jpeg: true, png: true, webp: ok[2] ?? false, avif: ok[3] ?? false };
    });
    return () => {
      live = false;
    };
  }, []);
  return s;
}

/** A format select that only offers what the browser can encode. */
export function FormatSelect({
  value,
  onChange,
  formats = FORMATS,
}: {
  value: OutFormat;
  onChange: (f: OutFormat) => void;
  formats?: OutFormat[];
}) {
  const ok = useEncodable().value;
  const available = formats.filter((f) => ok[f]);
  const missing = formats.filter((f) => !ok[f]);
  return (
    <Select<OutFormat>
      label={tr(UI.format)}
      value={ok[value] ? value : "png"}
      onChange={onChange}
      options={available.map((f) => ({ value: f, label: formatLabel(f) }))}
      {...(missing.length
        ? { hint: `${missing.map(formatLabel).join(", ")}: ${tr(UI.unsupported)}` }
        : {})}
    />
  );
}

/** A quality slider (1–100). */
export function QualitySlider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label class="field">
      <span class="field-label">
        {tr(UI.quality)} · {value}
      </span>
      <input
        type="range"
        min={1}
        max={100}
        value={value}
        disabled={disabled}
        onInput={(e) => onChange(Number((e.currentTarget as HTMLInputElement).value))}
      />
    </label>
  );
}
