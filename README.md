# TraceX — Crypto Fraud Tracer

**SIH 2026 · PS 26183 · Ministry of Home Affairs / I4C · Team FineX**

An investigator pastes a victim-reported TRON wallet address. TraceX follows the
stolen USDT hop by hop, names the exchange **customer deposit address** that
received it — the account that can actually be frozen — flags laundering patterns
in plain English, and calls the case **HOT**, **WARM** or **COLD** by whether the
money can still be reached.

> Binance — customer deposit address `TVZohh…MaiJKA`, confidence 0.87, 12 sweeps
> observed.

Everyone else's tool stops at "the funds went to Binance." Naming the deposit
address is what makes the result actionable.

---

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:3000>.

The UI works with the backend absent: it serves committed fixtures from
`public/mock` and labels every screen **Demo data** so a demo can never be
mistaken for live data. Three addresses have frozen traces, one per triage level —
they are listed on the Investigate screen.

---

## The screens

| Route | What it is |
| --- | --- |
| `/` | The pitch: what the tool does and where its limits are. |
| `/dashboard` | Today's complaint queue, ordered by triage rather than arrival. |
| `/investigate` | Address, amount and fraud date in; a full trace out. The address checksum is verified in the browser before anything is sent. |
| `/trace/[address]` | The full result: destination, fund-flow graph, wallet table, risk flags, movement timeline, chain of custody. |
| `/fund-flow` | Graph-first explorer with a case rail and a wallet inspector. |
| `/reports` | Every case as an evidence packet. |
| `/report/[address]` | The packet itself — print-ready, and it states its own limitations. |

---

## Architecture

```
lib/types.ts     frozen contract shared by frontend and backend
lib/api.ts       the only door to the backend: real API first, fixtures on failure
lib/tron.ts      base58check address validation (no dependencies)
lib/format.ts    UTC-only, deterministic formatting
components/      shell, graph, trace view, case queue, evidence packet, primitives
app/             the routes above
public/mock/     committed fixtures — regenerate with scripts/make-mocks.mjs
```

The backend is three routes, and nothing in the UI changes when they land:

| Method | Route | Returns |
| --- | --- | --- |
| `GET` | `/api/cases` | `CaseSummary[]` |
| `POST` | `/api/trace` — `{address, amount, fraudDate}` | `TraceResult` |
| `GET` | `/api/trace/[address]` | `TraceResult` |

`AGENTS.md` is the build plan. `CONTEXT.md` records what is already done, the
decisions behind it, and the external data sources that have been verified.

---

## Scope, stated up front

- **TRON and USDT (TRC-20) only** — that is where the proceeds actually move.
- **Rules, not machine learning** — every score must be defensible to a judge.
- **No language model decides attribution** — a summary may be generated; the
  exchange name is a deterministic lookup against a provenance-tagged table.
- **Every label carries a confidence and a source**, and the UI shows both.

Attribution is an investigative lead, not sole grounds for freezing an account.
Every evidence packet says so in writing.

---

## Checks

```bash
npm run build
```

```bash
npx tsc --noEmit
```

```bash
npx eslint .
```

Stack: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4,
`@xyflow/react` for the fund-flow graph.
