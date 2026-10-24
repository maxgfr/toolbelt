import { useComputed, useSignal, useSignalEffect } from "@preact/signals";
import { useRef } from "preact/hooks";
import { Badge, NumberField } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import { Button, downloadBlob, ErrorNote, Field, FileDrop, Stats } from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { bytesBlob, decodeImage, drawScaled, encodeCanvas } from "../_dom";
import {
  formatSize,
  hasQuality,
  isOpaque,
  mimeOf,
  type OutFormat,
  sizeChange,
  zipStore,
} from "../_shared";
import {
  errText,
  FormatSelect,
  locale,
  QualitySlider,
  UI,
  useEncodable,
  useObjectUrl,
  usePasteImage,
} from "../_ui";
import { batchNames, encoderQuality, outputSize, totals } from "./logic";

const T = {
  drop: l(
    "Drop images here, click to choose several, or paste one (⌘V / Ctrl+V)",
    "Dépose des images ici, clique pour en choisir plusieurs, ou colle-en une (⌘V / Ctrl+V)",
    "Zieh Bilder hierher, klicke, um mehrere auszuwählen, oder füge eines ein (⌘V / Strg+V)",
  ),
  maxW: l("Max width", "Largeur max", "Max. Breite"),
  maxH: l("Max height", "Hauteur max", "Max. Höhe"),
  noLimit: l(
    "0 = no limit; the aspect ratio is kept.",
    "0 = sans limite ; les proportions sont gardées.",
    "0 = keine Begrenzung; das Seitenverhältnis bleibt erhalten.",
  ),
  background: l(
    "Background (for transparency)",
    "Fond (pour la transparence)",
    "Hintergrund (für Transparenz)",
  ),
  file: l("File", "Fichier", "Datei"),
  dims: l("Dimensions", "Dimensions", "Abmessungen"),
  before: l("Before", "Avant", "Vorher"),
  after: l("After", "Après", "Nachher"),
  change: l("Change", "Écart", "Änderung"),
  download: l("Download", "Télécharger", "Herunterladen"),
  downloadAll: l("Download all (ZIP)", "Tout télécharger (ZIP)", "Alle herunterladen (ZIP)"),
  clear: l("Clear the list", "Vider la liste", "Liste leeren"),
  remove: l("Remove", "Retirer", "Entfernen"),
  waiting: l("Waiting", "En attente", "Wartet"),
  files: l("Files", "Fichiers", "Dateien"),
  total: l("Total", "Total", "Gesamt"),
  empty: l(
    "Add one or more images (JPEG, PNG, WebP, GIF, AVIF, SVG…). The photo orientation is kept.",
    "Ajoute une ou plusieurs images (JPEG, PNG, WebP, GIF, AVIF, SVG…). L'orientation des photos est conservée.",
    "Füge ein oder mehrere Bilder hinzu (JPEG, PNG, WebP, GIF, AVIF, SVG…). Die Ausrichtung der Fotos bleibt erhalten.",
  ),
  bigger: l(
    "Larger than the original: try another format or a lower quality.",
    "Plus lourd que l'original : essaie un autre format ou une qualité plus basse.",
    "Größer als das Original: Probier ein anderes Format oder eine niedrigere Qualität.",
  ),
  preview: l("Converted image", "Image convertie", "Konvertiertes Bild"),
};

interface Item {
  id: number;
  file: File;
  busy: boolean;
  out: Blob | null;
  name: string;
  w: number;
  h: number;
  ow: number;
  oh: number;
  error: string | null;
}

let nextId = 1;

function pct(change: number): string {
  return fmt(change, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });
}

function Row({ it, onRemove }: { it: Item; onRemove: () => void }) {
  const url = useObjectUrl(it.out);
  const loc = locale();
  const change = it.out ? sizeChange(it.file.size, it.out.size) : 0;
  return (
    <tr>
      <td>
        <div class="image-convert-name">
          {url ? (
            <img class="image-convert-thumb" src={url} alt={tr(T.preview)} />
          ) : (
            <span class="image-convert-thumb" />
          )}
          <span class="mono small">{it.file.name}</span>
        </div>
      </td>
      <td class="num small">
        {it.w ? `${it.w}×${it.h}` : "—"}
        {it.out && (it.ow !== it.w || it.oh !== it.h) ? ` → ${it.ow}×${it.oh}` : ""}
      </td>
      <td class="num">{formatSize(it.file.size, loc)}</td>
      <td class="num">
        {it.error ? (
          <Badge kind="bad">{it.error}</Badge>
        ) : it.out ? (
          formatSize(it.out.size, loc)
        ) : (
          <span class="muted">{tr(it.busy ? UI.working : T.waiting)}</span>
        )}
      </td>
      <td class="num">
        {it.out && (
          <span title={change > 0 ? tr(T.bigger) : undefined}>
            <Badge kind={change > 0 ? "warn" : "ok"}>{pct(change)}</Badge>
          </span>
        )}
      </td>
      <td>
        <div class="row image-convert-actions">
          <Button
            size="sm"
            variant="ghost"
            icon="download"
            disabled={!it.out}
            onClick={() => it.out && downloadBlob(it.out, it.name)}
          >
            {tr(T.download)}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon="close"
            aria-label={tr(T.remove)}
            onClick={onRemove}
          />
        </div>
      </td>
    </tr>
  );
}

