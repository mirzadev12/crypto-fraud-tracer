import { test } from "node:test";
import assert from "node:assert/strict";
import { TYPOLOGIES, parseTypology, typologyLabel } from "../lib/typology.ts";
import { readPinned } from "../lib/format.ts";

test("digital arrest is offered first, and every typology has a label", () => {
  assert.equal(TYPOLOGIES[0].id, "digital-arrest");
  for (const t of TYPOLOGIES) assert.ok(t.label.length > 0);
  assert.equal(typologyLabel("task-job"), "Task-based job fraud");
});

test("only a listed typology is accepted, from an id or a complaint sheet's wording", () => {
  assert.equal(parseTypology("digital-arrest"), "digital-arrest");
  assert.equal(parseTypology("Digital Arrest"), "digital-arrest");
  assert.equal(parseTypology("  investment / trading app "), "investment-app");
  assert.equal(parseTypology("<script>"), undefined);
  assert.equal(parseTypology(""), undefined);
  assert.equal(parseTypology(undefined), undefined);
});

test("a link carries the typology; anything unlisted is dropped", () => {
  assert.equal(readPinned({ typology: "sextortion" }).typology, "sextortion");
  assert.equal(readPinned({ typology: "made-up" }).typology, undefined);
});
