/**
 * Builds data/anomaly-baseline.json: the feature rows of every unlabelled
 * wallet in the recorded cases, which the advisory anomaly ranking
 * (lib/anomaly.ts) is trained on beside the trace being viewed. Numbers only —
 * no address leaves this script. Re-run whenever data/demo-cases.json or the
 * features change:
 *
 *   node --import ./tests/register.mjs scripts/make-anomaly-baseline.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { FEATURES, featureRows } from "../lib/anomaly.ts";

const frozen = JSON.parse(readFileSync(new URL("../data/demo-cases.json", import.meta.url), "utf8"));
const cases = Array.isArray(frozen) ? frozen : frozen.cases;
const rows = cases.flatMap(({ trace }) => featureRows(trace).map((r) => r.row.map((v) => (v === null ? null : Number(v.toFixed(6))))));

const out = {
  _note:
    "Feature rows of the unlabelled wallets in the recorded cases (data/demo-cases.json), the baseline the advisory anomaly ranking is trained on. Numbers only, no addresses. Regenerate with scripts/make-anomaly-baseline.mjs.",
  _cases: cases.length,
  features: FEATURES,
  rows,
};
writeFileSync(new URL("../data/anomaly-baseline.json", import.meta.url), JSON.stringify(out) + "\n");
console.log(`anomaly baseline: ${rows.length} wallets from ${cases.length} recorded cases`);
