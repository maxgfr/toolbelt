/** Runs the CLI in-process for tests, with a fixed clock and no inherited LANG. */
import { type Io, type RunResult, run } from "./run";

export const NOW = new Date("2026-01-15T12:00:00Z");

export function tb(argv: string[], io: Io = {}): Promise<RunResult> {
  return run(argv, { env: {}, now: NOW, ...io });
}
