/**
 * The files the server keeps for itself — the alert watch, the shared case
 * file and the audit log — all in one directory, as plain files: AGENTS.md §3
 * allows JSON files and no database.
 *
 * `FINEX_STATE_DIR` names the directory (a mounted disk, in production); the
 * default is `.finex/` in the working directory. Either way it is git-ignored,
 * because it also holds the server's private push key and officers' records.
 *
 * Writes to one file are queued on `globalThis`: Next bundles
 * `instrumentation.ts` and the route handlers separately, so a module-level
 * queue would exist twice, and two writers would each think they were alone.
 *
 * Server-only.
 */

import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export function stateDir(): string {
  return process.env.FINEX_STATE_DIR?.trim() || path.join(process.cwd(), ".finex");
}

// Written at run time, never part of the build: kept out of Turbopack's file
// tracing, which would otherwise ship the whole project with the server code.
export const stateFile = (name: string) => path.join(/*turbopackIgnore: true*/ stateDir(), name);

/** The file's text, or null when it has not been written yet. */
export async function readStateFile(name: string): Promise<string | null> {
  try {
    return await readFile(stateFile(name), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/** Written whole, then renamed into place, so a crash mid-write never leaves half a file. */
export async function writeStateFile(name: string, text: string, mode?: number): Promise<void> {
  await mkdir(stateDir(), { recursive: true });
  const target = stateFile(name);
  const temp = `${target}.${process.pid}.tmp`;
  await writeFile(temp, text, mode === undefined ? undefined : { mode });
  await rename(temp, target);
}

export async function appendStateFile(name: string, text: string): Promise<void> {
  await mkdir(stateDir(), { recursive: true });
  await appendFile(stateFile(name), text);
}

/** Run `work` after every earlier piece of work on the same file has finished. */
export function serially<T>(name: string, work: () => Promise<T>): Promise<T> {
  const holder = globalThis as typeof globalThis & { __finexQueues?: Map<string, Promise<unknown>> };
  const queues = (holder.__finexQueues ??= new Map());
  const run = (queues.get(name) ?? Promise.resolve()).then(work);
  queues.set(name, run.catch(() => undefined));
  return run;
}
