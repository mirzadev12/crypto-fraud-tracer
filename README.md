# FineX // Blockchain Intelligence

**SIH 2026 · PS 26183 · Ministry of Home Affairs / I4C · Team FineX**

An investigator pastes a victim-reported TRON wallet address. FineX follows the
stolen USDT hop by hop, names the exchange **customer deposit address** that
received it — the account that can actually be frozen — flags laundering patterns
in plain English, and calls the case **HOT**, **WARM** or **COLD** by whether the
money can still be reached.

> Likely Binance deposit cluster — `TSu8wTwNtp6MKDMJaYZ16G5727Axcp8RQy`,
> confidence 0.95, 20 sweeps observed, 100% of inflow forwarded to Binance-Hot 7.

That is a real row from `data/deposit-addresses.json`, derived from public chain
data, and you can check it: open the address on any TRON explorer and the sweep
pattern is there. Everyone else's tool stops at "the funds went to Binance."
Naming the deposit address is what makes the result actionable.

**241 customer deposit addresses across 10 exchanges, from 15 explorer-tagged
seed wallets, on zero commercial data licences.** The derivation is browsable at
`/attribution` — every row with its evidence and a link to verify it.

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
`public/mock` and labels every screen **Recorded trace** so a recorded result can
never be mistaken for a live chain read. Nine real cases captured from the live
pipeline are frozen in `data/demo-cases.json`; set `DEMO_MODE=true` to serve them
without touching the network.

---

## The screens

| Route | What it is |
| --- | --- |
| `/` | The pitch: what the tool does and where its limits are. |
| `/dashboard` | Today's complaint queue, ordered by triage rather than arrival. |
| `/investigate` | Address, amount and fraud date in; a full trace out. The address checksum is verified in the browser before anything is sent. |
| `/trace/[address]` | The full result: destination, fund-flow canvas, wallet table, risk flags, movement timeline, chain of custody. |
| `/fund-flow` | Canvas-first explorer with a case rail and a wallet inspector. |
| `/reports` | Every case as an evidence packet. |
| `/report/[address]` | The packet itself — print-ready, and it states its own limitations. |
| `/freeze/[address]` | The restraint request an officer actually sends, naming the account to restrict. States in writing that it is a lead requiring an authorised signature. |
| `/queue` | Bulk triage. Paste a morning of complaints; they are traced in turn and the register reorders itself as answers land, most recoverable first. |
| `/attribution` | Where a name comes from: the 15 tagged seeds, all 241 derived deposit addresses, the sweep evidence for each, and where the method is wrong. |
| `/wallet/[address]` | What one address is and who funded it — age, money in and out, and the counterparties on both sides. |
| `/operations` | The jury-question surface: who runs it, what it costs, what breaks, and what is not built. |

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

## API

Every screen is built on these routes, so anything the interface does can be
done from another system. All inputs are checksum-validated server-side; a
malformed address never reaches the chain. Examples use `curl` against a local
server.

| Method | Route | Returns |
| --- | --- | --- |
| `POST` | `/api/trace` — `{address, amount?, fraudDate?}` | `TraceResult`. Amount and date are optional; omitted, the window opens at the wallet's first transfer. Send `Accept: application/x-ndjson` for streamed progress. |
| `GET` | `/api/trace/[address]` | `TraceResult` — the permalink. `?amount=&since=` replays one officer's run; `?model=fifo` traces under first-in-first-out instead of haircut. |
| `GET` | `/api/tx/[hash]` | The USDT transfer inside a transaction: `from`, `to`, amount, time. How a complaint that holds a transaction rather than a wallet becomes a trace. |
| `GET` | `/api/wallet/[address]` | `WalletProfile` — age, money in and out, counterparties, what funded it. |
| `POST` | `/api/watch` — `{items: [{address, since}]}` | For each wallet: `moved` (with every outflow and where it went), `still`, or `unchecked` when the chain did not answer. Up to 25 wallets per call. |
| `GET` | `/api/health` | `{ok, commit, demoMode, chainAccess}` — which commit is serving, whether demo mode is on, and whether chain reads carry an API key (`keyed` or `public`; the key itself is never returned). Reads nothing from the chain. |
| `GET` | `/api/cases` | Deliberately unimplemented. There is no case database, and serving illustrative records through it would claim chain-read data it is not. |

Trace a wallet, and replay an officer's exact run:

```bash
curl -X POST http://localhost:3000/api/trace -H "Content-Type: application/json" -d "{\"address\":\"TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ\"}"
```

```bash
curl "http://localhost:3000/api/trace/TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ?amount=1000&since=2026-09-01T00:00:00Z"
```

On a server running with `DEMO_MODE=true`, an address that has a recorded case
is answered from its frozen file — stamped `x-finex-provenance: recorded` —
**when the request matches that recorded run**, which a link made inside the app
always does. Ask for a different `amount` or `since` and it goes to the chain
like any other request, because the recorded case cannot answer for parameters
it was not captured under. `?model=fifo` always goes to the chain for the same
reason.

Start from a transaction instead of a wallet:

```bash
curl http://localhost:3000/api/tx/a93b9d5758b0f3dc6763c42e7680baa37838ac9f2646438a7da66a8dd2933f00
```

Ask whether money found at rest has moved since the case was read:

```bash
curl -X POST http://localhost:3000/api/watch -H "Content-Type: application/json" -d "{\"items\":[{\"address\":\"TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx\",\"since\":\"2026-09-14T08:51:02Z\"}]}"
```

Three answers, never two: a wallet the chain did not answer for comes back
`unchecked`, never `still`.

Check how a deployment is set up without opening its hosting dashboard:

```bash
curl http://localhost:3000/api/health
```

`commit` is filled in on Render and `null` elsewhere. Because it reads nothing
from the chain, it is also the address to give an uptime monitor if a free
instance has to be kept awake.

`AGENTS.md` is the build plan. `CONTEXT.md` records what is already done, the
decisions behind it, and the external data sources that have been verified.

---

## Scope, stated up front

- **TRON and USDT (TRC-20) only** — that is where the proceeds actually move.
- **Rules, not machine learning** — every score must be defensible to a judge.
- **No language model decides attribution** — a summary may be generated; the
  exchange name is a deterministic lookup against a provenance-tagged table.
- **Every label carries a confidence and a source**, and the UI shows both.
- **An unreadable wallet is never reported as an empty one.** A throttled read
  and a wallet with no transfers are the same empty array; the difference is
  tracked, and the tool says "not read" rather than "no activity".
- **Five of the six behavioural rules have been observed firing on real captured
  chain data**; all six fire on the committed fixtures. `NEW_ADDRESS` needs a
  case with a freshly created intermediary and we have not captured one — it is
  listed here rather than left for someone to find.

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

### Two ways to read one trace

The fund-flow canvas has a **Flow / Bubbles** toggle, and both views share one
selection — click a wallet in either and it highlights in the tables beside them.

- **Flow** — hop-by-hop graph, left to right. Answers *where did it go, in what
  order*. Transfers forwarded in under ten minutes are drawn amber.
- **Bubbles** — the victim at the centre, one ring per hop, every wallet sized by
  the share of the victim's money that reached it. Answers *where did the money
  end up*. A dashed ring means nothing ever left that wallet.

Stack: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4,
`@xyflow/react` for the flow graph. The bubble map is hand-drawn SVG with a
deterministic layout — no extra dependency, and the same trace always draws the
same picture, which matters when the image goes into an evidence packet.
