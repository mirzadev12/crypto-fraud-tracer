import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { QR_MAX_VERSION, dataCodewords, encodeQr, rawDataModules, tableCodewords } from "../lib/qr.ts";

test("every block table entry fills its version exactly", () => {
  for (const level of ["L", "M", "Q", "H"]) {
    for (let v = 1; v <= QR_MAX_VERSION; v++) {
      assert.equal(tableCodewords(v, level), Math.floor(rawDataModules(v) / 8), `${level} v${v}`);
    }
  }
});

// docs/pitch/qr-finex-light.svg was made by a different encoder, and decoded
// and checked when the deck was built. Reproducing it module for module — with
// the mask chosen by our own penalty score — checks the whole pipeline against
// an implementation that is not ours: its version 5 at level H interleaves
// blocks of two different lengths.
test("reproduces an independently made code bit for bit", () => {
  const svg = readFileSync(new URL("../docs/pitch/qr-finex-light.svg", import.meta.url), "utf8");
  const size = Number(/viewBox="0 0 (\d+) \1"/.exec(svg)[1]);
  const grid = Array.from({ length: size }, () => new Array(size).fill(false));
  for (const m of svg.matchAll(/M(\d+) (\d+(?:\.5)?)((?:h\d+|m\d+ 0)+)/g)) {
    let x = Number(m[1]);
    const y = Math.floor(Number(m[2]));
    for (const step of m[3].matchAll(/h(\d+)|m(\d+) 0/g)) {
      if (step[1]) for (let k = 0; k < Number(step[1]); k++) grid[y][x++] = true;
      else x += Number(step[2]);
    }
  }
  const quiet = 2;
  const reference = grid.slice(quiet, size - quiet).map((row) => row.slice(quiet, size - quiet));
  const qr = encodeQr("https://crypto-fraud-tracer.onrender.com", { level: "H" });
  assert.equal(qr.version, 5);
  assert.equal(qr.mask, 2);
  assert.deepEqual(qr.modules, reference);
});

test("chooses the smallest version that holds the text, and refuses what none holds", () => {
  assert.equal(encodeQr("x".repeat(412)).version, 15);
  assert.equal(encodeQr("x".repeat(413)), null);
  assert.equal(encodeQr("x").version, 1);
  const bytes = Math.floor((dataCodewords(9, "M") * 8 - 12) / 8);
  assert.equal(encodeQr("x".repeat(bytes)).version, 9);
  assert.equal(encodeQr("x".repeat(bytes + 1)).version, 10);
});
