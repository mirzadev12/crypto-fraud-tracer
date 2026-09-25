# FineX // Blockchain Intelligence

**SIH 2026 · PS 26183 · Ministry of Home Affairs / I4C · Team FineX**

An investigator pastes a victim-reported TRON or Ethereum wallet address. FineX follows the
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

**241 customer deposit addresses across 10 exchanges on TRON, from 15
explorer-tagged seed wallets — and 221 across 9 exchanges on Ethereum from 12,
80 of them at Indian exchanges (CoinDCX, WazirX and CoinSwitch) — on zero
commercial data licences.** The derivation is browsable at `/attribution` — every row with its
evidence and a link to verify it.

---

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:3000>.

Ten real cases captured from the chain by this pipeline are frozen in
`data/demo-cases.json`; set `DEMO_MODE=true` to serve them without touching the
network. Every result says where it came from: **Live trace**, **Recorded trace**,
or **Illustrative case** for the handful of hand-built cases in `public/mock`,
whose addresses were never on the chain.

---

## The screens

| Route | What it is |
| --- | --- |
| `/` | The pitch: what the tool does and where its limits are. |
| `/dashboard` | Today's complaint queue, ordered by triage rather than arrival — with the watch on money still at rest (and alerts when FineX is closed), and the freeze requests sent from this browser and what each exchange did, counted by exchange. |
| `/investigate` | Address, amount and fraud date in; a full trace out. The address checksum is verified in the browser before anything is sent. |
| `/trace/[address]` | The full result: destination, fund-flow canvas, wallet table, risk flags, movement timeline, chain of custody. |
| `/fund-flow` | Canvas-first explorer with a case rail and a wallet inspector. |
| `/reports` | Every case as an evidence packet. |
| `/report/[address]` | The packet itself — print-ready, and it states its own limitations. It ends with a fingerprint of its findings and a code; opened with `?fp=`, the packet re-derives the case and says whether a copy's fingerprint still matches (`docs/features/07-tamper-evident-packet.md`). |
| `/freeze/[address]` | The restraint request an officer actually sends, naming the account to restrict. States in writing that it is a lead requiring an authorised signature. Above it, where that exchange takes law-enforcement requests and what it requires first, from its own page (`data/le-contacts.json`). |
| `/queue` | Bulk triage. Paste a morning of complaints; they are traced in turn and the register reorders itself as answers land, most recoverable first. A complaint sheet with a State column is also counted by state or union territory. |
| `/attribution` | Where a name comes from: the 15 tagged seeds, all 241 derived deposit addresses, the sweep evidence for each, and where the method is wrong. |
| `/wallet/[address]` | What one address is and who funded it — age, money in and out, and the counterparties on both sides; on request, its payers traced one hop back to the exchanges that funded them. |
| `/operations` | The jury-question surface: who runs it, what it costs, what breaks, and what is not built. |
| `/help` | How to use it, in plain words: what each screen is for, and what the three dispositions mean. In English and Hindi (`?lang=hi`, a machine-drafted translation marked for review). |

---

## Architecture

```
lib/types.ts     frozen contract shared by frontend and backend
lib/chain-client.ts  what the tracer needs from a chain; one interface, two chains
lib/trongrid.ts  TRON: paced, hashed, as-of capable
lib/ethclient.ts Ethereum (Blockscout REST): the same rules, as-of by cursor seek
lib/evm.ts       Keccak-256 and EIP-55, no dependencies
lib/address.ts   one address check for both traceable chains
lib/contracts.ts where USDT on Ethereum stops being traceable: pools, routers, bridges
lib/tracer.ts    the trace: BFS, five limits, taint, dwell, the disposition
lib/risk.ts      the six behavioural rules and their reason strings
lib/labels.ts    one lookup for what an address is, both chains, with its source tier
lib/fiu.ts       FIU-IND registration of an exit exchange, from the Lok Sabha annexure
lib/demo.ts      which recorded case may answer which request
lib/api.ts       the only door from the UI to the backend
lib/tron.ts      base58check address validation (no dependencies)
lib/format.ts    UTC-only, deterministic formatting
components/      shell, canvases, trace view, case queue, evidence packet, primitives
app/             the routes above
data/            label tables (data/eth/ for Ethereum) and the frozen recorded cases
public/mock/     the committed register and illustrative cases — regenerate with scripts/make-mocks.mjs
```

## API

Every screen is built on these routes, so anything the interface does can be
done from another system. Every trace, wallet and watch route takes a TRON
address (`T…`) or an Ethereum address (`0x…`) and reads the chain it belongs
to; a transaction hash is looked up on either. All inputs are checksum-validated
server-side (base58check, EIP-55); a malformed address never reaches the chain. Examples use `curl` against a local
server.