export default function ImageConvert() {
  const format = useToolState<OutFormat>("format", "webp");
  const quality = useToolState("quality", 80);
  const maxW = useToolState("maxW", 0);
  const maxH = useToolState("maxH", 0);
  const bg = useToolState("bg", "#ffffff");
  const items = useSignal<Item[]>([]);
  const ok = useEncodable();
  const run = useRef(0);
  // Only changes when files are added or removed (not when a conversion result comes in).
  const fileKey = useComputed(() => items.value.map((x) => x.id).join(","));

  // The effective format: AVIF/WebP fall back to PNG where the browser cannot encode them.
  const fmtOut: OutFormat = ok.value[format.value] ? format.value : "png";

  function add(files: File[]) {
    const fresh = files.map<Item>((file) => ({
      id: nextId++,
      file,
      busy: false,
      out: null,
      name: file.name,
      w: 0,
      h: 0,
      ow: 0,
      oh: 0,
      error: null,
    }));
    items.value = [...items.value, ...fresh];
  }
  usePasteImage((f) => add([f]));

  function patch(id: number, p: Partial<Item>) {
    items.value = items.value.map((x) => (x.id === id ? { ...x, ...p } : x));
  }

  // Re-converts the batch whenever the files or the settings change (debounced, latest wins).
  useSignalEffect(() => {
    const opts = {
      format: ok.value[format.value] ? format.value : ("png" as OutFormat),
      quality: quality.value,
      maxW: maxW.value,
      maxH: maxH.value,
      bg: bg.value,
    };
    const ids = fileKey.value;
    const id = ++run.current;
    if (!ids) return;
    const timer = setTimeout(async () => {
      const list = items.peek();
      const names = batchNames(
        list.map((x) => x.file.name),
        opts.format,
      );
      for (const [i, it] of list.entries()) {
        if (id !== run.current) return;
        patch(it.id, { busy: true, error: null, name: names[i] ?? it.name });
        try {
          const img = await decodeImage(it.file, it.file.name);
          const size = outputSize(img.width, img.height, opts);
          const canvas = drawScaled(
            img.source,
            img.width,
            img.height,
            size.w,
            size.h,
            isOpaque(opts.format) ? opts.bg : undefined,
          );
          img.close();
          const out = await encodeCanvas(canvas, opts.format, encoderQuality(opts.quality));
          canvas.width = canvas.height = 0;
          if (id !== run.current) return;
          patch(it.id, { busy: false, out, w: img.width, h: img.height, ow: size.w, oh: size.h });
        } catch (err) {
          if (id !== run.current) return;
          patch(it.id, { busy: false, out: null, error: errText(err) });
        }
      }
    }, 250);
    return () => clearTimeout(timer);
  });

  async function downloadZip() {
    const done = items.value.filter((x) => x.out);
    const entries = await Promise.all(
      done.map(async (x) => ({
        name: x.name,
        data: new Uint8Array(await (x.out as Blob).arrayBuffer()),
      })),
    );
    downloadBlob(bytesBlob(zipStore(entries), "application/zip"), "images.zip");
  }

  const list = items.value;
  const t = totals(list.map((x) => ({ before: x.file.size, after: x.out ? x.out.size : null })));
  const loc = locale();
  const errors = list.filter((x) => x.error).length;

  return (
    <div class="stack">
      <div class="grid-3">
        <FormatSelect
          value={format.value}
          onChange={(v) => {
            format.value = v;
          }}
        />
        <QualitySlider
          value={quality.value}
          disabled={!hasQuality(fmtOut)}
          onChange={(v) => {
            quality.value = v;
          }}
        />
        {isOpaque(fmtOut) ? (
          <Field label={tr(T.background)} class="image-color-field">
            <input
              type="color"
              value={bg.value}
              onInput={(e) => {
                bg.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
        ) : (
          <span />
        )}
        <NumberField
          label={tr(T.maxW)}
          value={maxW.value}
          min={0}
          max={20000}
          integer
          suffix="px"
          onChange={(v) => {
            maxW.value = v;
          }}
        />
        <NumberField
          label={tr(T.maxH)}
          value={maxH.value}
          min={0}
          max={20000}
          integer
          suffix="px"
          hint={tr(T.noLimit)}
          onChange={(v) => {
            maxH.value = v;
          }}
        />
      </div>

      <FileDrop accept="image/*,.svg" multiple label={tr(T.drop)} onFiles={add} />

      {list.length === 0 ? (
        <p class="muted">
          {tr(T.empty)} {tr(UI.local)}
        </p>
      ) : (
        <>
          <Stats
            items={[
              { label: tr(T.files), value: `${fmt(t.count)} / ${fmt(list.length)}` },
              { label: tr(T.before), value: formatSize(t.before, loc) },
              { label: tr(T.after), value: formatSize(t.after, loc) },
              { label: tr(T.change), value: t.count ? pct(t.change) : "—" },
            ]}
          />
          {errors > 0 && <ErrorNote error={list.find((x) => x.error)?.error} />}
          <div class="row">
            <Button
              variant="primary"
              icon="download"
              disabled={t.count === 0}
              onClick={downloadZip}
            >
              {tr(T.downloadAll)}
            </Button>
            <Button
              variant="ghost"
              icon="trash"
              onClick={() => {
                items.value = [];
              }}
            >
              {tr(T.clear)}
            </Button>
            <span class="spacer" />
            <span class="muted small">{mimeOf(fmtOut)}</span>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{tr(T.file)}</th>
                  <th class="num">{tr(T.dims)}</th>
                  <th class="num">{tr(T.before)}</th>
                  <th class="num">{tr(T.after)}</th>
                  <th class="num">{tr(T.change)}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((it) => (
                  <Row
                    key={it.id}
                    it={it}
                    onRemove={() => {
                      items.value = items.value.filter((x) => x.id !== it.id);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
