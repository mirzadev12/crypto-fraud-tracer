#!/usr/bin/env node
/**
 * Check a FineX audit log anywhere, without trusting this application.
 *
 *   node scripts/verify-audit.mjs finex-audit.jsonl
 *   node scripts/verify-audit.mjs http://localhost:3000/api/audit?format=jsonl
 *
 * Imports nothing from the app: the hash rule is re-stated here from its
 * description — SHA-256 of the entry without its own `hash` field, written as
 * JSON with its keys sorted at every depth — so a bug in lib/audit.ts cannot
 * make this pass. Each entry must be numbered one after the last, name the
 * previous entry's hash as `prev` (sixty-four zeros for the first), and match
 * its own hash. Prints the head to compare with one written down earlier; exits
 * 1 at the first entry that does not follow.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/verify-audit.mjs <file or URL of the audit log>");
  process.exit(2);
}

const text = /^https?:\/\//.test(source) ? await (await fetch(source)).text() : await readFile(source, "utf8");

/** JSON with the keys of every object sorted, at every depth. */
function sorted(value) {
  if (Array.isArray(value)) return `[${value.map(sorted).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${sorted(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const lines = text.split("\n").filter((l) => l.trim());
let prev = "0".repeat(64);
for (let i = 0; i < lines.length; i++) {
  const n = i + 1;
  let entry;
  try {
    entry = JSON.parse(lines[i]);
  } catch {
    console.log(`BROKEN at line ${n}: not JSON`);
    process.exit(1);
  }
  // Everything but the entry's own hash is hashed.
  const { hash, ...body } = entry;
  const own = createHash("sha256").update(sorted(body)).digest("hex");
  if (entry.seq !== n) {
    console.log(`BROKEN at line ${n}: numbered ${entry.seq}; an entry is missing or out of order`);
    process.exit(1);
  }
  if (entry.prev !== prev) {
    console.log(`BROKEN at entry ${n}: it does not follow the entry before it`);
    process.exit(1);
  }
  if (own !== hash) {
    console.log(`BROKEN at entry ${n}: it has been changed since it was written`);
    process.exit(1);
  }
  prev = hash;
}

console.log(`INTACT: ${lines.length} ${lines.length === 1 ? "entry" : "entries"}`);
console.log(`head ${prev}`);
