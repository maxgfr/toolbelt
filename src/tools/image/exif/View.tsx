import { useComputed, useSignal } from "@preact/signals";
import { Badge } from "../../../app/kit";
import { useToolState } from "../../../app/state";
import {
  Button,
  CopyButton,
  downloadBlob,
  ErrorNote,
  FileDrop,
  Output,
  Panel,
  Stats,
  Toggle,
} from "../../../app/ui";
import { fmt, type L10n, l, tr } from "../../../i18n";
import { bytesBlob, decodeImage, drawScaled, encodeCanvas } from "../_dom";
import { attempt, formatSize, sniffImage, stem } from "../_shared";
import { errText, locale, UI, useObjectUrl, usePasteImage } from "../_ui";
import {
  decimalToDms,
  formatTag,
  type MetaBlock,
  orientationText,
  readMeta,
  stripMeta,
  summarize,
} from "./logic";

const T = {
  summary: l("Summary", "Résumé"),
  camera: l("Camera", "Appareil"),
  lens: l("Lens", "Objectif"),
  date: l("Taken on", "Prise le"),
  exposure: l("Exposure", "Exposition"),
  aperture: l("Aperture", "Ouverture"),
  iso: l("Sensitivity", "Sensibilité"),
  focal: l("Focal length", "Focale"),
  orientation: l("Orientation", "Orientation"),
  software: l("Software", "Logiciel"),
  artist: l("Author", "Auteur"),
  copyright: l("Copyright", "Copyright"),
  location: l("Location", "Localisation"),
  coords: l("Coordinates (decimal)", "Coordonnées (décimales)"),
  dms: l("Coordinates (DMS)", "Coordonnées (DMS)"),
  altitude: l("Altitude", "Altitude"),
  gpsWarn: l(
    "This photo reveals where it was taken.",
    "Cette photo révèle l'endroit où elle a été prise.",
  ),
  noMap: l(
    "No map is loaded (everything stays offline): paste the coordinates into your map app to see the place.",
    "Aucune carte n'est chargée (tout reste hors ligne) : colle les coordonnées dans ton appli de cartes pour voir le lieu.",
  ),
  blocks: l("Metadata blocks", "Blocs de métadonnées"),
  tags: l("All tags", "Toutes les balises"),
  group: l("Group", "Groupe"),
  tag: l("Tag", "Balise"),
  value: l("Value", "Valeur"),
  kind: l("Kind", "Type"),
  size: l("Size", "Taille"),
  show: l("Show content", "Voir le contenu"),
  none: l("No metadata found in this file.", "Aucune métadonnée trouvée dans ce fichier."),
  unsupported: l(
    "Only JPEG, PNG and WebP metadata can be read; this file can still be cleaned by re-encoding it.",
    "Seules les métadonnées JPEG, PNG et WebP sont lues ; ce fichier peut quand même être nettoyé en le réencodant.",
  ),
  remove: l("Remove metadata & download", "Supprimer les métadonnées et télécharger"),
  keepOrientation: l(
    "Keep the orientation (so the photo stays upright)",
    "Garder l'orientation (pour que la photo reste droite)",
  ),
  lossless: l(
    "Lossless: metadata blocks are cut out, the image data is not re-encoded.",
    "Sans perte : les blocs de métadonnées sont retirés, l'image n'est pas réencodée.",
  ),
  reencode: l(
    "This format is cleaned by re-encoding it as PNG (all metadata is dropped).",
    "Ce format est nettoyé en le réencodant en PNG (toutes les métadonnées disparaissent).",
  ),
  removed: l("Removed", "Retiré"),
  before: l("Before", "Avant"),
  after: l("After", "Après"),
  nothingRemoved: l("nothing to remove", "rien à retirer"),
  file: l("File", "Fichier"),
  format: l("Format", "Format"),
  metaBytes: l("Metadata", "Métadonnées"),
  preview: l("Image preview", "Aperçu de l'image"),
  empty: l(
    "Choose a photo to see its EXIF data (camera, date, settings, GPS) and remove it before sharing.",
    "Choisis une photo pour voir ses données EXIF (appareil, date, réglages, GPS) et les supprimer avant de la partager.",
  ),
};

