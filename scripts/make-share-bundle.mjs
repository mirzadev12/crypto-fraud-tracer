// Bundles the whole frontend into one Markdown file that can be uploaded to a
// chat that has no access to this machine.
//
//   node scripts/make-share-bundle.mjs
//
// Output: share/frontend-source.md

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join, extname, relative } from "node:path";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "share");
const OUT_FILE = join(OUT_DIR, "frontend-source.md");

const INCLUDE_DIRS = ["app", "components", "lib"];
const INCLUDE_FILES = [
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "AGENTS.md",
  "CONTEXT.md",
  "README.md",
  "public/mock/cases.json",
  "public/mock/trace-warm.json",
  "public/mock/trace-hot.json",
  "public/mock/trace-cold.json",
  "scripts/make-mocks.mjs",
];

const LANG = {
  ".ts": "ts",
  ".tsx": "tsx",
  ".mjs": "js",
  ".js": "js",
  ".json": "json",
  ".css": "css",
  ".md": "markdown",
};

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (LANG[extname(entry)]) {
      out.push(full);
    }
  }
  return out;
}

const files = [];
for (const dir of INCLUDE_DIRS) {
  const full = join(ROOT, dir);
  if (existsSync(full)) files.push(...walk(full));
}
for (const file of INCLUDE_FILES) {
  const full = join(ROOT, file);
  if (existsSync(full)) files.push(full);
}

const rel = (f) => relative(ROOT, f).split("\\").join("/");
files.sort((a, b) => rel(a).localeCompare(rel(b)));

const parts = [
  "# TraceX — Crypto Fraud Tracer: complete frontend source",
  "",
  "Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · `@xyflow/react`.",
  "",
  "Every screen reads its data through `lib/api.ts`, which calls the real API",
  "first and falls back to the committed fixtures in `public/mock` when it is",
  "unavailable. `lib/types.ts` is the frozen contract shared with the backend.",
  "",
  `Generated ${new Date().toISOString()} · ${files.length} files.`,
  "",
  "## Contents",
  "",
  ...files.map((f) => `- \`${rel(f)}\``),
  "",
  "---",
  "",
];

for (const f of files) {
  const body = readFileSync(f, "utf8").replace(/\r\n/g, "\n").trimEnd();
  parts.push(`## \`${rel(f)}\``, "", "```" + (LANG[extname(f)] ?? ""), body, "```", "");
}

mkdirSync(OUT_DIR, { recursive: true });
const text = parts.join("\n");
writeFileSync(OUT_FILE, text, "utf8");

console.log(`wrote ${rel(OUT_FILE)} — ${files.length} files, ${(text.length / 1024).toFixed(0)} KB`);
