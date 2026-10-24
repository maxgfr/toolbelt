import { useComputed, useSignal } from "@preact/signals";
import jsQR from "jsqr";
import { useEffect } from "preact/hooks";
import { useToolState } from "../../../app/state";
import {
  Button,
  downloadBlob,
  downloadText,
  ErrorNote,
  Field,
  FileDrop,
  Output,
  Segmented,
  Stats,
  TextBox,
  Toggle,
} from "../../../app/ui";
import { fmt, l, tr } from "../../../i18n";
import { attempt, utf8 } from "../_shared";
import { errMsg, NumberField, Select } from "../_ui";
import {
  type Contact,
  contrast,
  type Ecc,
  fitWithin,
  isInverted,
  type Matrix,
  matrixPath,
  normalizeUrl,
  type PayloadKind,
  parseWifi,
  payloadKind,
  pngLayout,
  qrMatrix,
  qrSvg,
  qrVersion,
  vcardPayload,
  type WifiSecurity,
  wifiPayload,
} from "./logic";

type Mode = "make" | "read";
type Preset = "text" | "url" | "wifi" | "vcard";

const T = {
  make: l("Generate", "Générer"),
  read: l("Read", "Lire"),
  content: l("Content", "Contenu"),
  text: l("Text", "Texte"),
  url: l("Link", "Lien"),
  wifi: l("Wi-Fi", "Wi-Fi"),
  vcard: l("Contact", "Contact"),
  textPh: l("Type the text to put in the code…", "Tape le texte à mettre dans le code…"),
  urlPh: l("example.com/page", "exemple.fr/page"),
  urlHint: l("https:// is added to a bare domain.", "https:// est ajouté devant un domaine seul."),
  ssid: l("Network name (SSID)", "Nom du réseau (SSID)"),
  password: l("Password", "Mot de passe"),
  passwordHint: l("Not saved in this browser.", "Pas enregistré dans ce navigateur."),
  security: l("Security", "Sécurité"),
  none: l("None (open)", "Aucune (ouvert)"),
  hidden: l("Hidden network", "Réseau masqué"),
  first: l("First name", "Prénom"),
  last: l("Last name", "Nom"),
  org: l("Organization", "Organisation"),
  title: l("Job title", "Fonction"),
  phone: l("Phone", "Téléphone"),
  email: l("Email", "E-mail"),
  website: l("Website", "Site web"),
  address: l("Address", "Adresse"),
  note: l("Note", "Note"),
  ecc: l("Error correction", "Correction d'erreur"),
  eccL: l("L — 7 %", "L — 7 %"),
  eccM: l("M — 15 %", "M — 15 %"),
  eccQ: l("Q — 25 %", "Q — 25 %"),
  eccH: l("H — 30 %", "H — 30 %"),
  eccHint: l(
    "Higher levels survive damage or a logo, but make a denser code.",
    "Plus haut résiste mieux aux dégâts ou à un logo, mais densifie le code.",
  ),
  size: l("PNG size (px)", "Taille PNG (px)"),
  margin: l("Quiet zone (modules)", "Marge (modules)"),
  fg: l("Foreground", "Premier plan"),
  bg: l("Background", "Arrière-plan"),
  transparent: l("Transparent background", "Fond transparent"),
  png: l("Download PNG", "Télécharger le PNG"),
  svg: l("Download SVG", "Télécharger le SVG"),
  payload: l("Encoded text", "Texte encodé"),
  version: l("Version", "Version"),
  modules: l("Modules", "Modules"),
  bytes: l("Bytes", "Octets"),
  empty: l("Fill in the content to see the QR code.", "Remplis le contenu pour voir le QR code."),
  lowContrast: l(
    "Low contrast: some scanners may not read this code.",
    "Contraste faible : certains lecteurs n'arriveront pas à lire ce code.",
  ),
  inverted: l(
    "Light modules on a dark background: many scanners only read dark-on-light codes.",
    "Modules clairs sur fond sombre : beaucoup de lecteurs ne lisent que du sombre sur clair.",
  ),
  preview: l("QR code preview", "Aperçu du QR code"),
  drop: l(
    "Drop an image with a QR code, click to choose, or paste one (⌘V / Ctrl+V)",
    "Dépose une image avec un QR code, clique pour choisir, ou colle-la (⌘V / Ctrl+V)",
  ),
  decoding: l("Reading…", "Lecture…"),
  notFound: l(
    "No QR code found in this image. Try a sharper or tighter crop.",
    "Aucun QR code trouvé dans cette image. Essaie une image plus nette ou mieux cadrée.",
  ),
  badImage: l(
    "This file is not an image the browser can open.",
    "Ce fichier n'est pas une image lisible par le navigateur.",
  ),
  decoded: l("Decoded text", "Texte décodé"),
  kind: l("Type", "Type"),
  open: l("Open the link", "Ouvrir le lien"),
  edit: l("Edit in the generator", "Modifier dans le générateur"),
  source: l("Scanned image", "Image analysée"),
  kinds: {
    url: l("Link", "Lien"),
    wifi: l("Wi-Fi network", "Réseau Wi-Fi"),
    vcard: l("Contact (vCard)", "Contact (vCard)"),
    email: l("Email address", "Adresse e-mail"),
    phone: l("Phone number", "Numéro de téléphone"),
    otp: l("2FA secret (otpauth)", "Secret 2FA (otpauth)"),
    text: l("Text", "Texte"),
  } satisfies Record<PayloadKind, unknown>,
};

