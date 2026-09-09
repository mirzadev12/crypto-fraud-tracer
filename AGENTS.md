<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Backend Plan — Crypto Fraud Tracer

### SIH 2026 · PS 26183 · Ministry of Home Affairs / I4C · Team FineX

**Read this whole document before writing any code. It takes 10 minutes and will save you a day.**

---

## 1. What we are building

An investigator pastes a **victim-reported TRON wallet address** into our tool. Within seconds we:

1. Trace where the stolen USDT went, hop by hop
2. Identify the **exchange** that received it — and the **specific customer deposit address** at that exchange
3. Flag laundering patterns with plain-English reasons
4. Classify the case as **HOT / WARM / COLD** by whether the money can still be frozen
5. Generate a printable evidence packet the officer can attach to a freeze request

**The one sentence that wins us the round:**

> "Binance — customer deposit address `TXY9...4kQ`, confidence 0.87, 12 sweeps observed."

Everyone else's project will draw a pretty graph and stop at "the funds went to Binance." Naming the *deposit address* is what makes it actionable, because that's the account the exchange can actually freeze. **That is the backend's job. It is the whole project.**

---

## 2. Why TRON and not Ethereum

Because that is where Indian fraud money actually goes. UNODC reported that USDT on TRON became the preferred vehicle for cyber fraud and money laundering — near-zero fees, fast transfers, easy off-ramps. Reporting on the Myanmar scam compounds targeting Indian victims says proceeds are converted to USDT on TRON almost immediately.

If a judge asks why not Ethereum: *"Ethereum is a two-day adapter. We built where the money is."*

Do not add Ethereum. Do not add multi-chain. Scope discipline is a scoring criterion.

---

## 3. Hard rules — do not violate these

| Rule | Why |
|---|---|
| TRON only (TRC-20 / USDT) | Scope. 3 days. |
| No database — JSON files in `/data` | Zero setup, zero outage risk, zero latency |
| No Python service — everything in Next.js API routes | One deploy, not two |
| No ML libraries — rules only | We must defend every score to a judge. A black box in an asset-freezing tool is a liability. |
| Native `fetch` only — no axios | One less dependency to break |
| `lib/types.ts` is **frozen** | Frontend is building against it right now |
| No refactoring, no tests | Working beats elegant. We have 72 hours. |

