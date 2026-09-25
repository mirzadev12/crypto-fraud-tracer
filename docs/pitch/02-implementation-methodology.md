# FineX — Implementation Methodology

Two parts: how a complaint is processed (the pipeline), and how the system was
built and verified (the engineering method). Every figure is from the
committed repository, 21 September 2026.

---

# Part A — The pipeline

What happens between an officer pasting an address and a freeze request.

### 1. Intake
A wallet address **or a transaction hash**. Addresses are base58check-validated
in the browser before any network call, so a typo never costs a chain read. A
64-character hash is resolved through its USDT Transfer event to the wallet it
paid, and the tool states what it resolved before tracing anything.
*Why a transaction: a defrauded person reports a UPI ID or a bank account, never
a wallet — but their own exchange can produce the withdrawal transaction.*

### 2. Window
Amount and fraud date are both optional. A blank amount follows everything that
left the wallet; a blank date opens the window one second before the wallet's
earliest transfer on record.

### 3. Collection
Paginated TRC-20 transfers from TronGrid, with:
- an in-memory cache, since one address is read many times during a trace;
- **one shared adaptive rate limiter** for the whole server — 100 ms between
  calls with an API key, 250 ms without, doubling on every refusal and easing
  back on every answer;
- **SHA-256 of every response body**, kept for the evidence packet;
- an unreadable or partly-read wallet tracked **separately from an empty one**.

### 4. Traversal
Breadth-first from the reported wallet, with five hard limits:
depth ≤ 3 · top five outflows per wallet by value · transfers under 1% of the
reported amount dropped · only transfers after the money actually arrived ·
stop at any labelled wallet. Each wallet is walked once.

### 5. Taint
Two models that bracket the answer: **haircut** (default, conservative — each
hop inherits its share) and **FIFO** (the rule courts have used for mixed funds
since Clayton's Case). A transfer can never carry more than its own value.
Dwell time per hop is measured from a transfer that actually happened.

### 6. Attribution
A deterministic lookup in one map, priority: sanctioned → exchange hot wallet →
customer deposit address → community. Every label carries a **confidence and a
source tier**, and the interface shows the tier — an explorer tag and a derived
cluster are never allowed to look like the same claim.

### 7. Clustering — the core dataset (offline)
An exchange issues every customer a unique deposit address and later sweeps it
into a main hot wallet. So: an address that **forwards ≥ 90% of its inflow to
one tagged exchange wallet, ≥ 2 times**, is a customer deposit address at that
exchange. Run offline against public data, output committed:
**241 deposit addresses across 10 exchanges, derived from 15 seed wallets.**

### 8. Scoring
Six behavioural rules — short dwell, high fan-out, peel chain, round amounts,
new address, sanctioned contact — each returning a plain-English reason an
officer can read aloud. They score **everything actually read**, not the pruned
trace, because the pruning removes exactly the evidence two of them look for.

### 9. Triage and output
Every case lands in one of three dispositions with a one-sentence reason:
**CRITICAL** (funds still at rest) · **SUSPICIOUS** (freezable exit named) ·
**CLOSED** (mixer or sanctioned — nothing follows deterministically).
Then: ranked next-wallet leads, chokepoints by Brandes betweenness, links
between complaints that share an account, an evidence packet carrying its
response hashes, a freeze-request draft, and a CSV of the morning's queue.
A CRITICAL wallet goes on a watch that re-asks the chain whether it has moved.

---

# Part B — The engineering method

### Contract first
`lib/types.ts` and mock fixtures were frozen at the start, so the interface and
the engine were built in parallel against the same shape and never blocked each
other.

### Honesty rules treated as acceptance criteria
Each of these is enforced in code, not policy:
- an unreadable wallet is **never** reported as empty;
- a partial read is never passed off as complete;
- a recorded case never claims to be live;
- an illustrative case never claims to be recorded;
- a frozen case is never served for an address, amount or window it does not
  belong to.

### Verification instead of a test suite
The 72-hour scope rule forbade a test framework, so correctness is established
by evidence rather than by unit tests:
- **`verify-case.mjs` re-reads every transaction of every recorded case straight
  from the chain**, importing nothing from the tracer — so a tracer bug cannot
  make it pass. Latest run: **33 confirmed, 0 mismatched, 0 missing** (17
  unreadable, an unkeyed run throttling itself).
- **Clustering is calibrated against the chain**: 40 derived addresses sampled,
  31 readable, and all 31 still met the clustering rule — but confidence bands
  scored identically, which is why confidence is presented as *how much evidence
  was seen*, never as accuracy.
- **Rule base rates are measured** on a sample of 17 unreported wallets, and the
  sample size is stated wherever the rates are.
- The interface is swept in a real browser for sideways overflow, console
  errors, accessibility structure and printed output, against a production
  build rather than the dev server.

### A safety net for the demo
Ten real cases captured from the live pipeline, each a complete result carrying
the SHA-256 of every chain response behind it. With `DEMO_MODE` on they are
served from the file with no network at all, stamped **"recorded trace"** on
screen — real data, captured from real API calls, never passed off as live.

### A written decision log
`CONTEXT.md` records every decision *and every reversal*, so no later session
re-derives them. 89 commits, each small and reversible.

### Deployment
One Render web service from `render.yaml`. `GET /api/health` reports the serving
commit, whether demo mode is on, and whether the chain is being read with a key
— so the deployment's configuration can be checked from outside the dashboard.

---

## Measured results

| Check | Result |
|---|---|
| Independent re-read of recorded cases | 33 confirmed · 0 mismatched · 0 missing |
| Clustering still holds on re-read sample | 31 of 31 readable addresses still meet the rule |
| Dispositions covered by real frozen cases | all three (CRITICAL, SUSPICIOUS, CLOSED) |
| Complaints converging on one account | 3 of 10 cases share one MEXC deposit address, 27,930.21 USDT between them |
| Demo mode, network off | all 10 cases answer from file, stamped "recorded" |

---

## What is deliberately not built

Stating this is part of the method, not an apology — each has a plan:
cross-chain tracing (an address on another chain is screened against OFAC,
not traced), NCRP/SAHYOG integration, machine-learning risk scores, indexing
at scale, and a mixer list (no citable public source, so the file is
empty and says so).
