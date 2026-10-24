import { useComputed } from "@preact/signals";
import { useToolState } from "../../../app/state";
import { Field, TextBox, Toggle } from "../../../app/ui";
import { l, tr } from "../../../i18n";
import { componentName, htmlToJsx, type Warning } from "./logic";

const T = {
  input: l("HTML or SVG", "HTML ou SVG"),
  placeholder: l(
    'Paste HTML or an SVG, e.g. <label for="email" class="label">Email</label>',
    'Colle du HTML ou un SVG, par ex. <label for="email" class="label">E-mail</label>',
  ),
  output: l("JSX", "JSX"),
  component: l("Wrap in a component", "Envelopper dans un composant"),
  name: l("Component name", "Nom du composant"),
  typescript: l("TypeScript props", "Props TypeScript"),
  native: l("React Native (react-native-svg)", "React Native (react-native-svg)"),
  hint: l(
    "class → className, for → htmlFor, style strings → objects, SVG attributes in camelCase, comments → {/* */}.",
    "class → className, for → htmlFor, styles en objets, attributs SVG en camelCase, commentaires → {/* */}.",
  ),
  w: {
    event: l(
      'Inline event handlers (onclick="…") became arrow functions: check that the code they run exists in your component.',
      'Les gestionnaires d\'événements en ligne (onclick="…") sont devenus des fonctions fléchées : vérifie que le code appelé existe dans ton composant.',
    ),
    important: l(
      "!important was dropped: React inline styles do not support it.",
      "!important a été retiré : les styles en ligne de React ne le gèrent pas.",
    ),
    script: l(
      "<script> tags rendered by React do not run; load scripts another way.",
      "Les balises <script> rendues par React ne s'exécutent pas ; charge les scripts autrement.",
    ),
    rnClass: l(
      "react-native-svg has no class names: className was dropped.",
      "react-native-svg n'a pas de classes : className a été retiré.",
    ),
  } satisfies Record<Warning, unknown>,
};

export default function HtmlToJsx() {
  const input = useToolState("input", "");
  const component = useToolState("component", false);
  const name = useToolState("name", "");
  const typescript = useToolState("typescript", false);
  const native = useToolState("native", false);

  const result = useComputed(() =>
    htmlToJsx(input.value, {
      component: component.value,
      name: name.value,
      native: native.value,
      typescript: typescript.value,
    }),
  );
  const r = result.value;
  const ext = typescript.value ? "tsx" : "jsx";

  return (
    <>
      <div class="row html-to-jsx-options">
        <Toggle
          checked={component.value}
          onChange={(v) => {
            component.value = v;
          }}
          label={tr(T.component)}
        />
        {component.value && (
          <>
            <Field label={tr(T.name)}>
              <input
                class="input mono html-to-jsx-name"
                value={name.value}
                placeholder={componentName("", r.svg)}
                spellcheck={false}
                onInput={(e) => {
                  name.value = (e.currentTarget as HTMLInputElement).value;
                }}
              />
            </Field>
            <Toggle
              checked={typescript.value}
              onChange={(v) => {
                typescript.value = v;
              }}
              label={tr(T.typescript)}
            />
          </>
        )}
        <Toggle
          checked={native.value}
          onChange={(v) => {
            native.value = v;
          }}
          label={tr(T.native)}
        />
      </div>
      <div class="grid-2">
        <TextBox
          label={tr(T.input)}
          value={input.value}
          onInput={(v) => {
            input.value = v;
          }}
          placeholder={tr(T.placeholder)}
          accept=".html,.htm,.svg,text/html,image/svg+xml,text/plain"
          rows={22}
          wrap={false}
        />
        <TextBox
          label={tr(T.output)}
          value={r.code}
          readOnly
          rows={22}
          wrap={false}
          downloadName={`${component.value ? componentName(name.value, r.svg) : "markup"}.${ext}`}
          note={<span class="muted">{tr(T.hint)}</span>}
        />
      </div>
      {r.warnings.length > 0 && (
        <ul class="html-to-jsx-warnings">
          {r.warnings.map((w) => (
            <li key={w} class="data-warn">
              {tr(T.w[w])}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
