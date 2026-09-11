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

/**
 * Alerts from hunt --follow: append-only log of VS1+ findings, read back by
 * `gemhog serve` for the bot's /alerts subscription. Capped so the file never
 * grows past a day of digging.
 */

export interface AlertEntry {
  at: string;
  grade: string;
  score: number;
  symbol: string;
  token: string;
}

const alertsFile = join(dir, "alerts.json");
const ALERTS_CAP = 500;

export function appendAlert(entry: AlertEntry): void {
  try {
    mkdirSync(dir, { recursive: true });
    const list = loadAlerts();
    list.push(entry);
    writeFileSync(alertsFile, JSON.stringify(list.slice(-ALERTS_CAP), null, 1));
  } catch { /* alerts are a convenience; a failed append never fails the hunt */ }
}

export function loadAlerts(sinceIso?: string): AlertEntry[] {
  try {
    const list = JSON.parse(readFileSync(alertsFile, "utf8")) as AlertEntry[];
    if (!sinceIso) return list;
    const since = Date.parse(sinceIso);
    return list.filter((a) => Date.parse(a.at) > since);
  } catch {
    return [];
  }
}
