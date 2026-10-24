/** Entry point: `toolbelt <command> [input] [options]` (bundled to skills/toolbelt/scripts/toolbelt.mjs). */
import { fstatSync } from "node:fs";
import { run } from "./run";

/** How long an open pipe may stay silent before it counts as "no input". */
const PIPE_GRACE_MS = 1500;

/**
 * Reads piped or redirected input. A terminal or /dev/null is no input; a pipe that stays silent
 * (some agent hosts leave one open) counts as no input after a short grace period, so the CLI never
 * hangs waiting for data that will not come.
 */
async function readStdin(): Promise<Uint8Array | null> {
  let stat: ReturnType<typeof fstatSync>;
  try {
    stat = fstatSync(0);
  } catch {
    return null;
  }
  if (!stat.isFile() && !stat.isFIFO() && !stat.isSocket()) return null;
  const chunks: Buffer[] = [];
  const iterator = process.stdin[Symbol.asyncIterator]();
  if (!stat.isFile()) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const first = await Promise.race([
      iterator.next(),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), PIPE_GRACE_MS);
      }),
    ]);
    clearTimeout(timer);
    if (first === "timeout") {
      process.stdin.destroy();
      return null;
    }
    if (first.done) return null;
    chunks.push(first.value as Buffer);
  }
  for (let r = await iterator.next(); !r.done; r = await iterator.next())
    chunks.push(r.value as Buffer);
  return chunks.length ? new Uint8Array(Buffer.concat(chunks)) : null;
}

const res = await run(process.argv.slice(2), { stdin: readStdin });
if (res.bytes) process.stdout.write(res.bytes);
if (res.stdout) process.stdout.write(res.stdout);
if (res.stderr) process.stderr.write(res.stderr);
process.exitCode = res.code;
