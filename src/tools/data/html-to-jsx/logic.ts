/**
 * HTML or SVG → JSX. A forgiving HTML parser (void tags, unquoted and bare attributes, raw text
 * in <script>/<style>, a few implied end tags), then a JSX writer: className, htmlFor, camelCase
 * React and SVG attribute names, style strings as objects, comments as {/* *\/}, self-closing
 * empty elements, optional wrapping in a component, and a react-native-svg flavor.
 */

export type HNode =
  | { t: "el"; name: string; attrs: HAttr[]; children: HNode[] }
  | { t: "text"; v: string }
  | { t: "comment"; v: string };

export interface HAttr {
  name: string;
  /** null for a bare attribute (`disabled`). */
  value: string | null;
}

const VOID = new Set(
  "area base br col embed hr img input link meta param source track wbr".split(" "),
);
const RAW = new Set(["script", "style", "textarea", "title"]);
/** Opening one of these closes an open sibling of the listed names. */
const IMPLIED: Record<string, string[]> = {
  li: ["li"],
  option: ["option"],
  dt: ["dt", "dd"],
  dd: ["dt", "dd"],
  tr: ["tr", "td", "th"],
  td: ["td", "th"],
  th: ["td", "th"],
  p: ["p"],
};

const TAG_NAME = /^[A-Za-z][\w:.-]*/;
const ATTR = /^([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/;

/** Parses HTML or SVG; never throws (stray end tags are dropped, open ones closed at the end). */
export function parseHtml(src: string): HNode[] {
  const root: HNode & { t: "el" } = { t: "el", name: "#root", attrs: [], children: [] };
  const stack: (HNode & { t: "el" })[] = [root];
  const s = src.replace(/^\uFEFF/, "");
  let i = 0;
  const top = () => stack[stack.length - 1] ?? root;
  const text = (v: string) => {
    if (!v) return;
    const kids = top().children;
    const last = kids[kids.length - 1];
    if (last?.t === "text") last.v += v;
    else kids.push({ t: "text", v });
  };
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    if (lt < 0) {
      text(s.slice(i));
      break;
    }
    text(s.slice(i, lt));
    i = lt;
    if (s.startsWith("<!--", i)) {
      const end = s.indexOf("-->", i + 4);
      const stop = end < 0 ? s.length : end;
      top().children.push({ t: "comment", v: s.slice(i + 4, stop) });
      i = end < 0 ? s.length : end + 3;
      continue;
    }
    if (s.startsWith("<![CDATA[", i)) {
      const end = s.indexOf("]]>", i);
      text(s.slice(i + 9, end < 0 ? s.length : end));
      i = end < 0 ? s.length : end + 3;
      continue;
    }
    if (s[i + 1] === "!" || s[i + 1] === "?") {
      // Doctype, XML declaration, processing instruction: dropped.
      const end = s.indexOf(">", i);
      i = end < 0 ? s.length : end + 1;
      continue;
    }
    if (s[i + 1] === "/") {
      const m = TAG_NAME.exec(s.slice(i + 2));
      const end = s.indexOf(">", i);
      i = end < 0 ? s.length : end + 1;
      if (!m) continue;
      const name = m[0].toLowerCase();
      for (let k = stack.length - 1; k > 0; k--)
        if (stack[k]?.name.toLowerCase() === name) {
          stack.length = k;
          break;
        }
      continue;
    }
    const m = TAG_NAME.exec(s.slice(i + 1));
    if (!m) {
      text("<");
      i++;
      continue;
    }
    const name = m[0];
    const lower = name.toLowerCase();
    let j = i + 1 + name.length;
    const attrs: HAttr[] = [];
    let selfClose = false;
    for (;;) {
      while (/\s/.test(s[j] ?? "")) j++;
      if (j >= s.length) break;
      if (s[j] === ">") {
        j++;
        break;
      }
      if (s.startsWith("/>", j)) {
        selfClose = true;
        j += 2;
        break;
      }
      if (s[j] === "/") {
        j++;
        continue;
      }
      const a = ATTR.exec(s.slice(j));
      if (!a) {
        j++;
        continue;
      }
      const value = a[2] ?? a[3] ?? a[4];
      if (!attrs.some((x) => x.name === a[1]))
        attrs.push({ name: a[1] ?? "", value: value === undefined ? null : value });
      j += a[0].length;
    }
    i = j;
    const closes = IMPLIED[lower];
    if (closes?.includes(top().name.toLowerCase())) stack.pop();
    const el: HNode & { t: "el" } = { t: "el", name, attrs, children: [] };
    top().children.push(el);
    if (selfClose || VOID.has(lower)) continue;
    if (RAW.has(lower)) {
      const re = new RegExp(`</${lower}\\s*>`, "i");
      const rest = s.slice(i);
      const end = rest.search(re);
      const body = end < 0 ? rest : rest.slice(0, end);
      if (body) el.children.push({ t: "text", v: body });
      i = end < 0 ? s.length : i + end + (re.exec(rest)?.[0].length ?? 0);
      continue;
    }
    stack.push(el);
  }
  return root.children;
}

/* --- Names ---------------------------------------------------------------- */

const REACT_ATTRS: Record<string, string> = Object.fromEntries(
  [
    "accessKey allowFullScreen autoCapitalize autoComplete autoFocus autoPlay cellPadding cellSpacing charSet className colSpan contentEditable contextMenu controlsList crossOrigin dateTime encType enterKeyHint formAction formEncType formMethod formNoValidate formTarget frameBorder hrefLang htmlFor inputMode itemProp itemScope itemType itemID itemRef marginHeight marginWidth maxLength minLength mediaGroup noValidate noModule playsInline readOnly referrerPolicy rowSpan spellCheck srcDoc srcLang srcSet tabIndex useMap popoverTarget popoverTargetAction fetchPriority imageSizes imageSrcSet",
  ]
    .join(" ")
    .split(" ")
    .map((n) => [n.toLowerCase(), n]),
);
REACT_ATTRS.class = "className";
REACT_ATTRS.for = "htmlFor";

const EVENTS: Record<string, string> = Object.fromEntries(
  "Click DoubleClick MouseDown MouseUp MouseOver MouseOut MouseEnter MouseLeave MouseMove KeyDown KeyUp KeyPress Change Input Submit Reset Focus Blur Load Error Scroll Wheel ContextMenu Drag DragStart DragEnd DragOver DragEnter DragLeave Drop TouchStart TouchEnd TouchMove TouchCancel PointerDown PointerUp PointerMove PointerEnter PointerLeave PointerCancel Play Pause Ended TimeUpdate Copy Cut Paste Select Invalid Toggle AnimationStart AnimationEnd TransitionEnd"
    .split(" ")
    .map((n) => [n.toLowerCase(), `on${n}`]),
);
EVENTS.dblclick = "onDoubleClick";

/** React props typed as numbers: tabindex="0" becomes tabIndex={0}. */
const NUMERIC = new Set([
  "tabIndex",
  "colSpan",
  "rowSpan",
  "maxLength",
  "minLength",
  "size",
  "cols",
  "rows",
  "span",
  "start",
]);

/** "stroke-width" → "strokeWidth", "xlink:href" → "xlinkHref". */
export function camelAttr(name: string): string {
  return name.replace(/[-:]([a-z0-9])/gi, (_, c: string) => c.toUpperCase());
}

/** The React name of an HTML or SVG attribute (data-* and aria-* stay as they are). */
export function reactAttr(name: string, inSvg: boolean): string {
  const lower = name.toLowerCase();
  if (lower.startsWith("data-") || lower.startsWith("aria-")) return lower;
  const known = REACT_ATTRS[lower];
  if (known) return known;
  if (/[-:]/.test(name)) return camelAttr(name);
  return inSvg ? name : lower;
}

/** "-webkit-transition" → "WebkitTransition", "-ms-flex" → "msFlex", "--gap" stays. */
export function cssProp(prop: string): string {
  const p = prop.trim();
  if (p.startsWith("--")) return p;
  const lower = p.toLowerCase().replace(/^-ms-/, "ms-");
  return lower.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Splits "a: b; c: url(x;y)" on top-level semicolons. */
function declarations(style: string): [string, string][] {
  const out: [string, string][] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  const push = (end: number) => {
    const d = style.slice(start, end);
    const colon = d.indexOf(":");
    if (colon > 0) {
      const k = d.slice(0, colon).trim();
      const v = d.slice(colon + 1).trim();
      if (k && v) out.push([k, v]);
    }
    start = end + 1;
  };
  for (let i = 0; i < style.length; i++) {
    const c = style[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === ";" && depth === 0) push(i);
  }
  push(style.length);
  return out;
}

export type Warning = "event" | "important" | "script" | "rnClass";

/** `color: red; font-size: 12px; z-index: 2` → `{ color: "red", fontSize: "12px", zIndex: 2 }`. */
export function styleObject(style: string, warn?: (w: Warning) => void): string {
  const parts = declarations(style).map(([k, raw]) => {
    let v = raw;
    if (/!important\s*$/i.test(v)) {
      warn?.("important");
      v = v.replace(/\s*!important\s*$/i, "");
    }
    const key = cssProp(k);
    const keyText = /^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key);
    const val =
      /^-?(?:\d+\.?\d*|\.\d+)$/.test(v) && !key.startsWith("--")
        ? String(Number(v))
        : JSON.stringify(v);
    return `${keyText}: ${val}`;
  });
  return parts.length ? `{{ ${parts.join(", ")} }}` : "{{}}";
}

/* --- react-native-svg ----------------------------------------------------- */

const RN_TAGS: Record<string, string> = Object.fromEntries(
  "Svg Circle ClipPath Defs Ellipse ForeignObject G Image Line LinearGradient Marker Mask Path Pattern Polygon Polyline RadialGradient Rect Stop Symbol Text TextPath TSpan Use FeBlend FeColorMatrix FeFlood FeGaussianBlur FeMerge FeMergeNode FeOffset Filter"
    .split(" ")
    .map((n) => [n.toLowerCase(), n]),
);

/* --- Writer --------------------------------------------------------------- */

export interface JsxOptions {
  /** Wrap in `export default function Name() { return (…); }`. */
  component: boolean;
  name: string;
  /** react-native-svg components (Svg, Path…) instead of DOM tags. */
  native: boolean;
  /** Type the component's props (TypeScript). */
  typescript: boolean;
}

export interface JsxResult {
  code: string;
  warnings: Warning[];
  /** The input's root is an <svg>. */
  svg: boolean;
}

const INDENT = "  ";
const MAX = 90;

function escapeText(s: string): string {
  return s.replace(/[{}<>]/g, (c) =>
    c === "{" ? '{"{"}' : c === "}" ? '{"}"}' : c === "<" ? "&lt;" : "&gt;",
  );
}

function attrLiteral(v: string): string {
  if (!v.includes('"')) return `"${v}"`;
  if (!v.includes("'")) return `'${v}'`;
  return `{${JSON.stringify(v)}}`;
}

function templateLiteral(s: string): string {
  return `{\`${s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\`}`;
}

/** HTML or SVG source → JSX source. Never throws. */
export function htmlToJsx(src: string, o: JsxOptions): JsxResult {
  const warnings = new Set<Warning>();
  const warn = (w: Warning) => warnings.add(w);
  const usedRn = new Set<string>();
  const nodes = parseHtml(src);
  const meaningful = (n: HNode) => n.t !== "text" || n.v.trim() !== "";
  const roots = nodes.filter(meaningful);
  const svg = roots.length === 1 && roots[0]?.t === "el" && roots[0].name.toLowerCase() === "svg";

  const tagName = (name: string, inSvg: boolean): string => {
    if (o.native && inSvg) {
      const rn = RN_TAGS[name.toLowerCase()];
      if (rn) {
        usedRn.add(rn);
        return rn;
      }
    }
    return inSvg || name.includes("-") ? name : name.toLowerCase();
  };

  const attrs = (el: HNode & { t: "el" }, inSvg: boolean, isRoot: boolean): string[] => {
    const out: string[] = [];
    const lowerTag = el.name.toLowerCase();
    const custom = el.name.includes("-");
    for (const a of el.attrs) {
      let name = a.name;
      const lower = name.toLowerCase();
      if (o.native && inSvg) {
        if (lower === "xmlns" || lower.startsWith("xmlns:")) continue;
        if (lower === "class") {
          warn("rnClass");
          continue;
        }
      }
      if (a.value === null) {
        const bare = custom ? name : reactAttr(name, inSvg);
        out.push(!inSvg && lowerTag === "input" && bare === "checked" ? "defaultChecked" : bare);
        continue;
      }
      if (lower === "style") {
        out.push(`style=${styleObject(a.value, warn)}`);
        continue;
      }
      if (/^on[a-z]+$/i.test(name) && !custom) {
        warn("event");
        const ev = EVENTS[lower.slice(2)] ?? `on${(lower[2] ?? "").toUpperCase()}${lower.slice(3)}`;
        out.push(`${ev}={(event) => { ${a.value.trim().replace(/;\s*$/, "")}; }}`);
        continue;
      }
      if (!custom) name = reactAttr(name, inSvg);
      if (!inSvg && (lowerTag === "input" || lowerTag === "select") && name === "value")
        name = "defaultValue";
      if (!inSvg && lowerTag === "input" && name === "checked") name = "defaultChecked";
      const numeric = NUMERIC.has(name) && /^-?\d+$/.test(a.value.trim());
      out.push(`${name}=${numeric ? `{${Number(a.value)}}` : attrLiteral(a.value)}`);
    }
    if (isRoot && o.component && svg) out.push("{...props}");
    return out;
  };

  const lines: string[] = [];

  const writeChildren = (kids: HNode[], depth: number, inSvg: boolean, pre: boolean) => {
    const list = pre ? kids : kids.filter((k, i) => meaningful(k) || spaceBetween(kids, i));
    list.forEach((k, i) => {
      const pad = INDENT.repeat(depth);
      if (k.t === "comment") {
        lines.push(`${pad}{/*${k.v.replace(/\*\//g, "* /")}*/}`);
        return;
      }
      if (k.t === "text") {
        if (pre) {
          lines.push(pad + (k.v.includes("\n") ? `{${JSON.stringify(k.v)}}` : escapeText(k.v)));
          return;
        }
        if (!k.v.trim()) {
          lines.push(`${pad}{" "}`);
          return;
        }
        const collapsed = k.v.replace(/\s+/g, " ");
        let t = escapeText(collapsed.trim());
        if (/^\s/.test(collapsed) && i > 0) t = `{" "}${t}`;
        if (/\s$/.test(collapsed) && i < list.length - 1) t = `${t}{" "}`;
        lines.push(pad + t);
        return;
      }
      writeEl(k, depth, inSvg, false);
    });
  };

  /** A whitespace-only text between two elements, on one line, is a real space. */
  const spaceBetween = (kids: HNode[], i: number): boolean => {
    const k = kids[i];
    return (
      k?.t === "text" && !k.v.includes("\n") && kids[i - 1]?.t === "el" && kids[i + 1]?.t === "el"
    );
  };

  const writeEl = (el: HNode & { t: "el" }, depth: number, parentSvg: boolean, isRoot: boolean) => {
    const lower = el.name.toLowerCase();
    const inSvg = parentSvg || lower === "svg";
    const tag = tagName(el.name, inSvg);
    const pad = INDENT.repeat(depth);
    let kids = el.children;
    const as = attrs(el, inSvg, isRoot);
    if (!inSvg && lower === "textarea" && kids.length) {
      const v = kids.map((k) => (k.t === "text" ? k.v : "")).join("");
      as.push(`defaultValue=${v.includes("\n") ? `{${JSON.stringify(v)}}` : attrLiteral(v)}`);
      kids = [];
    }
    const oneLine = as.length ? ` ${as.join(" ")}` : "";
    const head =
      `${pad}<${tag}${oneLine}`.length > MAX && as.length > 1
        ? `${pad}<${tag}\n${as.map((a) => `${pad}${INDENT}${a}`).join("\n")}\n${pad}`
        : `${pad}<${tag}${oneLine}`;
    const multiHead = head.includes("\n");
    if (!kids.some((k) => meaningful(k) || k.t === "comment")) {
      lines.push(`${head}${multiHead ? "/>" : " />"}`);
      return;
    }
    if (lower === "script" || lower === "style") {
      if (lower === "script") warn("script");
      const body = kids.map((k) => (k.t === "text" ? k.v : "")).join("");
      lines.push(`${head}>${templateLiteral(body)}</${tag}>`);
      return;
    }
    const pre = !inSvg && lower === "pre";
    const only = kids.length === 1 ? kids[0] : undefined;
    if (!multiHead && only?.t === "text" && !only.v.includes("\n")) {
      const t = pre ? escapeText(only.v) : escapeText(only.v.replace(/\s+/g, " ").trim());
      const line = `${head}>${t}</${tag}>`;
      if (line.length <= MAX || pre) {
        lines.push(line);
        return;
      }
    }
    lines.push(`${head}>`);
    writeChildren(kids, depth + 1, inSvg, pre);
    lines.push(`${pad}</${tag}>`);
  };

  const wrap = roots.length !== 1 || roots[0]?.t !== "el";
  const base = o.component ? 2 : 0;
  if (!roots.length) return { code: "", warnings: [], svg: false };
  if (wrap) {
    lines.push(`${INDENT.repeat(base)}<>`);
    writeChildren(nodes, base + 1, false, false);
    lines.push(`${INDENT.repeat(base)}</>`);
  } else if (roots[0]?.t === "el") writeEl(roots[0], base, false, true);

  let code = lines.join("\n");
  if (o.component) {
    const name = componentName(o.name, svg);
    let props = "";
    if (svg)
      props = o.typescript
        ? o.native
          ? "props: SvgProps"
          : "props: SVGProps<SVGSVGElement>"
        : "props";
    code = `export default function ${name}(${props}) {\n  return (\n${code}\n  );\n}`;
    if (svg && o.typescript && !o.native)
      code = `import type { SVGProps } from "react";\n\n${code}`;
  }
  if (o.native && usedRn.size) {
    const named = [...usedRn].filter((n) => n !== "Svg").sort();
    if (o.component && svg && o.typescript) named.push("type SvgProps");
    const def = usedRn.has("Svg") ? "Svg" : "";
    const imports = [def, named.length ? `{ ${named.join(", ")} }` : ""].filter(Boolean).join(", ");
    code = `import ${imports} from "react-native-svg";\n\n${code}`;
  }
  return { code: `${code}\n`, warnings: [...warnings], svg };
}

/** A valid component name: "my icon" → "MyIcon"; defaults to Icon for SVG, Component otherwise. */
export function componentName(name: string, svg: boolean): string {
  const words = name.match(/[A-Za-z0-9]+/g) ?? [];
  const out = words.map((w) => (w[0] ?? "").toUpperCase() + w.slice(1)).join("");
  if (!out) return svg ? "Icon" : "Component";
  return /^\d/.test(out) ? `C${out}` : out;
}
