import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { HuntResult } from "./hunt.js";

/**
 * The one piece of local state the CLI keeps: the last hunt, so `export` and
 * `top` can answer from it without re-digging. Lives in ~/.gemhog, never in
 * the repository.
 */

const dir = join(homedir(), ".gemhog");
const file = join(dir, "last-hunt.json");

export function saveHunt(result: HuntResult): void {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(result, null, 1));
  } catch { /* state is a convenience; a failed save never fails the hunt */ }
}

export function loadHunt(): HuntResult | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as HuntResult;
  } catch {
    return null;
  }
}

export const huntStatePath = (): string => file;
