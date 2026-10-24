/** Builds a .gitignore from templates: one section per template, duplicate patterns removed. */
import { matchesQuery } from "../_shared";
import { TEMPLATES, type Template } from "./templates";

export function findTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function searchTemplates(query: string): Template[] {
  return TEMPLATES.filter((t) => matchesQuery(query, t.name, t.id, t.aliases));
}

const isPattern = (line: string) => line.trim() !== "" && !line.trim().startsWith("#");

/**
 * Merges the templates in the order given, then the custom lines. A pattern already present
 * in an earlier section is dropped; a block (lines between blank lines) left with only
 * comments is dropped too, and so is a section left empty.
 */
export function buildGitignore(ids: string[], custom = "", customTitle = "Custom"): string {
  const seen = new Set<string>();
  const sections: string[] = [];
  const sources: { title: string; body: string }[] = [];
  for (const id of new Set(ids)) {
    const t = findTemplate(id);
    if (t) sources.push({ title: t.name, body: t.body });
  }
  if (custom.trim()) sources.push({ title: customTitle, body: custom });

  for (const src of sources) {
    const blocks = src.body
      .replace(/\r\n?/g, "\n")
      .split(/\n\s*\n/)
      .map((block) =>
        block.split("\n").filter((line) => {
          if (!isPattern(line)) return true;
          const key = line.trim();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
      )
      .filter((lines) => lines.some(isPattern))
      .map((lines) => lines.map((x) => x.trimEnd()).join("\n"));
    if (blocks.length) sections.push(`# --- ${src.title} ---\n${blocks.join("\n\n")}`);
  }
  return sections.length ? `${sections.join("\n\n")}\n` : "";
}

/** Number of patterns (not comments, not blank lines) in a .gitignore. */
export function countPatterns(text: string): number {
  return text.split("\n").filter(isPattern).length;
}
