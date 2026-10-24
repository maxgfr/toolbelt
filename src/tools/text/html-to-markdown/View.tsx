import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { ErrorNote, errorText, Segmented, TextBox, Toggle } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { Group } from "../_ui";
import { DEFAULTS, type HtmlToMdOptions, htmlToMarkdown } from "./logic";

type Code = "backticks" | "tildes" | "indented";

const T = {
  input: l("HTML", "HTML", "HTML"),
  placeholder: l(
    "<h1>Title</h1>\n<p>Paste HTML here, or paste a copied web page in the box above.</p>",
    "<h1>Titre</h1>\n<p>Colle du HTML ici, ou colle une page web copiée dans la zone au-dessus.</p>",
    "<h1>Titel</h1>\n<p>Füge hier HTML ein oder füge oben eine kopierte Webseite ein.</p>",
  ),
  paste: l(
    "Paste rich text here (copied from a web page, a document or an email) to get its HTML",
    "Colle ici du texte mis en forme (copié d'une page web, d'un document ou d'un e-mail) pour récupérer son HTML",
    "Füge hier formatierten Text ein (aus einer Webseite, einem Dokument oder einer E-Mail kopiert), um sein HTML zu erhalten",
  ),
  output: l("Markdown", "Markdown", "Markdown"),
  headings: l("Headings", "Titres", "Überschriften"),
  setext: l("Underlined", "Soulignés", "Unterstrichen"),
  bullets: l("Bullets", "Puces", "Aufzählungszeichen"),
  code: l("Code blocks", "Blocs de code", "Codeblöcke"),
  indented: l("Indented", "Indentés", "Eingerückt"),
  emphasis: l("Emphasis", "Italique", "Betonung"),
  links: l("Links", "Liens", "Links"),
  inline: l("Inline", "En ligne", "Inline"),
  reference: l("References", "Références", "Referenzen"),
  gfm: l(
    "Tables, ~~strike~~ and task lists (GitHub)",
    "Tableaux, ~~barré~~ et cases (GitHub)",
    "Tabellen, ~~durchgestrichen~~ und Aufgabenlisten (GitHub)",
  ),
};

export default function HtmlToMarkdown() {
  const html = useToolState("html", "");
  const headingStyle = useToolState<HtmlToMdOptions["headingStyle"]>(
    "headingStyle",
    DEFAULTS.headingStyle,
  );
  const bullet = useToolState<HtmlToMdOptions["bullet"]>("bullet", DEFAULTS.bullet);
  const code = useToolState<Code>("code", "backticks");
  const em = useToolState<HtmlToMdOptions["emDelimiter"]>("em", DEFAULTS.emDelimiter);
  const linkStyle = useToolState<HtmlToMdOptions["linkStyle"]>("linkStyle", DEFAULTS.linkStyle);
  const gfm = useToolState("gfm", DEFAULTS.gfm);

  const result = useComputed(() => {
    try {
      return {
        md: htmlToMarkdown(html.value, {
          headingStyle: headingStyle.value,
          bullet: bullet.value,
          codeBlockStyle: code.value === "indented" ? "indented" : "fenced",
          fence: code.value === "tildes" ? "~~~" : "```",
          emDelimiter: em.value,
          linkStyle: linkStyle.value,
          gfm: gfm.value,
        }),
        error: null,
      };
    } catch (err) {
      return { md: "", error: errorText(err) };
    }
  });

  return (
    <>
      <div class="row tx-options">
        <Group label={tr(T.headings)}>
          <Segmented<HtmlToMdOptions["headingStyle"]>
            label={tr(T.headings)}
            value={headingStyle.value}
            onChange={(v) => {
              headingStyle.value = v;
            }}
            options={[
              { value: "atx", label: "# ATX" },
              { value: "setext", label: tr(T.setext) },
            ]}
          />
        </Group>
        <Group label={tr(T.bullets)}>
          <Segmented<HtmlToMdOptions["bullet"]>
            label={tr(T.bullets)}
            value={bullet.value}
            onChange={(v) => {
              bullet.value = v;
            }}
            options={[
              { value: "-", label: "-" },
              { value: "*", label: "*" },
              { value: "+", label: "+" },
            ]}
          />
        </Group>
        <Group label={tr(T.code)}>
          <Segmented<Code>
            label={tr(T.code)}
            value={code.value}
            onChange={(v) => {
              code.value = v;
            }}
            options={[
              { value: "backticks", label: "```" },
              { value: "tildes", label: "~~~" },
              { value: "indented", label: tr(T.indented) },
            ]}
          />
        </Group>
        <Group label={tr(T.emphasis)}>
          <Segmented<HtmlToMdOptions["emDelimiter"]>
            label={tr(T.emphasis)}
            value={em.value}
            onChange={(v) => {
              em.value = v;
            }}
            options={[
              { value: "_", label: "_a_" },
              { value: "*", label: "*a*" },
            ]}
          />
        </Group>
        <Group label={tr(T.links)}>
          <Segmented<HtmlToMdOptions["linkStyle"]>
            label={tr(T.links)}
            value={linkStyle.value}
            onChange={(v) => {
              linkStyle.value = v;
            }}
            options={[
              { value: "inlined", label: tr(T.inline) },
              { value: "referenced", label: tr(T.reference) },
            ]}
          />
        </Group>
        <Toggle
          checked={gfm.value}
          onChange={(v) => {
            gfm.value = v;
          }}
          label={tr(T.gfm)}
        />
      </div>
      <textarea
        class="input h2md-paste"
        rows={2}
        placeholder={tr(T.paste)}
        aria-label={tr(T.paste)}
        value=""
        onPaste={(e) => {
          e.preventDefault();
          const data = e.clipboardData;
          const rich = data?.getData("text/html");
          const plain = data?.getData("text/plain") ?? "";
          html.value =
            rich || plain.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>\n");
        }}
        onInput={(e) => {
          e.currentTarget.value = "";
        }}
      />
      <ErrorNote error={result.value.error} />
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={html.value}
          onInput={(v) => {
            html.value = v;
          }}
          placeholder={tr(T.placeholder)}
          accept=".html,.htm,text/html"
          rows={22}
        />
        <TextBox
          label={tr(T.output)}
          value={result.value.md}
          readOnly
          rows={22}
          downloadName="document.md"
        />
      </div>
    </>
  );
}