| Method | Route | Returns |
| --- | --- | --- |
| `POST` | `/api/trace` — `{address, amount?, fraudDate?, model?, asOf?}` | `TraceResult`. Amount and date are optional; omitted, the window opens at the wallet's first transfer. `model: "fifo"` traces under first-in-first-out instead of haircut; `asOf` reads the chain as it stood at that moment. Send `Accept: application/x-ndjson` for streamed progress. |
| `GET` | `/api/trace/[address]` | `TraceResult` — the permalink. `?amount=&since=&asof=` replays one run exactly, on the chain as it stood when it was read; `?model=fifo` as above. |
| `GET` | `/api/tx/[hash]` | The USDT transfer inside a transaction: `from`, `to`, amount, time. How a complaint that holds a transaction rather than a wallet becomes a trace. |
| `GET` | `/api/wallet/[address]` | `WalletProfile` — age, money in and out, counterparties, what funded it. |
| `GET` | `/api/payers/[address]` | `PayersTrace` — every wallet that paid it (1 USDT or more), and for the largest twenty, where their own USDT came from, read up to the moment each paid; the exchanges among those sources, named from the attribution register or (Ethereum) the explorer's tags. Up to about twenty chain reads, so it is asked for, not loaded. |
| `GET` | `/api/screen/[address]` | Sanctions screening for an address on any chain the OFAC list covers: the chain, recognised from the format (checksum verified where the format has one), and the listing if there is one. Reads no chain. Not listed is not a clearance, and the response says so. |
| `GET` | `/api/issuer/[address]` | Whether Tether has frozen the address, read from the USDT contract's own blacklist on TRON or Ethereum: `frozen`, `not-frozen`, or `unchecked` when the chain did not answer. The chain now, stamped with `checkedAt` and a SHA-256 of the request and response. |
| `POST` | `/api/watch` — `{items: [{address, since}]}` | For each wallet: `moved` (with every outflow and where it went), `still`, or `unchecked` when the chain did not answer. Up to 25 wallets per call. |
| `GET` · `POST` · `DELETE` | `/api/alerts` | Alerts when the desk is closed. `GET`: whether this server can keep a watch, the public key a browser subscribes with, and when it last checked. `POST {subscription, items}`: a browser hands over its whole watch list, again on every change. `DELETE {endpoint}`: that browser stops. The server checks every five minutes and sends a browser push notification when a wallet moves. |
| `GET` | `/api/health` | `{ok, commit, demoMode, chainAccess, ethereumAccess}` — which commit is serving, whether demo mode is on, and whether TRON and Ethereum reads carry an API key (`keyed` or `public`; a key itself is never returned). Reads nothing from the chain. |
| `GET` | `/api/cases` | Deliberately unimplemented. There is no case database, and serving illustrative records through it would claim chain-read data it is not. |

Trace a wallet, and replay an officer's exact run:

```bash
curl -X POST http://localhost:3000/api/trace -H "Content-Type: application/json" -d "{\"address\":\"TJjc21brTnnmKhiYHQuBD9Pxpfy7BwXHYQ\"}"
```

```bash
curl "http://localhost:3000/api/trace/TXq2kpXz13Z16b2Fjq58NerQTmU7gkkGex?amount=7630.48&since=2026-09-08T19:12:36.000Z&asof=2026-09-14T08:51:06.859Z"
```

That second call is one of the recorded cases, replayed: the same amount, the
same window, and the chain as it stood when the case was read. Confirmed
transfers never change, so it returns the same case on any later day — every
link the app makes carries these three parameters for that reason.

On a server running with `DEMO_MODE=true`, an address that has a recorded case
is answered from its frozen file — stamped `x-finex-provenance: recorded` —
**when the request is that recorded run**: no parameters, or the run's own
amount, window and moment. Anything else goes to the chain like any other
request, on both routes, because a recorded case cannot answer for a run it was
not captured under. `model: "fifo"` always goes to the chain for the same
reason.

Start from a transaction instead of a wallet:

```bash
curl http://localhost:3000/api/tx/a93b9d5758b0f3dc6763c42e7680baa37838ac9f2646438a7da66a8dd2933f00
```

Trace a wallet's payers one hop back — here a 2021 CoinSwitch customer deposit
address on Ethereum:

```bash
curl http://localhost:3000/api/payers/0x57DbDbBFd6155376074640453408bABF7BC7bA2c
```

`exchanges` lists every exchange that funded a payer (Binance, HitBTC and
CoinSwitch among them here), each with `via` — `"table"` from the attribution
register, `"explorer"` from the explorer's tag — and each payer carries a
`status`: `read`, `labelled`, `contract`, `unreadable` or `skipped`. It makes a
chain read per payer, so expect up to a minute.

Ask whether money found at rest has moved since the case was read:

```bash
curl -X POST http://localhost:3000/api/watch -H "Content-Type: application/json" -d "{\"items\":[{\"address\":\"TDii6vao7xyWg2rKPbCPWVRpSmne8xcqYx\",\"since\":\"2026-09-14T08:51:02Z\"}]}"
```

Three answers, never two: a wallet the chain did not answer for comes back
`unchecked`, never `still`.

