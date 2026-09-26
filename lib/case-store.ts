/**
 * The shared case file on disk: `cases.json` in the state directory
 * (`lib/state-file.ts`). Rules in `lib/case-file.ts`.
 *
 * Server-only.
 */

import { readCases, sortCases, type SavedCase } from "./case-file";
import { readStateFile, serially, writeStateFile } from "./state-file";

const FILE = "cases.json";

export async function loadCases(): Promise<SavedCase[]> {
  const text = await readStateFile(FILE);
  if (text === null) return [];
  try {
    return sortCases(readCases(JSON.parse(text)));
  } catch {
    console.warn("[cases] cases.json could not be read.");
    return [];
  }
}

/** Read, change and write, one change at a time. */
export function changeCases<T>(change: (cases: SavedCase[]) => T): Promise<T> {
  return serially(FILE, async () => {
    const cases = await loadCases();
    const result = change(cases);
    await writeStateFile(FILE, JSON.stringify(sortCases(cases), null, 2));
    return result;
  });
}
