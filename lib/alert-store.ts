/**
 * Where the server keeps the watch it checks while no desk is open:
 * `alerts.json` in the state directory (`lib/state-file.ts`).
 *
 * The file is a copy, not the record. The officer's browser still owns the list
 * (`lib/watchlist.ts`) and sends all of it whenever it changes and whenever the
 * desk opens, so a server that lost the file — a restart on a host without a
 * persistent disk — has it back the next time anyone looks.
 *
 * Server-only.
 */

import { emptyState, readState, type AlertState } from "./alerts";
import { readStateFile, serially, writeStateFile } from "./state-file";
import { generateVapidKeys, vapidKeysMatch, type VapidKeys } from "./webpush";

const FILE = "alerts.json";

export async function loadState(): Promise<AlertState> {
  const text = await readStateFile(FILE);
  if (text === null) return emptyState();
  try {
    return readState(JSON.parse(text));
  } catch {
    // A damaged file is started afresh: every browser sends its list again when its desk opens.
    console.warn("[alerts] alerts.json could not be read; starting with an empty watch.");
    return emptyState();
  }
}

/**
 * Read, change and write the file, one change at a time. The route and the
 * scheduled check both write; queued, neither can overwrite the other with a
 * copy it read before the other wrote.
 */
export function mutate<T>(change: (state: AlertState) => T): Promise<T> {
  return serially(FILE, async () => {
    const state = await loadState();
    const result = change(state);
    await writeStateFile(FILE, JSON.stringify(state, null, 2));
    return result;
  });
}

/**
 * The server's push identity. From the environment when both halves are set —
 * the way to keep it across restarts on a host whose disk does not survive
 * them — otherwise made once and kept in the state directory.
 */
export function vapidKeys(): Promise<VapidKeys> {
  const holder = globalThis as typeof globalThis & { __finexVapid?: Promise<VapidKeys> };
  holder.__finexVapid ??= loadKeys().catch((err) => {
    holder.__finexVapid = undefined;
    throw err;
  });
  return holder.__finexVapid;
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

  try {
    const held = JSON.parse((await readStateFile("vapid.json")) ?? "") as VapidKeys;
    if (vapidKeysMatch(held)) return { publicKey: held.publicKey, privateKey: held.privateKey };
  } catch {
    // Missing or damaged: make a new pair. Browsers holding the old one are told
    // it is gone on their next alert, and subscribe again when their desk opens.
  }
  const keys = generateVapidKeys();
  await writeStateFile("vapid.json", JSON.stringify(keys), 0o600);
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
