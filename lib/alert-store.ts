/**
 * Where the server keeps the watch it checks while no desk is open: a JSON
 * file, as AGENTS.md §3 has it — no database.
 *
 * The file is a copy, not the record. The officer's browser still owns the list
 * (`lib/watchlist.ts`) and sends all of it whenever it changes and whenever the
 * desk opens, so a server that lost the file — a restart on a host without a
 * persistent disk — has it back the next time anyone looks.
 *
 * `FINEX_STATE_DIR` names the directory (a mounted disk, in production); the
 * default is `.finex/` in the working directory. Either way it is git-ignored,
 * because it also holds the server's private push key.
 *
 * State shared by every part of the server lives on `globalThis`: Next bundles
 * `instrumentation.ts` and the route handlers separately, so a module-level
 * variable would exist twice, and two writers would each think they were the
 * only one.
 *
 * Server-only.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { emptyState, readState, type AlertState } from "./alerts";
import { generateVapidKeys, vapidKeysMatch, type VapidKeys } from "./webpush";

interface Shared {
  queue: Promise<unknown>;
  keys?: Promise<VapidKeys>;
}

const holder = globalThis as typeof globalThis & { __finexAlertStore?: Shared };

function shared(): Shared {
  return (holder.__finexAlertStore ??= { queue: Promise.resolve() });
}

export function stateDir(): string {
  return process.env.FINEX_STATE_DIR?.trim() || path.join(process.cwd(), ".finex");
}

// Written at run time, never part of the build: kept out of Turbopack's file
// tracing, which would otherwise ship the whole project with the server code.
const fileOf = (name: string) => path.join(/*turbopackIgnore: true*/ stateDir(), name);

export async function loadState(): Promise<AlertState> {
  let text: string;
  try {
    text = await readFile(fileOf("alerts.json"), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
    throw err;
  }
  try {
    return readState(JSON.parse(text));
  } catch {
    // A damaged file is started afresh: every browser sends its list again when its desk opens.
    console.warn("[alerts] alerts.json could not be read; starting with an empty watch.");
    return emptyState();
  }
}

/** Written whole, then renamed into place, so a crash mid-write never leaves half a file. */
async function saveState(state: AlertState): Promise<void> {
  await mkdir(stateDir(), { recursive: true });
  const target = fileOf("alerts.json");
  const temp = `${target}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(state, null, 2));
  await rename(temp, target);
}

/**
 * Read, change and write the file, one change at a time. The route and the
 * scheduled check both write; queued, neither can overwrite the other with a
 * copy it read before the other wrote.
 */
export function mutate<T>(change: (state: AlertState) => T): Promise<T> {
  const store = shared();
  const run = store.queue.then(async () => {
    const state = await loadState();
    const result = change(state);
    await saveState(state);
    return result;
  });
  store.queue = run.catch(() => undefined);
  return run;
}

/**
 * The server's push identity. From the environment when both halves are set —
 * the way to keep it across restarts on a host whose disk does not survive
 * them — otherwise made once and kept in the state directory.
 */
export function vapidKeys(): Promise<VapidKeys> {
  const store = shared();
  store.keys ??= loadKeys().catch((err) => {
    store.keys = undefined;
    throw err;
  });
  return store.keys;
}

async function loadKeys(): Promise<VapidKeys> {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (publicKey || privateKey) {
    const keys = { publicKey: publicKey ?? "", privateKey: privateKey ?? "" };
    if (!vapidKeysMatch(keys)) {
      throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set but are not one key pair.");
    }
    return keys;
  }

  const file = fileOf("vapid.json");
  try {
    const held = JSON.parse(await readFile(file, "utf8")) as VapidKeys;
    if (vapidKeysMatch(held)) return { publicKey: held.publicKey, privateKey: held.privateKey };
  } catch {
    // Missing or damaged: make a new pair. Browsers holding the old one are told
    // it is gone on their next alert, and subscribe again when their desk opens.
  }
  const keys = generateVapidKeys();
  await mkdir(stateDir(), { recursive: true });
  await writeFile(file, JSON.stringify(keys), { mode: 0o600 });
  return keys;
}

/**
 * Who push services should contact about this server's messages (RFC 8292
 * asks for one). The deployment's own address when there is one.
 */
export function vapidSubject(): string {
  return (
    process.env.VAPID_SUBJECT?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    "https://github.com/mirzadev12/crypto-fraud-tracer"
  );
}
