import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HELP } from "../app/help/content.ts";

const { en, hi } = HELP;
const DEVANAGARI = /[ऀ-ॿ]/;

test("the Hindi help has the same shape as the English", () => {
  const screens = (c) => c.sections.map((s) => [s.name, s.screens.map((x) => [x.href, x.nav])]);
  assert.deepEqual(screens(hi), screens(en), "same screens, same menu names, same order");
  assert.deepEqual(hi.steps.map((s) => s.n), en.steps.map((s) => s.n));
  assert.deepEqual(hi.status.map((s) => s.level), en.status.map((s) => s.level));
  assert.equal(hi.buttons.length, en.buttons.length);
  assert.equal(hi.limits.length, en.limits.length);
  assert.equal(hi.headings.length, 5);
  assert.equal(en.headings.length, 5);
});

test("every Hindi entry is in Hindi, and says it needs review", () => {
  assert.ok(hi.reviewNote && DEVANAGARI.test(hi.reviewNote));
  assert.equal(en.reviewNote, undefined);
  const texts = [
    hi.title, hi.description, hi.action,
    ...hi.headings.flatMap((h) => [h.title, h.kicker]),
    ...hi.sections.flatMap((s) => s.screens.flatMap((x) => [x.what, x.use])),
    ...hi.steps.flatMap((s) => [s.title, s.body]),
    ...hi.status.flatMap((s) => [s.plain, s.then]),
    ...hi.buttons.map((b) => b.body),
    ...hi.limits.flatMap((l) => [l.title, l.body]),
  ];
  for (const text of texts) assert.ok(DEVANAGARI.test(text), text);
});

// The help names screens the way the menu does; a renamed menu item must be renamed here.
test("every screen the help names is in the navigation under that name", () => {
  const nav = readFileSync(new URL("../components/Navbar.tsx", import.meta.url), "utf8").replace(/\s+/g, " ");
  for (const section of en.sections) {
    for (const s of section.screens) {
      assert.ok(nav.includes(`name: "${s.nav}", href: "${s.href}"`), `${s.nav} → ${s.href}`);
    }
  }
});
