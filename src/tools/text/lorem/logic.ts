/**
 * Lorem ipsum: words, sentences or paragraphs from the classic pseudo-Latin
 * vocabulary, with a seeded generator so a result stays the same until it is
 * regenerated (and a shared link shows the same text).
 */
import { rng } from "../_shared";

export type Unit = "paragraphs" | "sentences" | "words";

export interface LoremOptions {
  unit: Unit;
  count: number;
  startWithLorem: boolean;
  html: boolean;
  seed: number;
}

export const MAX: Record<Unit, number> = { paragraphs: 100, sentences: 500, words: 5000 };

const OPENING = "Lorem ipsum dolor sit amet, consectetur adipiscing elit";

const WORDS = (
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua " +
  "enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in " +
  "reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa " +
  "qui officia deserunt mollit anim id est laborum pellentesque habitant morbi tristique senectus netus malesuada fames ac " +
  "turpis egestas vestibulum tortor quam feugiat vitae ultricies eget mauris pharetra pretium nibh praesent semper " +
  "feugiat nunc mi lacus viverra accumsan placerat orci sagittis eu volutpat odio facilisis arcu cursus euismod quis " +
  "lectus nulla at tellus integer vel elementum risus sapien faucibus nisl tincidunt nec ultrices dui imperdiet " +
  "massa purus gravida porta donec hendrerit leo ligula aenean condimentum lobortis scelerisque fermentum varius " +
  "sollicitudin aliquam erat suspendisse potenti nullam rhoncus urna neque viverra justo convallis posuere morbi blandit " +
  "cras ornare augue diam maecenas ultricies mi eget mauris dapibus ultrices sem quisque sagittis purus vulputate " +
  "dignissim suspendisse interdum consectetur libero lacinia quis vel eros donec ac congue rutrum"
).split(" ");

function pick(rand: () => number): string {
  return WORDS[Math.floor(rand() * WORDS.length)] ?? "lorem";
}

function between(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sentence(rand: () => number): string {
  const n = between(rand, 6, 14);
  const ws: string[] = [];
  for (let i = 0; i < n; i++) {
    let w = pick(rand);
    // Avoid the same word twice in a row.
    while (w === ws[ws.length - 1]) w = pick(rand);
    ws.push(w);
  }
  // A comma somewhere in the middle of longer sentences.
  if (n > 8) {
    const at = between(rand, 2, n - 4);
    ws[at] = `${ws[at]},`;
  }
  return `${capitalize(ws.join(" "))}.`;
}

function sentences(rand: () => number, count: number, start: boolean): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(i === 0 && start ? `${OPENING}.` : sentence(rand));
  return out;
}

export function lorem(o: LoremOptions): string {
  const count = Math.max(0, Math.min(MAX[o.unit], Math.floor(o.count)));
  if (count === 0) return "";
  const rand = rng(o.seed);
  let blocks: string[];
  if (o.unit === "words") {
    const ws: string[] = o.startWithLorem ? OPENING.replace(",", "").toLowerCase().split(" ") : [];
    while (ws.length < count) ws.push(pick(rand));
    blocks = [`${capitalize(ws.slice(0, count).join(" "))}.`];
  } else if (o.unit === "sentences") {
    blocks = [sentences(rand, count, o.startWithLorem).join(" ")];
  } else {
    blocks = [];
    for (let p = 0; p < count; p++)
      blocks.push(sentences(rand, between(rand, 4, 7), p === 0 && o.startWithLorem).join(" "));
  }
  return o.html ? blocks.map((b) => `<p>${b}</p>`).join("\n") : blocks.join("\n\n");
}