const EMPTY_CONTACT: Contact = {
  first: "",
  last: "",
  org: "",
  title: "",
  phone: "",
  email: "",
  url: "",
  address: "",
  note: "",
};

/** The QR code as an inline SVG element (crisp at any zoom). */
function QrPreview({ m, fg, bg, margin }: { m: Matrix; fg: string; bg: string; margin: number }) {
  const view = m.length + margin * 2;
  return (
    <svg
      class="qr-svg"
      viewBox={`0 0 ${view} ${view}`}
      shape-rendering="crispEdges"
      role="img"
      aria-label={tr(T.preview)}
    >
      {bg && <rect width={view} height={view} fill={bg} />}
      <path fill={fg} d={matrixPath(m, margin)} />
    </svg>
  );
}

async function downloadPng(m: Matrix, fg: string, bg: string, margin: number, size: number) {
  const { cell, side } = pngLayout(m, margin, size);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = side;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, side, side);
  }
  ctx.fillStyle = fg;
  for (const [y, row] of m.entries())
    for (const [x, dark] of row.entries())
      if (dark) ctx.fillRect((x + margin) * cell, (y + margin) * cell, cell, cell);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (blob) downloadBlob(blob, "qr-code.png");
}

/** Decodes the first QR code of an image (downscaled to 1600 px, colors tried both ways). */
async function decodeImage(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const { w, h } = fitWithin(bitmap.width, bitmap.height, 1600);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const img = ctx.getImageData(0, 0, w, h);
  return jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

function useGeneratorState() {
  return {
    preset: useToolState<Preset>("preset", "url"),
    text: useToolState("text", ""),
    url: useToolState("url", ""),
    ssid: useToolState("ssid", ""),
    // The Wi-Fi password is a secret: not stored, not in share links.
    wifiPass: useToolState("wifiPass", "", { persist: false, share: false }),
    security: useToolState<WifiSecurity>("security", "WPA"),
    hidden: useToolState("hidden", false),
    contact: useToolState<Contact>("contact", EMPTY_CONTACT),
    ecc: useToolState<Ecc>("ecc", "M"),
    size: useToolState("size", 512),
    margin: useToolState("margin", 4),
    fg: useToolState("fg", "#000000"),
    bg: useToolState("bg", "#ffffff"),
    transparent: useToolState("transparent", false),
  };
}

function Generator({ s }: { s: ReturnType<typeof useGeneratorState> }) {
  const {
    preset,
    text,
    url,
    ssid,
    wifiPass,
    security,
    hidden,
    contact,
    ecc,
    size,
    margin,
    fg,
    bg,
    transparent,
  } = s;

  const payload = useComputed(() => {
    switch (preset.value) {
      case "text":
        return text.value;
      case "url":
        return normalizeUrl(url.value);
      case "wifi":
        return ssid.value
          ? wifiPayload({
              ssid: ssid.value,
              password: wifiPass.value,
              security: security.value,
              hidden: hidden.value,
            })
          : "";
      case "vcard":
        return Object.values(contact.value).some((v) => v.trim())
          ? vcardPayload(contact.value)
          : "";
    }
  });
  const result = useComputed(() =>
    payload.value ? attempt(() => qrMatrix(payload.value, ecc.value)) : null,
  );

  const r = result.value;
  const background = transparent.value ? "" : bg.value;
  const ratio = contrast(fg.value, bg.value);
  const warn = transparent.value
    ? null
    : isInverted(fg.value, bg.value)
      ? tr(T.inverted)
      : ratio < 3
        ? tr(T.lowContrast)
        : null;

  const setContact = (k: keyof Contact) => (e: Event) => {
    contact.value = { ...contact.value, [k]: (e.currentTarget as HTMLInputElement).value };
  };
  const contactField = (k: keyof Contact, label: string, type = "text") => (
    <Field label={label}>
      <input class="input" type={type} value={contact.value[k]} onInput={setContact(k)} />
    </Field>
  );

  return (
    <div class="qr-layout">
      <div class="stack">
        <Segmented<Preset>
          label={tr(T.content)}
          value={preset.value}
          onChange={(v) => {
            preset.value = v;
          }}
          options={[
            { value: "url", label: tr(T.url) },
            { value: "text", label: tr(T.text) },
            { value: "wifi", label: tr(T.wifi) },
            { value: "vcard", label: tr(T.vcard) },
          ]}
        />

        {preset.value === "text" && (
          <TextBox
            label={tr(T.text)}
            value={text.value}
            onInput={(v) => {
              text.value = v;
            }}
            placeholder={tr(T.textPh)}
            rows={6}
            mono={false}
          />
        )}
        {preset.value === "url" && (
          <Field label={tr(T.url)} hint={tr(T.urlHint)}>
            <input
              class="input mono"
              type="url"
              value={url.value}
              placeholder={tr(T.urlPh)}
              onInput={(e) => {
                url.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
        )}
        {preset.value === "wifi" && (
          <div class="grid-2">
            <Field label={tr(T.ssid)}>
              <input
                class="input"
                value={ssid.value}
                onInput={(e) => {
                  ssid.value = (e.currentTarget as HTMLInputElement).value;
                }}
              />
            </Field>
            <Select<WifiSecurity>
              label={tr(T.security)}
              value={security.value}
              onChange={(v) => {
                security.value = v;
              }}
              options={[
                { value: "WPA", label: "WPA / WPA2 / WPA3" },
                { value: "WEP", label: "WEP" },
                { value: "nopass", label: tr(T.none) },
              ]}
            />
            {security.value !== "nopass" && (
              <Field label={tr(T.password)} hint={tr(T.passwordHint)}>
                <input
                  class="input"
                  type="text"
                  autoComplete="off"
                  value={wifiPass.value}
                  onInput={(e) => {
                    wifiPass.value = (e.currentTarget as HTMLInputElement).value;
                  }}
                />
              </Field>
            )}
            <div class="qr-toggle-cell">
              <Toggle
                checked={hidden.value}
                onChange={(v) => {
                  hidden.value = v;
                }}
                label={tr(T.hidden)}
              />
            </div>
          </div>
        )}
        {preset.value === "vcard" && (
          <div class="grid-2">
            {contactField("first", tr(T.first))}
            {contactField("last", tr(T.last))}
            {contactField("org", tr(T.org))}
            {contactField("title", tr(T.title))}
            {contactField("phone", tr(T.phone), "tel")}
            {contactField("email", tr(T.email), "email")}
            {contactField("url", tr(T.website), "url")}
            {contactField("address", tr(T.address))}
            {contactField("note", tr(T.note))}
          </div>
        )}

        <div class="grid-3">
          <Select<Ecc>
            label={tr(T.ecc)}
            value={ecc.value}
            onChange={(v) => {
              ecc.value = v;
            }}
            options={[
              { value: "L", label: tr(T.eccL) },
              { value: "M", label: tr(T.eccM) },
              { value: "Q", label: tr(T.eccQ) },
              { value: "H", label: tr(T.eccH) },
            ]}
            hint={tr(T.eccHint)}
          />
          <NumberField
            label={tr(T.size)}
            value={size.value}
            min={64}
            max={4096}
            step={64}
            onChange={(v) => {
              size.value = v;
            }}
          />
          <NumberField
            label={tr(T.margin)}
            value={margin.value}
            min={0}
            max={16}
            onChange={(v) => {
              margin.value = v;
            }}
          />
        </div>
        <div class="row">
          <Field label={tr(T.fg)} class="qr-color">
            <input
              type="color"
              value={fg.value}
              onInput={(e) => {
                fg.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
          <Field label={tr(T.bg)} class="qr-color">
            <input
              type="color"
              value={bg.value}
              disabled={transparent.value}
              onInput={(e) => {
                bg.value = (e.currentTarget as HTMLInputElement).value;
              }}
            />
          </Field>
          <Toggle
            checked={transparent.value}
            onChange={(v) => {
              transparent.value = v;
            }}
            label={tr(T.transparent)}
          />
        </div>
      </div>

      <div class="stack qr-side">
        {!r ? (
          <div class="qr-placeholder muted">{tr(T.empty)}</div>
        ) : !r.ok ? (
          <ErrorNote error={tr(r.error)} />
        ) : (
          <>
            <div class={`qr-frame ${transparent.value ? "qr-checker" : ""}`}>
              <QrPreview m={r.value} fg={fg.value} bg={background} margin={margin.value} />
            </div>
            {warn && <p class="qr-warn small">{warn}</p>}
            <div class="row">
              <Button
                variant="primary"
                size="sm"
                icon="download"
                onClick={() => downloadPng(r.value, fg.value, background, margin.value, size.value)}
              >
                {tr(T.png)}
              </Button>
              <Button
                size="sm"
                icon="download"
                onClick={() =>
                  downloadText(
                    qrSvg(r.value, {
                      fg: fg.value,
                      bg: background,
                      margin: margin.value,
                      size: size.value,
                    }),
                    "qr-code.svg",
                    "image/svg+xml",
                  )
                }
              >
                {tr(T.svg)}
              </Button>
            </div>
            <Stats
              items={[
                { label: tr(T.version), value: qrVersion(r.value) },
                { label: tr(T.modules), value: `${r.value.length}²` },
                { label: tr(T.bytes), value: fmt(utf8(payload.value).length) },
              ]}
            />
            {preset.value !== "text" && (
              <TextBox label={tr(T.payload)} value={payload.value} readOnly rows={4} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Reader({ onEdit }: { onEdit: (text: string) => void }) {
  const image = useSignal<string | null>(null);
  const decoded = useSignal<string | null>(null);
  const error = useSignal<string | null>(null);
  const busy = useSignal(false);

  async function read(file: Blob) {
    busy.value = true;
    error.value = null;
    decoded.value = null;
    if (image.value) URL.revokeObjectURL(image.value);
    image.value = URL.createObjectURL(file);
    try {
      const text = await decodeImage(file);
      if (text == null) error.value = tr(T.notFound);
      else decoded.value = text;
    } catch (err) {
      error.value = err instanceof DOMException ? tr(T.badImage) : errMsg(err);
    } finally {
      busy.value = false;
    }
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (!file) return;
      e.preventDefault();
      read(file);
    };
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("paste", onPaste);
      if (image.value) URL.revokeObjectURL(image.value);
    };
  }, []);

  const text = decoded.value;
  const kind = text != null ? payloadKind(text) : null;
  const wifi = kind === "wifi" && text ? parseWifi(text) : null;

  return (
    <div class="grid-2">
      <div class="stack">
        <FileDrop
          accept="image/*"
          label={tr(T.drop)}
          onFiles={(f) => {
            if (f[0]) read(f[0]);
          }}
        />
        {image.value && (
          <figure class="qr-source">
            <img src={image.value} alt={tr(T.source)} />
          </figure>
        )}
      </div>
      <div class="stack">
        {busy.value && <p class="muted">{tr(T.decoding)}</p>}
        <ErrorNote error={error.value} />
        {text != null && kind && (
          <>
            <Output label={tr(T.kind)} value={tr(T.kinds[kind])} mono={false} />
            {wifi && (
              <>
                <Output label={tr(T.ssid)} value={wifi.ssid} />
                {wifi.password && <Output label={tr(T.password)} value={wifi.password} />}
                <Output label={tr(T.security)} value={wifi.security} />
              </>
            )}
            <TextBox label={tr(T.decoded)} value={text} readOnly rows={6} />
            <div class="row">
              {kind === "url" && (
                <a
                  class="btn btn-secondary btn-sm"
                  href={text}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {tr(T.open)}
                </a>
              )}
              <Button size="sm" icon="swap" onClick={() => onEdit(text)}>
                {tr(T.edit)}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Qr() {
  const mode = useToolState<Mode>("mode", "make");
  const s = useGeneratorState();
  return (
    <>
      <Segmented<Mode>
        value={mode.value}
        onChange={(v) => {
          mode.value = v;
        }}
        options={[
          { value: "make", label: tr(T.make) },
          { value: "read", label: tr(T.read) },
        ]}
      />
      {mode.value === "make" ? (
        <Generator s={s} />
      ) : (
        <Reader
          onEdit={(t) => {
            if (payloadKind(t) === "url") {
              s.preset.value = "url";
              s.url.value = t;
            } else {
              s.preset.value = "text";
              s.text.value = t;
            }
            mode.value = "make";
          }}
        />
      )}
    </>
  );
}