Only new dependency allowed in the whole project: `@xyflow/react` (frontend's).

---

## 4. What backend owns

**Yours:**

```
lib/types.ts
lib/trongrid.ts
lib/tracer.ts
lib/labels.ts
lib/risk.ts
app/api/trace/route.ts
app/api/trace/[address]/route.ts
app/api/cases/route.ts
scripts/cluster.mjs
data/*.json
public/mock/*.json
```

**Never touch:** `app/page.tsx`, `app/trace/**`, `app/report/**`, `components/**`

Frontend owns those. If you edit them you will cause a merge conflict on Day 3 and we will lose an hour we do not have.

---

## 5. The contract — write this file in HOUR ONE

This is the single most important thing you do today. The moment `lib/types.ts` and the mock JSON files exist, the frontend team is unblocked for two full days and never has to wait for you.

See `lib/types.ts` in this repo — it is written, frozen, and matches this section verbatim.

**Endpoints — exactly three, no more:**

| Method | Route | Returns |
|---|---|---|
| `GET` | `/api/cases` | `CaseSummary[]` |
| `POST` | `/api/trace` — body `{address, amount, fraudDate}` | `TraceResult` |
| `GET` | `/api/trace/[address]` | `TraceResult` (cached / demo mode) |

**Then immediately hand-write four fake files** and commit them:

```
public/mock/cases.json         → CaseSummary[]  (8 entries)
public/mock/trace-warm.json    → TraceResult, terminal = Binance deposit addr
public/mock/trace-hot.json     → TraceResult, terminal = null, funds at rest
public/mock/trace-cold.json    → TraceResult, path touches a mixer
```

Make them realistic — 6–8 nodes, real-looking TRON addresses (they start with `T`, 34 chars). Frontend renders these all of Day 1 and 2.

**Message the frontend team the moment this is committed.** That's the handoff.

---

## 6. Data files you must build

### `data/hot-wallets.json`

```json
[{ "address": "T...", "exchange": "Binance", "source_url": "https://tronscan.org/..." }]
```

8–10 entries. Sourced manually from Tronscan's public tag/label pages. Include at least one Indian VASP (CoinDCX, WazirX, Mudrex) if you can verify it — that is a talking point with an MHA judge, because Western tools under-label Indian exchanges.

**This is copy-paste work, not coding.** Do not let it eat a programmer's day.

### `data/risk-lists.json`

```json
{
  "sanctioned": [{ "address": "T...", "list": "OFAC SDN" }],
  "mixers":     [{ "address": "T...", "name": "..." }],
  "community":  [{ "address": "T...", "reports": 14, "source": "ChainAbuse" }]
}
```

OFAC publishes its SDN list free — filter for TRON digital currency addresses. Add known mixer contracts and top ChainAbuse reports.

### `data/deposit-addresses.json` ← **generated by `scripts/cluster.mjs`**

```json
[{ "address": "T...", "exchange": "Binance", "sweepCount": 12,
   "confidence": 0.87, "evidence": "12 sweeps, 97% of inflow forwarded" }]
```

### `data/demo-cases.json` ← generated Day 3, see §10

---

## 7. `scripts/cluster.mjs` — THE MOST IMPORTANT FILE

Run offline, once, on a laptop. Output committed to the repo. Never runs in production.

### The idea, in plain English

Exchanges give every customer a unique deposit address. When you deposit USDT to Binance, you send it to *your* address, and Binance later sweeps it into their main hot wallet.

So: **an address that receives from many unrelated sources and forwards almost all of it to one known exchange hot wallet, repeatedly, IS a customer deposit address at that exchange.**

That's it. That's the trick. Commercial vendors charge lakhs for this dataset and we derive it from public data with about 80 lines of JavaScript.

### Algorithm

```
for each hot_wallet in data/hot-wallets.json:
    inflows = TronGrid TRC-20 transfers where to == hot_wallet
    senders = distinct(inflows.from), capped at 30      ← DO NOT REMOVE THE CAP
    for each sender:
        txs        = TronGrid TRC-20 transfers for sender
        total_in   = sum(value where to   == sender)
        to_hot     = sum(value where from == sender and to == hot_wallet)
        sweeps     = count(txs where from == sender and to == hot_wallet)
        if sweeps >= 2 and total_in > 0 and (to_hot / total_in) >= 0.90:
            emit {
              address: sender,
              exchange: hot_wallet.exchange,
              sweepCount: sweeps,
              confidence: min(0.5 + sweeps * 0.03, 0.95),
              evidence: `${sweeps} sweeps, ${pct}% of inflow forwarded`
            }
```

### Tuning

- If you get **zero results**: drop the ratio to 0.80 and `sweeps >= 1`
- If you get **tens of thousands**: raise to 0.95 and `sweeps >= 3`
- Target: **a few hundred to a few thousand rows.** We need a number to quote, not a complete index.

### The deliverable is a NUMBER

By end of Day 1 you must be able to say:

> **"We identified N deposit addresses across M exchanges using only public data."**

Write that sentence on the whiteboard. It goes on the slide. Everything else in this project is packaging around it.

---

## 8. `lib/trongrid.ts`

Base: `https://api.trongrid.io`
Endpoint: `GET /v1/accounts/{address}/transactions/trc20`
Params: `limit` (max 200), `only_confirmed=true`, `fingerprint` (pagination cursor from `meta.fingerprint`), optionally `contract_address` to filter to USDT only.

Response shape (**verify this against a real call before building on it — do not trust this doc**):

```
data: [{ transaction_id, block_timestamp, from, to, value, token_info: {symbol, decimals} }]
meta: { fingerprint, page_size }
```

USDT on TRON has **6 decimals**. `value` comes back as a string of integer base units — divide by 1e6. Getting this wrong makes every amount in the demo look absurd, and a judge will notice. Verify the USDT TRC-20 contract address on Tronscan yourself; do not copy one from memory.

### Requirements

- **In-memory `Map` cache** keyed by address. Same address is hit many times during BFS. Without this you will get rate-limited in the first demo.
- **SHA-256 every response body** with `node:crypto` and push to an array. This is our chain-of-custody, it costs three lines, and it's a bullet on the evidence packet.
- **Count API calls** into `provenance.apiCalls`.
- Handle 429 and non-JSON responses without crashing. Return empty array and keep going.

No API key needed for basic public reads. If you hit limits, TronGrid free keys are available.

---

## 9. `lib/tracer.ts`, `lib/labels.ts`, `lib/risk.ts`

### `tracer.ts` — BFS forward from the victim-reported address

**Hard limits. Without every one of these, the trace explodes and the demo dies:**

- `depth <= 3`
- top **5** outflows by value per node (sort descending, slice)
- drop any transfer below **1%** of `reportedAmountUsdt`
- only transactions **after** `fraudDate`
- **stop expanding on any labelled node** — once we hit an exchange, we're done; that's the answer

**Taint propagation:** if a node received 40% of its parent's outgoing value, it inherits `parentTaint × 0.4`. Store as both `taintedValueUsdt` and `taintFraction`. This is what lets us say "₹4.2 lakh of the victim's money reached this address" instead of just "this address exists."

**Dwell time:** for each edge, seconds between the node receiving funds and forwarding them. Feeds the risk rules.

### `labels.ts`

Build one `Map` at module load from the three data files. `lookup(address): Label | null`.

Priority when an address appears in more than one list:

```
sanctioned  >  exchange hot wallet  >  exchange deposit address  >  community report
```

**Always set `source` honestly.** Explorer-tagged hot wallets are `ground_truth`. Our clustered deposit addresses are `heuristic`. The frontend displays this tag, and showing it is a scoring advantage — most teams hide their uncertainty. We show ours and it reads as maturity, not weakness.

### `risk.ts` — six rules, each returns a `RiskFlag` with a human-readable `reason`

| Code | Trigger | Example `reason` |
|---|---|---|
| `SHORT_DWELL` | any hop forwards in < 10 min | "Funds forwarded within 4 minutes — indicates automated laundering, not manual movement" |
| `HIGH_FANOUT` | a node splits to > 5 outputs | "Funds split across 7 wallets in a single hop" |
| `PEEL_CHAIN` | repeated small peel-offs from a large balance | "Peel-chain pattern: 5 sequential small withdrawals from a bulk address" |
| `ROUND_AMOUNTS` | transfers are round numbers | "Round-figure transfers of 10,000 USDT suggest structured layering" |
| `NEW_ADDRESS` | address first seen < 30 days ago | "Receiving address created 6 days before the reported fraud" |
| `SANCTIONED_CONTACT` | path touches OFAC/mixer | "Path intersects an OFAC-sanctioned address" |

Write the `reason` strings carefully. **The frontend renders them verbatim and the judge reads them off the screen.** This is one of the few places where prose quality directly affects our score.

### Triage — three outcomes

```
path touched a mixer or sanctioned address   → COLD   (document and close)
terminal is a labelled exchange deposit addr → WARM   (freeze request viable)
no outflow found, funds still at rest        → HOT    (act now)
```

Set `triageReason` to one sentence explaining the call.

**This is our differentiator.** Every other team traces. Nobody triages. NCRP receives hundreds of complaints a day and freeze windows are hours long — our pitch is not "we trace wallets," it's **"we tell I4C which of today's complaints still have recoverable money."** Make sure this logic is solid.

---

## 10. Day 3: the safety net — DO NOT SKIP THIS

TronGrid will rate-limit us, or the venue wifi will drop, or our demo address will turn out to have 900 outflows. Teams lose finals to this.

**On Day 3 morning**, run three real addresses through the live pipeline and freeze the outputs:

- one that lands on an exchange deposit address → **WARM**
- one that hits a mixer → **COLD**
- one still holding funds → **HOT**

Save all three complete `TraceResult` objects into `data/demo-cases.json`. Then:

```ts
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
```

When true, `/api/trace` serves from the file instead of calling TronGrid.

**We demo in demo mode.** We run one live trace only if the network is behaving. This is not cheating — the data is real, captured from real API calls, with real hashes. It is what every serious demo does.

---

## 11. Optional, only if you are ahead of schedule

**Narrative summary.** Send the finished `TraceResult` to Groq's free tier (Qwen, ~1,000 requests/day) and ask for a 4-sentence investigator-readable summary. Populate `narrative`. Example output:

> "₹4.2 lakh in USDT left the victim-reported address within 6 minutes of receipt, split across three wallets, and reconverged at a Binance customer deposit address on 14 March. Dwell times under 10 minutes across all hops indicate an automated laundering script."

One API call, sub-second on Groq, and it turns a JSON dump into something an officer can paste into a case file. **Cache the output into `demo-cases.json`** — never make a live LLM call during the pitch.

**Do not** let an LLM decide attribution, labels, or risk scores. If asked "what if the model hallucinates the exchange name," our answer must be: *"It can't. Attribution is a deterministic lookup against a provenance-tagged table."*

---

## 12. Schedule — two people, three days

**BE1 = data & attribution. BE2 = pipeline & API.**

### Day 1

| | BE1 | BE2 |
|---|---|---|
| **Hour 1** | — | **`lib/types.ts` + 4 mock JSON files. Commit. Message frontend.** |
| Hours 2–5 | `data/hot-wallets.json` (manual, Tronscan) | `lib/trongrid.ts` — fetch wrapper, cache, sha256, call counter |
| Hours 5–8 | `data/risk-lists.json` (OFAC + mixers + ChainAbuse) | Verify TronGrid response shape with real calls; confirm USDT decimals |
| Hours 8–12 | **`scripts/cluster.mjs`** — write, run, tune | Help debug pagination; start `lib/tracer.ts` BFS skeleton |

> **End of Day 1 gate:** we have a number from `cluster.mjs`, and `types.ts` + mocks are committed. If we do not have the number, everything else is at risk — escalate to the team tonight, not tomorrow.

### Day 2

| | BE1 | BE2 |
|---|---|---|
| Morning | Finish/tune clustering, commit `deposit-addresses.json` | `lib/tracer.ts` — BFS + taint + all five limits |
| Midday | `lib/labels.ts` — Map, priority order, source tags | Wire tracer → labels, stop-on-label logic |
| Afternoon | `lib/risk.ts` — six rules, write the `reason` strings well | `app/api/trace/route.ts` — full orchestration |
| **6 pm** | **CHECKPOINT: `/api/trace` returns a valid `TraceResult`. Frontend flips one fetch URL and confirms the graph renders. Fix any shape drift NOW, not tomorrow.** | |
| Evening | Triage logic + `triageReason` | `/api/cases` — 8 mock NCRP-shaped complaints, sorted |

### Day 3

| | BE1 | BE2 |
|---|---|---|
| Morning | Run 3 real traces, build `demo-cases.json` | Demo mode flag + serve-from-file path |
| Midday | Optional narrative via Groq, cached | Support frontend integration |
| **2 pm** | **CHECKPOINT: full integration, demo mode on, run the 3-minute pitch end to end** | |
| Afternoon | **Read `tracer.ts` and `risk.ts` line by line. Write the reasoning in your own words on paper.** | Same. |
| **5 pm** | **FEATURE FREEZE.** No new code. Rehearsal only. | |

---

## 13. Definition of done

- [ ] `lib/types.ts` committed hour one, never changed after
- [ ] `cluster.mjs` produced a real number we can quote on a slide
- [ ] `/api/trace` returns valid `TraceResult` for a real TRON address
- [ ] Terminal node names an actual **deposit address**, not just an exchange
- [ ] Every label carries `confidence` and `source`
- [ ] All six risk rules fire on at least one test case
- [ ] Triage returns HOT, WARM and COLD across our three demo cases
- [ ] `demo-cases.json` frozen, demo mode works with wifi off
- [ ] Response hashes populate `provenance.responseHashes`
- [ ] No API keys committed to the repo — check `.gitignore`
- [ ] Both of us can explain the 90% threshold and the 10-minute dwell rule without notes

---

## 14. Git discipline

Branches `be/data` (BE1) and `be/pipeline` (BE2), merged to `main` at each checkpoint. The file ownership in §4 means we should have near-zero conflicts. The only shared file is `lib/types.ts`, and after hour one nobody edits it.

**Check `.gitignore` covers `.env*` before the first push.** Committed API keys are an instant credibility hit if a judge browses the repo.

---

## 15. What we say when judges push back

Say these before they ask. Confident scoping reads as maturity.

**"Why only TRON?"**
That's where Indian cyber-fraud proceeds actually move, per UNODC. Ethereum is a two-day adapter on the same pipeline.

**"Where do your exchange labels come from?"**
Public explorer tags as ground truth, expanded through sweep-pattern clustering. We identified N deposit addresses from M seed wallets using only public data.

**"What about mixers?"**
Nobody can trace deterministically through a mixer. We flag entry, mark the case COLD, and stop. We don't pretend otherwise.

**"What if attribution is wrong?"**
Every label carries a confidence score and a provenance tag. The evidence packet states in writing that it is an investigative lead, not sole grounds for freezing.

**"Why not just buy Chainalysis?"**
Licence cost per seat, foreign-hosted, and it under-labels Indian VASPs. Ours is sovereign, self-hosted, and runs on public APIs at zero rupees.

---

## 16. If you only remember three things

1. **`types.ts` + mocks in hour one.** It unblocks half the team for two days.
2. **`cluster.mjs` is the project.** The number it produces is the pitch. If it fails, we have a graph viewer like everyone else.
3. **Freeze the demo data on Day 3.** Do not demo live.