The same question is asked by the server itself, every five minutes, for any
browser that turns on **Alerts when closed** under the watch on `/dashboard`;
it sends a browser push notification when a wallet moves, encrypted to that
browser (RFC 8291) and signed by this server (RFC 8292), with nothing but
`node:crypto`. A single always-on server needs no setup: it keeps the lists and
its push key in `.finex/` (git-ignored). On a host whose disk does not survive
restarts, set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` and point
`FINEX_STATE_DIR` at a persistent disk — otherwise the next desk to open hands
both back. `docs/features/18-alerts-when-closed.md` has the details and the
command that makes a key pair.

Check how a deployment is set up without opening its hosting dashboard:

```bash
curl http://localhost:3000/api/health
```

`commit` is filled in on Render and `null` elsewhere. Because it reads nothing
from the chain, it is also the address to give an uptime monitor if a free
instance has to be kept awake.

Screen an address from any chain the OFAC list covers — here an Ethereum
address on the list:

```bash
curl http://localhost:3000/api/screen/0x0330070FD38Ec3bB94F58FA55D40368271E9e54A
```

`chain.name` is `"Ethereum / EVM"`, `listing.entity` is `"AMNOKGANG TECHNOLOGY
DEVELOPMENT COMPANY"` with `listing.assets` `["ETH"]`, and `list.published` is
the date OFAC published the copy screened against. An address that is not
listed comes back with `listing: null` and a `note` saying that is not a
clearance.

`AGENTS.md` is the build plan. `CONTEXT.md` records what is already done, the
decisions behind it, and the external data sources that have been verified.

---

## Scope, stated up front

- **Tracing is USDT on TRON (TRC-20) and Ethereum mainnet (ERC-20)** — TRON is
  where the proceeds mostly move; Ethereum runs on the same engine through a
  chain adapter. The same `0x` address on BNB Chain, Polygon or another EVM
  network is not read, and every Ethereum result says so. Where USDT enters a
  DEX pool, router or bridge, the trace stops there and names it from the
  explorer's own tag. An address from any other chain is recognised and
  screened against the OFAC sanctions list, never traced.
- **Rules, not machine learning** — every score must be defensible to a judge.
- **No language model runs anywhere.** The investigator summary is assembled
  from the trace's own figures, and the exchange name is a deterministic lookup
  against a provenance-tagged table.
- **Every label carries a confidence and a source**, and the UI shows both.
- **An unreadable wallet is never reported as an empty one.** A throttled read
  and a wallet with no transfers are the same empty array; the difference is
  tracked, and the tool says "not read" rather than "no activity".
- **All six behavioural rules fire on real recorded cases** — and on a sample of
  17 unreported wallets, peel-chain fired on 16 and fan-out on 15, so those two
  are signals to read, not verdicts.
- **Every recorded case can be re-derived from the chain**, not only re-read:
  `node scripts/rescore-cases.mjs` recomputes each one as of the moment it was
  captured, and `node scripts/verify-case.mjs` checks every transaction it rests
  on without using the tracer at all.

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

```bash
node --import ./tests/register.mjs --test "tests/*.test.mjs"
```

With a server running in demo mode (`DEMO_MODE=true npx next start -p 3032`),
the check the pitch depends on — every recorded case answered from its file,
exactly, and no other address answered from it:

```bash
node --import ./tests/register.mjs scripts/check-demo.mjs 3032
```

All of these run on every push and pull request (`.github/workflows/checks.yml`).
On a fresh checkout, run `npx next typegen` before `npx tsc --noEmit`: the route
types it checks against are generated, not committed.

The tests cover what has a right answer independent of this repository:
Keccak-256 against published vectors and against Node's own SHA3-256 at every
input length up to 420 bytes, EIP-55 against the examples in the EIP, the QR
encoder against a code made by a different encoder (`docs/pitch/qr-finex-light.svg`,
reproduced module for module), push encryption against RFC 8291's worked
example byte for byte, and the complaint-sheet parser. `tests/register.mjs` lets Node load the app's
TypeScript directly; no test dependency is installed.

### Three ways to read one trace

The fund-flow canvas has a **Flow / Bubbles / Graph** toggle, and all three share
one selection — click a wallet in any of them and it highlights in the tables
beside them.

- **Flow** — hop-by-hop graph, left to right. Answers *where did it go, in what
  order*. Transfers forwarded in under ten minutes are drawn amber.
- **Bubbles** — the victim at the centre, one ring per hop, every wallet sized by
  the share of the victim's money that reached it. Answers *where did the money
  end up*. A dashed ring means nothing ever left that wallet.
- **Graph** — every transfer on a timeline, sized by value, over the share of
  the victim's money that survived each hop. Answers *when did it move, and how
  much got through*.

Stack: Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4,
`@xyflow/react` for the flow graph. The bubble map is hand-drawn SVG with a
deterministic layout — no extra dependency, and the same trace always draws the
same picture, which matters when the image goes into an evidence packet.