const KIND: Record<MetaBlock["kind"], L10n> = {
  exif: l("EXIF", "EXIF"),
  xmp: l("XMP", "XMP"),
  iptc: l("IPTC", "IPTC"),
  icc: l("ICC", "ICC"),
  comment: l("Comment", "Commentaire"),
  text: l("Text", "Texte"),
  jfif: l("JFIF", "JFIF"),
  time: l("Date", "Date"),
  other: l("Other", "Autre"),
};

interface Loaded {
  name: string;
  file: File;
  bytes: Uint8Array;
}

export default function Exif() {
  const keepOrientation = useToolState("keepOrientation", true);
  const file = useSignal<Loaded | null>(null);
  const error = useSignal<string | null>(null);
  const cleaned = useSignal<{ size: number; removed: string[] } | null>(null);
  const busy = useSignal(false);

  async function load(f: File) {
    error.value = null;
    cleaned.value = null;
    file.value = { name: f.name, file: f, bytes: new Uint8Array(await f.arrayBuffer()) };
  }
  usePasteImage(load);

  const parsed = useComputed(() =>
    file.value ? attempt(() => readMeta(file.value?.bytes ?? new Uint8Array())) : null,
  );
  const f = file.value;
  const url = useObjectUrl(f?.file);
  const p = parsed.value;
  const meta = p?.ok ? p.value : null;
  const s = meta ? summarize(meta.tags) : null;
  const loc = locale();

  async function clean() {
    if (!f) return;
    busy.value = true;
    error.value = null;
    try {
      const lossless = stripMeta(f.bytes, keepOrientation.value);
      if (lossless) {
        const mime = sniffImage(f.bytes) || f.file.type;
        const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
        downloadBlob(bytesBlob(lossless.bytes, mime), `${stem(f.name)}-clean.${ext}`);
        cleaned.value = { size: lossless.bytes.length, removed: lossless.removed };
      } else {
        const img = await decodeImage(f.file, f.name);
        const canvas = drawScaled(img.source, img.width, img.height, img.width, img.height);
        img.close();
        const blob = await encodeCanvas(canvas, "png");
        downloadBlob(blob, `${stem(f.name)}-clean.png`);
        cleaned.value = { size: blob.size, removed: ["*"] };
      }
    } catch (err) {
      error.value = errText(err);
    } finally {
      busy.value = false;
    }
  }

  const rows: [string, string | undefined][] = s
    ? [
        [tr(T.camera), s.camera],
        [tr(T.lens), s.lens],
        [tr(T.date), s.date],
        [tr(T.exposure), s.exposure],
        [tr(T.aperture), s.aperture],
        [tr(T.iso), s.iso],
        [tr(T.focal), s.focal],
        [
          tr(T.orientation),
          s.orientation ? `${tr(orientationText(s.orientation))} (${s.orientation})` : undefined,
        ],
        [tr(T.software), s.software],
        [tr(T.artist), s.artist],
        [tr(T.copyright), s.copyright],
      ]
    : [];
  const shown = rows.filter((r): r is [string, string] => !!r[1]);
  const gps = s?.gps;
  const coords = gps ? `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}` : "";

  return (
    <div class="stack">
      <FileDrop
        accept="image/*"
        label={f ? `${f.name} · ${formatSize(f.bytes.length, loc)}` : tr(UI.drop)}
        onFiles={(x) => x[0] && load(x[0])}
      />
      <ErrorNote error={error.value} />
      {p && !p.ok && <ErrorNote error={tr(p.error)} />}
      {!f ? (
        <p class="muted">
          {tr(T.empty)} {tr(UI.local)}
        </p>
      ) : (
        meta && (
          <div class="exif-layout">
            <div class="stack">
              {url && (
                <figure class="image-preview">
                  <img src={url} alt={tr(T.preview)} />
                </figure>
              )}
              <Stats
                items={[
                  {
                    label: tr(T.format),
                    value:
                      meta.format === "other"
                        ? sniffImage(f.bytes) || "?"
                        : meta.format.toUpperCase(),
                  },
                  { label: tr(T.file), value: formatSize(f.bytes.length, loc) },
                  { label: tr(T.metaBytes), value: formatSize(meta.metaBytes, loc) },
                ]}
              />
              <Panel title={tr(T.remove)}>
                <div class="stack">
                  {meta.format === "jpeg" && (
                    <Toggle
                      checked={keepOrientation.value}
                      onChange={(v) => {
                        keepOrientation.value = v;
                      }}
                      label={tr(T.keepOrientation)}
                    />
                  )}
                  <p class="muted small">{tr(meta.format === "other" ? T.reencode : T.lossless)}</p>
                  <Button variant="primary" icon="download" disabled={busy.value} onClick={clean}>
                    {busy.value ? tr(UI.working) : tr(T.remove)}
                  </Button>
                  {cleaned.value && (
                    <Stats
                      items={[
                        { label: tr(T.before), value: formatSize(f.bytes.length, loc) },
                        { label: tr(T.after), value: formatSize(cleaned.value.size, loc) },
                        {
                          label: tr(T.removed),
                          value:
                            cleaned.value.removed[0] === "*"
                              ? "PNG"
                              : cleaned.value.removed.length
                                ? [...new Set(cleaned.value.removed)].join(", ")
                                : tr(T.nothingRemoved),
                        },
                      ]}
                    />
                  )}
                </div>
              </Panel>
            </div>

            <div class="stack">
              {meta.format === "other" && <p class="muted">{tr(T.unsupported)}</p>}
              {meta.format !== "other" && meta.blocks.length === 0 && meta.tags.length === 0 && (
                <p>
                  <Badge kind="ok">{tr(T.none)}</Badge>
                </p>
              )}
              {gps && (
                <Panel title={tr(T.location)}>
                  <div class="stack">
                    <p>
                      <Badge kind="warn">{tr(T.gpsWarn)}</Badge>
                    </p>
                    <Output label={tr(T.coords)} value={coords} />
                    <Output
                      label={tr(T.dms)}
                      value={`${decimalToDms(gps.lat, "lat")}, ${decimalToDms(gps.lon, "lon")}`}
                    />
                    {gps.alt != null && (
                      <Output
                        label={tr(T.altitude)}
                        value={`${fmt(gps.alt, { maximumFractionDigits: 1 })} m`}
                      />
                    )}
                    <p class="muted small">{tr(T.noMap)}</p>
                  </div>
                </Panel>
              )}
              {shown.length > 0 && (
                <Panel title={tr(T.summary)}>
                  <dl class="exif-summary">
                    {shown.map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Panel>
              )}
              {meta.blocks.length > 0 && (
                <Panel title={tr(T.blocks)}>
                  <div class="table-wrap">
                    <table class="table">
                      <thead>
                        <tr>
                          <th>{tr(T.kind)}</th>
                          <th>{tr(T.tag)}</th>
                          <th class="num">{tr(T.size)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meta.blocks.map((b, i) => (
                          <tr key={i}>
                            <td>
                              <Badge kind="info">{tr(KIND[b.kind])}</Badge>
                            </td>
                            <td>
                              <span class="mono small">{b.label}</span>
                              {b.text && (
                                <details class="exif-details">
                                  <summary class="small">{tr(T.show)}</summary>
                                  <div class="row">
                                    <CopyButton text={b.text} />
                                  </div>
                                  <pre class="exif-pre mono small">{b.text.slice(0, 20000)}</pre>
                                </details>
                              )}
                            </td>
                            <td class="num">{formatSize(b.size, loc)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}
              {meta.tags.length > 0 && (
                <Panel title={`${tr(T.tags)} (${meta.tags.length})`}>
                  <div class="table-wrap exif-tags">
                    <table class="table">
                      <thead>
                        <tr>
                          <th>{tr(T.group)}</th>
                          <th>{tr(T.tag)}</th>
                          <th>{tr(T.value)}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meta.tags.map((t, i) => (
                          <tr key={i}>
                            <td class="muted small">{t.ifd}</td>
                            <td class="mono small">{t.name}</td>
                            <td class="exif-value">{tr(formatTag(t))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
